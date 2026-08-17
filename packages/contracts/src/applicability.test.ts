import { describe, expect, it } from 'vitest';
import {
  APPLICABILITY_STATES,
  DEMO_APPLICABILITY_RULE_PACK,
  applicabilityRulePackSchema,
  evaluateApplicability,
  type ApplicabilityRulePack,
  type ApplicabilityState,
  type OrganizationSstProfile,
  type PredicateResult,
} from './applicability';

const completeProfile: OrganizationSstProfile = {
  schemaVersion: '1.0.0',
  organization: {
    country: 'Ecuador',
    sector: 'Tecnología',
    workCenterCount: 2,
    workerCount: 25,
  },
  operations: {
    hasChemicalProcesses: false,
    hasHighEnergyOperations: true,
  },
};

function decision(profile: OrganizationSstProfile, targetKey: string) {
  return evaluateApplicability(profile, DEMO_APPLICABILITY_RULE_PACK).decisions.find(
    (candidate) => candidate.targetKey === targetKey,
  )!;
}

function matchingRule(id: string, state: ApplicabilityState) {
  return {
    id,
    targetKey: 'DEMO_PRECEDENCE_MATRIX',
    condition: {
      mode: 'ALL' as const,
      predicates: [
        {
          field: 'organization.workCenterCount' as const,
          operator: 'EQUALS' as const,
          value: 2,
        },
      ],
    },
    state,
    reasonCode: `${id}_MATCH`,
    explanation: `Coincidencia ${id}.`,
  };
}

function triStateProfile(first: PredicateResult, second: PredicateResult): OrganizationSstProfile {
  return {
    schemaVersion: '1.0.0',
    organization: { country: 'Ecuador', workCenterCount: 1 },
    operations: {
      ...(first === 'MISSING' ? {} : { hasChemicalProcesses: first === 'TRUE' }),
      ...(second === 'MISSING' ? {} : { hasHighEnergyOperations: second === 'TRUE' }),
    },
  };
}

describe('applicability rule pack schema', () => {
  it('accepts the bounded synthetic demo pack', () => {
    expect(applicabilityRulePackSchema.parse(DEMO_APPLICABILITY_RULE_PACK)).toEqual(
      DEMO_APPLICABILITY_RULE_PACK,
    );
  });

  it('rejects duplicate rules, arbitrary fields and executable expressions', () => {
    const duplicate = {
      ...DEMO_APPLICABILITY_RULE_PACK,
      rules: [DEMO_APPLICABILITY_RULE_PACK.rules[0], DEMO_APPLICABILITY_RULE_PACK.rules[0]],
    };
    expect(() => applicabilityRulePackSchema.parse(duplicate)).toThrow('Rule ids must be unique');

    const arbitraryField = structuredClone(DEMO_APPLICABILITY_RULE_PACK) as unknown as {
      rules: Array<{ condition: { predicates: Array<Record<string, unknown>> } }>;
    };
    arbitraryField.rules[0]!.condition.predicates[0]!.field = 'organization.passwordHash';
    arbitraryField.rules[0]!.condition.predicates[0]!.expression = 'eval(profile)';
    expect(() => applicabilityRulePackSchema.parse(arbitraryField)).toThrow();
  });

  it('rejects unknown operators and operands with the wrong type', () => {
    const unknownOperator = structuredClone(DEMO_APPLICABILITY_RULE_PACK) as unknown as {
      rules: Array<{ condition: { predicates: Array<Record<string, unknown>> } }>;
    };
    unknownOperator.rules[0]!.condition.predicates[0]!.operator = 'SCRIPT';
    expect(() => applicabilityRulePackSchema.parse(unknownOperator)).toThrow();

    const wrongOperand = structuredClone(DEMO_APPLICABILITY_RULE_PACK) as unknown as {
      rules: Array<{ condition: { predicates: Array<Record<string, unknown>> } }>;
    };
    wrongOperand.rules[0]!.condition.predicates[0]!.value = 'one';
    expect(() => applicabilityRulePackSchema.parse(wrongOperand)).toThrow();
  });

  it('rejects a demo source disguised as regulatory content', () => {
    expect(() =>
      applicabilityRulePackSchema.parse({
        ...DEMO_APPLICABILITY_RULE_PACK,
        regulatory: true,
      }),
    ).toThrow('Demo packs must be non-regulatory demo content');
  });
});

describe('deterministic applicability evaluation', () => {
  it('evaluates ALL, ANY, numeric, string membership and boolean predicates', () => {
    const result = evaluateApplicability(completeProfile, DEMO_APPLICABILITY_RULE_PACK);
    expect(result.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetKey: 'DEMO_BASELINE_MANAGEMENT', state: 'MANDATORY' }),
        expect.objectContaining({
          targetKey: 'DEMO_MULTI_SITE_COORDINATION',
          state: 'RECOMMENDED',
        }),
        expect.objectContaining({ targetKey: 'DEMO_SECTOR_GUIDANCE', state: 'OPTIONAL' }),
        expect.objectContaining({
          targetKey: 'DEMO_CHEMICAL_CONTROL',
          state: 'NOT_APPLICABLE',
        }),
        expect.objectContaining({
          targetKey: 'DEMO_HIGH_ENERGY_REVIEW',
          state: 'NEEDS_EXPERT_REVIEW',
        }),
      ]),
    );
    expect(
      result.decisions.find(({ targetKey }) => targetKey === 'DEMO_SECTOR_GUIDANCE')?.trace[0]
        ?.mode,
    ).toBe('ANY');
  });

  it('turns a missing field into NEEDS_INFORMATION with a structured trace', () => {
    const profile: OrganizationSstProfile = {
      ...completeProfile,
      organization: { country: 'Ecuador', workCenterCount: 1 },
      operations: {},
    };
    const result = decision(profile, 'DEMO_CHEMICAL_CONTROL');
    expect(result).toMatchObject({
      state: 'NEEDS_INFORMATION',
      reasonCode: 'MISSING_PROFILE_INFORMATION',
      sourceType: 'DEMO',
    });
    expect(result.trace).toHaveLength(2);
    expect(result.trace.every(({ result: ruleResult }) => ruleResult === 'MISSING')).toBe(true);
    expect(result.trace[0]?.predicates[0]).toMatchObject({
      field: 'operations.hasChemicalProcesses',
      actual: null,
      result: 'MISSING',
    });
  });

  it('uses explicit precedence and a lexical rule id tie-break instead of array order', () => {
    const pack: ApplicabilityRulePack = {
      ...DEMO_APPLICABILITY_RULE_PACK,
      rules: [
        {
          id: 'RULE_OPTIONAL_Z',
          targetKey: 'DEMO_PRECEDENCE',
          condition: {
            mode: 'ALL',
            predicates: [
              { field: 'organization.workCenterCount', operator: 'NUMBER_GTE', value: 1 },
            ],
          },
          state: 'OPTIONAL',
          reasonCode: 'OPTIONAL_MATCH',
          explanation: 'Opcional.',
        },
        {
          id: 'RULE_MANDATORY_B',
          targetKey: 'DEMO_PRECEDENCE',
          condition: {
            mode: 'ALL',
            predicates: [
              { field: 'organization.workCenterCount', operator: 'NUMBER_LTE', value: 10 },
            ],
          },
          state: 'MANDATORY',
          reasonCode: 'MANDATORY_B',
          explanation: 'Obligatoria B.',
        },
        {
          id: 'RULE_MANDATORY_A',
          targetKey: 'DEMO_PRECEDENCE',
          condition: {
            mode: 'ALL',
            predicates: [{ field: 'organization.workCenterCount', operator: 'EQUALS', value: 2 }],
          },
          state: 'MANDATORY',
          reasonCode: 'MANDATORY_A',
          explanation: 'Obligatoria A.',
        },
      ],
    };
    const forward = evaluateApplicability(completeProfile, pack).decisions[0];
    const reversed = evaluateApplicability(completeProfile, {
      ...pack,
      rules: [...pack.rules].reverse(),
    }).decisions[0];
    expect(forward).toEqual(reversed);
    expect(forward).toMatchObject({
      state: 'MANDATORY',
      winningRuleId: 'RULE_MANDATORY_A',
      reasonCode: 'MANDATORY_A',
    });
  });

  it.each<
    [
      firstState: ApplicabilityState,
      secondState: ApplicabilityState,
      expectedState: ApplicabilityState,
      expectedWinningRuleId: string,
    ]
  >([
    ['MANDATORY', 'RECOMMENDED', 'MANDATORY', 'RULE_FIRST_MANDATORY'],
    ['MANDATORY', 'NEEDS_INFORMATION', 'MANDATORY', 'RULE_FIRST_MANDATORY'],
    ['NEEDS_EXPERT_REVIEW', 'MANDATORY', 'NEEDS_EXPERT_REVIEW', 'RULE_FIRST_EXPERT'],
    ['RECOMMENDED', 'OPTIONAL', 'RECOMMENDED', 'RULE_FIRST_RECOMMENDED'],
    ['OPTIONAL', 'NOT_APPLICABLE', 'OPTIONAL', 'RULE_FIRST_OPTIONAL'],
  ])(
    'applies precedence for %s vs %s independently of rule order',
    (firstState, secondState, expectedState, expectedWinningRuleId) => {
      const firstRule = matchingRule(
        expectedWinningRuleId.startsWith('RULE_FIRST')
          ? expectedWinningRuleId
          : `RULE_FIRST_${firstState}`,
        firstState,
      );
      const secondRule = matchingRule(
        expectedWinningRuleId.startsWith('RULE_SECOND')
          ? expectedWinningRuleId
          : `RULE_SECOND_${secondState}`,
        secondState,
      );
      const pack: ApplicabilityRulePack = {
        ...DEMO_APPLICABILITY_RULE_PACK,
        rules: [firstRule, secondRule],
      };
      const forward = evaluateApplicability(completeProfile, pack).decisions[0];
      const reversed = evaluateApplicability(completeProfile, {
        ...pack,
        rules: [...pack.rules].reverse(),
      }).decisions[0];

      expect(forward).toEqual(reversed);
      expect(forward).toMatchObject({
        state: expectedState,
        winningRuleId: expectedWinningRuleId,
      });
    },
  );

  it.each<
    [
      mode: 'ALL' | 'ANY',
      first: PredicateResult,
      second: PredicateResult,
      expected: PredicateResult,
    ]
  >([
    ['ALL', 'TRUE', 'TRUE', 'TRUE'],
    ['ALL', 'TRUE', 'FALSE', 'FALSE'],
    ['ALL', 'TRUE', 'MISSING', 'MISSING'],
    ['ALL', 'FALSE', 'MISSING', 'FALSE'],
    ['ALL', 'MISSING', 'MISSING', 'MISSING'],
    ['ANY', 'FALSE', 'FALSE', 'FALSE'],
    ['ANY', 'TRUE', 'FALSE', 'TRUE'],
    ['ANY', 'TRUE', 'MISSING', 'TRUE'],
    ['ANY', 'FALSE', 'MISSING', 'MISSING'],
    ['ANY', 'MISSING', 'MISSING', 'MISSING'],
  ])('combines %s(%s, %s) as %s', (mode, first, second, expected) => {
    const pack: ApplicabilityRulePack = {
      ...DEMO_APPLICABILITY_RULE_PACK,
      rules: [
        {
          id: 'DEMO_TRI_STATE_MATRIX',
          targetKey: 'DEMO_TRI_STATE_RESULT',
          condition: {
            mode,
            predicates: [
              {
                field: 'operations.hasChemicalProcesses',
                operator: 'BOOLEAN_IS',
                value: true,
              },
              {
                field: 'operations.hasHighEnergyOperations',
                operator: 'BOOLEAN_IS',
                value: true,
              },
            ],
          },
          state: 'RECOMMENDED',
          reasonCode: 'TRI_STATE_MATCH',
          explanation: 'Coincidencia de matriz tri-state.',
        },
      ],
    };

    const result = evaluateApplicability(triStateProfile(first, second), pack).decisions[0];

    expect(
      result?.trace[0]?.predicates.map(({ result: predicateResult }) => predicateResult),
    ).toEqual([first, second]);
    expect(result?.trace[0]?.result).toBe(expected);
  });

  it('can produce every supported state using only the demo pack', () => {
    const results = new Set<string>();
    const profiles: OrganizationSstProfile[] = [
      completeProfile,
      {
        ...completeProfile,
        organization: { ...completeProfile.organization, workCenterCount: 1, workerCount: 2 },
        operations: { hasChemicalProcesses: true, hasHighEnergyOperations: false },
      },
      {
        schemaVersion: '1.0.0',
        organization: { country: 'Ecuador', workCenterCount: 0 },
        operations: {},
      },
    ];
    for (const profile of profiles) {
      for (const item of evaluateApplicability(profile, DEMO_APPLICABILITY_RULE_PACK).decisions) {
        results.add(item.state);
      }
    }
    expect([...results].sort()).toEqual([...APPLICABILITY_STATES].sort());
  });

  it('keeps provenance orthogonal to the decision state', () => {
    const result = decision(completeProfile, 'DEMO_BASELINE_MANAGEMENT');
    expect(result).toMatchObject({ state: 'MANDATORY', sourceType: 'DEMO' });
    expect(result).not.toHaveProperty('regulatory');
  });

  it('returns byte-for-byte equivalent data for repeated evaluation', () => {
    expect(evaluateApplicability(completeProfile, DEMO_APPLICABILITY_RULE_PACK)).toEqual(
      evaluateApplicability(completeProfile, DEMO_APPLICABILITY_RULE_PACK),
    );
  });
});
