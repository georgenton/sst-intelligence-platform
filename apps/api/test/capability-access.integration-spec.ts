import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
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
    const technicalRisk = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'TECHNICAL_RISK' },
    });
    await prisma.organizationModule.create({
      data: {
        organizationId: f.organizationId,
        moduleId: technicalRisk.id,
        status: 'ACTIVE',
        source: 'PLAN',
      },
    });
    await api(f)
      .post('/capability-access/demo')
      .set('Idempotency-Key', randomUUID())
      .send({ assessmentId: f.assessment.id, capabilityKeys: ['TECHNICAL_RISK'] })
      .expect(201);
    await expect(
      prisma.organizationModule.findUniqueOrThrow({
        where: {
          organizationId_moduleId: { organizationId: f.organizationId, moduleId: technicalRisk.id },
        },
      }),
    ).resolves.toMatchObject({ status: 'ACTIVE', source: 'PLAN' });
  });
});
