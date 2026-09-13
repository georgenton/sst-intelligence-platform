import { describe, expect, it } from 'vitest';
import {
  SST_ASSESSMENT_CATALOG_VERSION,
  SST_ASSESSMENT_SCHEMA_VERSION,
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

function snapshot(facts: SstAssessmentFact[]): SstAssessmentSnapshot {
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
      {
        scopeKey: 'center:1',
        kind: 'WORK_CENTER',
        order: 1,
        displayName: 'Planta',
      },
    ],
    facts,
  };
}

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
    const forward = evaluateSstCapabilityRecommendations(snapshot(operationalFacts));
    const reversed = evaluateSstCapabilityRecommendations(
      snapshot([...operationalFacts].reverse()),
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

  it('declares missing information without inventing an unconfirmed recommendation', () => {
    const result = evaluateSstCapabilityRecommendations(
      snapshot([
        unknownFact('organization.manualPermits'),
        unknownFact('workCenter.hasWorkAtHeight', 'center:1'),
        unknownFact('workCenter.hasHotWork', 'center:1'),
      ]),
    );

    expect(result.recommendations).toEqual([]);
    expect(result.missingInformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capabilityKey: 'WORK_PERMITS',
          factKeys: [
            'organization.manualPermits',
            'workCenter.hasHotWork',
            'workCenter.hasWorkAtHeight',
          ],
        }),
      ]),
    );
    expect(JSON.stringify(result)).not.toContain('value');
  });

  it('changes the deterministic output only after a relevant answer is confirmed', () => {
    const before = evaluateSstCapabilityRecommendations(
      snapshot([knownFact('organization.totalWorkerCount', 84)]),
    );
    const after = evaluateSstCapabilityRecommendations(
      snapshot([
        knownFact('organization.totalWorkerCount', 84),
        knownFact('organization.manualPermits', true),
      ]),
    );

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
    const result = evaluateSstCapabilityRecommendations(input);

    expect(input).toEqual(original);
    expect(result.boundaries).toEqual({
      confirmedFactsOnly: true,
      humanConfirmationRequired: true,
      moduleActivation: 'NOT_PERFORMED',
      entitlementMutation: 'NOT_PERFORMED',
    });
  });
});
