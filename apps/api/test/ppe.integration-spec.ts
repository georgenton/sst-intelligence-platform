import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PPE operations integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterAll(async () => app.close());

  async function register(label: string) {
    const email = `${label.toLowerCase().replaceAll(' ', '-')}-${suffix}@example.test`;
    const user = await prisma.user.create({
      data: { email, displayName: label, passwordHash: 'integration-fixture-not-for-login' },
      select: { id: true },
    });
    return { token: await jwt.signAsync({ id: user.id, email, sub: user.id }), userId: user.id };
  }

  async function organization(token: string, label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${label} ${suffix}`, country: 'Ecuador' })
      .expect(201);
    return response.body.id as string;
  }

  function api(token: string, organizationId: string) {
    const operation = (method: 'get' | 'post', path: string) => {
      const client = request(app.getHttpServer());
      const pending =
        method === 'get' ? client.get(`/api/v1${path}`) : client.post(`/api/v1${path}`);
      return pending
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', organizationId);
    };
    return {
      get: (path: string) => operation('get', path),
      post: (path: string) => operation('post', path),
    };
  }

  it('preserves tenant, acknowledgement, condition, replacement and worker history invariants', async () => {
    const owner = await register('PPE Owner');
    const technician = await register('PPE Technician');
    const viewer = await register('PPE Viewer');
    const orgA = await organization(owner.token, 'PPE Organization A');
    const orgB = await organization(owner.token, 'PPE Organization B');
    await prisma.organization.updateMany({
      where: { id: { in: [orgA, orgB] } },
      data: { demoExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    await prisma.membership.createMany({
      data: [
        { organizationId: orgA, userId: technician.userId, role: 'SST_TECHNICIAN' },
        { organizationId: orgA, userId: viewer.userId, role: 'VIEWER' },
      ],
    });
    const centerA = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgA } });
    const centerB = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgB } });
    const worker = await prisma.worker.create({
      data: {
        organizationId: orgA,
        displayName: 'Luis Operador',
        workCenterId: centerA.id,
        createdById: owner.userId,
      },
    });
    const inactiveWorker = await prisma.worker.create({
      data: {
        organizationId: orgA,
        displayName: 'Persona histórica',
        status: 'INACTIVE',
        createdById: owner.userId,
      },
    });

    await api(viewer.token, orgA)
      .post('/ppe/catalog')
      .send({ name: 'No autorizado', category: 'HEAD' })
      .expect(403);
    const catalog = await api(owner.token, orgA)
      .post('/ppe/catalog')
      .send({
        name: `Casco interno ${suffix}`,
        category: 'HEAD',
        description: 'Elemento interno de demostración.',
        referenceStandard: 'Referencia informativa interna, sin texto propietario.',
        defaultReplacementIntervalDays: 365,
      })
      .expect(201);
    const catalogId = catalog.body.id as string;
    const otherCatalog = await api(owner.token, orgB)
      .post('/ppe/catalog')
      .send({ name: `Elemento ajeno ${suffix}`, category: 'OTHER' })
      .expect(201);

    await api(technician.token, orgA)
      .post('/ppe/requirements')
      .send({
        workerId: worker.id,
        ppeCatalogItemId: otherCatalog.body.id,
        reason: 'Cruce tenant.',
      })
      .expect(400);
    await api(technician.token, orgA)
      .post('/ppe/requirements')
      .send({
        workerId: worker.id,
        ppeCatalogItemId: catalogId,
        workCenterId: centerB.id,
        reason: 'Centro ajeno.',
      })
      .expect(400);
    await api(technician.token, orgA)
      .post('/ppe/requirements')
      .send({
        workerId: inactiveWorker.id,
        ppeCatalogItemId: catalogId,
        reason: 'Nueva asignación no permitida.',
      })
      .expect(400);

    const requirement = await api(technician.token, orgA)
      .post('/ppe/requirements')
      .send({
        workerId: worker.id,
        ppeCatalogItemId: catalogId,
        workCenterId: centerA.id,
        reason: 'Decisión profesional documentada para la tarea asignada.',
      })
      .expect(201);
    const requirementId = requirement.body.id as string;
    const issued = await api(technician.token, orgA)
      .post('/ppe/issues')
      .send({
        workerId: worker.id,
        ppeCatalogItemId: catalogId,
        requirementId,
        issuedAt: '2026-08-31T08:00:00.000Z',
        quantity: 1,
        assetReference: `EPP-${suffix}`,
        evidenceNote: 'Entrega registrada por el actor autenticado.',
      })
      .expect(201);
    const issueId = issued.body.id as string;
    expect(issued.body).toMatchObject({
      status: 'ISSUED',
      acknowledgementStatus: 'PENDING',
      version: 1,
    });
    expect(
      await prisma.workerPpeRequirement.findUniqueOrThrow({ where: { id: requirementId } }),
    ).toMatchObject({ status: 'FULFILLED' });

    const concurrentRequirement = await api(owner.token, orgA)
      .post('/ppe/requirements')
      .send({
        workerId: worker.id,
        ppeCatalogItemId: catalogId,
        reason: 'Prueba de entrega única.',
      })
      .expect(201);
    const issueRequest = () =>
      api(owner.token, orgA).post('/ppe/issues').send({
        workerId: worker.id,
        ppeCatalogItemId: catalogId,
        requirementId: concurrentRequirement.body.id,
        issuedAt: '2026-08-31T08:05:00.000Z',
        expectedReplacementAt: '2027-08-31T08:05:00.000Z',
      });
    const concurrentStatuses = (await Promise.all([issueRequest(), issueRequest()]))
      .map((response) => response.status)
      .sort();
    expect(concurrentStatuses).toEqual([201, 400]);
    expect(
      await prisma.ppeIssue.count({ where: { requirementId: concurrentRequirement.body.id } }),
    ).toBe(1);

    const acknowledged = await api(technician.token, orgA)
      .post(`/ppe/issues/${issueId}/acknowledge`)
      .send({
        expectedVersion: 1,
        note: 'Confirmación presencial registrada; no requiere cuenta del trabajador.',
      })
      .expect(201);
    expect(acknowledged.body).toMatchObject({
      status: 'IN_SERVICE',
      acknowledgementStatus: 'RECORDED',
      version: 2,
    });

    await api(technician.token, orgA)
      .post(`/ppe/issues/${issueId}/inspect`)
      .send({
        expectedVersion: 2,
        inspectedAt: '2026-08-31T09:00:00.000Z',
        condition: 'REVIEW_REQUIRED',
        note: 'Revisar ajuste antes de la siguiente tarea.',
      })
      .expect(201);
    const conditionQueue = await api(owner.token, orgA).get('/work-queue?module=PPE').expect(200);
    expect(conditionQueue.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'PPE_CONDITION_REVIEW',
          deepLink: `/app/workers/${worker.id}#epp-issue-${issueId}`,
        }),
      ]),
    );

    const replacementDue = await api(technician.token, orgA)
      .post(`/ppe/issues/${issueId}/inspect`)
      .send({
        expectedVersion: 3,
        inspectedAt: '2026-08-31T10:00:00.000Z',
        condition: 'UNSERVICEABLE',
        note: 'El elemento se retira del servicio para reemplazo.',
      })
      .expect(201);
    expect(replacementDue.body).toMatchObject({ status: 'REPLACEMENT_DUE', version: 4 });
    const replacementQueue = await api(owner.token, orgA).get('/work-queue?module=PPE').expect(200);
    expect(replacementQueue.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'PPE_REPLACEMENT_DUE',
          sourceId: issueId,
          deepLink: `/app/workers/${worker.id}#epp-issue-${issueId}`,
        }),
      ]),
    );
    expect(replacementQueue.body.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'PPE_CONDITION_REVIEW', sourceId: expect.any(String) }),
      ]),
    );

    const replacementRequest = () =>
      api(owner.token, orgA)
        .post(`/ppe/issues/${issueId}/replace`)
        .send({
          expectedVersion: 4,
          issuedAt: '2026-08-31T11:00:00.000Z',
          assetReference: `EPP-REPLACEMENT-${suffix}`,
          evidenceNote: 'Sustitución física registrada.',
        });
    const replacementResponses = await Promise.all([replacementRequest(), replacementRequest()]);
    expect(replacementResponses.map(({ status }) => status).sort()).toEqual([201, 409]);
    const replacement = replacementResponses.find(({ status }) => status === 201)!;
    expect(replacement.body).toMatchObject({
      status: 'ISSUED',
      replacesIssueId: issueId,
      version: 1,
    });
    expect(await prisma.ppeIssue.findUniqueOrThrow({ where: { id: issueId } })).toMatchObject({
      status: 'REPLACED',
      version: 5,
    });

    const workspace = await api(viewer.token, orgA).get(`/ppe/workers/${worker.id}`).expect(200);
    expect(workspace.body.issues).toHaveLength(3);
    expect(workspace.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: issueId, status: 'REPLACED' }),
        expect.objectContaining({
          id: replacement.body.id,
          status: 'ISSUED',
          replacesIssueId: issueId,
        }),
      ]),
    );
    await api(owner.token, orgB).get(`/ppe/workers/${worker.id}`).expect(404);
    expect(
      await prisma.auditLog.count({
        where: { organizationId: orgA, action: { startsWith: 'PPE_' } },
      }),
    ).toBeGreaterThanOrEqual(8);
  });
});
