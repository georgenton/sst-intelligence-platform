import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('intelligent inspections integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
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
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(label: string) {
    const emailLabel = label.toLowerCase().replaceAll(' ', '-');
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `${emailLabel}-${suffix}@example.test`,
        displayName: label,
        password: 'inspection-password-strong-123',
      })
      .expect(201);
    return { token: response.body.accessToken as string, userId: response.body.user.id as string };
  }

  async function organization(token: string, label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${label} ${suffix}`, country: 'Ecuador' })
      .expect(201);
    return response.body.id as string;
  }

  async function enableInspections(organizationId: string) {
    const module = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'INSPECTIONS_INTELLIGENCE' },
    });
    await prisma.organizationModule.upsert({
      where: { organizationId_moduleId: { organizationId, moduleId: module.id } },
      update: { status: 'ACTIVE', source: 'MANUAL' },
      create: { organizationId, moduleId: module.id, status: 'ACTIVE', source: 'MANUAL' },
    });
  }

  it('covers lifecycle, deterministic recurrence, roles, entitlement and tenant isolation', async () => {
    const ownerA = await register('Inspection Owner A');
    const orgA = await organization(ownerA.token, 'Inspection Organization A');
    await enableInspections(orgA);
    const centerA = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgA } });
    const areaA = await prisma.workArea.create({
      data: { organizationId: orgA, workCenterId: centerA.id, name: `Area A ${suffix}` },
    });

    const noModule = await organization(ownerA.token, 'No Module Organization');
    await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', noModule)
      .send({ workCenterId: centerA.id, title: 'Should be denied' })
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe('ENTITLEMENT_REQUIRED');
      });

    const viewer = await register('Inspection Viewer');
    await prisma.membership.create({
      data: { organizationId: orgA, userId: viewer.userId, role: 'VIEWER', status: 'ACTIVE' },
    });
    await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set('Authorization', `Bearer ${viewer.token}`)
      .set('x-organization-id', orgA)
      .send({ workCenterId: centerA.id, title: 'Viewer mutation' })
      .expect(403);

    const inspection = await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({
        workCenterId: centerA.id,
        workAreaId: areaA.id,
        title: 'Recorrido eléctrico principal',
      })
      .expect(201);
    const inspectionId = inspection.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/start`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(201);

    const finding = await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({
        title: 'Tablero sin control',
        description: 'Hallazgo de integración sin datos personales.',
        category: 'ELECTRICAL',
        likelihood: 4,
        consequence: 5,
      })
      .expect(201);
    expect(finding.body).toMatchObject({
      initialScore: 20,
      initialRiskLevel: 'CRITICAL',
      riskMethodKey: 'DEMO_5X5',
      riskMethodVersion: '1.0.0',
      recurrenceStatus: 'NONE',
    });
    const findingId = finding.body.id as string;

    const action = await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings/${findingId}/actions`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({
        title: 'Aislar y señalizar tablero',
        assignedToUserId: ownerA.userId,
        priority: 'URGENT',
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .expect(201);
    const actionId = action.body.id as string;
    await request(app.getHttpServer())
      .post(
        `/api/v1/inspections/${inspectionId}/findings/${findingId}/actions/${actionId}/evidence`,
      )
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({ type: 'NOTE', note: 'Control aplicado y revisado en campo.' })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/inspections/${inspectionId}/findings/${findingId}/actions/${actionId}/complete`,
      )
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('PENDING_VERIFICATION'));
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings/${findingId}/verify`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({ likelihood: 1, consequence: 2 })
      .expect(201)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          residualScore: 2,
          residualRiskLevel: 'LOW',
          status: 'CLOSED',
          closed: true,
        }),
      );

    for (const index of [2, 3]) {
      const recurrent = await request(app.getHttpServer())
        .post(`/api/v1/inspections/${inspectionId}/findings`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('x-organization-id', orgA)
        .send({
          title: `Hallazgo eléctrico recurrente ${index}`,
          description: 'Registro para validar recurrencia determinística.',
          category: 'ELECTRICAL',
          likelihood: 3,
          consequence: 4,
        })
        .expect(201);
      expect(recurrent.body.recurrenceStatus).toBe(
        index === 2 ? 'REPEATED' : 'SYSTEMIC_REVIEW_RECOMMENDED',
      );
    }
    const alerts = await request(app.getHttpServer())
      .get('/api/v1/inspections/alerts')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(200);
    const recurrenceAlert = alerts.body.items.find(
      (item: { type: string }) => item.type === 'RECURRENCE',
    );
    expect(recurrenceAlert).toBeTruthy();
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/alerts/${recurrenceAlert.id as string}/acknowledge`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('ACKNOWLEDGED'));

    const ownerB = await register('Inspection Owner B');
    const orgB = await organization(ownerB.token, 'Inspection Organization B');
    await enableInspections(orgB);
    const centerB = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgB } });
    const areaB = await prisma.workArea.create({
      data: { organizationId: orgB, workCenterId: centerB.id, name: `Area B ${suffix}` },
    });
    const inspectionB = await prisma.inspection.create({
      data: {
        organizationId: orgB,
        workCenterId: centerB.id,
        workAreaId: areaB.id,
        title: 'Inspection B',
        inspectorUserId: ownerB.userId,
      },
    });
    const findingB = await prisma.inspectionFinding.create({
      data: {
        organizationId: orgB,
        inspectionId: inspectionB.id,
        workCenterId: centerB.id,
        workAreaId: areaB.id,
        category: 'FIRE',
        title: 'Finding B',
        description: 'Tenant B',
        riskMethodKey: 'DEMO_5X5',
        riskMethodVersion: '1.0.0',
        initialLikelihood: 1,
        initialConsequence: 1,
        initialScore: 1,
        initialRiskLevel: 'LOW',
        createdById: ownerB.userId,
      },
    });
    const actionB = await prisma.correctiveAction.create({
      data: {
        organizationId: orgB,
        findingId: findingB.id,
        title: 'Action B',
        priority: 'LOW',
        createdById: ownerB.userId,
      },
    });
    const evidenceB = await prisma.actionEvidence.create({
      data: {
        organizationId: orgB,
        correctiveActionId: actionB.id,
        type: 'NOTE',
        note: 'Tenant B',
        createdById: ownerB.userId,
      },
    });
    const alertB = await prisma.inspectionAlert.create({
      data: {
        organizationId: orgB,
        findingId: findingB.id,
        type: 'RECURRENCE',
        severity: 'INFO',
        message: 'Tenant B',
      },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/inspections/${inspectionB.id}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/inspections/${inspectionB.id}/findings/${findingB.id}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/inspections/${inspectionB.id}/findings/${findingB.id}/actions/${actionB.id}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({ title: 'Cross tenant' })
      .expect(404);
    await request(app.getHttpServer())
      .post(
        `/api/v1/inspections/${inspectionB.id}/findings/${findingB.id}/actions/${actionB.id}/evidence`,
      )
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({ type: 'NOTE', note: 'Cross tenant' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/alerts/${alertB.id}/acknowledge`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({ workCenterId: centerA.id, workAreaId: areaB.id, title: 'Cross tenant area' })
      .expect(404);
    expect(await prisma.actionEvidence.findUnique({ where: { id: evidenceB.id } })).not.toBeNull();
  }, 60_000);
});
