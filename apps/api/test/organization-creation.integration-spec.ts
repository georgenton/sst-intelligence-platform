import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuditService } from '../src/audit/audit.service';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { syncGlobalReferenceData } from '../src/reference-data/risk-methodology-reference-sync';
import { syncOrganizationBaseline } from '../src/reference-data/organization-baseline-reference-data';

describe('organization creation on a canonical release database without development seed', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const admin = new PrismaService();
  const schema = `organization_create_${randomUUID().replaceAll('-', '')}`;

  beforeAll(async () => {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set('schema', schema);
    const result = spawnSync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        join(__dirname, '../prisma/schema.prisma'),
      ],
      {
        env: { ...process.env, DATABASE_URL: url.toString() },
        encoding: 'utf8',
      },
    );
    if (result.status !== 0) throw new Error('Disposable organization test migrations failed');
    prisma = new PrismaService({ datasources: { db: { url: url.toString() } } });
    await syncGlobalReferenceData(prisma);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.organization.count()).toBe(0);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
    else if (prisma) await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  });

  async function register() {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `organization-${randomUUID()}@example.test`,
        displayName: 'Synthetic Organization Owner',
        password: randomUUID() + randomUUID(),
      })
      .expect(201);
    return { id: response.body.user.id as string, token: response.body.accessToken as string };
  }
  const input = { name: 'Canonical release organization', country: 'Ecuador', sector: 'Servicios' };
  function create(token: string, key?: string, body = input) {
    const pending = request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`);
    if (key) pending.set('Idempotency-Key', key);
    return pending.send(body);
  }

  it('provisions only the normal FREE/CORE baseline and preserves the DTO data', async () => {
    const owner = await register();
    const response = await create(owner.token).expect(201);
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: response.body.id as string },
      include: {
        memberships: true,
        workCenters: true,
        subscriptions: { include: { plan: true } },
        modules: { include: { module: true } },
      },
    });
    expect(organization).toMatchObject({ ...input, demoStartedAt: null, demoExpiresAt: null });
    expect(organization.memberships).toHaveLength(1);
    expect(organization.memberships[0]).toMatchObject({
      userId: owner.id,
      role: 'ORG_OWNER',
      status: 'ACTIVE',
    });
    expect(organization.workCenters).toHaveLength(1);
    expect(organization.workCenters[0]).toMatchObject({ name: 'Centro principal', isDemo: false });
    expect(organization.subscriptions.map(({ plan }) => plan.key)).toEqual(['FREE']);
    expect(organization.modules.map(({ module }) => module.key)).toEqual(['CORE']);
    expect(organization.modules[0]).toMatchObject({ status: 'ACTIVE', source: 'PLAN' });
    expect(await prisma.auditLog.count({ where: { organizationId: organization.id } })).toBe(2);
  });

  it('replays concurrent and later retries exactly once and rejects changed data or another actor', async () => {
    const owner = await register();
    const key = randomUUID();
    const responses = await Promise.all([create(owner.token, key), create(owner.token, key)]);
    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    expect(responses[0]!.body.id).toBe(responses[1]!.body.id);
    const replay = await create(owner.token, key).expect(201);
    expect(replay.body.id).toBe(responses[0]!.body.id);
    expect(
      await prisma.organization.count({ where: { memberships: { some: { userId: owner.id } } } }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { organizationId: replay.body.id as string } }),
    ).toBe(2);
    await create(owner.token, key, { ...input, sector: 'Otra actividad' }).expect(409);
    const otherOwner = await register();
    const other = await create(otherOwner.token, key).expect(201);
    expect(other.body.id).not.toBe(replay.body.id);
  });

  it('rolls back every row and both mandatory audits when the second audit fails, then retries safely', async () => {
    const owner = await register();
    const key = randomUUID();
    const audit = app.get(AuditService);
    const record = audit.record.bind(audit);
    let attemptedId: string | undefined;
    const failure = jest.spyOn(audit, 'record').mockImplementation(async (event, tx) => {
      const result = await record(event, tx);
      if (event.action === 'MEMBERSHIP_CREATED') {
        attemptedId = event.organizationId;
        throw new Error('Synthetic audit failure');
      }
      return result;
    });
    try {
      const response = await create(owner.token, key).expect(503);
      expect(response.body.code).toBe('ORGANIZATION_CREATE_UNAVAILABLE');
      expect(JSON.stringify(response.body)).not.toMatch(/Prisma|Synthetic|P\d{4}|password/i);
      expect(attemptedId).toBeDefined();
      expect(await prisma.organization.count({ where: { id: attemptedId! } })).toBe(0);
      const where = { organizationId: attemptedId! };
      expect(
        await Promise.all([
          prisma.membership.count({ where }),
          prisma.workCenter.count({ where }),
          prisma.subscription.count({ where }),
          prisma.organizationModule.count({ where }),
          prisma.auditLog.count({ where }),
        ]),
      ).toEqual([0, 0, 0, 0, 0]);
    } finally {
      failure.mockRestore();
    }
    await create(owner.token, key).expect(201);
    expect(
      await prisma.organization.count({ where: { memberships: { some: { userId: owner.id } } } }),
    ).toBe(1);
  });

  it('preserves name/country/optional sector limits and rejects invalid retry keys', async () => {
    const owner = await register();
    for (const invalid of [
      { ...input, name: 'a' },
      { ...input, name: 'a'.repeat(121) },
      { ...input, country: 'a' },
      { ...input, country: 'a'.repeat(81) },
      { ...input, sector: 'a' },
      { ...input, sector: 'a'.repeat(121) },
    ]) {
      await create(owner.token, undefined, invalid).expect(400);
    }
    await create(owner.token, 'invalid').expect(400);
    await create(owner.token, randomUUID(), {
      name: 'a'.repeat(120),
      country: 'a'.repeat(80),
      sector: 'a'.repeat(120),
    }).expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'No optional sector', country: 'EC' })
      .expect(201);
  });

  it('does not overwrite configured reference metadata, UUIDs or FREE entitlements during bootstrap', async () => {
    const plan = await prisma.plan.findUniqueOrThrow({ where: { key: 'FREE' } });
    const core = await prisma.moduleDefinition.findUniqueOrThrow({ where: { key: 'CORE' } });
    const feature = await prisma.featureDefinition.findUniqueOrThrow({
      where: { key: 'organization.max_members' },
    });
    await prisma.plan.update({ where: { id: plan.id }, data: { name: 'Configured baseline' } });
    await prisma.planFeature.update({
      where: { planId_featureId: { planId: plan.id, featureId: feature.id } },
      data: { value: '4' },
    });
    await prisma.$transaction((tx) => syncOrganizationBaseline(tx));
    expect(await prisma.plan.findUniqueOrThrow({ where: { key: 'FREE' } })).toMatchObject({
      id: plan.id,
      name: 'Configured baseline',
    });
    expect((await prisma.moduleDefinition.findUniqueOrThrow({ where: { key: 'CORE' } })).id).toBe(
      core.id,
    );
    expect(
      (
        await prisma.planFeature.findUniqueOrThrow({
          where: { planId_featureId: { planId: plan.id, featureId: feature.id } },
        })
      ).value,
    ).toBe('4');
  });
});
