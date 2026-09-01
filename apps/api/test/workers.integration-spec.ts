import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('worker registry integration', () => {
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
    const operation = (method: 'get' | 'post' | 'patch', path: string) => {
      const client = request(app.getHttpServer());
      const pending =
        method === 'get'
          ? client.get(`/api/v1${path}`)
          : method === 'patch'
            ? client.patch(`/api/v1${path}`)
            : client.post(`/api/v1${path}`);
      return pending
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', organizationId);
    };
    return {
      get: (path: string) => operation('get', path),
      post: (path: string) => operation('post', path),
      patch: (path: string) => operation('patch', path),
    };
  }

  it('keeps Worker separate from seats while enforcing tenant, role, link and history invariants', async () => {
    const owner = await register('Worker Owner');
    const manager = await register('Worker Manager');
    const technician = await register('Worker Technician');
    const consultant = await register('Worker Consultant');
    const viewer = await register('Worker Viewer');
    const otherUser = await register('Worker Other Tenant');
    const orgA = await organization(owner.token, 'Worker Organization A');
    const orgB = await organization(owner.token, 'Worker Organization B');
    await prisma.membership.createMany({
      data: [
        { organizationId: orgA, userId: manager.userId, role: 'SST_MANAGER' },
        { organizationId: orgA, userId: technician.userId, role: 'SST_TECHNICIAN' },
        { organizationId: orgA, userId: consultant.userId, role: 'CONSULTANT' },
        { organizationId: orgA, userId: viewer.userId, role: 'VIEWER' },
        { organizationId: orgB, userId: otherUser.userId, role: 'ORG_ADMIN' },
      ],
    });
    const centerA = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgA } });
    const centerB = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgB } });
    const seatCountBefore = await prisma.membership.count({
      where: { organizationId: orgA, status: 'ACTIVE' },
    });

    for (const actor of [technician, consultant, viewer]) {
      await api(actor.token, orgA)
        .post('/workers')
        .send({ displayName: 'No autorizado' })
        .expect(403);
    }
    await api(owner.token, orgA)
      .post('/workers')
      .send({ displayName: 'Centro ajeno', workCenterId: centerB.id })
      .expect(400);
    await api(owner.token, orgA)
      .post('/workers')
      .send({ displayName: 'Cuenta ajena', linkedUserId: otherUser.userId })
      .expect(400);

    const created = await api(manager.token, orgA)
      .post('/workers')
      .send({
        displayName: 'Ana Operadora',
        internalCode: `W-${suffix}`,
        workCenterId: centerA.id,
        jobTitle: 'Operadora de mantenimiento',
        linkedUserId: technician.userId,
        startDate: '2026-08-01',
        notes: 'Registro operativo SST sin información clínica.',
      })
      .expect(201);
    const workerId = created.body.id as string;
    expect(created.body).toMatchObject({
      displayName: 'Ana Operadora',
      status: 'ACTIVE',
      version: 1,
      workCenter: { id: centerA.id },
      linkedUser: { id: technician.userId },
    });
    expect(
      await prisma.membership.count({ where: { organizationId: orgA, status: 'ACTIVE' } }),
    ).toBe(seatCountBefore);

    await api(owner.token, orgA)
      .post('/workers')
      .send({ displayName: 'Vínculo duplicado', linkedUserId: technician.userId })
      .expect(409);
    await api(technician.token, orgA).get(`/workers/${workerId}`).expect(200);
    await api(consultant.token, orgA).get('/workers?search=operadora&status=ACTIVE').expect(200);
    await api(viewer.token, orgA)
      .get(`/workers?workCenterId=${centerA.id}`)
      .expect(200)
      .expect(({ body }) => expect(body.total).toBeGreaterThanOrEqual(1));
    await api(owner.token, orgB).get(`/workers/${workerId}`).expect(404);

    const updated = await api(owner.token, orgA)
      .patch(`/workers/${workerId}`)
      .send({ linkedUserId: null, jobTitle: 'Técnica operativa', expectedVersion: 1 })
      .expect(200);
    expect(updated.body).toMatchObject({ linkedUser: null, version: 2 });
    await api(owner.token, orgA)
      .patch(`/workers/${workerId}`)
      .send({ jobTitle: 'Cambio obsoleto', expectedVersion: 1 })
      .expect(409);

    await prisma.membership.update({
      where: {
        userId_organizationId: { userId: technician.userId, organizationId: orgA },
      },
      data: { status: 'SUSPENDED' },
    });
    expect((await prisma.worker.findUniqueOrThrow({ where: { id: workerId } })).status).toBe(
      'ACTIVE',
    );

    const deactivated = await api(manager.token, orgA)
      .post(`/workers/${workerId}/deactivate`)
      .send({ endDate: '2026-08-31', expectedVersion: 2 })
      .expect(201);
    expect(deactivated.body).toMatchObject({ status: 'INACTIVE', version: 3 });
    await api(owner.token, orgA)
      .get(`/workers/${workerId}`)
      .expect(200)
      .expect(({ body }) => expect(body.displayName).toBe('Ana Operadora'));
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: orgA,
          entityType: 'Worker',
          entityId: workerId,
          action: { in: ['WORKER_CREATED', 'WORKER_UPDATED', 'WORKER_DEACTIVATED'] },
        },
      }),
    ).toBe(3);
  });
});
