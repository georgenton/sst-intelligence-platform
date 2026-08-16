import { describe, expect, it } from 'vitest';
import {
  APPLICABILITY_STATES,
  DEMO_APPLICABILITY_RULE_PACK,
  applicabilityRulePackSchema,
  evaluateApplicability,
  type ApplicabilityRulePack,
  type OrganizationSstProfile,
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

  it('applies ANY tri-state semantics without treating missing as false', () => {
    const pack: ApplicabilityRulePack = {
      ...DEMO_APPLICABILITY_RULE_PACK,
      rules: [
        {
          id: 'DEMO_ANY_TRI_STATE',
          targetKey: 'DEMO_ANY_RESULT',
          condition: {
            mode: 'ANY',
            predicates: [
              { field: 'organization.sector', operator: 'EQUALS', value: 'Industrial' },
              {
                field: 'operations.hasChemicalProcesses',
                operator: 'BOOLEAN_IS',
                value: true,
              },
            ],
          },
          state: 'RECOMMENDED',
          reasonCode: 'ANY_MATCH',
          explanation: 'Coincidencia ANY.',
        },
      ],
    };
    const missingProfile: OrganizationSstProfile = {
      schemaVersion: '1.0.0',
      organization: { country: 'Ecuador', sector: 'Servicios', workCenterCount: 1 },
      operations: {},
    };
    expect(evaluateApplicability(missingProfile, pack).decisions[0]?.state).toBe(
      'NEEDS_INFORMATION',
    );
    expect(
      evaluateApplicability({ ...missingProfile, operations: { hasChemicalProcesses: true } }, pack)
        .decisions[0]?.state,
    ).toBe('RECOMMENDED');
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
});
