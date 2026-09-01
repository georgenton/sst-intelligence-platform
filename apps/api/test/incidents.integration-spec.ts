import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('incident management integration', () => {
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

  it('keeps the professional incident lifecycle tenant-safe, traceable and queue-backed', async () => {
    const owner = await register('Incident Owner');
    const manager = await register('Incident Manager');
    const technician = await register('Incident Technician');
    const viewer = await register('Incident Viewer');
    const orgA = await organization(owner.token, 'Incident Organization A');
    const orgB = await organization(owner.token, 'Incident Organization B');
    await prisma.organization.updateMany({
      where: { id: { in: [orgA, orgB] } },
      data: { demoExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    await prisma.membership.createMany({
      data: [
        { organizationId: orgA, userId: manager.userId, role: 'SST_MANAGER' },
        { organizationId: orgA, userId: technician.userId, role: 'SST_TECHNICIAN' },
        { organizationId: orgA, userId: viewer.userId, role: 'VIEWER' },
      ],
    });
    const centerA = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgA } });
    const centerB = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgB } });
    const worker = await prisma.worker.create({
      data: {
        organizationId: orgA,
        displayName: 'Ana Operadora',
        workCenterId: centerA.id,
        createdById: owner.userId,
      },
    });
    const workerB = await prisma.worker.create({
      data: {
        organizationId: orgB,
        displayName: 'Trabajador de otra organización',
        workCenterId: centerB.id,
        createdById: owner.userId,
      },
    });

    await api(viewer.token, orgA)
      .post('/incidents')
      .send({
        workCenterId: centerA.id,
        occurredAt: '2026-08-31T10:00:00.000Z',
        title: 'No autorizado',
        description: 'Registro que no debe ser creado.',
        eventType: 'INCIDENT',
      })
      .expect(403);
    await api(technician.token, orgA)
      .post('/incidents')
      .send({
        workCenterId: centerB.id,
        occurredAt: '2026-08-31T10:00:00.000Z',
        title: 'Centro ajeno',
        description: 'La referencia cruza el límite organizacional.',
        eventType: 'INCIDENT',
      })
      .expect(400);

    const created = await api(technician.token, orgA)
      .post('/incidents')
      .send({
        workCenterId: centerA.id,
        occurredAt: '2026-08-31T10:00:00.000Z',
        title: 'Desprendimiento controlado de material',
        description: 'Material cayó dentro del área delimitada sin contacto con personas.',
        activityContext: 'Inspección visual durante preparación de mantenimiento.',
        eventType: 'NEAR_MISS',
      })
      .expect(201);
    const incidentId = created.body.id as string;
    expect(created.body).toMatchObject({ status: 'DRAFT', version: 1, eventType: 'NEAR_MISS' });
    expect(created.body).not.toHaveProperty('rootCause');
    await api(owner.token, orgB).get(`/incidents/${incidentId}`).expect(404);
    await api(viewer.token, orgA).get(`/incidents/${incidentId}`).expect(200);

    await api(technician.token, orgA)
      .post(`/incidents/${incidentId}/workers`)
      .send({ workerId: worker.id, involvement: 'Presenció el evento desde la zona segura.' })
      .expect(201);
    const workerHistory = await api(owner.token, orgA)
      .get(`/incidents?workerId=${worker.id}&pageSize=100`)
      .expect(200);
    expect(workerHistory.body).toMatchObject({ total: 1 });
    expect(workerHistory.body.items[0]).toMatchObject({ id: incidentId });
    await api(owner.token, orgB)
      .get(`/incidents?workerId=${worker.id}&pageSize=100`)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ total: 0, items: [] }));
    await api(owner.token, orgA)
      .get(`/incidents?workerId=${workerB.id}&pageSize=100`)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ total: 0, items: [] }));
    const reported = await api(technician.token, orgA)
      .post(`/incidents/${incidentId}/transition`)
      .send({ status: 'REPORTED', expectedVersion: 1 })
      .expect(201);
    expect(reported.body).toMatchObject({ status: 'REPORTED', version: 2 });
    const investigation = await api(technician.token, orgA)
      .post(`/incidents/${incidentId}/investigation/start`)
      .send({ expectedVersion: 2 })
      .expect(201);
    expect(investigation.body).toMatchObject({ status: 'UNDER_INVESTIGATION', version: 3 });

    const factor = await api(technician.token, orgA)
      .post(`/incidents/${incidentId}/factors`)
      .send({
        category: 'EQUIPMENT',
        description: 'Se observó material suelto sobre la superficie de trabajo.',
        rationale: 'Observación documentada; no constituye una causa raíz automática.',
      })
      .expect(201);
    expect(factor.body).toMatchObject({ category: 'EQUIPMENT' });
    expect(factor.body).not.toHaveProperty('rootCause');
    await api(technician.token, orgA)
      .post(`/incidents/${incidentId}/evidence`)
      .send({
        scope: 'INVESTIGATION',
        type: 'NOTE',
        note: 'El área permaneció delimitada durante la revisión.',
      })
      .expect(201);

    const dueAt = new Date(Date.now() - 60_000).toISOString();
    const action = await api(manager.token, orgA)
      .post(`/incidents/${incidentId}/actions`)
      .send({
        title: 'Asegurar materiales antes de iniciar la actividad',
        description: 'Añadir control visual previo a cada intervención.',
        ownerUserId: manager.userId,
        priority: 'HIGH',
        dueAt,
      })
      .expect(201);
    const actionId = action.body.id as string;
    expect(action.body).toMatchObject({ status: 'OPEN', version: 1 });

    await api(manager.token, orgA)
      .post(`/incidents/${incidentId}/close`)
      .send({ status: 'CLOSED', expectedVersion: 4 })
      .expect(400)
      .expect(({ body }) =>
        expect(body.message).toBe('La investigación profesional debe estar completada.'),
      );
    const queue = await api(owner.token, orgA).get('/work-queue?module=INCIDENTS').expect(200);
    expect(queue.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'INCIDENT_INVESTIGATION',
          sourceId: incidentId,
          deepLink: `/app/incidents/${incidentId}`,
        }),
        expect.objectContaining({
          type: 'INCIDENT_ACTION',
          sourceId: actionId,
          overdue: true,
          deepLink: `/app/incidents/${incidentId}?action=${actionId}`,
        }),
      ]),
    );

    await api(technician.token, orgA)
      .post(`/incidents/${incidentId}/investigation/complete`)
      .send({ summary: 'Revisión técnica terminada.', expectedVersion: 1 })
      .expect(403);
    await api(manager.token, orgA)
      .post(`/incidents/${incidentId}/investigation/complete`)
      .send({
        summary: 'Se documentaron condiciones observadas y se definió seguimiento preventivo.',
        expectedVersion: 1,
      })
      .expect(201);
    await api(manager.token, orgA)
      .post(`/incidents/${incidentId}/close`)
      .send({ status: 'CLOSED', expectedVersion: 4 })
      .expect(400)
      .expect(({ body }) =>
        expect(body.message).toBe('Todas las acciones no canceladas deben estar verificadas.'),
      );
    await api(owner.token, orgA)
      .get(`/incidents/${incidentId}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body.investigation).toMatchObject({
          status: 'COMPLETED',
          summary: 'Se documentaron condiciones observadas y se definió seguimiento preventivo.',
          completedBy: { id: manager.userId },
        }),
      );

    await api(technician.token, orgA)
      .post(`/incidents/${incidentId}/actions/${actionId}/transition`)
      .send({ status: 'IN_PROGRESS', expectedVersion: 1 })
      .expect(201);
    await api(technician.token, orgA)
      .post(`/incidents/${incidentId}/actions/${actionId}/transition`)
      .send({ status: 'PENDING_VERIFICATION', expectedVersion: 2 })
      .expect(201);
    await api(manager.token, orgA)
      .post(`/incidents/${incidentId}/actions/${actionId}/verify`)
      .send({ note: 'Intento sin evidencia.', expectedVersion: 3 })
      .expect(400);
    await api(technician.token, orgA)
      .post(`/incidents/${incidentId}/evidence`)
      .send({
        scope: 'ACTION',
        type: 'EXTERNAL_LINK',
        incidentActionId: actionId,
        externalUrl: 'https://evidence.example.test/action-control',
      })
      .expect(201);
    await api(manager.token, orgA)
      .post(`/incidents/${incidentId}/actions/${actionId}/verify`)
      .send({ note: 'Control verificado en la operación.', expectedVersion: 3 })
      .expect(201);

    const closed = await api(manager.token, orgA)
      .post(`/incidents/${incidentId}/close`)
      .send({ status: 'CLOSED', expectedVersion: 4 })
      .expect(201);
    expect(closed.body).toMatchObject({ status: 'CLOSED', version: 5 });
    expect(closed.body.involvedWorkers[0].worker).toMatchObject({ id: worker.id });
    expect(closed.body.contributingFactors).toHaveLength(1);
    expect(closed.body.evidence).toHaveLength(1);
    expect(closed.body.actions[0].evidence).toHaveLength(1);
    await api(manager.token, orgA)
      .post(`/incidents/${incidentId}/actions`)
      .send({ title: 'Acción tardía' })
      .expect(400);

    const analytics = await api(owner.token, orgA).get('/incidents/analytics/summary').expect(200);
    expect(analytics.body).toMatchObject({ total: 1, nearMisses: 1 });
    expect(analytics.body.byWorkCenter).toEqual(
      expect.arrayContaining([expect.objectContaining({ workCenterId: centerA.id, count: 1 })]),
    );
    expect(
      await prisma.auditLog.count({
        where: { organizationId: orgA, entityType: 'Incident', entityId: incidentId },
      }),
    ).toBeGreaterThanOrEqual(10);
  });
});
