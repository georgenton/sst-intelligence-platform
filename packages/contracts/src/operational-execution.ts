import { z } from 'zod';

export const OBLIGATION_EXECUTION_ORIGINS = [
  'APPROVED_REQUIREMENT',
  'CANDIDATE_REQUIREMENT',
  'INTERNAL_PROGRAM',
  'MANUAL',
] as const;

export const OBLIGATION_EXECUTION_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'BLOCKED',
  'READY_FOR_REVIEW',
  'COMPLETED',
  'CANCELLED',
] as const;

export type ObligationExecutionOrigin = (typeof OBLIGATION_EXECUTION_ORIGINS)[number];
export type ObligationExecutionStatus = (typeof OBLIGATION_EXECUTION_STATUSES)[number];

const transitions: Record<ObligationExecutionStatus, readonly ObligationExecutionStatus[]> = {
  OPEN: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['BLOCKED', 'READY_FOR_REVIEW', 'COMPLETED', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
  READY_FOR_REVIEW: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertObligationExecutionTransition(
  from: ObligationExecutionStatus,
  to: ObligationExecutionStatus,
) {
  if (!transitions[from].includes(to)) {
    throw new Error(`INVALID_OBLIGATION_EXECUTION_TRANSITION:${from}:${to}`);
  }
}

export function obligationReviewTargetStatus(
  status: ObligationExecutionStatus,
  decision: 'APPROVED' | 'NEEDS_REVISION',
): 'COMPLETED' | 'IN_PROGRESS' {
  if (status !== 'READY_FOR_REVIEW') throw new Error('OBLIGATION_NOT_READY_FOR_REVIEW');
  return decision === 'APPROVED' ? 'COMPLETED' : 'IN_PROGRESS';
}

export const obligationProvenanceSnapshotSchema = z.object({
  originType: z.enum(OBLIGATION_EXECUTION_ORIGINS),
  capturedAt: z.string().datetime(),
  requirement: z
    .object({
      id: z.string().uuid(),
      title: z.string(),
      editorialStatus: z.string(),
    })
    .nullable(),
  regulatoryUnit: z
    .object({
      id: z.string().uuid(),
      identifier: z.string(),
      locator: z.string(),
      normalizedTextHash: z.string(),
    })
    .nullable(),
  internalReference: z.string().nullable(),
  manualReference: z.string().nullable(),
});

export type ObligationProvenanceSnapshot = z.infer<typeof obligationProvenanceSnapshotSchema>;

export const WORK_QUEUE_MODULES = [
  'INSPECTIONS',
  'TECHNICAL_RISK',
  'REGULATORY',
  'OPERATIONAL_EXECUTION',
  'WORK_PERMITS',
  'INCIDENTS',
  'PPE',
  'TRAINING',
  'GOVERNANCE',
  'INTELLIGENCE',
  'PLAN',
] as const;

export const WORK_QUEUE_ITEM_TYPES = [
  'CORRECTIVE_ACTION',
  'TECHNICAL_REVIEW',
  'TECHNICAL_REVISION',
  'REGULATORY_EXPERT_REVIEW',
  'OBLIGATION_EXECUTION',
  'SYSTEMIC_REVIEW',
  'WORK_PERMIT_APPROVAL',
  'WORK_PERMIT_SUSPENDED',
  'WORK_PERMIT_DUE',
  'INCIDENT_INVESTIGATION',
  'INCIDENT_ACTION',
  'SAFETY_OBSERVATION_FOLLOW_UP',
  'PPE_REPLACEMENT_DUE',
  'PPE_CONDITION_REVIEW',
  'TRAINING_REQUIRED',
  'TRAINING_DUE',
  'TRAINING_SESSION_FOLLOW_UP',
  'GOVERNANCE_ACTION',
  'OPERATIONAL_SIGNAL',
  'OPERATIONAL_PLAN_ITEM',
] as const;

export type WorkQueueModule = (typeof WORK_QUEUE_MODULES)[number];
export type WorkQueueItemType = (typeof WORK_QUEUE_ITEM_TYPES)[number];

export function workQueuePriorityRank(input: {
  overdue: boolean;
  dueSoon?: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: string;
  type: WorkQueueItemType;
}) {
  if (input.overdue && (input.priority === 'URGENT' || input.priority === 'HIGH')) return 0;
  if (input.overdue) return 1;
  if (input.dueSoon) return 2;
  if (
    input.type === 'TECHNICAL_REVIEW' ||
    input.type === 'REGULATORY_EXPERT_REVIEW' ||
    input.type === 'WORK_PERMIT_APPROVAL' ||
    input.type === 'INCIDENT_INVESTIGATION' ||
    input.type === 'PPE_CONDITION_REVIEW' ||
    input.type === 'TRAINING_SESSION_FOLLOW_UP' ||
    input.type === 'SAFETY_OBSERVATION_FOLLOW_UP' ||
    input.type === 'GOVERNANCE_ACTION' ||
    input.type === 'OPERATIONAL_SIGNAL' ||
    input.type === 'OPERATIONAL_PLAN_ITEM'
  )
    return 3;
  if (input.status === 'BLOCKED' || input.type === 'WORK_PERMIT_SUSPENDED') return 4;
  return 5;
}

export const WORK_PERMIT_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'AUTHORIZED',
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
  'CANCELLED',
] as const;

export type WorkPermitStatus = (typeof WORK_PERMIT_STATUSES)[number];

const permitTransitions: Record<WorkPermitStatus, readonly WorkPermitStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['DRAFT', 'AUTHORIZED', 'CANCELLED'],
  AUTHORIZED: ['ACTIVE', 'SUSPENDED', 'CANCELLED'],
  ACTIVE: ['SUSPENDED', 'CLOSED'],
  SUSPENDED: ['ACTIVE', 'CLOSED', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
};

export function assertWorkPermitTransition(from: WorkPermitStatus, to: WorkPermitStatus) {
  if (!permitTransitions[from].includes(to)) {
    throw new Error(`INVALID_WORK_PERMIT_TRANSITION:${from}:${to}`);
  }
}
