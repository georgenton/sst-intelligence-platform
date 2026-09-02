import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { type Test as SuperTestRequest } from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('operational intelligence integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
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
  });

  afterAll(async () => app.close());

  async function register(label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `${label.toLowerCase().replaceAll(' ', '-')}-${suffix}@example.test`,
        displayName: label,
        password: 'operational-intelligence-password-123',
      })
      .expect(201);
    return { token: response.body.accessToken as string, userId: response.body.user.id as string };
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
    const headers = <T extends SuperTestRequest>(operation: T) =>
      operation.set('Authorization', `Bearer ${token}`).set('x-organization-id', organizationId);
    return {
      get: (path: string) => headers(request(app.getHttpServer()).get(`/api/v1${path}`)),
      post: (path: string) => headers(request(app.getHttpServer()).post(`/api/v1${path}`)),
    };
  }

  it('derives explainable tenant signals and never produces a worker score', async () => {
    const owner = await register('Intelligence Owner');
    const viewer = await register('Intelligence Viewer');
    const outsider = await register('Intelligence Outsider');
    const orgA = await organization(owner.token, 'Intelligence A');
    const orgB = await organization(owner.token, 'Intelligence B');
    await prisma.membership.create({
      data: { organizationId: orgA, userId: viewer.userId, role: 'VIEWER', status: 'ACTIVE' },
    });
    await prisma.membership.create({
      data: { organizationId: orgB, userId: outsider.userId, role: 'ORG_ADMIN', status: 'ACTIVE' },
    });
    const center = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgA } });
    const worker = await prisma.worker.create({
      data: {
        organizationId: orgA,
        workCenterId: center.id,
        displayName: 'Trabajador de hechos',
        status: 'ACTIVE',
        createdById: owner.userId,
      },
    });
    const inspection = await prisma.inspection.create({
      data: {
        organizationId: orgA,
        workCenterId: center.id,
        title: 'Inspección para señales',
        inspectorUserId: owner.userId,
        riskMethodSnapshot: { key: 'DEMO_5X5', version: '1.0.0' },
      },
    });
    const createdAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const dueAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const findingIds: string[] = [];
    const correctiveActionIds: string[] = [];
    for (const [index, category] of [
      'Orden y limpieza',
      'orden  y limpieza',
      'ORDEN Y LIMPIEZA',
    ].entries()) {
      const finding = await prisma.inspectionFinding.create({
        data: {
          organizationId: orgA,
          inspectionId: inspection.id,
          workCenterId: center.id,
          category,
          title: `Hallazgo recurrente ${index + 1}`,
          description: 'Fixture canónico para evaluación determinista.',
          riskMethodKey: 'DEMO_5X5',
          riskMethodVersion: '1.0.0',
          riskMethodSnapshot: { key: 'DEMO_5X5', version: '1.0.0' },
          initialMethodInput: { likelihood: 2, consequence: 2 },
          initialMethodResult: { score: 4, level: 'LOW' },
          createdById: owner.userId,
          createdAt,
        },
      });
      findingIds.push(finding.id);
      const correctiveAction = await prisma.correctiveAction.create({
        data: {
          organizationId: orgA,
          findingId: finding.id,
          title: `Acción vencida ${index + 1}`,
          status: 'OPEN',
          priority: 'MEDIUM',
          dueAt,
          createdById: owner.userId,
          createdAt,
        },
      });
      correctiveActionIds.push(correctiveAction.id);
    }
    const ownerApi = api(owner.token, orgA);

    await api(viewer.token, orgA).post('/operational-intelligence/signals/evaluate').expect(403);
    await api(outsider.token, orgA).get('/operational-intelligence/signals').expect(403);
    expect(
      (await api(owner.token, orgB).get('/operational-intelligence/signals').expect(200)).body,
    ).toEqual([]);

    const first = await ownerApi.post('/operational-intelligence/signals/evaluate').expect(201);
    expect(first.body.count).toBe(2);
    expect(first.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'REPEATED_FINDING',
          threshold: 3,
          observedCount: 3,
          status: 'ACTIVE',
        }),
        expect.objectContaining({
          type: 'OVERDUE_ACTION_CLUSTER',
          threshold: 3,
          observedCount: 3,
          status: 'ACTIVE',
        }),
      ]),
    );
    const firstIdentity = first.body.items
      .map((item: { id: string; type: string; fingerprint: string; sourceDigest: string }) => ({
        id: item.id,
        type: item.type,
        fingerprint: item.fingerprint,
        sourceDigest: item.sourceDigest,
      }))
      .sort((left: { type: string }, right: { type: string }) =>
        left.type.localeCompare(right.type),
      );
    const second = await ownerApi.post('/operational-intelligence/signals/evaluate').expect(201);
    const secondIdentity = second.body.items
      .map((item: { id: string; type: string; fingerprint: string; sourceDigest: string }) => ({
        id: item.id,
        type: item.type,
        fingerprint: item.fingerprint,
        sourceDigest: item.sourceDigest,
      }))
      .sort((left: { type: string }, right: { type: string }) =>
        left.type.localeCompare(right.type),
      );
    expect(secondIdentity).toEqual(firstIdentity);

    const concurrent = await Promise.all([
      ownerApi.post('/operational-intelligence/signals/evaluate').expect(201),
      ownerApi.post('/operational-intelligence/signals/evaluate').expect(201),
    ]);
    expect(concurrent.map(({ body }) => body.count)).toEqual([2, 2]);
    expect(
      await prisma.operationalSignal.count({
        where: { organizationId: orgA, status: 'ACTIVE' },
      }),
    ).toBe(2);

    const signals = await ownerApi.get('/operational-intelligence/signals').expect(200);
    const repeated = signals.body.find(
      (signal: { type: string }) => signal.type === 'REPEATED_FINDING',
    );
    expect(repeated.explanation).toContain('no identifica causa raíz');
    expect(repeated.sourceRecords).toHaveLength(3);
    const queue = await ownerApi.get('/work-queue?module=INTELLIGENCE&pageSize=100').expect(200);
    expect(queue.body.items).toHaveLength(2);
    expect(queue.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'OPERATIONAL_SIGNAL',
          deepLink: expect.stringMatching(/^\/app\/intelligence\?signal=/),
        }),
      ]),
    );
    expect(new Set(queue.body.items.map((item: { sourceId: string }) => item.sourceId)).size).toBe(
      queue.body.items.length,
    );

    const additionalAction = await prisma.correctiveAction.create({
      data: {
        organizationId: orgA,
        findingId: findingIds[0]!,
        title: 'Acción vencida adicional',
        status: 'OPEN',
        priority: 'MEDIUM',
        dueAt,
        createdById: owner.userId,
        createdAt,
      },
    });
    correctiveActionIds.push(additionalAction.id);
    await ownerApi.post('/operational-intelligence/signals/evaluate').expect(201);
    const updatedOverdue = await prisma.operationalSignal.findFirstOrThrow({
      where: { organizationId: orgA, type: 'OVERDUE_ACTION_CLUSTER' },
    });
    expect(updatedOverdue.id).toBe(
      first.body.items.find((item: { type: string }) => item.type === 'OVERDUE_ACTION_CLUSTER').id,
    );
    expect(updatedOverdue.observedCount).toBe(4);
    expect(updatedOverdue.sourceRecords).toHaveLength(4);

    await prisma.correctiveAction.updateMany({
      where: { id: { in: correctiveActionIds.slice(0, 2) } },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    await ownerApi.post('/operational-intelligence/signals/evaluate').expect(201);
    const closedOverdue = await prisma.operationalSignal.findUniqueOrThrow({
      where: { id: updatedOverdue.id },
    });
    expect(closedOverdue).toMatchObject({ status: 'CLOSED', observedCount: 4 });
    expect(closedOverdue.sourceRecords).toHaveLength(4);
    const queueAfterConditionCleared = await ownerApi
      .get('/work-queue?module=INTELLIGENCE&pageSize=100')
      .expect(200);
    expect(
      queueAfterConditionCleared.body.items.some(
        (item: { sourceId: string }) => item.sourceId === updatedOverdue.id,
      ),
    ).toBe(false);

    const currentRepeated = await prisma.operationalSignal.findUniqueOrThrow({
      where: { id: repeated.id as string },
    });
    await api(viewer.token, orgA)
      .post(`/operational-intelligence/signals/${repeated.id as string}/review`)
      .send({ expectedVersion: currentRepeated.version })
      .expect(403);
    await ownerApi
      .post(`/operational-intelligence/signals/${repeated.id as string}/review`)
      .send({
        expectedVersion: currentRepeated.version,
        note: 'Revisión profesional registrada.',
      })
      .expect(201);
    const queueAfterReview = await ownerApi
      .get('/work-queue?module=INTELLIGENCE&pageSize=100')
      .expect(200);
    expect(queueAfterReview.body.items).toHaveLength(0);

    const overview = await ownerApi
      .get(`/operational-intelligence/work-centers/${center.id}/overview`)
      .expect(200);
    expect(overview.body).toMatchObject({
      factualCounts: { inspections: 1, actions: 4 },
    });
    expect(overview.body.interpretation).toContain('no representan predicción');
    const facts = await ownerApi
      .get(`/operational-intelligence/workers/${worker.id}/facts`)
      .expect(200);
    expect(facts.body).toMatchObject({
      worker: { id: worker.id },
      workerSafetyScore: null,
      workerRating: null,
    });
    expect(facts.body.interpretation).toContain('no califican a la persona');
  });
});
