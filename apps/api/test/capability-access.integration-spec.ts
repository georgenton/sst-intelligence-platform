import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { EntitlementService } from '../src/catalog/entitlement.service';
import { syncOrganizationBaseline } from '../src/reference-data/organization-baseline-reference-data';
import { syncSolutionEntryReferences } from '../src/reference-data/solution-entry-reference-sync';
import { PrismaService } from '../src/prisma/prisma.service';

const capabilityEvaluation = {
  engineVersion: '1.2.0',
  inputHash: `sha256:${'a'.repeat(64)}`,
  outputHash: `sha256:${'b'.repeat(64)}`,
  recommendations: [
    {
      capabilityKey: 'INSPECTIONS',
      title: 'Inspecciones inteligentes',
      description: 'Inspecciones y seguimiento.',
      priority: 'HIGH',
      reasons: ['Hallazgos confirmados.'],
    },
    {
      capabilityKey: 'PPE',
      title: 'Equipos de protección personal',
      description: 'Entrega y reemplazo.',
      priority: 'MEDIUM',
      reasons: ['Exposición confirmada.'],
    },
  ],
};

const legacySolutionAnswers = {
  country: 'Ecuador',
  sector: 'Manufactura',
  workerRange: '51_200',
  workCenters: 3,
  criticalActivities: true,
  workAtHeight: true,
  hotWork: true,
  electricity: false,
  chemicals: false,
  drivers: true,
  fireRisk: true,
  criticalAssets: true,
  contractors: true,
  managementSystem: 'SPREADSHEETS',
  inspectionFrequency: 'MONTHLY',
  manualPermits: true,
  evidenceDifficulty: true,
  overdueActions: true,
  recurringFindings: true,
  psychosocialEvaluation: true,
  multipleShifts: true,
  stressExposedRoles: false,
  organizationalCampaigns: false,
  objectives: ['COMPLIANCE', 'TRACKING'],
  urgency: 'HIGH',
  estimatedUsers: 12,
  budgetRange: 'LOW',
  rolloutPreference: 'GRADUAL',
};

describe('capability access bridge', () => {
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
    await prisma.$transaction(async (tx) => {
      await syncOrganizationBaseline(tx);
      await syncSolutionEntryReferences(tx);
    });
  });

  afterAll(async () => app.close());

  async function fixture() {
    const user = await prisma.user.create({
      data: {
        email: `capability-${randomUUID()}@example.test`,
        displayName: 'Capability owner',
        passwordHash: 'integration-fixture-not-for-login',
      },
    });
    const token = await app
      .get(JwtService)
      .signAsync({ id: user.id, email: user.email, sub: user.id });
    const organization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ name: `Bridge ${randomUUID()}`, country: 'Ecuador', sector: 'Manufactura' })
      .expect(201);
    const assessment = await prisma.sstAssessmentSession.create({
      data: {
        organizationId: organization.body.id,
        createdById: user.id,
        channel: 'AUTHENTICATED',
        status: 'FINALIZED',
        schemaVersion: '1.0.0',
        catalogVersion: '1.0.0',
        scopes: [],
        facts: [{ key: 'sector', value: 'Manufactura' }],
        latestResult: { capabilityEvaluation },
        finalSnapshot: { facts: [{ key: 'sector', value: 'Manufactura' }] },
        finalizedAt: new Date(),
      },
    });
    return { user, token, organizationId: organization.body.id as string, assessment };
  }

  function api(fixture: { token: string; organizationId: string }) {
    const headers = (operation: request.Test) =>
      operation
        .set('Authorization', `Bearer ${fixture.token}`)
        .set('x-organization-id', fixture.organizationId);
    return {
      get: (path: string) => headers(request(app.getHttpServer()).get(`/api/v1${path}`)),
      post: (path: string) => headers(request(app.getHttpServer()).post(`/api/v1${path}`)),
    };
  }

  it('reads stored recommendations, activates a human selection once, and preserves baseline data', async () => {
    const f = await fixture();
    const assessmentBefore = await prisma.sstAssessmentSession.findUniqueOrThrow({
      where: { id: f.assessment.id },
    });
    const subscriptionBefore = await prisma.subscription.findMany({
      where: { organizationId: f.organizationId },
      orderBy: { id: 'asc' },
    });

    const overview = await api(f)
      .get(`/capability-access?assessmentId=${f.assessment.id}`)
      .expect(200);
    expect(overview.body.assessment).toMatchObject({
      id: f.assessment.id,
      engineVersion: '1.2.0',
      outputHash: capabilityEvaluation.outputHash,
    });
    expect(overview.body.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capabilityKey: 'INSPECTIONS',
          recommended: true,
          currentAccess: 'LOCKED',
        }),
        expect.objectContaining({
          capabilityKey: 'PPE',
          recommended: true,
          currentAccess: 'LOCKED',
        }),
      ]),
    );

    const idempotencyKey = randomUUID();
    const selection = { assessmentId: f.assessment.id, capabilityKeys: ['INSPECTIONS'] };
    const first = await api(f)
      .post('/capability-access/demo')
      .set('Idempotency-Key', idempotencyKey)
      .send(selection)
      .expect(201);
    expect(first.body.idempotent).toBe(false);
    expect(first.body.access.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capabilityKey: 'INSPECTIONS', currentAccess: 'DEMO' }),
        expect.objectContaining({ capabilityKey: 'TECHNICAL_RISK', currentAccess: 'LOCKED' }),
        expect.objectContaining({ capabilityKey: 'PPE', currentAccess: 'LOCKED' }),
      ]),
    );

    const retry = await api(f)
      .post('/capability-access/demo')
      .set('Idempotency-Key', idempotencyKey)
      .send(selection)
      .expect(201);
    expect(retry.body.idempotent).toBe(true);

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: f.organizationId },
      select: { status: true, subscriptions: true, modules: { include: { module: true } } },
    });
    expect(organization.status).toBe('DEMO');
    expect(organization.subscriptions).toEqual(subscriptionBefore);
    expect(
      organization.modules.filter(({ module }) => module.key === 'INSPECTIONS_INTELLIGENCE'),
    ).toHaveLength(1);
    expect(organization.modules.filter(({ module }) => module.key === 'PPE')).toHaveLength(0);
    expect(
      await prisma.auditLog.count({
        where: { organizationId: f.organizationId, action: 'CAPABILITY_DEMO_ACCESS_ACTIVATED' },
      }),
    ).toBe(1);
    expect(
      await prisma.sstAssessmentSession.findUniqueOrThrow({ where: { id: f.assessment.id } }),
    ).toEqual(assessmentBefore);

    const single = await app.get(EntitlementService).effective(f.organizationId);
    const many = await app.get(EntitlementService).effectiveMany([f.organizationId]);
    expect(many.get(f.organizationId)).toEqual(single);
  });

  it('keeps partial bridge access exact and records explicit provenance', async () => {
    const f = await fixture();
    const first = await api(f)
      .post('/capability-access/demo')
      .set('Idempotency-Key', randomUUID())
      .send({ assessmentId: f.assessment.id, capabilityKeys: ['INSPECTIONS'] })
      .expect(201);

    const entitlements = await app.get(EntitlementService).effective(f.organizationId);
    const modules = await prisma.organizationModule.findMany({
      where: { organizationId: f.organizationId },
      include: { module: true },
    });
    expect(entitlements.features['module.inspections']).toBe(true);
    expect(entitlements.features['module.technical_risk']).not.toBe(true);
    expect(entitlements.features['module.work_permits']).not.toBe(true);
    expect(entitlements.features['module.incidents']).not.toBe(true);
    expect(entitlements.features['module.ppe']).not.toBe(true);
    expect(entitlements.features['module.training']).not.toBe(true);
    expect(modules.filter(({ module }) => module.key === 'WORK_PERMITS')).toHaveLength(0);

    expect(first.body.access.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capabilityKey: 'INSPECTIONS',
          recommended: true,
          currentAccess: 'DEMO',
          capabilityOrigin: 'ASSESSMENT_RECOMMENDED',
        }),
        expect.objectContaining({
          capabilityKey: 'PPE',
          recommended: true,
          currentAccess: 'LOCKED',
          capabilityOrigin: null,
        }),
        expect.objectContaining({
          capabilityKey: 'WORK_PERMITS',
          recommended: false,
          currentAccess: 'LOCKED',
          capabilityOrigin: null,
        }),
      ]),
    );

    const expiry = first.body.access.demo.expiresAt as string;
    const second = await api(f)
      .post('/capability-access/demo')
      .set('Idempotency-Key', randomUUID())
      .send({ assessmentId: f.assessment.id, capabilityKeys: ['WORK_PERMITS'] })
      .expect(201);
    expect(second.body.access.demo.expiresAt).toBe(expiry);
    expect(second.body.access.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capabilityKey: 'WORK_PERMITS',
          recommended: false,
          currentAccess: 'DEMO',
          capabilityOrigin: 'EXPLORATION_SELECTED',
        }),
        expect.objectContaining({
          capabilityKey: 'PPE',
          recommended: true,
          currentAccess: 'LOCKED',
          capabilityOrigin: null,
        }),
      ]),
    );
    const workPermit = await prisma.organizationModule.findFirstOrThrow({
      where: { organizationId: f.organizationId, module: { key: 'WORK_PERMITS' } },
      include: { module: true },
    });
    expect(workPermit).toMatchObject({
      status: 'DEMO',
      source: 'RECOMMENDATION',
      expiresAt: new Date(expiry),
      metadata: expect.objectContaining({
        accessType: 'DEMO',
        assessmentId: f.assessment.id,
        capabilityKey: 'WORK_PERMITS',
        capabilityOrigin: 'EXPLORATION_SELECTED',
        capabilityEngineVersion: '1.2.0',
        capabilityOutputHash: capabilityEvaluation.outputHash,
      }),
    });
  });

  it('rejects a retry with the same key but a different selection without changing access', async () => {
    const f = await fixture();
    const idempotencyKey = randomUUID();
    const exploration = await api(f)
      .post('/capability-access/demo')
      .set('Idempotency-Key', idempotencyKey)
      .send({ assessmentId: f.assessment.id, capabilityKeys: ['TRAINING'] })
      .expect(201);
    expect(exploration.body.access.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capabilityKey: 'TRAINING',
          recommended: false,
          capabilityOrigin: 'EXPLORATION_SELECTED',
          currentAccess: 'DEMO',
        }),
      ]),
    );
    await api(f)
      .post('/capability-access/demo')
      .set('Idempotency-Key', idempotencyKey)
      .send({ assessmentId: f.assessment.id, capabilityKeys: ['PPE'] })
      .expect(409);
    const modules = await prisma.organizationModule.findMany({
      where: { organizationId: f.organizationId },
      include: { module: true },
    });
    expect(modules.filter(({ module }) => module.key === 'TRAINING')).toHaveLength(1);
    expect(modules.filter(({ module }) => module.key === 'PPE')).toHaveLength(0);
  });

  it('does not downgrade an existing active module when a demo selection is added', async () => {
    const f = await fixture();
    const workPermits = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'WORK_PERMITS' },
    });
    await prisma.organizationModule.create({
      data: {
        organizationId: f.organizationId,
        moduleId: workPermits.id,
        status: 'ACTIVE',
        source: 'PLAN',
      },
    });
    await api(f)
      .post('/capability-access/demo')
      .set('Idempotency-Key', randomUUID())
      .send({ assessmentId: f.assessment.id, capabilityKeys: ['INSPECTIONS'] })
      .expect(201);
    await expect(app.get(EntitlementService).effective(f.organizationId)).resolves.toMatchObject({
      features: expect.objectContaining({ 'module.work_permits': true }),
    });
    await expect(
      prisma.organizationModule.findUniqueOrThrow({
        where: {
          organizationId_moduleId: { organizationId: f.organizationId, moduleId: workPermits.id },
        },
      }),
    ).resolves.toMatchObject({ status: 'ACTIVE', source: 'PLAN', metadata: null });
  });

  it('uses the transactional bridge audit marker when the selected capability is already active', async () => {
    const f = await fixture();
    const workPermits = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'WORK_PERMITS' },
    });
    await prisma.organizationModule.create({
      data: {
        organizationId: f.organizationId,
        moduleId: workPermits.id,
        status: 'ACTIVE',
        source: 'PLAN',
      },
    });

    await api(f)
      .post('/capability-access/demo')
      .set('Idempotency-Key', randomUUID())
      .send({ assessmentId: f.assessment.id, capabilityKeys: ['WORK_PERMITS'] })
      .expect(201);

    const preserved = await prisma.organizationModule.findUniqueOrThrow({
      where: {
        organizationId_moduleId: { organizationId: f.organizationId, moduleId: workPermits.id },
      },
    });
    expect(preserved).toMatchObject({ status: 'ACTIVE', source: 'PLAN', metadata: null });
    expect(preserved.expiresAt).toBeNull();
    expect(
      await prisma.auditLog.count({
        where: { organizationId: f.organizationId, action: 'CAPABILITY_DEMO_ACCESS_ACTIVATED' },
      }),
    ).toBe(1);

    const entitlements = await app.get(EntitlementService).effective(f.organizationId);
    expect(entitlements.features['module.work_permits']).toBe(true);
    expect(entitlements.features['module.incidents']).not.toBe(true);
    expect(entitlements.features['module.ppe']).not.toBe(true);
    expect(entitlements.features['module.training']).not.toBe(true);
  });

  it('uses the transactional bridge audit marker when the selected capability is already in trial', async () => {
    const f = await fixture();
    const ppe = await prisma.moduleDefinition.findUniqueOrThrow({ where: { key: 'PPE' } });
    const trialExpiry = new Date(Date.now() + 7 * 86_400_000);
    await prisma.organizationModule.create({
      data: {
        organizationId: f.organizationId,
        moduleId: ppe.id,
        status: 'TRIAL',
        source: 'TRIAL',
        startsAt: new Date(),
        expiresAt: trialExpiry,
      },
    });

    await api(f)
      .post('/capability-access/demo')
      .set('Idempotency-Key', randomUUID())
      .send({ assessmentId: f.assessment.id, capabilityKeys: ['PPE'] })
      .expect(201);

    const preserved = await prisma.organizationModule.findUniqueOrThrow({
      where: { organizationId_moduleId: { organizationId: f.organizationId, moduleId: ppe.id } },
    });
    expect(preserved).toMatchObject({ status: 'TRIAL', source: 'TRIAL', metadata: null });
    expect(preserved.expiresAt).toEqual(trialExpiry);
    const entitlements = await app.get(EntitlementService).effective(f.organizationId);
    expect(entitlements.features['module.ppe']).toBe(true);
    expect(entitlements.features['module.work_permits']).not.toBe(true);
    expect(entitlements.features['module.incidents']).not.toBe(true);
    expect(entitlements.features['module.training']).not.toBe(true);
  });

  it('keeps mixed active plus demo selection exact and preserves the active grant', async () => {
    const f = await fixture();
    const workPermits = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'WORK_PERMITS' },
    });
    await prisma.organizationModule.create({
      data: {
        organizationId: f.organizationId,
        moduleId: workPermits.id,
        status: 'ACTIVE',
        source: 'PLAN',
      },
    });

    const response = await api(f)
      .post('/capability-access/demo')
      .set('Idempotency-Key', randomUUID())
      .send({ assessmentId: f.assessment.id, capabilityKeys: ['WORK_PERMITS', 'INSPECTIONS'] })
      .expect(201);
    expect(response.body.access.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capabilityKey: 'WORK_PERMITS',
          currentAccess: 'ACTIVE',
          capabilityOrigin: null,
        }),
        expect.objectContaining({
          capabilityKey: 'INSPECTIONS',
          currentAccess: 'DEMO',
          capabilityOrigin: 'ASSESSMENT_RECOMMENDED',
        }),
      ]),
    );
    const preserved = await prisma.organizationModule.findUniqueOrThrow({
      where: {
        organizationId_moduleId: { organizationId: f.organizationId, moduleId: workPermits.id },
      },
    });
    expect(preserved).toMatchObject({ status: 'ACTIVE', source: 'PLAN', metadata: null });
    await expect(
      prisma.organizationModule.findFirstOrThrow({
        where: { organizationId: f.organizationId, module: { key: 'INSPECTIONS_INTELLIGENCE' } },
      }),
    ).resolves.toMatchObject({
      status: 'DEMO',
      source: 'RECOMMENDATION',
      metadata: expect.objectContaining({ capabilityKey: 'INSPECTIONS' }),
    });
    const entitlements = await app.get(EntitlementService).effective(f.organizationId);
    expect(entitlements.features['module.inspections']).toBe(true);
    expect(entitlements.features['module.work_permits']).toBe(true);
    expect(entitlements.features['module.incidents']).not.toBe(true);
    expect(entitlements.features['module.ppe']).not.toBe(true);
    expect(entitlements.features['module.training']).not.toBe(true);
  });

  it('serializes concurrent selections with one stable expiry and one row per capability', async () => {
    const f = await fixture();
    const [first, second] = await Promise.all([
      api(f)
        .post('/capability-access/demo')
        .set('Idempotency-Key', randomUUID())
        .send({ assessmentId: f.assessment.id, capabilityKeys: ['INSPECTIONS'] })
        .expect(201),
      api(f)
        .post('/capability-access/demo')
        .set('Idempotency-Key', randomUUID())
        .send({ assessmentId: f.assessment.id, capabilityKeys: ['PPE'] })
        .expect(201),
    ]);
    expect(first.body.access.demo.expiresAt).toBe(second.body.access.demo.expiresAt);

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: f.organizationId },
      select: { status: true, demoExpiresAt: true },
    });
    expect(organization.status).toBe('DEMO');
    expect(organization.demoExpiresAt?.toISOString()).toBe(first.body.access.demo.expiresAt);
    const modules = await prisma.organizationModule.findMany({
      where: { organizationId: f.organizationId },
      include: { module: true },
    });
    expect(
      modules.filter(
        ({ module, status }) => module.key === 'INSPECTIONS_INTELLIGENCE' && status === 'DEMO',
      ),
    ).toHaveLength(1);
    expect(
      modules.filter(({ module, status }) => module.key === 'PPE' && status === 'DEMO'),
    ).toHaveLength(1);
    expect(
      modules.filter(({ module }) =>
        ['WORK_PERMITS', 'INCIDENTS', 'TRAINING'].includes(module.key),
      ),
    ).toHaveLength(0);
    expect(
      await prisma.auditLog.count({
        where: { organizationId: f.organizationId, action: 'CAPABILITY_DEMO_ACCESS_ACTIVATED' },
      }),
    ).toBe(2);
    const lifecycle = await prisma.organization.findUniqueOrThrow({
      where: { id: f.organizationId },
      select: { demoStartedAt: true },
    });
    const bridgeAudits = await prisma.auditLog.findMany({
      where: { organizationId: f.organizationId, action: 'CAPABILITY_DEMO_ACCESS_ACTIVATED' },
      select: { metadata: true },
    });
    expect(bridgeAudits).toHaveLength(2);
    expect(
      bridgeAudits.every(
        ({ metadata }) =>
          (metadata as { demoStartedAt?: string }).demoStartedAt ===
          lifecycle.demoStartedAt?.toISOString(),
      ),
    ).toBe(true);
    const entitlements = await app.get(EntitlementService).effective(f.organizationId);
    expect(entitlements.features['module.inspections']).toBe(true);
    expect(entitlements.features['module.ppe']).toBe(true);
    expect(entitlements.features['module.work_permits']).not.toBe(true);
    expect(entitlements.features['module.incidents']).not.toBe(true);
    expect(entitlements.features['module.training']).not.toBe(true);
  }, 30_000);

  it('preserves legacy demo preview access without bridge provenance', async () => {
    const f = await fixture();
    await prisma.auditLog.create({
      data: {
        organizationId: f.organizationId,
        action: 'CAPABILITY_DEMO_ACCESS_ACTIVATED',
        entityType: 'Organization',
        entityId: f.organizationId,
        requestId: randomUUID(),
        metadata: { legacyFixture: true },
      },
    });
    await prisma.organization.update({
      where: { id: f.organizationId },
      data: {
        status: 'DEMO',
        demoStartedAt: new Date(),
        demoExpiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const entitlements = await app.get(EntitlementService).effective(f.organizationId);
    expect(entitlements.features['module.work_permits']).toBe(true);
    expect(entitlements.features['module.incidents']).toBe(true);
    expect(entitlements.features['module.ppe']).toBe(true);
    expect(entitlements.features['module.training']).toBe(true);
    expect(
      (await app.get(EntitlementService).effectiveMany([f.organizationId])).get(f.organizationId),
    ).toEqual(entitlements);
  });

  it('does not treat module metadata alone as a bridge marker', async () => {
    const f = await fixture();
    const inspections = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'INSPECTIONS_INTELLIGENCE' },
    });
    await prisma.organization.update({
      where: { id: f.organizationId },
      data: {
        status: 'DEMO',
        demoStartedAt: new Date(),
        demoExpiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await prisma.organizationModule.create({
      data: {
        organizationId: f.organizationId,
        moduleId: inspections.id,
        status: 'DEMO',
        source: 'RECOMMENDATION',
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
        metadata: {
          accessType: 'DEMO',
          assessmentId: f.assessment.id,
          capabilityKey: 'INSPECTIONS',
        },
      },
    });

    const entitlements = await app.get(EntitlementService).effective(f.organizationId);
    expect(entitlements.features['module.inspections']).toBe(true);
    expect(entitlements.features['module.work_permits']).toBe(true);
    expect(entitlements.features['module.incidents']).toBe(true);
    expect(entitlements.features['module.ppe']).toBe(true);
    expect(entitlements.features['module.training']).toBe(true);
    expect(
      await prisma.auditLog.count({
        where: { organizationId: f.organizationId, action: 'CAPABILITY_DEMO_ACCESS_ACTIVATED' },
      }),
    ).toBe(0);
  });

  it('does not let an expired bridge lifecycle suppress a later legacy demo', async () => {
    const f = await fixture();
    await api(f)
      .post('/capability-access/demo')
      .set('Idempotency-Key', randomUUID())
      .send({ assessmentId: f.assessment.id, capabilityKeys: ['INSPECTIONS'] })
      .expect(201);
    const cycleA = await prisma.organization.findUniqueOrThrow({
      where: { id: f.organizationId },
      select: { demoStartedAt: true },
    });
    const bridgeAudit = await prisma.auditLog.findFirstOrThrow({
      where: { organizationId: f.organizationId, action: 'CAPABILITY_DEMO_ACCESS_ACTIVATED' },
      orderBy: { createdAt: 'desc' },
    });
    expect((bridgeAudit.metadata as { demoStartedAt: string }).demoStartedAt).toBe(
      cycleA.demoStartedAt?.toISOString(),
    );
    await prisma.organization.update({
      where: { id: f.organizationId },
      data: { demoExpiresAt: new Date(Date.now() - 1_000) },
    });
    await prisma.organizationModule.updateMany({
      where: { organizationId: f.organizationId, status: 'DEMO' },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await new Promise((resolve) => setTimeout(resolve, 10));

    const created = await request(app.getHttpServer())
      .post('/api/v1/solution-finder/sessions')
      .expect(201);
    const sessionId = created.body.id as string;
    const sessionToken = created.body.resumeToken as string;
    await request(app.getHttpServer())
      .patch(`/api/v1/solution-finder/sessions/${sessionId}`)
      .set('x-session-token', sessionToken)
      .send({ answers: legacySolutionAnswers, currentStep: 6 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/solution-finder/sessions/${sessionId}/complete`)
      .set('x-session-token', sessionToken)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/solution-finder/sessions/${sessionId}/claim`)
      .set('Authorization', `Bearer ${f.token}`)
      .set('x-organization-id', f.organizationId)
      .set('x-session-token', sessionToken)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/solution-finder/sessions/${sessionId}/activate-demo`)
      .set('Authorization', `Bearer ${f.token}`)
      .set('x-organization-id', f.organizationId)
      .set('x-session-token', sessionToken)
      .expect(201);

    const cycleB = await prisma.organization.findUniqueOrThrow({
      where: { id: f.organizationId },
      select: { demoStartedAt: true },
    });
    expect(cycleB.demoStartedAt?.getTime()).toBeGreaterThan(cycleA.demoStartedAt!.getTime());
    const entitlements = await app.get(EntitlementService).effective(f.organizationId);
    expect(entitlements.features['module.work_permits']).toBe(true);
    expect(entitlements.features['module.incidents']).toBe(true);
    expect(entitlements.features['module.ppe']).toBe(true);
    expect(entitlements.features['module.training']).toBe(true);
    expect(
      (await app.get(EntitlementService).effectiveMany([f.organizationId])).get(f.organizationId),
    ).toEqual(entitlements);
  });

  it('converts an active legacy lifecycle to exact bridge selection semantics', async () => {
    const f = await fixture();
    const legacyStartedAt = new Date(Date.now() - 60_000);
    await prisma.organization.update({
      where: { id: f.organizationId },
      data: {
        status: 'DEMO',
        demoStartedAt: legacyStartedAt,
        demoExpiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const before = await app.get(EntitlementService).effective(f.organizationId);
    expect(before.features['module.work_permits']).toBe(true);
    expect(before.features['module.incidents']).toBe(true);
    expect(before.features['module.ppe']).toBe(true);
    expect(before.features['module.training']).toBe(true);

    await api(f)
      .post('/capability-access/demo')
      .set('Idempotency-Key', randomUUID())
      .send({ assessmentId: f.assessment.id, capabilityKeys: ['INSPECTIONS'] })
      .expect(201);

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: f.organizationId },
      select: { demoStartedAt: true, demoExpiresAt: true },
    });
    expect(organization.demoStartedAt).toEqual(legacyStartedAt);
    const bridgeAudit = await prisma.auditLog.findFirstOrThrow({
      where: { organizationId: f.organizationId, action: 'CAPABILITY_DEMO_ACCESS_ACTIVATED' },
    });
    expect((bridgeAudit.metadata as { demoStartedAt: string }).demoStartedAt).toBe(
      legacyStartedAt.toISOString(),
    );
    const after = await app.get(EntitlementService).effective(f.organizationId);
    expect(after.features['module.inspections']).toBe(true);
    expect(after.features['module.work_permits']).not.toBe(true);
    expect(after.features['module.incidents']).not.toBe(true);
    expect(after.features['module.ppe']).not.toBe(true);
    expect(after.features['module.training']).not.toBe(true);
    expect(after.demoExpiresAt).toEqual(organization.demoExpiresAt);
  });
});
