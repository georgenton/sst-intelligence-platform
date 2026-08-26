import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GTC45_CONSEQUENCE_OPTIONS,
  GTC45_DEFICIENCY_OPTIONS,
  GTC45_EXPOSURE_OPTIONS,
  calculateGtc45Specification,
  calculateGuided5x5Specification,
  classifyGtc45Probability,
  classifyGtc45Risk,
  guided5x5SpecificationInputSchema,
  methodologySourceVersionManifestSchema,
  riskMethodComparisonFixtureSchema,
  riskMethodContentHash,
  riskMethodExpertGuidanceVersionSchema,
  riskMethodRegulatoryContextSchema,
  riskMethodVersionManifestSchema,
  sameMethodResidualRevaluationSchema,
} from './risk-methodology';
import { calculateDemoRisk } from './inspections';

function repositoryRoot() {
  return process.cwd().endsWith('/packages/contracts')
    ? resolve(process.cwd(), '../..')
    : process.cwd();
}

function loadJson(relativePath: string) {
  return JSON.parse(readFileSync(resolve(repositoryRoot(), relativePath), 'utf8')) as unknown;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function contentHash(value: Record<string, unknown>) {
  const content = { ...value };
  delete content.contentHash;
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(content)))
    .digest('hex');
}

describe('GTC45 2010 specification oracle', () => {
  const ndNeMatrix = [
    ['VERY_HIGH', 4, 40, 'VERY_HIGH', ['I', 'I', 'I', 'II']],
    ['VERY_HIGH', 3, 30, 'VERY_HIGH', ['I', 'I', 'I', 'II']],
    ['VERY_HIGH', 2, 20, 'HIGH', ['I', 'I', 'II', 'II']],
    ['VERY_HIGH', 1, 10, 'HIGH', ['I', 'I', 'II', 'III']],
    ['HIGH', 4, 24, 'VERY_HIGH', ['I', 'I', 'I', 'II']],
    ['HIGH', 3, 18, 'HIGH', ['I', 'I', 'II', 'II']],
    ['HIGH', 2, 12, 'HIGH', ['I', 'I', 'II', 'III']],
    ['HIGH', 1, 6, 'MEDIUM', ['I', 'II', 'II', 'III']],
    ['MEDIUM', 4, 8, 'MEDIUM', ['I', 'II', 'II', 'III']],
    ['MEDIUM', 3, 6, 'MEDIUM', ['I', 'II', 'II', 'III']],
    ['MEDIUM', 2, 4, 'LOW', ['II', 'II', 'III', 'III']],
    ['MEDIUM', 1, 2, 'LOW', ['II', 'III', 'III', 'IV']],
  ] as const;

  it('keeps every deficiency choice finite and LOW non-numeric', () => {
    expect(GTC45_DEFICIENCY_OPTIONS.map(({ key, value }) => [key, value])).toEqual([
      ['VERY_HIGH', 10],
      ['HIGH', 6],
      ['MEDIUM', 2],
      ['LOW', null],
    ]);
  });

  it('keeps every exposure value finite', () => {
    expect(GTC45_EXPOSURE_OPTIONS.map(({ value }) => value)).toEqual([4, 3, 2, 1]);
  });

  it('keeps every consequence value finite', () => {
    expect(GTC45_CONSEQUENCE_OPTIONS.map(({ value }) => value)).toEqual([100, 60, 25, 10]);
  });

  it.each([
    [40, 'VERY_HIGH'],
    [24, 'VERY_HIGH'],
    [20, 'HIGH'],
    [10, 'HIGH'],
    [8, 'MEDIUM'],
    [6, 'MEDIUM'],
    [4, 'LOW'],
    [2, 'LOW'],
  ] as const)('classifies NP boundary %s as %s', (value, expected) => {
    expect(classifyGtc45Probability(value)).toBe(expected);
  });

  it.each([41, 23, 21, 9, 5, 1, 2.5])('rejects invalid NP value %s', (value) => {
    expect(() => classifyGtc45Probability(value)).toThrow('INVALID_GTC45_PROBABILITY_VALUE');
  });

  it.each([
    [4000, 'I'],
    [600, 'I'],
    [500, 'II'],
    [150, 'II'],
    [120, 'III'],
    [40, 'III'],
    [20, 'IV'],
  ] as const)('classifies NR boundary %s as %s', (value, expected) => {
    expect(classifyGtc45Risk(value)).toBe(expected);
  });

  it.each([4001, 599, 501, 149, 121, 39, 21, 19, 20.5])('rejects invalid NR value %s', (value) => {
    expect(() => classifyGtc45Risk(value)).toThrow('INVALID_GTC45_RISK_VALUE');
  });

  it.each([
    ['VERY_HIGH', 4, 100, 40, 4000, 'I'],
    ['VERY_HIGH', 1, 60, 10, 600, 'I'],
    ['HIGH', 4, 25, 24, 600, 'I'],
    ['HIGH', 1, 25, 6, 150, 'II'],
    ['MEDIUM', 4, 60, 8, 480, 'II'],
    ['MEDIUM', 3, 10, 6, 60, 'III'],
    ['MEDIUM', 1, 10, 2, 20, 'IV'],
  ] as const)(
    'calculates ND %s × NE %s × NC %s deterministically',
    (deficiency, exposure, consequence, probabilityValue, riskValue, riskLevel) => {
      expect(calculateGtc45Specification({ deficiency, exposure, consequence })).toMatchObject({
        probabilityValue,
        riskValue,
        riskLevel,
        acceptability: null,
        acceptabilityPolicy: 'ORGANIZATION_CRITERIA_REQUIRED',
      });
    },
  );

  it('routes LOW deficiency directly to IV without inventing ND=0, NP or NR', () => {
    expect(
      calculateGtc45Specification({ deficiency: 'LOW', exposure: 4, consequence: 100 }),
    ).toMatchObject({
      deficiencyValue: null,
      probabilityValue: null,
      riskValue: null,
      riskLevel: 'IV',
      specialHandling: 'LOW_DEFICIENCY_DIRECT_TO_IV',
      trace: {
        deficiency: { selection: 'LOW', numericValue: null },
        probability: { operation: 'NOT_APPLIED_LOW_DEFICIENCY', value: null },
        risk: { operation: 'NOT_APPLIED_LOW_DEFICIENCY', value: null },
        decision: 'LOW_DIRECT_RISK_LEVEL_IV',
      },
    });
  });

  it.each([
    { deficiency: 'UNKNOWN', exposure: 1, consequence: 10 },
    { deficiency: 'HIGH', exposure: 0, consequence: 10 },
    { deficiency: 'HIGH', exposure: 1, consequence: 50 },
  ])('rejects invalid GTC45 input %#', (input) => {
    expect(() => calculateGtc45Specification(input)).toThrow();
  });

  it.each(ndNeMatrix)(
    'derives exact NP for ND %s × NE %s without an injectable NP',
    (deficiency, exposure, probabilityValue, probabilityBand) => {
      const result = calculateGtc45Specification({ deficiency, exposure, consequence: 10 });
      expect(result).toMatchObject({
        deficiencyValue: deficiency === 'VERY_HIGH' ? 10 : deficiency === 'HIGH' ? 6 : 2,
        probabilityValue,
        probabilityBand,
        trace: {
          probability: { operation: 'ND_X_NE', exposureValue: exposure, value: probabilityValue },
        },
      });
    },
  );

  it.each(ndNeMatrix)(
    'derives all canonical NR products and intervention levels for NP %s/%s',
    (deficiency, exposure, probabilityValue, _probabilityBand, expectedLevels) => {
      GTC45_CONSEQUENCE_OPTIONS.forEach(({ value: consequence }, index) => {
        const result = calculateGtc45Specification({ deficiency, exposure, consequence });
        expect(result).toMatchObject({
          probabilityValue,
          consequenceValue: consequence,
          riskValue: probabilityValue * consequence,
          riskLevel: expectedLevels[index],
          trace: {
            risk: {
              operation: 'NP_X_NC',
              consequenceValue: consequence,
              value: probabilityValue * consequence,
            },
          },
        });
      });
    },
  );

  it('rejects coercion and direct NP/NR injection', () => {
    expect(() =>
      calculateGtc45Specification({ deficiency: 'HIGH', exposure: '4', consequence: 100 }),
    ).toThrow();
    expect(() =>
      calculateGtc45Specification({ deficiency: 'HIGH', exposure: 4, consequence: '100' }),
    ).toThrow();
    const result = calculateGtc45Specification({
      deficiency: 'HIGH',
      exposure: 4,
      consequence: 100,
      probabilityValue: 23,
      riskValue: 9,
    });
    expect(result).toMatchObject({ probabilityValue: 24, riskValue: 2400, riskLevel: 'I' });
  });

  it('keeps canonical scoring identical across guidance context', () => {
    const canonical = {
      deficiency: 'HIGH' as const,
      exposure: 3 as const,
      consequence: 60 as const,
    };
    const withoutGuidance = calculateGtc45Specification(canonical);
    const withGuidance = calculateGtc45Specification({
      ...canonical,
      existingControls: { source: 'Control A', medium: 'Control B', individual: 'Control C' },
      guidanceResponses: { CONTROL_EFFECTIVENESS: 'Respuesta A' },
      professionalRationale: 'Justificación profesional A.',
    });
    const withDifferentGuidance = calculateGtc45Specification({
      ...canonical,
      existingControls: { source: 'Control distinto' },
      guidanceResponses: { CONTROL_EFFECTIVENESS: 'Respuesta distinta' },
      professionalRationale: 'Justificación profesional distinta.',
    });
    expect(withGuidance).toEqual(withoutGuidance);
    expect(withDifferentGuidance).toEqual(withoutGuidance);
  });
});

describe('GUIDED_5X5 specification oracle', () => {
  const base = {
    severityDimension: 'HUMAN' as const,
    checkedProbabilityCueKeys: [],
    checkedSeverityCueKeys: [],
    selectionRationale: 'Selección sustentada en observación profesional sintética.',
  };

  it.each([
    [1, 1, 1, 'LOW'],
    [1, 5, 5, 'MODERATE'],
    [5, 1, 5, 'MODERATE'],
    [5, 5, 25, 'CRITICAL'],
    [2, 2, 4, 'LOW'],
    [1, 5, 5, 'MODERATE'],
    [3, 3, 9, 'MODERATE'],
    [2, 5, 10, 'HIGH'],
    [4, 4, 16, 'HIGH'],
    [4, 5, 20, 'CRITICAL'],
  ] as const)(
    'calculates guided boundary %s×%s as %s %s',
    (probability, severity, score, level) => {
      expect(calculateGuided5x5Specification({ ...base, probability, severity })).toMatchObject({
        methodKey: 'GUIDED_5X5',
        methodVersion: '1.0.0',
        score,
        level,
        selectionRationale: base.selectionRationale,
      });
    },
  );

  it('requires a bounded professional selection rationale', () => {
    expect(() =>
      calculateGuided5x5Specification({
        ...base,
        probability: 3,
        severity: 3,
        selectionRationale: '',
      }),
    ).toThrow();
    expect(() =>
      guided5x5SpecificationInputSchema.parse({
        ...base,
        probability: 3,
        severity: 3,
        selectionRationale: 'x'.repeat(1001),
      }),
    ).toThrow();
  });

  it('rejects unknown cue keys instead of allowing arbitrary scoring hints', () => {
    expect(() =>
      calculateGuided5x5Specification({
        ...base,
        probability: 3,
        severity: 3,
        checkedProbabilityCueKeys: ['ARBITRARY_FORMULA'],
      }),
    ).toThrow('UNKNOWN_GUIDED_PROBABILITY_CUE');
  });

  it('keeps selected cues explanatory rather than score-authoritative', () => {
    const withoutCues = calculateGuided5x5Specification({
      ...base,
      probability: 4,
      severity: 5,
    });
    const withCues = calculateGuided5x5Specification({
      ...base,
      probability: 4,
      severity: 5,
      checkedProbabilityCueKeys: ['NO_RECENT_OCCURRENCE', 'RECURRING_FAILURES'],
      checkedSeverityCueKeys: ['REVERSIBLE_NO_LOST_TIME', 'FATALITY_POSSIBLE'],
    });
    expect({ score: withCues.score, level: withCues.level }).toEqual({
      score: withoutCues.score,
      level: withoutCues.level,
    });
  });
});

describe('exact-version residual revaluation contract', () => {
  const methodVersionId = '11111111-1111-4111-8111-111111111111';
  const initial = {
    methodVersionId,
    methodKey: 'GUIDED_5X5',
    semanticVersion: '1.0.0',
    inputs: { probability: 4, severity: 5 },
    output: { score: 20, level: 'CRITICAL' },
  };

  it('accepts residual valuation with the same exact method version', () => {
    expect(
      sameMethodResidualRevaluationSchema.parse({
        initial,
        controlChanges: ['Control sintético aplicado.'],
        residual: {
          ...initial,
          inputs: { probability: 2, severity: 5 },
          output: { score: 10, level: 'HIGH' },
        },
      }),
    ).toBeTruthy();
  });

  it('rejects residual valuation with a substituted method version', () => {
    expect(() =>
      sameMethodResidualRevaluationSchema.parse({
        initial,
        controlChanges: ['Control sintético aplicado.'],
        residual: {
          ...initial,
          methodVersionId: '22222222-2222-4222-8222-222222222222',
          semanticVersion: '2.0.0',
        },
      }),
    ).toThrow('RESIDUAL_METHOD_VERSION_MISMATCH');
  });
});

describe('Phase 1 risk methodology manifests', () => {
  const methodPaths = [
    'risk-methodology/manifests/methods/demo-5x5.v1.json',
    'risk-methodology/manifests/methods/guided-5x5.v1.json',
    'risk-methodology/manifests/methods/gtc45-2010.v1.json',
  ];
  const contextPaths = [
    'risk-methodology/manifests/regulatory-context/ecuador-guided-5x5.v1.json',
    'risk-methodology/manifests/regulatory-context/ecuador-gtc45.v1.json',
  ];

  it('validates the GTC45 methodology source fingerprint and licensing boundary', () => {
    const source = methodologySourceVersionManifestSchema.parse(
      loadJson('risk-methodology/manifests/sources/gtc45-2010.v1.json'),
    );
    expect(source.sourceFingerprint).toBe(
      '99a387729fd3a73a93dbc06a44ac5be0a7eedd8999f26b709c0cbf794f823973',
    );
    expect(source.licenseReproductionNote).toContain('restricciones de reproducción');
    expect(source.officialUrl).toBeNull();
  });

  it.each(methodPaths)('validates immutable method manifest %s', (path) => {
    const raw = loadJson(path) as Record<string, unknown>;
    const manifest = riskMethodVersionManifestSchema.parse(raw);
    expect(manifest.contentHash).toBe(riskMethodContentHash(raw));
  });

  it('binds the GTC45 method hash to canonical semantics but not reference ordering', () => {
    const raw = loadJson(methodPaths[2]!) as Record<string, unknown>;
    const originalHash = riskMethodContentHash(raw);
    const canonical = structuredClone(raw);
    const specification = canonical.canonicalSpecification as Record<string, unknown>;
    const deficiency = specification.deficiency as Array<Record<string, unknown>>;
    deficiency[0]!.numericValue = 11;
    expect(riskMethodContentHash(canonical)).not.toBe(originalHash);

    for (const mutate of [
      (copy: Record<string, unknown>) => {
        (copy.canonicalSpecification as Record<string, unknown>).exposure = [5, 3, 2, 1];
      },
      (copy: Record<string, unknown>) => {
        (copy.canonicalSpecification as Record<string, unknown>).consequence = [99, 60, 25, 10];
      },
      (copy: Record<string, unknown>) => {
        copy.calculationProviderVersion = '1.0.1';
      },
      (copy: Record<string, unknown>) => {
        const options = (copy.canonicalSpecification as Record<string, unknown>)
          .deficiency as Array<Record<string, unknown>>;
        options[3]!.specialHandling = 'NUMERIC_ZERO';
      },
    ]) {
      const copy = structuredClone(raw);
      mutate(copy);
      expect(riskMethodContentHash(copy)).not.toBe(originalHash);
    }

    const reorderedLeft = {
      ...raw,
      sourceReferences: [
        { sourceKey: 'SOURCE_B', sourceVersion: '1.0.0' },
        { sourceKey: 'SOURCE_A', sourceVersion: '1.0.0' },
      ],
      regulatoryContextReferences: ['CONTEXT_B', 'CONTEXT_A'],
    };
    const reorderedRight = {
      ...raw,
      sourceReferences: [...(reorderedLeft.sourceReferences as unknown[])].reverse(),
      regulatoryContextReferences: [
        ...(reorderedLeft.regulatoryContextReferences as unknown[]),
      ].reverse(),
    };
    expect(riskMethodContentHash(reorderedLeft)).toBe(riskMethodContentHash(reorderedRight));
  });

  it('keeps GTC45 candidate, demo and non-regulatory', () => {
    const manifest = riskMethodVersionManifestSchema.parse(loadJson(methodPaths[2]!));
    expect(manifest).toMatchObject({
      methodKey: 'GTC45_2010',
      isDemo: true,
      regulatory: false,
      publicationStatus: 'CANDIDATE',
      technicalReviewStatus: 'PENDING',
      legalReviewStatus: 'PENDING',
    });
  });

  it('keeps expert guidance non-scoring and pending', () => {
    const raw = loadJson('risk-methodology/manifests/guidance/anita-gtc45.v1.json') as Record<
      string,
      unknown
    >;
    const guidance = riskMethodExpertGuidanceVersionSchema.parse(raw);
    expect(guidance.contentHash).toBe(contentHash(raw));
    expect(guidance.evidenceClassification).toBe('EXPERT_OBSERVATION');
    expect(guidance.officialUiVerification).toBe('PENDING');
    expect(
      guidance.helpDefinitions.every(({ affectsCanonicalScore }) => !affectsCanonicalScore),
    ).toBe(true);
  });

  it.each(contextPaths)('validates non-endorsement regulatory context %s', (path) => {
    const raw = loadJson(path) as Record<string, unknown>;
    const context = riskMethodRegulatoryContextSchema.parse(raw);
    expect(context.contentHash).toBe(contentHash(raw));
    expect(context.relationship).toBe('CONTEXT_NOT_LEGAL_ENDORSEMENT');
    expect(context.officialSutMethodOptions).toBe('PENDING');
  });
});

describe('synthetic electrical comparison fixture', () => {
  it('reproduces each method-labeled expected result without cross-scale equivalence', () => {
    const fixture = riskMethodComparisonFixtureSchema.parse(
      loadJson('risk-methodology/fixtures/electrical-comparison.v1.json'),
    );
    const historical = fixture.evaluations.find(({ methodKey }) => methodKey === 'DEMO_5X5')!;
    const guided = fixture.evaluations.find(({ methodKey }) => methodKey === 'GUIDED_5X5')!;
    const gtc45 = fixture.evaluations.find(({ methodKey }) => methodKey === 'GTC45_2010')!;

    expect(
      calculateDemoRisk(
        historical.inputs.likelihood as number,
        historical.inputs.consequence as number,
      ),
    ).toMatchObject(historical.expected);
    expect(calculateGuided5x5Specification(guided.inputs)).toMatchObject(guided.expected);
    expect(calculateGtc45Specification(gtc45.inputs)).toMatchObject(gtc45.expected);
    expect(fixture.comparisonRule).toBe('CATEGORY_AND_INTERVENTION_MEANING_ONLY');
  });
});
