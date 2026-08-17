import {
  APPLICABILITY_STATES,
  DEMO_APPLICABILITY_RULE_PACK,
  evaluateApplicability,
  type ApplicabilityDecisionResult,
  type ApplicabilityEvaluationResult,
  type ApplicabilityState,
  type PredicateResult,
} from '@sst/contracts';
import {
  sstValidationScenarioSchema,
  type FutureContextKey,
  type SstValidationScenario,
} from './schema.js';

export type ExpectedDecision = SstValidationScenario['engineExpectation']['decisions'][number];

export type ScenarioValidationOutcome = {
  scenario: SstValidationScenario;
  engine: {
    key: string;
    version: string;
    sourceType: string;
    regulatory: boolean;
    isDemo: boolean;
    disclaimer: string;
  };
  actualEvaluation: ApplicabilityEvaluationResult;
  expectedDecisions: ExpectedDecision[];
  actualDecisionSummary: ExpectedDecision[];
  expectationMatches: boolean;
  repeatedEvaluationMatches: boolean;
  stateCoverage: ApplicabilityState[];
  predicateResultCoverage: PredicateResult[];
  missingProfileInformation: string[];
  futureContextStatus: 'NOT_EVALUATED_BY_PROFILE_V1';
};

export type ScenarioValidationReport = {
  schemaVersion: '1.0.0';
  reportKind: 'ADAPTIVE_SST_SCENARIO_VALIDATION';
  legalBoundary: string;
  engine: ScenarioValidationOutcome['engine'];
  scenarioCount: number;
  allScenariosSynthetic: boolean;
  allExpertStatusesPending: boolean;
  scenarioIdsUnique: boolean;
  expectationParity: boolean;
  deterministicRepeat: boolean;
  forwardReverseOrderStable: boolean;
  allSixStatesCovered: boolean;
  coveredStates: ApplicabilityState[];
  trueFalseMissingCovered: boolean;
  coveredPredicateResults: PredicateResult[];
  profilePredicateCoverage: Record<string, boolean>;
  unmodeledFieldsExplicit: boolean;
  profileV2Discovery: Array<{ field: FutureContextKey; scenarioCount: number }>;
  privacyIssues: string[];
  outcomes: ScenarioValidationOutcome[];
  overallPass: boolean;
};

const LEGAL_BOUNDARY =
  'Resultados de DEMO_APPLICABILITY con reglas sintéticas. No representan aplicabilidad legal en Ecuador. El acuerdo experto no reemplaza revisión legal; el laboratorio valida arquitectura y suficiencia de datos.';

function normalizeDecision(decision: ApplicabilityDecisionResult): ExpectedDecision {
  return {
    targetKey: decision.targetKey,
    state: decision.state,
    winningRuleId: decision.winningRuleId,
  };
}

function stableDecisionSummary(evaluation: ApplicabilityEvaluationResult): ExpectedDecision[] {
  return evaluation.decisions
    .map(normalizeDecision)
    .sort((left, right) => left.targetKey.localeCompare(right.targetKey));
}

function stableExpectedDecisions(scenario: SstValidationScenario): ExpectedDecision[] {
  return [...scenario.engineExpectation.decisions].sort((left, right) =>
    left.targetKey.localeCompare(right.targetKey),
  );
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function collectStrings(value: unknown, path = '$'): Array<{ path: string; value: string }> {
  if (typeof value === 'string') return [{ path, value }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectStrings(item, `${path}[${index}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => collectStrings(item, `${path}.${key}`));
  }
  return [];
}

export function findLikelyPrivateData(scenarios: readonly SstValidationScenario[]): string[] {
  const issues: string[] = [];
  const patterns: Array<{ label: string; expression: RegExp }> = [
    { label: 'RUC-like identifier', expression: /\b\d{13}\b/ },
    { label: 'email address', expression: /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i },
    { label: 'phone-like identifier', expression: /(?:\+?\d[\s().-]*){8,}/ },
    {
      label: 'precise address-like text',
      expression: /\b(?:calle|avenida|av\.|manzana|lote)\b[^\n]{0,40}\d/i,
    },
    {
      label: 'credential-like content',
      expression: /\b(?:password|secret|bearer|api[_ -]?key|access[_ -]?token)\b/i,
    },
    {
      label: 'named-person marker',
      expression: /\b(?:sr\.|sra\.|ing\.|dra?\.|anita)\b/i,
    },
    { label: 'executable expression', expression: /\b(?:eval\s*\(|new\s+Function\b)/i },
  ];

  for (const scenario of scenarios) {
    if (
      scenario.scenarioKind === 'SYNTHETIC' &&
      !scenario.name.toLocaleLowerCase('es').includes('sintétic')
    ) {
      issues.push(`${scenario.id}: scenario name is not explicitly synthetic`);
    }
    for (const center of scenario.workCenters) {
      if (
        scenario.scenarioKind === 'SYNTHETIC' &&
        !center.displayName.toLocaleLowerCase('es').includes('sintétic')
      ) {
        issues.push(
          `${scenario.id}.${center.workCenterId}: display name is not explicitly synthetic`,
        );
      }
    }
    for (const item of collectStrings(scenario)) {
      for (const pattern of patterns) {
        if (pattern.expression.test(item.value)) {
          issues.push(`${scenario.id}${item.path}: ${pattern.label}`);
        }
      }
    }
  }
  return issues;
}

function evaluateScenario(scenario: SstValidationScenario): ScenarioValidationOutcome {
  const first = evaluateApplicability(scenario.profileV1Input, DEMO_APPLICABILITY_RULE_PACK);
  const second = evaluateApplicability(scenario.profileV1Input, DEMO_APPLICABILITY_RULE_PACK);
  const expectedDecisions = stableExpectedDecisions(scenario);
  const actualDecisionSummary = stableDecisionSummary(first);
  const predicateResults = new Set<PredicateResult>();
  const states = new Set<ApplicabilityState>();
  const missingFields = new Set<string>();

  for (const decision of first.decisions) {
    states.add(decision.state);
    for (const trace of decision.trace) {
      for (const predicate of trace.predicates) {
        predicateResults.add(predicate.result);
        if (predicate.result === 'MISSING') missingFields.add(predicate.field);
      }
    }
  }

  return {
    scenario,
    engine: {
      key: DEMO_APPLICABILITY_RULE_PACK.key,
      version: DEMO_APPLICABILITY_RULE_PACK.version,
      sourceType: DEMO_APPLICABILITY_RULE_PACK.source.type,
      regulatory: DEMO_APPLICABILITY_RULE_PACK.regulatory,
      isDemo: DEMO_APPLICABILITY_RULE_PACK.isDemo,
      disclaimer: DEMO_APPLICABILITY_RULE_PACK.disclaimer,
    },
    actualEvaluation: first,
    expectedDecisions,
    actualDecisionSummary,
    expectationMatches: equal(actualDecisionSummary, expectedDecisions),
    repeatedEvaluationMatches: equal(first, second),
    stateCoverage: [...states].sort(),
    predicateResultCoverage: [...predicateResults].sort(),
    missingProfileInformation: [...missingFields].sort(),
    futureContextStatus: 'NOT_EVALUATED_BY_PROFILE_V1',
  };
}

function profilePredicateCoverage(scenarios: readonly SstValidationScenario[]) {
  const matchingSectors = new Set(['Servicios', 'Tecnología']);
  return {
    workCenterCountSingle: scenarios.some(
      ({ profileV1Input }) => profileV1Input.organization.workCenterCount === 1,
    ),
    workCenterCountMultiple: scenarios.some(
      ({ profileV1Input }) => profileV1Input.organization.workCenterCount >= 2,
    ),
    workerCountBelowDemoThreshold: scenarios.some(({ profileV1Input }) => {
      const value = profileV1Input.organization.workerCount;
      return value !== undefined && value < 20;
    }),
    workerCountAtOrAboveDemoThreshold: scenarios.some(({ profileV1Input }) => {
      const value = profileV1Input.organization.workerCount;
      return value !== undefined && value >= 20;
    }),
    sectorMatchingDemoOptions: scenarios.some(({ profileV1Input }) => {
      const value = profileV1Input.organization.sector;
      return value !== undefined && matchingSectors.has(value);
    }),
    sectorNotMatchingDemoOptions: scenarios.some(({ profileV1Input }) => {
      const value = profileV1Input.organization.sector;
      return value !== undefined && !matchingSectors.has(value);
    }),
    chemicalTrue: scenarios.some(
      ({ profileV1Input }) => profileV1Input.operations.hasChemicalProcesses === true,
    ),
    chemicalFalse: scenarios.some(
      ({ profileV1Input }) => profileV1Input.operations.hasChemicalProcesses === false,
    ),
    chemicalMissing: scenarios.some(
      ({ profileV1Input }) => profileV1Input.operations.hasChemicalProcesses === undefined,
    ),
    highEnergyTrue: scenarios.some(
      ({ profileV1Input }) => profileV1Input.operations.hasHighEnergyOperations === true,
    ),
    highEnergyFalse: scenarios.some(
      ({ profileV1Input }) => profileV1Input.operations.hasHighEnergyOperations === false,
    ),
    highEnergyMissing: scenarios.some(
      ({ profileV1Input }) => profileV1Input.operations.hasHighEnergyOperations === undefined,
    ),
  };
}

function profileV2Discovery(scenarios: readonly SstValidationScenario[]) {
  const counts = new Map<FutureContextKey, number>();
  for (const scenario of scenarios) {
    for (const field of new Set(scenario.futureContextNotEvaluated)) {
      counts.set(field, (counts.get(field) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([field, scenarioCount]) => ({ field, scenarioCount }))
    .sort(
      (left, right) =>
        right.scenarioCount - left.scenarioCount || left.field.localeCompare(right.field),
    );
}

export function validateScenarioCatalog(
  scenarioInputs: readonly unknown[],
  options: { requireFullCatalog?: boolean } = {},
): ScenarioValidationReport {
  const scenarios = scenarioInputs
    .map((scenario) => sstValidationScenarioSchema.parse(scenario))
    .sort((left, right) => left.id.localeCompare(right.id));
  const requireFullCatalog = options.requireFullCatalog ?? true;
  const ids = scenarios.map(({ id }) => id);
  const scenarioIdsUnique = new Set(ids).size === ids.length;
  if (!scenarioIdsUnique) throw new Error('Scenario ids must be unique');
  if (requireFullCatalog && scenarios.length !== 8) {
    throw new Error(
      `The committed catalog must contain exactly eight scenarios; got ${scenarios.length}`,
    );
  }

  const outcomes = scenarios.map(evaluateScenario);
  const reverseOutcomes = [...scenarios].reverse().map(evaluateScenario);
  const forwardById = new Map(outcomes.map((outcome) => [outcome.scenario.id, outcome]));
  const forwardReverseOrderStable = reverseOutcomes.every((outcome) => {
    const forward = forwardById.get(outcome.scenario.id);
    return forward !== undefined && equal(forward.actualEvaluation, outcome.actualEvaluation);
  });
  const coveredStates = [
    ...new Set(outcomes.flatMap(({ stateCoverage }) => stateCoverage)),
  ].sort() as ApplicabilityState[];
  const coveredPredicateResults = [
    ...new Set(outcomes.flatMap(({ predicateResultCoverage }) => predicateResultCoverage)),
  ].sort() as PredicateResult[];
  const allSixStatesCovered = APPLICABILITY_STATES.every((state) => coveredStates.includes(state));
  const trueFalseMissingCovered = ['TRUE', 'FALSE', 'MISSING'].every((result) =>
    coveredPredicateResults.includes(result as PredicateResult),
  );
  const predicateCoverage = profilePredicateCoverage(scenarios);
  const privacyIssues = findLikelyPrivateData(scenarios);
  const allScenariosSynthetic = scenarios.every(
    ({ scenarioKind, synthetic }) => scenarioKind === 'SYNTHETIC' && synthetic,
  );
  const allExpertStatusesPending = scenarios.every(
    ({ expertValidation }) => expertValidation.status === 'PENDING_EXPERT_REVIEW',
  );
  const expectationParity = outcomes.every(({ expectationMatches }) => expectationMatches);
  const deterministicRepeat = outcomes.every(
    ({ repeatedEvaluationMatches }) => repeatedEvaluationMatches,
  );
  const unmodeledFieldsExplicit = scenarios.every(
    ({ futureContextNotEvaluated }) => futureContextNotEvaluated.length > 0,
  );
  const exactDemoPack =
    DEMO_APPLICABILITY_RULE_PACK.key === 'DEMO_APPLICABILITY' &&
    DEMO_APPLICABILITY_RULE_PACK.version === '1.0.0' &&
    DEMO_APPLICABILITY_RULE_PACK.source.type === 'DEMO' &&
    DEMO_APPLICABILITY_RULE_PACK.isDemo &&
    !DEMO_APPLICABILITY_RULE_PACK.regulatory;
  const predicateCasesCovered = Object.values(predicateCoverage).every(Boolean);
  const coverageRequirementsPass =
    !requireFullCatalog ||
    (allSixStatesCovered && trueFalseMissingCovered && predicateCasesCovered);
  const catalogGovernancePass =
    !requireFullCatalog || (allScenariosSynthetic && allExpertStatusesPending);
  const overallPass =
    scenarios.length > 0 &&
    scenarioIdsUnique &&
    catalogGovernancePass &&
    expectationParity &&
    deterministicRepeat &&
    forwardReverseOrderStable &&
    coverageRequirementsPass &&
    unmodeledFieldsExplicit &&
    privacyIssues.length === 0 &&
    exactDemoPack;

  return {
    schemaVersion: '1.0.0',
    reportKind: 'ADAPTIVE_SST_SCENARIO_VALIDATION',
    legalBoundary: LEGAL_BOUNDARY,
    engine: outcomes[0]?.engine ?? {
      key: DEMO_APPLICABILITY_RULE_PACK.key,
      version: DEMO_APPLICABILITY_RULE_PACK.version,
      sourceType: DEMO_APPLICABILITY_RULE_PACK.source.type,
      regulatory: DEMO_APPLICABILITY_RULE_PACK.regulatory,
      isDemo: DEMO_APPLICABILITY_RULE_PACK.isDemo,
      disclaimer: DEMO_APPLICABILITY_RULE_PACK.disclaimer,
    },
    scenarioCount: scenarios.length,
    allScenariosSynthetic,
    allExpertStatusesPending,
    scenarioIdsUnique,
    expectationParity,
    deterministicRepeat,
    forwardReverseOrderStable,
    allSixStatesCovered,
    coveredStates,
    trueFalseMissingCovered,
    coveredPredicateResults,
    profilePredicateCoverage: predicateCoverage,
    unmodeledFieldsExplicit,
    profileV2Discovery: profileV2Discovery(scenarios),
    privacyIssues,
    outcomes,
    overallPass,
  };
}
