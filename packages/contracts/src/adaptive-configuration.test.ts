import { describe, expect, it } from 'vitest';
import {
  ADAPTIVE_DEMO_DISCLAIMER,
  DEMO_ADAPTIVE_RULE_PACK,
  adaptiveContentHash,
  assertAdaptiveRulePublication,
  evaluateAdaptiveConfiguration,
  validateAdaptiveFactValue,
  validateAdaptivePack,
  type AdaptiveFactInput,
  type AdaptiveRulePackContract,
  type AdaptiveScopeInput,
} from './adaptive-configuration.js';

const organization: AdaptiveScopeInput = {
  scopeKey: 'organization',
  kind: 'ORGANIZATION',
  order: 0,
  displayName: 'Organización',
};
const centerA: AdaptiveScopeInput = {
  scopeKey: 'work-center:a',
  kind: 'WORK_CENTER',
  workCenterId: 'a',
  order: 1,
  displayName: 'Centro A',
};
const centerB: AdaptiveScopeInput = {
  scopeKey: 'work-center:b',
  kind: 'WORK_CENTER',
  workCenterId: 'b',
  order: 2,
  displayName: 'Centro B',
};

const baseFacts: AdaptiveFactInput[] = [
  { scopeKey: 'organization', factKey: 'organization.country', value: 'EC' },
  { scopeKey: 'organization', factKey: 'organization.sector', value: 'Servicios' },
  { scopeKey: 'organization', factKey: 'organization.totalWorkerCount', value: 6 },
  { scopeKey: 'organization', factKey: 'organization.workCenterCount', value: 1 },
];

function evaluate(facts: AdaptiveFactInput[], scopes = [organization, centerA]) {
  return evaluateAdaptiveConfiguration({ pack: DEMO_ADAPTIVE_RULE_PACK, scopes, facts });
}

function questionFacts(facts: AdaptiveFactInput[], scopes?: AdaptiveScopeInput[]) {
  return evaluate(facts, scopes).questions.map(({ scopeKey, factKey }) => `${scopeKey}:${factKey}`);
}

describe('adaptive deterministic engine', () => {
  it('validates typed facts without treating unknown as false or zero', () => {
    const integer = DEMO_ADAPTIVE_RULE_PACK.factVersions.find(
      ({ factKey }) => factKey === 'workCenter.workerCount',
    )!;
    expect(validateAdaptiveFactValue(integer, 0)).toBe(0);
    expect(() => validateAdaptiveFactValue(integer, null)).toThrow('Unanswered');
    expect(() => validateAdaptiveFactValue(integer, '6')).toThrow('Expected integer');
  });

  it('implements decision-relevant ALL/ANY truth behavior', () => {
    const pack = (mode: 'ALL' | 'ANY', firstExpected: boolean): AdaptiveRulePackContract => ({
      ...DEMO_ADAPTIVE_RULE_PACK,
      groups: [
        {
          ...DEMO_ADAPTIVE_RULE_PACK.groups[0],
          groupKey: 'TRUTH_TABLE',
          scopeMode: 'EACH_WORK_CENTER',
          activation: {
            kind: 'GROUP',
            mode,
            clauses: [
              {
                kind: 'PREDICATE',
                factKey: 'workCenter.hasWorkAtHeight',
                factScope: 'CURRENT_SCOPE',
                operator: 'BOOLEAN_IS',
                value: firstExpected,
              },
              {
                kind: 'PREDICATE',
                factKey: 'workCenter.hasConfinedSpaces',
                factScope: 'CURRENT_SCOPE',
                operator: 'BOOLEAN_IS',
                value: true,
              },
            ],
          },
          ruleKeys: ['GENERAL_MANAGEMENT_BASELINE'],
        },
      ],
      rules: [
        {
          ...DEMO_ADAPTIVE_RULE_PACK.rules[0],
          groupKey: 'TRUTH_TABLE',
          scopeMode: 'EACH_WORK_CENTER',
        },
      ],
    });
    const run = (mode: 'ALL' | 'ANY', actual: boolean) =>
      evaluateAdaptiveConfiguration({
        pack: pack(mode, true),
        scopes: [organization, centerA],
        facts: [
          ...baseFacts,
          { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasWorkAtHeight', value: actual },
        ],
      });
    expect(run('ALL', false).questions).toHaveLength(0); // ALL(FALSE, MISSING)
    expect(run('ALL', true).questions.map(({ factKey }) => factKey)).toContain(
      'workCenter.hasConfinedSpaces',
    ); // ALL(TRUE, MISSING)
    expect(run('ANY', true).questions).toHaveLength(0); // ANY(TRUE, MISSING)
    expect(run('ANY', false).questions.map(({ factKey }) => factKey)).toContain(
      'workCenter.hasConfinedSpaces',
    ); // ANY(FALSE, MISSING)
  });

  it('deduplicates questions and orders them deterministically', () => {
    const first = questionFacts(baseFacts);
    const second = questionFacts([...baseFacts].reverse());
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
    expect(first[0]).toBe('work-center:a:workCenter.workArrangement');
  });

  it('produces a simple office path and a distinct remote branch', () => {
    const office = evaluate([
      ...baseFacts,
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.workArrangement', value: 'PHYSICAL' },
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.facilityType', value: 'OFFICE' },
      {
        scopeKey: centerA.scopeKey,
        factKey: 'workCenter.hasDistinctOperationalZones',
        value: false,
      },
      {
        scopeKey: centerA.scopeKey,
        factKey: 'workCenter.activityCategory',
        value: 'ADMINISTRATIVE_SERVICES',
      },
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasChemicalProcesses', value: false },
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasHighEnergyOperations', value: false },
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasWorkAtHeight', value: false },
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasConfinedSpaces', value: false },
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasExternalWorkforce', value: false },
    ]);
    expect(
      office.items.find(({ targetKey }) => targetKey === 'EMERGENCY_PREPAREDNESS'),
    ).toMatchObject({ minimumDepth: 'BASIC_VISIBLE' });

    const remote = evaluate([
      ...baseFacts,
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.workArrangement', value: 'REMOTE' },
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasChemicalProcesses', value: false },
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasHighEnergyOperations', value: false },
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasWorkAtHeight', value: false },
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasConfinedSpaces', value: false },
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasExternalWorkforce', value: false },
    ]);
    expect(remote.items.map(({ targetKey }) => targetKey)).toContain('REMOTE_WORK_REVIEW');
    expect(remote.items.map(({ targetKey }) => targetKey)).not.toContain('EMERGENCY_PREPAREDNESS');
  });

  it('raises technical depth for chemical/high-energy and small construction scopes', () => {
    const facts: AdaptiveFactInput[] = [
      ...baseFacts.map((item) =>
        item.factKey === 'organization.workCenterCount'
          ? { ...item, value: 2 }
          : item.factKey === 'organization.totalWorkerCount'
            ? { ...item, value: 18 }
            : item,
      ),
      ...[centerA, centerB].flatMap((scope, index): AdaptiveFactInput[] => [
        { scopeKey: scope.scopeKey, factKey: 'workCenter.workArrangement', value: 'PHYSICAL' },
        {
          scopeKey: scope.scopeKey,
          factKey: 'workCenter.activityCategory',
          value: index === 0 ? 'CONSTRUCTION_ASSEMBLY' : 'PRODUCTION',
        },
        {
          scopeKey: scope.scopeKey,
          factKey: 'workCenter.facilityType',
          value: index === 0 ? 'CONSTRUCTION_SITE' : 'PLANT',
        },
        {
          scopeKey: scope.scopeKey,
          factKey: 'workCenter.hasDistinctOperationalZones',
          value: true,
        },
        {
          scopeKey: scope.scopeKey,
          factKey: 'workCenter.hasChemicalProcesses',
          value: index === 1,
        },
        { scopeKey: scope.scopeKey, factKey: 'workCenter.hasHighEnergyOperations', value: true },
        { scopeKey: scope.scopeKey, factKey: 'workCenter.hasWorkAtHeight', value: index === 0 },
        { scopeKey: scope.scopeKey, factKey: 'workCenter.hasConfinedSpaces', value: false },
        {
          scopeKey: scope.scopeKey,
          factKey: 'workCenter.hasExternalWorkforce',
          value: index === 0,
        },
        { scopeKey: scope.scopeKey, factKey: 'workCenter.hasCriticalMachinery', value: true },
      ]),
    ];
    const result = evaluate(facts, [organization, centerA, centerB]);
    expect(
      result.items.some(
        ({ scopeKey, minimumDepth }) =>
          scopeKey === centerA.scopeKey && minimumDepth === 'TECHNICAL',
      ),
    ).toBe(true);
    expect(
      result.items.some(
        ({ scopeKey, targetKey }) =>
          scopeKey === centerB.scopeKey && targetKey === 'CHEMICAL_PROCESS_CONTROLS',
      ),
    ).toBe(true);
    expect(result.items.some(({ professionalReview }) => professionalReview)).toBe(true);
  });

  it('keeps strategic priorities and current-state concepts outside rule results', () => {
    const first = evaluate(baseFacts);
    const second = evaluate([
      ...baseFacts,
      {
        scopeKey: 'organization',
        factKey: 'organization.strategicProtectionPriorities',
        value: ['REPUTATION'],
      },
    ]);
    expect(second.items).toEqual(first.items);
    expect(second.questions).toEqual(first.questions);
  });

  it('is stable under pack rule and group reversal', () => {
    const facts = [
      ...baseFacts,
      {
        scopeKey: centerA.scopeKey,
        factKey: 'workCenter.workArrangement',
        value: 'PHYSICAL' as const,
      },
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.facilityType', value: 'OFFICE' as const },
    ];
    const forward = evaluate(facts);
    const reverse = evaluateAdaptiveConfiguration({
      pack: {
        ...DEMO_ADAPTIVE_RULE_PACK,
        groups: [...DEMO_ADAPTIVE_RULE_PACK.groups].reverse(),
        rules: [...DEMO_ADAPTIVE_RULE_PACK.rules].reverse(),
      },
      scopes: [organization, centerA],
      facts,
    });
    expect(reverse.questions).toEqual(forward.questions);
    expect(reverse.items).toEqual(forward.items);
  });

  it('enforces publication gates and rejects context facts in rules', () => {
    expect(() =>
      assertAdaptiveRulePublication({ isDemo: false, regulatory: true, requirementStatuses: [] }),
    ).toThrow('requires provenance');
    expect(() =>
      assertAdaptiveRulePublication({
        isDemo: false,
        regulatory: true,
        requirementStatuses: ['DRAFT'],
      }),
    ).toThrow('approved requirements');
    expect(() =>
      assertAdaptiveRulePublication({
        isDemo: false,
        regulatory: true,
        requirementStatuses: ['APPROVED_FOR_RULE_DRAFTING'],
      }),
    ).not.toThrow();
    expect(() =>
      assertAdaptiveRulePublication({
        isDemo: true,
        regulatory: false,
        disclaimer: ADAPTIVE_DEMO_DISCLAIMER,
        requirementStatuses: [],
      }),
    ).not.toThrow();
    expect(() =>
      assertAdaptiveRulePublication({ isDemo: true, regulatory: false, requirementStatuses: [] }),
    ).toThrow('disclaimer');

    const invalid = structuredClone(DEMO_ADAPTIVE_RULE_PACK);
    invalid.rules[0].condition = {
      kind: 'PREDICATE',
      factKey: 'organization.strategicProtectionPriorities',
      factScope: 'ORGANIZATION',
      operator: 'EXISTS',
    };
    expect(() => validateAdaptivePack(invalid)).toThrow('Context-only');
  });

  it('creates stable hashes and leaves historical snapshots independent', () => {
    const oldSnapshot = structuredClone(DEMO_ADAPTIVE_RULE_PACK);
    const next = structuredClone(DEMO_ADAPTIVE_RULE_PACK);
    next.version = '2.0.0';
    next.factVersions[0].questionText = 'Nueva redacción';
    expect(adaptiveContentHash(next)).not.toBe(adaptiveContentHash(oldSnapshot));
    expect(oldSnapshot.version).toBe('1.0.0');
    expect(oldSnapshot.factVersions[0].questionText).not.toBe('Nueva redacción');
  });
});
