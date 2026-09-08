import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('workforce safety refinement integration', () => {
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
      return (method === 'get' ? client.get(`/api/v1${path}`) : client.post(`/api/v1${path}`))
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', organizationId);
    };
    return {
      get: (path: string) => operation('get', path),
      post: (path: string) => operation('post', path),
    };
  }

  it('connects position, worker, PPE, incident, observation and training without tenant leakage', async () => {
    const owner = await register('Refinement Owner');
    const viewer = await register('Refinement Viewer');
    const technician = await register('Refinement Technician');
    const orgA = await organization(owner.token, 'Refinement A');
    const orgB = await organization(owner.token, 'Refinement B');
    await prisma.organization.updateMany({
      where: { id: { in: [orgA, orgB] } },
      data: { demoExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    await prisma.membership.createMany({
      data: [
        { organizationId: orgA, userId: viewer.userId, role: 'VIEWER', status: 'ACTIVE' },
        {
          organizationId: orgA,
          userId: technician.userId,
          role: 'SST_TECHNICIAN',
          status: 'ACTIVE',
        },
      ],
    });
    const centerA = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgA } });
    const centerB = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgB } });
    const areaA = await prisma.workArea.create({
      data: { organizationId: orgA, workCenterId: centerA.id, name: `Producción ${suffix}` },
    });
    const areaB = await prisma.workArea.create({
      data: { organizationId: orgB, workCenterId: centerB.id, name: `Bodega ${suffix}` },
    });
    const centerAOther = await prisma.workCenter.create({
      data: { organizationId: orgA, name: `Centro alterno ${suffix}`, city: 'Quito' },
    });
    const areaAOther = await prisma.workArea.create({
      data: { organizationId: orgA, workCenterId: centerA.id, name: `Área alterna ${suffix}` },
    });

    const positionA = await api(owner.token, orgA)
      .post('/workers/positions')
      .send({ name: `Operador eléctrico ${suffix}`, code: `OE-${suffix}` })
      .expect(201);
    const positionB = await api(owner.token, orgB)
      .post('/workers/positions')
      .send({ name: `Cargo ajeno ${suffix}` })
      .expect(201);
    const positionAOther = await api(owner.token, orgA)
      .post('/workers/positions')
      .send({ name: `Cargo alterno ${suffix}` })
      .expect(201);
    const riskA = await api(owner.token, orgA)
      .post(`/workers/positions/${positionA.body.id}/risks`)
      .send({
        category: 'ELECTRICAL',
        description: 'Contacto eléctrico y arco en tareas autorizadas.',
      })
      .expect(201);
    await api(owner.token, orgA)
      .post(`/workers/positions/${positionB.body.id}/risks`)
      .send({ category: 'CHEMICAL', description: 'Cruce tenant.' })
      .expect(404);

    const membershipCountBeforeWorker = await prisma.membership.count({
      where: { organizationId: orgA },
    });
    const workerA = await api(owner.token, orgA)
      .post('/workers')
      .send({
        displayName: 'Pedro Operador',
        workCenterId: centerA.id,
        workAreaId: areaA.id,
        positionId: positionA.body.id,
      })
      .expect(201);
    expect(await prisma.membership.count({ where: { organizationId: orgA } })).toBe(
      membershipCountBeforeWorker,
    );
    await api(owner.token, orgA)
      .post('/workers')
      .send({
        displayName: 'Cruce organizacional',
        workCenterId: centerA.id,
        workAreaId: areaB.id,
        positionId: positionB.body.id,
      })
      .expect(400);
    const workerB = await prisma.worker.create({
      data: {
        organizationId: orgB,
        displayName: 'Persona B',
        workCenterId: centerB.id,
        createdById: owner.userId,
      },
    });
    const workerWithoutPosition = await prisma.worker.create({
      data: {
        organizationId: orgA,
        displayName: 'Persona sin cargo',
        workCenterId: centerA.id,
        workAreaId: areaA.id,
        createdById: owner.userId,
      },
    });

    const catalogA = await prisma.ppeCatalogItem.create({
      data: {
        organizationId: orgA,
        name: `Guantes dieléctricos ${suffix}`,
        category: 'HAND_ARM',
        createdById: owner.userId,
      },
    });
    const catalogB = await prisma.ppeCatalogItem.create({
      data: {
        organizationId: orgB,
        name: `EPP ajeno ${suffix}`,
        category: 'HAND_ARM',
        createdById: owner.userId,
      },
    });
    await api(owner.token, orgA)
      .post('/ppe/catalog')
      .send({
        name: `Referencia incompleta ${suffix}`,
        category: 'HEAD',
        referenceStandard: 'Referencia técnica sintética',
        referenceReviewStatus: 'REVIEWED',
      })
      .expect(400);
    await api(owner.token, orgA)
      .post('/ppe/catalog')
      .send({
        name: `Referencia revisada ${suffix}`,
        category: 'HEAD',
        referenceStandard: 'Referencia técnica sintética',
        referenceProvenance: 'Registro sintético verificado por profesional.',
        referenceReviewStatus: 'REVIEWED',
      })
      .expect(201);
    const candidates = await api(owner.token, orgA)
      .get(`/workers/positions/${positionA.body.id}/ppe-candidates`)
      .expect(200);
    expect(candidates.body.categories).toContain('HAND_ARM');
    expect(candidates.body.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          risk: expect.objectContaining({ id: riskA.body.id, category: 'ELECTRICAL' }),
          categories: expect.arrayContaining(['HAND_ARM', 'FOOT']),
        }),
      ]),
    );
    expect(candidates.body.catalogItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: catalogA.id })]),
    );
    expect(candidates.body.catalogItems).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: catalogB.id })]),
    );
    await api(owner.token, orgA)
      .post('/ppe/position-requirements')
      .send({
        positionId: positionA.body.id,
        riskContextId: riskA.body.id,
        ppeCatalogItemId: catalogB.id,
        reason: 'No debe cruzar organización.',
        decision: 'SELECTED_BY_PROFESSIONAL',
      })
      .expect(400);
    const positionRequirement = await api(owner.token, orgA)
      .post('/ppe/position-requirements')
      .send({
        positionId: positionA.body.id,
        riskContextId: riskA.body.id,
        ppeCatalogItemId: catalogA.id,
        workCenterId: centerA.id,
        workAreaId: areaA.id,
        reason: 'Selección profesional para la tarea eléctrica.',
        decision: 'REQUIRED_INTERNALLY',
      })
      .expect(201);
    const positionMismatchRequirement = await api(owner.token, orgA)
      .post('/ppe/position-requirements')
      .send({
        positionId: positionAOther.body.id,
        ppeCatalogItemId: catalogA.id,
        reason: 'Requisito de otro cargo del mismo tenant.',
        decision: 'REQUIRED_INTERNALLY',
      })
      .expect(201);
    const centerMismatchRequirement = await api(owner.token, orgA)
      .post('/ppe/position-requirements')
      .send({
        positionId: positionA.body.id,
        ppeCatalogItemId: catalogA.id,
        workCenterId: centerAOther.id,
        reason: 'Requisito de otro centro del mismo tenant.',
        decision: 'REQUIRED_INTERNALLY',
      })
      .expect(201);
    const areaMismatchRequirement = await api(owner.token, orgA)
      .post('/ppe/position-requirements')
      .send({
        positionId: positionA.body.id,
        ppeCatalogItemId: catalogA.id,
        workCenterId: centerA.id,
        workAreaId: areaAOther.id,
        reason: 'Requisito de otra área del mismo tenant.',
        decision: 'REQUIRED_INTERNALLY',
      })
      .expect(201);
    for (const positionRequirementId of [
      positionMismatchRequirement.body.id,
      centerMismatchRequirement.body.id,
      areaMismatchRequirement.body.id,
    ]) {
      await api(owner.token, orgA)
        .post('/ppe/requirements')
        .send({
          workerId: workerA.body.id,
          ppeCatalogItemId: catalogA.id,
          positionRequirementId,
          reason: 'Debe rechazarse por provenance incompatible.',
        })
        .expect(400);
    }
    await api(owner.token, orgA)
      .post('/ppe/requirements')
      .send({
        workerId: workerWithoutPosition.id,
        ppeCatalogItemId: catalogA.id,
        positionRequirementId: positionRequirement.body.id,
        reason: 'No puede aplicar un requisito por cargo sin cargo asignado.',
      })
      .expect(400);
    const duplicateCatalog = await prisma.ppeCatalogItem.create({
      data: {
        organizationId: orgA,
        name: `EPP idempotencia ${suffix}`,
        category: 'HEAD',
        createdById: owner.userId,
      },
    });
    const duplicatePositionRequirement = () =>
      api(owner.token, orgA).post('/ppe/position-requirements').send({
        positionId: positionA.body.id,
        ppeCatalogItemId: duplicateCatalog.id,
        reason: 'Selección repetida sin scopes opcionales.',
        decision: 'SELECTED_BY_PROFESSIONAL',
      });
    const duplicateResponses = await Promise.all([
      duplicatePositionRequirement(),
      duplicatePositionRequirement(),
    ]);
    expect(duplicateResponses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(
      await prisma.positionPpeRequirement.count({
        where: {
          organizationId: orgA,
          positionId: positionA.body.id,
          ppeCatalogItemId: duplicateCatalog.id,
          riskContextId: null,
          workCenterId: null,
          workAreaId: null,
          isActive: true,
        },
      }),
    ).toBe(1);
    const workerRequirement = await api(owner.token, orgA)
      .post('/ppe/requirements')
      .send({
        workerId: workerA.body.id,
        ppeCatalogItemId: catalogA.id,
        positionRequirementId: positionRequirement.body.id,
        reason: 'Aplicación del requisito vigente del cargo.',
      })
      .expect(201);

    const issued = await api(owner.token, orgA)
      .post('/ppe/issues')
      .send({
        workerId: workerA.body.id,
        ppeCatalogItemId: catalogA.id,
        requirementId: workerRequirement.body.id,
        issuedAt: '2026-09-07T13:00:00.000Z',
        evidenceNote: 'Entrega sintética registrada.',
      })
      .expect(201);
    await api(owner.token, orgA)
      .post(`/ppe/issues/${issued.body.id}/acknowledge`)
      .send({ expectedVersion: 1, note: 'Recepción sintética confirmada.' })
      .expect(201);
    await api(owner.token, orgA)
      .post(`/ppe/issues/${issued.body.id}/inspect`)
      .send({
        expectedVersion: 2,
        inspectedAt: '2026-09-07T13:30:00.000Z',
        condition: 'UNSERVICEABLE',
        note: 'Daño material observado.',
      })
      .expect(201);

    const incident = await api(owner.token, orgA)
      .post('/incidents')
      .send({
        workCenterId: centerA.id,
        workAreaId: areaA.id,
        occurredAt: '2026-09-07T14:00:00.000Z',
        title: 'Daño observado en EPP',
        description: 'Se identificó daño material sin registrar diagnóstico personal.',
        eventType: 'NEAR_MISS',
        eventLocation: 'OWN_FACILITY',
        attentionPriority: 'HIGH',
      })
      .expect(201);
    const incidentCountBeforeReplacement = await prisma.incident.count({
      where: { organizationId: orgA },
    });
    await api(owner.token, orgA)
      .post(`/incidents/${incident.body.id}/workers`)
      .send({ workerId: workerA.body.id, involvement: 'Persona vinculada explícitamente.' })
      .expect(201);
    await api(owner.token, orgA)
      .post(`/ppe/issues/${issued.body.id}/replace`)
      .send({
        expectedVersion: 3,
        issuedAt: '2026-09-07T16:00:00.000Z',
        evidenceNote: 'Reemplazo sintético entregado.',
        reason: 'DAMAGE',
        reasonNote: 'Daño revisado por profesional.',
        linkedIncidentId: incident.body.id,
      })
      .expect(201);
    expect(await prisma.incident.count({ where: { organizationId: orgA } })).toBe(
      incidentCountBeforeReplacement,
    );
    const issueHistory = await prisma.ppeIssue.findMany({
      where: { organizationId: orgA, workerId: workerA.body.id },
      orderBy: { issuedAt: 'asc' },
    });
    expect(issueHistory).toHaveLength(2);
    expect(issueHistory[0]).toMatchObject({ id: issued.body.id, status: 'REPLACED' });
    expect(issueHistory[1]).toMatchObject({
      replacesIssueId: issued.body.id,
      replacementReason: 'DAMAGE',
    });
    expect(
      await prisma.incidentPpeIssue.count({
        where: { incidentId: incident.body.id, ppeIssueId: issueHistory[0]!.id },
      }),
    ).toBe(1);
    expect(
      await prisma.incidentPpeIssue.count({
        where: { incidentId: incident.body.id, ppeIssueId: issueHistory[1]!.id },
      }),
    ).toBe(0);
    const uninvolvedIssue = await prisma.ppeIssue.create({
      data: {
        organizationId: orgA,
        workerId: workerWithoutPosition.id,
        ppeCatalogItemId: catalogA.id,
        issuedAt: new Date(),
        issuedById: owner.userId,
      },
    });
    await api(owner.token, orgA)
      .post(`/incidents/${incident.body.id}/ppe-issues`)
      .send({ ppeIssueId: uninvolvedIssue.id })
      .expect(400);
    const foreignIssue = await prisma.ppeIssue.create({
      data: {
        organizationId: orgB,
        workerId: workerB.id,
        ppeCatalogItemId: catalogB.id,
        issuedAt: new Date(),
        issuedById: owner.userId,
      },
    });
    await api(owner.token, orgA)
      .post(`/incidents/${incident.body.id}/ppe-issues`)
      .send({ ppeIssueId: foreignIssue.id })
      .expect(400);

    await api(owner.token, orgA)
      .post('/safety-observations')
      .send({
        title: 'Centro ajeno',
        description: 'No debe poder registrarse en otra organización.',
        category: 'UNSAFE_CONDITION',
        workCenterId: centerB.id,
        observedAt: '2026-09-07T15:00:00.000Z',
        priority: 'MEDIUM',
      })
      .expect(400);
    const incidentCountBeforeObservation = await prisma.incident.count({
      where: { organizationId: orgA },
    });
    const findingCountBeforeObservation = await prisma.inspectionFinding.count({
      where: { organizationId: orgA },
    });
    const observation = await api(owner.token, orgA)
      .post('/safety-observations')
      .send({
        title: 'Cable fuera de canaleta',
        description: 'Condición preventiva identificada durante recorrido.',
        category: 'UNSAFE_CONDITION',
        workCenterId: centerA.id,
        workAreaId: areaA.id,
        observedAt: '2026-09-07T15:00:00.000Z',
        priority: 'HIGH',
      })
      .expect(201);
    expect(observation.body).toMatchObject({ status: 'OPEN', version: 1 });
    await api(viewer.token, orgA).get('/safety-observations').expect(200);
    await api(viewer.token, orgA)
      .post('/safety-observations')
      .send({
        title: 'No autorizada',
        description: 'Un viewer no puede registrar.',
        category: 'OTHER',
        workCenterId: centerA.id,
        observedAt: '2026-09-07T15:30:00.000Z',
        priority: 'LOW',
      })
      .expect(403);
    await api(technician.token, orgA)
      .post(`/safety-observations/${observation.body.id}/transition`)
      .send({ status: 'UNDER_REVIEW', expectedVersion: 1 })
      .expect(403);
    expect(await prisma.incident.count({ where: { organizationId: orgA } })).toBe(
      incidentCountBeforeObservation,
    );
    expect(await prisma.inspectionFinding.count({ where: { organizationId: orgA } })).toBe(
      findingCountBeforeObservation,
    );
    await api(owner.token, orgA)
      .post(`/safety-observations/${observation.body.id}/evidence`)
      .send({ type: 'NOTE', note: 'Evidencia preventiva sintética.' })
      .expect(201);
    const action = await api(owner.token, orgA)
      .post('/operational-execution/obligations')
      .send({
        title: 'Corregir canaleta',
        originType: 'MANUAL',
        workCenterId: centerA.id,
        manualReference: 'SAFETY-OBSERVATION-V2',
        priority: 'HIGH',
      })
      .expect(201);
    await api(owner.token, orgA)
      .post(`/safety-observations/${observation.body.id}/actions`)
      .send({ obligationExecutionId: action.body.id })
      .expect(201);
    const observationDetail = await api(owner.token, orgA)
      .get(`/safety-observations/${observation.body.id}`)
      .expect(200);
    expect(observationDetail.body.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ note: 'Evidencia preventiva sintética.' }),
      ]),
    );
    expect(observationDetail.body.actionLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          obligationExecution: expect.objectContaining({ id: action.body.id }),
        }),
      ]),
    );
    const queue = await api(owner.token, orgA).get('/work-queue?module=INCIDENTS').expect(200);
    expect(queue.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'SAFETY_OBSERVATION_FOLLOW_UP',
          sourceId: observation.body.id,
          deepLink: `/app/safety-observations/${observation.body.id}`,
        }),
      ]),
    );
    const legacyIncident = await prisma.incident.create({
      data: {
        organizationId: orgA,
        workCenterId: centerA.id,
        occurredAt: new Date('2026-09-06T10:00:00.000Z'),
        reportedAt: new Date('2026-09-06T11:00:00.000Z'),
        reportedByUserId: owner.userId,
        title: 'Incidente histórico sin prioridad V2',
        description: 'Registro histórico conservado sin backfill de prioridad.',
        eventType: 'NEAR_MISS',
        status: 'REPORTED',
      },
    });
    const highQueue = await api(owner.token, orgA)
      .get('/work-queue?module=INCIDENTS&priority=HIGH&pageSize=100')
      .expect(200);
    expect(highQueue.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'INCIDENT_INVESTIGATION',
          sourceId: legacyIncident.id,
          priority: 'HIGH',
        }),
      ]),
    );
    const mediumQueue = await api(owner.token, orgA)
      .get('/work-queue?module=INCIDENTS&priority=MEDIUM&pageSize=100')
      .expect(200);
    expect(mediumQueue.body.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ sourceId: legacyIncident.id })]),
    );
    const datedQueue = await api(owner.token, orgA)
      .get('/work-queue?module=INCIDENTS&dueFrom=2026-01-01&dueTo=2026-12-31&pageSize=100')
      .expect(200);
    expect(datedQueue.body.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ sourceId: observation.body.id })]),
    );
    const transitions = await Promise.all([
      api(owner.token, orgA)
        .post(`/safety-observations/${observation.body.id}/transition`)
        .send({ status: 'UNDER_REVIEW', expectedVersion: 1 }),
      api(owner.token, orgA)
        .post(`/safety-observations/${observation.body.id}/transition`)
        .send({ status: 'ACTION_REQUIRED', expectedVersion: 1 }),
    ]);
    expect(transitions.map(({ status }) => status).sort()).toEqual([201, 409]);

    const definition = await prisma.trainingDefinition.create({
      data: {
        organizationId: orgA,
        title: `Uso y revisión de EPP ${suffix}`,
        category: 'Seguridad operativa',
        deliveryClassification: 'INTERNAL',
        createdById: owner.userId,
      },
    });
    const operationalPlan = await api(owner.token, orgA)
      .post('/operational-plans')
      .send({
        name: `Plan de capacitación ${suffix}`,
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        items: [
          {
            title: 'Ejecutar formación preventiva',
            priority: 'HIGH',
            workCenterId: centerA.id,
            evidenceReferences: [],
            provenanceType: 'MANUAL',
            provenanceSnapshot: {},
          },
        ],
      })
      .expect(201);
    const planItemId = operationalPlan.body.versions[0].items[0].id as string;
    await api(owner.token, orgA)
      .post('/training/needs')
      .send({
        trainingDefinitionId: definition.id,
        sourceType: 'MANUAL',
        linkedIncidentId: incident.body.id,
        reason: 'Payload contradictorio manual con fuente oculta.',
      })
      .expect(400);
    await api(owner.token, orgA)
      .post('/training/needs')
      .send({
        trainingDefinitionId: definition.id,
        sourceType: 'INCIDENT',
        linkedIncidentId: incident.body.id,
        linkedFindingId: '00000000-0000-4000-8000-000000000001',
        reason: 'Payload contradictorio con dos fuentes canónicas.',
      })
      .expect(400);
    await api(owner.token, orgA)
      .post('/training/needs')
      .send({
        trainingDefinitionId: definition.id,
        sourceType: 'PLAN',
        linkedPlanItemId: planItemId,
        linkedAssessmentId: '00000000-0000-4000-8000-000000000001',
        reason: 'Payload contradictorio con plan y evaluación.',
      })
      .expect(400);
    const need = await api(owner.token, orgA)
      .post('/training/needs')
      .send({
        trainingDefinitionId: definition.id,
        sourceType: 'PLAN',
        linkedPlanItemId: planItemId,
        reason: 'Ejecutar la formación preventiva definida en el Plan Operativo.',
      })
      .expect(201);
    await api(owner.token, orgA)
      .post(`/training/needs/${need.body.id}/audiences`)
      .send({ type: 'WORKER', workerId: workerB.id })
      .expect(400);
    await api(owner.token, orgA)
      .post(`/training/needs/${need.body.id}/audiences`)
      .send({ type: 'WORKER', workerId: workerA.body.id })
      .expect(201);
    await api(owner.token, orgA)
      .post(`/training/needs/${need.body.id}/audiences`)
      .send({ type: 'POSITION', positionId: positionA.body.id })
      .expect(201);
    const session = await api(owner.token, orgA)
      .post('/training/sessions')
      .send({
        trainingDefinitionId: definition.id,
        trainingNeedId: need.body.id,
        workCenterId: centerA.id,
        workAreaId: areaA.id,
        responsibleUserId: owner.userId,
        scheduledStart: '2026-09-08T14:00:00.000Z',
        scheduledEnd: '2026-09-08T16:00:00.000Z',
        mode: 'IN_PERSON',
        instructorName: 'Facilitador sintético',
        location: 'Aula sintética',
      })
      .expect(201);
    await api(owner.token, orgA)
      .post(`/training/sessions/${session.body.id}/participants`)
      .send({ workerId: workerB.id })
      .expect(400);
    await api(owner.token, orgA)
      .post(`/training/sessions/${session.body.id}/participants`)
      .send({ workerId: workerA.body.id })
      .expect(201);
    const plan = await api(owner.token, orgA).get('/training/plan').expect(200);
    expect(plan.body.printNotice).toContain('firma manuscrita');
    expect(plan.body.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: session.body.id,
          _count: { participants: 1, completions: 0 },
          trainingNeed: expect.objectContaining({
            id: need.body.id,
            sourceType: 'PLAN',
          }),
        }),
      ]),
    );
    const candidateRequirement = await prisma.regulatoryRequirement.create({
      data: {
        requirementKey: `CANDIDATE_TRAINING_${suffix.replaceAll(/[^A-Za-z0-9]/g, '_').toUpperCase()}`,
        title: 'Candidato editorial',
        description: 'No aprobado.',
        editorialStatus: 'DRAFT',
      },
    });
    await api(owner.token, orgA)
      .post('/training/needs')
      .send({
        trainingDefinitionId: definition.id,
        sourceType: 'APPROVED_REQUIREMENT',
        linkedRegulatoryRequirementId: candidateRequirement.id,
        reason: 'No debe presentarse como obligación publicada.',
      })
      .expect(400);
  });
});
