import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { type Test as SuperTestRequest } from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('evidence packages integration', () => {
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

  afterAll(async () => app.close());

  async function register(label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `${label.toLowerCase().replaceAll(' ', '-')}-${suffix}@example.test`,
        displayName: label,
        password: 'evidence-package-password-123',
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

  function api(token: string, organizationId: string) {
    const headers = <T extends SuperTestRequest>(operation: T) =>
      operation.set('Authorization', `Bearer ${token}`).set('x-organization-id', organizationId);
    return {
      get: (path: string) => headers(request(app.getHttpServer()).get(`/api/v1${path}`)),
      post: (path: string) => headers(request(app.getHttpServer()).post(`/api/v1${path}`)),
    };
  }

  it('finalizes an immutable tenant manifest backed by canonical source references', async () => {
    const owner = await register('Evidence Owner');
    const viewer = await register('Evidence Viewer');
    const orgA = await organization(owner.token, 'Evidence A');
    const orgB = await organization(owner.token, 'Evidence B');
    await prisma.membership.create({
      data: { organizationId: orgA, userId: viewer.userId, role: 'VIEWER', status: 'ACTIVE' },
    });
    const bodyA = await prisma.governanceBody.create({
      data: {
        organizationId: orgA,
        createdById: owner.userId,
        name: `Gobernanza evidencia A ${suffix}`,
        category: 'WORK_GROUP',
      },
    });
    const bodyB = await prisma.governanceBody.create({
      data: {
        organizationId: orgB,
        createdById: owner.userId,
        name: `Gobernanza evidencia B ${suffix}`,
        category: 'WORK_GROUP',
      },
    });
    const meetingA = await prisma.governanceMeeting.create({
      data: {
        organizationId: orgA,
        bodyId: bodyA.id,
        title: 'Reunión canónica A',
        scheduledAt: new Date('2026-09-10T14:00:00.000Z'),
        mode: 'IN_PERSON',
        createdById: owner.userId,
      },
    });
    const meetingB = await prisma.governanceMeeting.create({
      data: {
        organizationId: orgB,
        bodyId: bodyB.id,
        title: 'Reunión canónica B',
        scheduledAt: new Date('2026-09-11T14:00:00.000Z'),
        mode: 'VIRTUAL',
        createdById: owner.userId,
      },
    });
    const ownerApi = api(owner.token, orgA);

    await api(viewer.token, orgA)
      .post('/evidence-packages')
      .send({ title: 'No autorizado', scope: 'No autorizado por rol' })
      .expect(403);
    await api(viewer.token, orgA).get('/evidence-packages').expect(200);

    const created = await ownerApi
      .post('/evidence-packages')
      .send({
        title: 'Seguimiento de gobernanza',
        scope: 'Evidencia interna del periodo de septiembre.',
      })
      .expect(201);
    const packageId = created.body.id as string;
    await ownerApi
      .post(`/evidence-packages/${packageId}/items`)
      .send({ type: 'GOVERNANCE_MEETING', sourceId: meetingB.id })
      .expect(400);
    await ownerApi
      .post(`/evidence-packages/${packageId}/items`)
      .send({ type: 'GOVERNANCE_MEETING', sourceId: meetingA.id })
      .expect(201);
    await ownerApi
      .post(`/evidence-packages/${packageId}/items`)
      .send({ type: 'GOVERNANCE_MEETING', sourceId: meetingA.id })
      .expect(409);

    const finalized = await ownerApi.post(`/evidence-packages/${packageId}/finalize`).expect(201);
    expect(finalized.body).toMatchObject({
      status: 'FINALIZED',
      version: 1,
      manifest: {
        schemaVersion: 'EVIDENCE_PACKAGE_MANIFEST_V1',
        certificationClaimed: false,
        items: [
          expect.objectContaining({
            type: 'GOVERNANCE_MEETING',
            sourceId: meetingA.id,
            label: 'Reunión canónica A',
          }),
        ],
      },
    });
    expect(finalized.body.manifestDigest).toMatch(/^[a-f0-9]{64}$/);
    await ownerApi
      .post(`/evidence-packages/${packageId}/items`)
      .send({ type: 'GOVERNANCE_MEETING', sourceId: meetingA.id })
      .expect(409);
    await expect(
      prisma.evidencePackage.update({
        where: { id: packageId },
        data: { scope: 'Mutación prohibida del manifiesto finalizado.' },
      }),
    ).rejects.toThrow('Finalized evidence package manifest is immutable');
    await expect(prisma.evidencePackageItem.deleteMany({ where: { packageId } })).rejects.toThrow(
      'Finalized evidence package items are immutable',
    );
    await api(owner.token, orgB).get(`/evidence-packages/${packageId}`).expect(404);

    const archived = await ownerApi.post(`/evidence-packages/${packageId}/archive`).expect(201);
    expect(archived.body).toMatchObject({
      status: 'ARCHIVED',
      manifestDigest: finalized.body.manifestDigest,
      manifest: finalized.body.manifest,
    });
    expect(
      await prisma.auditLog.count({
        where: { organizationId: orgA, entityType: 'EvidencePackage' },
      }),
    ).toBeGreaterThanOrEqual(4);
  });
});
