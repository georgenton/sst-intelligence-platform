import { z } from 'zod';
import { calculateDemoRisk } from './inspections.js';

const semanticVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const stableKeySchema = z.string().regex(/^[A-Z][A-Z0-9_]*$/);

export const reviewStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'NOT_APPLICABLE']);
export const publicationStatusSchema = z.enum(['DRAFT', 'CANDIDATE', 'PUBLISHED', 'RETIRED']);
export const riskMethodKindSchema = z.enum(['INSPECTION_FINDING_RISK', 'HAZARD_RISK_ASSESSMENT']);

export const methodologySourceVersionManifestSchema = z.object({
  sourceKey: stableKeySchema,
  sourceVersion: semanticVersionSchema,
  title: z.string().min(1).max(300),
  issuer: z.string().min(1).max(200),
  originCountry: z.string().length(2).nullable(),
  documentType: z.enum(['TECHNICAL_GUIDE', 'STANDARD', 'EXPERT_REFERENCE', 'OTHER']),
  edition: z.string().min(1).max(120),
  publicationDate: isoDateSchema.nullable(),
  sourceFingerprint: sha256Schema,
  sourceStatus: z.enum(['USER_PROVIDED_REFERENCE', 'OFFICIAL_REFERENCE', 'UNVERIFIED_REFERENCE']),
  licenseReproductionNote: z.string().min(1).max(500),
  officialUrl: z.string().url().nullable(),
  reviewStatus: reviewStatusSchema,
  publicationStatus: publicationStatusSchema,
});

export const riskMethodVersionManifestSchema = z.object({
  methodKey: stableKeySchema,
  semanticVersion: semanticVersionSchema,
  displayName: z.string().min(1).max(200),
  methodKind: riskMethodKindSchema,
  calculationProviderKey: stableKeySchema,
  calculationProviderVersion: semanticVersionSchema,
  inputSchemaVersion: semanticVersionSchema,
  resultSchemaVersion: semanticVersionSchema,
  isDemo: z.boolean(),
  regulatory: z.boolean(),
  publicationStatus: publicationStatusSchema,
  technicalReviewStatus: reviewStatusSchema,
  legalReviewStatus: reviewStatusSchema,
  sourceReferences: z.array(
    z.object({ sourceKey: stableKeySchema, sourceVersion: semanticVersionSchema }),
  ),
  regulatoryContextReferences: z.array(stableKeySchema),
  disclaimer: z.string().min(1).max(1000),
  contentHash: sha256Schema,
});

export const riskMethodExpertGuidanceVersionSchema = z.object({
  guidanceKey: stableKeySchema,
  guidanceVersion: semanticVersionSchema,
  methodKey: stableKeySchema,
  methodVersion: semanticVersionSchema,
  authorSource: z.string().min(1).max(200),
  evidenceClassification: z.literal('EXPERT_OBSERVATION'),
  reviewStatus: reviewStatusSchema,
  officialUiVerification: z.enum(['VERIFIED', 'PENDING', 'NOT_APPLICABLE']),
  helpDefinitions: z
    .array(
      z.object({
        key: stableKeySchema,
        prompt: z.string().min(1).max(240),
        purpose: z.string().min(1).max(400),
        affectsCanonicalScore: z.literal(false),
      }),
    )
    .min(1),
  disclaimer: z.string().min(1).max(1000),
  contentHash: sha256Schema,
});

export const riskMethodRegulatoryContextSchema = z.object({
  contextKey: stableKeySchema,
  contextVersion: semanticVersionSchema,
  jurisdiction: z.string().length(2),
  methodKey: stableKeySchema,
  methodVersion: semanticVersionSchema,
  relationship: z.literal('CONTEXT_NOT_LEGAL_ENDORSEMENT'),
  regulatorySourceReferences: z
    .array(
      z.object({
        sourceKey: stableKeySchema,
        locator: z.string().min(1).max(240),
        officialUrl: z.string().url(),
        reviewStatus: reviewStatusSchema,
      }),
    )
    .min(1),
  statement: z.string().min(1).max(1000),
  technicalReviewStatus: reviewStatusSchema,
  legalReviewStatus: reviewStatusSchema,
  officialSutMethodOptions: z.enum(['VERIFIED', 'PENDING']),
  contentHash: sha256Schema,
});

export type RiskMethodExplanation = {
  heading: string;
  summary: string;
  methodDisclosure: string;
};

export interface RiskMethodProvider<Input, Result> {
  readonly providerKey: string;
  readonly providerVersion: string;
  validateInput(input: unknown): Input;
  calculate(input: Input): Result;
  explainResult(input: Input, result: Result): RiskMethodExplanation;
  validateResidualInput(initial: Input, residual: unknown): Input;
  calculateResidual(initial: Input, residual: Input): Result;
}

export const GTC45_DEFICIENCY_OPTIONS = [
  { key: 'VERY_HIGH', value: 10, label: 'Muy alto' },
  { key: 'HIGH', value: 6, label: 'Alto' },
  { key: 'MEDIUM', value: 2, label: 'Medio' },
  {
    key: 'LOW',
    value: null,
    label: 'Bajo',
    specialHandling: 'DIRECT_RISK_LEVEL_IV',
  },
] as const;

export const GTC45_EXPOSURE_OPTIONS = [
  { value: 4, label: 'Continua', meaning: 'Exposición sostenida o repetida durante la jornada.' },
  { value: 3, label: 'Frecuente', meaning: 'Exposición varias veces durante la jornada.' },
  { value: 2, label: 'Ocasional', meaning: 'Exposición alguna vez y durante un periodo corto.' },
  { value: 1, label: 'Esporádica', meaning: 'Exposición eventual.' },
] as const;

export const GTC45_CONSEQUENCE_OPTIONS = [
  { value: 100, label: 'Mortal o catastrófica', meaning: 'Puede ocasionar una o más muertes.' },
  {
    value: 60,
    label: 'Muy grave',
    meaning: 'Puede ocasionar una lesión o enfermedad grave irreversible.',
  },
  {
    value: 25,
    label: 'Grave',
    meaning: 'Puede ocasionar incapacidad laboral temporal.',
  },
  {
    value: 10,
    label: 'Leve',
    meaning: 'Puede ocasionar una lesión o enfermedad sin incapacidad.',
  },
] as const;

export const gtc45SpecificationInputSchema = z.object({
  deficiency: z.enum(['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW']),
  exposure: z.union([z.literal(4), z.literal(3), z.literal(2), z.literal(1)]),
  consequence: z.union([z.literal(100), z.literal(60), z.literal(25), z.literal(10)]),
  existingControls: z
    .object({
      source: z.string().trim().max(500).optional(),
      medium: z.string().trim().max(500).optional(),
      individual: z.string().trim().max(500).optional(),
    })
    .optional(),
  guidanceResponses: z.record(stableKeySchema, z.string().trim().max(500)).optional(),
  professionalRationale: z.string().trim().max(1000).optional(),
});

export type Gtc45SpecificationInput = z.infer<typeof gtc45SpecificationInputSchema>;
export type Gtc45ProbabilityBand = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
export type Gtc45RiskLevel = 'I' | 'II' | 'III' | 'IV';

export function classifyGtc45Probability(value: number): Gtc45ProbabilityBand {
  if (!Number.isInteger(value)) throw new Error('INVALID_GTC45_PROBABILITY_VALUE');
  if (value >= 24 && value <= 40) return 'VERY_HIGH';
  if (value >= 10 && value <= 20) return 'HIGH';
  if (value >= 6 && value <= 8) return 'MEDIUM';
  if (value >= 2 && value <= 4) return 'LOW';
  throw new Error('INVALID_GTC45_PROBABILITY_VALUE');
}

export function classifyGtc45Risk(value: number): Gtc45RiskLevel {
  if (!Number.isInteger(value)) throw new Error('INVALID_GTC45_RISK_VALUE');
  if (value >= 600 && value <= 4000) return 'I';
  if (value >= 150 && value <= 500) return 'II';
  if (value >= 40 && value <= 120) return 'III';
  if (value === 20) return 'IV';
  throw new Error('INVALID_GTC45_RISK_VALUE');
}

export type Gtc45SpecificationResult = {
  methodKey: 'GTC45_2010';
  methodVersion: '1.0.0';
  deficiencyValue: 10 | 6 | 2 | null;
  probabilityValue: number | null;
  probabilityBand: Gtc45ProbabilityBand;
  consequenceValue: 100 | 60 | 25 | 10;
  riskValue: number | null;
  riskLevel: Gtc45RiskLevel;
  acceptability: null;
  acceptabilityPolicy: 'ORGANIZATION_CRITERIA_REQUIRED';
  specialHandling: 'NONE' | 'LOW_DEFICIENCY_DIRECT_TO_IV';
};

export function calculateGtc45Specification(input: unknown): Gtc45SpecificationResult {
  const parsed = gtc45SpecificationInputSchema.parse(input);
  const deficiency = GTC45_DEFICIENCY_OPTIONS.find(({ key }) => key === parsed.deficiency);
  if (!deficiency) throw new Error('INVALID_GTC45_DEFICIENCY');
  if (deficiency.value === null) {
    return {
      methodKey: 'GTC45_2010',
      methodVersion: '1.0.0',
      deficiencyValue: null,
      probabilityValue: null,
      probabilityBand: 'LOW',
      consequenceValue: parsed.consequence,
      riskValue: null,
      riskLevel: 'IV',
      acceptability: null,
      acceptabilityPolicy: 'ORGANIZATION_CRITERIA_REQUIRED',
      specialHandling: 'LOW_DEFICIENCY_DIRECT_TO_IV',
    };
  }
  const probabilityValue = deficiency.value * parsed.exposure;
  const riskValue = probabilityValue * parsed.consequence;
  return {
    methodKey: 'GTC45_2010',
    methodVersion: '1.0.0',
    deficiencyValue: deficiency.value,
    probabilityValue,
    probabilityBand: classifyGtc45Probability(probabilityValue),
    consequenceValue: parsed.consequence,
    riskValue,
    riskLevel: classifyGtc45Risk(riskValue),
    acceptability: null,
    acceptabilityPolicy: 'ORGANIZATION_CRITERIA_REQUIRED',
    specialHandling: 'NONE',
  };
}

type GuidedCriterion = {
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
  meaning: string;
  cues: readonly { key: string; label: string }[];
};

export const GUIDED_5X5_PROBABILITY_CRITERIA: readonly GuidedCriterion[] = [
  {
    value: 1,
    label: 'Remota',
    meaning: 'La materialización requiere condiciones poco habituales.',
    cues: [
      { key: 'NO_RECENT_OCCURRENCE', label: 'No hay ocurrencias recientes conocidas.' },
      { key: 'STRONG_INDEPENDENT_CONTROLS', label: 'Existen controles fuertes e independientes.' },
    ],
  },
  {
    value: 2,
    label: 'Improbable',
    meaning: 'Podría ocurrir, pero la exposición es limitada y los controles son consistentes.',
    cues: [
      { key: 'LIMITED_EXPOSURE', label: 'La exposición es limitada.' },
      {
        key: 'CONTROL_COVERAGE_HIGH',
        label: 'Los controles cubren la mayor parte de la operación.',
      },
    ],
  },
  {
    value: 3,
    label: 'Posible',
    meaning: 'La combinación de exposición y controles permite que el evento ocurra.',
    cues: [
      { key: 'OCCASIONAL_EXPOSURE', label: 'La exposición ocurre de forma ocasional.' },
      { key: 'CONTROL_GAPS_KNOWN', label: 'Se conocen brechas de control.' },
    ],
  },
  {
    value: 4,
    label: 'Probable',
    meaning: 'La exposición o las fallas conocidas hacen razonable esperar el evento.',
    cues: [
      { key: 'FREQUENT_EXPOSURE', label: 'La exposición es frecuente.' },
      { key: 'RECURRING_FAILURES', label: 'Se han observado fallas recurrentes.' },
    ],
  },
  {
    value: 5,
    label: 'Casi segura',
    meaning: 'La exposición es continua o los controles no ofrecen una barrera confiable.',
    cues: [
      { key: 'CONTINUOUS_EXPOSURE', label: 'La exposición es continua.' },
      {
        key: 'CONTROLS_ABSENT_OR_INEFFECTIVE',
        label: 'Los controles son inexistentes o ineficaces.',
      },
      {
        key: 'HIGH_HUMAN_DEPENDENCY',
        label: 'El control depende principalmente de conducta humana.',
      },
    ],
  },
];

export const GUIDED_5X5_HUMAN_SEVERITY_CRITERIA: readonly GuidedCriterion[] = [
  {
    value: 1,
    label: 'Menor',
    meaning: 'Daño reversible que normalmente no genera incapacidad.',
    cues: [{ key: 'REVERSIBLE_NO_LOST_TIME', label: 'Efecto reversible sin tiempo perdido.' }],
  },
  {
    value: 2,
    label: 'Moderada',
    meaning: 'Lesión o afectación que puede requerir atención y recuperación breve.',
    cues: [{ key: 'SHORT_RECOVERY', label: 'Se requiere recuperación breve.' }],
  },
  {
    value: 3,
    label: 'Seria',
    meaning: 'Puede producir incapacidad temporal relevante.',
    cues: [{ key: 'TEMPORARY_INCAPACITY', label: 'Existe posibilidad de incapacidad temporal.' }],
  },
  {
    value: 4,
    label: 'Muy seria',
    meaning: 'Puede producir daño irreversible o incapacidad permanente.',
    cues: [{ key: 'PERMANENT_IMPAIRMENT', label: 'Existe posibilidad de incapacidad permanente.' }],
  },
  {
    value: 5,
    label: 'Catastrófica',
    meaning: 'Puede producir una o más fatalidades.',
    cues: [{ key: 'FATALITY_POSSIBLE', label: 'La peor consecuencia incluye fatalidad.' }],
  },
];

const allProbabilityCueKeys = new Set(
  GUIDED_5X5_PROBABILITY_CRITERIA.flatMap(({ cues }) => cues.map(({ key }) => key)),
);
const allSeverityCueKeys = new Set(
  GUIDED_5X5_HUMAN_SEVERITY_CRITERIA.flatMap(({ cues }) => cues.map(({ key }) => key)),
);

export const guided5x5SpecificationInputSchema = z
  .object({
    probability: z.number().int().min(1).max(5),
    severity: z.number().int().min(1).max(5),
    severityDimension: z.literal('HUMAN'),
    checkedProbabilityCueKeys: z.array(stableKeySchema).max(8).default([]),
    checkedSeverityCueKeys: z.array(stableKeySchema).max(8).default([]),
    selectionRationale: z.string().trim().min(1).max(1000),
    professionalNote: z.string().trim().max(2000).optional(),
  })
  .superRefine((input, context) => {
    for (const key of input.checkedProbabilityCueKeys) {
      if (!allProbabilityCueKeys.has(key)) {
        context.addIssue({ code: 'custom', message: `UNKNOWN_GUIDED_PROBABILITY_CUE:${key}` });
      }
    }
    for (const key of input.checkedSeverityCueKeys) {
      if (!allSeverityCueKeys.has(key)) {
        context.addIssue({ code: 'custom', message: `UNKNOWN_GUIDED_SEVERITY_CUE:${key}` });
      }
    }
  });

export type Guided5x5SpecificationInput = z.infer<typeof guided5x5SpecificationInputSchema>;

export function calculateGuided5x5Specification(input: unknown) {
  const parsed = guided5x5SpecificationInputSchema.parse(input);
  const calculated = calculateDemoRisk(parsed.probability, parsed.severity);
  return {
    methodKey: 'GUIDED_5X5' as const,
    methodVersion: '1.0.0' as const,
    probability: parsed.probability,
    severity: parsed.severity,
    score: calculated.score,
    level: calculated.level,
    severityDimension: parsed.severityDimension,
    selectionRationale: parsed.selectionRationale,
    professionalNote: parsed.professionalNote ?? null,
    explanation: {
      probability: GUIDED_5X5_PROBABILITY_CRITERIA.find(
        ({ value }) => value === parsed.probability,
      )!,
      severity: GUIDED_5X5_HUMAN_SEVERITY_CRITERIA.find(({ value }) => value === parsed.severity)!,
      selectedProbabilityCues: parsed.checkedProbabilityCueKeys,
      selectedSeverityCues: parsed.checkedSeverityCueKeys,
    },
  };
}

const valuationSnapshotSchema = z.object({
  methodVersionId: z.string().uuid(),
  methodKey: stableKeySchema,
  semanticVersion: semanticVersionSchema,
  inputs: z.record(z.string(), z.unknown()),
  output: z.record(z.string(), z.unknown()),
});

export const sameMethodResidualRevaluationSchema = z
  .object({
    initial: valuationSnapshotSchema,
    controlChanges: z.array(z.string().trim().min(1).max(500)).min(1),
    residual: valuationSnapshotSchema,
  })
  .superRefine((value, context) => {
    if (
      value.initial.methodVersionId !== value.residual.methodVersionId ||
      value.initial.methodKey !== value.residual.methodKey ||
      value.initial.semanticVersion !== value.residual.semanticVersion
    ) {
      context.addIssue({ code: 'custom', message: 'RESIDUAL_METHOD_VERSION_MISMATCH' });
    }
  });

export const riskMethodComparisonFixtureSchema = z.object({
  fixtureKey: stableKeySchema,
  hazard: z.object({
    category: stableKeySchema,
    description: z.string().min(1).max(500),
    existingControls: z.array(z.string().min(1).max(300)),
  }),
  evaluations: z
    .array(
      z.object({
        methodKey: stableKeySchema,
        methodVersion: semanticVersionSchema,
        inputs: z.record(z.string(), z.unknown()),
        expected: z.record(z.string(), z.unknown()),
      }),
    )
    .min(2),
  comparisonRule: z.literal('CATEGORY_AND_INTERVENTION_MEANING_ONLY'),
  warning: z.string().min(1).max(500),
});
