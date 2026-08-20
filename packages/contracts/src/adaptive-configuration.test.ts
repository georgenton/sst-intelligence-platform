import { describe, expect, it } from 'vitest';
import {
  ADAPTIVE_LIMITS,
  ADAPTIVE_DEMO_DISCLAIMER,
  AdaptiveLimitExceededError,
  DEMO_ADAPTIVE_RULE_PACK,
  adaptiveContentHash,
  adaptivePackContentHash,
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

const limitFactTemplate = DEMO_ADAPTIVE_RULE_PACK.factVersions.find(
  ({ factKey }) => factKey === 'workCenter.hasWorkAtHeight',
)!;
const limitTargetTemplate = DEMO_ADAPTIVE_RULE_PACK.targetVersions[0]!;
const limitRuleTemplate = DEMO_ADAPTIVE_RULE_PACK.rules[0]!;
const limitGroupTemplate = DEMO_ADAPTIVE_RULE_PACK.groups.find(
  ({ groupKey }) => groupKey === 'PHYSICAL_WORKPLACE',
)!;

function limitFact(index: number) {
  return { ...limitFactTemplate, factKey: `limit.fact${index}` };
}

function limitTarget(index: number) {
  return { ...limitTargetTemplate, targetKey: `LIMIT_TARGET_${index}` };
}

function limitRule(index: number, factKey = 'limit.fact0') {
  return {
    ...limitRuleTemplate,
    ruleKey: `LIMIT_RULE_${index}`,
    groupKey: 'LIMIT_GROUP_0',
    targetKey: 'LIMIT_TARGET_0',
    scopeMode: 'EACH_WORK_CENTER' as const,
    condition: {
      kind: 'PREDICATE' as const,
      factKey,
      factScope: 'CURRENT_SCOPE' as const,
      operator: 'BOOLEAN_IS' as const,
      value: true,
    },
  };
}

function limitGroup(index: number, ruleKeys = ['LIMIT_RULE_0']) {
  return {
    ...limitGroupTemplate,
    groupKey: `LIMIT_GROUP_${index}`,
    ruleKeys,
    activation: {
      kind: 'PREDICATE' as const,
      factKey: 'limit.fact0',
      factScope: 'CURRENT_SCOPE' as const,
      operator: 'EXISTS' as const,
    },
  };
}

function limitPack(
  input: {
    facts?: number;
    targets?: number;
    rules?: number;
    groups?: number;
  } = {},
): AdaptiveRulePackContract {
  const factCount = input.facts ?? 1;
  const targetCount = input.targets ?? 1;
  const ruleCount = input.rules ?? 1;
  const groupCount = input.groups ?? 1;
  const rules = Array.from({ length: ruleCount }, (_, index) => limitRule(index));
  return {
    ...DEMO_ADAPTIVE_RULE_PACK,
    factVersions: Array.from({ length: factCount }, (_, index) => limitFact(index)),
    targetVersions: Array.from({ length: targetCount }, (_, index) => limitTarget(index)),
    rules,
    groups: Array.from({ length: groupCount }, (_, index) =>
      limitGroup(index, index === 0 ? rules.map(({ ruleKey }) => ruleKey) : ['LIMIT_RULE_0']),
    ),
  };
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
    expect(reverse.inputHash).toBe(forward.inputHash);
    expect(reverse.outputHash).toBe(forward.outputHash);
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

    const mixed = structuredClone(DEMO_ADAPTIVE_RULE_PACK);
    mixed.rules[0].isDemo = false;
    mixed.rules[0].regulatory = true;
    expect(() => validateAdaptivePack(mixed)).toThrow('boundary-incompatible');

    const regulatory = structuredClone(DEMO_ADAPTIVE_RULE_PACK);
    regulatory.isDemo = false;
    regulatory.regulatory = true;
    regulatory.targetVersions.forEach((target) => (target.isDemo = false));
    regulatory.rules.forEach((rule) => {
      rule.isDemo = false;
      rule.regulatory = true;
    });
    regulatory.groups.forEach((group) => {
      group.isDemo = false;
      group.regulatory = true;
    });
    expect(() => validateAdaptivePack(regulatory)).not.toThrow();
  });

  it('creates stable hashes and leaves historical snapshots independent', () => {
    const oldSnapshot = structuredClone(DEMO_ADAPTIVE_RULE_PACK);
    const next = structuredClone(DEMO_ADAPTIVE_RULE_PACK);
    next.version = '2.0.0';
    next.factVersions[0].questionText = 'Nueva redacción';
    expect(adaptiveContentHash(next)).not.toBe(adaptiveContentHash(oldSnapshot));
    expect(oldSnapshot.version).toBe('1.0.0');
    expect(oldSnapshot.factVersions[0].questionText).not.toBe('Nueva redacción');
    expect(adaptiveContentHash(oldSnapshot)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('canonicalizes pack insertion and nested commutative expressions with SHA-256', () => {
    const reversed = structuredClone(DEMO_ADAPTIVE_RULE_PACK);
    reversed.factVersions.reverse();
    reversed.targetVersions.reverse();
    reversed.rules.reverse();
    reversed.groups.reverse();
    reversed.groups.forEach((group) => group.ruleKeys.reverse());
    expect(adaptivePackContentHash(reversed)).toBe(
      adaptivePackContentHash(DEMO_ADAPTIVE_RULE_PACK),
    );

    const commutative = (mode: 'ALL' | 'ANY', nested = false) => {
      const pack = structuredClone(DEMO_ADAPTIVE_RULE_PACK);
      const predicates = [
        {
          kind: 'PREDICATE' as const,
          factKey: 'workCenter.hasWorkAtHeight',
          factScope: 'CURRENT_SCOPE' as const,
          operator: 'BOOLEAN_IS' as const,
          value: true,
        },
        {
          kind: 'PREDICATE' as const,
          factKey: 'workCenter.hasConfinedSpaces',
          factScope: 'CURRENT_SCOPE' as const,
          operator: 'BOOLEAN_IS' as const,
          value: true,
        },
      ];
      pack.rules[0].scopeMode = 'EACH_WORK_CENTER';
      const owningGroup = pack.groups.find(({ groupKey }) => groupKey === pack.rules[0].groupKey)!;
      owningGroup.scopeMode = 'EACH_WORK_CENTER';
      pack.rules[0].condition = nested
        ? {
            kind: 'GROUP',
            mode,
            clauses: [predicates[0], { kind: 'GROUP', mode: 'ALL', clauses: predicates }],
          }
        : { kind: 'GROUP', mode, clauses: predicates };
      return pack;
    };
    for (const [mode, nested] of [
      ['ALL', false],
      ['ANY', false],
      ['ALL', true],
    ] as const) {
      const forward = commutative(mode, nested);
      const reverse = structuredClone(forward);
      const expression = reverse.rules[0].condition;
      if (expression.kind === 'GROUP') {
        expression.clauses.reverse();
        for (const clause of expression.clauses)
          if (clause.kind === 'GROUP') clause.clauses.reverse();
      }
      expect(adaptivePackContentHash(reverse)).toBe(adaptivePackContentHash(forward));
      const facts: AdaptiveFactInput[] = [
        ...baseFacts,
        { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasWorkAtHeight', value: true },
        { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasConfinedSpaces', value: false },
        { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasExternalWorkforce', value: true },
      ];
      const forwardResult = evaluateAdaptiveConfiguration({
        pack: forward,
        scopes: [organization, centerA],
        facts,
      });
      const reverseResult = evaluateAdaptiveConfiguration({
        pack: reverse,
        scopes: [organization, centerA],
        facts,
      });
      expect(reverseResult.items).toEqual(forwardResult.items);
      expect(reverseResult.ruleTraces).toEqual(forwardResult.ruleTraces);
      expect(reverseResult.outputHash).toBe(forwardResult.outputHash);
    }
  });

  it('changes pack, input and output hashes only for meaningful content', () => {
    const baseHash = adaptivePackContentHash(DEMO_ADAPTIVE_RULE_PACK);
    for (const mutate of [
      (pack: AdaptiveRulePackContract) => {
        pack.factVersions[0].version = '2.0.0';
      },
      (pack: AdaptiveRulePackContract) => {
        pack.targetVersions[0].version = '2.0.0';
      },
      (pack: AdaptiveRulePackContract) => {
        pack.rules[0].version = '2.0.0';
      },
      (pack: AdaptiveRulePackContract) => {
        pack.groups[0].activation = {
          kind: 'PREDICATE',
          factKey: 'organization.country',
          factScope: 'ORGANIZATION',
          operator: 'EQUALS',
          value: 'EC',
        };
      },
      (pack: AdaptiveRulePackContract) => {
        pack.groups[0].ruleKeys = ['GENERAL_MANAGEMENT_BASELINE', 'REMOTE_WORK_REVIEW'];
      },
    ]) {
      const changed = structuredClone(DEMO_ADAPTIVE_RULE_PACK);
      mutate(changed);
      expect(adaptivePackContentHash(changed)).not.toBe(baseHash);
    }

    const first = evaluate(baseFacts);
    const changedInput = evaluate([
      ...baseFacts,
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.workArrangement', value: 'REMOTE' },
    ]);
    expect(changedInput.inputHash).not.toBe(first.inputHash);
    expect(changedInput.outputHash).not.toBe(first.outputHash);

    const auditedFacts: AdaptiveFactInput[] = baseFacts.map((fact, index) => ({
      ...fact,
      factVersionId: `fact-version-${index}`,
      source: 'DERIVED_PROFILE',
    }));
    const audited = (facts: AdaptiveFactInput[], packVersionId = 'pack-version-1') =>
      evaluateAdaptiveConfiguration({
        pack: DEMO_ADAPTIVE_RULE_PACK,
        scopes: [organization, centerA],
        facts,
        auditContext: {
          packVersionId,
          packContentHash: adaptivePackContentHash(DEMO_ADAPTIVE_RULE_PACK),
        },
      }).inputHash;
    const auditedHash = audited(auditedFacts);
    expect(audited(auditedFacts, 'pack-version-2')).not.toBe(auditedHash);
    expect(
      audited(
        auditedFacts.map((fact, index) =>
          index === 0 ? { ...fact, source: 'USER_DECLARED' } : fact,
        ),
      ),
    ).not.toBe(auditedHash);
    expect(
      audited(
        auditedFacts.map((fact, index) =>
          index === 0 ? { ...fact, factVersionId: 'fact-version-replaced' } : fact,
        ),
      ),
    ).not.toBe(auditedHash);
  });

  it('plans nested decision-relevant activation facts without leaking irrelevant missing facts', () => {
    const nestedPack = (outerMode: 'ALL' | 'ANY'): AdaptiveRulePackContract => ({
      ...DEMO_ADAPTIVE_RULE_PACK,
      groups: [
        {
          ...DEMO_ADAPTIVE_RULE_PACK.groups[0],
          groupKey: 'NESTED_RELEVANCE',
          scopeMode: 'EACH_WORK_CENTER',
          activation: {
            kind: 'GROUP',
            mode: outerMode,
            clauses: [
              {
                kind: 'PREDICATE',
                factKey: 'workCenter.hasWorkAtHeight',
                factScope: 'CURRENT_SCOPE',
                operator: 'BOOLEAN_IS',
                value: true,
              },
              {
                kind: 'GROUP',
                mode: outerMode === 'ALL' ? 'ANY' : 'ALL',
                clauses: [
                  {
                    kind: 'PREDICATE',
                    factKey: 'workCenter.hasConfinedSpaces',
                    factScope: 'CURRENT_SCOPE',
                    operator: 'BOOLEAN_IS',
                    value: true,
                  },
                  {
                    kind: 'PREDICATE',
                    factKey: 'workCenter.hasExternalWorkforce',
                    factScope: 'CURRENT_SCOPE',
                    operator: 'BOOLEAN_IS',
                    value: true,
                  },
                ],
              },
            ],
          },
          ruleKeys: ['GENERAL_MANAGEMENT_BASELINE'],
        },
      ],
      rules: [
        {
          ...DEMO_ADAPTIVE_RULE_PACK.rules[0],
          groupKey: 'NESTED_RELEVANCE',
          scopeMode: 'EACH_WORK_CENTER',
        },
      ],
    });
    const facts = [
      ...baseFacts,
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasWorkAtHeight', value: true },
      { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasConfinedSpaces', value: false },
    ];
    const unresolved = evaluateAdaptiveConfiguration({
      pack: nestedPack('ALL'),
      scopes: [organization, centerA],
      facts,
    });
    expect(unresolved.questions.map(({ factKey }) => factKey)).toEqual([
      'workCenter.hasExternalWorkforce',
    ]);
    const resolved = evaluateAdaptiveConfiguration({
      pack: nestedPack('ANY'),
      scopes: [organization, centerA],
      facts,
    });
    expect(resolved.questions).toHaveLength(0);
  });

  it('deduplicates the same fact within a center but never across center scopes', () => {
    const pack = structuredClone(DEMO_ADAPTIVE_RULE_PACK);
    const template = pack.rules.find(({ ruleKey }) => ruleKey === 'PHYSICAL_TECHNICAL_INSPECTION')!;
    const rules = ['HEIGHT_NEED_A', 'HEIGHT_NEED_B', 'HEIGHT_NEED_C'].map((ruleKey) => ({
      ...template,
      ruleKey,
      condition: {
        kind: 'PREDICATE' as const,
        factKey: 'workCenter.hasWorkAtHeight',
        factScope: 'CURRENT_SCOPE' as const,
        operator: 'BOOLEAN_IS' as const,
        value: true,
      },
    }));
    pack.rules = rules;
    pack.groups = [
      {
        ...pack.groups.find(({ groupKey }) => groupKey === 'PHYSICAL_WORKPLACE')!,
        ruleKeys: rules.map(({ ruleKey }) => ruleKey),
      },
    ];
    const facts = [
      ...baseFacts,
      ...[centerA, centerB].map((scope) => ({
        scopeKey: scope.scopeKey,
        factKey: 'workCenter.workArrangement',
        value: 'PHYSICAL',
      })),
    ];
    const result = evaluateAdaptiveConfiguration({
      pack,
      scopes: [organization, centerA, centerB],
      facts,
    });
    expect(result.questions.map(({ scopeKey, factKey }) => `${scopeKey}:${factKey}`)).toEqual([
      'work-center:a:workCenter.hasWorkAtHeight',
      'work-center:b:workCenter.hasWorkAtHeight',
    ]);
    expect(result.questions.every(({ relatedRuleKeys }) => relatedRuleKeys.length === 3)).toBe(
      true,
    );
  });

  it('deduplicates an organization-scoped fact across work centers', () => {
    const pack = structuredClone(DEMO_ADAPTIVE_RULE_PACK);
    const organizationFact = {
      ...limitFactTemplate,
      factKey: 'organization.policyKnown',
      defaultScope: 'ORGANIZATION' as const,
      questionText: '¿La política organizacional está definida?',
    };
    const rules = ['ORG_NEED_A', 'ORG_NEED_B', 'ORG_NEED_C'].map((ruleKey) => ({
      ...limitRuleTemplate,
      ruleKey,
      groupKey: 'ORG_FACT_FROM_CENTERS',
      scopeMode: 'EACH_WORK_CENTER' as const,
      condition: {
        kind: 'PREDICATE' as const,
        factKey: organizationFact.factKey,
        factScope: 'ORGANIZATION' as const,
        operator: 'BOOLEAN_IS' as const,
        value: true,
      },
    }));
    pack.factVersions = [...pack.factVersions, organizationFact];
    pack.rules = rules;
    pack.groups = [
      {
        ...limitGroupTemplate,
        groupKey: 'ORG_FACT_FROM_CENTERS',
        scopeMode: 'EACH_WORK_CENTER',
        activation: {
          kind: 'PREDICATE',
          factKey: 'organization.country',
          factScope: 'ORGANIZATION',
          operator: 'EXISTS',
        },
        ruleKeys: rules.map(({ ruleKey }) => ruleKey),
      },
    ];
    const result = evaluateAdaptiveConfiguration({
      pack,
      scopes: [organization, centerA, centerB],
      facts: baseFacts,
    });
    expect(result.questions).toEqual([
      expect.objectContaining({
        scopeKey: 'organization',
        factKey: organizationFact.factKey,
        relatedRuleKeys: rules.map(({ ruleKey }) => ruleKey).sort(),
      }),
    ]);
  });

  it('isolates work-center facts and rejects cross-scope rule references', () => {
    const pack = structuredClone(DEMO_ADAPTIVE_RULE_PACK);
    const rule = {
      ...limitRuleTemplate,
      ruleKey: 'CENTER_ISOLATION_RULE',
      groupKey: 'CENTER_ISOLATION',
      scopeMode: 'EACH_WORK_CENTER' as const,
      condition: {
        kind: 'PREDICATE' as const,
        factKey: 'workCenter.hasWorkAtHeight',
        factScope: 'CURRENT_SCOPE' as const,
        operator: 'BOOLEAN_IS' as const,
        value: true,
      },
    };
    pack.rules = [rule];
    pack.groups = [
      {
        ...limitGroupTemplate,
        groupKey: 'CENTER_ISOLATION',
        scopeMode: 'EACH_WORK_CENTER',
        activation: {
          kind: 'PREDICATE',
          factKey: 'organization.country',
          factScope: 'ORGANIZATION',
          operator: 'EXISTS',
        },
        ruleKeys: [rule.ruleKey],
      },
    ];
    const result = evaluateAdaptiveConfiguration({
      pack,
      scopes: [organization, centerA, centerB],
      facts: [
        ...baseFacts,
        { scopeKey: centerA.scopeKey, factKey: 'workCenter.hasWorkAtHeight', value: false },
        { scopeKey: centerB.scopeKey, factKey: 'workCenter.hasWorkAtHeight', value: true },
      ],
    });
    expect(result.items.map(({ scopeKey }) => scopeKey)).toEqual([centerB.scopeKey]);

    const malformed = structuredClone(pack);
    const condition = malformed.rules[0].condition;
    if (condition.kind === 'PREDICATE') condition.factScope = 'ORGANIZATION';
    expect(() => validateAdaptivePack(malformed)).toThrow(
      'Fact scope mismatch: workCenter.hasWorkAtHeight',
    );
  });

  it('enforces expression, catalog and pack limits at and above every boundary', () => {
    const atClauses = limitPack();
    atClauses.rules[0].condition = {
      kind: 'GROUP',
      mode: 'ALL',
      clauses: Array.from({ length: ADAPTIVE_LIMITS.clausesPerExpression }, () => ({
        kind: 'PREDICATE' as const,
        factKey: 'limit.fact0',
        factScope: 'CURRENT_SCOPE' as const,
        operator: 'EXISTS' as const,
      })),
    };
    expect(() => validateAdaptivePack(atClauses)).not.toThrow();
    const overClauses = structuredClone(atClauses);
    if (overClauses.rules[0].condition.kind === 'GROUP')
      overClauses.rules[0].condition.clauses.push(
        structuredClone(overClauses.rules[0].condition.clauses[0]!),
      );
    expect(() => validateAdaptivePack(overClauses)).toThrow();

    const nestedExpression = (groups: number) => {
      let expression = limitRule(0).condition;
      for (let index = 0; index < groups; index += 1)
        expression = { kind: 'GROUP', mode: 'ALL', clauses: [expression] };
      return expression;
    };
    const atDepth = limitPack();
    atDepth.rules[0].condition = nestedExpression(ADAPTIVE_LIMITS.expressionDepth - 1);
    expect(() => validateAdaptivePack(atDepth)).not.toThrow();
    const overDepth = limitPack();
    overDepth.rules[0].condition = nestedExpression(ADAPTIVE_LIMITS.expressionDepth);
    expect(() => validateAdaptivePack(overDepth)).toThrow(
      'ADAPTIVE_LIMIT_EXCEEDED:expressionDepth',
    );

    const predicates = (lastRuleClauses: number) => {
      const pack = limitPack({ rules: 25 });
      pack.rules.forEach((rule, index) => {
        rule.condition = {
          kind: 'GROUP',
          mode: 'ALL',
          clauses: Array.from(
            { length: index === 24 ? lastRuleClauses : ADAPTIVE_LIMITS.clausesPerExpression },
            () => ({
              kind: 'PREDICATE' as const,
              factKey: 'limit.fact0',
              factScope: 'CURRENT_SCOPE' as const,
              operator: 'EXISTS' as const,
            }),
          ),
        };
      });
      return pack;
    };
    expect(() => validateAdaptivePack(predicates(19))).not.toThrow();
    expect(() => validateAdaptivePack(predicates(20))).toThrow(
      'ADAPTIVE_LIMIT_EXCEEDED:predicatesPerPack',
    );

    for (const [limit, key] of [
      [ADAPTIVE_LIMITS.rulesPerPack, 'rules'],
      [ADAPTIVE_LIMITS.groupsPerPack, 'groups'],
      [ADAPTIVE_LIMITS.factVersionsPerPack, 'facts'],
      [ADAPTIVE_LIMITS.targetVersionsPerPack, 'targets'],
    ] as const) {
      expect(() => validateAdaptivePack(limitPack({ [key]: limit }))).not.toThrow();
      expect(() => validateAdaptivePack(limitPack({ [key]: limit + 1 }))).toThrow();
    }
  });

  it('enforces finite evaluation limits without silently truncating questions', () => {
    const scopePack: AdaptiveRulePackContract = {
      ...DEMO_ADAPTIVE_RULE_PACK,
      groups: [DEMO_ADAPTIVE_RULE_PACK.groups[0]],
      rules: [DEMO_ADAPTIVE_RULE_PACK.rules[0]],
    };
    const scopes = Array.from({ length: ADAPTIVE_LIMITS.scopesPerEvaluation }, (_, index) => ({
      scopeKey: index === 0 ? 'organization' : `work-center:${index}`,
      kind: index === 0 ? ('ORGANIZATION' as const) : ('WORK_CENTER' as const),
      order: index,
      displayName: `Scope ${index}`,
    }));
    expect(() =>
      evaluateAdaptiveConfiguration({ pack: scopePack, scopes, facts: baseFacts }),
    ).not.toThrow();
    expect(() =>
      evaluateAdaptiveConfiguration({
        pack: scopePack,
        scopes: [...scopes, { ...centerB, scopeKey: 'work-center:over', order: 102 }],
        facts: baseFacts,
      }),
    ).toThrow(AdaptiveLimitExceededError);
    const factsAtLimit = Array.from(
      { length: ADAPTIVE_LIMITS.factsPerEvaluation },
      () => baseFacts[0],
    );
    expect(() =>
      evaluateAdaptiveConfiguration({
        pack: DEMO_ADAPTIVE_RULE_PACK,
        scopes: [organization],
        facts: factsAtLimit,
      }),
    ).not.toThrow();
    expect(() =>
      evaluateAdaptiveConfiguration({
        pack: DEMO_ADAPTIVE_RULE_PACK,
        scopes: [organization],
        facts: [...factsAtLimit, baseFacts[0]],
      }),
    ).toThrow('ADAPTIVE_LIMIT_EXCEEDED:factsPerEvaluation');

    const questionPack = structuredClone(DEMO_ADAPTIVE_RULE_PACK);
    const questionFacts = ['workCenter.hasWorkAtHeight', 'workCenter.hasConfinedSpaces'];
    questionPack.rules = questionFacts.map((factKey, index) => ({
      ...limitRuleTemplate,
      ruleKey: `QUESTION_LIMIT_RULE_${index}`,
      groupKey: 'QUESTION_LIMIT_GROUP',
      scopeMode: 'EACH_WORK_CENTER' as const,
      condition: {
        kind: 'PREDICATE' as const,
        factKey,
        factScope: 'CURRENT_SCOPE' as const,
        operator: 'BOOLEAN_IS' as const,
        value: true,
      },
    }));
    questionPack.groups = [
      {
        ...limitGroupTemplate,
        groupKey: 'QUESTION_LIMIT_GROUP',
        scopeMode: 'EACH_WORK_CENTER',
        activation: {
          kind: 'PREDICATE',
          factKey: 'organization.country',
          factScope: 'ORGANIZATION',
          operator: 'EXISTS',
        },
        ruleKeys: questionPack.rules.map(({ ruleKey }) => ruleKey),
      },
    ];
    const centers = (count: number): AdaptiveScopeInput[] => [
      organization,
      ...Array.from({ length: count }, (_, index) => ({
        scopeKey: `work-center:question-${index}`,
        kind: 'WORK_CENTER' as const,
        order: index + 1,
        displayName: `Centro ${index}`,
      })),
    ];
    expect(
      evaluateAdaptiveConfiguration({
        pack: questionPack,
        scopes: centers(ADAPTIVE_LIMITS.questionsPerRun / 2),
        facts: [baseFacts[0]],
      }).questions,
    ).toHaveLength(ADAPTIVE_LIMITS.questionsPerRun);
    expect(() =>
      evaluateAdaptiveConfiguration({
        pack: questionPack,
        scopes: centers(ADAPTIVE_LIMITS.questionsPerRun / 2 + 1),
        facts: [baseFacts[0]],
      }),
    ).toThrow('ADAPTIVE_LIMIT_EXCEEDED:questionsPerRun');
  });
});
