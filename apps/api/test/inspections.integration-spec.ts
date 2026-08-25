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
        title: 'Inspection January',
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

    for (const q of ['electrico', 'eléctrico']) {
      await request(app.getHttpServer())
        .get('/api/v1/inspections/findings/search')
        .query({ q })
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('x-organization-id', orgA)
        .expect(200)
        .expect(({ body }) => {
          expect(body.items).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: findingId })]),
          );
        });
    }

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
      .post(
        `/api/v1/inspections/${inspectionId}/findings/${findingId}/actions/${actionId}/complete`,
      )
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('INVALID_CORRECTIVE_ACTION_TRANSITION'));
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings/${findingId}/verify`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({
        likelihood: 1,
        consequence: 2,
        basis: 'RECORDED_EVIDENCE',
        selfVerificationAcknowledged: true,
      })
      .expect(201)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          residualScore: 2,
          residualRiskLevel: 'LOW',
          status: 'CLOSED',
          closed: true,
        }),
      );

    await request(app.getHttpServer())
      .patch(`/api/v1/inspections/${inspectionId}/findings/${findingId}/actions/${actionId}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({ status: 'OPEN' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('FINDING_CLOSED'));
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings/${findingId}/actions`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({ title: 'No debe reabrir', priority: 'LOW' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('FINDING_CLOSED'));
    expect(
      await prisma.inspectionFinding.findUniqueOrThrow({
        where: { id: findingId },
        select: { status: true },
      }),
    ).toEqual({ status: 'CLOSED' });
    expect(
      await prisma.correctiveAction.findUniqueOrThrow({
        where: { id: actionId },
        select: {
          verificationBasis: true,
          verificationNote: true,
          verifiedByUserId: true,
          selfVerification: true,
          selfVerificationAcknowledged: true,
        },
      }),
    ).toEqual({
      verificationBasis: 'RECORDED_EVIDENCE',
      verificationNote: null,
      verifiedByUserId: ownerA.userId,
      selfVerification: true,
      selfVerificationAcknowledged: true,
    });

    const terminalFinding = await prisma.inspectionFinding.create({
      data: {
        organizationId: orgA,
        inspectionId,
        workCenterId: centerA.id,
        workAreaId: areaA.id,
        category: 'FIRE',
        title: 'Hallazgo para acción terminal',
        description: 'Caso aislado para probar la transición rechazada.',
        riskMethodKey: 'DEMO_5X5',
        riskMethodVersion: '1.0.0',
        initialLikelihood: 1,
        initialConsequence: 1,
        initialScore: 1,
        initialRiskLevel: 'LOW',
        createdById: ownerA.userId,
      },
    });
    const terminalAction = await prisma.correctiveAction.create({
      data: {
        organizationId: orgA,
        findingId: terminalFinding.id,
        title: 'Acción ya verificada',
        status: 'COMPLETED',
        priority: 'LOW',
        createdById: ownerA.userId,
        completedAt: new Date(),
        verifiedAt: new Date(),
        verifiedByUserId: ownerA.userId,
      },
    });
    await request(app.getHttpServer())
      .patch(
        `/api/v1/inspections/${inspectionId}/findings/${terminalFinding.id}/actions/${terminalAction.id}`,
      )
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({ status: 'OPEN' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('INVALID_CORRECTIVE_ACTION_TRANSITION'));

    const observationFinding = await prisma.inspectionFinding.create({
      data: {
        organizationId: orgA,
        inspectionId,
        workCenterId: centerA.id,
        workAreaId: areaA.id,
        category: 'OTHER',
        title: 'Hallazgo para verificación por observación',
        description: 'Caso determinístico sin evidencia registrada.',
        riskMethodKey: 'DEMO_5X5',
        riskMethodVersion: '1.0.0',
        initialLikelihood: 2,
        initialConsequence: 2,
        initialScore: 4,
        initialRiskLevel: 'LOW',
        status: 'PENDING_VERIFICATION',
        createdById: ownerA.userId,
      },
    });
    await prisma.correctiveAction.create({
      data: {
        organizationId: orgA,
        findingId: observationFinding.id,
        title: 'Acción observada en campo',
        priority: 'MEDIUM',
        status: 'PENDING_VERIFICATION',
        assignedToUserId: ownerA.userId,
        createdById: ownerA.userId,
        completedAt: new Date(),
      },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings/${observationFinding.id}/verify`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({ likelihood: 1, consequence: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings/${observationFinding.id}/verify`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({ likelihood: 1, consequence: 1, basis: 'OTHER_JUSTIFIED' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspectionId}/findings/${observationFinding.id}/verify`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({
        likelihood: 1,
        consequence: 1,
        basis: 'FIELD_OBSERVATION',
        note: 'Control confirmado durante recorrido en campo.',
      })
      .expect(201);

    const createStartedInspection = async (title: string) => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('x-organization-id', orgA)
        .send({ workCenterId: centerA.id, workAreaId: areaA.id, title })
        .expect(201);
      const id = created.body.id as string;
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${id}/start`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('x-organization-id', orgA)
        .expect(201);
      return id;
    };
    const februaryInspectionId = await createStartedInspection('Inspection February');
    const februaryFinding = await request(app.getHttpServer())
      .post(`/api/v1/inspections/${februaryInspectionId}/findings`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({
        title: 'Segundo antecedente controlado',
        description: 'Registro para validar recurrencia determinística.',
        category: 'ELECTRICAL',
        likelihood: 3,
        consequence: 4,
      })
      .expect(201);
    expect(februaryFinding.body.recurrenceStatus).toBe('REPEATED');

    const marchInspectionId = await createStartedInspection('Inspection March');
    const marchFinding = await request(app.getHttpServer())
      .post(`/api/v1/inspections/${marchInspectionId}/findings`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({
        title: 'Tercer antecedente controlado',
        description: 'Registro para validar recurrencia determinística.',
        category: 'ELECTRICAL',
        likelihood: 3,
        consequence: 4,
      })
      .expect(201);
    expect(marchFinding.body.recurrenceStatus).toBe('SYSTEMIC_REVIEW_RECOMMENDED');

    const marchDetail = await request(app.getHttpServer())
      .get(`/api/v1/inspections/${marchInspectionId}/findings/${marchFinding.body.id as string}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(200);
    expect(marchDetail.body.recurrence.previous).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: findingId, inspectionId }),
        expect.objectContaining({
          id: februaryFinding.body.id,
          inspectionId: februaryInspectionId,
        }),
      ]),
    );
    const januaryPrevious = marchDetail.body.recurrence.previous.find(
      (item: { id: string }) => item.id === findingId,
    );
    expect(januaryPrevious).toMatchObject({ id: findingId, inspectionId });
    await request(app.getHttpServer())
      .get(
        `/api/v1/inspections/${januaryPrevious.inspectionId as string}/findings/${januaryPrevious.id as string}`,
      )
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(200);
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
      .expect(({ body }) => {
        expect(body.status).toBe('ACKNOWLEDGED');
        expect(body.acknowledgedBy).toMatchObject({ id: ownerA.userId });
        expect(body.acknowledgedAt).toBeTruthy();
      });
    const systemicCreations = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/inspections/alerts/${recurrenceAlert.id as string}/systemic-review`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('x-organization-id', orgA),
      request(app.getHttpServer())
        .post(`/api/v1/inspections/alerts/${recurrenceAlert.id as string}/systemic-review`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('x-organization-id', orgA),
    ]);
    expect(systemicCreations.map(({ status }) => status).sort()).toEqual([201, 409]);
    const systemicReviewId = systemicCreations.find(({ status }) => status === 201)!.body
      .id as string;
    const systemicBefore = await request(app.getHttpServer())
      .get(`/api/v1/inspections/systemic-reviews/${systemicReviewId}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(200);
    expect(systemicBefore.body.relatedFindingsSnapshot).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: findingId, riskMethodKey: 'DEMO_5X5' }),
        expect.objectContaining({ id: februaryFinding.body.id, riskMethodVersion: '1.0.0' }),
        expect.objectContaining({ id: marchFinding.body.id, initialScore: 12 }),
      ]),
    );
    expect(systemicBefore.body).not.toHaveProperty('rootCause');
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/systemic-reviews/${systemicReviewId}/complete`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({
        actionsSufficient: 'NEEDS_MORE_INFORMATION',
        broaderReviewRecommended: true,
        suspectedFactors: 'Coordinación operativa pendiente de análisis profesional.',
        notes: 'No se declara una causa raíz.',
      })
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('COMPLETED'));
    expect(
      await prisma.inspectionAlert.findUniqueOrThrow({
        where: { id: recurrenceAlert.id as string },
        select: { status: true },
      }),
    ).toEqual({ status: 'ACKNOWLEDGED' });

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
      .post(`/api/v1/inspections/alerts/${alertB.id}/systemic-review`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/inspections/systemic-reviews/${systemicReviewId}`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .set('x-organization-id', orgB)
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({ workCenterId: centerA.id, workAreaId: areaB.id, title: 'Cross tenant area' })
      .expect(404);
    expect(await prisma.actionEvidence.findUnique({ where: { id: evidenceB.id } })).not.toBeNull();

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/work-centers/${centerA.id}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(200)
      .expect(({ body }) => expect(body._count.inspections).toBeGreaterThan(0));
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgA}/work-centers/${centerA.id}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({ name: `Centro histórico ${suffix}`, isActive: false })
      .expect(200)
      .expect(({ body }) => expect(body.isActive).toBe(false));
    await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .send({ workCenterId: centerA.id, title: 'No debe usar centro inactivo' })
      .expect(404);
    expect(await prisma.inspection.findUnique({ where: { id: inspectionId } })).not.toBeNull();
    expect(await prisma.inspectionFinding.findUnique({ where: { id: findingId } })).not.toBeNull();
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgB}/work-centers/${centerB.id}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(403);
  }, 60_000);
});
