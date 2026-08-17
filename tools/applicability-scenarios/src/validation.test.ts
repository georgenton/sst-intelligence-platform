import { APPLICABILITY_STATES, DEMO_APPLICABILITY_RULE_PACK } from '@sst/contracts';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMITTED_SST_SCENARIOS } from './catalog.js';
import { runCli, selectScenarioReportDirectory } from './cli.js';
import { sstValidationScenarioSchema } from './schema.js';
import { findLikelyPrivateData, validateScenarioCatalog } from './validation.js';

function cloneScenario(index = 0) {
  return structuredClone(COMMITTED_SST_SCENARIOS[index]!);
}

describe('committed adaptive SST validation catalog', () => {
  it('contains exactly the eight authorized synthetic company scenarios', () => {
    expect(COMMITTED_SST_SCENARIOS.map(({ id }) => id)).toEqual([
      'EC_DEMO_SMALL_SERVICES',
      'EC_DEMO_MULTI_SITE_SERVICES',
      'EC_DEMO_MANUFACTURING_HIGH_ENERGY',
      'EC_DEMO_CHEMICAL_PHARMA',
      'EC_DEMO_UNKNOWN_INFORMATION',
      'EC_DEMO_LOGISTICS_TRANSPORT',
      'EC_DEMO_CONSTRUCTION_CONTRACTORS',
      'EC_DEMO_MIXED_ACTIVITY_ENTERPRISE',
    ]);
    expect(COMMITTED_SST_SCENARIOS.every(({ synthetic }) => synthetic)).toBe(true);
    expect(
      COMMITTED_SST_SCENARIOS.every(
        ({ expertValidation }) => expertValidation.status === 'PENDING_EXPERT_REVIEW',
      ),
    ).toBe(true);
  });

  it('validates the exact authoritative demo pack with deterministic expectation parity', () => {
    const report = validateScenarioCatalog(COMMITTED_SST_SCENARIOS);

    expect(report.overallPass).toBe(true);
    expect(report.engine).toMatchObject({
      key: DEMO_APPLICABILITY_RULE_PACK.key,
      version: DEMO_APPLICABILITY_RULE_PACK.version,
      sourceType: 'DEMO',
      regulatory: false,
      isDemo: true,
    });
    expect(report.expectationParity).toBe(true);
    expect(report.deterministicRepeat).toBe(true);
    expect(report.forwardReverseOrderStable).toBe(true);
    expect(report.privacyIssues).toEqual([]);
    expect(report.outcomes.every(({ expectedDecisions }) => expectedDecisions.length === 6)).toBe(
      true,
    );
  });

  it('covers all six states and TRUE/FALSE/MISSING traces', () => {
    const report = validateScenarioCatalog(COMMITTED_SST_SCENARIOS);

    expect(report.coveredStates).toEqual([...APPLICABILITY_STATES].sort());
    expect(report.coveredPredicateResults).toEqual(['FALSE', 'MISSING', 'TRUE']);
    expect(report.allSixStatesCovered).toBe(true);
    expect(report.trueFalseMissingCovered).toBe(true);
    expect(Object.values(report.profilePredicateCoverage).every(Boolean)).toBe(true);
  });

  it('keeps every richer context variable explicit and outside Profile V1 evaluation', () => {
    const report = validateScenarioCatalog(COMMITTED_SST_SCENARIOS);

    expect(report.unmodeledFieldsExplicit).toBe(true);
    expect(report.profileV2Discovery.length).toBeGreaterThan(0);
    expect(
      report.outcomes.every(
        ({ futureContextStatus }) => futureContextStatus === 'NOT_EVALUATED_BY_PROFILE_V1',
      ),
    ).toBe(true);
  });

  it('produces the same complete semantic report for forward and reversed scenario input', () => {
    const forward = validateScenarioCatalog(COMMITTED_SST_SCENARIOS);
    const reversed = validateScenarioCatalog([...COMMITTED_SST_SCENARIOS].reverse());

    expect(reversed).toEqual(forward);
  });

  it('fails when a cloned scenario declares an intentionally wrong expected state', () => {
    const scenario = cloneScenario();
    const baseline = scenario.engineExpectation.decisions.find(
      ({ targetKey }) => targetKey === 'DEMO_BASELINE_MANAGEMENT',
    )!;
    expect(baseline.state).toBe('MANDATORY');
    baseline.state = 'OPTIONAL';

    const report = validateScenarioCatalog([scenario], { requireFullCatalog: false });

    expect(report.outcomes[0]).toMatchObject({
      scenario: { id: scenario.id },
      expectationMatches: false,
    });
    expect(report.outcomes[0]!.expectedDecisions).toContainEqual({
      targetKey: 'DEMO_BASELINE_MANAGEMENT',
      state: 'OPTIONAL',
      winningRuleId: 'DEMO_BASELINE_MANDATORY',
    });
    expect(report.outcomes[0]!.actualDecisionSummary).toContainEqual({
      targetKey: 'DEMO_BASELINE_MANAGEMENT',
      state: 'MANDATORY',
      winningRuleId: 'DEMO_BASELINE_MANDATORY',
    });
    expect(report.overallPass).toBe(false);
  });

  it('fails when a cloned scenario preserves state but declares the wrong winning rule', () => {
    const scenario = cloneScenario();
    const baseline = scenario.engineExpectation.decisions.find(
      ({ targetKey }) => targetKey === 'DEMO_BASELINE_MANAGEMENT',
    )!;
    expect(baseline.state).toBe('MANDATORY');
    baseline.winningRuleId = 'INTENTIONALLY_WRONG_RULE';

    const report = validateScenarioCatalog([scenario], { requireFullCatalog: false });

    expect(report.outcomes[0]!.expectationMatches).toBe(false);
    expect(report.outcomes[0]!.expectedDecisions).toContainEqual({
      targetKey: 'DEMO_BASELINE_MANAGEMENT',
      state: 'MANDATORY',
      winningRuleId: 'INTENTIONALLY_WRONG_RULE',
    });
    expect(report.outcomes[0]!.actualDecisionSummary).toContainEqual({
      targetKey: 'DEMO_BASELINE_MANAGEMENT',
      state: 'MANDATORY',
      winningRuleId: 'DEMO_BASELINE_MANDATORY',
    });
    expect(report.overallPass).toBe(false);
  });
});

describe('scenario governance and input safety', () => {
  it('rejects a catalog with a duplicate scenario id', () => {
    expect(() =>
      validateScenarioCatalog([cloneScenario(), cloneScenario()], { requireFullCatalog: false }),
    ).toThrow('Scenario ids must be unique');
  });

  it('rejects unknown fields and invalid synthetic classification', () => {
    const unknownField = { ...cloneScenario(), executableRule: 'eval(profile)' };
    expect(() => sstValidationScenarioSchema.parse(unknownField)).toThrow();

    const inconsistent = cloneScenario();
    inconsistent.synthetic = false;
    expect(() => sstValidationScenarioSchema.parse(inconsistent)).toThrow(
      'Synthetic scenarios must set synthetic=true',
    );
  });

  it.each([
    ['email address', 'persona@example.com'],
    ['RUC-like identifier', '1234567890001'],
    ['phone-like identifier', '+593 99 123 4567'],
    ['credential-like content', 'Bearer private-token-value'],
    ['executable expression', 'eval(profile)'],
  ])('flags %s in scenario text', (label, unsafeText) => {
    const scenario = cloneScenario();
    scenario.description = unsafeText;
    expect(findLikelyPrivateData([scenario])).toEqual(
      expect.arrayContaining([expect.stringContaining(label)]),
    );
  });

  it.each([
    ['precise address-like text', 'Avenida Ficticia 987, lote 42'],
    ['explicit real-identity marker', 'REAL_CUSTOMER_IDENTITY: Empresa Ficticia Delta'],
    [
      'individual medical-information marker',
      'EMPLOYEE_MEDICAL_DIAGNOSIS: condición clínica completamente ficticia',
    ],
  ])('fails validation for %s', (label, unsafeText) => {
    const scenario = cloneScenario();
    scenario.description = unsafeText;

    const report = validateScenarioCatalog([scenario], { requireFullCatalog: false });

    expect(report.privacyIssues).toEqual(expect.arrayContaining([expect.stringContaining(label)]));
    expect(report.overallPass).toBe(false);
  });

  it('allows generic occupational-health context without person-level medical information', () => {
    const scenario = cloneScenario();
    scenario.description =
      'Escenario sintético para vigilancia de la salud ocupacional y prevención de enfermedades laborales.';

    const report = validateScenarioCatalog([scenario], { requireFullCatalog: false });

    expect(report.privacyIssues).toEqual([]);
    expect(report.overallPass).toBe(true);
  });

  it('returns non-zero for an invalid expectation and zero for a valid JSON scenario', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sst-scenario-cli-test-'));
    try {
      const validScenario = cloneScenario();
      const invalidScenario = cloneScenario();
      invalidScenario.engineExpectation.decisions[0]!.state = 'OPTIONAL';
      const validPath = join(directory, 'valid.json');
      const invalidPath = join(directory, 'invalid.json');
      writeFileSync(validPath, JSON.stringify(validScenario));
      writeFileSync(invalidPath, JSON.stringify(invalidScenario));

      const valid = runCli(['--input', validPath], { writeArtifacts: false });
      const invalid = runCli(['--input', invalidPath], { writeArtifacts: false });

      expect(valid.exitCode).toBe(0);
      expect(valid.report?.overallPass).toBe(true);
      expect(invalid.exitCode).toBe(1);
      expect(invalid.stdout).toContain('Expectations: FAIL');
      expect(invalid.report).toMatchObject({
        overallPass: false,
        outcomes: [
          {
            scenario: { id: invalidScenario.id },
            expectationMatches: false,
          },
        ],
      });
      expect(invalid.report?.outcomes[0]!.expectedDecisions).toContainEqual({
        targetKey: 'DEMO_BASELINE_MANAGEMENT',
        state: 'OPTIONAL',
        winningRuleId: 'DEMO_BASELINE_MANDATORY',
      });
      expect(invalid.report?.outcomes[0]!.actualDecisionSummary).toContainEqual({
        targetKey: 'DEMO_BASELINE_MANAGEMENT',
        state: 'MANDATORY',
        winningRuleId: 'DEMO_BASELINE_MANDATORY',
      });
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it('routes pseudonymized reports to temporary storage and synthetic reports to ignored artifacts', () => {
    const synthetic = cloneScenario();
    const pseudonymized = cloneScenario();
    pseudonymized.id = 'EC_EXPERT_PSEUDONYMIZED_CASE';
    pseudonymized.name = 'Caso experto pseudonimizado';
    pseudonymized.scenarioKind = 'PSEUDONYMIZED_EXPERT_CASE';
    pseudonymized.synthetic = false;
    pseudonymized.workCenters[0]!.displayName = 'Centro pseudonimizado A';

    expect(selectScenarioReportDirectory([synthetic], '/repository', '/temporary')).toBe(
      '/repository/.artifacts/applicability-scenarios',
    );
    expect(selectScenarioReportDirectory([pseudonymized], '/repository', '/temporary')).toBe(
      '/temporary/sst-intelligence-private-scenario-reports',
    );
  });

  it('supports a strict pseudonymized external expert case without treating it as committed demo data', () => {
    const scenario = cloneScenario();
    scenario.id = 'EC_EXPERT_PSEUDONYMIZED_CASE';
    scenario.name = 'Caso experto pseudonimizado';
    scenario.scenarioKind = 'PSEUDONYMIZED_EXPERT_CASE';
    scenario.synthetic = false;
    scenario.workCenters[0]!.displayName = 'Centro pseudonimizado A';
    scenario.expertValidation.status = 'AGREES';
    scenario.expertValidation.agreementWithEngineOutcome = 'AGREES';

    const report = validateScenarioCatalog([scenario], { requireFullCatalog: false });
    expect(report.overallPass).toBe(true);
    expect(report.allScenariosSynthetic).toBe(false);
    expect(report.allExpertStatusesPending).toBe(false);
    expect(report.privacyIssues).toEqual([]);
  });
});
