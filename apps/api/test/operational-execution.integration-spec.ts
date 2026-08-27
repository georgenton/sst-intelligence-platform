import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { type Test as SuperTestRequest } from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('operational execution and work queue integration', () => {
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
        password: 'operational-execution-password-123',
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
      patch: (path: string) => headers(request(app.getHttpServer()).patch(`/api/v1${path}`)),
    };
  }

  it('enforces tenant references, lifecycle, review roles, provenance and single-writer completion', async () => {
    const owner = await register('Operations Owner');
    const outsider = await register('Operations Outsider');
    const viewer = await register('Operations Viewer');
    const orgA = await organization(owner.token, 'Operations A');
    const orgB = await organization(owner.token, 'Operations B');
    await prisma.membership.create({
      data: { organizationId: orgA, userId: viewer.userId, role: 'VIEWER', status: 'ACTIVE' },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgB,
        userId: outsider.userId,
        role: 'SST_TECHNICIAN',
        status: 'ACTIVE',
      },
    });
    const centerA = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgA } });
    const centerB = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgB } });
    const candidateRequirement = await prisma.regulatoryRequirement.create({
      data: {
        requirementKey: `OPERATIONS_CANDIDATE_${suffix.replaceAll(/[^A-Za-z0-9]/g, '').toUpperCase()}`,
        title: 'Requisito candidato para prueba',
        description: 'Fixture candidato determinista.',
        editorialStatus: 'DRAFT',
      },
    });
    await prisma.regulatoryRequirement.update({
      where: { id: candidateRequirement.id },
      data: { editorialStatus: 'TECHNICAL_REVIEW_PENDING' },
    });
    const ownerApi = api(owner.token, orgA);

    await api(viewer.token, orgA)
      .post('/operational-execution/obligations')
      .send({ title: 'Mutación no autorizada', originType: 'MANUAL', manualReference: 'TEST' })
      .expect(403);
    await api(outsider.token, orgA).get('/operational-execution/obligations').expect(403);
    await ownerApi
      .post('/operational-execution/obligations')
      .send({
        title: 'Centro de otra organización',
        originType: 'MANUAL',
        manualReference: 'TEST',
        workCenterId: centerB.id,
      })
      .expect(400);
    await ownerApi
      .post('/operational-execution/obligations')
      .send({
        title: 'Asignación de otra organización',
        originType: 'MANUAL',
        manualReference: 'TEST',
        assignedToUserId: outsider.userId,
      })
      .expect(400);
    await ownerApi
      .post('/operational-execution/obligations')
      .send({
        title: 'Candidato presentado como aprobado',
        originType: 'APPROVED_REQUIREMENT',
        requirementId: candidateRequirement.id,
      })
      .expect(400);

    const candidate = await ownerApi
      .post('/operational-execution/obligations')
      .send({
        title: 'Seguimiento documental candidato',
        description: 'No representa una obligación legal confirmada.',
        originType: 'CANDIDATE_REQUIREMENT',
        requirementId: candidateRequirement.id,
        workCenterId: centerA.id,
        assignedToUserId: owner.userId,
        priority: 'HIGH',
      })
      .expect(201);
    expect(candidate.body).toMatchObject({
      status: 'OPEN',
      originType: 'CANDIDATE_REQUIREMENT',
      version: 1,
      provenanceSnapshot: {
        originType: 'CANDIDATE_REQUIREMENT',
        requirement: { id: candidateRequirement.id, editorialStatus: 'TECHNICAL_REVIEW_PENDING' },
      },
    });
    await api(owner.token, orgB)
      .get(`/operational-execution/obligations/${candidate.body.id as string}`)
      .expect(404);
    await api(owner.token, orgB)
      .patch(`/operational-execution/obligations/${candidate.body.id as string}`)
      .send({ title: 'Cruce de tenant', expectedVersion: 1 })
      .expect(404);

    const direct = await ownerApi
      .post('/operational-execution/obligations')
      .send({
        title: 'Ejecución interna concurrente',
        originType: 'INTERNAL_PROGRAM',
        internalReference: 'Programa preventivo interno 2026',
        priority: 'MEDIUM',
      })
      .expect(201);
    const directId = direct.body.id as string;
    await ownerApi
      .post(`/operational-execution/obligations/${directId}/transition`)
      .send({ status: 'IN_PROGRESS', expectedVersion: 1 })
      .expect(201);
    const completionResults = await Promise.all([
      ownerApi
        .post(`/operational-execution/obligations/${directId}/transition`)
        .send({ status: 'COMPLETED', expectedVersion: 2 }),
      ownerApi
        .post(`/operational-execution/obligations/${directId}/transition`)
        .send({ status: 'COMPLETED', expectedVersion: 2 }),
    ]);
    expect(completionResults.map(({ status }) => status).sort()).toEqual([201, 409]);

    const reviewed = await ownerApi
      .post('/operational-execution/obligations')
      .send({
        title: 'Ejecución regulatoria con revisión',
        originType: 'INTERNAL_PROGRAM',
        internalReference: 'Programa interno con revisión separada',
        workCenterId: centerA.id,
        reviewRequired: true,
        evidenceExpectation: 'Nota de verificación operativa.',
      })
      .expect(201);
    const reviewedId = reviewed.body.id as string;
    await ownerApi
      .post(`/operational-execution/obligations/${reviewedId}/transition`)
      .send({ status: 'IN_PROGRESS', expectedVersion: 1 })
      .expect(201);
    await ownerApi
      .post(`/operational-execution/obligations/${reviewedId}/transition`)
      .send({ status: 'READY_FOR_REVIEW', expectedVersion: 2 })
      .expect(400);
    await ownerApi
      .post(`/operational-execution/obligations/${reviewedId}/evidence`)
      .send({ type: 'NOTE', note: 'Evidencia organizacional registrada para revisión.' })
      .expect(201);
    await ownerApi
      .post(`/operational-execution/obligations/${reviewedId}/transition`)
      .send({ status: 'READY_FOR_REVIEW', expectedVersion: 2 })
      .expect(201);
    await api(viewer.token, orgA)
      .post(`/operational-execution/obligations/${reviewedId}/review`)
      .send({ decision: 'APPROVED', expectedVersion: 3 })
      .expect(403);
    const reviewResults = await Promise.all([
      ownerApi
        .post(`/operational-execution/obligations/${reviewedId}/review`)
        .send({ decision: 'APPROVED', comment: 'Ejecución revisada.', expectedVersion: 3 }),
      ownerApi
        .post(`/operational-execution/obligations/${reviewedId}/review`)
        .send({ decision: 'APPROVED', comment: 'Segunda revisión.', expectedVersion: 3 }),
    ]);
    expect(reviewResults.map(({ status }) => status).sort()).toEqual([201, 409]);
    const final = await ownerApi
      .get(`/operational-execution/obligations/${reviewedId}`)
      .expect(200);
    expect(final.body).toMatchObject({
      status: 'COMPLETED',
      reviewDecision: 'APPROVED',
      version: 4,
    });
    expect(final.body.completedAt).toEqual(expect.any(String));
    expect(final.body.reviewedAt).toEqual(expect.any(String));
    expect(
      await prisma.auditLog.count({
        where: { organizationId: orgA, entityType: 'ObligationExecution' },
      }),
    ).toBeGreaterThanOrEqual(7);

    const queue = await ownerApi.get('/work-queue?module=OPERATIONAL_EXECUTION').expect(200);
    expect(queue.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: candidate.body.id,
          module: 'OPERATIONAL_EXECUTION',
          regulatoryContext: expect.objectContaining({ candidate: true }),
        }),
      ]),
    );
    await api(owner.token, orgB)
      .get('/work-queue?module=OPERATIONAL_EXECUTION')
      .expect(200)
      .expect(({ body }) => expect(body.items).toEqual([]));
  });
});
