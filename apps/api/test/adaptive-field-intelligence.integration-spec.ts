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
    await prisma.organization.update({
      where: { id: organizationId },
      data: { demoExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
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
    const profileResponse = await a
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
              key: 'WORK_AREAS_PRESENT',
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

    await a
      .post('/applicability/profile-versions')
      .send({
        hasPhysicalSite: true,
        facts: [
          {
            key: 'PHYSICAL_SITE_PRESENT',
            value: 'KNOWN_FALSE',
            scope: 'ORGANIZATION',
            provenance: { source: 'DECLARED_BY_ORGANIZATION' },
          },
        ],
      })
      .expect(400);
    await a
      .post('/applicability/profile-versions')
      .send({
        hasPhysicalSite: false,
        facts: [
          {
            key: 'PHYSICAL_SITE_PRESENT',
            value: 'KNOWN_TRUE',
            scope: 'ORGANIZATION',
            provenance: { source: 'DECLARED_BY_ORGANIZATION' },
          },
        ],
      })
      .expect(400);
    await a
      .post('/applicability/profile-versions')
      .send({
        facts: [
          {
            key: 'WORK_AREAS_PRESENT',
            value: 'KNOWN_FALSE',
            scope: 'ORGANIZATION',
            provenance: { source: 'DECLARED_BY_ORGANIZATION' },
          },
        ],
      })
      .expect(400);
    await a
      .post('/applicability/profile-versions')
      .send({
        facts: [
          {
            key: 'PHYSICAL_SITE_PRESENT',
            value: 'KNOWN_TRUE',
            scope: 'ORGANIZATION',
            provenance: { source: 'DERIVED_DETERMINISTICALLY' },
          },
        ],
      })
      .expect(400);
    await a
      .post('/applicability/profile-versions')
      .send({
        hasPhysicalSite: true,
        facts: [
          {
            key: 'PHYSICAL_SITE_PRESENT',
            value: 'KNOWN_TRUE',
            scope: 'ORGANIZATION',
            provenance: { source: 'DECLARED_BY_ORGANIZATION' },
          },
        ],
      })
      .expect(201)
      .expect(({ body }) => {
        expect(
          body.snapshot.contextFacts.filter(
            ({ key }: { key: string }) => key === 'PHYSICAL_SITE_PRESENT',
          ),
        ).toHaveLength(1);
      });
    const observationA = await prisma.safetyObservation.create({
      data: {
        organizationId: a.organizationId,
        title: 'Observación para perfil',
        description: 'Evidencia canónica sintética.',
        category: 'OTHER',
        workCenterId: a.center.id,
        observedAt: new Date(),
        reportedById: a.user.id,
      },
    });
    const evidenceA = await prisma.safetyObservationEvidence.create({
      data: {
        organizationId: a.organizationId,
        safetyObservationId: observationA.id,
        type: 'NOTE',
        note: 'Evidencia sintética.',
        createdById: a.user.id,
      },
    });
    const evidenceBackedFact = (evidenceId: string) => ({
      facts: [
        {
          key: 'PROCESS_ACTIVITY_FAMILIES_CONFIRMED',
          value: 'KNOWN_TRUE',
          scope: 'ORGANIZATION',
          provenance: {
            source: 'EVIDENCE_BACKED',
            evidenceReference: { type: 'SAFETY_OBSERVATION_EVIDENCE', id: evidenceId },
          },
        },
      ],
    });
    await a
      .post('/applicability/profile-versions')
      .send({
        facts: [
          {
            key: 'PROCESS_ACTIVITY_FAMILIES_CONFIRMED',
            value: 'KNOWN_TRUE',
            scope: 'ORGANIZATION',
            provenance: { source: 'EVIDENCE_BACKED', evidenceReference: 'not-structured' },
          },
        ],
      })
      .expect(400);
    await a
      .post('/applicability/profile-versions')
      .send(evidenceBackedFact(evidenceA.id))
      .expect(201)
      .expect(({ body }) => {
        expect(body.snapshot.contextFacts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              provenance: {
                source: 'EVIDENCE_BACKED',
                evidenceReference: {
                  type: 'SAFETY_OBSERVATION_EVIDENCE',
                  id: evidenceA.id,
                  label: expect.stringContaining('Evidencia de observación'),
                },
              },
            }),
          ]),
        );
      });
    const viewer = await prisma.user.create({
      data: {
        email: `profile-viewer-${suffix}@example.test`,
        displayName: 'Profile viewer',
        passwordHash: 'fixture-not-login',
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: a.organizationId,
        userId: viewer.id,
        role: 'VIEWER',
        status: 'ACTIVE',
      },
    });
    const viewerToken = await jwt.signAsync({ id: viewer.id, sub: viewer.id, email: viewer.email });
    await request(app.getHttpServer())
      .post('/api/v1/applicability/profile-versions')
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-organization-id', a.organizationId)
      .send({
        facts: [
          {
            key: 'ECONOMIC_ACTIVITY_CONFIRMED',
            value: 'KNOWN_TRUE',
            scope: 'ORGANIZATION',
            provenance: { source: 'PROFESSIONAL_CONFIRMED' },
          },
        ],
      })
      .expect(403);
    await b
      .post('/applicability/profile-versions')
      .send(evidenceBackedFact(evidenceA.id))
      .expect(404);
    await a
      .post('/applicability/profile-versions')
      .send(evidenceBackedFact('30000000-0000-4000-8000-000000000099'))
      .expect(404);
    await a
      .post('/applicability/profile-versions')
      .send({
        facts: [
          {
            key: 'ECONOMIC_ACTIVITY_CONFIRMED',
            value: 'KNOWN_TRUE',
            scope: 'ORGANIZATION',
            provenance: { source: 'PROFESSIONAL_CONFIRMED', note: 'Confirmación sintética.' },
          },
        ],
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.snapshot.contextFacts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              provenance: expect.objectContaining({
                source: 'PROFESSIONAL_CONFIRMED',
                actorUserId: a.user.id,
                confirmedAt: expect.any(String),
              }),
            }),
          ]),
        );
      });

    const method = await prisma.riskMethodVersion.findFirstOrThrow({
      where: { publicationStatus: 'PUBLISHED' },
    });
    await a
      .post('/inspections')
      .send({
        workCenterId: a.center.id,
        riskMethodVersionId: method.id,
        title: 'Inspección sin profundidad',
      })
      .expect(400);
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

    for (const depth of ['BASIC', 'TECHNICAL'] as const) {
      await a
        .post('/inspections')
        .send({
          workCenterId: a.center.id,
          riskMethodVersionId: method.id,
          inspectionDepth: depth,
          title: `Inspección profundidad ${depth}`,
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            inspectionDepth: depth,
            inspectionDepthVersion: '1.0.0',
            inspectionDepthSnapshot: { depth, version: '1.0.0' },
          });
        });
    }

    const evaluation = await a
      .post('/unified-sst-evaluations')
      .send({ profileVersionId: profileResponse.body.id })
      .expect(201);
    const realGap = await a
      .post('/adaptive-intelligence/gap-analyses')
      .send({ sourceType: 'UNIFIED_SST_EVALUATION', sourceId: evaluation.body.id })
      .expect(201);
    expect(realGap.body).toMatchObject({
      sourceType: 'UNIFIED_SST_EVALUATION',
      sourceId: evaluation.body.id,
      inputHash: expect.stringMatching(/^sha256:/),
      outputHash: expect.stringMatching(/^sha256:/),
      items: expect.any(Array),
    });
    await b
      .post('/adaptive-intelligence/gap-analyses')
      .send({ sourceType: 'UNIFIED_SST_EVALUATION', sourceId: evaluation.body.id })
      .expect(404);

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
        version: 2,
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

    const informational = await prisma.organizationGapAnalysis.create({
      data: {
        organizationId: a.organizationId,
        version: 99,
        sourceType: 'ADAPTIVE_CONFIGURATION',
        sourceId: '10000000-0000-4000-8000-000000000002',
        inputHash: `sha256:${'c'.repeat(64)}`,
        outputHash: `sha256:${'d'.repeat(64)}`,
        items: [{ ...gapItem, key: `${gapItem.key}:info`, type: 'IMPLEMENTED_EVIDENCE_AVAILABLE' }],
        createdById: a.user.id,
      },
    });
    await a
      .post(`/adaptive-intelligence/gap-analyses/${informational.id}/plan-draft`)
      .send({
        selectedItemKeys: [`${gapItem.key}:info`],
        name: 'No debe crearse',
        periodStart: '2026-09-08',
        periodEnd: '2026-12-08',
      })
      .expect(400);
  }, 20_000);

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
    const method = await prisma.riskMethodVersion.findFirstOrThrow({
      where: { publicationStatus: 'PUBLISHED' },
    });
    await prisma.inspection.create({
      data: {
        organizationId: a.organizationId,
        workCenterId: a.center.id,
        title: 'Inspección entitlement sentinel',
        inspectorUserId: a.user.id,
        riskMethodVersionId: method.id,
        riskMethodSnapshot: {},
        inspectionDepth: 'BASIC',
        inspectionDepthVersion: '1.0.0',
        inspectionDepthSnapshot: { depth: 'BASIC', version: '1.0.0' },
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
    const inspectionModule = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'INSPECTIONS_INTELLIGENCE' },
    });
    await prisma.organizationModule.update({
      where: {
        organizationId_moduleId: {
          organizationId: a.organizationId,
          moduleId: inspectionModule.id,
        },
      },
      data: { status: 'SUSPENDED' },
    });
    await a
      .get('/operational-search?q=entitlement&types=INSPECTION,FINDING,ACTION')
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ items: [], total: 0 }));
    await prisma.organizationModule.update({
      where: {
        organizationId_moduleId: {
          organizationId: a.organizationId,
          moduleId: inspectionModule.id,
        },
      },
      data: { status: 'ACTIVE' },
    });
    await a
      .get('/operational-search?q=entitlement&types=INSPECTION')
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([
          expect.objectContaining({
            type: 'INSPECTION',
            navigationKind: 'DETAIL',
            ctaLabel: 'Abrir registro',
          }),
        ]);
      });
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
          category: index === 0 ? 'ELECTRICAL' : 'ERGONOMIC',
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
      .get(
        `/management-intelligence/summary?workCenterId=${a.center.id}&findingCategory=ELECTRICAL`,
      )
      .expect(200);
    expect(summary.body.riskMethods).toEqual([
      expect.objectContaining({
        methodVersionId: methods[0]!.id,
        initialCount: 1,
        residualCount: 0,
      }),
    ]);
    expect(summary.body.mixedMethodComparison.comparable).toBe(true);
    const outsideDate = await a
      .get(
        `/management-intelligence/summary?findingCategory=ELECTRICAL&dateFrom=2100-01-01T00:00:00.000Z`,
      )
      .expect(200);
    expect(outsideDate.body.riskMethods).toEqual([]);
    expect(summary.body.filterScope.findingCategory).toContain('metodología');
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
    const inspectionModule = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'INSPECTIONS_INTELLIGENCE' },
    });
    await prisma.organizationModule.update({
      where: {
        organizationId_moduleId: {
          organizationId: a.organizationId,
          moduleId: inspectionModule.id,
        },
      },
      data: { status: 'SUSPENDED' },
    });
    await a
      .get('/management-intelligence/summary?findingCategory=ELECTRICAL')
      .expect(200)
      .expect(({ body }) => {
        expect(body.counts.findings).toEqual([]);
        expect(body.riskMethods).toEqual([]);
        expect(body.unavailableDomains).toContain('INSPECTIONS');
      });
  });

  it('recovers optional observation evidence without creating a second observation', async () => {
    const a = await fixture('field-evidence');
    const observation = await a
      .post('/safety-observations')
      .send({
        title: 'Observación única en campo',
        description: 'Registro sintético para probar recuperación de evidencia.',
        category: 'UNSAFE_CONDITION',
        workCenterId: a.center.id,
        observedAt: new Date().toISOString(),
        priority: 'MEDIUM',
      })
      .expect(201);
    await a
      .post(`/safety-observations/${observation.body.id}/evidence`)
      .send({ type: 'EXTERNAL_LINK', externalUrl: 'http://invalid.example.test/evidence' })
      .expect(400);
    expect(
      await prisma.safetyObservation.count({
        where: { organizationId: a.organizationId, title: 'Observación única en campo' },
      }),
    ).toBe(1);
    expect(
      await prisma.safetyObservationEvidence.count({
        where: { organizationId: a.organizationId, safetyObservationId: observation.body.id },
      }),
    ).toBe(0);
    await a
      .post(`/safety-observations/${observation.body.id}/evidence`)
      .send({ type: 'NOTE', note: 'Evidencia recuperada sin reenviar la observación.' })
      .expect(201);
    expect(
      await prisma.safetyObservation.count({
        where: { organizationId: a.organizationId, title: 'Observación única en campo' },
      }),
    ).toBe(1);
    expect(
      await prisma.safetyObservationEvidence.count({
        where: { organizationId: a.organizationId, safetyObservationId: observation.body.id },
      }),
    ).toBe(1);
  });
});
