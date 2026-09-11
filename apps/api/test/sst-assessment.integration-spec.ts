import { createHash } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SstAssessmentService } from '../src/sst-assessment/sst-assessment.service';

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

  async function readyAuthenticatedAssessment(
    token: string,
    organizationId: string,
    workCenterCount = 1,
  ) {
    const created = await authenticated(token, organizationId)
      .post('/sessions')
      .send({})
      .expect(201);
    const saved = await authenticated(token, organizationId)
      .post(`/sessions/${created.body.id as string}/answers`)
      .send({ expectedSessionRevision: 0, answers: readyAnswers(workCenterCount) })
      .expect(201);
    const evaluated = await authenticated(token, organizationId)
      .post(`/sessions/${created.body.id as string}/evaluate`)
      .send({ expectedSessionRevision: saved.body.sessionRevision })
      .expect(201);
    expect(evaluated.body.status).toBe('DIAGNOSIS_READY');
    return evaluated.body as { id: string; sessionRevision: number };
  }

  async function completePublicAssessment(
    transform: (answers: ReturnType<typeof readyAnswers>) => ReturnType<typeof readyAnswers> = (
      answers,
    ) => answers,
    workCenterCount = 1,
  ) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/sst-assessment/public/sessions')
      .send({ workCenterCount })
      .expect(201);
    const saved = await publicSession(
      'post',
      `${created.body.id as string}/answers`,
      created.body.publicToken as string,
    )
      .send({
        expectedSessionRevision: 0,
        answers: transform(readyAnswers(workCenterCount, true)),
      })
      .expect(201);
    const evaluated = await publicSession(
      'post',
      `${created.body.id as string}/evaluate`,
      created.body.publicToken as string,
    )
      .send({ expectedSessionRevision: saved.body.sessionRevision })
      .expect(201);
    const completed = await publicSession(
      'post',
      `${created.body.id as string}/complete`,
      created.body.publicToken as string,
    )
      .send({ expectedSessionRevision: evaluated.body.sessionRevision })
      .expect(201);
    return {
      id: created.body.id as string,
      token: created.body.publicToken as string,
      finalSnapshot: completed.body.finalSnapshot,
    };
  }

  function beforeNextTransaction(action: () => Promise<unknown>) {
    const originalTransaction = prisma.$transaction.bind(prisma);
    const implementation = async <T>(
      callback: (transaction: Prisma.TransactionClient) => Promise<T>,
      options?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: Prisma.TransactionIsolationLevel;
      },
    ) => {
      await action();
      return originalTransaction(callback, options);
    };
    return jest
      .spyOn(prisma, '$transaction')
      .mockImplementationOnce(implementation as typeof prisma.$transaction);
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
    for (const factKey of ['workCenter.activityCategories', 'workCenter.facilityTypes']) {
      await publicSession('post', `${id}/answers`, token)
        .send({
          expectedSessionRevision: 0,
          answers: [
            {
              factKey,
              scopeKey: 'center:1',
              answerState: 'KNOWN',
              value: [],
            },
          ],
        })
        .expect(400)
        .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_ANSWER_INVALID'));
    }
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
    expect(authEvaluated.body.result.semanticOutputHash).not.toBe(
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

  it('reconciles now-irrelevant conditional facts before persisting a mutable snapshot', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/sst-assessment/public/sessions')
      .send({ workCenterCount: 1 })
      .expect(201);
    const initial = await publicSession(
      'post',
      `${created.body.id as string}/answers`,
      created.body.publicToken as string,
    )
      .send({
        expectedSessionRevision: 0,
        answers: [
          {
            factKey: 'workCenter.workArrangement',
            scopeKey: 'center:1',
            answerState: 'KNOWN',
            value: 'PHYSICAL',
          },
          {
            factKey: 'workCenter.facilityTypes',
            scopeKey: 'center:1',
            answerState: 'KNOWN',
            value: ['PLANT'],
          },
          {
            factKey: 'organization.inspectionPractice',
            scopeKey: 'organization',
            answerState: 'KNOWN',
            value: 'CHECKLISTS',
          },
          {
            factKey: 'organization.inspectionFrequency',
            scopeKey: 'organization',
            answerState: 'KNOWN',
            value: 'MONTHLY',
          },
        ],
      })
      .expect(201);
    expect(initial.body.snapshot.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ factKey: 'workCenter.facilityTypes', value: ['PLANT'] }),
        expect.objectContaining({ factKey: 'organization.inspectionFrequency', value: 'MONTHLY' }),
      ]),
    );

    const corrected = await publicSession(
      'post',
      `${created.body.id as string}/answers`,
      created.body.publicToken as string,
    )
      .send({
        expectedSessionRevision: initial.body.sessionRevision,
        answers: [
          {
            factKey: 'workCenter.workArrangement',
            scopeKey: 'center:1',
            answerState: 'KNOWN',
            value: 'REMOTE',
          },
          {
            factKey: 'organization.inspectionPractice',
            scopeKey: 'organization',
            answerState: 'KNOWN',
            value: 'NONE',
          },
        ],
      })
      .expect(201);
    expect(corrected.body.snapshot.facts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ factKey: 'workCenter.facilityTypes' }),
        expect.objectContaining({ factKey: 'organization.inspectionFrequency' }),
      ]),
    );
  });

  it('keeps authenticated-derived questions out of persisted results while preserving required actions', async () => {
    const owner = await user('assessment-channel-owner');
    const organizationId = await organization(owner.token, 'Assessment channel safety');
    await prisma.organization.update({ where: { id: organizationId }, data: { sector: null } });
    const created = await authenticated(owner.token, organizationId)
      .post('/sessions')
      .send({})
      .expect(201);
    expect(created.body.questions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ factKey: 'organization.sector' })]),
    );
    expect(created.body.requiredActions).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ORGANIZATION_SECTOR_REQUIRED' })]),
    );
    const evaluated = await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/evaluate`)
      .send({ expectedSessionRevision: 0 })
      .expect(201);
    expect(evaluated.body.questions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ factKey: 'organization.sector' })]),
    );
    expect(evaluated.body.result.questions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ factKey: 'organization.sector' })]),
    );
    expect(evaluated.body.requiredActions).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ORGANIZATION_SECTOR_REQUIRED' })]),
    );
    await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/answers`)
      .send({
        expectedSessionRevision: evaluated.body.sessionRevision,
        answers: [
          {
            factKey: 'organization.sector',
            scopeKey: 'organization',
            answerState: 'KNOWN',
            value: 'Industria',
          },
        ],
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_SERVER_FACT_READ_ONLY'));
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
          provenance: {
            source: 'PROFESSIONAL_CONFIRMED',
            actorUserId: owner.id,
            confirmedAt: new Date().toISOString(),
          },
        },
        {
          key: 'CHEMICAL_PROCESS_PRESENT',
          value: 'KNOWN_FALSE',
          scope: 'WORK_CENTER',
          workCenterId: secondary.id,
          provenance: { source: 'IMPORTED_REFERENCE', note: 'Importación validada.' },
        },
        {
          key: 'HIGH_ENERGY_OPERATION_PRESENT',
          value: 'KNOWN_TRUE',
          scope: 'WORK_CENTER',
          workCenterId: primary.id,
          provenance: {
            source: 'PROFESSIONAL_CONFIRMED',
            actorUserId: owner.id,
            confirmedAt: new Date().toISOString(),
          },
        },
        {
          key: 'HIGH_ENERGY_OPERATION_PRESENT',
          value: 'KNOWN_FALSE',
          scope: 'WORK_CENTER',
          workCenterId: secondary.id,
          provenance: {
            source: 'EVIDENCE_BACKED',
            evidenceReference: {
              type: 'TECHNICAL_ASSESSMENT_EVIDENCE',
              id: '77777777-7777-4777-8777-777777777777',
              label: 'Evidencia técnica histórica',
            },
          },
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
          factKey !== 'workCenter.hasChemicalProcesses' &&
          factKey !== 'workCenter.hasHighEnergyOperations',
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
      operations: { hasChemicalProcesses: false, hasHighEnergyOperations: true },
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
          provenance: { source: 'DECLARED_BY_ORGANIZATION' },
        }),
        expect.objectContaining({
          key: 'CHEMICAL_PROCESS_PRESENT',
          workCenterId: secondary.id,
          value: 'KNOWN_FALSE',
          provenance: { source: 'IMPORTED_REFERENCE', note: 'Importación validada.' },
        }),
        expect.objectContaining({
          key: 'HIGH_ENERGY_OPERATION_PRESENT',
          workCenterId: primary.id,
          value: 'KNOWN_TRUE',
          provenance: expect.objectContaining({
            source: 'PROFESSIONAL_CONFIRMED',
            actorUserId: owner.id,
          }),
        }),
        expect.objectContaining({
          key: 'HIGH_ENERGY_OPERATION_PRESENT',
          workCenterId: secondary.id,
          value: 'KNOWN_FALSE',
          provenance: expect.objectContaining({ source: 'EVIDENCE_BACKED' }),
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

  it('preserves access for organizations with substantive legacy SST context', async () => {
    const owner = await user('assessment-legacy-owner');
    const organizationId = await organization(owner.token, 'Assessment legacy context');
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
            workCenterCount: 1,
            workerCount: 24,
          },
          operations: { hasChemicalProcesses: false, hasHighEnergyOperations: false },
        },
      },
    });

    await authenticated(owner.token, organizationId)
      .get('/setup-state')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual({
          state: 'LEGACY_CONFIGURED',
          hardGate: false,
          assessmentId: null,
        }),
      );

    const created = await authenticated(owner.token, organizationId)
      .post('/sessions')
      .send({})
      .expect(201);
    const sessionId = created.body.id as string;
    await authenticated(owner.token, organizationId)
      .get('/setup-state')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          state: 'ASSESSMENT_IN_PROGRESS',
          hardGate: false,
          assessmentId: sessionId,
        }),
      );

    const saved = await authenticated(owner.token, organizationId)
      .post(`/sessions/${sessionId}/answers`)
      .send({ expectedSessionRevision: 0, answers: readyAnswers(1) })
      .expect(201);
    const evaluated = await authenticated(owner.token, organizationId)
      .post(`/sessions/${sessionId}/evaluate`)
      .send({ expectedSessionRevision: saved.body.sessionRevision })
      .expect(201);
    await authenticated(owner.token, organizationId)
      .post(`/sessions/${sessionId}/finalize`)
      .send({ expectedSessionRevision: evaluated.body.sessionRevision })
      .expect(201);
    await authenticated(owner.token, organizationId)
      .get('/setup-state')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          state: 'DIAGNOSIS_READY',
          hardGate: false,
          assessmentId: sessionId,
        }),
      );
  });

  it('preserves access for an Operational Plan-only legacy baseline', async () => {
    const owner = await user('assessment-legacy-plan-owner');
    const organizationId = await organization(owner.token, 'Assessment legacy plan');
    await prisma.operationalPlan.create({ data: { organizationId, createdById: owner.id } });

    await authenticated(owner.token, organizationId)
      .get('/setup-state')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual({
          state: 'LEGACY_CONFIGURED',
          hardGate: false,
          assessmentId: null,
        }),
      );
  });

  it('preserves access for organizations activated by the legacy demo onboarding', async () => {
    const owner = await user('assessment-legacy-demo-owner');
    const organizationId = await organization(owner.token, 'Assessment legacy demo');
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: 'DEMO',
        demoStartedAt: new Date(),
        demoExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      },
    });

    await authenticated(owner.token, organizationId)
      .get('/setup-state')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual({
          state: 'LEGACY_CONFIGURED',
          hardGate: false,
          assessmentId: null,
        }),
      );
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
      .expect(({ body }) =>
        expect(body).toMatchObject({ state: 'NEEDS_ASSESSMENT', hardGate: true }),
      );

    await authenticated(viewer.token, orgA).post('/sessions').send({}).expect(403);
    const created = await authenticated(owner.token, orgA).post('/sessions').send({}).expect(201);
    const id = created.body.id as string;
    await authenticated(owner.token, orgA)
      .get('/setup-state')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          state: 'ASSESSMENT_IN_PROGRESS',
          hardGate: true,
          assessmentId: id,
        }),
      );
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
      .expect(({ body }) =>
        expect(body).toMatchObject({ state: 'DIAGNOSIS_READY', hardGate: true }),
      );

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
      organization: { country: 'Ecuador', workCenterCount: 1, workerCount: 48 },
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

  it('atomically provisions declared multi-center topology for a pristine FREE setup organization', async () => {
    for (const centerCount of [2, 3]) {
      const owner = await user(`assessment-free-${centerCount}-center-owner`);
      const organizationId = await organization(
        owner.token,
        `Assessment FREE ${centerCount} centers`,
      );
      const subscriptionBefore = await prisma.subscription.findFirstOrThrow({
        where: { organizationId, status: 'ACTIVE' },
        include: { plan: true },
      });
      expect(subscriptionBefore.plan.key).toBe('FREE');
      const assessment = await completePublicAssessment(undefined, centerCount);
      const centers = Array.from({ length: centerCount }, (_, index) => ({
        scopeKey: `center:${index + 1}`,
        name: `Centro declarado ${centerCount}-${index + 1} ${suffix}`,
        city: index === 0 ? 'Quito' : undefined,
      }));

      const claimed = await authenticated(owner.token, organizationId)
        .post(`/public/sessions/${assessment.id}/claim-new-organization`)
        .send({ publicToken: assessment.token, centers })
        .expect(201);

      expect(claimed.body).toMatchObject({
        id: assessment.id,
        status: 'FINALIZED',
        profileVersionId: expect.any(String),
      });
      const [subscriptionAfter, modules, storedCenters, profile, setup, audit] = await Promise.all([
        prisma.subscription.findFirstOrThrow({
          where: { organizationId, status: 'ACTIVE' },
          include: { plan: true },
        }),
        prisma.organizationModule.findMany({
          where: { organizationId, status: 'ACTIVE' },
          include: { module: true },
        }),
        prisma.workCenter.findMany({ where: { organizationId }, orderBy: { name: 'asc' } }),
        prisma.organizationSstProfileVersion.findUniqueOrThrow({
          where: { id: claimed.body.profileVersionId as string },
        }),
        authenticated(owner.token, organizationId).get('/setup-state').expect(200),
        prisma.auditLog.findFirst({
          where: {
            organizationId,
            actorUserId: owner.id,
            action: 'SST_SETUP_TOPOLOGY_PROVISIONED',
            entityId: assessment.id,
          },
        }),
      ]);
      expect(subscriptionAfter).toMatchObject({
        id: subscriptionBefore.id,
        planId: subscriptionBefore.planId,
        plan: { key: 'FREE' },
      });
      expect(modules.map(({ module }) => module.key)).toEqual(['CORE']);
      expect(storedCenters.map(({ name }) => name).sort()).toEqual(
        centers.map(({ name }) => name).sort(),
      );
      expect(profile.snapshot).toMatchObject({
        schemaVersion: '2.0.0',
        organization: { workCenterCount: centerCount },
      });
      expect(setup.body).toMatchObject({
        state: 'DIAGNOSIS_READY',
        hardGate: true,
        assessmentId: assessment.id,
      });
      expect(audit?.metadata).toMatchObject({
        assessmentId: assessment.id,
        organizationId,
        centerCount,
      });

      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/work-centers`)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-organization-id', organizationId)
        .send({ name: `Operational center over limit ${suffix}` })
        .expect(403)
        .expect(({ body }) => {
          expect(body.code).toBe('LIMIT_REACHED');
          expect(body.details).toMatchObject({
            featureKey: 'organization.max_work_centers',
            limit: 1,
          });
        });
    }
  });

  it('rolls back setup topology failures and rejects non-pristine existing organizations', async () => {
    const owner = await user('assessment-setup-atomic-owner');
    const organizationId = await organization(owner.token, 'Assessment setup atomic');
    const assessment = await completePublicAssessment(undefined, 2);

    await authenticated(owner.token, organizationId)
      .post(`/public/sessions/${assessment.id}/claim-new-organization`)
      .send({
        publicToken: assessment.token,
        centers: [
          { scopeKey: 'center:1', name: '   ' },
          { scopeKey: 'center:2', name: `Centro válido ${suffix}` },
        ],
      })
      .expect(400);
    await authenticated(owner.token, organizationId)
      .post(`/public/sessions/${assessment.id}/claim-new-organization`)
      .send({
        publicToken: assessment.token,
        centers: [
          { scopeKey: 'center:1', name: `Centro duplicado ${suffix}` },
          { scopeKey: 'center:2', name: `Centro duplicado ${suffix}` },
        ],
      })
      .expect(400);
    expect(await prisma.workCenter.findMany({ where: { organizationId } })).toEqual([
      expect.objectContaining({ name: 'Centro principal' }),
    ]);
    expect(await prisma.organizationSstProfileVersion.count({ where: { organizationId } })).toBe(0);
    expect(
      await prisma.sstAssessmentSession.findUniqueOrThrow({ where: { id: assessment.id } }),
    ).toMatchObject({ organizationId: null, claimedById: null, profileVersionId: null });

    const assessmentService = app.get(SstAssessmentService);
    const profileFailure = jest
      .spyOn(
        assessmentService as unknown as {
          createOrReuseProfile: (...args: unknown[]) => Promise<unknown>;
        },
        'createOrReuseProfile',
      )
      .mockRejectedValueOnce(new Error('TEST_PROFILE_FAILURE_AFTER_TOPOLOGY'));
    try {
      await authenticated(owner.token, organizationId)
        .post(`/public/sessions/${assessment.id}/claim-new-organization`)
        .send({
          publicToken: assessment.token,
          centers: [
            { scopeKey: 'center:1', name: `Centro transaccional 1 ${suffix}` },
            { scopeKey: 'center:2', name: `Centro transaccional 2 ${suffix}` },
          ],
        })
        .expect(500);
    } finally {
      profileFailure.mockRestore();
    }
    expect(await prisma.workCenter.findMany({ where: { organizationId } })).toEqual([
      expect.objectContaining({ name: 'Centro principal' }),
    ]);
    expect(await prisma.organizationSstProfileVersion.count({ where: { organizationId } })).toBe(0);
    expect(
      await prisma.sstAssessmentSession.findUniqueOrThrow({ where: { id: assessment.id } }),
    ).toMatchObject({ organizationId: null, claimedById: null, profileVersionId: null });

    await prisma.operationalPlan.create({ data: { organizationId, createdById: owner.id } });
    const existingAssessment = await completePublicAssessment();
    await authenticated(owner.token, organizationId)
      .post(`/public/sessions/${existingAssessment.id}/claim-new-organization`)
      .send({
        publicToken: existingAssessment.token,
        centers: [{ scopeKey: 'center:1', name: `Centro existente ${suffix}` }],
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('SST_ASSESSMENT_NEW_ORGANIZATION_SETUP_REQUIRED');
        expect(body.details).toEqual({ reason: 'ORGANIZATION_NOT_PRISTINE' });
      });
    expect(await prisma.workCenter.findMany({ where: { organizationId } })).toEqual([
      expect.objectContaining({ name: 'Centro principal' }),
    ]);
  });

  it('fails public claim closed when country or active-center topology needs reconciliation', async () => {
    const owner = await user('assessment-claim-reconciliation-owner');
    const organizationId = await organization(owner.token, 'Assessment claim reconciliation');
    const firstCenter = await prisma.workCenter.findFirstOrThrow({ where: { organizationId } });

    const completePublic = async (country: string, workCenterCount: number) => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/sst-assessment/public/sessions')
        .send({ workCenterCount })
        .expect(201);
      const answers = readyAnswers(workCenterCount, true).map((answer) =>
        answer.factKey === 'organization.country' ? { ...answer, value: country } : answer,
      );
      const saved = await publicSession(
        'post',
        `${created.body.id as string}/answers`,
        created.body.publicToken as string,
      )
        .send({ expectedSessionRevision: 0, answers })
        .expect(201);
      const evaluated = await publicSession(
        'post',
        `${created.body.id as string}/evaluate`,
        created.body.publicToken as string,
      )
        .send({ expectedSessionRevision: saved.body.sessionRevision })
        .expect(201);
      await publicSession(
        'post',
        `${created.body.id as string}/complete`,
        created.body.publicToken as string,
      )
        .send({ expectedSessionRevision: evaluated.body.sessionRevision })
        .expect(201);
      return created.body as { id: string; publicToken: string };
    };

    const wrongCountry = await completePublic('Colombia', 1);
    await authenticated(owner.token, organizationId)
      .post(`/public/sessions/${wrongCountry.id}/claim`)
      .send({
        publicToken: wrongCountry.publicToken,
        scopeMappings: [{ scopeKey: 'center:1', workCenterId: firstCenter.id }],
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('SST_ASSESSMENT_ORGANIZATION_RECONCILIATION_REQUIRED');
        expect(body.details).toEqual({ reason: 'COUNTRY' });
        expect(body).not.toHaveProperty('reason');
      });

    await prisma.workCenter.createMany({
      data: [2, 3].map((number) => ({
        organizationId,
        name: `Topology center ${number} ${suffix}`,
      })),
    });
    const wrongTopology = await completePublic('Ecuador', 1);
    await authenticated(owner.token, organizationId)
      .post(`/public/sessions/${wrongTopology.id}/claim`)
      .send({
        publicToken: wrongTopology.publicToken,
        scopeMappings: [{ scopeKey: 'center:1', workCenterId: firstCenter.id }],
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('SST_ASSESSMENT_ORGANIZATION_RECONCILIATION_REQUIRED');
        expect(body.details).toEqual({ reason: 'WORK_CENTER_TOPOLOGY' });
        expect(body).not.toHaveProperty('reason');
      });
    expect(await prisma.organizationSstProfileVersion.count({ where: { organizationId } })).toBe(0);
  });

  it('reconciles public claim country and topology authoritatively inside the transaction', async () => {
    const topologyOwner = await user('assessment-claim-toctou-topology-owner');
    const topologyOrganizationId = await organization(
      topologyOwner.token,
      'Assessment claim TOCTOU topology',
    );
    const topologyCenter = await prisma.workCenter.findFirstOrThrow({
      where: { organizationId: topologyOrganizationId },
    });
    const topologyAssessment = await completePublicAssessment();
    const topologyTransaction = beforeNextTransaction(() =>
      prisma.workCenter.create({
        data: {
          organizationId: topologyOrganizationId,
          name: `TOCTOU center ${suffix}`,
        },
      }),
    );
    try {
      await authenticated(topologyOwner.token, topologyOrganizationId)
        .post(`/public/sessions/${topologyAssessment.id}/claim`)
        .send({
          publicToken: topologyAssessment.token,
          scopeMappings: [{ scopeKey: 'center:1', workCenterId: topologyCenter.id }],
        })
        .expect(409)
        .expect(({ body }) => {
          expect(body.code).toBe('SST_ASSESSMENT_ORGANIZATION_RECONCILIATION_REQUIRED');
          expect(body.details).toEqual({ reason: 'WORK_CENTER_TOPOLOGY' });
        });
    } finally {
      topologyTransaction.mockRestore();
    }

    const countryOwner = await user('assessment-claim-toctou-country-owner');
    const countryOrganizationId = await organization(
      countryOwner.token,
      'Assessment claim TOCTOU country',
    );
    const countryCenter = await prisma.workCenter.findFirstOrThrow({
      where: { organizationId: countryOrganizationId },
    });
    const countryAssessment = await completePublicAssessment();
    const countryTransaction = beforeNextTransaction(() =>
      prisma.organization.update({
        where: { id: countryOrganizationId },
        data: { country: 'Colombia' },
      }),
    );
    try {
      await authenticated(countryOwner.token, countryOrganizationId)
        .post(`/public/sessions/${countryAssessment.id}/claim`)
        .send({
          publicToken: countryAssessment.token,
          scopeMappings: [{ scopeKey: 'center:1', workCenterId: countryCenter.id }],
        })
        .expect(409)
        .expect(({ body }) => {
          expect(body.code).toBe('SST_ASSESSMENT_ORGANIZATION_RECONCILIATION_REQUIRED');
          expect(body.details).toEqual({ reason: 'COUNTRY' });
        });
    } finally {
      countryTransaction.mockRestore();
    }

    for (const assessmentId of [topologyAssessment.id, countryAssessment.id]) {
      const stored = await prisma.sstAssessmentSession.findUniqueOrThrow({
        where: { id: assessmentId },
      });
      expect(stored).toMatchObject({ organizationId: null, profileVersionId: null });
    }
    expect(
      await prisma.organizationSstProfileVersion.count({
        where: { organizationId: { in: [topologyOrganizationId, countryOrganizationId] } },
      }),
    ).toBe(0);
  });

  it('reconciles Profile V1 worker and operation aggregates without mutating history', async () => {
    const owner = await user('assessment-claim-profile-v1-owner');
    const organizationId = await organization(owner.token, 'Assessment claim Profile V1');
    const center = await prisma.workCenter.findFirstOrThrow({ where: { organizationId } });
    const legacySnapshot = {
      schemaVersion: '1.0.0',
      organization: {
        country: 'Ecuador',
        sector: 'Servicios',
        workCenterCount: 1,
        workerCount: 48,
      },
      operations: { hasChemicalProcesses: false, hasHighEnergyOperations: false },
    };
    const legacy = await prisma.organizationSstProfileVersion.create({
      data: {
        organizationId,
        version: 1,
        createdById: owner.id,
        snapshot: legacySnapshot,
      },
    });
    const mapping = [{ scopeKey: 'center:1', workCenterId: center.id }];
    const conflicts = [
      {
        category: 'ORGANIZATION_WORKER_COUNT',
        transform: (answers: ReturnType<typeof readyAnswers>) =>
          answers.map((answer) =>
            answer.factKey === 'organization.totalWorkerCount' ? { ...answer, value: 49 } : answer,
          ),
      },
      {
        category: 'CHEMICAL_PROCESS_PRESENT',
        transform: (answers: ReturnType<typeof readyAnswers>) =>
          answers.map((answer) =>
            answer.factKey === 'workCenter.hasChemicalProcesses'
              ? { ...answer, value: true }
              : answer,
          ),
      },
      {
        category: 'HIGH_ENERGY_OPERATION_PRESENT',
        transform: (answers: ReturnType<typeof readyAnswers>) =>
          answers.map((answer) =>
            answer.factKey === 'workCenter.hasHighEnergyOperations'
              ? { ...answer, value: true }
              : answer,
          ),
      },
    ];
    for (const { category, transform } of conflicts) {
      const assessment = await completePublicAssessment(transform);
      await authenticated(owner.token, organizationId)
        .post(`/public/sessions/${assessment.id}/claim`)
        .send({ publicToken: assessment.token, scopeMappings: mapping })
        .expect(409)
        .expect(({ body }) => {
          expect(body.code).toBe('SST_ASSESSMENT_PROFILE_RECONCILIATION_REQUIRED');
          expect(body.details.conflictCategories).toEqual([category]);
          expect(body).not.toHaveProperty('conflictCategories');
        });
      expect(
        await prisma.sstAssessmentSession.findUniqueOrThrow({ where: { id: assessment.id } }),
      ).toMatchObject({ organizationId: null, profileVersionId: null });
    }

    const compatible = await completePublicAssessment();
    const claimed = await authenticated(owner.token, organizationId)
      .post(`/public/sessions/${compatible.id}/claim`)
      .send({ publicToken: compatible.token, scopeMappings: mapping })
      .expect(201);
    expect(claimed.body.profileVersionId).not.toBe(legacy.id);
    expect(await prisma.organizationSstProfileVersion.count({ where: { organizationId } })).toBe(2);
    const historical = await prisma.organizationSstProfileVersion.findUniqueOrThrow({
      where: { id: legacy.id },
    });
    expect(historical.snapshot).toEqual(legacySnapshot);
    const migrated = await prisma.organizationSstProfileVersion.findUniqueOrThrow({
      where: { id: claimed.body.profileVersionId as string },
    });
    expect(migrated).toMatchObject({ version: 2 });
    expect(migrated.snapshot).toMatchObject({
      schemaVersion: '2.0.0',
      organization: { workerCount: 48 },
      operations: { hasChemicalProcesses: false, hasHighEnergyOperations: false },
    });
    expect(
      await prisma.sstAssessmentSession.findUniqueOrThrow({ where: { id: compatible.id } }),
    ).toMatchObject({
      baseProfileVersionId: legacy.id,
      finalSnapshot: compatible.finalSnapshot,
    });
    await authenticated(owner.token, organizationId)
      .get('/setup-state')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          state: 'DIAGNOSIS_READY',
          hardGate: false,
          assessmentId: compatible.id,
        }),
      );
  });

  it('reconciles public claims against Profile V2 without overwriting conflicts or strong provenance', async () => {
    const owner = await user('assessment-claim-profile-owner');
    const organizationId = await organization(owner.token, 'Assessment claim profile');
    const center = await prisma.workCenter.findFirstOrThrow({ where: { organizationId } });
    const authenticatedReady = await readyAuthenticatedAssessment(owner.token, organizationId);
    const authenticatedFinal = await authenticated(owner.token, organizationId)
      .post(`/sessions/${authenticatedReady.id}/finalize`)
      .send({ expectedSessionRevision: authenticatedReady.sessionRevision })
      .expect(201);
    const firstProfile = await prisma.organizationSstProfileVersion.findUniqueOrThrow({
      where: { id: authenticatedFinal.body.profileVersionId as string },
    });
    const firstSnapshot = firstProfile.snapshot as {
      contextFacts: Array<Record<string, unknown>>;
      [key: string]: unknown;
    };
    const strongProfile = await prisma.organizationSstProfileVersion.create({
      data: {
        organizationId,
        version: firstProfile.version + 1,
        createdById: owner.id,
        snapshot: {
          ...firstSnapshot,
          contextFacts: firstSnapshot.contextFacts.map((fact) =>
            fact.key === 'CHEMICAL_PROCESS_PRESENT' && fact.workCenterId === center.id
              ? {
                  ...fact,
                  provenance: {
                    source: 'PROFESSIONAL_CONFIRMED',
                    actorUserId: owner.id,
                    confirmedAt: new Date().toISOString(),
                  },
                }
              : fact,
          ),
        } as Prisma.InputJsonValue,
      },
    });

    const completePublic = async (
      transform: (answers: ReturnType<typeof readyAnswers>) => ReturnType<typeof readyAnswers> = (
        answers,
      ) => answers,
    ) => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/sst-assessment/public/sessions')
        .send({ workCenterCount: 1 })
        .expect(201);
      const saved = await publicSession(
        'post',
        `${created.body.id as string}/answers`,
        created.body.publicToken as string,
      )
        .send({ expectedSessionRevision: 0, answers: transform(readyAnswers(1, true)) })
        .expect(201);
      const evaluated = await publicSession(
        'post',
        `${created.body.id as string}/evaluate`,
        created.body.publicToken as string,
      )
        .send({ expectedSessionRevision: saved.body.sessionRevision })
        .expect(201);
      const completed = await publicSession(
        'post',
        `${created.body.id as string}/complete`,
        created.body.publicToken as string,
      )
        .send({ expectedSessionRevision: evaluated.body.sessionRevision })
        .expect(201);
      return {
        id: created.body.id as string,
        token: created.body.publicToken as string,
        finalSnapshot: completed.body.finalSnapshot,
      };
    };
    const mapping = [{ scopeKey: 'center:1', workCenterId: center.id }];
    const compatible = await completePublic();
    const claimed = await authenticated(owner.token, organizationId)
      .post(`/public/sessions/${compatible.id}/claim`)
      .send({ publicToken: compatible.token, scopeMappings: mapping })
      .expect(201);
    expect(claimed.body.profileVersionId).toBe(strongProfile.id);
    expect(await prisma.organizationSstProfileVersion.count({ where: { organizationId } })).toBe(2);
    const retained = await prisma.organizationSstProfileVersion.findUniqueOrThrow({
      where: { id: strongProfile.id },
    });
    expect(retained.snapshot).toEqual(
      expect.objectContaining({
        contextFacts: expect.arrayContaining([
          expect.objectContaining({
            key: 'CHEMICAL_PROCESS_PRESENT',
            workCenterId: center.id,
            provenance: expect.objectContaining({ source: 'PROFESSIONAL_CONFIRMED' }),
          }),
        ]),
      }),
    );
    expect(
      (await prisma.sstAssessmentSession.findUniqueOrThrow({ where: { id: compatible.id } }))
        .finalSnapshot,
    ).toEqual(compatible.finalSnapshot);

    const headcountConflict = await completePublic((answers) =>
      answers.map((answer) =>
        answer.factKey === 'organization.totalWorkerCount' ? { ...answer, value: 49 } : answer,
      ),
    );
    await authenticated(owner.token, organizationId)
      .post(`/public/sessions/${headcountConflict.id}/claim`)
      .send({ publicToken: headcountConflict.token, scopeMappings: mapping })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('SST_ASSESSMENT_PROFILE_RECONCILIATION_REQUIRED');
        expect(body.details.conflictCategories).toEqual(['ORGANIZATION_WORKER_COUNT']);
      });

    const technicalConflict = await completePublic((answers) =>
      answers.map((answer) =>
        answer.factKey === 'workCenter.hasChemicalProcesses' ? { ...answer, value: true } : answer,
      ),
    );
    await authenticated(owner.token, organizationId)
      .post(`/public/sessions/${technicalConflict.id}/claim`)
      .send({ publicToken: technicalConflict.token, scopeMappings: mapping })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('SST_ASSESSMENT_PROFILE_RECONCILIATION_REQUIRED');
        expect(body.details.conflictCategories).toEqual(['CHEMICAL_PROCESS_PRESENT']);
      });
    expect(await prisma.organizationSstProfileVersion.count({ where: { organizationId } })).toBe(2);
  });

  it('reopens prior unknown scoped facts during reassessment without changing history', async () => {
    const owner = await user('assessment-unknown-reask-owner');
    const organizationId = await organization(owner.token, 'Assessment unknown reask');
    const created = await authenticated(owner.token, organizationId)
      .post('/sessions')
      .send({})
      .expect(201);
    const answers = readyAnswers(1).map((answer) =>
      answer.factKey === 'workCenter.hasChemicalProcesses'
        ? { ...answer, answerState: 'EXPLICIT_UNKNOWN', value: undefined }
        : answer,
    );
    const saved = await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/answers`)
      .send({ expectedSessionRevision: 0, answers })
      .expect(201);
    const evaluated = await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/evaluate`)
      .send({ expectedSessionRevision: saved.body.sessionRevision })
      .expect(201);
    const finalized = await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/finalize`)
      .send({ expectedSessionRevision: evaluated.body.sessionRevision })
      .expect(201);
    const historicalSnapshot = finalized.body.finalSnapshot;

    const reassessment = await authenticated(owner.token, organizationId)
      .post('/sessions')
      .send({ kind: 'REASSESSMENT', parentAssessmentId: created.body.id })
      .expect(201);
    expect(reassessment.body.snapshot.facts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ factKey: 'workCenter.hasChemicalProcesses' }),
      ]),
    );
    const reassessed = await authenticated(owner.token, organizationId)
      .post(`/sessions/${reassessment.body.id as string}/evaluate`)
      .send({ expectedSessionRevision: 0 })
      .expect(201);
    expect(reassessed.body.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factKey: 'workCenter.hasChemicalProcesses',
          blocking: true,
        }),
      ]),
    );
    const answered = await authenticated(owner.token, organizationId)
      .post(`/sessions/${reassessment.body.id as string}/answers`)
      .send({
        expectedSessionRevision: reassessed.body.sessionRevision,
        answers: [
          {
            factKey: 'workCenter.hasChemicalProcesses',
            scopeKey: 'center:1',
            answerState: 'KNOWN',
            value: true,
          },
        ],
      })
      .expect(201);
    expect(answered.body.snapshot.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factKey: 'workCenter.hasChemicalProcesses',
          answerState: 'KNOWN',
          value: true,
        }),
      ]),
    );
    expect(
      (await prisma.sstAssessmentSession.findUniqueOrThrow({ where: { id: created.body.id } }))
        .finalSnapshot,
    ).toEqual(historicalSnapshot);
  });

  it('keeps commercial intake discoverable and outside specialist decisions', async () => {
    const evaluate = async (commercial: boolean) => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/sst-assessment/public/sessions')
        .send({ workCenterCount: 1 })
        .expect(201);
      expect(created.body.questions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            factKey: 'organization.managementSystem',
            collectionPolicy: 'CONTEXT_RECOMMENDED',
            blocking: false,
          }),
          expect.objectContaining({
            factKey: 'organization.budgetRange',
            collectionPolicy: 'COMMERCIAL_OPTIONAL',
            blocking: false,
          }),
        ]),
      );
      const answers = [
        ...readyAnswers(1, true),
        ...(commercial
          ? [
              {
                factKey: 'organization.productObjectives',
                scopeKey: 'organization',
                answerState: 'KNOWN',
                value: ['CENTRALIZATION'],
              },
              {
                factKey: 'organization.budgetRange',
                scopeKey: 'organization',
                answerState: 'KNOWN',
                value: 'STANDARD',
              },
            ]
          : []),
      ];
      const saved = await publicSession(
        'post',
        `${created.body.id as string}/answers`,
        created.body.publicToken as string,
      )
        .send({ expectedSessionRevision: 0, answers })
        .expect(201);
      const evaluated = await publicSession(
        'post',
        `${created.body.id as string}/evaluate`,
        created.body.publicToken as string,
      )
        .send({ expectedSessionRevision: saved.body.sessionRevision })
        .expect(201);
      expect(evaluated.body.status).toBe('DIAGNOSIS_READY');
      return evaluated.body;
    };
    const withoutCommercial = await evaluate(false);
    const withCommercial = await evaluate(true);
    expect(withCommercial.result.items).toEqual(withoutCommercial.result.items);
    expect(withCommercial.result.specialistTraces).toEqual(
      withoutCommercial.result.specialistTraces,
    );
    expect(withCommercial.snapshot.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ factKey: 'organization.productObjectives' }),
        expect.objectContaining({ factKey: 'organization.budgetRange' }),
      ]),
    );
  });

  it('blocks stale authenticated sessions after profile evolution, including stronger provenance', async () => {
    const owner = await user('assessment-stale-profile-owner');
    const organizationId = await organization(owner.token, 'Assessment stale profile');
    const baseline = await readyAuthenticatedAssessment(owner.token, organizationId);
    await authenticated(owner.token, organizationId)
      .post(`/sessions/${baseline.id}/finalize`)
      .send({ expectedSessionRevision: baseline.sessionRevision })
      .expect(201);
    const readyWithChemical = async (value: boolean) => {
      const created = await authenticated(owner.token, organizationId)
        .post('/sessions')
        .send({})
        .expect(201);
      const saved = await authenticated(owner.token, organizationId)
        .post(`/sessions/${created.body.id as string}/answers`)
        .send({
          expectedSessionRevision: 0,
          answers: readyAnswers(1).map((answer) =>
            answer.factKey === 'workCenter.hasChemicalProcesses' ? { ...answer, value } : answer,
          ),
        })
        .expect(201);
      const evaluated = await authenticated(owner.token, organizationId)
        .post(`/sessions/${created.body.id as string}/evaluate`)
        .send({ expectedSessionRevision: saved.body.sessionRevision })
        .expect(201);
      expect(evaluated.body.status).toBe('DIAGNOSIS_READY');
      return evaluated.body as { id: string; sessionRevision: number };
    };
    const first = await readyWithChemical(true);
    const second = await readyWithChemical(false);
    const finalized = await authenticated(owner.token, organizationId)
      .post(`/sessions/${first.id}/finalize`)
      .send({ expectedSessionRevision: first.sessionRevision })
      .expect(201);
    await authenticated(owner.token, organizationId)
      .post(`/sessions/${second.id}/finalize`)
      .send({ expectedSessionRevision: second.sessionRevision })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_CONTEXT_CHANGED'));
    expect(await prisma.organizationSstProfileVersion.count({ where: { organizationId } })).toBe(2);

    const staleAgainstStronger = await readyAuthenticatedAssessment(owner.token, organizationId);
    const current = await prisma.organizationSstProfileVersion.findUniqueOrThrow({
      where: { id: finalized.body.profileVersionId as string },
    });
    const currentSnapshot = current.snapshot as {
      schemaVersion: string;
      organization: Record<string, unknown>;
      operations: Record<string, unknown>;
      contextFacts: Array<Record<string, unknown>>;
    };
    const strongerSnapshot = {
      ...currentSnapshot,
      contextFacts: [
        ...currentSnapshot.contextFacts,
        {
          key: 'PHYSICAL_SITE_PRESENT',
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
    const stronger = await prisma.organizationSstProfileVersion.create({
      data: {
        organizationId,
        version: current.version + 1,
        snapshot: strongerSnapshot as Prisma.InputJsonValue,
        createdById: owner.id,
      },
    });
    await authenticated(owner.token, organizationId)
      .post(`/sessions/${staleAgainstStronger.id}/finalize`)
      .send({ expectedSessionRevision: staleAgainstStronger.sessionRevision })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_CONTEXT_CHANGED'));
    expect(
      (
        await prisma.organizationSstProfileVersion.findFirstOrThrow({
          where: { organizationId },
          orderBy: { version: 'desc' },
        })
      ).id,
    ).toBe(stronger.id);
  });

  it('blocks authenticated evaluation and finalization after active-center topology changes', async () => {
    const owner = await user('assessment-stale-topology-owner');
    const organizationId = await organization(owner.token, 'Assessment stale topology');
    const created = await authenticated(owner.token, organizationId)
      .post('/sessions')
      .send({})
      .expect(201);
    await prisma.workCenter.create({
      data: { organizationId, name: `New stale center ${suffix}` },
    });
    await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/evaluate`)
      .send({ expectedSessionRevision: 0 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_CONTEXT_CHANGED'));

    const ready = await readyAuthenticatedAssessment(owner.token, organizationId, 2);
    const activeCenter = await prisma.workCenter.findFirstOrThrow({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    await prisma.workCenter.update({ where: { id: activeCenter.id }, data: { isActive: false } });
    await authenticated(owner.token, organizationId)
      .post(`/sessions/${ready.id}/finalize`)
      .send({ expectedSessionRevision: ready.sessionRevision })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_CONTEXT_CHANGED'));
  });

  it('blocks authenticated evaluation after server-authoritative organization context changes', async () => {
    const owner = await user('assessment-stale-organization-owner');
    const organizationId = await organization(owner.token, 'Assessment stale organization');
    const created = await authenticated(owner.token, organizationId)
      .post('/sessions')
      .send({})
      .expect(201);
    await prisma.organization.update({
      where: { id: organizationId },
      data: { sector: 'Industria' },
    });
    await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/evaluate`)
      .send({ expectedSessionRevision: 0 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('SST_ASSESSMENT_CONTEXT_CHANGED'));
  });

  it('finalizes the maximum 100-center topology without losing mapped Profile V2 facts', async () => {
    const owner = await user('assessment-max-capacity-owner');
    const organizationId = await organization(owner.token, 'Assessment max capacity');
    await prisma.workCenter.createMany({
      data: Array.from({ length: 99 }, (_, index) => ({
        organizationId,
        name: `Capacity center ${String(index + 2).padStart(3, '0')} ${suffix}`,
      })),
    });
    const created = await authenticated(owner.token, organizationId)
      .post('/sessions')
      .send({})
      .expect(201);
    expect(created.body.snapshot.scopes).toHaveLength(101);
    let revision = created.body.sessionRevision as number;
    const foundationAnswers = readyAnswers(100).filter(({ factKey }) =>
      [
        'organization.totalWorkerCount',
        'workCenter.workArrangement',
        'workCenter.activityCategories',
        'workCenter.facilityTypes',
      ].includes(factKey),
    );
    for (let offset = 0; offset < foundationAnswers.length; offset += 100) {
      const saved = await authenticated(owner.token, organizationId)
        .post(`/sessions/${created.body.id as string}/answers`)
        .send({
          expectedSessionRevision: revision,
          answers: foundationAnswers.slice(offset, offset + 100),
        })
        .expect(201);
      revision = saved.body.sessionRevision as number;
    }
    let evaluated = await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/evaluate`)
      .send({ expectedSessionRevision: revision })
      .expect(201);
    expect(evaluated.body.status).toBe('COLLECTING_INFORMATION');
    expect(
      (evaluated.body.questions as Array<{ blocking: boolean }>).filter(({ blocking }) => blocking)
        .length,
    ).toBeGreaterThan(100);

    for (let pass = 0; evaluated.body.status !== 'DIAGNOSIS_READY' && pass < 3; pass += 1) {
      const pending = (
        evaluated.body.questions as Array<{
          factKey: string;
          scopeKey: string;
          valueType: string;
          choices: Array<{ value: string }>;
          blocking: boolean;
        }>
      )
        .filter(({ blocking }) => blocking)
        .map((question) => ({
          factKey: question.factKey,
          scopeKey: question.scopeKey,
          answerState: 'KNOWN',
          value:
            question.valueType === 'BOOLEAN'
              ? false
              : question.valueType === 'INTEGER'
                ? 1
                : question.valueType === 'MULTI_CHOICE'
                  ? [question.choices[0]!.value]
                  : question.valueType === 'SINGLE_CHOICE'
                    ? question.choices[0]!.value
                    : 'Contexto técnico de prueba',
        }));
      expect(pending.length).toBeGreaterThan(0);
      revision = evaluated.body.sessionRevision as number;
      for (let offset = 0; offset < pending.length; offset += 100) {
        const saved = await authenticated(owner.token, organizationId)
          .post(`/sessions/${created.body.id as string}/answers`)
          .send({ expectedSessionRevision: revision, answers: pending.slice(offset, offset + 100) })
          .expect(201);
        revision = saved.body.sessionRevision as number;
      }
      evaluated = await authenticated(owner.token, organizationId)
        .post(`/sessions/${created.body.id as string}/evaluate`)
        .send({ expectedSessionRevision: revision })
        .expect(201);
    }
    expect(evaluated.body.status).toBe('DIAGNOSIS_READY');
    const finalized = await authenticated(owner.token, organizationId)
      .post(`/sessions/${created.body.id as string}/finalize`)
      .send({ expectedSessionRevision: evaluated.body.sessionRevision })
      .expect(201);
    const profile = await prisma.organizationSstProfileVersion.findUniqueOrThrow({
      where: { id: finalized.body.profileVersionId as string },
    });
    const snapshot = profile.snapshot as {
      organization: { workCenterCount: number };
      contextFacts: Array<{ key: string; scope: string }>;
    };
    expect(snapshot.organization.workCenterCount).toBe(100);
    expect(
      snapshot.contextFacts.filter(
        ({ scope, key }) =>
          scope === 'WORK_CENTER' &&
          [
            'CHEMICAL_PROCESS_PRESENT',
            'HIGH_ENERGY_OPERATION_PRESENT',
            'CONTRACTOR_OR_EXTERNAL_PERSONNEL_PRESENT',
          ].includes(key),
      ),
    ).toHaveLength(300);
  }, 30_000);

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
