import { randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  DEMO_APPLICABILITY_RULE_PACK,
  evaluateApplicability,
  type ApplicabilityEvaluationResult,
} from '@sst/contracts';
import {
  COMMITTED_SST_SCENARIOS,
  type SstValidationScenario,
} from '@sst/applicability-scenario-lab';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const REPRESENTATIVE_SCENARIO_IDS = [
  'EC_DEMO_SMALL_SERVICES',
  'EC_DEMO_MULTI_SITE_SERVICES',
  'EC_DEMO_CHEMICAL_PHARMA',
  'EC_DEMO_UNKNOWN_INFORMATION',
] as const;

type ApiAssessment = {
  id: string;
  profileSnapshot: unknown;
  rulePackSnapshot: unknown;
  engineVersion: string;
  decisions: Array<{
    targetKey: string;
    state: string;
    reasonCode: string;
    explanation: string;
    sourceType: string;
    sourceReference: string | null;
    winningRuleId: string | null;
    traces: Array<{
      ruleId: string;
      targetKey: string;
      composition: string;
      ruleResult: string;
      configuredState: string;
      contributedState: string | null;
      reasonCode: string;
      explanation: string;
      predicates: unknown;
    }>;
  }>;
};

function stablePureEvaluation(evaluation: ApplicabilityEvaluationResult) {
  return {
    engineVersion: evaluation.engineVersion,
    decisions: evaluation.decisions.map((decision) => ({
      targetKey: decision.targetKey,
      state: decision.state,
      reasonCode: decision.reasonCode,
      explanation: decision.explanation,
      sourceType: decision.sourceType,
      sourceReference: decision.sourceReference ?? null,
      winningRuleId: decision.winningRuleId,
      traces: decision.trace.map((trace) => ({
        ruleId: trace.ruleId,
        targetKey: trace.targetKey,
        composition: trace.mode,
        ruleResult: trace.result,
        configuredState: trace.configuredState,
        contributedState: trace.contributedState,
        reasonCode: trace.reasonCode,
        explanation: trace.explanation,
        predicates: trace.predicates,
      })),
    })),
  };
}

function stableApiEvaluation(assessment: ApiAssessment) {
  return {
    engineVersion: assessment.engineVersion,
    decisions: assessment.decisions.map((decision) => ({
      targetKey: decision.targetKey,
      state: decision.state,
      reasonCode: decision.reasonCode,
      explanation: decision.explanation,
      sourceType: decision.sourceType,
      sourceReference: decision.sourceReference,
      winningRuleId: decision.winningRuleId,
      traces: decision.traces.map((trace) => ({
        ruleId: trace.ruleId,
        targetKey: trace.targetKey,
        composition: trace.composition,
        ruleResult: trace.ruleResult,
        configuredState: trace.configuredState,
        contributedState: trace.contributedState,
        reasonCode: trace.reasonCode,
        explanation: trace.explanation,
        predicates: trace.predicates,
      })),
    })),
  };
}

describe('adaptive SST scenario API parity', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const identity = randomUUID();
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `scenario-parity-${identity}@example.test`,
        displayName: 'Scenario Parity Owner',
        password: 'scenario-parity-password-strong-123',
      })
      .expect(201);
    token = registration.body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  function applicabilityApi(organizationId: string) {
    return {
      get: (path: string) =>
        request(app.getHttpServer())
          .get(`/api/v1/applicability${path}`)
          .set('Authorization', `Bearer ${token}`)
          .set('x-organization-id', organizationId),
      post: (path: string) =>
        request(app.getHttpServer())
          .post(`/api/v1/applicability${path}`)
          .set('Authorization', `Bearer ${token}`)
          .set('x-organization-id', organizationId),
    };
  }

  async function createScenarioOrganization(scenario: SstValidationScenario) {
    const organization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `${scenario.id} ${randomUUID()}`,
        country: scenario.profileV1Input.organization.country,
        ...(scenario.profileV1Input.organization.sector
          ? { sector: scenario.profileV1Input.organization.sector }
          : {}),
      })
      .expect(201);
    const organizationId = organization.body.id as string;
    const additionalCenters = scenario.workCenters.slice(1).map((center) => ({
      organizationId,
      name: `${center.displayName} ${center.workCenterId}`,
      isDemo: true,
    }));
    if (additionalCenters.length > 0) {
      await prisma.workCenter.createMany({ data: additionalCenters });
    }
    return organizationId;
  }

  it('matches pure evaluation, persisted trace and tenant isolation for a representative subset', async () => {
    const scenarios = REPRESENTATIVE_SCENARIO_IDS.map((id) =>
      COMMITTED_SST_SCENARIOS.find((scenario) => scenario.id === id),
    );
    expect(scenarios.every(Boolean)).toBe(true);

    const rulePack = await prisma.applicabilityRulePackVersion.findUniqueOrThrow({
      where: {
        key_version: {
          key: DEMO_APPLICABILITY_RULE_PACK.key,
          version: DEMO_APPLICABILITY_RULE_PACK.version,
        },
      },
      select: { id: true, schema: true, sourceType: true, regulatory: true, isDemo: true },
    });
    expect(rulePack).toMatchObject({
      schema: DEMO_APPLICABILITY_RULE_PACK,
      sourceType: 'DEMO',
      regulatory: false,
      isDemo: true,
    });

    let firstAssessmentId: string | undefined;
    for (const scenario of scenarios as SstValidationScenario[]) {
      const organizationId = await createScenarioOrganization(scenario);
      const scenarioApi = applicabilityApi(organizationId);
      const profileInput = scenario.profileV1Input;
      const profile = await scenarioApi
        .post('/profile-versions')
        .send({
          ...(profileInput.organization.workerCount === undefined
            ? {}
            : { workerCount: profileInput.organization.workerCount }),
          ...(profileInput.operations.hasChemicalProcesses === undefined
            ? {}
            : { hasChemicalProcesses: profileInput.operations.hasChemicalProcesses }),
          ...(profileInput.operations.hasHighEnergyOperations === undefined
            ? {}
            : { hasHighEnergyOperations: profileInput.operations.hasHighEnergyOperations }),
        })
        .expect(201);
      expect(profile.body.snapshot).toEqual(profileInput);

      const created = await scenarioApi
        .post('/assessments')
        .send({ profileVersionId: profile.body.id, rulePackVersionId: rulePack.id })
        .expect(201);
      const pure = stablePureEvaluation(
        evaluateApplicability(profileInput, DEMO_APPLICABILITY_RULE_PACK),
      );
      expect(stableApiEvaluation(created.body as ApiAssessment)).toEqual(pure);
      expect(created.body.profileSnapshot).toEqual(profileInput);
      expect(created.body.rulePackSnapshot).toEqual(DEMO_APPLICABILITY_RULE_PACK);

      const persisted = await scenarioApi
        .get(`/assessments/${created.body.id as string}`)
        .expect(200);
      expect(stableApiEvaluation(persisted.body as ApiAssessment)).toEqual(pure);
      firstAssessmentId ??= created.body.id as string;
    }

    const isolationOrganization = await createScenarioOrganization(scenarios[0]!);
    await applicabilityApi(isolationOrganization)
      .get(`/assessments/${firstAssessmentId!}`)
      .expect(404);
  }, 90_000);
});
