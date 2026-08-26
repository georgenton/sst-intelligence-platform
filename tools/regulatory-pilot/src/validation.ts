import {
  assertAdaptiveRulePublication,
  buildRegulatoryPilotShadowPack,
  evaluateAdaptiveConfiguration,
  REGULATORY_PILOT_CANDIDATE_DISCLAIMER,
  validateAdaptiveFactValue,
  type AdaptiveEvaluationResult,
  type RegulatoryPilotManifestBundle,
} from '@sst/contracts';

const organizationScope = {
  scopeKey: 'organization',
  kind: 'ORGANIZATION' as const,
  order: 0,
  displayName: 'Organización candidata',
};

export const SMALL_TARGETS = ['PREVENTION_PLAN_REGISTRATION', 'SST_RESPONSIBLE_REGISTRATION'];
export const LARGE_TARGETS = [
  'ANNUAL_TRAINING_PLAN_REGISTRATION',
  'HYGIENE_SAFETY_REGULATION_REGISTRATION',
  'PSYCHOSOCIAL_PROGRAM_REGISTRATION',
  'SST_RESPONSIBLE_REGISTRATION',
];

export function evaluatePilotWorkerCount(
  manifest: RegulatoryPilotManifestBundle,
  workerCount?: number,
): AdaptiveEvaluationResult {
  const pack = buildRegulatoryPilotShadowPack(manifest);
  const facts = [
    { scopeKey: 'organization', factKey: 'organization.country', value: 'EC' as const },
  ];
  if (workerCount !== undefined) {
    const definition = pack.factVersions.find(
      ({ factKey }) => factKey === 'organization.totalWorkerCount',
    );
    if (!definition) throw new Error('WORKER_COUNT_FACT_NOT_FOUND');
    facts.push({
      scopeKey: 'organization',
      factKey: 'organization.totalWorkerCount',
      value: validateAdaptiveFactValue(definition, workerCount) as never,
    });
  }
  return evaluateAdaptiveConfiguration({ pack, scopes: [organizationScope], facts });
}

function targets(result: AdaptiveEvaluationResult) {
  return result.items.map(({ targetKey }) => targetKey).sort();
}

function requireTargets(label: string, result: AdaptiveEvaluationResult, expected: string[]) {
  if (JSON.stringify(targets(result)) !== JSON.stringify([...expected].sort()))
    throw new Error(`SHADOW_SCENARIO_FAILED:${label}`);
  if (result.items.some(({ state }) => state !== 'MANDATORY'))
    throw new Error(`SHADOW_STATE_FAILED:${label}`);
}

export type RegulatoryPilotValidationReport = {
  manifestSha256: string;
  provisions: number;
  requirements: number;
  ruleDrafts: number;
  workerCases: Record<string, string[]>;
  missingQuestion: string;
  missingWhyAsked: string;
  publicationBlocked: boolean;
  constructionSpecificRulesAdded: false;
};

export function validateRegulatoryPilotCampaign(
  manifest: RegulatoryPilotManifestBundle,
): RegulatoryPilotValidationReport {
  const workerCases: Record<string, string[]> = {};
  for (const workerCount of [1, 10, 11, 80]) {
    const result = evaluatePilotWorkerCount(manifest, workerCount);
    requireTargets(String(workerCount), result, workerCount <= 10 ? SMALL_TARGETS : LARGE_TARGETS);
    workerCases[String(workerCount)] = targets(result);
  }

  // Named validation scenarios reuse the same deterministic engine and manifest.
  for (const [name, workerCount, expected] of [
    ['small-services', 6, SMALL_TARGETS],
    ['chemical-pharma', 80, LARGE_TARGETS],
    ['construction', 18, LARGE_TARGETS],
  ] as const)
    requireTargets(name, evaluatePilotWorkerCount(manifest, workerCount), [...expected]);

  let invalidZeroRejected = false;
  try {
    evaluatePilotWorkerCount(manifest, 0);
  } catch (error) {
    invalidZeroRejected = error instanceof Error && error.message === 'Value below minimum';
  }
  if (!invalidZeroRejected) throw new Error('WORKER_COUNT_ZERO_NOT_REJECTED');

  const missing = evaluatePilotWorkerCount(manifest);
  if (
    missing.items.length === 0 ||
    missing.items.some(({ state }) => state !== 'NEEDS_INFORMATION') ||
    missing.questions.length !== 1 ||
    missing.questions[0]?.factKey !== 'organization.totalWorkerCount'
  )
    throw new Error('MISSING_WORKER_COUNT_QUESTION_INVALID');
  const question = missing.questions[0];
  if (!question || question.whyAsked.includes('DEMO'))
    throw new Error('REGULATORY_QUESTION_COPY_INVALID');

  let publicationBlocked = false;
  try {
    assertAdaptiveRulePublication({
      isDemo: false,
      regulatory: true,
      requirementStatuses: manifest.requirements.map(({ editorialStatus }) => editorialStatus),
    });
  } catch (error) {
    publicationBlocked =
      error instanceof Error && error.message === 'Regulatory rule requires approved requirements';
  }
  if (!publicationBlocked) throw new Error('CANDIDATE_PUBLICATION_NOT_BLOCKED');
  if (manifest.shadowPack.disclaimer !== REGULATORY_PILOT_CANDIDATE_DISCLAIMER)
    throw new Error('SHADOW_DISCLAIMER_INVALID');

  return {
    manifestSha256: manifest.index.manifestSha256,
    provisions: manifest.provisions.length,
    requirements: manifest.requirements.length,
    ruleDrafts: manifest.ruleDrafts.length,
    workerCases,
    missingQuestion: question.questionText,
    missingWhyAsked: question.whyAsked,
    publicationBlocked,
    constructionSpecificRulesAdded: false,
  };
}
