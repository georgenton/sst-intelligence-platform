import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request, { type Test as SuperTestRequest } from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  TECHNICAL_ASSESSMENT_MUTATION_SYNC,
  type TechnicalAssessmentMutationOperation,
  type TechnicalAssessmentMutationSync,
  type TechnicalAssessmentMutationSyncContext,
} from '../src/technical-risk/technical-assessment-mutation-sync';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function bounded<T>(promise: Promise<T>, label: string, details: () => object): Promise<T> {
  const signal = AbortSignal.timeout(10_000);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new Error(`${label}:${JSON.stringify(details())}`));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error instanceof Error ? error : new Error(label));
      },
    );
  });
}

type MutationObservation = {
  assessmentId: string;
  operation: TechnicalAssessmentMutationOperation;
  phase: TechnicalAssessmentMutationSyncContext['phase'];
  pid: number;
};

type ActiveMutationBarrier = {
  assessmentId: string;
  winnerOperation: TechnicalAssessmentMutationOperation;
  winnerClaimed: Deferred<MutationObservation>;
  arrivals: Map<TechnicalAssessmentMutationOperation, Deferred<MutationObservation>>;
  observations: Map<TechnicalAssessmentMutationOperation, MutationObservation>;
  releaseWinner: Deferred<void>;
};

class IntegrationTechnicalAssessmentMutationSync implements TechnicalAssessmentMutationSync {
  private active?: ActiveMutationBarrier;

  holdAfterSuccessfulClaim(
    assessmentId: string,
    winnerOperation: TechnicalAssessmentMutationOperation,
  ) {
    if (this.active) throw new Error('TECHNICAL_MUTATION_BARRIER_ALREADY_ACTIVE');
    const state: ActiveMutationBarrier = {
      assessmentId,
      winnerOperation,
      winnerClaimed: deferred<MutationObservation>(),
      arrivals: new Map(),
      observations: new Map(),
      releaseWinner: deferred<void>(),
    };
    this.active = state;
    return {
      waitForWinner: () =>
        bounded(state.winnerClaimed.promise, 'TECHNICAL_MUTATION_WINNER_TIMEOUT', () =>
          this.diagnostics(state),
        ),
      waitForArrival: (operation: TechnicalAssessmentMutationOperation) =>
        bounded(this.arrival(state, operation).promise, 'TECHNICAL_MUTATION_ARRIVAL_TIMEOUT', () =>
          this.diagnostics(state),
        ),
      release: () => state.releaseWinner.resolve(),
      diagnostics: () => this.diagnostics(state),
      cleanup: () => {
        state.releaseWinner.resolve();
        if (this.active === state) this.active = undefined;
      },
    };
  }

  async point(context: TechnicalAssessmentMutationSyncContext) {
    const state = this.active;
    if (!state || context.assessmentId !== state.assessmentId) return;
    const [backend] = await context.tx.$queryRaw<Array<{ pid: number }>>(Prisma.sql`
      SELECT pg_backend_pid()::int AS pid
    `);
    if (!backend) throw new Error('TECHNICAL_MUTATION_BACKEND_PID_UNAVAILABLE');
    const observation: MutationObservation = {
      assessmentId: context.assessmentId,
      operation: context.operation,
      phase: context.phase,
      pid: backend.pid,
    };
    state.observations.set(context.operation, observation);
    if (context.phase === 'BEFORE_CLAIM') {
      this.arrival(state, context.operation).resolve(observation);
      return;
    }
    if (context.operation === state.winnerOperation) {
      state.winnerClaimed.resolve(observation);
      await bounded(state.releaseWinner.promise, 'TECHNICAL_MUTATION_RELEASE_TIMEOUT', () =>
        this.diagnostics(state),
      );
    }
  }

  private arrival(state: ActiveMutationBarrier, operation: TechnicalAssessmentMutationOperation) {
    let arrival = state.arrivals.get(operation);
    if (!arrival) {
      arrival = deferred<MutationObservation>();
      state.arrivals.set(operation, arrival);
    }
    return arrival;
  }

  private diagnostics(state: ActiveMutationBarrier) {
    return {
      assessmentId: state.assessmentId,
      operation: state.winnerOperation,
      phase: 'AFTER_SUCCESSFUL_CLAIM',
      observations: [...state.observations.values()].map(({ operation, phase, pid }) => ({
        operation,
        phase,
        pid,
      })),
    };
  }
}

describe('technical risk integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const mutationSync = new IntegrationTechnicalAssessmentMutationSync();
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TECHNICAL_ASSESSMENT_MUTATION_SYNC)
      .useValue(mutationSync)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => app.close());

  type AssessmentLockWaiter = {
    pid: number;
    state: string;
    waitEventType: string | null;
    waitEvent: string | null;
    blockingPids: number[];
  };

  async function waitForExactAssessmentBlock(input: {
    assessmentId: string;
    operation: TechnicalAssessmentMutationOperation;
    winnerPid: number;
    loserPid: number;
  }) {
    const deadline = Date.now() + 10_000;
    let lastWaiter: AssessmentLockWaiter | undefined;
    while (Date.now() < deadline) {
      const [waiter] = await prisma.$queryRaw<AssessmentLockWaiter[]>(Prisma.sql`
      SELECT
        pid::int AS pid,
        state,
        wait_event_type AS "waitEventType",
        wait_event AS "waitEvent",
        pg_blocking_pids(pid) AS "blockingPids"
      FROM pg_stat_activity
      WHERE pid = ${input.loserPid}
        AND datname = current_database()
        AND state = 'active'
        AND wait_event_type = 'Lock'
        AND query LIKE '%TechnicalAssessment%'
        AND query LIKE 'UPDATE%'
    `);
      lastWaiter = waiter;
      if (waiter?.blockingPids.includes(input.winnerPid)) return waiter;
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    throw new Error(
      `TECHNICAL_MUTATION_BLOCK_TIMEOUT:${JSON.stringify({
        assessmentId: input.assessmentId,
        operation: input.operation,
        phase: 'BEFORE_CLAIM',
        winnerPid: input.winnerPid,
        loserPid: input.loserPid,
        waitEvent: lastWaiter?.waitEvent ?? null,
        blockingPids: lastWaiter?.blockingPids ?? [],
      })}`,
    );
  }

  async function raceWithClaimWinner<T>(input: {
    assessmentId: string;
    winnerOperation: TechnicalAssessmentMutationOperation;
    loserOperation: TechnicalAssessmentMutationOperation;
    winner: () => PromiseLike<T>;
    loser: () => PromiseLike<T>;
  }) {
    const control = mutationSync.holdAfterSuccessfulClaim(
      input.assessmentId,
      input.winnerOperation,
    );
    let winner: Promise<T> | undefined;
    let loser: Promise<T> | undefined;
    let step = 'START_WINNER';
    try {
      winner = Promise.resolve(input.winner());
      step = 'WAIT_WINNER_CLAIM';
      const winnerObservation = await control.waitForWinner();
      step = 'START_LOSER';
      loser = Promise.resolve(input.loser());
      step = 'WAIT_LOSER_ARRIVAL';
      const loserObservation = await control.waitForArrival(input.loserOperation);
      step = 'CONFIRM_LOSER_BLOCKED';
      await waitForExactAssessmentBlock({
        assessmentId: input.assessmentId,
        operation: input.loserOperation,
        winnerPid: winnerObservation.pid,
        loserPid: loserObservation.pid,
      });
      step = 'RELEASE_WINNER';
      control.release();
      step = 'WAIT_HTTP_RESULTS';
      return await bounded(
        Promise.all([winner, loser] as const),
        'TECHNICAL_MUTATION_RESULTS_TIMEOUT',
        () => ({ ...control.diagnostics(), step }),
      );
    } finally {
      control.release();
      control.cleanup();
      const pending: Promise<unknown>[] = [];
      if (winner) pending.push(winner);
      if (loser) pending.push(loser);
      await bounded(Promise.allSettled(pending), 'TECHNICAL_MUTATION_SETTLEMENT_TIMEOUT', () => ({
        ...control.diagnostics(),
        step: 'CLEANUP',
      }));
    }
  }

  async function createContext(label: string) {
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `technical-risk-${label}-${suffix}@example.test`,
        displayName: `Responsable ${label}`,
        password: 'technical-risk-password-123',
      })
      .expect(201);
    const token = register.body.accessToken as string;
    const organization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Technical ${label} ${suffix}`, country: 'Ecuador' });
    if (organization.status !== 201) {
      throw new Error(
        `TECHNICAL_CONTEXT_ORGANIZATION_FAILED:${JSON.stringify({
          label,
          status: organization.status,
          code: organization.body?.code ?? null,
          message: organization.body?.message ?? null,
        })}`,
      );
    }
    const organizationId = organization.body.id as string;
    const module = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'TECHNICAL_RISK' },
      select: { id: true },
    });
    await prisma.organizationModule.create({
      data: {
        organizationId,
        moduleId: module.id,
        status: 'DEMO',
        source: 'MANUAL',
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const stored = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { workCenters: { select: { id: true } } },
    });
    return {
      token,
      userId: register.body.user.id as string,
      organizationId,
      workCenterId: stored.workCenters[0]!.id,
    };
  }

  async function createMutationRaceContext(label: string) {
    const context = await createContext(label);
    const methods = await request(app.getHttpServer())
      .get('/api/v1/technical-risk/methods')
      .set('Authorization', `Bearer ${context.token}`)
      .set('x-organization-id', context.organizationId)
      .expect(200);
    const methodVersionId = methods.body.find(
      (method: { key: string }) => method.key === 'DEMO_TECHNICAL_RISK',
    ).id as string;
    const headers = (call: SuperTestRequest) =>
      call
        .set('Authorization', `Bearer ${context.token}`)
        .set('x-organization-id', context.organizationId)
        .timeout({ response: 5_000, deadline: 10_000 });
    const createDraft = async (title: string) => {
      const created = await headers(
        request(app.getHttpServer()).post('/api/v1/technical-risk/assessments'),
      )
        .send({ methodVersionId, workCenterId: context.workCenterId, title })
        .expect(201);
      return created.body.id as string;
    };
    const createReady = async (title: string) => {
      const id = await createDraft(title);
      await headers(
        request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${id}/start`),
      ).expect(201);
      await prisma.technicalAssessmentResponse.createMany({
        data: [
          {
            organizationId: context.organizationId,
            assessmentId: id,
            questionKey: 'activityDescription',
            value: 'Actividad para carrera controlada',
          },
          {
            organizationId: context.organizationId,
            assessmentId: id,
            questionKey: 'likelihood',
            value: 2,
          },
          {
            organizationId: context.organizationId,
            assessmentId: id,
            questionKey: 'consequence',
            value: 5,
          },
        ],
      });
      const prepared = await prisma.technicalAssessmentResponse.findMany({
        where: { assessmentId: id },
        select: { questionKey: true },
      });
      const preparedKeys = prepared.map(({ questionKey }) => questionKey).sort();
      const expectedKeys = ['activityDescription', 'consequence', 'likelihood'];
      if (JSON.stringify(preparedKeys) !== JSON.stringify(expectedKeys)) {
        throw new Error(
          `TECHNICAL_MUTATION_SETUP_INCOMPLETE:${JSON.stringify({
            assessmentId: id,
            operation: 'UPSERT_RESPONSE',
            phase: 'SETUP',
            preparedKeys,
          })}`,
        );
      }
      return id;
    };
    return { context, headers, createDraft, createReady };
  }

  let mutationRaceContext: Awaited<ReturnType<typeof createMutationRaceContext>>;
  beforeAll(async () => {
    mutationRaceContext = await createMutationRaceContext('mutation-races');
  });

  it('calculates, persists, reviews and tenant-scopes a versioned assessment', async () => {
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `technical-risk-${suffix}@example.test`,
        displayName: 'Responsable técnico',
        password: 'technical-risk-password-123',
      })
      .expect(201);
    const token = register.body.accessToken as string;
    const userId = register.body.user.id as string;
    const orgA = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Technical A ${suffix}`, country: 'Ecuador' })
      .expect(201);
    const orgB = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Technical B ${suffix}`, country: 'Ecuador' })
      .expect(201);
    const orgAId = orgA.body.id as string;
    const orgBId = orgB.body.id as string;
    const module = await prisma.moduleDefinition.findUniqueOrThrow({
      where: { key: 'TECHNICAL_RISK' },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .get('/api/v1/technical-risk/methods')
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .expect(403);

    for (const organizationId of [orgAId, orgBId]) {
      await prisma.organizationModule.create({
        data: {
          organizationId,
          moduleId: module.id,
          status: 'DEMO',
          source: 'MANUAL',
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
    }

    const methods = await request(app.getHttpServer())
      .get('/api/v1/technical-risk/methods')
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .expect(200);
    expect(methods.body).toHaveLength(1);
    expect(methods.body[0]).toMatchObject({
      key: 'DEMO_TECHNICAL_RISK',
      version: '1.0.0',
      regulatory: false,
      isDemo: true,
    });
    const demoMethodVersionId = methods.body[0].id as string;
    const tenantBMethod = await prisma.technicalMethodDefinition.create({
      data: {
        organizationId: orgBId,
        key: `TENANT_B_DEMO_${suffix}`,
        name: 'Método sintético tenant B',
        description: 'Método aislado para integración.',
        category: 'GENERAL_RISK',
        status: 'ACTIVE',
        versions: {
          create: {
            organizationId: orgBId,
            version: '1.0.0',
            schema: methods.body[0].schema,
            calculationKey: 'DEMO_TECHNICAL_RISK_5X5',
            regulatory: false,
            status: 'ACTIVE',
          },
        },
      },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/technical-risk/methods/${tenantBMethod.key}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/technical-risk/methods/${tenantBMethod.key}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgBId)
      .expect(200);
    const nonDemoMethod = await request(app.getHttpServer())
      .get(`/api/v1/technical-risk/methods/${tenantBMethod.key}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgBId)
      .expect(200);
    expect(nonDemoMethod.body).toMatchObject({
      regulatory: false,
      isDemo: false,
      disclaimer: null,
    });

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: orgAId },
      select: { workCenters: { select: { id: true } } },
    });
    const created = await request(app.getHttpServer())
      .post('/api/v1/technical-risk/assessments')
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({
        methodVersionId: demoMethodVersionId,
        workCenterId: organization.workCenters[0]!.id,
        title: 'Evaluación de integración',
        score: 1,
      })
      .expect(400);
    expect(created.body).not.toHaveProperty('result');

    const assessment = await request(app.getHttpServer())
      .post('/api/v1/technical-risk/assessments')
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({
        methodVersionId: demoMethodVersionId,
        workCenterId: organization.workCenters[0]!.id,
        title: 'Evaluación de integración',
      })
      .expect(201);
    const assessmentId = assessment.body.id as string;
    expect(assessment.body.methodSnapshot).toMatchObject({
      methodKey: 'DEMO_TECHNICAL_RISK',
      methodVersion: '1.0.0',
      isDemo: true,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({ decision: 'APPROVED' })
      .expect(409);

    await request(app.getHttpServer())
      .get(`/api/v1/technical-risk/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgBId)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .expect(201);

    await request(app.getHttpServer())
      .put(`/api/v1/technical-risk/assessments/${assessmentId}/responses/likelihood`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgBId)
      .send({ value: 4 })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/evidence`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgBId)
      .send({ type: 'NOTE', note: 'No debe cruzar tenants.' })
      .expect(404);

    await request(app.getHttpServer())
      .put(`/api/v1/technical-risk/assessments/${assessmentId}/responses/unknown`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({ value: 4 })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/api/v1/technical-risk/assessments/${assessmentId}/responses/likelihood`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({ value: '4' })
      .expect(400);

    for (const [questionKey, value] of Object.entries({
      activityDescription: 'Actividad sintética de integración',
      likelihood: 4,
      consequence: 5,
    })) {
      await request(app.getHttpServer())
        .put(`/api/v1/technical-risk/assessments/${assessmentId}/responses/${questionKey}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', orgAId)
        .send({ value })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/evidence`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({
        type: 'NOTE',
        questionKey: 'likelihood',
        note: 'Evidencia sintética de integración.',
      })
      .expect(201);

    const completed = await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .expect(201);
    expect(completed.body).toMatchObject({ score: 20, level: 'CRITICAL' });
    await request(app.getHttpServer())
      .get(`/api/v1/technical-risk/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgBId)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgBId)
      .send({ decision: 'APPROVED' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('ASSESSMENT_ALREADY_COMPLETED'));

    await prisma.membership.update({
      where: { userId_organizationId: { userId, organizationId: orgAId } },
      data: { role: 'SST_TECHNICIAN' },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({ decision: 'APPROVED' })
      .expect(403);
    await prisma.membership.update({
      where: { userId_organizationId: { userId, organizationId: orgAId } },
      data: { role: 'VIEWER' },
    });
    await request(app.getHttpServer())
      .post('/api/v1/technical-risk/assessments')
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({
        methodVersionId: demoMethodVersionId,
        workCenterId: organization.workCenters[0]!.id,
        title: 'Viewer no puede crear',
      })
      .expect(403);
    await prisma.membership.update({
      where: { userId_organizationId: { userId, organizationId: orgAId } },
      data: { role: 'ORG_OWNER' },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/technical-risk/assessments/${assessmentId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .send({
        decision: 'APPROVED',
        comment: 'Revisión profesional de integración.',
        selfReviewAcknowledged: true,
      })
      .expect(201);
    const reviewed = await request(app.getHttpServer())
      .get(`/api/v1/technical-risk/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', orgAId)
      .expect(200);
    expect(reviewed.body).toMatchObject({ status: 'REVIEWED', result: { score: 20 } });
    expect(reviewed.body.reviews).toHaveLength(1);

    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: orgAId,
          action: {
            in: [
              'TECHNICAL_ASSESSMENT_CREATED',
              'TECHNICAL_ASSESSMENT_STARTED',
              'TECHNICAL_RESPONSE_SAVED',
              'TECHNICAL_EVIDENCE_ADDED',
              'TECHNICAL_ASSESSMENT_COMPLETED',
              'TECHNICAL_ASSESSMENT_REVIEWED',
            ],
          },
        },
      }),
    ).toBe(8);
  }, 60_000);

  it('enforces validity windows and preserves an explicitly selected method version', async () => {
    const context = await createContext('versions');
    const demoMethods = await request(app.getHttpServer())
      .get('/api/v1/technical-risk/methods')
      .set('Authorization', `Bearer ${context.token}`)
      .set('x-organization-id', context.organizationId)
      .expect(200);
    const baseSchema = demoMethods.body.find(
      (method: { key: string }) => method.key === 'DEMO_TECHNICAL_RISK',
    ).schema;
    const schemaV1 = structuredClone(baseSchema);
    const schemaV2 = structuredClone(baseSchema);
    schemaV1.sections[0].title = 'Contexto versión uno';
    schemaV2.sections[0].title = 'Contexto versión dos';
    const definition = await prisma.technicalMethodDefinition.create({
      data: {
        organizationId: context.organizationId,
        key: `TEST_VERSIONED_METHOD_${suffix}`,
        name: 'Método versionado de prueba',
        description: 'Método no regulatorio y no demostrativo.',
        category: 'GENERAL_RISK',
        status: 'ACTIVE',
      },
    });
    const createVersion = (version: string, data: Record<string, unknown> = {}) =>
      prisma.technicalMethodVersion.create({
        data: {
          organizationId: context.organizationId,
          methodDefinitionId: definition.id,
          version,
          schema: version === '1.0.0' ? schemaV1 : schemaV2,
          calculationKey: 'DEMO_TECHNICAL_RISK_5X5',
          regulatory: false,
          isDemo: false,
          disclaimer: null,
          status: 'ACTIVE',
          ...data,
        },
      });
    const activeV1 = await createVersion('1.0.0');
    const activeV2 = await createVersion('2.0.0');
    const future = await createVersion('3.0.0', {
      validFrom: new Date(Date.now() + 86_400_000),
    });
    const expired = await createVersion('0.9.0', {
      validTo: new Date(Date.now() - 86_400_000),
    });
    const inactive = await createVersion('4.0.0', { status: 'INACTIVE' });

    const catalog = await request(app.getHttpServer())
      .get('/api/v1/technical-risk/methods')
      .set('Authorization', `Bearer ${context.token}`)
      .set('x-organization-id', context.organizationId)
      .expect(200);
    const visibleIds = new Set(catalog.body.map((method: { id: string }) => method.id));
    expect(visibleIds.has(activeV1.id)).toBe(true);
    expect(visibleIds.has(activeV2.id)).toBe(true);
    expect(visibleIds.has(future.id)).toBe(false);
    expect(visibleIds.has(expired.id)).toBe(false);
    expect(visibleIds.has(inactive.id)).toBe(false);

    for (const unavailable of [future, expired, inactive]) {
      await request(app.getHttpServer())
        .post('/api/v1/technical-risk/assessments')
        .set('Authorization', `Bearer ${context.token}`)
        .set('x-organization-id', context.organizationId)
        .send({
          methodVersionId: unavailable.id,
          workCenterId: context.workCenterId,
          title: `Versión no disponible ${unavailable.version}`,
        })
        .expect(404);
    }

    await request(app.getHttpServer())
      .post('/api/v1/technical-risk/assessments')
      .set('Authorization', `Bearer ${context.token}`)
      .set('x-organization-id', context.organizationId)
      .send({
        methodKey: definition.key,
        workCenterId: context.workCenterId,
        title: 'Sin versión exacta',
      })
      .expect(400);

    for (const [version, expectedTitle] of [
      [activeV1, 'Contexto versión uno'],
      [activeV2, 'Contexto versión dos'],
    ] as const) {
      const created = await request(app.getHttpServer())
        .post('/api/v1/technical-risk/assessments')
        .set('Authorization', `Bearer ${context.token}`)
        .set('x-organization-id', context.organizationId)
        .send({
          methodVersionId: version.id,
          workCenterId: context.workCenterId,
          title: `Selección exacta ${version.version}`,
        })
        .expect(201);
      expect(created.body).toMatchObject({
        methodVersionId: version.id,
        methodVersion: version.version,
        isDemo: false,
        methodSnapshot: {
          methodVersion: version.version,
          isDemo: false,
          regulatory: false,
          disclaimer: null,
        },
      });
      expect(created.body.methodSnapshot.schema.sections[0].title).toBe(expectedTitle);
    }
  }, 60_000);

  it('creates one linear correction with the exact method version and audits self-review', async () => {
    const { context, headers, createReady } = mutationRaceContext;
    const sourceId = await createReady('Evaluación que requiere corrección');
    await headers(
      request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${sourceId}/complete`),
    ).expect(201);
    await headers(
      request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${sourceId}/review`),
    )
      .send({ decision: 'NEEDS_REVISION', comment: 'Ajustar la probabilidad observada.' })
      .expect(201);
    await headers(
      request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${sourceId}/review`),
    )
      .send({
        decision: 'APPROVED',
        comment: 'No debe aprobar la versión sin cambios.',
        selfReviewAcknowledged: true,
      })
      .expect(409);

    const corrections = await Promise.all([
      headers(
        request(app.getHttpServer()).post(
          `/api/v1/technical-risk/assessments/${sourceId}/revisions`,
        ),
      ),
      headers(
        request(app.getHttpServer()).post(
          `/api/v1/technical-risk/assessments/${sourceId}/revisions`,
        ),
      ),
    ]);
    expect(corrections.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(
      await prisma.technicalAssessment.count({ where: { revisedFromAssessmentId: sourceId } }),
    ).toBe(1);
    const correction = corrections.find(({ status }) => status === 201)!;
    const correctionId = correction.body.id as string;
    const source = await prisma.technicalAssessment.findUniqueOrThrow({
      where: { id: sourceId },
      include: { responses: true, result: true, reviews: true, revision: true },
    });
    expect(correction.body).toMatchObject({
      id: correctionId,
      revisedFromAssessmentId: sourceId,
      methodVersionId: source.methodVersionId,
      status: 'DRAFT',
    });
    expect(correction.body.responses).toHaveLength(source.responses.length);
    expect(correction.body.evidence).toHaveLength(0);
    expect(correction.body.revisedFrom.reviews[0]).toMatchObject({
      decision: 'NEEDS_REVISION',
      comment: 'Ajustar la probabilidad observada.',
    });

    await headers(
      request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${correctionId}/start`),
    ).expect(201);
    await headers(
      request(app.getHttpServer()).put(
        `/api/v1/technical-risk/assessments/${correctionId}/responses/likelihood`,
      ),
    )
      .send({ value: 4 })
      .expect(200);
    await headers(
      request(app.getHttpServer()).post(
        `/api/v1/technical-risk/assessments/${correctionId}/complete`,
      ),
    ).expect(201);
    await headers(
      request(app.getHttpServer()).post(
        `/api/v1/technical-risk/assessments/${correctionId}/review`,
      ),
    )
      .send({ decision: 'APPROVED' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('SELF_REVIEW_ACKNOWLEDGEMENT_REQUIRED'));
    await headers(
      request(app.getHttpServer()).post(
        `/api/v1/technical-risk/assessments/${correctionId}/review`,
      ),
    )
      .send({
        decision: 'APPROVED',
        comment: 'Confirmo la autorrevisión de la corrección.',
        selfReviewAcknowledged: true,
      })
      .expect(201);

    const storedSource = await prisma.technicalAssessment.findUniqueOrThrow({
      where: { id: sourceId },
      include: { result: true, reviews: true },
    });
    const storedCorrection = await prisma.technicalAssessment.findUniqueOrThrow({
      where: { id: correctionId },
      include: { reviews: true },
    });
    expect(storedSource).toMatchObject({ status: 'COMPLETED', result: source.result });
    expect(storedSource.reviews).toHaveLength(1);
    expect(storedCorrection.status).toBe('REVIEWED');
    expect(storedCorrection.reviews[0]).toMatchObject({
      isSelfReview: true,
      selfReviewAcknowledged: true,
    });
    expect(storedCorrection.methodVersionId).toBe(source.methodVersionId);
    expect(storedCorrection.organizationId).toBe(context.organizationId);
  }, 60_000);

  it('enforces HIGH and CRITICAL self-review while preserving the normal reviewer path', async () => {
    const { context } = mutationRaceContext;
    const methods = await request(app.getHttpServer())
      .get('/api/v1/technical-risk/methods')
      .set('Authorization', `Bearer ${context.token}`)
      .set('x-organization-id', context.organizationId)
      .expect(200);
    const methodVersionId = methods.body.find(
      (method: { key: string }) => method.key === 'DEMO_TECHNICAL_RISK',
    ).id as string;
    const ownerHeaders = (call: SuperTestRequest) =>
      call
        .set('Authorization', `Bearer ${context.token}`)
        .set('x-organization-id', context.organizationId);
    const reviewer = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `technical-reviewer-${suffix}@example.test`,
        displayName: 'Revisor SST',
        password: 'technical-reviewer-password-123',
      })
      .expect(201);
    await prisma.membership.create({
      data: {
        organizationId: context.organizationId,
        userId: reviewer.body.user.id as string,
        role: 'SST_MANAGER',
        status: 'ACTIVE',
      },
    });
    const reviewerHeaders = (call: SuperTestRequest) =>
      call
        .set('Authorization', `Bearer ${reviewer.body.accessToken as string}`)
        .set('x-organization-id', context.organizationId);

    const createCompleted = async (
      title: string,
      likelihood: number,
      consequence: number,
      expectedLevel: 'HIGH' | 'CRITICAL',
    ) => {
      const created = await ownerHeaders(
        request(app.getHttpServer()).post('/api/v1/technical-risk/assessments'),
      )
        .send({ methodVersionId, workCenterId: context.workCenterId, title })
        .expect(201);
      const assessmentId = created.body.id as string;
      await ownerHeaders(
        request(app.getHttpServer()).post(
          `/api/v1/technical-risk/assessments/${assessmentId}/start`,
        ),
      ).expect(201);
      for (const [questionKey, value] of [
        ['activityDescription', 'Actividad para matriz de autorrevisión'],
        ['likelihood', likelihood],
        ['consequence', consequence],
      ] as const) {
        await ownerHeaders(
          request(app.getHttpServer()).put(
            `/api/v1/technical-risk/assessments/${assessmentId}/responses/${questionKey}`,
          ),
        )
          .send({ value })
          .expect(200);
      }
      await ownerHeaders(
        request(app.getHttpServer()).post(
          `/api/v1/technical-risk/assessments/${assessmentId}/complete`,
        ),
      )
        .expect(201)
        .expect(({ body }) => expect(body.level).toBe(expectedLevel));
      return assessmentId;
    };

    const highId = await createCompleted('Autorrevisión HIGH', 4, 4, 'HIGH');
    await ownerHeaders(
      request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${highId}/review`),
    )
      .send({ decision: 'APPROVED' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('SELF_REVIEW_ACKNOWLEDGEMENT_REQUIRED'));
    const highComment = 'Confirmo la autorrevisión HIGH.';
    expect(highComment.length).toBeLessThanOrEqual(2_000);
    await ownerHeaders(
      request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${highId}/review`),
    )
      .send({
        decision: 'APPROVED',
        comment: highComment,
        selfReviewAcknowledged: true,
      })
      .expect(201)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          isSelfReview: true,
          selfReviewAcknowledged: true,
          comment: highComment,
        }),
      );

    const criticalId = await createCompleted('Autorrevisión CRITICAL', 4, 5, 'CRITICAL');
    await ownerHeaders(
      request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${criticalId}/review`),
    )
      .send({ decision: 'APPROVED' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('SELF_REVIEW_ACKNOWLEDGEMENT_REQUIRED'));
    const criticalComment = 'Confirmo la autorrevisión CRITICAL.';
    expect(criticalComment.length).toBeLessThanOrEqual(2_000);
    await ownerHeaders(
      request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${criticalId}/review`),
    )
      .send({
        decision: 'APPROVED',
        comment: criticalComment,
        selfReviewAcknowledged: true,
      })
      .expect(201)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          isSelfReview: true,
          selfReviewAcknowledged: true,
          comment: criticalComment,
        }),
      );

    const differentReviewerId = await createCompleted(
      'Revisión por responsable diferente',
      4,
      5,
      'CRITICAL',
    );
    await reviewerHeaders(
      request(app.getHttpServer()).post(
        `/api/v1/technical-risk/assessments/${differentReviewerId}/review`,
      ),
    )
      .send({ decision: 'APPROVED' })
      .expect(201)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          reviewerUserId: reviewer.body.user.id,
          isSelfReview: false,
          selfReviewAcknowledged: false,
        }),
      );
  }, 60_000);

  it('serializes concurrent completion and review decisions without duplicate records', async () => {
    const context = await createContext('concurrency');
    const methods = await request(app.getHttpServer())
      .get('/api/v1/technical-risk/methods')
      .set('Authorization', `Bearer ${context.token}`)
      .set('x-organization-id', context.organizationId)
      .expect(200);
    const methodVersionId = methods.body.find(
      (method: { key: string }) => method.key === 'DEMO_TECHNICAL_RISK',
    ).id as string;
    const headers = (call: SuperTestRequest) =>
      call
        .set('Authorization', `Bearer ${context.token}`)
        .set('x-organization-id', context.organizationId);

    const createReady = async (title: string) => {
      const created = await headers(
        request(app.getHttpServer()).post('/api/v1/technical-risk/assessments'),
      )
        .send({ methodVersionId, workCenterId: context.workCenterId, title })
        .expect(201);
      const id = created.body.id as string;
      await headers(
        request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${id}/start`),
      ).expect(201);
      for (const [questionKey, value] of Object.entries({
        activityDescription: 'Actividad concurrente',
        likelihood: 3,
        consequence: 4,
      })) {
        await headers(
          request(app.getHttpServer()).put(
            `/api/v1/technical-risk/assessments/${id}/responses/${questionKey}`,
          ),
        )
          .send({ value })
          .expect(200);
      }
      return id;
    };

    const assessmentId = await createReady('Finalización concurrente');
    const completions = await Promise.all([
      headers(
        request(app.getHttpServer()).post(
          `/api/v1/technical-risk/assessments/${assessmentId}/complete`,
        ),
      ),
      headers(
        request(app.getHttpServer()).post(
          `/api/v1/technical-risk/assessments/${assessmentId}/complete`,
        ),
      ),
    ]);
    expect(completions.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(completions.find(({ status }) => status === 409)?.body.code).toBe(
      'ASSESSMENT_ALREADY_COMPLETED',
    );
    expect(await prisma.technicalAssessmentResult.count({ where: { assessmentId } })).toBe(1);

    const approvals = await Promise.all([
      headers(
        request(app.getHttpServer()).post(
          `/api/v1/technical-risk/assessments/${assessmentId}/review`,
        ),
      ).send({
        decision: 'APPROVED',
        comment: 'Autorrevisión concurrente justificada.',
        selfReviewAcknowledged: true,
      }),
      headers(
        request(app.getHttpServer()).post(
          `/api/v1/technical-risk/assessments/${assessmentId}/review`,
        ),
      ).send({
        decision: 'APPROVED',
        comment: 'Autorrevisión concurrente justificada.',
        selfReviewAcknowledged: true,
      }),
    ]);
    expect(approvals.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(approvals.find(({ status }) => status === 409)?.body.code).toBe(
      'ASSESSMENT_NOT_READY_FOR_REVIEW',
    );
    expect(await prisma.technicalAssessmentReview.count({ where: { assessmentId } })).toBe(1);

    const mixedId = await createReady('Revisión concurrente mixta');
    await headers(
      request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${mixedId}/complete`),
    ).expect(201);
    const mixed = await Promise.all([
      headers(
        request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${mixedId}/review`),
      ).send({ decision: 'NEEDS_REVISION' }),
      headers(
        request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${mixedId}/review`),
      ).send({
        decision: 'APPROVED',
        comment: 'Autorrevisión concurrente justificada.',
        selfReviewAcknowledged: true,
      }),
    ]);
    expect(mixed.map(({ status }) => status).sort()).toEqual([201, 409]);
    const stored = await prisma.technicalAssessment.findUniqueOrThrow({
      where: { id: mixedId },
      include: { reviews: true },
    });
    expect(stored.reviews).toHaveLength(1);
    expect(stored.reviewedAt).not.toBeNull();
    expect(stored.status).toBe(
      stored.reviews[0]!.decision === 'APPROVED' ? 'REVIEWED' : 'COMPLETED',
    );
  }, 60_000);

  it('serializes concurrent start and rolls back incomplete completion', async () => {
    const { context, headers, createDraft } = mutationRaceContext;

    const startId = await createDraft('Inicio concurrente');
    const starts = await Promise.all([
      headers(
        request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${startId}/start`),
      ),
      headers(
        request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${startId}/start`),
      ),
    ]);
    expect(starts.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(starts.find(({ status }) => status === 409)?.body.code).toBe(
      'INVALID_TECHNICAL_ASSESSMENT_TRANSITION',
    );

    const rollbackId = await createDraft('Rollback de finalización incompleta');
    await headers(
      request(app.getHttpServer()).post(`/api/v1/technical-risk/assessments/${rollbackId}/start`),
    ).expect(201);
    await headers(
      request(app.getHttpServer()).put(
        `/api/v1/technical-risk/assessments/${rollbackId}/responses/activityDescription`,
      ),
    )
      .send({ value: 'Actividad incompleta' })
      .expect(200);
    await headers(
      request(app.getHttpServer()).post(
        `/api/v1/technical-risk/assessments/${rollbackId}/complete`,
      ),
    )
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('TECHNICAL_ASSESSMENT_INCOMPLETE'));
    const rollbackState = await prisma.technicalAssessment.findUniqueOrThrow({
      where: { id: rollbackId },
      include: { result: true },
    });
    expect(rollbackState).toMatchObject({ status: 'IN_PROGRESS', completedAt: null, result: null });
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: context.organizationId,
          entityId: rollbackId,
          action: 'TECHNICAL_ASSESSMENT_COMPLETED',
        },
      }),
    ).toBe(0);
  }, 60_000);

  it('RESPONSE_WRITE_FIRST serializes a response write before completion', async () => {
    const { headers, createReady } = mutationRaceContext;
    const responseId = await createReady('Respuesta contra finalización');
    const [responseWrite, responseCompletion] = await raceWithClaimWinner({
      assessmentId: responseId,
      winnerOperation: 'UPSERT_RESPONSE',
      loserOperation: 'COMPLETE',
      winner: () =>
        headers(
          request(app.getHttpServer()).put(
            `/api/v1/technical-risk/assessments/${responseId}/responses/likelihood`,
          ),
        ).send({ value: 4 }),
      loser: () =>
        headers(
          request(app.getHttpServer()).post(
            `/api/v1/technical-risk/assessments/${responseId}/complete`,
          ),
        ),
    });
    if (responseCompletion.status !== 201) {
      throw new Error(
        `TECHNICAL_MUTATION_COMPLETION_FAILED:${JSON.stringify({
          assessmentId: responseId,
          operation: 'COMPLETE',
          phase: 'RESULT',
          status: responseCompletion.status,
          code: responseCompletion.body?.code ?? null,
        })}`,
      );
    }
    expect(responseWrite.status).toBe(200);
    const responseState = await prisma.technicalAssessment.findUniqueOrThrow({
      where: { id: responseId },
      include: { responses: true, result: true },
    });
    const persistedAnswers = Object.fromEntries(
      responseState.responses.map(({ questionKey, value }) => [questionKey, value]),
    );
    const resultInputs = responseState.result!.result as Record<string, unknown>;
    expect(resultInputs.likelihood).toBe(persistedAnswers.likelihood);
    expect(resultInputs.consequence).toBe(persistedAnswers.consequence);
    expect(responseState.result!.score).toBe(
      Number(persistedAnswers.likelihood) * Number(persistedAnswers.consequence),
    );
    expect(persistedAnswers.likelihood).toBe(4);
  }, 60_000);

  it('COMPLETE_FIRST_RESPONSE rejects a response after completion wins', async () => {
    const { headers, createReady } = mutationRaceContext;
    const lateResponseId = await createReady('Finalización antes de respuesta');
    const [earlyCompletion, lateResponseWrite] = await raceWithClaimWinner({
      assessmentId: lateResponseId,
      winnerOperation: 'COMPLETE',
      loserOperation: 'UPSERT_RESPONSE',
      winner: () =>
        headers(
          request(app.getHttpServer()).post(
            `/api/v1/technical-risk/assessments/${lateResponseId}/complete`,
          ),
        ),
      loser: () =>
        headers(
          request(app.getHttpServer()).put(
            `/api/v1/technical-risk/assessments/${lateResponseId}/responses/likelihood`,
          ),
        ).send({ value: 4 }),
    });
    expect(earlyCompletion.status).toBe(201);
    expect(lateResponseWrite.status).toBe(409);
    expect(lateResponseWrite.body.code).toBe('TECHNICAL_ASSESSMENT_NOT_EDITABLE');
    const lateResponseState = await prisma.technicalAssessment.findUniqueOrThrow({
      where: { id: lateResponseId },
      include: { responses: true, result: true },
    });
    const lateAnswers = Object.fromEntries(
      lateResponseState.responses.map(({ questionKey, value }) => [questionKey, value]),
    );
    const lateResultInputs = lateResponseState.result!.result as Record<string, unknown>;
    expect(lateAnswers.likelihood).toBe(2);
    expect(lateResultInputs.likelihood).toBe(lateAnswers.likelihood);
    expect(lateResponseState.result!.score).toBe(10);
  }, 60_000);

  it('COMPLETE_FIRST_EVIDENCE rejects evidence after completion wins', async () => {
    const { headers, createReady } = mutationRaceContext;
    const evidenceId = await createReady('Evidencia contra finalización');
    const [evidenceCompletion, evidenceWrite] = await raceWithClaimWinner({
      assessmentId: evidenceId,
      winnerOperation: 'COMPLETE',
      loserOperation: 'ADD_EVIDENCE',
      winner: () =>
        headers(
          request(app.getHttpServer()).post(
            `/api/v1/technical-risk/assessments/${evidenceId}/complete`,
          ),
        ),
      loser: () =>
        headers(
          request(app.getHttpServer()).post(
            `/api/v1/technical-risk/assessments/${evidenceId}/evidence`,
          ),
        ).send({ type: 'NOTE', note: 'Evidencia concurrente controlada.' }),
    });
    expect(evidenceCompletion.status).toBe(201);
    expect(evidenceWrite.status).toBe(409);
    const evidenceState = await prisma.technicalAssessment.findUniqueOrThrow({
      where: { id: evidenceId },
      include: { evidence: true },
    });
    expect(evidenceWrite.body.code).toBe('TECHNICAL_ASSESSMENT_NOT_EDITABLE');
    expect(evidenceState.evidence).toHaveLength(0);
  }, 60_000);

  it('COMPLETE_FIRST_PATCH rejects an assessment update after completion wins', async () => {
    const { headers, createReady } = mutationRaceContext;
    const updateId = await createReady('PATCH contra finalización');
    const [updateCompletion, updateWrite] = await raceWithClaimWinner({
      assessmentId: updateId,
      winnerOperation: 'COMPLETE',
      loserOperation: 'UPDATE_ASSESSMENT',
      winner: () =>
        headers(
          request(app.getHttpServer()).post(
            `/api/v1/technical-risk/assessments/${updateId}/complete`,
          ),
        ),
      loser: () =>
        headers(
          request(app.getHttpServer()).patch(`/api/v1/technical-risk/assessments/${updateId}`),
        ).send({ title: 'PATCH serializado antes de completar' }),
    });
    expect(updateCompletion.status).toBe(201);
    expect(updateWrite.status).toBe(409);
    const updateState = await prisma.technicalAssessment.findUniqueOrThrow({
      where: { id: updateId },
    });
    expect(updateWrite.body.code).toBe('TECHNICAL_ASSESSMENT_NOT_EDITABLE');
    expect(updateState.title).toBe('PATCH contra finalización');
    expect(updateState.status).toBe('COMPLETED');
  }, 60_000);

  it('keeps technical method/result history while exposing the live work-center identity', async () => {
    const { context, headers, createReady } = mutationRaceContext;
    const assessmentId = await createReady('Histórico frente a centro vivo');
    await headers(
      request(app.getHttpServer()).post(
        `/api/v1/technical-risk/assessments/${assessmentId}/complete`,
      ),
    ).expect(201);
    const beforeCenterChange = await prisma.technicalAssessment.findUniqueOrThrow({
      where: { id: assessmentId },
      include: { result: true },
    });
    await headers(
      request(app.getHttpServer()).patch(
        `/api/v1/organizations/${context.organizationId}/work-centers/${context.workCenterId}`,
      ),
    )
      .send({ name: `Centro técnico renombrado ${suffix}`, isActive: false })
      .expect(200);
    const afterCenterChange = await prisma.technicalAssessment.findUniqueOrThrow({
      where: { id: assessmentId },
      include: { result: true, workCenter: true },
    });
    expect(afterCenterChange.workCenter.name).toBe(`Centro técnico renombrado ${suffix}`);
    expect(afterCenterChange.methodSnapshot).toEqual(beforeCenterChange.methodSnapshot);
    expect(afterCenterChange.result).toEqual(beforeCenterChange.result);
  }, 60_000);
});
