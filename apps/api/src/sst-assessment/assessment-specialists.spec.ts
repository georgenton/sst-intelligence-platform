import {
  DEMO_ADAPTIVE_RULE_PACK,
  evaluateAdaptiveConfiguration,
  type SstAssessmentFact,
  type SstAssessmentFactValue,
  type SstAssessmentSnapshot,
} from '@sst/contracts';
import { adaptAssessmentFactsToAdaptive } from './assessment-specialists';

const scopes = [
  {
    scopeKey: 'organization',
    kind: 'ORGANIZATION' as const,
    order: 0,
    displayName: 'Organización',
  },
  { scopeKey: 'center:1', kind: 'WORK_CENTER' as const, order: 1, displayName: 'Centro 1' },
  { scopeKey: 'center:2', kind: 'WORK_CENTER' as const, order: 2, displayName: 'Centro 2' },
];

const fact = (
  factKey: string,
  scopeKey: string,
  value: SstAssessmentFactValue,
): SstAssessmentFact => ({
  factKey,
  scopeKey,
  answerState: 'KNOWN',
  value,
  provenance: { source: 'PUBLIC_DECLARATION' },
});

function snapshot(facts: SstAssessmentFact[]): SstAssessmentSnapshot {
  return { schemaVersion: '1.0.0', catalogVersion: '1.0.0', scopes, facts };
}

function specialistResult(input: SstAssessmentSnapshot) {
  return evaluateAdaptiveConfiguration({
    pack: DEMO_ADAPTIVE_RULE_PACK,
    scopes: input.scopes.map(({ scopeKey, kind, order }) => ({
      scopeKey,
      kind,
      order,
      displayName: kind === 'ORGANIZATION' ? 'Organización' : `Centro ${order}`,
    })),
    facts: adaptAssessmentFactsToAdaptive(input, DEMO_ADAPTIVE_RULE_PACK),
  });
}

describe('canonical assessment specialist adapter', () => {
  const decisionFacts = [
    fact('organization.country', 'organization', 'EC'),
    fact('organization.sector', 'organization', 'Servicios'),
    fact('organization.totalWorkerCount', 'organization', 25),
    fact('organization.workCenterCount', 'organization', 2),
    fact('workCenter.workArrangement', 'center:1', 'PHYSICAL'),
    fact('workCenter.hasChemicalProcesses', 'center:1', true),
    fact('workCenter.hasChemicalProcesses', 'center:2', false),
  ];

  it('does not fan an organization-level legacy flag out to work centers', () => {
    const adapted = adaptAssessmentFactsToAdaptive(
      snapshot(decisionFacts),
      DEMO_ADAPTIVE_RULE_PACK,
    );
    expect(adapted.filter(({ factKey }) => factKey === 'workCenter.hasChemicalProcesses')).toEqual([
      expect.objectContaining({ scopeKey: 'center:1', value: true }),
      expect.objectContaining({ scopeKey: 'center:2', value: false }),
    ]);
  });

  it('never compresses canonical multi-choice activities or facilities into legacy singular keys', () => {
    const adapted = adaptAssessmentFactsToAdaptive(
      snapshot([
        ...decisionFacts,
        fact('workCenter.activityCategories', 'center:1', ['ADMINISTRATIVE_SERVICES', 'WAREHOUSE']),
        fact('workCenter.facilityTypes', 'center:1', ['OFFICE', 'WAREHOUSE']),
      ]),
      DEMO_ADAPTIVE_RULE_PACK,
    );
    expect(adapted.some(({ factKey }) => factKey === 'workCenter.activityCategory')).toBe(false);
    expect(adapted.some(({ factKey }) => factKey === 'workCenter.facilityType')).toBe(false);
  });

  it('keeps commercial context outside adaptive technical decisions', () => {
    const baseline = specialistResult(snapshot(decisionFacts));
    const commercial = specialistResult(
      snapshot([
        ...decisionFacts,
        fact('organization.budgetRange', 'organization', 'ENTERPRISE'),
        fact('organization.estimatedUsers', 'organization', 900),
        fact('organization.rolloutPreference', 'organization', 'FULL'),
        fact('organization.implementationUrgency', 'organization', 'IMMEDIATE'),
      ]),
    );
    expect(commercial.items).toEqual(baseline.items);
    expect(commercial.ruleTraces).toEqual(baseline.ruleTraces);
  });

  it('keeps strategic priorities outside legal/risk and adaptive rule decisions', () => {
    const baseline = specialistResult(snapshot(decisionFacts));
    const strategic = specialistResult(
      snapshot([
        ...decisionFacts,
        fact('organization.strategicProtectionPriorities', 'organization', [
          'PEOPLE_AND_HEALTH',
          'BUSINESS_CONTINUITY',
        ]),
      ]),
    );
    expect(strategic.items).toEqual(baseline.items);
    expect(strategic.ruleTraces).toEqual(baseline.ruleTraces);
  });

  it('omits explicit unknown from specialist input while retaining known false', () => {
    const input = snapshot([
      fact('workCenter.hasChemicalProcesses', 'center:1', false),
      {
        factKey: 'workCenter.hasHighEnergyOperations',
        scopeKey: 'center:1',
        answerState: 'EXPLICIT_UNKNOWN',
        provenance: { source: 'PUBLIC_DECLARATION' },
      },
    ]);
    expect(adaptAssessmentFactsToAdaptive(input, DEMO_ADAPTIVE_RULE_PACK)).toEqual([
      expect.objectContaining({
        factKey: 'workCenter.hasChemicalProcesses',
        scopeKey: 'center:1',
        value: false,
      }),
    ]);
  });
});
