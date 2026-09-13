import { describe, expect, it } from 'vitest';
import {
  SST_ASSESSMENT_CATALOG_VERSION,
  SST_ASSESSMENT_SCHEMA_VERSION,
  planSstAssessmentQuestions,
  resolveSstAssessmentReadiness,
  type SstAssessmentFact,
  type SstAssessmentSnapshot,
} from './sst-assessment.js';
import {
  SST_CAPABILITY_ENGINE_VERSION,
  evaluateSstCapabilityRecommendations,
} from './sst-capability-recommendation.js';

const provenance = { source: 'ORGANIZATION_DECLARATION' as const };

function knownFact(
  factKey: string,
  value: boolean | number | string | string[],
  scopeKey = 'organization',
): SstAssessmentFact {
  return { factKey, scopeKey, answerState: 'KNOWN', value, provenance };
}

function unknownFact(factKey: string, scopeKey = 'organization'): SstAssessmentFact {
  return { factKey, scopeKey, answerState: 'EXPLICIT_UNKNOWN', provenance };
}

function snapshot(facts: SstAssessmentFact[], workCenterCount = 1): SstAssessmentSnapshot {
  return {
    schemaVersion: SST_ASSESSMENT_SCHEMA_VERSION,
    catalogVersion: SST_ASSESSMENT_CATALOG_VERSION,
    scopes: [
      {
        scopeKey: 'organization',
        kind: 'ORGANIZATION',
        order: 0,
        displayName: 'Organización',
      },
      ...Array.from({ length: workCenterCount }, (_, index) => ({
        scopeKey: `center:${index + 1}`,
        kind: 'WORK_CENTER' as const,
        order: index + 1,
        displayName: `Planta ${index + 1}`,
      })),
    ],
    facts,
  };
}

function applicableQuestions(
  input: SstAssessmentSnapshot,
  specialistQuestions: Array<{ scopeKey: string; factKey: string }> = [],
) {
  return planSstAssessmentQuestions(
    {
      ...input,
      facts: input.facts.filter(({ answerState }) => answerState !== 'EXPLICIT_UNKNOWN'),
    },
    { channel: 'AUTHENTICATED', specialistQuestions },
  );
}

const readyFacts = (workCenterCount = 1): SstAssessmentFact[] => [
  knownFact('organization.totalWorkerCount', 84),
  ...Array.from({ length: workCenterCount }, (_, index) => {
    const scopeKey = `center:${index + 1}`;
    return [
      knownFact('workCenter.workArrangement', 'PHYSICAL', scopeKey),
      knownFact('workCenter.activityCategories', ['PRODUCTION'], scopeKey),
      knownFact('workCenter.facilityTypes', ['PLANT'], scopeKey),
    ];
  }).flat(),
];

const operationalFacts = [
  knownFact('organization.totalWorkerCount', 84),
  knownFact('organization.inspectionPractice', 'INFORMAL'),
  knownFact('organization.recurringFindings', true),
  knownFact('organization.manualPermits', true),
  knownFact('organization.evidenceDifficulty', true),
  knownFact('organization.hasExistingSstWorkPlan', false),
  knownFact('organization.multipleShifts', true),
  knownFact('workCenter.workArrangement', 'PHYSICAL', 'center:1'),
  knownFact('workCenter.activityCategories', ['PRODUCTION'], 'center:1'),
  knownFact('workCenter.hasWorkAtHeight', true, 'center:1'),
  knownFact('workCenter.hasExternalWorkforce', true, 'center:1'),
];

describe('unified SST capability recommendation engine', () => {
  it('produces the same explainable recommendations for equivalent fact order', () => {
    const forwardInput = snapshot(operationalFacts);
    const reversedInput = snapshot([...operationalFacts].reverse());
    const forward = evaluateSstCapabilityRecommendations(
      forwardInput,
      applicableQuestions(forwardInput),
    );
    const reversed = evaluateSstCapabilityRecommendations(
      reversedInput,
      applicableQuestions(reversedInput),
    );

    expect(forward).toEqual(reversed);
    expect(forward.engineVersion).toBe(SST_CAPABILITY_ENGINE_VERSION);
    expect(forward.recommendations.map(({ capabilityKey }) => capabilityKey)).toEqual(
      expect.arrayContaining([
        'WORKFORCE',
        'INSPECTIONS',
        'TECHNICAL_RISK',
        'INCIDENTS',
        'PPE',
        'TRAINING',
        'GOVERNANCE',
        'WORK_PERMITS',
      ]),
    );
    expect(
      forward.recommendations.every(
        ({
          ruleKeys,
          reasons,
          matchedFacts,
          recommendationState,
          humanDecision,
          activationEffect,
        }) =>
          ruleKeys.length > 0 &&
          reasons.length > 0 &&
          matchedFacts.length > 0 &&
          recommendationState === 'PROPOSED' &&
          humanDecision === 'PENDING' &&
          activationEffect === 'NONE',
      ),
    ).toBe(true);
  });

  it('reports an applicable unanswered fact without inventing an unconfirmed recommendation', () => {
    const input = snapshot(readyFacts());
    const result = evaluateSstCapabilityRecommendations(input, applicableQuestions(input));

    expect(resolveSstAssessmentReadiness(input, { channel: 'AUTHENTICATED' })).toBe(
      'DIAGNOSIS_READY',
    );

    expect(
      result.recommendations.some(({ capabilityKey }) => capabilityKey === 'WORK_PERMITS'),
    ).toBe(false);
    expect(result.missingInformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capabilityKey: 'WORK_PERMITS',
          pendingInformation: [
            {
              scopeKey: 'organization',
              factKey: 'organization.manualPermits',
              missingState: 'UNANSWERED',
            },
          ],
        }),
      ]),
    );
    expect(
      result.missingInformation.find(({ capabilityKey }) => capabilityKey === 'WORK_PERMITS')
        ?.pendingInformation[0],
    ).not.toHaveProperty('value');
  });

  it('preserves explicit unknown as scoped missing information and gives it no score', () => {
    const input = snapshot([...readyFacts(), unknownFact('organization.manualPermits')]);
    const result = evaluateSstCapabilityRecommendations(input, applicableQuestions(input));

    expect(
      result.recommendations.some(({ capabilityKey }) => capabilityKey === 'WORK_PERMITS'),
    ).toBe(false);
    expect(
      result.missingInformation.find(({ capabilityKey }) => capabilityKey === 'WORK_PERMITS')
        ?.pendingInformation,
    ).toEqual([
      {
        scopeKey: 'organization',
        factKey: 'organization.manualPermits',
        missingState: 'EXPLICIT_UNKNOWN',
      },
    ]);
  });

  it('keeps unanswered specialist information isolated to its exact work center', () => {
    const specialistQuestions = [
      { scopeKey: 'center:1', factKey: 'workCenter.hasConfinedSpaces' },
      { scopeKey: 'center:2', factKey: 'workCenter.hasConfinedSpaces' },
    ];
    const input = snapshot(
      [
        ...readyFacts(2),
        knownFact('organization.manualPermits', false),
        knownFact('workCenter.hasConfinedSpaces', false, 'center:1'),
      ],
      2,
    );
    const result = evaluateSstCapabilityRecommendations(
      input,
      applicableQuestions(input, specialistQuestions),
    );

    expect(
      result.missingInformation.find(({ capabilityKey }) => capabilityKey === 'WORK_PERMITS')
        ?.pendingInformation,
    ).toEqual([
      {
        scopeKey: 'center:2',
        factKey: 'workCenter.hasConfinedSpaces',
        missingState: 'UNANSWERED',
      },
    ]);
  });

  it('keeps a confirmed recommendation while exposing other applicable pending information', () => {
    const input = snapshot([...readyFacts(), knownFact('organization.manualPermits', true)]);
    const result = evaluateSstCapabilityRecommendations(
      input,
      applicableQuestions(input, [
        { scopeKey: 'center:1', factKey: 'workCenter.hasConfinedSpaces' },
      ]),
    );
    const recommendation = result.recommendations.find(
      ({ capabilityKey }) => capabilityKey === 'WORK_PERMITS',
    );

    expect(recommendation).toEqual(
      expect.objectContaining({
        recommendationState: 'PROPOSED',
        humanDecision: 'PENDING',
        activationEffect: 'NONE',
        pendingInformation: [
          {
            scopeKey: 'center:1',
            factKey: 'workCenter.hasConfinedSpaces',
            missingState: 'UNANSWERED',
          },
        ],
      }),
    );
  });

  it('does not report missing information when every applicable indicator is known negative', () => {
    const factKeys = [
      'workCenter.hasWorkAtHeight',
      'workCenter.hasHotWork',
      'workCenter.hasElectricalWorkOrExposure',
      'workCenter.hasConfinedSpaces',
    ];
    const input = snapshot([
      ...readyFacts(),
      knownFact('organization.manualPermits', false),
      ...factKeys.map((factKey) => knownFact(factKey, false, 'center:1')),
    ]);
    const result = evaluateSstCapabilityRecommendations(
      input,
      applicableQuestions(
        input,
        factKeys.map((factKey) => ({ scopeKey: 'center:1', factKey })),
      ),
    );

    expect(
      result.recommendations.some(({ capabilityKey }) => capabilityKey === 'WORK_PERMITS'),
    ).toBe(false);
    expect(
      result.missingInformation.some(({ capabilityKey }) => capabilityKey === 'WORK_PERMITS'),
    ).toBe(false);
  });

  it('does not turn commercial optional intake into capability uncertainty', () => {
    const input = snapshot([]);
    const result = evaluateSstCapabilityRecommendations(input, [
      {
        scopeKey: 'organization',
        factKey: 'organization.productObjectives',
        collectionPolicy: 'COMMERCIAL_OPTIONAL',
      },
    ]);

    expect(result.recommendations).toEqual([]);
    expect(result.missingInformation).toEqual([]);
  });

  it('does not report an explicit unknown fact that is not currently applicable', () => {
    const input = snapshot([
      ...readyFacts(),
      knownFact('organization.manualPermits', false),
      unknownFact('workCenter.hasConfinedSpaces', 'center:1'),
    ]);
    const result = evaluateSstCapabilityRecommendations(input, applicableQuestions(input));

    expect(
      result.missingInformation.some(({ capabilityKey }) => capabilityKey === 'WORK_PERMITS'),
    ).toBe(false);
  });

  it('canonicalizes the applicable question plan in deterministic hashes and output', () => {
    const input = snapshot([...readyFacts(), unknownFact('organization.manualPermits')]);
    const plan = applicableQuestions(input);
    const forward = evaluateSstCapabilityRecommendations(input, plan);
    const reversed = evaluateSstCapabilityRecommendations(input, [...plan].reverse());

    expect(forward).toEqual(reversed);
    expect(forward.inputHash).toMatch(/^sha256:/);
    expect(forward.outputHash).toMatch(/^sha256:/);
  });

  it('changes the deterministic output only after a relevant answer is confirmed', () => {
    const beforeInput = snapshot([knownFact('organization.totalWorkerCount', 84)]);
    const afterInput = snapshot([
      knownFact('organization.totalWorkerCount', 84),
      knownFact('organization.manualPermits', true),
    ]);
    const before = evaluateSstCapabilityRecommendations(
      beforeInput,
      applicableQuestions(beforeInput),
    );
    const after = evaluateSstCapabilityRecommendations(afterInput, applicableQuestions(afterInput));

    expect(
      before.recommendations.some(({ capabilityKey }) => capabilityKey === 'WORK_PERMITS'),
    ).toBe(false);
    expect(after.recommendations).toEqual(
      expect.arrayContaining([expect.objectContaining({ capabilityKey: 'WORK_PERMITS' })]),
    );
    expect(after.inputHash).not.toBe(before.inputHash);
    expect(after.outputHash).not.toBe(before.outputHash);
  });

  it('does not mutate facts and records the human and commercial boundaries', () => {
    const input = snapshot(structuredClone(operationalFacts));
    const original = structuredClone(input);
    const result = evaluateSstCapabilityRecommendations(input, applicableQuestions(input));

    expect(input).toEqual(original);
    expect(result.boundaries).toEqual({
      confirmedFactsOnly: true,
      humanConfirmationRequired: true,
      moduleActivation: 'NOT_PERFORMED',
      entitlementMutation: 'NOT_PERFORMED',
    });
  });
});
