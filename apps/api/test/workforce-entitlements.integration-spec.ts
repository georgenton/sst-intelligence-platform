import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('workforce module entitlements integration', () => {
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

  async function owner() {
    const email = `workforce-entitlement-${suffix}@example.test`;
    const user = await prisma.user.create({
      data: {
        email,
        displayName: 'Workforce Entitlement Owner',
        passwordHash: 'integration-fixture-not-for-login',
      },
      select: { id: true },
    });
    return { token: await jwt.signAsync({ id: user.id, email, sub: user.id }), userId: user.id };
  }

  function api(token: string, organizationId: string) {
    const operation = (method: 'get' | 'post', path: string) => {
      const client = request(app.getHttpServer());
      const pending =
        method === 'get' ? client.get(`/api/v1${path}`) : client.post(`/api/v1${path}`);
      return pending
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', organizationId);
    };
    return {
      get: (path: string) => operation('get', path),
      post: (path: string) => operation('post', path),
    };
  }

  it('denies missing or expired workforce modules without leaking or deleting history', async () => {
    const actor = await owner();
    const organizationResponse = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ name: `Workforce Entitlement ${suffix}`, country: 'Ecuador' })
      .expect(201);
    const organizationId = organizationResponse.body.id as string;
    const center = await prisma.workCenter.findFirstOrThrow({ where: { organizationId } });
    const worker = await prisma.worker.create({
      data: {
        organizationId,
        displayName: 'Persona histórica de módulos',
        workCenterId: center.id,
        createdById: actor.userId,
      },
    });
    const incident = await prisma.incident.create({
      data: {
        organizationId,
        workCenterId: center.id,
        occurredAt: new Date('2026-08-31T10:00:00.000Z'),
        reportedAt: new Date('2026-08-31T10:05:00.000Z'),
        reportedByUserId: actor.userId,
        title: 'Incidente histórico con acceso gobernado',
        description: 'Fixture operativo preservado después de la expiración.',
        eventType: 'NEAR_MISS',
        status: 'REPORTED',
      },
    });
    const catalogItem = await prisma.ppeCatalogItem.create({
      data: {
        organizationId,
        name: `Elemento histórico ${suffix}`,
        category: 'HEAD',
        createdById: actor.userId,
      },
    });
    const ppeIssue = await prisma.ppeIssue.create({
      data: {
        organizationId,
        workerId: worker.id,
        ppeCatalogItemId: catalogItem.id,
        issuedAt: new Date('2026-08-31T08:00:00.000Z'),
        issuedById: actor.userId,
        status: 'REPLACEMENT_DUE',
      },
    });
    const definition = await prisma.trainingDefinition.create({
      data: {
        organizationId,
        title: `Capacitación histórica ${suffix}`,
        category: 'Interna',
        createdById: actor.userId,
      },
    });
    const trainingSession = await prisma.trainingSession.create({
      data: {
        organizationId,
        trainingDefinitionId: definition.id,
        workCenterId: center.id,
        scheduledStart: new Date('2026-08-31T08:00:00.000Z'),
        scheduledEnd: new Date('2026-08-31T10:00:00.000Z'),
        mode: 'IN_PERSON',
        createdById: actor.userId,
      },
    });
    const trainingRequirement = await prisma.workerCompetencyRequirement.create({
      data: {
        organizationId,
        workerId: worker.id,
        trainingDefinitionId: definition.id,
        reason: 'Requisito histórico preservado.',
        requiredByDate: new Date('2026-08-31T00:00:00.000Z'),
        assignedById: actor.userId,
      },
    });

    const entitlementsBefore = await api(actor.token, organizationId)
      .get('/entitlements')
      .expect(200);
    expect(entitlementsBefore.body.features['module.incidents']).not.toBe(true);
    expect(entitlementsBefore.body.features['module.ppe']).not.toBe(true);
    expect(entitlementsBefore.body.features['module.training']).not.toBe(true);

    await api(actor.token, organizationId).get('/incidents').expect(403);
    await api(actor.token, organizationId).get(`/incidents/${incident.id}`).expect(403);
    await api(actor.token, organizationId).post('/incidents').send({}).expect(403);
    await api(actor.token, organizationId)
      .post(`/incidents/${incident.id}/transition`)
      .send({ status: 'CANCELLED', expectedVersion: 1 })
      .expect(403);

    await api(actor.token, organizationId).get('/ppe/catalog').expect(403);
    await api(actor.token, organizationId).get(`/ppe/workers/${worker.id}`).expect(403);
    await api(actor.token, organizationId).post('/ppe/requirements').send({}).expect(403);
    await api(actor.token, organizationId)
      .post(`/ppe/issues/${ppeIssue.id}/acknowledge`)
      .send({ expectedVersion: 1, note: 'No autorizado.' })
      .expect(403);

    await api(actor.token, organizationId).get('/training/definitions').expect(403);
    await api(actor.token, organizationId)
      .get(`/training/sessions/${trainingSession.id}`)
      .expect(403);
    await api(actor.token, organizationId).post('/training/definitions').send({}).expect(403);
    await api(actor.token, organizationId)
      .post(`/training/sessions/${trainingSession.id}/transition`)
      .send({ status: 'SCHEDULED', expectedVersion: 1 })
      .expect(403);

    const queueWithoutAccess = await api(actor.token, organizationId)
      .get('/work-queue?pageSize=100')
      .expect(200);
    expect(
      queueWithoutAccess.body.items.filter((item: { module: string }) =>
        ['INCIDENTS', 'PPE', 'TRAINING'].includes(item.module),
      ),
    ).toEqual([]);

    await prisma.organization.update({
      where: { id: organizationId },
      data: { demoExpiresAt: new Date(Date.now() + 60_000) },
    });
    const entitlementsDuringDemo = await api(actor.token, organizationId)
      .get('/entitlements')
      .expect(200);
    expect(entitlementsDuringDemo.body.features).toMatchObject({
      'module.incidents': true,
      'module.ppe': true,
      'module.training': true,
    });
    await api(actor.token, organizationId).get('/incidents').expect(200);
    await api(actor.token, organizationId).get(`/incidents/${incident.id}`).expect(200);
    await api(actor.token, organizationId).get('/ppe/catalog').expect(200);
    await api(actor.token, organizationId).get(`/ppe/workers/${worker.id}`).expect(200);
    await api(actor.token, organizationId).get('/training/definitions').expect(200);
    await api(actor.token, organizationId)
      .get(`/training/sessions/${trainingSession.id}`)
      .expect(200);
    const queueDuringDemo = await api(actor.token, organizationId)
      .get('/work-queue?pageSize=100')
      .expect(200);
    expect(queueDuringDemo.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ module: 'INCIDENTS', sourceId: incident.id }),
        expect.objectContaining({ module: 'PPE', sourceId: ppeIssue.id }),
        expect.objectContaining({ module: 'TRAINING', sourceId: trainingRequirement.id }),
      ]),
    );

    await prisma.organization.update({
      where: { id: organizationId },
      data: { demoExpiresAt: new Date(Date.now() - 60_000) },
    });
    const entitlementsAfter = await api(actor.token, organizationId)
      .get('/entitlements')
      .expect(200);
    expect(entitlementsAfter.body.features['module.incidents']).not.toBe(true);
    expect(entitlementsAfter.body.features['module.ppe']).not.toBe(true);
    expect(entitlementsAfter.body.features['module.training']).not.toBe(true);
    await api(actor.token, organizationId).get(`/incidents/${incident.id}`).expect(403);
    await api(actor.token, organizationId).get(`/ppe/workers/${worker.id}`).expect(403);
    await api(actor.token, organizationId)
      .get(`/training/sessions/${trainingSession.id}`)
      .expect(403);
    await api(actor.token, organizationId)
      .post(`/incidents/${incident.id}/transition`)
      .send({ status: 'CANCELLED', expectedVersion: 1 })
      .expect(403);
    await api(actor.token, organizationId)
      .post(`/ppe/issues/${ppeIssue.id}/acknowledge`)
      .send({ expectedVersion: 1, note: 'No autorizado.' })
      .expect(403);
    await api(actor.token, organizationId)
      .post(`/training/sessions/${trainingSession.id}/transition`)
      .send({ status: 'SCHEDULED', expectedVersion: 1 })
      .expect(403);
    const queueAfterExpiry = await api(actor.token, organizationId)
      .get('/work-queue?pageSize=100')
      .expect(200);
    expect(
      queueAfterExpiry.body.items.filter((item: { module: string }) =>
        ['INCIDENTS', 'PPE', 'TRAINING'].includes(item.module),
      ),
    ).toEqual([]);

    expect(await prisma.incident.count({ where: { id: incident.id, organizationId } })).toBe(1);
    expect(await prisma.ppeIssue.count({ where: { id: ppeIssue.id, organizationId } })).toBe(1);
    expect(
      await prisma.trainingSession.count({ where: { id: trainingSession.id, organizationId } }),
    ).toBe(1);
    expect(
      await prisma.workerCompetencyRequirement.count({
        where: { id: trainingRequirement.id, organizationId },
      }),
    ).toBe(1);
  });
});
