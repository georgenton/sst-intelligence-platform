import {
  normalizeSstAssessmentSnapshot,
  sstAssessmentContentHash,
  sstAssessmentSemanticHash,
  type SstAssessmentFact,
  type SstAssessmentFactValue,
  type SstAssessmentSnapshot,
  type SstCapabilityApplicableQuestion,
  type SstCapabilityEvaluation,
  type SstCapabilityKey,
  type SstCapabilityPendingInformation,
  type SstCapabilityRecommendation,
} from './sst-assessment.js';
import { SST_ASSESSMENT_COMMERCIAL_OPTIONAL_FACT_KEYS } from './sst-assessment-catalog.js';

export const SST_CAPABILITY_ENGINE_VERSION = '1.2.0' as const;

type KnownFact = Extract<SstAssessmentFact, { answerState: 'KNOWN' }>;
type Indicator = {
  ruleKey: string;
  factKey: string;
  score: number;
  reason: string;
  matches(value: SstAssessmentFactValue): boolean;
};
type CapabilityDefinition = {
  capabilityKey: SstCapabilityKey;
  title: string;
  description: string;
  featureKey: string | null;
  href: string;
  threshold: number;
  indicators: Indicator[];
};

const isTrue = (value: SstAssessmentFactValue) => value === true;
const isPositiveInteger = (value: SstAssessmentFactValue) =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;
const includesAny =
  (...expected: string[]) =>
  (value: SstAssessmentFactValue) =>
    Array.isArray(value) && value.some((item) => expected.includes(item));
const equalsAny =
  (...expected: string[]) =>
  (value: SstAssessmentFactValue) =>
    typeof value === 'string' && expected.includes(value);

const hazardIndicators = (prefix: string, score: number, reason: string): Indicator[] =>
  [
    'workCenter.hasChemicalProcesses',
    'workCenter.hasHighEnergyOperations',
    'workCenter.hasWorkAtHeight',
    'workCenter.hasHotWork',
    'workCenter.hasElectricalWorkOrExposure',
    'workCenter.hasConfinedSpaces',
    'workCenter.hasCriticalMachinery',
    'workCenter.hasDriversOrTransport',
    'workCenter.hasFireExposure',
  ].map((factKey) => ({
    ruleKey: `${prefix}.${factKey}`,
    factKey,
    score,
    reason,
    matches: isTrue,
  }));

const CAPABILITIES: CapabilityDefinition[] = [
  {
    capabilityKey: 'WORKFORCE',
    title: 'Personas y trabajadores',
    description: 'Mantener una base operativa de personas, cargos y centros de trabajo.',
    featureKey: null,
    href: '/app/workers',
    threshold: 20,
    indicators: [
      {
        ruleKey: 'workforce.confirmed-headcount',
        factKey: 'organization.totalWorkerCount',
        score: 30,
        reason: 'La organización confirmó personas trabajadoras en su operación.',
        matches: isPositiveInteger,
      },
      {
        ruleKey: 'workforce.multiple-shifts',
        factKey: 'organization.multipleShifts',
        score: 25,
        reason: 'La operación declarada incluye múltiples turnos.',
        matches: isTrue,
      },
      {
        ruleKey: 'workforce.external-workforce',
        factKey: 'workCenter.hasExternalWorkforce',
        score: 25,
        reason: 'Se confirmó presencia de personal externo en al menos un centro.',
        matches: isTrue,
      },
    ],
  },
  {
    capabilityKey: 'INSPECTIONS',
    title: 'Inspecciones inteligentes',
    description: 'Estructurar inspecciones, hallazgos, acciones y seguimiento.',
    featureKey: 'module.inspections',
    href: '/app/inspections',
    threshold: 25,
    indicators: [
      {
        ruleKey: 'inspections.current-practice',
        factKey: 'organization.inspectionPractice',
        score: 30,
        reason: 'La práctica de inspecciones declarada aún puede fortalecerse.',
        matches: equalsAny('NONE', 'INFORMAL', 'CHECKLISTS'),
      },
      {
        ruleKey: 'inspections.recurring-findings',
        factKey: 'organization.recurringFindings',
        score: 35,
        reason: 'La organización confirmó hallazgos recurrentes.',
        matches: isTrue,
      },
      {
        ruleKey: 'inspections.overdue-actions',
        factKey: 'organization.overdueActions',
        score: 25,
        reason: 'La organización confirmó acciones SST vencidas.',
        matches: isTrue,
      },
      {
        ruleKey: 'inspections.physical-operation',
        factKey: 'workCenter.workArrangement',
        score: 15,
        reason: 'Existe al menos un centro con trabajo presencial o híbrido.',
        matches: equalsAny('PHYSICAL', 'HYBRID'),
      },
    ],
  },
  {
    capabilityKey: 'TECHNICAL_RISK',
    title: 'Evaluación de riesgo técnico',
    description: 'Aplicar metodologías técnicas versionadas a peligros confirmados.',
    featureKey: 'module.technical_risk',
    href: '/app/technical-risk',
    threshold: 25,
    indicators: [
      {
        ruleKey: 'technical-risk.operational-activity',
        factKey: 'workCenter.activityCategories',
        score: 25,
        reason: 'La actividad confirmada requiere una lectura técnica de riesgos.',
        matches: includesAny('PRODUCTION', 'WAREHOUSE', 'CONSTRUCTION_ASSEMBLY'),
      },
      ...hazardIndicators(
        'technical-risk',
        25,
        'Se confirmó una exposición operativa que requiere evaluación técnica.',
      ),
    ],
  },
  {
    capabilityKey: 'INCIDENTS',
    title: 'Accidentes e incidentes',
    description: 'Registrar eventos, personas involucradas, evidencia y seguimiento.',
    featureKey: 'module.incidents',
    href: '/app/incidents',
    threshold: 30,
    indicators: [
      {
        ruleKey: 'incidents.recurring-findings',
        factKey: 'organization.recurringFindings',
        score: 10,
        reason: 'Los hallazgos recurrentes refuerzan la necesidad de seguimiento operativo.',
        matches: isTrue,
      },
      ...hazardIndicators(
        'incidents',
        15,
        'Existe una exposición confirmada que puede requerir gestión de eventos.',
      ),
    ],
  },
  {
    capabilityKey: 'PPE',
    title: 'Equipos de protección personal',
    description: 'Gestionar requisitos, entregas, reemplazos y trazabilidad de EPP.',
    featureKey: 'module.ppe',
    href: '/app/ppe',
    threshold: 25,
    indicators: hazardIndicators(
      'ppe',
      25,
      'Se confirmó una exposición operativa que puede requerir controles de EPP.',
    ),
  },
  {
    capabilityKey: 'TRAINING',
    title: 'Capacitación y competencia',
    description: 'Trazar necesidades, audiencias, sesiones y seguimiento de competencias.',
    featureKey: 'module.training',
    href: '/app/training',
    threshold: 25,
    indicators: [
      {
        ruleKey: 'training.multiple-shifts',
        factKey: 'organization.multipleShifts',
        score: 25,
        reason: 'Los múltiples turnos requieren coordinar formación y seguimiento.',
        matches: isTrue,
      },
      {
        ruleKey: 'training.external-workforce',
        factKey: 'workCenter.hasExternalWorkforce',
        score: 30,
        reason: 'El personal externo confirmado requiere una gestión explícita de competencia.',
        matches: isTrue,
      },
      ...hazardIndicators(
        'training',
        20,
        'La exposición confirmada puede requerir formación específica.',
      ),
    ],
  },
  {
    capabilityKey: 'GOVERNANCE',
    title: 'Gobernanza SST',
    description: 'Organizar responsabilidades, decisiones, revisiones y evidencia de gestión.',
    featureKey: null,
    href: '/app/governance',
    threshold: 25,
    indicators: [
      {
        ruleKey: 'governance.no-current-plan',
        factKey: 'organization.hasExistingSstWorkPlan',
        score: 10,
        reason:
          'La ausencia de un plan actual aporta contexto secundario para organizar la gestión.',
        matches: (value) => value === false,
      },
      {
        ruleKey: 'governance.evidence-difficulty',
        factKey: 'organization.evidenceDifficulty',
        score: 30,
        reason: 'Se confirmó dificultad para reunir evidencia SST.',
        matches: isTrue,
      },
      {
        ruleKey: 'governance.overdue-actions',
        factKey: 'organization.overdueActions',
        score: 30,
        reason: 'Existen acciones SST vencidas que requieren gobernanza de seguimiento.',
        matches: isTrue,
      },
    ],
  },
  {
    capabilityKey: 'WORK_PERMITS',
    title: 'Permisos de trabajo',
    description: 'Controlar trabajos críticos con autorización y evidencia trazable.',
    featureKey: 'module.work_permits',
    href: '/app/work-permits',
    threshold: 30,
    indicators: [
      {
        ruleKey: 'work-permits.manual-process',
        factKey: 'organization.manualPermits',
        score: 10,
        reason: 'El proceso manual aporta contexto secundario cuando existen trabajos críticos.',
        matches: isTrue,
      },
      ...[
        'workCenter.hasWorkAtHeight',
        'workCenter.hasHotWork',
        'workCenter.hasElectricalWorkOrExposure',
        'workCenter.hasConfinedSpaces',
      ].map((factKey): Indicator => ({
        ruleKey: `work-permits.${factKey}`,
        factKey,
        score: 30,
        reason: 'Se confirmó un trabajo crítico que puede requerir control mediante permiso.',
        matches: isTrue,
      })),
    ],
  },
];

export const SST_CAPABILITY_INDICATOR_FACT_KEYS = [
  ...new Set(CAPABILITIES.flatMap(({ indicators }) => indicators.map(({ factKey }) => factKey))),
].sort();

function recommendationPriority(score: number): SstCapabilityRecommendation['priority'] {
  return score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
}

export function evaluateSstCapabilityRecommendations(
  snapshotInput: SstAssessmentSnapshot,
  applicableQuestions: readonly SstCapabilityApplicableQuestion[],
): SstCapabilityEvaluation {
  const snapshot = normalizeSstAssessmentSnapshot(snapshotInput);
  const diagnosticSnapshot = {
    ...snapshot,
    facts: snapshot.facts.filter(
      ({ factKey }) => !SST_ASSESSMENT_COMMERCIAL_OPTIONAL_FACT_KEYS.has(factKey),
    ),
  };
  const knownFacts = diagnosticSnapshot.facts.filter(
    (fact): fact is KnownFact => fact.answerState === 'KNOWN',
  );
  const factsByIdentity = new Map(
    diagnosticSnapshot.facts.map((fact) => [`${fact.scopeKey}:${fact.factKey}`, fact] as const),
  );
  // Context-only B2 clarifications must not change the capability engine's
  // historical input identity or recommendation semantics.
  const contextOnlyFactKeys = new Set([
    'organization.complementaryActivityDescription',
    'workCenter.chemicalUseContexts',
  ]);
  const normalizedApplicableQuestions = applicableQuestions
    .filter(({ collectionPolicy }) => collectionPolicy !== 'COMMERCIAL_OPTIONAL')
    .filter(({ factKey }) => !contextOnlyFactKeys.has(factKey))
    .map(({ scopeKey, factKey, collectionPolicy }) => ({ scopeKey, factKey, collectionPolicy }))
    .filter(
      (question, index, questions) =>
        questions.findIndex(
          (candidate) =>
            candidate.scopeKey === question.scopeKey && candidate.factKey === question.factKey,
        ) === index,
    )
    .sort(
      (left, right) =>
        left.scopeKey.localeCompare(right.scopeKey) || left.factKey.localeCompare(right.factKey),
    );
  const recommendations: SstCapabilityRecommendation[] = [];
  const missingInformation: SstCapabilityEvaluation['missingInformation'] = [];

  for (const capability of CAPABILITIES) {
    const matchedIndicators = capability.indicators.flatMap((indicator) => {
      const matchedFacts = knownFacts.filter(
        (fact) => fact.factKey === indicator.factKey && indicator.matches(fact.value),
      );
      return matchedFacts.length > 0 ? [{ indicator, matchedFacts }] : [];
    });
    const score = Math.min(
      100,
      matchedIndicators.reduce((total, { indicator }) => total + indicator.score, 0),
    );
    const indicatorFactKeys = new Set(capability.indicators.map(({ factKey }) => factKey));
    const pendingInformation = normalizedApplicableQuestions
      .filter(({ factKey }) => indicatorFactKeys.has(factKey))
      .flatMap(({ scopeKey, factKey }): SstCapabilityPendingInformation[] => {
        const fact = factsByIdentity.get(`${scopeKey}:${factKey}`);
        if (!fact) return [{ scopeKey, factKey, missingState: 'UNANSWERED' }];
        if (fact.answerState === 'EXPLICIT_UNKNOWN') {
          return [{ scopeKey, factKey, missingState: 'EXPLICIT_UNKNOWN' }];
        }
        return [];
      });

    if (score >= capability.threshold) {
      const matchedFacts = matchedIndicators
        .flatMap(({ matchedFacts: facts }) => facts)
        .filter(
          (fact, index, facts) =>
            facts.findIndex(
              (candidate) =>
                candidate.scopeKey === fact.scopeKey && candidate.factKey === fact.factKey,
            ) === index,
        )
        .sort(
          (left, right) =>
            left.scopeKey.localeCompare(right.scopeKey) ||
            left.factKey.localeCompare(right.factKey),
        )
        .map(({ scopeKey, factKey, value, provenance }) => ({
          scopeKey,
          factKey,
          value,
          provenance,
        }));
      recommendations.push({
        capabilityKey: capability.capabilityKey,
        title: capability.title,
        description: capability.description,
        featureKey: capability.featureKey,
        href: capability.href,
        priority: recommendationPriority(score),
        score,
        ruleKeys: matchedIndicators.map(({ indicator }) => indicator.ruleKey).sort(),
        reasons: [...new Set(matchedIndicators.map(({ indicator }) => indicator.reason))].sort(),
        matchedFacts,
        pendingInformation,
        recommendationState: 'PROPOSED',
        humanDecision: 'PENDING',
        activationEffect: 'NONE',
      });
    } else if (pendingInformation.length > 0) {
      missingInformation.push({
        capabilityKey: capability.capabilityKey,
        title: capability.title,
        pendingInformation,
        explanation:
          'No se propone esta capacidad hasta que una persona confirme la información pendiente.',
      });
    }
  }

  recommendations.sort(
    (left, right) =>
      right.score - left.score || left.capabilityKey.localeCompare(right.capabilityKey),
  );
  missingInformation.sort((left, right) => left.capabilityKey.localeCompare(right.capabilityKey));
  const inputHash = sstAssessmentContentHash({
    snapshotHash: sstAssessmentSemanticHash(diagnosticSnapshot),
    applicableQuestions: normalizedApplicableQuestions,
  });
  const result = {
    engineVersion: SST_CAPABILITY_ENGINE_VERSION,
    inputHash,
    recommendations,
    missingInformation,
    boundaries: {
      confirmedFactsOnly: true as const,
      humanConfirmationRequired: true as const,
      moduleActivation: 'NOT_PERFORMED' as const,
      entitlementMutation: 'NOT_PERFORMED' as const,
    },
  };
  return { ...result, outputHash: sstAssessmentContentHash(result) };
}
