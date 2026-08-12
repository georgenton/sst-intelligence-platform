import { z } from 'zod';
import { calculateDemoRisk, type RiskLevel } from './inspections.js';

export const TECHNICAL_RISK_DEMO_DISCLAIMER =
  'Metodología demostrativa. No constituye una evaluación regulatoria validada.';

const baseQuestionSchema = z.object({
  key: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
  label: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  required: z.boolean().default(true),
});

const scaleQuestionSchema = baseQuestionSchema.extend({
  type: z.enum(['LIKELIHOOD', 'CONSEQUENCE']),
  min: z.literal(1),
  max: z.literal(5),
});

export const technicalQuestionSchema = z.discriminatedUnion('type', [
  baseQuestionSchema.extend({ type: z.literal('BOOLEAN') }),
  baseQuestionSchema.extend({
    type: z.literal('SINGLE_CHOICE'),
    options: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) })).min(1),
  }),
  baseQuestionSchema.extend({
    type: z.literal('INTEGER'),
    min: z.number().int().optional(),
    max: z.number().int().optional(),
  }),
  baseQuestionSchema.extend({
    type: z.literal('DECIMAL'),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  baseQuestionSchema.extend({ type: z.literal('TEXT'), maxLength: z.number().int().positive() }),
  scaleQuestionSchema,
]);

export const technicalMethodSchema = z
  .object({
    sections: z
      .array(
        z.object({
          key: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
          title: z.string().min(1).max(200),
          questions: z.array(technicalQuestionSchema).min(1),
        }),
      )
      .min(1),
  })
  .superRefine((schema, context) => {
    const keys = schema.sections.flatMap((section) => section.questions.map(({ key }) => key));
    if (new Set(keys).size !== keys.length) {
      context.addIssue({ code: 'custom', message: 'Question keys must be unique' });
    }
  });

export type TechnicalMethodSchema = z.infer<typeof technicalMethodSchema>;
export type TechnicalQuestion = z.infer<typeof technicalQuestionSchema>;
export type TechnicalAnswerSet = Record<string, unknown>;
export type TechnicalAssessmentStatus =
  'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED' | 'CANCELED';

export type TechnicalMethodVersionSnapshot = {
  methodKey: string;
  methodName: string;
  methodVersion: string;
  calculationKey: string;
  regulatory: boolean;
  country: string | null;
  disclaimer: string | null;
  schema: TechnicalMethodSchema;
};

export type TechnicalCalculationResult = {
  score: number | null;
  level: RiskLevel | null;
  result: Record<string, unknown>;
};

export interface TechnicalCalculationProvider {
  readonly key: string;
  calculate(
    method: TechnicalMethodVersionSnapshot,
    answers: TechnicalAnswerSet,
  ): TechnicalCalculationResult;
}

function answerSchema(question: TechnicalQuestion): z.ZodType {
  switch (question.type) {
    case 'BOOLEAN':
      return z.boolean();
    case 'SINGLE_CHOICE':
      return z
        .string()
        .refine((value) => question.options.some((option) => option.value === value));
    case 'INTEGER':
      return z
        .number()
        .int()
        .min(question.min ?? -Number.MAX_SAFE_INTEGER)
        .max(question.max ?? Number.MAX_SAFE_INTEGER);
    case 'DECIMAL':
      return z
        .number()
        .min(question.min ?? -Number.MAX_VALUE)
        .max(question.max ?? Number.MAX_VALUE);
    case 'TEXT':
      return z.string().max(question.maxLength);
    case 'LIKELIHOOD':
    case 'CONSEQUENCE':
      return z.number().int().min(question.min).max(question.max);
  }
}

export function validateTechnicalAnswer(schemaInput: unknown, questionKey: string, value: unknown) {
  const schema = technicalMethodSchema.parse(schemaInput);
  const question = schema.sections
    .flatMap((section) => section.questions)
    .find((candidate) => candidate.key === questionKey);
  if (!question) throw new Error(`UNKNOWN_TECHNICAL_QUESTION:${questionKey}`);
  const parsed = answerSchema(question).safeParse(value);
  if (!parsed.success) throw new Error(`INVALID_TECHNICAL_ANSWER:${questionKey}`);
  return parsed.data;
}

export function validateTechnicalAnswerSet(schemaInput: unknown, answers: TechnicalAnswerSet) {
  const schema = technicalMethodSchema.parse(schemaInput);
  const questions = schema.sections.flatMap((section) => section.questions);
  const knownKeys = new Set(questions.map(({ key }) => key));
  for (const key of Object.keys(answers)) {
    if (!knownKeys.has(key)) throw new Error(`UNKNOWN_TECHNICAL_QUESTION:${key}`);
  }
  const validated: TechnicalAnswerSet = {};
  for (const question of questions) {
    const value = answers[question.key];
    if (value === undefined || value === null || value === '') {
      if (question.required) throw new Error(`MISSING_TECHNICAL_ANSWER:${question.key}`);
      continue;
    }
    validated[question.key] = validateTechnicalAnswer(schema, question.key, value);
  }
  return validated;
}

export class TechnicalCalculationRegistry {
  private readonly providers = new Map<string, TechnicalCalculationProvider>();

  constructor(providers: readonly TechnicalCalculationProvider[] = []) {
    for (const provider of providers) this.providers.set(provider.key, provider);
  }

  get(key: string) {
    const provider = this.providers.get(key);
    if (!provider) throw new Error(`UNKNOWN_TECHNICAL_CALCULATION_PROVIDER:${key}`);
    return provider;
  }
}

export const DEMO_TECHNICAL_RISK_METHOD: TechnicalMethodVersionSnapshot = {
  methodKey: 'DEMO_TECHNICAL_RISK',
  methodName: 'Evaluación técnica demostrativa',
  methodVersion: '1.0.0',
  calculationKey: 'DEMO_TECHNICAL_RISK_5X5',
  regulatory: false,
  country: null,
  disclaimer: TECHNICAL_RISK_DEMO_DISCLAIMER,
  schema: {
    sections: [
      {
        key: 'context',
        title: 'Contexto',
        questions: [
          {
            key: 'activityDescription',
            label: 'Descripción de la actividad',
            type: 'TEXT',
            required: true,
            maxLength: 2000,
          },
          {
            key: 'existingControls',
            label: 'Controles existentes',
            type: 'TEXT',
            required: false,
            maxLength: 2000,
          },
        ],
      },
      {
        key: 'evaluation',
        title: 'Evaluación',
        questions: [
          {
            key: 'likelihood',
            label: 'Probabilidad',
            type: 'LIKELIHOOD',
            required: true,
            min: 1,
            max: 5,
          },
          {
            key: 'consequence',
            label: 'Consecuencia',
            type: 'CONSEQUENCE',
            required: true,
            min: 1,
            max: 5,
          },
        ],
      },
    ],
  },
};

export class DemoTechnicalRiskCalculator implements TechnicalCalculationProvider {
  readonly key = DEMO_TECHNICAL_RISK_METHOD.calculationKey;

  calculate(method: TechnicalMethodVersionSnapshot, answers: TechnicalAnswerSet) {
    const validated = validateTechnicalAnswerSet(method.schema, answers);
    const risk = calculateDemoRisk(validated.likelihood as number, validated.consequence as number);
    return {
      score: risk.score,
      level: risk.level,
      result: {
        likelihood: risk.likelihood,
        consequence: risk.consequence,
        thresholds:
          method.methodKey === DEMO_TECHNICAL_RISK_METHOD.methodKey
            ? [
                { min: 1, max: 4, level: 'LOW' },
                { min: 5, max: 9, level: 'MODERATE' },
                { min: 10, max: 16, level: 'HIGH' },
                { min: 17, max: 25, level: 'CRITICAL' },
              ]
            : undefined,
      },
    };
  }
}

const TECHNICAL_ASSESSMENT_TRANSITIONS: Record<
  TechnicalAssessmentStatus,
  readonly TechnicalAssessmentStatus[]
> = {
  DRAFT: ['IN_PROGRESS', 'CANCELED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELED'],
  COMPLETED: ['REVIEWED'],
  REVIEWED: [],
  CANCELED: [],
};

export function assertTechnicalAssessmentTransition(
  from: TechnicalAssessmentStatus,
  to: TechnicalAssessmentStatus,
) {
  if (!TECHNICAL_ASSESSMENT_TRANSITIONS[from].includes(to)) {
    throw new Error(`INVALID_TECHNICAL_ASSESSMENT_TRANSITION:${from}:${to}`);
  }
}

export function technicalReviewTargetStatus(
  status: TechnicalAssessmentStatus,
  decision: 'APPROVED' | 'NEEDS_REVISION',
): 'COMPLETED' | 'REVIEWED' {
  if (status !== 'COMPLETED') throw new Error('ASSESSMENT_NOT_READY_FOR_REVIEW');
  return decision === 'APPROVED' ? 'REVIEWED' : 'COMPLETED';
}
