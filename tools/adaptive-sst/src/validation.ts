import {
  DEMO_ADAPTIVE_RULE_PACK,
  evaluateAdaptiveConfiguration,
  type AdaptiveFactInput,
  type AdaptiveScopeInput,
} from '@sst/contracts';

type Scenario = {
  id: string;
  scopes: AdaptiveScopeInput[];
  initialFacts: AdaptiveFactInput[];
  answeredFacts: AdaptiveFactInput[];
  expectedInitialQuestionFacts: string[];
  expectedItems: Array<{ scopeKey: string; targetKey: string; minimumDepth: string }>;
};

const organization: AdaptiveScopeInput = {
  scopeKey: 'organization',
  kind: 'ORGANIZATION',
  order: 0,
  displayName: 'Organización sintética',
};
const center = (id: string, name: string, order: number): AdaptiveScopeInput => ({
  scopeKey: `work-center:${id}`,
  kind: 'WORK_CENTER',
  workCenterId: id,
  order,
  displayName: name,
});
const orgFacts = (workers: number, centers: number, sector: string): AdaptiveFactInput[] => [
  { scopeKey: 'organization', factKey: 'organization.country', value: 'EC' },
  { scopeKey: 'organization', factKey: 'organization.sector', value: sector },
  { scopeKey: 'organization', factKey: 'organization.totalWorkerCount', value: workers },
  { scopeKey: 'organization', factKey: 'organization.workCenterCount', value: centers },
];
const simpleCenter = center('services', 'Oficina sintética', 1);
const pharmaCenter = center('pharma', 'Planta farmacéutica sintética', 1);
const constructionA = center('assembly', 'Montaje sintético', 1);
const constructionB = center('warehouse', 'Bodega sintética', 2);

export const ADAPTIVE_SCENARIOS: Scenario[] = [
  {
    id: 'SMALL_SERVICES',
    scopes: [organization, simpleCenter],
    initialFacts: [
      ...orgFacts(6, 1, 'Servicios administrativos'),
      { scopeKey: simpleCenter.scopeKey, factKey: 'workCenter.hasChemicalProcesses', value: false },
      {
        scopeKey: simpleCenter.scopeKey,
        factKey: 'workCenter.hasHighEnergyOperations',
        value: false,
      },
    ],
    answeredFacts: [
      { scopeKey: simpleCenter.scopeKey, factKey: 'workCenter.workArrangement', value: 'PHYSICAL' },
      {
        scopeKey: simpleCenter.scopeKey,
        factKey: 'workCenter.activityCategory',
        value: 'ADMINISTRATIVE_SERVICES',
      },
      { scopeKey: simpleCenter.scopeKey, factKey: 'workCenter.facilityType', value: 'OFFICE' },
      {
        scopeKey: simpleCenter.scopeKey,
        factKey: 'workCenter.hasDistinctOperationalZones',
        value: false,
      },
      { scopeKey: simpleCenter.scopeKey, factKey: 'workCenter.hasWorkAtHeight', value: false },
      { scopeKey: simpleCenter.scopeKey, factKey: 'workCenter.hasConfinedSpaces', value: false },
      { scopeKey: simpleCenter.scopeKey, factKey: 'workCenter.hasExternalWorkforce', value: false },
      { scopeKey: simpleCenter.scopeKey, factKey: 'workCenter.hasCriticalMachinery', value: false },
    ],
    expectedInitialQuestionFacts: [
      'workCenter.workArrangement',
      'workCenter.activityCategory',
      'workCenter.hasWorkAtHeight',
      'workCenter.hasConfinedSpaces',
      'workCenter.hasExternalWorkforce',
    ],
    expectedItems: [
      {
        scopeKey: 'organization',
        targetKey: 'SST_MANAGEMENT_BASELINE',
        minimumDepth: 'BASIC_VISIBLE',
      },
      {
        scopeKey: simpleCenter.scopeKey,
        targetKey: 'EMERGENCY_PREPAREDNESS',
        minimumDepth: 'BASIC_VISIBLE',
      },
    ],
  },
  {
    id: 'CHEMICAL_PHARMA',
    scopes: [organization, pharmaCenter],
    initialFacts: [
      ...orgFacts(80, 1, 'Producción farmacéutica sintética'),
      { scopeKey: pharmaCenter.scopeKey, factKey: 'workCenter.hasChemicalProcesses', value: true },
      {
        scopeKey: pharmaCenter.scopeKey,
        factKey: 'workCenter.hasHighEnergyOperations',
        value: true,
      },
    ],
    answeredFacts: [
      { scopeKey: pharmaCenter.scopeKey, factKey: 'workCenter.workArrangement', value: 'PHYSICAL' },
      {
        scopeKey: pharmaCenter.scopeKey,
        factKey: 'workCenter.activityCategory',
        value: 'PRODUCTION',
      },
      { scopeKey: pharmaCenter.scopeKey, factKey: 'workCenter.facilityType', value: 'PLANT' },
      {
        scopeKey: pharmaCenter.scopeKey,
        factKey: 'workCenter.hasDistinctOperationalZones',
        value: true,
      },
      { scopeKey: pharmaCenter.scopeKey, factKey: 'workCenter.hasWorkAtHeight', value: false },
      { scopeKey: pharmaCenter.scopeKey, factKey: 'workCenter.hasConfinedSpaces', value: false },
      { scopeKey: pharmaCenter.scopeKey, factKey: 'workCenter.hasExternalWorkforce', value: false },
      { scopeKey: pharmaCenter.scopeKey, factKey: 'workCenter.hasCriticalMachinery', value: true },
    ],
    expectedInitialQuestionFacts: [
      'workCenter.workArrangement',
      'workCenter.activityCategory',
      'workCenter.hasWorkAtHeight',
      'workCenter.hasConfinedSpaces',
      'workCenter.hasExternalWorkforce',
    ],
    expectedItems: [
      {
        scopeKey: pharmaCenter.scopeKey,
        targetKey: 'CHEMICAL_PROCESS_CONTROLS',
        minimumDepth: 'TECHNICAL',
      },
      {
        scopeKey: pharmaCenter.scopeKey,
        targetKey: 'HIGH_ENERGY_PROFESSIONAL_REVIEW',
        minimumDepth: 'TECHNICAL',
      },
    ],
  },
  {
    id: 'CONSTRUCTION_CONTRACTORS',
    scopes: [organization, constructionA, constructionB],
    initialFacts: orgFacts(18, 2, 'Construcción y montaje sintético'),
    answeredFacts: [
      ...[constructionA, constructionB].flatMap((scope, index): AdaptiveFactInput[] => [
        { scopeKey: scope.scopeKey, factKey: 'workCenter.workArrangement', value: 'PHYSICAL' },
        {
          scopeKey: scope.scopeKey,
          factKey: 'workCenter.activityCategory',
          value: index === 0 ? 'CONSTRUCTION_ASSEMBLY' : 'WAREHOUSE',
        },
        {
          scopeKey: scope.scopeKey,
          factKey: 'workCenter.facilityType',
          value: index === 0 ? 'CONSTRUCTION_SITE' : 'WAREHOUSE',
        },
        {
          scopeKey: scope.scopeKey,
          factKey: 'workCenter.hasDistinctOperationalZones',
          value: true,
        },
        { scopeKey: scope.scopeKey, factKey: 'workCenter.hasChemicalProcesses', value: false },
        {
          scopeKey: scope.scopeKey,
          factKey: 'workCenter.hasHighEnergyOperations',
          value: index === 0,
        },
        { scopeKey: scope.scopeKey, factKey: 'workCenter.hasWorkAtHeight', value: index === 0 },
        { scopeKey: scope.scopeKey, factKey: 'workCenter.hasConfinedSpaces', value: false },
        {
          scopeKey: scope.scopeKey,
          factKey: 'workCenter.hasExternalWorkforce',
          value: index === 0,
        },
        {
          scopeKey: scope.scopeKey,
          factKey: 'workCenter.hasCriticalMachinery',
          value: index === 0,
        },
      ]),
    ],
    expectedInitialQuestionFacts: [
      'workCenter.workArrangement',
      'workCenter.activityCategory',
      'workCenter.hasChemicalProcesses',
      'workCenter.hasHighEnergyOperations',
      'workCenter.hasWorkAtHeight',
      'workCenter.hasConfinedSpaces',
      'workCenter.hasExternalWorkforce',
    ],
    expectedItems: [
      {
        scopeKey: constructionA.scopeKey,
        targetKey: 'HIGH_RISK_WORK_CONTROLS',
        minimumDepth: 'TECHNICAL',
      },
      {
        scopeKey: constructionA.scopeKey,
        targetKey: 'EXTERNAL_WORKFORCE_COORDINATION',
        minimumDepth: 'TECHNICAL',
      },
      {
        scopeKey: constructionB.scopeKey,
        targetKey: 'EMERGENCY_PREPAREDNESS',
        minimumDepth: 'BASIC_VISIBLE',
      },
    ],
  },
];

export type AdaptiveValidationReport = {
  schemaVersion: '1.0.0';
  legalBoundary: string;
  scenarioCount: number;
  outcomes: Array<{
    id: string;
    initialQuestionsMatch: boolean;
    finalItemsMatch: boolean;
    deterministic: boolean;
    questionDeduplication: boolean;
    historicalSnapshotPreserved: boolean;
  }>;
  overallPass: boolean;
};

function itemSummary(result: ReturnType<typeof evaluateAdaptiveConfiguration>) {
  return result.items.map(({ scopeKey, targetKey, minimumDepth }) => ({
    scopeKey,
    targetKey,
    minimumDepth,
  }));
}

export function validateAdaptiveScenarios(
  scenarios = ADAPTIVE_SCENARIOS,
): AdaptiveValidationReport {
  const outcomes = scenarios.map((scenario) => {
    const initial = evaluateAdaptiveConfiguration({
      pack: DEMO_ADAPTIVE_RULE_PACK,
      scopes: scenario.scopes,
      facts: scenario.initialFacts,
    });
    const initialQuestionFacts = [
      ...new Set(initial.questions.map(({ factKey }) => factKey)),
    ].sort();
    const expectedQuestions = [...scenario.expectedInitialQuestionFacts].sort();
    const final = evaluateAdaptiveConfiguration({
      pack: DEMO_ADAPTIVE_RULE_PACK,
      scopes: scenario.scopes,
      facts: [...scenario.initialFacts, ...scenario.answeredFacts],
    });
    const repeated = evaluateAdaptiveConfiguration({
      pack: DEMO_ADAPTIVE_RULE_PACK,
      scopes: [...scenario.scopes].reverse(),
      facts: [...scenario.initialFacts, ...scenario.answeredFacts].reverse(),
    });
    const actualItems = itemSummary(final);
    const finalItemsMatch = scenario.expectedItems.every((expected) =>
      actualItems.some((actual) => JSON.stringify(actual) === JSON.stringify(expected)),
    );
    return {
      id: scenario.id,
      initialQuestionsMatch:
        JSON.stringify(initialQuestionFacts) === JSON.stringify(expectedQuestions),
      finalItemsMatch,
      deterministic:
        JSON.stringify(final.items) === JSON.stringify(repeated.items) &&
        JSON.stringify(final.questions) === JSON.stringify(repeated.questions),
      questionDeduplication:
        new Set(initial.questions.map(({ scopeKey, factKey }) => `${scopeKey}:${factKey}`)).size ===
        initial.questions.length,
      historicalSnapshotPreserved:
        initial.outputHash !== final.outputHash && initial.questions.length > 0,
    };
  });
  return {
    schemaVersion: '1.0.0',
    legalBoundary:
      'Escenarios y reglas sintéticos. No representan normativa ecuatoriana ni acreditan cumplimiento legal.',
    scenarioCount: scenarios.length,
    outcomes,
    overallPass: outcomes.every((outcome) =>
      Object.entries(outcome).every(([key, value]) => key === 'id' || value === true),
    ),
  };
}
