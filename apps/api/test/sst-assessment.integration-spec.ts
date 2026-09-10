import { createHash } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('canonical SST assessment integration', () => {
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

  async function user(label: string) {
    const email = `${label}-${suffix}@example.test`;
    const created = await prisma.user.create({
      data: { email, displayName: label, passwordHash: 'integration-fixture-not-for-login' },
    });
    return {
      id: created.id,
      token: await jwt.signAsync({ id: created.id, email, sub: created.id }),
    };
  }

  async function organization(token: string, label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${label} ${suffix}`, country: 'Ecuador', sector: 'Servicios' })
      .expect(201);
    return response.body.id as string;
  }

  function authenticated(token: string, organizationId: string) {
    const base = (method: 'get' | 'post' | 'patch', path: string) => {
      const client = request(app.getHttpServer());
      const pending =
        method === 'get'
          ? client.get(`/api/v1/sst-assessment${path}`)
          : method === 'patch'
            ? client.patch(`/api/v1/sst-assessment${path}`)
            : client.post(`/api/v1/sst-assessment${path}`);
      return pending
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', organizationId);
    };
    return {
      get: (path: string) => base('get', path),
      post: (path: string) => base('post', path),
      patch: (path: string) => base('patch', path),
    };
  }

  function publicSession(method: 'get' | 'post' | 'patch', id: string, token?: string) {
    const client = request(app.getHttpServer());
    const path = `/api/v1/sst-assessment/public/sessions/${id}`;
    const pending =
      method === 'get'
        ? client.get(path)
        : method === 'patch'
          ? client.patch(path)
          : client.post(path);
    return token ? pending.set('x-assessment-token', token) : pending;
  }

  const parityAnswers = [
    {
      factKey: 'organization.country',
      scopeKey: 'organization',
      answerState: 'KNOWN',
      value: 'Ecuador',
    },
    {
      factKey: 'organization.sector',
      scopeKey: 'organization',
      answerState: 'KNOWN',
      value: 'Servicios',
    },
    {
      factKey: 'organization.totalWorkerCount',
      scopeKey: 'organization',
      answerState: 'KNOWN',
      value: 48,
    },
    {
      factKey: 'workCenter.workArrangement',
      scopeKey: 'center:1',
      answerState: 'KNOWN',
      value: 'PHYSICAL',
    },
    {
      factKey: 'workCenter.hasChemicalProcesses',
      scopeKey: 'center:1',
      answerState: 'KNOWN',
      value: false,
    },
    {
      factKey: 'workCenter.hasHighEnergyOperations',
      scopeKey: 'center:1',
      answerState: 'EXPLICIT_UNKNOWN',
    },
    {
      factKey: 'workCenter.activityCategories',
      scopeKey: 'center:1',
      answerState: 'KNOWN',
      value: ['PRODUCTION', 'ADMINISTRATIVE_SERVICES'],
    },
    {
      factKey: 'workCenter.facilityTypes',
      scopeKey: 'center:1',
      answerState: 'KNOWN',
      value: ['PLANT', 'OFFICE'],
    },
    ...[
      'workCenter.hasDistinctOperationalZones',
      'workCenter.hasWorkAtHeight',
      'workCenter.hasConfinedSpaces',
      'workCenter.hasExternalWorkforce',
    ].map((factKey) => ({
      factKey,
      scopeKey: 'center:1',
      answerState: 'KNOWN',
      value: false,
    })),
  ];

  function readyAnswers(workCenterCount: number, includeCountry = false) {
    return [
      ...(includeCountry
        ? [
            {
              factKey: 'organization.country',
              scopeKey: 'organization',
              answerState: 'KNOWN',
              value: 'Ecuador',
            },
          ]
        : []),
      {
        factKey: 'organization.totalWorkerCount',
        scopeKey: 'organization',
        answerState: 'KNOWN',
        value: 48,
      },
      ...Array.from({ length: workCenterCount }, (_, index) => {
        const scopeKey = `center:${index + 1}`;
        return [
          {
            factKey: 'workCenter.workArrangement',
            scopeKey,
            answerState: 'KNOWN',
            value: 'PHYSICAL',
          },
          {
            factKey: 'workCenter.activityCategories',
            scopeKey,
            answerState: 'KNOWN',
            value: ['PRODUCTION'],
          },
          {
            factKey: 'workCenter.facilityTypes',
            scopeKey,
            answerState: 'KNOWN',
            value: ['PLANT'],
          },
          {
            factKey: 'workCenter.activityDescription',
            scopeKey,
            answerState: 'KNOWN',
            value: 'Operación industrial de prueba',
          },
          ...[
            'workCenter.hasDistinctOperationalZones',
            'workCenter.hasChemicalProcesses',
            'workCenter.hasHighEnergyOperations',
            'workCenter.hasWorkAtHeight',
            'workCenter.hasHotWork',
            'workCenter.hasElectricalWorkOrExposure',
            'workCenter.hasConfinedSpaces',
            'workCenter.hasExternalWorkforce',
            'workCenter.hasCriticalMachinery',
            'workCenter.hasDriversOrTransport',
            'workCenter.hasFireExposure',
          ].map((factKey) => ({
            factKey,
            scopeKey,
            answerState: 'KNOWN',
            value: false,
          })),
        ];
      }).flat(),
    ];
  }

  it('protects public sessions with a hashed token, typed answers, expiry and optimistic revision', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/sst-assessment/public/sessions')
      .send({ workCenterCount: 2 })
      .expect(201);
    const id = created.body.id as string;
    const token = created.body.publicToken as string;
    expect(token).toHaveLength(43);
    expect(created.body).not.toHaveProperty('publicTokenHash');

    const stored = await prisma.sstAssessmentSession.findUniqueOrThrow({ where: { id } });
    expect(stored.publicTokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(token);
    await publicSession('get', id).expect(403);
    await publicSession('get', id, `${token}x`).expect(403);

    await publicSession('post', `${id}/answers`, token)
      .send({
        expectedSessionRevision: 0,
        answers: [
          {
            factKey: 'unknown.fact',
            scopeKey: 'organization',
            answerState: 'KNOWN',
            value: true,
          },
        ],
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_ANSWER_INVALID'));
    await publicSession('post', `${id}/answers`, token)
      .send({
        expectedSessionRevision: 0,
        answers: [
          {
            factKey: 'workCenter.hasChemicalProcesses',
            scopeKey: 'center:3',
            answerState: 'KNOWN',
            value: true,
          },
        ],
      })
      .expect(400);
    await publicSession('post', `${id}/answers`, token)
      .send({
        expectedSessionRevision: 0,
        answers: [
          {
            factKey: 'workCenter.hasChemicalProcesses',
            scopeKey: 'center:1',
            answerState: 'KNOWN',
            value: 'false',
          },
        ],
      })
      .expect(400);
    await publicSession('post', `${id}/answers`, token)
      .send({
        expectedSessionRevision: 0,
        answers: [
          {
            factKey: 'organization.workCenterCount',
            scopeKey: 'organization',
            answerState: 'KNOWN',
            value: 1,
          },
        ],
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_SERVER_FACT_READ_ONLY'));

    const saved = await publicSession('post', `${id}/answers`, token)
      .send({
        expectedSessionRevision: 0,
        answers: [
          {
            factKey: 'workCenter.hasChemicalProcesses',
            scopeKey: 'center:1',
            answerState: 'KNOWN',
            value: false,
          },
          {
            factKey: 'workCenter.hasChemicalProcesses',
            scopeKey: 'center:2',
            answerState: 'EXPLICIT_UNKNOWN',
          },
        ],
      })
      .expect(201);
    expect(saved.body.sessionRevision).toBe(1);
    expect(saved.body.snapshot.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scopeKey: 'center:1', answerState: 'KNOWN', value: false }),
        expect.objectContaining({ scopeKey: 'center:2', answerState: 'EXPLICIT_UNKNOWN' }),
      ]),
    );
    expect(saved.body.questions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scopeKey: 'center:2',
          factKey: 'workCenter.hasChemicalProcesses',
        }),
      ]),
    );
    await publicSession('post', `${id}/answers`, token)
      .send({ expectedSessionRevision: 0, answers: [] })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_REVISION_CONFLICT'));

    await prisma.sstAssessmentSession.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await publicSession('get', id, token).expect(403);
  });

  it('keeps public and authenticated evaluation semantics identical without manual pack/profile ids', async () => {
    const owner = await user('assessment-parity-owner');
    const organizationId = await organization(owner.token, 'Assessment parity');
    const publicCreated = await request(app.getHttpServer())
      .post('/api/v1/sst-assessment/public/sessions')
      .send({ workCenterCount: 1 })
      .expect(201);
    const publicToken = publicCreated.body.publicToken as string;
    const publicId = publicCreated.body.id as string;
    const publicSaved = await publicSession('post', `${publicId}/answers`, publicToken)
      .send({ expectedSessionRevision: 0, answers: parityAnswers })
      .expect(201);
    const publicEvaluated = await publicSession('post', `${publicId}/evaluate`, publicToken)
      .send({ expectedSessionRevision: publicSaved.body.sessionRevision })
      .expect(201);

    const authCreated = await authenticated(owner.token, organizationId)
      .post('/sessions')
      .send({})
      .expect(201);
    expect(authCreated.body).not.toHaveProperty('rulePackVersionId');
    expect(authCreated.body).not.toHaveProperty('profileVersionId', expect.any(String));
    const authSaved = await authenticated(owner.token, organizationId)
      .post(`/sessions/${authCreated.body.id as string}/answers`)
      .send({
        expectedSessionRevision: 0,
        answers: parityAnswers.filter(
          ({ factKey }) => !['organization.country', 'organization.sector'].includes(factKey),
        ),
      })
      .expect(201);
    const authEvaluated = await authenticated(owner.token, organizationId)
      .post(`/sessions/${authCreated.body.id as string}/evaluate`)
      .send({ expectedSessionRevision: authSaved.body.sessionRevision })
      .expect(201);

    expect(authEvaluated.body.result.semanticInputHash).toBe(
      publicEvaluated.body.result.semanticInputHash,
    );
    expect(authEvaluated.body.result.semanticOutputHash).toBe(
      publicEvaluated.body.result.semanticOutputHash,
    );
    expect(authEvaluated.body.result.items).toEqual(publicEvaluated.body.result.items);
    expect(authEvaluated.body.result.specialistTraces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          specialist: 'ADAPTIVE_CONFIGURATION',
          packKey: 'DEMO_ADAPTIVE_SST_CONFIGURATION',
          packVersion: expect.any(String),
          packContentHash: expect.stringMatching(/^sha256:/),
        }),
        expect.objectContaining({
          specialist: 'REGULATORY_CANDIDATE',
          packKey: 'MDT_2024_196_ARTICLES_18_19_SHADOW',
          packVersion: '1.0.0',
          packContentHash: expect.stringMatching(/^sha256:/),
        }),
      ]),
    );
    expect(authEvaluated.body.result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          traces: expect.arrayContaining([
            expect.objectContaining({
              ruleKey: expect.any(String),
              ruleVersion: expect.any(String),
              predicates: expect.any(Array),
            }),
          ]),
        }),
      ]),
    );
    expect(authEvaluated.body.result.summary.disclaimer).toContain(
      'No acredita cumplimiento legal',
    );
    expect(authEvaluated.body.result.authoritiesPresent).toEqual(['CANDIDATE', 'DEMO']);
    expect(authEvaluated.body.result).not.toHaveProperty('authority');
  });

  it('keeps incomplete assessments collecting and blocks premature authenticated finalization', async () => {
    const owner = await user('assessment-readiness-owner');
    const organizationId = await organization(owner.token, 'Assessment readiness');
    const created = await authenticated(owner.token, organizationId)
      .post('/sessions')
      .send({})
      .expect(201);
    expect(created.body.status).toBe('COLLECTING_INFORMATION');
    expect(created.body.requiredActions).toEqual([]);
    await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/finalize`)
      .send({ expectedSessionRevision: 0 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_NOT_READY'));
    const evaluated = await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/evaluate`)
      .send({ expectedSessionRevision: 0 })
      .expect(201);
    expect(evaluated.body.status).toBe('COLLECTING_INFORMATION');
    expect(evaluated.body.questions.length).toBeGreaterThan(0);
  });

  it('uses declared Profile V2 headcount and scoped facts while preserving rich context on finalization', async () => {
    const owner = await user('assessment-profile-owner');
    const organizationId = await organization(owner.token, 'Assessment profile reuse');
    const primary = await prisma.workCenter.findFirstOrThrow({ where: { organizationId } });
    const secondary = await prisma.workCenter.create({
      data: { organizationId, name: `Zulu secondary ${suffix}`, city: 'Quito' },
    });
    await prisma.worker.createMany({
      data: Array.from({ length: 3 }, (_, index) => ({
        organizationId,
        displayName: `Registered ${index}`,
        internalCode: `assessment-${suffix}-${index}`,
        workCenterId: primary.id,
        createdById: owner.id,
      })),
    });
    const richSnapshot = {
      schemaVersion: '2.0.0',
      organization: {
        country: 'Ecuador',
        sector: 'Servicios',
        workCenterCount: 2,
        workerCount: 48,
        managementPriority: 'URGENT',
      },
      operations: { hasChemicalProcesses: true, hasHighEnergyOperations: false },
      contextFacts: [
        {
          key: 'CHEMICAL_PROCESS_PRESENT',
          value: 'KNOWN_TRUE',
          scope: 'WORK_CENTER',
          workCenterId: primary.id,
          provenance: { source: 'DECLARED_BY_ORGANIZATION' },
        },
        {
          key: 'CHEMICAL_PROCESS_PRESENT',
          value: 'KNOWN_FALSE',
          scope: 'WORK_CENTER',
          workCenterId: secondary.id,
          provenance: { source: 'IMPORTED_REFERENCE', note: 'Importación validada.' },
        },
        {
          key: 'PHYSICAL_SITE_PRESENT',
          value: 'KNOWN_TRUE',
          scope: 'ORGANIZATION',
          provenance: { source: 'IMPORTED_REFERENCE', note: 'Registro histórico.' },
        },
        {
          key: 'PROCESS_ACTIVITY_FAMILIES_CONFIRMED',
          value: 'KNOWN_TRUE',
          scope: 'ORGANIZATION',
          provenance: {
            source: 'PROFESSIONAL_CONFIRMED',
            actorUserId: owner.id,
            confirmedAt: new Date().toISOString(),
          },
        },
      ],
    };
    const prior = await prisma.organizationSstProfileVersion.create({
      data: {
        organizationId,
        version: 1,
        createdById: owner.id,
        snapshot: richSnapshot,
      },
    });
    const created = await authenticated(owner.token, organizationId)
      .post('/sessions')
      .send({})
      .expect(201);
    const canonicalFacts = created.body.snapshot.facts as Array<{
      factKey: string;
      scopeKey: string;
      value?: unknown;
    }>;
    expect(canonicalFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factKey: 'organization.totalWorkerCount',
          value: 48,
        }),
      ]),
    );
    expect(canonicalFacts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ factKey: 'organization.totalWorkerCount', value: 3 }),
      ]),
    );
    const primaryScope = created.body.snapshot.scopes.find(
      ({ workCenterId }: { workCenterId?: string }) => workCenterId === primary.id,
    ).scopeKey as string;
    const secondaryScope = created.body.snapshot.scopes.find(
      ({ workCenterId }: { workCenterId?: string }) => workCenterId === secondary.id,
    ).scopeKey as string;
    expect(canonicalFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factKey: 'workCenter.hasChemicalProcesses',
          scopeKey: primaryScope,
          value: true,
        }),
        expect.objectContaining({
          factKey: 'workCenter.hasChemicalProcesses',
          scopeKey: secondaryScope,
          value: false,
        }),
      ]),
    );
    const answers = readyAnswers(2)
      .filter(
        ({ factKey }) =>
          factKey !== 'organization.totalWorkerCount' &&
          factKey !== 'workCenter.hasChemicalProcesses',
      )
      .map((answer) => ({
        ...answer,
        scopeKey: answer.scopeKey === 'center:1' ? primaryScope : secondaryScope,
      }));
    const saved = await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/answers`)
      .send({
        expectedSessionRevision: 0,
        answers: [
          ...answers,
          {
            factKey: 'workCenter.hasChemicalProcesses',
            scopeKey: primaryScope,
            answerState: 'KNOWN',
            value: false,
          },
        ],
      })
      .expect(201);
    const evaluated = await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/evaluate`)
      .send({ expectedSessionRevision: saved.body.sessionRevision })
      .expect(201);
    expect(evaluated.body.status).toBe('DIAGNOSIS_READY');
    const finalized = await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/finalize`)
      .send({ expectedSessionRevision: evaluated.body.sessionRevision })
      .expect(201);
    const latest = await prisma.organizationSstProfileVersion.findUniqueOrThrow({
      where: { id: finalized.body.profileVersionId as string },
    });
    expect(latest.id).not.toBe(prior.id);
    expect(latest.snapshot).toMatchObject({
      schemaVersion: '2.0.0',
      organization: { workerCount: 48, managementPriority: 'URGENT' },
      operations: { hasChemicalProcesses: true, hasHighEnergyOperations: false },
      contextFacts: expect.arrayContaining([
        expect.objectContaining({
          key: 'PHYSICAL_SITE_PRESENT',
          provenance: expect.objectContaining({ source: 'IMPORTED_REFERENCE' }),
        }),
        expect.objectContaining({
          key: 'PROCESS_ACTIVITY_FAMILIES_CONFIRMED',
          provenance: expect.objectContaining({ source: 'PROFESSIONAL_CONFIRMED' }),
        }),
        expect.objectContaining({
          key: 'CHEMICAL_PROCESS_PRESENT',
          workCenterId: primary.id,
          value: 'KNOWN_FALSE',
        }),
        expect.objectContaining({
          key: 'WORK_CENTER_CITY_CONFIRMED',
          value: 'UNKNOWN',
          provenance: expect.objectContaining({ source: 'DERIVED_DETERMINISTICALLY' }),
        }),
        expect.objectContaining({
          key: 'WORK_AREAS_PRESENT',
          value: 'UNKNOWN',
          provenance: expect.objectContaining({ source: 'DERIVED_DETERMINISTICALLY' }),
        }),
        expect.objectContaining({
          key: 'POSITIONS_PRESENT',
          value: 'UNKNOWN',
          provenance: expect.objectContaining({ source: 'DERIVED_DETERMINISTICALLY' }),
        }),
      ]),
    });
    expect(
      (await prisma.organizationSstProfileVersion.findUniqueOrThrow({ where: { id: prior.id } }))
        .snapshot,
    ).toEqual(richSnapshot);
  });

  it('enforces current tenant/role boundaries, scoped profile facts and immutable finalized history', async () => {
    const owner = await user('assessment-boundary-owner');
    const outsider = await user('assessment-boundary-outsider');
    const viewer = await user('assessment-boundary-viewer');
    const orgA = await organization(owner.token, 'Assessment boundary A');
    const orgB = await organization(outsider.token, 'Assessment boundary B');
    await prisma.membership.create({
      data: { organizationId: orgA, userId: viewer.id, role: 'VIEWER', status: 'ACTIVE' },
    });
    const center = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgA } });

    await authenticated(owner.token, orgA)
      .get('/setup-state')
      .expect(200)
      .expect(({ body }) => expect(body.state).toBe('NEEDS_ASSESSMENT'));

    await authenticated(viewer.token, orgA).post('/sessions').send({}).expect(403);
    const created = await authenticated(owner.token, orgA).post('/sessions').send({}).expect(201);
    const id = created.body.id as string;
    await authenticated(owner.token, orgB).get(`/sessions/${id}`).expect(403);
    await authenticated(outsider.token, orgB).get(`/sessions/${id}`).expect(404);
    await authenticated(viewer.token, orgA).get(`/sessions/${id}`).expect(200);
    await authenticated(viewer.token, orgA)
      .post(`/sessions/${id}/answers`)
      .send({ expectedSessionRevision: 0, answers: [] })
      .expect(403);

    const saved = await authenticated(owner.token, orgA)
      .post(`/sessions/${id}/answers`)
      .send({
        expectedSessionRevision: 0,
        answers: readyAnswers(1).map((answer) =>
          answer.factKey === 'workCenter.hasChemicalProcesses'
            ? { ...answer, value: true }
            : answer,
        ),
      })
      .expect(201);
    const evaluated = await authenticated(owner.token, orgA)
      .post(`/sessions/${id}/evaluate`)
      .send({ expectedSessionRevision: saved.body.sessionRevision })
      .expect(201);
    expect(evaluated.body.status).toBe('DIAGNOSIS_READY');
    const finalized = await authenticated(owner.token, orgA)
      .post(`/sessions/${id}/finalize`)
      .send({ expectedSessionRevision: evaluated.body.sessionRevision })
      .expect(201);
    expect(finalized.body).toMatchObject({ status: 'FINALIZED', sessionRevision: 3 });
    const profile = await prisma.organizationSstProfileVersion.findUniqueOrThrow({
      where: { id: finalized.body.profileVersionId as string },
    });
    expect(profile.snapshot).toMatchObject({ operations: {} });
    expect((profile.snapshot as { contextFacts: unknown[] }).contextFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'CHEMICAL_PROCESS_PRESENT',
          workCenterId: center.id,
          value: 'KNOWN_TRUE',
        }),
        expect.objectContaining({
          key: 'HIGH_ENERGY_OPERATION_PRESENT',
          workCenterId: center.id,
          value: 'KNOWN_FALSE',
        }),
      ]),
    );
    const duplicateAssessment = await authenticated(owner.token, orgA)
      .post('/sessions')
      .send({})
      .expect(201);
    const duplicateSaved = await authenticated(owner.token, orgA)
      .post(`/sessions/${duplicateAssessment.body.id as string}/answers`)
      .send({
        expectedSessionRevision: 0,
        answers: readyAnswers(1).map((answer) =>
          answer.factKey === 'workCenter.hasChemicalProcesses'
            ? { ...answer, value: true }
            : answer,
        ),
      })
      .expect(201);
    const duplicateEvaluated = await authenticated(owner.token, orgA)
      .post(`/sessions/${duplicateAssessment.body.id as string}/evaluate`)
      .send({ expectedSessionRevision: duplicateSaved.body.sessionRevision })
      .expect(201);
    const duplicateFinalized = await authenticated(owner.token, orgA)
      .post(`/sessions/${duplicateAssessment.body.id as string}/finalize`)
      .send({ expectedSessionRevision: duplicateEvaluated.body.sessionRevision })
      .expect(201);
    expect(duplicateFinalized.body.profileVersionId).toBe(profile.id);
    expect(
      await prisma.organizationSstProfileVersion.count({ where: { organizationId: orgA } }),
    ).toBe(1);
    await authenticated(owner.token, orgA)
      .post(`/sessions/${id}/answers`)
      .send({ expectedSessionRevision: 3, answers: [] })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_IMMUTABLE'));
    await authenticated(owner.token, orgA)
      .get('/setup-state')
      .expect(200)
      .expect(({ body }) => expect(body.state).toBe('DIAGNOSIS_READY'));

    const reassessment = await authenticated(owner.token, orgA)
      .post('/sessions')
      .send({ kind: 'REASSESSMENT', parentAssessmentId: id })
      .expect(201);
    expect(reassessment.body).toMatchObject({
      kind: 'REASSESSMENT',
      parentAssessmentId: id,
      status: 'COLLECTING_INFORMATION',
    });
    const storedParent = await prisma.sstAssessmentSession.findUniqueOrThrow({ where: { id } });
    expect(storedParent.status).toBe('FINALIZED');
    expect(
      await prisma.auditLog.findMany({
        where: {
          organizationId: orgA,
          entityId: id,
          action: {
            in: [
              'SST_ASSESSMENT_CREATED',
              'SST_ASSESSMENT_ANSWERS_SAVED',
              'SST_ASSESSMENT_EVALUATED',
              'SST_ASSESSMENT_FINALIZED',
            ],
          },
        },
        select: { action: true, actorUserId: true },
      }),
    ).toEqual(
      expect.arrayContaining(
        [
          'SST_ASSESSMENT_CREATED',
          'SST_ASSESSMENT_ANSWERS_SAVED',
          'SST_ASSESSMENT_EVALUATED',
          'SST_ASSESSMENT_FINALIZED',
        ].map((action) => ({ action, actorUserId: owner.id })),
      ),
    );
  });

  it('returns a derived organization action instead of an unanswerable sector question', async () => {
    const owner = await user('assessment-sector-owner');
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: `Assessment no sector ${suffix}`, country: 'Ecuador' })
      .expect(201);
    const created = await authenticated(owner.token, response.body.id as string)
      .post('/sessions')
      .send({})
      .expect(201);
    expect(created.body.questions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ factKey: 'organization.sector' })]),
    );
    expect(created.body.requiredActions).toEqual([
      expect.objectContaining({ code: 'ORGANIZATION_SECTOR_REQUIRED' }),
    ]);
  });

  it('fails closed when a persisted assessment catalog version is unsupported', async () => {
    const owner = await user('assessment-version-owner');
    const organizationId = await organization(owner.token, 'Assessment pinned catalog');
    const created = await authenticated(owner.token, organizationId)
      .post('/sessions')
      .send({})
      .expect(201);
    const stored = await prisma.sstAssessmentSession.findUniqueOrThrow({
      where: { id: created.body.id as string },
    });
    expect(stored.catalogVersion).toBe('1.0.0');
    await prisma.sstAssessmentSession.update({
      where: { id: stored.id },
      data: { catalogVersion: '99.0.0' },
    });
    await authenticated(owner.token, organizationId)
      .get(`/sessions/${stored.id}`)
      .expect(500)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_VERSION_UNSUPPORTED'));
  });

  it('round-trips mixed centers without legacy organization-to-center fan-out', async () => {
    const owner = await user('assessment-scope-owner');
    const organizationId = await organization(owner.token, 'Assessment scoped facts');
    await prisma.workCenter.create({
      data: { organizationId, name: `Centro secundario ${suffix}` },
    });
    await prisma.organizationSstProfileVersion.create({
      data: {
        organizationId,
        version: 1,
        createdById: owner.id,
        snapshot: {
          schemaVersion: '1.0.0',
          organization: {
            country: 'Ecuador',
            sector: 'Servicios',
            workCenterCount: 2,
          },
          operations: { hasChemicalProcesses: true, hasHighEnergyOperations: true },
        },
      },
    });
    const created = await authenticated(owner.token, organizationId)
      .post('/sessions')
      .send({})
      .expect(201);
    expect(
      created.body.snapshot.facts.some(
        ({ factKey }: { factKey: string }) => factKey === 'workCenter.hasChemicalProcesses',
      ),
    ).toBe(false);
    expect(
      created.body.questions.filter(
        ({ factKey }: { factKey: string }) => factKey === 'workCenter.hasChemicalProcesses',
      ),
    ).toHaveLength(0);
    const foundation = readyAnswers(2)
      .filter(
        ({ factKey }) =>
          factKey === 'organization.totalWorkerCount' ||
          factKey === 'workCenter.workArrangement' ||
          factKey === 'workCenter.activityCategories' ||
          factKey === 'workCenter.facilityTypes',
      )
      .map((answer) =>
        answer.scopeKey === 'center:1' && answer.factKey === 'workCenter.facilityTypes'
          ? { ...answer, value: ['OFFICE', 'WAREHOUSE'] }
          : answer.scopeKey === 'center:1' && answer.factKey === 'workCenter.activityCategories'
            ? { ...answer, value: ['ADMINISTRATIVE_SERVICES', 'WAREHOUSE'] }
            : answer,
      );
    const foundationSaved = await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/answers`)
      .send({ expectedSessionRevision: 0, answers: foundation })
      .expect(201);
    const evaluated = await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/evaluate`)
      .send({ expectedSessionRevision: foundationSaved.body.sessionRevision })
      .expect(201);
    expect(
      evaluated.body.questions.filter(
        ({ factKey }: { factKey: string }) => factKey === 'workCenter.hasChemicalProcesses',
      ),
    ).toHaveLength(2);
    const saved = await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/answers`)
      .send({
        expectedSessionRevision: evaluated.body.sessionRevision,
        answers: [
          {
            factKey: 'workCenter.hasChemicalProcesses',
            scopeKey: 'center:1',
            answerState: 'KNOWN',
            value: true,
          },
          {
            factKey: 'workCenter.hasChemicalProcesses',
            scopeKey: 'center:2',
            answerState: 'KNOWN',
            value: false,
          },
        ],
      })
      .expect(201);
    const facts = saved.body.snapshot.facts as Array<{
      factKey: string;
      scopeKey: string;
      value: unknown;
    }>;
    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factKey: 'workCenter.hasChemicalProcesses',
          scopeKey: 'center:1',
          value: true,
        }),
        expect.objectContaining({
          factKey: 'workCenter.hasChemicalProcesses',
          scopeKey: 'center:2',
          value: false,
        }),
        expect.objectContaining({
          factKey: 'workCenter.facilityTypes',
          value: ['OFFICE', 'WAREHOUSE'],
        }),
        expect.objectContaining({
          factKey: 'workCenter.activityCategories',
          value: ['ADMINISTRATIVE_SERVICES', 'WAREHOUSE'],
        }),
      ]),
    );
  });

  it('claims a completed public assessment idempotently without activating demo or allowing theft', async () => {
    const ownerA = await user('assessment-claim-owner-a');
    const ownerB = await user('assessment-claim-owner-b');
    const orgA = await organization(ownerA.token, 'Assessment claim A');
    const orgB = await organization(ownerB.token, 'Assessment claim B');
    const created = await request(app.getHttpServer())
      .post('/api/v1/sst-assessment/public/sessions')
      .send({ workCenterCount: 1 })
      .expect(201);
    await publicSession(
      'post',
      `${created.body.id as string}/complete`,
      created.body.publicToken as string,
    )
      .send({ expectedSessionRevision: 0 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_NOT_READY'));
    const saved = await publicSession(
      'post',
      `${created.body.id as string}/answers`,
      created.body.publicToken as string,
    )
      .send({ expectedSessionRevision: 0, answers: readyAnswers(1, true) })
      .expect(201);
    const evaluated = await publicSession(
      'post',
      `${created.body.id as string}/evaluate`,
      created.body.publicToken as string,
    )
      .send({ expectedSessionRevision: saved.body.sessionRevision })
      .expect(201);
    expect(evaluated.body.status).toBe('DIAGNOSIS_READY');
    const completed = await publicSession(
      'post',
      `${created.body.id as string}/complete`,
      created.body.publicToken as string,
    )
      .send({ expectedSessionRevision: evaluated.body.sessionRevision })
      .expect(201);
    const centerA = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgA } });
    const centerB = await prisma.workCenter.findFirstOrThrow({ where: { organizationId: orgB } });
    const mapping = [{ scopeKey: 'center:1', workCenterId: centerA.id }];
    const claim = () =>
      authenticated(ownerA.token, orgA)
        .post(`/public/sessions/${created.body.id as string}/claim`)
        .send({ publicToken: created.body.publicToken, scopeMappings: mapping });
    await authenticated(ownerA.token, orgA)
      .post(`/public/sessions/${created.body.id as string}/claim`)
      .send({ publicToken: created.body.publicToken, scopeMappings: [] })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_SCOPE_MAPPING_INVALID'));
    await authenticated(ownerA.token, orgA)
      .post(`/public/sessions/${created.body.id as string}/claim`)
      .send({
        publicToken: created.body.publicToken,
        scopeMappings: [{ scopeKey: 'center:1', workCenterId: centerB.id }],
      })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_SCOPE_MAPPING_FORBIDDEN'));
    await claim().expect(201);
    const claimedAgain = await claim().expect(201);
    await authenticated(ownerB.token, orgB)
      .post(`/public/sessions/${created.body.id as string}/claim`)
      .send({
        publicToken: created.body.publicToken,
        scopeMappings: [{ scopeKey: 'center:1', workCenterId: centerB.id }],
      })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_ALREADY_CLAIMED'));

    const stored = await prisma.sstAssessmentSession.findUniqueOrThrow({
      where: { id: created.body.id as string },
    });
    expect(stored).toMatchObject({
      organizationId: orgA,
      claimedById: ownerA.id,
      profileVersionId: expect.any(String),
    });
    expect(claimedAgain.body.profileVersionId).toBe(stored.profileVersionId);
    expect(
      await prisma.organizationSstProfileVersion.count({ where: { organizationId: orgA } }),
    ).toBe(1);
    const claimedProfile = await prisma.organizationSstProfileVersion.findUniqueOrThrow({
      where: { id: stored.profileVersionId! },
    });
    expect(claimedProfile.snapshot).toMatchObject({
      schemaVersion: '2.0.0',
      organization: { workerCount: 48 },
      contextFacts: expect.arrayContaining([
        expect.objectContaining({
          key: 'CHEMICAL_PROCESS_PRESENT',
          workCenterId: centerA.id,
          value: 'KNOWN_FALSE',
        }),
      ]),
    });
    expect(stored.finalSnapshot).toEqual(completed.body.finalSnapshot);
    const organizationAfter = await prisma.organization.findUniqueOrThrow({
      where: { id: orgA },
      include: { modules: { include: { module: true } } },
    });
    expect(organizationAfter.demoStartedAt).toBeNull();
    expect(organizationAfter.modules.map(({ module }) => module.key)).toEqual(['CORE']);
    expect(
      await prisma.auditLog.findFirst({
        where: {
          organizationId: orgA,
          entityId: stored.id,
          action: 'PUBLIC_SST_ASSESSMENT_CLAIMED',
          actorUserId: ownerA.id,
        },
      }),
    ).not.toBeNull();
  });

  it('allows only one writer for the same expected revision', async () => {
    const owner = await user('assessment-concurrency-owner');
    const organizationId = await organization(owner.token, 'Assessment concurrency');
    const created = await authenticated(owner.token, organizationId)
      .post('/sessions')
      .send({})
      .expect(201);
    const id = created.body.id as string;
    const requests = await Promise.all([
      authenticated(owner.token, organizationId)
        .post(`/sessions/${id}/answers`)
        .send({
          expectedSessionRevision: 0,
          answers: [
            {
              factKey: 'workCenter.hasChemicalProcesses',
              scopeKey: 'center:1',
              answerState: 'KNOWN',
              value: true,
            },
          ],
        }),
      authenticated(owner.token, organizationId)
        .post(`/sessions/${id}/answers`)
        .send({
          expectedSessionRevision: 0,
          answers: [
            {
              factKey: 'workCenter.hasChemicalProcesses',
              scopeKey: 'center:1',
              answerState: 'KNOWN',
              value: false,
            },
          ],
        }),
    ]);
    expect(requests.map(({ status }) => status).sort()).toEqual([201, 409]);
    const stored = await prisma.sstAssessmentSession.findUniqueOrThrow({ where: { id } });
    expect(stored.sessionRevision).toBe(1);
  });
});
