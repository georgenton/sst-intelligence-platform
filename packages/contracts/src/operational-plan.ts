import { z } from 'zod';
import { adaptiveContentHash } from './adaptive-configuration.js';

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
