import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('adaptive field intelligence integration', () => {
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

  async function fixture(label: string) {
    const email = `${label}-${suffix}@example.test`;
    const user = await prisma.user.create({
      data: { email, displayName: label, passwordHash: 'fixture-not-login' },
    });
    const token = await jwt.signAsync({ id: user.id, sub: user.id, email });
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${label} ${suffix}`, country: 'Ecuador', sector: 'Servicios' })
      .expect(201);
    const organizationId = response.body.id as string;
    const center = await prisma.workCenter.findFirstOrThrow({ where: { organizationId } });
    const moduleDefinition = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'INSPECTIONS_INTELLIGENCE' },
    });
    await prisma.organizationModule.upsert({
      where: { organizationId_moduleId: { organizationId, moduleId: moduleDefinition.id } },
      update: { status: 'ACTIVE' },
      create: { organizationId, moduleId: moduleDefinition.id, status: 'ACTIVE', source: 'MANUAL' },
    });
    const api = (method: 'get' | 'post', path: string) => {
      const agent = request(app.getHttpServer());
      return agent[method](`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', organizationId);
    };
    return {
      user,
      token,
      organizationId,
      center,
      get: (path: string) => api('get', path),
      post: (path: string) => api('post', path),
    };
  }

  it('versions tri-state profile facts, depth and explicit gap-to-plan conversion without tenant leakage', async () => {
    const a = await fixture('adaptive-a');
    const b = await fixture('adaptive-b');
    await a
      .post('/applicability/profile-versions')
      .send({
        workerCount: 24,
        managementPriority: 'URGENT',
        hasPhysicalSite: true,
        hasContractorsOrExternalPersonnel: false,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.snapshot).toMatchObject({
          schemaVersion: '2.0.0',
          organization: { managementPriority: 'URGENT' },
        });
        expect(body.snapshot.contextFacts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              key: 'WORK_AREA_STRUCTURE_CONFIRMED',
              value: 'UNKNOWN',
              provenance: { source: 'DERIVED_DETERMINISTICALLY', note: expect.any(String) },
            }),
          ]),
        );
      });
    await a
      .post('/applicability/profile-versions')
      .send({
        facts: [
          {
            key: 'PHYSICAL_SITE_PRESENT',
            value: 'KNOWN_TRUE',
            scope: 'WORK_CENTER',
            workCenterId: b.center.id,
            provenance: { source: 'DECLARED_BY_ORGANIZATION' },
          },
        ],
      })
      .expect(404);

    const method = await prisma.riskMethodVersion.findFirstOrThrow({
      where: { publicationStatus: 'PUBLISHED' },
    });
    const inspection = await a
      .post('/inspections')
      .send({
        workCenterId: a.center.id,
        riskMethodVersionId: method.id,
        inspectionDepth: 'SYSTEMIC',
        title: 'Inspección profundidad sistémica',
      })
      .expect(201);
    expect(inspection.body).toMatchObject({
      inspectionDepth: 'SYSTEMIC',
      inspectionDepthVersion: '1.0.0',
      inspectionDepthSnapshot: { depth: 'SYSTEMIC', version: '1.0.0' },
    });

    const gapItem = {
      key: `ADAPTIVE_CONFIGURATION:10000000-0000-4000-8000-000000000001:20000000-0000-4000-8000-000000000001`,
      targetKey: 'CONTROL_DEMO',
      title: 'Completar control sintético',
      type: 'INFORMATION_REQUIRED',
      expectedState: 'RECOMMENDED',
      knownState: 'UNKNOWN',
      explanation: 'Falta información verificable.',
      workCenterId: a.center.id,
      evidenceReferences: [],
      source: {
        type: 'ADAPTIVE_CONFIGURATION',
        id: '10000000-0000-4000-8000-000000000001',
        itemId: '20000000-0000-4000-8000-000000000001',
      },
      professionalReviewRequired: false,
    };
    const analysis = await prisma.organizationGapAnalysis.create({
      data: {
        organizationId: a.organizationId,
        version: 1,
        sourceType: 'ADAPTIVE_CONFIGURATION',
        sourceId: '10000000-0000-4000-8000-000000000001',
        inputHash: `sha256:${'a'.repeat(64)}`,
        outputHash: `sha256:${'b'.repeat(64)}`,
        items: [gapItem],
        createdById: a.user.id,
      },
    });
    await b.get(`/adaptive-intelligence/gap-analyses/${analysis.id}`).expect(404);
    const plan = await a
      .post(`/adaptive-intelligence/gap-analyses/${analysis.id}/plan-draft`)
      .send({
        selectedItemKeys: [gapItem.key],
        name: 'Plan explícito desde brecha',
        periodStart: '2026-09-08',
        periodEnd: '2026-12-08',
      })
      .expect(201);
    expect(plan.body.versions[0]).toMatchObject({
      origin: 'DETERMINISTIC_DRAFT',
      items: [expect.objectContaining({ provenanceType: 'GAP_ANALYSIS' })],
    });
  });

  it('searches from tenant-scoped queries with filters, safe snippets, pagination and deterministic ordering', async () => {
    const a = await fixture('search-a');
    const b = await fixture('search-b');
    const timestamp = new Date('2026-09-08T12:00:00.000Z');
    const workerA1 = await prisma.worker.create({
      data: {
        organizationId: a.organizationId,
        displayName: 'Operador determinista Alpha',
        internalCode: 'DET-A',
        status: 'ACTIVE',
        workCenterId: a.center.id,
        createdById: a.user.id,
        updatedAt: timestamp,
      },
    });
    const workerA2 = await prisma.worker.create({
      data: {
        organizationId: a.organizationId,
        displayName: 'Operador determinista Beta',
        internalCode: 'DET-B',
        status: 'ACTIVE',
        workCenterId: a.center.id,
        createdById: a.user.id,
        updatedAt: timestamp,
      },
    });
    await prisma.worker.create({
      data: {
        organizationId: b.organizationId,
        displayName: 'Operador determinista secreto',
        internalCode: 'SECRET-B',
        status: 'ACTIVE',
        workCenterId: b.center.id,
        createdById: b.user.id,
        updatedAt: timestamp,
      },
    });
    const first = await a
      .get(
        `/operational-search?q=determinista&types=WORKER&workCenterId=${a.center.id}&page=1&pageSize=1`,
      )
      .expect(200);
    const second = await a
      .get(
        `/operational-search?q=determinista&types=WORKER&workCenterId=${a.center.id}&page=2&pageSize=1`,
      )
      .expect(200);
    expect(first.body.total).toBe(2);
    expect([first.body.items[0].id, second.body.items[0].id].sort()).toEqual(
      [workerA1.id, workerA2.id].sort(),
    );
    expect(JSON.stringify(first.body)).not.toContain('SECRET-B');
    expect(first.body.items[0]).toMatchObject({
      type: 'WORKER',
      workCenterId: a.center.id,
      deepLink: expect.stringContaining('/app/workers/'),
    });
    await a
      .get('/operational-search?q=zzzz-no-result&types=WORKER')
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ items: [], total: 0 }));
    const repeat = await a
      .get(`/operational-search?q=determinista&types=WORKER&page=1&pageSize=2`)
      .expect(200);
    const repeatAgain = await a
      .get(`/operational-search?q=determinista&types=WORKER&page=1&pageSize=2`)
      .expect(200);
    expect(repeatAgain.body.items.map(({ id }: { id: string }) => id)).toEqual(
      repeat.body.items.map(({ id }: { id: string }) => id),
    );
  });

  it('keeps management counts tenant-scoped and risk methods separated without worker rankings', async () => {
    const a = await fixture('analytics-a');
    const b = await fixture('analytics-b');
    const methods = await prisma.riskMethodVersion.findMany({
      take: 2,
      orderBy: { id: 'asc' },
      include: { methodDefinition: true },
    });
    expect(methods).toHaveLength(2);
    for (const [index, method] of methods.entries()) {
      const inspection = await prisma.inspection.create({
        data: {
          organizationId: a.organizationId,
          workCenterId: a.center.id,
          title: `Inspección analítica ${index}`,
          inspectorUserId: a.user.id,
          riskMethodVersionId: method.id,
          riskMethodSnapshot: {},
          inspectionDepth: index ? 'TECHNICAL' : 'BASIC',
          inspectionDepthVersion: '1.0.0',
          inspectionDepthSnapshot: { depth: index ? 'TECHNICAL' : 'BASIC', version: '1.0.0' },
        },
      });
      await prisma.inspectionFinding.create({
        data: {
          organizationId: a.organizationId,
          inspectionId: inspection.id,
          workCenterId: a.center.id,
          category: 'ELECTRICAL',
          title: `Hallazgo método ${index}`,
          description: 'Condición sintética para conteo.',
          riskMethodKey: method.methodDefinition.methodKey,
          riskMethodVersion: method.semanticVersion,
          riskMethodVersionId: method.id,
          riskMethodSnapshot: {},
          initialMethodInput: {},
          initialMethodResult: {},
          ...(index === 1
            ? {
                residualMethodVersionId: method.id,
                residualMethodInput: {},
                residualMethodResult: {},
                residualRiskLevel: 'LOW',
              }
            : {}),
          createdById: a.user.id,
        },
      });
    }
    await prisma.safetyObservation.create({
      data: {
        organizationId: b.organizationId,
        title: 'Dato ajeno',
        description: 'No debe agregarse.',
        category: 'OTHER',
        workCenterId: b.center.id,
        observedAt: new Date(),
        reportedById: b.user.id,
      },
    });
    const historicalBefore = await prisma.inspectionFinding.count({
      where: { organizationId: a.organizationId },
    });
    const summary = await a
      .get(`/management-intelligence/summary?workCenterId=${a.center.id}&category=ELECTRICAL`)
      .expect(200);
    expect(summary.body.riskMethods).toHaveLength(2);
    expect(
      summary.body.riskMethods.every((entry: { initialCount: number }) => entry.initialCount === 1),
    ).toBe(true);
    expect(
      summary.body.riskMethods
        .map((entry: { residualCount: number }) => entry.residualCount)
        .sort(),
    ).toEqual([0, 1]);
    expect(
      summary.body.riskMethods.find(
        (entry: { methodVersionId: string }) => entry.methodVersionId === methods[1]!.id,
      ),
    ).toMatchObject({ residualCount: 1, residualLevels: { LOW: 1 } });
    expect(summary.body.mixedMethodComparison.comparable).toBe(false);
    expect(summary.body.boundary).toMatchObject({
      workerRanking: false,
      businessPriorityDoesNotChangeScores: true,
    });
    expect(Object.keys(summary.body.counts)).not.toEqual(
      expect.arrayContaining(['workers', 'workerScores', 'leaderboard']),
    );
    expect(
      await prisma.inspectionFinding.count({ where: { organizationId: a.organizationId } }),
    ).toBe(historicalBefore);
    expect(JSON.stringify(summary.body)).not.toContain('Dato ajeno');
  });
});
