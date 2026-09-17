import { z } from 'zod';
import { adaptiveContentHash } from './adaptive-configuration.js';
import { SST_CAPABILITY_KEYS } from './sst-assessment.js';

export const operationalPlanStatuses = ['DRAFT', 'ACTIVE', 'RETIRED'] as const;
export const operationalPlanItemStatuses = [
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELED',
] as const;
export const operationalPlanItemPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const operationalPlanItemProvenanceTypes = [
  'MANUAL',
  'APPLICABILITY_DECISION',
  'UNIFIED_SST_EVALUATION',
  'FINDING',
  'CORRECTIVE_ACTION',
  'OBLIGATION_EXECUTION',
  'GAP_ANALYSIS',
] as const;

export type OperationalPlanItemStatus = (typeof operationalPlanItemStatuses)[number];

export const operationalPlanItemInputSchema = z.object({
  title: z.string().trim().min(3).max(240),
  description: z.string().trim().max(2000).optional(),
  startsAt: z.iso.date().optional(),
  dueAt: z.iso.date().optional(),
  frequency: z.string().trim().max(120).optional(),
  priority: z.enum(operationalPlanItemPriorities).default('MEDIUM'),
  workCenterId: z.uuid().optional(),
  responsibleUserId: z.uuid().optional(),
  evidenceReferences: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  provenanceType: z.enum(operationalPlanItemProvenanceTypes),
  provenanceReference: z.string().trim().max(240).optional(),
  provenanceSnapshot: z.record(z.string(), z.unknown()).default({}),
});

export const operationalPlanVersionInputSchema = z
  .object({
    name: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).optional(),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    responsibleUserId: z.uuid().optional(),
    origin: z.enum(['MANUAL', 'DETERMINISTIC_DRAFT']),
    provenance: z.record(z.string(), z.unknown()).default({}),
    items: z.array(operationalPlanItemInputSchema).min(1).max(100),
  })
  .refine(({ periodStart, periodEnd }) => periodEnd >= periodStart, {
    message: 'El fin del período no puede ser anterior al inicio.',
    path: ['periodEnd'],
  })
  .refine(
    ({ items }) => items.every(({ startsAt, dueAt }) => !startsAt || !dueAt || dueAt >= startsAt),
    { message: 'La fecha límite de un ítem no puede ser anterior a su inicio.', path: ['items'] },
  );

export type OperationalPlanVersionInput = z.infer<typeof operationalPlanVersionInputSchema>;

export const assessmentOperationalPlanInputSchema = z
  .object({
    name: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).optional(),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    responsibleUserId: z.uuid().optional(),
    selectedCapabilityKeys: z
      .array(z.enum(SST_CAPABILITY_KEYS))
      .min(1)
      .max(SST_CAPABILITY_KEYS.length),
  })
  .refine(
    ({ selectedCapabilityKeys }) =>
      new Set(selectedCapabilityKeys).size === selectedCapabilityKeys.length,
    {
      message: 'Cada capacidad debe seleccionarse una sola vez.',
      path: ['selectedCapabilityKeys'],
    },
  )
  .refine(({ periodStart, periodEnd }) => periodEnd >= periodStart, {
    message: 'El fin del período no puede ser anterior al inicio.',
    path: ['periodEnd'],
  });

// Validate only the compact, stored source needed by planning. No evaluator is called here.
const planningCapabilityEvaluationSchema = z
  .object({
    engineVersion: z.string().min(1).max(32),
    outputHash: z.string().min(1).max(100).optional(),
    recommendations: z
      .array(
        z.object({
          capabilityKey: z.enum(SST_CAPABILITY_KEYS),
          title: z.string().min(3).max(240),
          description: z.string().max(2000),
          reasons: z.array(z.string().max(1000)).max(20),
          priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
        }),
      )
      .min(1)
      .max(SST_CAPABILITY_KEYS.length),
  })
  .refine(
    ({ recommendations }) =>
      new Set(recommendations.map((r) => r.capabilityKey)).size === recommendations.length,
  );

export function buildAssessmentOperationalPlanDraft(
  input: z.infer<typeof assessmentOperationalPlanInputSchema> & {
    assessmentSessionId: string;
    assessmentFinalizedAt?: string;
    capabilityEvaluation: unknown;
  },
): OperationalPlanVersionInput {
  const metadata = assessmentOperationalPlanInputSchema.parse(input);
  const assessmentSessionId = z.uuid().parse(input.assessmentSessionId);
  const evaluation = planningCapabilityEvaluationSchema.parse(input.capabilityEvaluation);
  const selected = [...metadata.selectedCapabilityKeys].sort();
  if (selected.some((key) => !evaluation.recommendations.some((r) => r.capabilityKey === key))) {
    throw new Error('ASSESSMENT_CAPABILITY_SELECTION_INVALID');
  }
  const excluded = evaluation.recommendations
    .map((r) => r.capabilityKey)
    .filter((key) => !selected.includes(key))
    .sort();
  return operationalPlanVersionInputSchema.parse({
    name: metadata.name,
    description: metadata.description,
    periodStart: metadata.periodStart,
    periodEnd: metadata.periodEnd,
    responsibleUserId: metadata.responsibleUserId,
    origin: 'DETERMINISTIC_DRAFT',
    provenance: {
      createdFrom: 'SST_ASSESSMENT',
      assessmentSessionId,
      capabilityEngineVersion: evaluation.engineVersion,
      ...(evaluation.outputHash ? { capabilityEvaluationOutputHash: evaluation.outputHash } : {}),
      selectedCapabilityKeys: selected,
      excludedCapabilityKeys: excluded,
      ...(input.assessmentFinalizedAt
        ? { assessmentFinalizedAt: input.assessmentFinalizedAt }
        : {}),
    },
    items: evaluation.recommendations
      .filter((r) => selected.includes(r.capabilityKey))
      .sort(
        (a, b) =>
          priorityRank[a.priority] - priorityRank[b.priority] ||
          a.capabilityKey.localeCompare(b.capabilityKey),
      )
      .map((r) => ({
        title: r.title,
        description: r.description,
        priority: r.priority,
        evidenceReferences: [],
        provenanceType: 'UNIFIED_SST_EVALUATION',
        provenanceReference: `${assessmentSessionId}:${r.capabilityKey}`,
        provenanceSnapshot: {
          assessmentSessionId,
          capabilityKey: r.capabilityKey,
          engineVersion: evaluation.engineVersion,
          ...(evaluation.outputHash ? { outputHash: evaluation.outputHash } : {}),
          recommendationPriority: r.priority,
          title: r.title,
          description: r.description,
          reasons: r.reasons,
        },
      })),
  });
}

export function operationalPlanContentDigest(input: OperationalPlanVersionInput) {
  return adaptiveContentHash(operationalPlanVersionInputSchema.parse(input));
}

const planTransitions: Record<OperationalPlanItemStatus, readonly OperationalPlanItemStatus[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELED'],
  COMPLETED: [],
  CANCELED: [],
};

export function canTransitionOperationalPlanItem(
  from: OperationalPlanItemStatus,
  to: OperationalPlanItemStatus,
) {
  return planTransitions[from].includes(to);
}

export type OperationalPlanDraftSignal = {
  sourceType: Exclude<(typeof operationalPlanItemProvenanceTypes)[number], 'MANUAL'>;
  sourceId: string;
  title: string;
  description?: string;
  dueAt?: string;
  priority: (typeof operationalPlanItemPriorities)[number];
  workCenterId?: string;
  responsibleUserId?: string;
  evidenceReferences?: string[];
};

const priorityRank: Record<(typeof operationalPlanItemPriorities)[number], number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export function buildDeterministicOperationalPlanDraft(
  input: Omit<OperationalPlanVersionInput, 'origin' | 'items'> & {
    signals: readonly OperationalPlanDraftSignal[];
  },
): OperationalPlanVersionInput {
  const items = [...input.signals]
    .sort(
      (left, right) =>
        priorityRank[left.priority] - priorityRank[right.priority] ||
        (left.dueAt ?? '9999-12-31').localeCompare(right.dueAt ?? '9999-12-31') ||
        left.sourceType.localeCompare(right.sourceType) ||
        left.sourceId.localeCompare(right.sourceId),
    )
    .map((signal) => ({
      title: signal.title,
      description: signal.description,
      dueAt: signal.dueAt,
      priority: signal.priority,
      workCenterId: signal.workCenterId,
      responsibleUserId: signal.responsibleUserId,
      evidenceReferences: signal.evidenceReferences ?? [],
      provenanceType: signal.sourceType,
      provenanceReference: signal.sourceId,
      provenanceSnapshot: { sourceId: signal.sourceId, sourceType: signal.sourceType },
    }));
  return operationalPlanVersionInputSchema.parse({
    name: input.name,
    description: input.description,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    responsibleUserId: input.responsibleUserId,
    provenance: input.provenance,
    origin: 'DETERMINISTIC_DRAFT',
    items,
  });
}
