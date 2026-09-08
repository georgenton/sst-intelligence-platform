import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { type Test as SuperTestRequest } from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('intelligent inspections integration', () => {
  const demoRiskMethodVersionId = '54000000-0000-4000-8000-000000000001';
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
        riskMethodVersionId: demoRiskMethodVersionId,
        inspectionDepth: 'BASIC',
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
        .send({
          workCenterId: centerA.id,
          workAreaId: areaA.id,
          title,
          riskMethodVersionId: demoRiskMethodVersionId,
          inspectionDepth: 'BASIC',
        })
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
    expect(
      await prisma.inspectionSystemicReview.count({
        where: { alertId: recurrenceAlert.id as string },
      }),
    ).toBe(1);
    const systemicBefore = await request(app.getHttpServer())
      .get(`/api/v1/inspections/systemic-reviews/${systemicReviewId}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(200);
    const systemicWorkCenterName = systemicBefore.body.workCenterName as string;
    const systemicFindingSnapshot = systemicBefore.body.relatedFindingsSnapshot;
    expect(systemicBefore.body.relatedFindingsSnapshot).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: findingId, riskMethodKey: 'DEMO_5X5' }),
        expect.objectContaining({ id: februaryFinding.body.id, riskMethodVersion: '1.0.0' }),
        expect.objectContaining({ id: marchFinding.body.id, initialScore: 12 }),
      ]),
    );
    expect(systemicBefore.body).not.toHaveProperty('rootCause');
    const systemicSafetyBefore = {
      findings: await prisma.inspectionFinding.findMany({
        where: {
          id: {
            in: [findingId, februaryFinding.body.id as string, marchFinding.body.id as string],
          },
        },
        select: {
          id: true,
          initialScore: true,
          initialRiskLevel: true,
          residualScore: true,
          residualRiskLevel: true,
          status: true,
        },
        orderBy: { id: 'asc' },
      }),
      actions: await prisma.correctiveAction.findMany({
        where: { organizationId: orgA },
        select: { id: true, status: true },
        orderBy: { id: 'asc' },
      }),
      applicabilityAssessments: await prisma.applicabilityAssessment.count({
        where: { organizationId: orgA },
      }),
    };
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
    expect({
      findings: await prisma.inspectionFinding.findMany({
        where: {
          id: {
            in: [findingId, februaryFinding.body.id as string, marchFinding.body.id as string],
          },
        },
        select: {
          id: true,
          initialScore: true,
          initialRiskLevel: true,
          residualScore: true,
          residualRiskLevel: true,
          status: true,
        },
        orderBy: { id: 'asc' },
      }),
      actions: await prisma.correctiveAction.findMany({
        where: { organizationId: orgA },
        select: { id: true, status: true },
        orderBy: { id: 'asc' },
      }),
      applicabilityAssessments: await prisma.applicabilityAssessment.count({
        where: { organizationId: orgA },
      }),
    }).toEqual(systemicSafetyBefore);
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
      .send({
        workCenterId: centerA.id,
        workAreaId: areaB.id,
        title: 'Cross tenant area',
        riskMethodVersionId: demoRiskMethodVersionId,
        inspectionDepth: 'BASIC',
      })
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
      .send({
        workCenterId: centerA.id,
        title: 'No debe usar centro inactivo',
        riskMethodVersionId: demoRiskMethodVersionId,
        inspectionDepth: 'BASIC',
      })
      .expect(404);
    expect(await prisma.inspection.findUnique({ where: { id: inspectionId } })).not.toBeNull();
    expect(await prisma.inspectionFinding.findUnique({ where: { id: findingId } })).not.toBeNull();
    const historicalSystemicReview = await prisma.inspectionSystemicReview.findUniqueOrThrow({
      where: { id: systemicReviewId },
    });
    expect(historicalSystemicReview.workCenterName).toBe(systemicWorkCenterName);
    expect(historicalSystemicReview.relatedFindingsSnapshot).toEqual(systemicFindingSnapshot);
    expect(historicalSystemicReview.workCenterId).toBe(centerA.id);
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgB}/work-centers/${centerB.id}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .set('x-organization-id', orgA)
      .expect(403);
  }, 60_000);

  it('enforces HIGH/CRITICAL self-verification and the finite verification-basis matrix', async () => {
    const owner = await register('Inspection Matrix Owner');
    const verifier = await register('Inspection Matrix Verifier');
    const organizationId = await organization(owner.token, 'Inspection Matrix Organization');
    await enableInspections(organizationId);
    await prisma.membership.create({
      data: {
        organizationId,
        userId: verifier.userId,
        role: 'SST_MANAGER',
        status: 'ACTIVE',
      },
    });
    const center = await prisma.workCenter.findFirstOrThrow({ where: { organizationId } });
    const inspection = await prisma.inspection.create({
      data: {
        organizationId,
        workCenterId: center.id,
        title: 'Matriz de verificación',
        inspectorUserId: owner.userId,
        status: 'IN_PROGRESS',
      },
    });
    const ownerHeaders = (call: SuperTestRequest) =>
      call.set('Authorization', `Bearer ${owner.token}`).set('x-organization-id', organizationId);
    const verifierHeaders = (call: SuperTestRequest) =>
      call
        .set('Authorization', `Bearer ${verifier.token}`)
        .set('x-organization-id', organizationId);
    let sequence = 0;
    const createPendingFinding = async (input: {
      level: 'LOW' | 'HIGH' | 'CRITICAL';
      likelihood: number;
      consequence: number;
      assignedToUserId?: string;
      withEvidence?: boolean;
    }) => {
      sequence += 1;
      const finding = await prisma.inspectionFinding.create({
        data: {
          organizationId,
          inspectionId: inspection.id,
          workCenterId: center.id,
          category: 'OTHER',
          title: `Matriz de verificación ${sequence}`,
          description: 'Fixture determinístico para política de verificación.',
          riskMethodKey: 'DEMO_5X5',
          riskMethodVersion: '1.0.0',
          initialLikelihood: input.likelihood,
          initialConsequence: input.consequence,
          initialScore: input.likelihood * input.consequence,
          initialRiskLevel: input.level,
          status: 'PENDING_VERIFICATION',
          createdById: owner.userId,
        },
      });
      const action = await prisma.correctiveAction.create({
        data: {
          organizationId,
          findingId: finding.id,
          title: `Acción de verificación ${sequence}`,
          priority: 'HIGH',
          status: 'PENDING_VERIFICATION',
          assignedToUserId: input.assignedToUserId,
          createdById: owner.userId,
          completedAt: new Date(),
        },
      });
      if (input.withEvidence) {
        await prisma.actionEvidence.create({
          data: {
            organizationId,
            correctiveActionId: action.id,
            type: 'NOTE',
            note: 'Evidencia determinística registrada.',
            createdById: owner.userId,
          },
        });
      }
      return { findingId: finding.id, actionId: action.id };
    };
    const verificationPath = (findingId: string) =>
      `/api/v1/inspections/${inspection.id}/findings/${findingId}/verify`;

    const high = await createPendingFinding({
      level: 'HIGH',
      likelihood: 4,
      consequence: 4,
      assignedToUserId: owner.userId,
    });
    await ownerHeaders(request(app.getHttpServer()).post(verificationPath(high.findingId)))
      .send({
        likelihood: 1,
        consequence: 1,
        basis: 'FIELD_OBSERVATION',
        note: 'Observación directa del control aplicado.',
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('SELF_VERIFICATION_ACKNOWLEDGEMENT_REQUIRED'));
    await ownerHeaders(request(app.getHttpServer()).post(verificationPath(high.findingId)))
      .send({
        likelihood: 1,
        consequence: 1,
        basis: 'FIELD_OBSERVATION',
        note: 'Observación directa del control aplicado.',
        selfVerificationAcknowledged: true,
      })
      .expect(201);
    expect(
      await prisma.correctiveAction.findUniqueOrThrow({ where: { id: high.actionId } }),
    ).toMatchObject({
      selfVerification: true,
      selfVerificationAcknowledged: true,
      verifiedByUserId: owner.userId,
    });

    const critical = await createPendingFinding({
      level: 'CRITICAL',
      likelihood: 4,
      consequence: 5,
      assignedToUserId: owner.userId,
    });
    await ownerHeaders(request(app.getHttpServer()).post(verificationPath(critical.findingId)))
      .send({
        likelihood: 1,
        consequence: 1,
        basis: 'FIELD_OBSERVATION',
        note: 'Observación directa del control aplicado.',
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('SELF_VERIFICATION_ACKNOWLEDGEMENT_REQUIRED'));
    await ownerHeaders(request(app.getHttpServer()).post(verificationPath(critical.findingId)))
      .send({
        likelihood: 1,
        consequence: 1,
        basis: 'FIELD_OBSERVATION',
        note: 'Observación directa del control aplicado.',
        selfVerificationAcknowledged: true,
      })
      .expect(201);

    const differentVerifier = await createPendingFinding({
      level: 'CRITICAL',
      likelihood: 4,
      consequence: 5,
      assignedToUserId: owner.userId,
    });
    await verifierHeaders(
      request(app.getHttpServer()).post(verificationPath(differentVerifier.findingId)),
    )
      .send({
        likelihood: 1,
        consequence: 1,
        basis: 'FIELD_OBSERVATION',
        note: 'Verificación independiente por responsable autorizado.',
      })
      .expect(201);
    expect(
      await prisma.correctiveAction.findUniqueOrThrow({
        where: { id: differentVerifier.actionId },
      }),
    ).toMatchObject({
      selfVerification: false,
      selfVerificationAcknowledged: false,
      verifiedByUserId: verifier.userId,
    });

    const recorded = await createPendingFinding({
      level: 'LOW',
      likelihood: 1,
      consequence: 1,
      assignedToUserId: owner.userId,
    });
    await ownerHeaders(request(app.getHttpServer()).post(verificationPath(recorded.findingId)))
      .send({ likelihood: 1, consequence: 1, basis: 'RECORDED_EVIDENCE' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VERIFICATION_EVIDENCE_REQUIRED'));
    await prisma.actionEvidence.create({
      data: {
        organizationId,
        correctiveActionId: recorded.actionId,
        type: 'NOTE',
        note: 'Evidencia añadida después del rechazo controlado.',
        createdById: owner.userId,
      },
    });
    await ownerHeaders(request(app.getHttpServer()).post(verificationPath(recorded.findingId)))
      .send({ likelihood: 1, consequence: 1, basis: 'RECORDED_EVIDENCE' })
      .expect(201);

    const field = await createPendingFinding({
      level: 'LOW',
      likelihood: 1,
      consequence: 1,
      assignedToUserId: owner.userId,
    });
    await ownerHeaders(request(app.getHttpServer()).post(verificationPath(field.findingId)))
      .send({ likelihood: 1, consequence: 1, basis: 'FIELD_OBSERVATION' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VERIFICATION_NOTE_REQUIRED'));
    await ownerHeaders(request(app.getHttpServer()).post(verificationPath(field.findingId)))
      .send({
        likelihood: 1,
        consequence: 1,
        basis: 'FIELD_OBSERVATION',
        note: 'Verificación observada directamente en campo.',
      })
      .expect(201);

    const other = await createPendingFinding({
      level: 'LOW',
      likelihood: 1,
      consequence: 1,
      assignedToUserId: owner.userId,
    });
    await ownerHeaders(request(app.getHttpServer()).post(verificationPath(other.findingId)))
      .send({ likelihood: 1, consequence: 1, basis: 'OTHER_JUSTIFIED' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VERIFICATION_NOTE_REQUIRED'));
    await ownerHeaders(request(app.getHttpServer()).post(verificationPath(other.findingId)))
      .send({
        likelihood: 1,
        consequence: 1,
        basis: 'OTHER_JUSTIFIED',
        note: 'Justificación profesional documentada para este caso.',
      })
      .expect(201);
  }, 60_000);
});
