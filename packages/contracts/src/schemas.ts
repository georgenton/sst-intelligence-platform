import { z } from 'zod';

export const moduleKeySchema = z.enum([
  'CORE',
  'INSPECTIONS_INTELLIGENCE',
  'TECHNICAL_RISK',
  'WORK_PERMITS',
  'PSYCHOSOCIAL',
  'COMPLIANCE',
]);

export const planKeySchema = z.enum(['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE']);

export const solutionAnswersSchema = z.object({
  country: z.string().min(2).max(80),
  sector: z.string().min(2).max(120),
  workerRange: z.enum(['1_10', '11_50', '51_200', '201_1000', 'MORE_1000']),
  workCenters: z.number().int().min(1).max(500),
  criticalActivities: z.boolean(),
  workAtHeight: z.boolean(),
  hotWork: z.boolean(),
  electricity: z.boolean(),
  chemicals: z.boolean(),
  drivers: z.boolean(),
  fireRisk: z.boolean(),
  criticalAssets: z.boolean().default(false),
  contractors: z.boolean(),
  managementSystem: z.enum(['PAPER', 'SPREADSHEETS', 'SOFTWARE']),
  inspectionFrequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'RARELY']),
  manualPermits: z.boolean(),
  evidenceDifficulty: z.boolean(),
  overdueActions: z.boolean(),
  recurringFindings: z.boolean(),
  psychosocialEvaluation: z.boolean(),
  multipleShifts: z.boolean(),
  stressExposedRoles: z.boolean(),
  organizationalCampaigns: z.boolean(),
  objectives: z
    .array(
      z.enum([
        'COMPLIANCE',
        'CENTRALIZATION',
        'AUTOMATION',
        'TRACKING',
        'REWORK_REDUCTION',
        'RECURRENCE_ANALYSIS',
        'REPORTING',
      ]),
    )
    .min(1),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  estimatedUsers: z.number().int().min(1).max(10000),
  budgetRange: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  rolloutPreference: z.enum(['GRADUAL', 'INTEGRAL']),
});

export type SolutionAnswers = z.infer<typeof solutionAnswersSchema>;

export const recommendationSchema = z.object({
  engineVersion: z.string(),
  recommendedModules: z.array(
    z.object({
      moduleKey: moduleKeySchema,
      score: z.number().int().min(0).max(100),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
      reasons: z.array(z.string()).min(1),
    }),
  ),
  suggestedPlan: planKeySchema,
  suggestedRollout: z.array(
    z.object({ phase: z.number().int().positive(), modules: z.array(moduleKeySchema) }),
  ),
  disclaimers: z.array(z.string()),
});

export type SolutionRecommendation = z.infer<typeof recommendationSchema>;

export const recommendationExplanationSchema = z.object({
  headline: z.string(),
  executiveSummary: z.string(),
  moduleExplanations: z.array(
    z.object({ moduleKey: moduleKeySchema, why: z.string(), expectedValue: z.string() }),
  ),
  rolloutExplanation: z.string(),
  disclaimer: z.string(),
});

export type RecommendationExplanation = z.infer<typeof recommendationExplanationSchema>;
