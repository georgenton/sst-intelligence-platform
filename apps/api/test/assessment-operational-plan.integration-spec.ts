import { randomUUID, createHash } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuditService } from '../src/audit/audit.service';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const source = {
  engineVersion: '1.2.0',
  inputHash: `sha256:${'a'.repeat(64)}`,
  outputHash: `sha256:${'b'.repeat(64)}`,
  missingInformation: [],
  recommendations: ['WORKFORCE', 'INSPECTIONS', 'GOVERNANCE'].map((capabilityKey, index) => ({
    capabilityKey,
    title: ['Personas y puestos', 'Inspecciones inteligentes', 'Gobernanza SST'][index],
    description: 'Revisar y organizar este trabajo.',
    reasons: ['Información confirmada por la organización.'],
    priority: index === 1 ? 'HIGH' : 'MEDIUM',
    humanDecision: 'PENDING',
    recommendationState: 'PROPOSED',
    activationEffect: 'NONE',
    score: 45,
    ruleKeys: ['PRIVATE_ENGINE_RULE'],
    matchedFacts: [],
    pendingInformation: [],
  })),
};
const input = {
  name: 'Plan del diagnóstico',
  periodStart: '2026-09-01',
  periodEnd: '2026-12-31',
  selectedCapabilityKeys: ['INSPECTIONS', 'GOVERNANCE'],
};

describe('assessment to existing Operational Plan', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => app.close());
  afterEach(() => jest.restoreAllMocks());
  async function user() {
    const actor = await prisma.user.create({
      data: {
        email: `plan-${randomUUID()}@example.test`,
        displayName: 'Plan owner',
        passwordHash: 'integration-fixture-not-for-login',
      },
    });
    return {
      id: actor.id,
      token: await app
        .get(JwtService)
        .signAsync({ id: actor.id, email: actor.email, sub: actor.id }),
    };
  }
  async function fixture() {
    const actor = await user();
    const r = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        name: 'Plan handoff fixture',
        country: 'Ecuador',
        sector: 'Servicios administrativos',
      })
      .expect(201);
    const organizationId = r.body.id as string;
    const assessment = await prisma.sstAssessmentSession.create({
      data: {
        organizationId,
        createdById: actor.id,
        channel: 'AUTHENTICATED',
        status: 'FINALIZED',
        schemaVersion: '1.0.0',
        catalogVersion: '1.0.0',
        scopes: [],
        facts: [],
        latestResult: { capabilityEvaluation: source },
        finalizedAt: new Date(),
        finalSnapshot: { facts: [], scopes: [] },
      },
    });
    return { ...actor, organizationId, assessment };
  }
  function api(actor: { token: string; organizationId: string }) {
    const headers = (r: request.Test) =>
      r
        .set('Authorization', `Bearer ${actor.token}`)
        .set('x-organization-id', actor.organizationId);
    return {
      post: (path: string) => headers(request(app.getHttpServer()).post(`/api/v1${path}`)),
      get: (path: string) => headers(request(app.getHttpServer()).get(`/api/v1${path}`)),
    };
  }
  function create(f: Awaited<ReturnType<typeof fixture>>, key?: string, body = input) {
    const r = api(f).post(`/operational-plans/from-assessment/${f.assessment.id}`);
    if (key) r.set('Idempotency-Key', key);
    return r.send(body);
  }
  async function baseline(organizationId: string) {
    return {
      organization: await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          status: true,
          demoStartedAt: true,
          demoExpiresAt: true,
          subscriptions: true,
          modules: true,
        },
      }),
      features: await prisma.planFeature.findMany({ orderBy: { id: 'asc' } }),
      requirements: await prisma.regulatoryRequirement.count(),
      drafts: await prisma.adaptiveRuleDraft.count(),
      realRules: await prisma.adaptiveRuleVersion.count({
        where: { regulatory: true, isDemo: false, publishedAt: { not: null } },
      }),
      guidance: await prisma.riskMethodExpertGuidanceVersion.findMany({
        select: { id: true, reviewStatus: true, publicationStatus: true },
        orderBy: { id: 'asc' },
      }),
    };
  }
  it('creates exactly the selected workstreams as DRAFT from stored output with no assessment, module, subscription or regulatory changes', async () => {
    const f = await fixture();
    const before = await baseline(f.organizationId);
    const original = await prisma.sstAssessmentSession.findUnique({
      where: { id: f.assessment.id },
    });
    const r = await create(f, randomUUID()).expect(201);
    expect(r.body.versions).toHaveLength(1);
    expect(r.body.versions[0]).toMatchObject({
      version: 1,
      status: 'DRAFT',
      origin: 'DETERMINISTIC_DRAFT',
      provenance: {
        assessmentSessionId: f.assessment.id,
        createdFrom: 'SST_ASSESSMENT',
        capabilityEngineVersion: '1.2.0',
        capabilityEvaluationOutputHash: source.outputHash,
        selectedCapabilityKeys: ['GOVERNANCE', 'INSPECTIONS'],
        excludedCapabilityKeys: ['WORKFORCE'],
      },
    });
    expect(
      r.body.versions[0].items
        .map(
          (i: { provenanceSnapshot: { capabilityKey: string } }) =>
            i.provenanceSnapshot.capabilityKey,
        )
        .sort(),
    ).toEqual(['GOVERNANCE', 'INSPECTIONS']);
    expect(
      await prisma.operationalPlan.count({ where: { organizationId: f.organizationId } }),
    ).toBe(1);
    expect(await baseline(f.organizationId)).toEqual(before);
    expect(
      await prisma.sstAssessmentSession.findUnique({ where: { id: f.assessment.id } }),
    ).toEqual(original);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: r.body.id, action: 'OPERATIONAL_PLAN_CREATED_FROM_ASSESSMENT' },
    });
    expect(audit.metadata).toMatchObject({
      assessmentSessionId: f.assessment.id,
      selectedCapabilityKeys: ['GOVERNANCE', 'INSPECTIONS'],
      excludedCapabilityKeys: ['WORKFORCE'],
      engineVersion: '1.2.0',
    });
    expect((await api(f).get('/work-queue?module=PLAN').expect(200)).body.items).toHaveLength(0);
  });
  it.each(['COLLECTING_INFORMATION', 'DIAGNOSIS_READY'] as const)(
    'rejects non-finalized %s',
    async (status) => {
      const f = await fixture();
      await prisma.sstAssessmentSession.update({
        where: { id: f.assessment.id },
        data: { status },
      });
      await create(f).expect(400);
      expect(
        await prisma.operationalPlan.count({ where: { organizationId: f.organizationId } }),
      ).toBe(0);
    },
  );
  it('returns a bounded historical state without recalculating or changing the diagnosis', async () => {
    const f = await fixture();
    await prisma.sstAssessmentSession.update({
      where: { id: f.assessment.id },
      data: { latestResult: { summary: { title: 'Historical diagnosis' } } },
    });
    const before = await prisma.sstAssessmentSession.findUnique({ where: { id: f.assessment.id } });
    const r = await create(f).expect(400);
    expect(r.body.code).toBe('ASSESSMENT_CAPABILITY_EVALUATION_UNAVAILABLE');
    expect(
      await prisma.sstAssessmentSession.findUnique({ where: { id: f.assessment.id } }),
    ).toEqual(before);
  });
  it('keeps historical engine versions readable', async () => {
    const f = await fixture();
    await prisma.sstAssessmentSession.update({
      where: { id: f.assessment.id },
      data: { latestResult: { capabilityEvaluation: { ...source, engineVersion: '1.1.0' } } },
    });
    const r = await create(f).expect(201);
    expect(r.body.versions[0].provenance.capabilityEngineVersion).toBe('1.1.0');
  });
  it('accepts a tenant-bound claimed PUBLIC diagnosis while preserving its historical origin', async () => {
    const f = await fixture();
    await prisma.sstAssessmentSession.update({
      where: { id: f.assessment.id },
      data: { channel: 'PUBLIC', claimedById: f.id, claimedAt: new Date() },
    });
    const before = await prisma.sstAssessmentSession.findUniqueOrThrow({
      where: { id: f.assessment.id },
    });
    await create(f, randomUUID()).expect(201);
    expect(
      await prisma.sstAssessmentSession.findUniqueOrThrow({ where: { id: f.assessment.id } }),
    ).toEqual(before);
  });
  it('enforces tenant, authenticated channel, writer role and active references', async () => {
    const a = await fixture();
    const b = await fixture();
    await api(b)
      .post(`/operational-plans/from-assessment/${a.assessment.id}`)
      .send(input)
      .expect(404);
    const viewer = await user();
    await prisma.membership.create({
      data: { organizationId: a.organizationId, userId: viewer.id, role: 'VIEWER' },
    });
    await api({ ...viewer, organizationId: a.organizationId })
      .post(`/operational-plans/from-assessment/${a.assessment.id}`)
      .send(input)
      .expect(403);
    await create(a, undefined, { ...input, responsibleUserId: b.id } as typeof input).expect(400);
    await prisma.sstAssessmentSession.update({
      where: { id: a.assessment.id },
      data: { channel: 'PUBLIC' },
    });
    await create(a).expect(404);
  });
  it.each([[], ['PPE'], ['INSPECTIONS', 'INSPECTIONS'], ['UNKNOWN']].map((keys) => [keys]))(
    'rejects invalid subset %j',
    async (selectedCapabilityKeys) => {
      const f = await fixture();
      await create(f, undefined, { ...input, selectedCapabilityKeys }).expect(400);
      expect(
        await prisma.operationalPlan.count({ where: { organizationId: f.organizationId } }),
      ).toBe(0);
    },
  );
  it('replays lost responses and parallel submissions once; changed payload conflicts, another actor is independent', async () => {
    const f = await fixture();
    const key = randomUUID();
    const results = await Promise.all([
      create(f, key).expect(201),
      create(f, key).expect(201),
      create(f, key).expect(201),
    ]);
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    await create(f, key, { ...input, selectedCapabilityKeys: ['INSPECTIONS'] }).expect(409);
    expect(
      await prisma.operationalPlan.count({ where: { organizationId: f.organizationId } }),
    ).toBe(1);
    expect(
      await prisma.operationalPlanVersion.count({ where: { organizationId: f.organizationId } }),
    ).toBe(1);
    expect(
      await prisma.operationalPlanItem.count({ where: { organizationId: f.organizationId } }),
    ).toBe(2);
    expect(
      await prisma.operationalPlanItemExecution.count({
        where: { organizationId: f.organizationId },
      }),
    ).toBe(2);
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: f.organizationId,
          action: 'OPERATIONAL_PLAN_CREATED_FROM_ASSESSMENT',
        },
      }),
    ).toBe(1);
    const receipt = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId: f.organizationId,
        action: 'OPERATIONAL_PLAN_CREATED_FROM_ASSESSMENT',
      },
    });
    expect(JSON.stringify(receipt.metadata)).not.toContain(key);
    expect((receipt.metadata as Prisma.JsonObject).idempotencyKeyHash).toBe(
      createHash('sha256').update(`${f.organizationId}:${f.id}:${key}`).digest('hex'),
    );
    const other = await user();
    await prisma.membership.create({
      data: { organizationId: f.organizationId, userId: other.id, role: 'SST_MANAGER' },
    });
    const r = await api({ ...other, organizationId: f.organizationId })
      .post(`/operational-plans/from-assessment/${f.assessment.id}`)
      .set('Idempotency-Key', key)
      .send(input)
      .expect(201);
    expect(r.body.id).not.toBe(results[0].body.id);
    await create(f, 'bad-key').expect(400);
  });
  it('rolls back all new rows when mandatory draft audit fails and allows safe retry', async () => {
    const f = await fixture();
    const key = randomUUID();
    const audit = app.get(AuditService);
    const spy = jest
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('private audit failure'));
    try {
      const r = await create(f, key).expect(503);
      expect(JSON.stringify(r.body)).not.toContain('private');
      for (const count of [
        prisma.operationalPlan.count({ where: { organizationId: f.organizationId } }),
        prisma.operationalPlanVersion.count({ where: { organizationId: f.organizationId } }),
        prisma.operationalPlanItem.count({ where: { organizationId: f.organizationId } }),
        prisma.operationalPlanItemExecution.count({ where: { organizationId: f.organizationId } }),
      ])
        expect(await count).toBe(0);
    } finally {
      spy.mockRestore();
    }
    await create(f, key).expect(201);
  });
  it('loads neutral context with FREE inspections=false and excludes inactive members/centers', async () => {
    const f = await fixture();
    const inactive = await user();
    await prisma.membership.create({
      data: {
        organizationId: f.organizationId,
        userId: inactive.id,
        role: 'VIEWER',
        status: 'SUSPENDED',
      },
    });
    await prisma.workCenter.create({
      data: { organizationId: f.organizationId, name: 'Archived center', isActive: false },
    });
    const entitlements = await api(f).get('/entitlements').expect(200);
    expect(entitlements.body.features['module.inspections']).toBe(false);
    const context = await api(f).get('/operational-plans/context').expect(200);
    expect(context.body.members).toEqual([
      { id: f.id, displayName: 'Plan owner', role: 'ORG_OWNER' },
    ]);
    expect(context.body.workCenters).toHaveLength(1);
    expect(context.body.members[0]).not.toHaveProperty('email');
  });
  it('rejects invalid metadata and browser-supplied source content without creating a plan', async () => {
    const f = await fixture();
    await create(f, undefined, { ...input, periodEnd: '2026-08-31' }).expect(400);
    await api(f)
      .post(`/operational-plans/from-assessment/${f.assessment.id}`)
      .send({ ...input, items: [{ title: 'Untrusted title' }] })
      .expect(400);
    expect(
      await prisma.operationalPlan.count({ where: { organizationId: f.organizationId } }),
    ).toBe(0);
  });
  it('allows technicians to create drafts while reserving activation for existing approver roles', async () => {
    const f = await fixture();
    const technician = await user();
    await prisma.membership.create({
      data: {
        organizationId: f.organizationId,
        userId: technician.id,
        role: 'SST_TECHNICIAN',
        status: 'ACTIVE',
      },
    });
    const actor = { ...technician, organizationId: f.organizationId };
    const draft = await api(actor)
      .post(`/operational-plans/from-assessment/${f.assessment.id}`)
      .send(input)
      .expect(201);
    await api(actor)
      .post(`/operational-plans/${draft.body.id}/versions/${draft.body.versions[0].id}/activate`)
      .expect(403);
    expect(
      (
        await prisma.operationalPlanVersion.findUniqueOrThrow({
          where: { id: draft.body.versions[0].id },
        })
      ).status,
    ).toBe('DRAFT');
  });
  it.each(['manual', 'generated'])(
    'rolls back existing %s creation when its audit fails',
    async (mode) => {
      const f = await fixture();
      if (mode === 'generated')
        await api(f)
          .post('/operational-execution/obligations')
          .send({
            title: 'Known work to plan',
            originType: 'MANUAL',
            manualReference: 'INTEGRATION-PR51',
            priority: 'MEDIUM',
          })
          .expect(201);
      const spy = jest
        .spyOn(app.get(AuditService), 'record')
        .mockRejectedValueOnce(new Error('audit failure'));
      try {
        await api(f)
          .post(mode === 'manual' ? '/operational-plans' : '/operational-plans/generate-draft')
          .send({
            name: input.name,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            ...(mode === 'manual'
              ? { items: [{ title: 'Human-entered work', provenanceType: 'MANUAL' }] }
              : {}),
          })
          .expect(500);
        expect(
          await prisma.operationalPlan.count({ where: { organizationId: f.organizationId } }),
        ).toBe(0);
        expect(
          await prisma.operationalPlanVersion.count({
            where: { organizationId: f.organizationId },
          }),
        ).toBe(0);
        expect(
          await prisma.operationalPlanItem.count({ where: { organizationId: f.organizationId } }),
        ).toBe(0);
        expect(
          await prisma.operationalPlanItemExecution.count({
            where: { organizationId: f.organizationId },
          }),
        ).toBe(0);
      } finally {
        spy.mockRestore();
      }
    },
  );
  it('keeps version, activation and execution mutations atomic with their audit', async () => {
    const f = await fixture();
    const r = await create(f).expect(201);
    const version = r.body.versions[0];
    const body = {
      name: 'Reviewed plan',
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      provenance: version.provenance,
      items: version.items.map(
        (i: {
          title: string;
          description: string;
          priority: string;
          provenanceType: string;
          provenanceReference: string;
          provenanceSnapshot: Prisma.JsonObject;
          evidenceReferences: string[];
        }) => ({
          title: i.title,
          description: i.description,
          priority: i.priority,
          provenanceType: i.provenanceType,
          provenanceReference: i.provenanceReference,
          provenanceSnapshot: i.provenanceSnapshot,
          evidenceReferences: i.evidenceReferences,
        }),
      ),
    };
    const audit = app.get(AuditService);
    let spy = jest.spyOn(audit, 'record').mockRejectedValueOnce(new Error('audit failure'));
    await api(f).post(`/operational-plans/${r.body.id}/versions`).send(body).expect(500);
    spy.mockRestore();
    expect(await prisma.operationalPlanVersion.count({ where: { planId: r.body.id } })).toBe(1);
    spy = jest.spyOn(audit, 'record').mockRejectedValueOnce(new Error('audit failure'));
    await api(f)
      .post(`/operational-plans/${r.body.id}/versions/${version.id}/activate`)
      .expect(500);
    spy.mockRestore();
    expect(
      (await prisma.operationalPlanVersion.findUniqueOrThrow({ where: { id: version.id } })).status,
    ).toBe('DRAFT');
    await api(f)
      .post(`/operational-plans/${r.body.id}/versions/${version.id}/activate`)
      .expect(201);
    spy = jest.spyOn(audit, 'record').mockRejectedValueOnce(new Error('audit failure'));
    await api(f)
      .post(`/operational-plans/items/${version.items[0].id}/transition`)
      .send({ status: 'IN_PROGRESS', expectedVersion: 1 })
      .expect(500);
    spy.mockRestore();
    expect(
      (
        await prisma.operationalPlanItemExecution.findUniqueOrThrow({
          where: { planItemId: version.items[0].id },
        })
      ).status,
    ).toBe('PLANNED');
  });
  async function activeFixture() {
    const f = await fixture();
    const center = await prisma.workCenter.findFirstOrThrow({
      where: { organizationId: f.organizationId },
    });
    const manual = {
      name: 'Plan vigente con estados mixtos',
      description: 'Descripción original vigente',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      responsibleUserId: f.id,
      provenance: { original: true },
      items: [
        'Completada original',
        'En curso original',
        'Planificada original',
        'Cancelada original',
      ].map((title, index) => ({
        title,
        description: `Contenido original ${index}`,
        startsAt: '2026-02-01',
        dueAt: '2026-09-01',
        frequency: 'Mensual',
        priority: index === 0 ? 'URGENT' : 'MEDIUM',
        workCenterId: center.id,
        responsibleUserId: f.id,
        evidenceReferences: [`evidencia:${index}`],
        provenanceType: 'MANUAL',
        provenanceReference: `human:${index}`,
        provenanceSnapshot: { originalIndex: index },
      })),
    };
    const plan = (await api(f).post('/operational-plans').send(manual).expect(201)).body;
    const reviewed = (
      await api(f).post(`/operational-plans/${plan.id}/versions`).send(manual).expect(201)
    ).body;
    const v2 = reviewed.versions[0];
    await api(f).post(`/operational-plans/${plan.id}/versions/${v2.id}/activate`).expect(201);
    for (const index of [0, 1])
      await api(f)
        .post(`/operational-plans/items/${v2.items[index].id}/transition`)
        .send({ status: 'IN_PROGRESS', expectedVersion: 1 })
        .expect(201);
    await api(f)
      .post(`/operational-plans/items/${v2.items[0].id}/transition`)
      .send({ status: 'COMPLETED', expectedVersion: 2 })
      .expect(201);
    await api(f)
      .post(`/operational-plans/items/${v2.items[3].id}/transition`)
      .send({ status: 'CANCELED', expectedVersion: 1 })
      .expect(201);
    const persisted = (await api(f).get(`/operational-plans/${plan.id}`).expect(200)).body;
    return { ...f, planId: plan.id as string, active: persisted.versions[0] };
  }
  function incorporate(
    f: Awaited<ReturnType<typeof activeFixture>>,
    key = randomUUID(),
    body: Record<string, unknown> = { selectedCapabilityKeys: ['GOVERNANCE', 'INSPECTIONS'] },
    planId = f.planId,
  ) {
    return api(f)
      .post(`/operational-plans/${planId}/from-assessment/${f.assessment.id}`)
      .set('Idempotency-Key', key)
      .send(body);
  }
  const incorporationAction = 'OPERATIONAL_PLAN_VERSION_CREATED_FROM_ASSESSMENT';
  it('server-authoritatively copies all four operational states, content, dates, assignments, evidence and provenance, appending only the subset', async () => {
    const f = await activeFixture();
    const before = await baseline(f.organizationId);
    const r = await incorporate(f).expect(201);
    const v3 = r.body.versions[0];
    expect(r.body.id).toBe(f.planId);
    expect(v3.version).toBe(3);
    expect(v3.status).toBe('DRAFT');
    expect(v3.items).toHaveLength(6);
    expect(v3.name).toBe(f.active.name);
    expect(v3.description).toBe(f.active.description);
    expect(v3.responsibleUserId).toBe(f.id);
    expect(r.body.versions.find((v: { id: string }) => v.id === f.active.id)).toEqual(f.active);
    for (const [index, inherited] of v3.items.slice(0, 4).entries()) {
      const original = f.active.items[index];
      for (const field of [
        'title',
        'description',
        'startsAt',
        'dueAt',
        'frequency',
        'priority',
        'workCenterId',
        'responsibleUserId',
        'evidenceReferences',
        'provenanceType',
        'provenanceReference',
        'displayOrder',
      ])
        expect(inherited[field]).toEqual(original[field]);
      expect(inherited.provenanceSnapshot).toEqual({
        ...original.provenanceSnapshot,
        inheritedFromPlanId: f.planId,
        inheritedFromVersionId: f.active.id,
        inheritedFromItemId: original.id,
      });
      expect(inherited.id).not.toBe(original.id);
      expect(inherited.execution.id).not.toBe(original.execution.id);
      expect(inherited.execution.planItemId).toBe(inherited.id);
      expect(inherited.execution).toMatchObject({
        status: original.execution.status,
        startedAt: original.execution.startedAt,
        completedAt: original.execution.completedAt,
        version: 1,
      });
    }
    for (const proposal of v3.items.slice(4)) {
      expect(proposal.execution.status).toBe('PLANNED');
      expect(proposal.provenanceType).toBe('UNIFIED_SST_EVALUATION');
      expect(proposal.dueAt).toBeNull();
      expect(proposal.responsibleUserId).toBeNull();
    }
    expect(v3.provenance.selectedCapabilityKeys).toEqual(['GOVERNANCE', 'INSPECTIONS']);
    expect(v3.provenance.excludedCapabilityKeys).toEqual(['WORKFORCE']);
    expect(await baseline(f.organizationId)).toEqual(before);
    expect(
      await prisma.sstAssessmentSession.findUnique({ where: { id: f.assessment.id } }),
    ).toEqual(f.assessment);
    expect(
      await prisma.auditLog.count({
        where: { organizationId: f.organizationId, action: incorporationAction },
      }),
    ).toBe(1);
  });
  it('detects the active version even when a later draft exists', async () => {
    const f = await activeFixture();
    await incorporate(f).expect(201);
    const context = (await api(f).get('/operational-plans/context').expect(200)).body;
    expect(context.activePlan).toMatchObject({
      planId: f.planId,
      versionId: f.active.id,
      version: 2,
      nextVersion: 4,
      itemCount: 4,
    });
    const r = await incorporate(f).expect(201);
    expect(r.body.versions[0].version).toBe(4);
    expect(r.body.versions[0].items).toHaveLength(6);
  });
  it('replays sequential, reordered and concurrent retries with one version and one atomic receipt', async () => {
    const f = await activeFixture();
    const key = randomUUID();
    const [a, b] = await Promise.all([
      incorporate(f, key),
      incorporate(f, key, { selectedCapabilityKeys: ['INSPECTIONS', 'GOVERNANCE'] }),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.assessmentHandoffVersionId).toBe(b.body.assessmentHandoffVersionId);
    const retry = await incorporate(f, key).expect(201);
    expect(retry.body.assessmentHandoffVersionId).toBe(a.body.assessmentHandoffVersionId);
    expect(await prisma.operationalPlanVersion.count({ where: { planId: f.planId } })).toBe(3);
    expect(
      await prisma.operationalPlan.count({ where: { organizationId: f.organizationId } }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { organizationId: f.organizationId, action: incorporationAction },
      }),
    ).toBe(1);
    await incorporate(f, key, { selectedCapabilityKeys: ['GOVERNANCE'] }).expect(409);
    await incorporate(
      f,
      key,
      { selectedCapabilityKeys: ['GOVERNANCE', 'INSPECTIONS'] },
      randomUUID(),
    ).expect(409);
  });
  it('namespaces the same retry UUID by actor', async () => {
    const f = await activeFixture();
    const other = await user();
    await prisma.membership.create({
      data: { organizationId: f.organizationId, userId: other.id, role: 'SST_TECHNICIAN' },
    });
    const key = randomUUID();
    const a = await incorporate(f, key).expect(201);
    const b = await api({ ...f, ...other })
      .post(`/operational-plans/${f.planId}/from-assessment/${f.assessment.id}`)
      .set('Idempotency-Key', key)
      .send({ selectedCapabilityKeys: ['INSPECTIONS', 'GOVERNANCE'] })
      .expect(201);
    expect(a.body.assessmentHandoffVersionId).not.toBe(b.body.assessmentHandoffVersionId);
    expect(b.body.versions[0].version).toBe(4);
  });
  it('rejects foreign tenants, non-finalized or unusable assessments and non-active source plans without client reconstruction', async () => {
    const f = await activeFixture();
    const other = await fixture();
    await api(other)
      .post(`/operational-plans/${f.planId}/from-assessment/${other.assessment.id}`)
      .send({ selectedCapabilityKeys: ['INSPECTIONS'] })
      .expect(404);
    await api(f)
      .post(`/operational-plans/${f.planId}/from-assessment/${other.assessment.id}`)
      .send({ selectedCapabilityKeys: ['INSPECTIONS'] })
      .expect(404);
    await incorporate(f, randomUUID(), {
      selectedCapabilityKeys: ['INSPECTIONS'],
      items: f.active.items,
    }).expect(400);
    for (const selectedCapabilityKeys of [[], ['INSPECTIONS', 'INSPECTIONS'], ['WORK_PERMITS']])
      await incorporate(f, randomUUID(), { selectedCapabilityKeys }).expect(400);
    await prisma.sstAssessmentSession.update({
      where: { id: f.assessment.id },
      data: { status: 'DIAGNOSIS_READY' },
    });
    await incorporate(f).expect(400);
    await prisma.sstAssessmentSession.update({
      where: { id: f.assessment.id },
      data: { status: 'FINALIZED', latestResult: {} },
    });
    await incorporate(f).expect(400);
    await prisma.sstAssessmentSession.update({
      where: { id: f.assessment.id },
      data: { latestResult: { capabilityEvaluation: source } },
    });
    const foreignOwner = await user();
    await incorporate(f, randomUUID(), {
      selectedCapabilityKeys: ['INSPECTIONS'],
      responsibleUserId: foreignOwner.id,
    }).expect(400);
    await prisma.operationalPlanVersion.update({
      where: { id: f.active.id },
      data: { status: 'RETIRED' },
    });
    await incorporate(f).expect(400);
    expect(await prisma.operationalPlanVersion.count({ where: { planId: f.planId } })).toBe(2);
  });
  it('rolls back every version, item, execution, provenance and receipt on mandatory audit failure', async () => {
    const f = await activeFixture();
    const before = (await api(f).get(`/operational-plans/${f.planId}`).expect(200)).body;
    const countBefore = {
      items: await prisma.operationalPlanItem.count({
        where: { organizationId: f.organizationId },
      }),
      executions: await prisma.operationalPlanItemExecution.count({
        where: { organizationId: f.organizationId },
      }),
    };
    jest
      .spyOn(app.get(AuditService), 'record')
      .mockRejectedValueOnce(new Error('synthetic audit failure'));
    const r = await incorporate(f).expect(503);
    expect(JSON.stringify(r.body)).not.toMatch(/Prisma|synthetic audit failure/);
    expect((await api(f).get(`/operational-plans/${f.planId}`).expect(200)).body).toEqual(before);
    expect(
      await prisma.operationalPlanItem.count({ where: { organizationId: f.organizationId } }),
    ).toBe(countBefore.items);
    expect(
      await prisma.operationalPlanItemExecution.count({
        where: { organizationId: f.organizationId },
      }),
    ).toBe(countBefore.executions);
    expect(
      await prisma.auditLog.count({
        where: { organizationId: f.organizationId, action: incorporationAction },
      }),
    ).toBe(0);
  });
  it('preserves inherited execution states through a human revision and explicit activation, retiring only the former active version', async () => {
    const f = await activeFixture();
    const before = await baseline(f.organizationId);
    const created = await incorporate(f).expect(201);
    const v3 = created.body.versions[0];
    const review = {
      name: v3.name,
      description: v3.description,
      periodStart: v3.periodStart.slice(0, 10),
      periodEnd: v3.periodEnd.slice(0, 10),
      responsibleUserId: f.id,
      items: v3.items.map((item: (typeof f.active.items)[number]) => ({
        sourceItemId: item.id,
        title: item.title,
        description: item.description,
        startsAt: item.startsAt?.slice(0, 10) ?? undefined,
        dueAt: item.dueAt?.slice(0, 10) ?? undefined,
        frequency: item.frequency ?? undefined,
        priority: item.priority,
        workCenterId: item.workCenterId ?? undefined,
        responsibleUserId: item.responsibleUserId ?? undefined,
        evidenceReferences: item.evidenceReferences,
        provenanceType: 'MANUAL',
        provenanceSnapshot: { clientAttempt: 'must not overwrite persisted provenance' },
      })),
    };
    const revised = await api(f)
      .post(`/operational-plans/${f.planId}/versions`)
      .send(review)
      .expect(201);
    const v4 = revised.body.versions[0];
    expect(v4.items.map((item: (typeof f.active.items)[number]) => item.execution.status)).toEqual([
      'COMPLETED',
      'IN_PROGRESS',
      'PLANNED',
      'CANCELED',
      'PLANNED',
      'PLANNED',
    ]);
    expect(
      v4.items.map((item: (typeof f.active.items)[number]) => item.provenanceSnapshot),
    ).toEqual(v3.items.map((item: (typeof f.active.items)[number]) => item.provenanceSnapshot));
    const activated = await api(f)
      .post(`/operational-plans/${f.planId}/versions/${v4.id}/activate`)
      .expect(201);
    expect(
      activated.body.versions.find((version: { id: string }) => version.id === f.active.id).status,
    ).toBe('RETIRED');
    expect(activated.body.versions[0].status).toBe('ACTIVE');
    expect(
      activated.body.versions[0].items.map(
        (item: (typeof f.active.items)[number]) => item.execution.status,
      ),
    ).toEqual(v4.items.map((item: (typeof f.active.items)[number]) => item.execution.status));
    expect(
      await prisma.operationalPlanVersion.count({
        where: { organizationId: f.organizationId, status: 'ACTIVE' },
      }),
    ).toBe(1);
    expect(await baseline(f.organizationId)).toEqual(before);
    const queue = (await api(f).get('/work-queue?module=PLAN').expect(200)).body;
    expect(JSON.stringify(queue)).not.toContain(f.active.items[1].id);
    expect(JSON.stringify(queue)).not.toContain(f.active.items[2].id);
  });
  it('rejects forged or duplicated source item identities in review instead of inheriting another execution', async () => {
    const f = await activeFixture();
    const body = {
      name: input.name,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      items: [
        {
          title: 'Actividad revisada',
          priority: 'MEDIUM',
          provenanceType: 'MANUAL',
          sourceItemId: randomUUID(),
        },
      ],
    };
    await api(f).post(`/operational-plans/${f.planId}/versions`).send(body).expect(409);
    body.items[0]!.sourceItemId = f.active.items[0].id;
    body.items.push({ ...body.items[0]! });
    await api(f).post(`/operational-plans/${f.planId}/versions`).send(body).expect(409);
  });
});
