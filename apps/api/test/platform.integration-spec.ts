import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const answers = {
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

describe('critical platform integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('enforces the real login bucket and allows requests in a fresh application instance', async () => {
    const credentials = {
      email: `rate-limit-${suffix}@example.test`,
      displayName: 'Rate Limit Regression',
      password: 'rate-limit-regression-password-123',
    };
    // Each instance constructs the real AppModule, global guard and in-memory storage.
    // No provider overrides, synthetic IPs, clock changes or storage resets.
    for (const instance of [1, 2]) {
      const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
      const isolatedApp = module.createNestApplication();
      isolatedApp.setGlobalPrefix('api/v1');
      isolatedApp.use(cookieParser());
      await isolatedApp.init();
      try {
        if (instance === 1) {
          await request(isolatedApp.getHttpServer())
            .post('/api/v1/auth/register')
            .send(credentials)
            .expect(201);
        }
        for (let hit = 1; hit <= 5; hit += 1) {
          await request(isolatedApp.getHttpServer())
            .post('/api/v1/auth/login')
            .send(credentials)
            .expect(201)
            .expect('X-RateLimit-Limit', '5')
            .expect('X-RateLimit-Remaining', String(5 - hit));
        }
        await request(isolatedApp.getHttpServer())
          .post('/api/v1/auth/login')
          .send(credentials)
          .expect(429)
          .expect(({ headers }) => {
            expect(Number(headers['retry-after'])).toBeGreaterThan(0);
            expect(Number(headers['retry-after'])).toBeLessThanOrEqual(60);
          });
      } finally {
        await isolatedApp.close();
      }
    }
  });

  it('recovers an expired access token with the real rotating refresh family', async () => {
    const email = `auth-liveness-${suffix}@example.test`;
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, displayName: 'Auth Liveness', password: 'auth-liveness-password-123' })
      .expect(201);
    const refreshCookies = registration.headers['set-cookie'];
    if (!refreshCookies?.[0]) throw new Error('Registration did not establish refresh session');

    const expiredAccessToken = await jwt.signAsync(
      {
        id: registration.body.user.id as string,
        email,
        sub: registration.body.user.id as string,
      },
      { expiresIn: -1 },
    );
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredAccessToken}`)
      .expect(401);

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookies[0] as string)
      .expect(201);
    const rotatedCookies = refreshed.headers['set-cookie'];
    if (!rotatedCookies?.[0]) throw new Error('Refresh did not rotate session cookie');

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken as string}`)
      .expect(200)
      .expect(({ body }) => expect(body.email).toBe(email));

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', rotatedCookies[0] as string)
      .expect(201);
  });

  it('covers authentication, tenancy, solution finder, entitlements, demo and audit', async () => {
    const emailA = `owner-a-${suffix}@example.test`;
    const emailB = `owner-b-${suffix}@example.test`;
    const registerA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: emailA, displayName: 'Owner A', password: 'a-strong-password-123' })
      .expect(201);
    const firstCookies = registerA.headers['set-cookie'];
    if (!firstCookies?.[0]) throw new Error('Register response did not set a refresh cookie');
    const firstCookie = firstCookies[0] as string;
    expect(registerA.body.accessToken).toBeTruthy();
    expect(firstCookie).toContain('HttpOnly');
    expect(firstCookie).toContain('SameSite=Lax');
    expect(firstCookie).toContain('Path=/api/v1/auth');

    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(201);
    const rotatedCookies = rotated.headers['set-cookie'];
    if (!rotatedCookies?.[0]) throw new Error('Refresh response did not rotate the cookie');
    expect(rotatedCookies[0]).not.toBe(firstCookie);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', rotatedCookies[0] as string)
      .expect(401);

    const loginA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailA, password: 'a-strong-password-123' })
      .expect(201);
    const tokenA = loginA.body.accessToken as string;
    const loginCookies = loginA.headers['set-cookie'];
    if (!loginCookies?.[0]) throw new Error('Login response did not set a refresh cookie');
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', loginCookies[0] as string)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', loginCookies[0] as string)
      .expect(401);
    const orgA = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `Organization A ${suffix}`, country: 'Ecuador', sector: 'Manufactura' })
      .expect(201);
    const orgAId = orgA.body.id as string;
    const orgB = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `Organization B ${suffix}`, country: 'Ecuador' })
      .expect(201);
    expect(orgB.body.id).not.toBe(orgAId);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .send({ email: `viewer-${suffix}@example.test`, role: 'VIEWER' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .send({ email: `second-viewer-${suffix}@example.test`, role: 'VIEWER' })
      .expect(403);

    const registerB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: emailB, displayName: 'Owner B', password: 'another-strong-password-123' })
      .expect(201);
    const tokenB = registerB.body.accessToken as string;
    const orgC = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: `Organization C ${suffix}`, country: 'Ecuador' })
      .expect(201);
    const centerC = await prisma.workCenter.findFirstOrThrow({
      where: { organizationId: orgC.body.id as string },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgC.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgC.body.id)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgC.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgC.body.id)
      .send({ name: 'Cross-tenant mutation must fail' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgC.body.id as string}/work-centers/${centerC.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgC.body.id as string)
      .send({ name: 'Cross-tenant center mutation must fail' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/dashboard')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgC.body.id)
      .expect(403);

    const membershipB = await prisma.membership.create({
      data: {
        userId: registerB.body.user.id as string,
        organizationId: orgAId,
        role: 'VIEWER',
        status: 'SUSPENDED',
      },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('x-organization-id', orgAId)
      .expect(403);
    await prisma.membership.update({
      where: { id: membershipB.id },
      data: { status: 'ACTIVE' },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('x-organization-id', orgAId)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('x-organization-id', orgAId)
      .send({ name: 'Viewer must not update' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/invitations`)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('x-organization-id', orgAId)
      .send({ email: `unauthorized-${suffix}@example.test`, role: 'VIEWER' })
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/entitlements/protected/technical-risk')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .expect(403);

    const createdSession = await request(app.getHttpServer())
      .post('/api/v1/solution-finder/sessions')
      .expect(201);
    const sessionId = createdSession.body.id as string;
    const sessionToken = createdSession.body.resumeToken as string;
    await request(app.getHttpServer())
      .patch(`/api/v1/solution-finder/sessions/${sessionId}`)
      .set('x-session-token', sessionToken)
      .send({ answers, currentStep: 6 })
      .expect(200);
    const completed = await request(app.getHttpServer())
      .post(`/api/v1/solution-finder/sessions/${sessionId}/complete`)
      .set('x-session-token', sessionToken)
      .expect(201);
    expect(completed.body.result.recommendedModules.length).toBeGreaterThan(3);
    expect(completed.body.explanationMode).toBe('template');
    const completedAgain = await request(app.getHttpServer())
      .post(`/api/v1/solution-finder/sessions/${sessionId}/complete`)
      .set('x-session-token', sessionToken)
      .expect(201);
    expect(completedAgain.body.result).toEqual(completed.body.result);

    await request(app.getHttpServer())
      .post(`/api/v1/solution-finder/sessions/${sessionId}/claim`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .set('x-session-token', 'invalid-claim-token')
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/solution-finder/sessions/${sessionId}/claim`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .set('x-session-token', sessionToken)
      .expect(201);
    const [activation, repeated] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/solution-finder/sessions/${sessionId}/activate-demo`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('x-session-token', sessionToken)
        .expect(201),
      request(app.getHttpServer())
        .post(`/api/v1/solution-finder/sessions/${sessionId}/activate-demo`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-organization-id', orgAId)
        .set('x-session-token', sessionToken)
        .expect(201),
    ]);
    expect([activation.body.idempotent, repeated.body.idempotent].sort()).toEqual([false, true]);

    const demoCenters = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/work-centers`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .expect(200);
    const syntheticCenters = demoCenters.body.filter(
      (center: { isDemo: boolean }) => center.isDemo,
    ) as Array<{ id: string; isActive: boolean; isDemo: boolean }>;
    expect(syntheticCenters).toHaveLength(2);
    expect(syntheticCenters.every(({ isActive }) => isActive)).toBe(true);
    for (const center of syntheticCenters) {
      await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgAId}/work-centers/${center.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-organization-id', orgAId)
        .expect(200)
        .expect(({ body }) => expect(body.isDemo).toBe(true));
    }

    const originalNormalCenter = demoCenters.body.find(
      (center: { isDemo: boolean }) => !center.isDemo,
    ) as { id: string };
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/work-centers`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .send({ name: `Segundo centro normal ${suffix}` })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('LIMIT_REACHED'));
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}/work-centers/${originalNormalCenter.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .send({ isActive: false })
      .expect(200)
      .expect(({ body }) => expect(body.isActive).toBe(false));
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/work-centers`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .send({ name: `Centro normal sustituto ${suffix}` })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}/work-centers/${originalNormalCenter.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .send({ isActive: true })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('LIMIT_REACHED'));

    const syntheticLifecycleCenter = syntheticCenters[0]!;
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}/work-centers/${syntheticLifecycleCenter.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .send({ isActive: false })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}/work-centers/${syntheticLifecycleCenter.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .send({ isActive: true })
      .expect(200)
      .expect(({ body }) => expect(body.isActive).toBe(true));

    await request(app.getHttpServer())
      .get('/api/v1/entitlements/protected/technical-risk')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .expect(200);
    const dashboard = await request(app.getHttpServer())
      .get('/api/v1/dashboard')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .expect(200);
    expect(
      dashboard.body.organization.modules.some(
        (item: { status: string }) => item.status === 'DEMO',
      ),
    ).toBe(true);
    expect(dashboard.body.entitlements.features['module.work_permits']).toBe(true);
    await request(app.getHttpServer())
      .get('/api/v1/work-permits/templates')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .expect(200);
    expect(
      await prisma.auditLog.count({ where: { organizationId: orgAId, action: 'DEMO_ACTIVATED' } }),
    ).toBe(1);

    await prisma.organizationModule.updateMany({
      where: { organizationId: orgAId, status: 'DEMO' },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await prisma.organization.update({
      where: { id: orgAId },
      data: { demoExpiresAt: new Date(Date.now() - 1_000) },
    });
    await request(app.getHttpServer())
      .get('/api/v1/entitlements/protected/technical-risk')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/work-permits/templates')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/work-centers`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-organization-id', orgAId)
      .expect(200)
      .expect(({ body }) => {
        expect(body.filter((center: { isDemo: boolean }) => center.isDemo)).toHaveLength(2);
      });

    const expiringSession = await request(app.getHttpServer())
      .post('/api/v1/solution-finder/sessions')
      .expect(201);
    await prisma.guidedFlowSession.update({
      where: { id: expiringSession.body.id as string },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/solution-finder/sessions/${expiringSession.body.id as string}`)
      .set('x-session-token', expiringSession.body.resumeToken as string)
      .expect(403);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `missing-${attempt}-${suffix}@example.test`, password: 'invalid-password' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `throttled-${suffix}@example.test`, password: 'invalid-password' })
      .expect(429);
  }, 60_000);
});
