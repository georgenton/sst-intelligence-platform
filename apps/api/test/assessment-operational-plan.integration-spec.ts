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
});
