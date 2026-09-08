export const WORKER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

export function canReceiveNewWorkerAssignment(status: WorkerStatus) {
  return status === 'ACTIVE';
}

export function assertWorkerDateRange(startDate?: Date | null, endDate?: Date | null) {
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    throw new RangeError('Worker end date cannot be before start date');
  }
}

export const INCIDENT_STATUSES = [
  'DRAFT',
  'REPORTED',
  'UNDER_INVESTIGATION',
  'ACTIONS_IN_PROGRESS',
  'CLOSED',
  'CANCELLED',
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

const incidentTransitions: Record<IncidentStatus, readonly IncidentStatus[]> = {
  DRAFT: ['REPORTED', 'CANCELLED'],
  REPORTED: ['UNDER_INVESTIGATION', 'CANCELLED'],
  UNDER_INVESTIGATION: ['ACTIONS_IN_PROGRESS', 'CLOSED', 'CANCELLED'],
  ACTIONS_IN_PROGRESS: ['UNDER_INVESTIGATION', 'CLOSED', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
};

export function assertIncidentTransition(from: IncidentStatus, to: IncidentStatus) {
  if (!incidentTransitions[from].includes(to)) {
    throw new Error(`INVALID_INCIDENT_TRANSITION:${from}:${to}`);
  }
}

export const INCIDENT_ACTION_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'PENDING_VERIFICATION',
  'COMPLETED',
  'CANCELLED',
] as const;
export type IncidentActionStatus = (typeof INCIDENT_ACTION_STATUSES)[number];

const incidentActionTransitions: Record<IncidentActionStatus, readonly IncidentActionStatus[]> = {
  OPEN: ['IN_PROGRESS', 'PENDING_VERIFICATION', 'CANCELLED'],
  IN_PROGRESS: ['PENDING_VERIFICATION', 'CANCELLED'],
  PENDING_VERIFICATION: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertIncidentActionTransition(
  from: IncidentActionStatus,
  to: IncidentActionStatus,
) {
  if (!incidentActionTransitions[from].includes(to)) {
    throw new Error(`INVALID_INCIDENT_ACTION_TRANSITION:${from}:${to}`);
  }
}

export function incidentClosureEligibility(input: {
  investigationStatus: string | null;
  actionStatuses: readonly string[];
}) {
  if (input.investigationStatus !== 'COMPLETED') {
    return { allowed: false, reason: 'La investigación profesional debe estar completada.' };
  }
  const activeActions = input.actionStatuses.filter((status) => status !== 'CANCELLED');
  if (activeActions.some((status) => status !== 'COMPLETED')) {
    return { allowed: false, reason: 'Todas las acciones no canceladas deben estar verificadas.' };
  }
  return { allowed: true, reason: null };
}

export const PPE_ISSUE_STATUSES = [
  'ISSUED',
  'IN_SERVICE',
  'REPLACEMENT_DUE',
  'REPLACED',
  'RETIRED',
  'LOST_DAMAGED',
] as const;
export type PpeIssueStatus = (typeof PPE_ISSUE_STATUSES)[number];

const ppeIssueTransitions: Record<PpeIssueStatus, readonly PpeIssueStatus[]> = {
  ISSUED: ['IN_SERVICE', 'REPLACEMENT_DUE', 'RETIRED', 'LOST_DAMAGED'],
  IN_SERVICE: ['REPLACEMENT_DUE', 'RETIRED', 'LOST_DAMAGED'],
  REPLACEMENT_DUE: ['REPLACED', 'RETIRED', 'LOST_DAMAGED'],
  REPLACED: [],
  RETIRED: [],
  LOST_DAMAGED: ['REPLACED', 'RETIRED'],
};

export function assertPpeIssueTransition(from: PpeIssueStatus, to: PpeIssueStatus) {
  if (!ppeIssueTransitions[from].includes(to)) {
    throw new Error(`INVALID_PPE_ISSUE_TRANSITION:${from}:${to}`);
  }
}

export function isPpeReplacementDue(input: {
  status: PpeIssueStatus;
  expectedReplacementAt: Date | null;
  now: Date;
}) {
  if (['REPLACED', 'RETIRED'].includes(input.status)) return false;
  return (
    input.status === 'REPLACEMENT_DUE' ||
    Boolean(input.expectedReplacementAt && input.expectedReplacementAt <= input.now)
  );
}

export function ppeConditionRequiresReview(condition: string) {
  return condition === 'REVIEW_REQUIRED' || condition === 'UNSERVICEABLE';
}

export const POSITION_RISK_CATEGORIES = [
  'ELECTRICAL',
  'ARC_FLASH',
  'PROJECTION',
  'MECHANICAL',
  'ERGONOMIC',
  'CHEMICAL',
  'BIOLOGICAL',
  'PHYSICAL',
  'OTHER',
] as const;
export type PositionRiskCategory = (typeof POSITION_RISK_CATEGORIES)[number];

export const PPE_CATEGORY_BY_POSITION_RISK: Readonly<
  Record<PositionRiskCategory, readonly string[]>
> = {
  ELECTRICAL: ['HAND_ARM', 'FOOT', 'HEAD'],
  ARC_FLASH: ['EYE_FACE', 'BODY', 'HAND_ARM', 'HEAD'],
  PROJECTION: ['EYE_FACE'],
  MECHANICAL: ['HAND_ARM', 'FOOT', 'HEAD'],
  ERGONOMIC: [],
  CHEMICAL: ['EYE_FACE', 'RESPIRATORY', 'HAND_ARM', 'BODY'],
  BIOLOGICAL: ['EYE_FACE', 'RESPIRATORY', 'HAND_ARM', 'BODY'],
  PHYSICAL: ['HEARING', 'HEAD', 'BODY'],
  OTHER: [],
};

export function suggestPpeCategories(risks: readonly PositionRiskCategory[]) {
  return [...new Set(risks.flatMap((risk) => PPE_CATEGORY_BY_POSITION_RISK[risk]))].sort();
}

export const SAFETY_OBSERVATION_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'ACTION_REQUIRED',
  'RESOLVED',
  'CLOSED_NO_ACTION',
] as const;
export type SafetyObservationStatus = (typeof SAFETY_OBSERVATION_STATUSES)[number];

const safetyObservationTransitions: Record<
  SafetyObservationStatus,
  readonly SafetyObservationStatus[]
> = {
  OPEN: ['UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED', 'CLOSED_NO_ACTION'],
  UNDER_REVIEW: ['ACTION_REQUIRED', 'RESOLVED', 'CLOSED_NO_ACTION'],
  ACTION_REQUIRED: ['UNDER_REVIEW', 'RESOLVED'],
  RESOLVED: [],
  CLOSED_NO_ACTION: [],
};

export function assertSafetyObservationTransition(
  from: SafetyObservationStatus,
  to: SafetyObservationStatus,
) {
  if (!safetyObservationTransitions[from].includes(to)) {
    throw new Error(`INVALID_SAFETY_OBSERVATION_TRANSITION:${from}:${to}`);
  }
}

export function trainingNeedRequiresApprovedRequirement(input: {
  sourceType: string;
  requirementEditorialStatus?: string | null;
}) {
  return (
    input.sourceType !== 'APPROVED_REQUIREMENT' ||
    input.requirementEditorialStatus === 'APPROVED_FOR_RULE_DRAFTING'
  );
}

export const TRAINING_SESSION_STATUSES = ['DRAFT', 'SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;
export type TrainingSessionStatus = (typeof TRAINING_SESSION_STATUSES)[number];

const trainingSessionTransitions: Record<TrainingSessionStatus, readonly TrainingSessionStatus[]> =
  {
    DRAFT: ['SCHEDULED', 'CANCELLED'],
    SCHEDULED: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };

export function assertTrainingSessionTransition(
  from: TrainingSessionStatus,
  to: TrainingSessionStatus,
) {
  if (!trainingSessionTransitions[from].includes(to)) {
    throw new Error(`INVALID_TRAINING_SESSION_TRANSITION:${from}:${to}`);
  }
}

export type WorkerCompetencyStatus = 'CURRENT' | 'DUE_SOON' | 'EXPIRED' | 'NOT_COMPLETED';

export function deriveWorkerCompetencyStatus(input: {
  completionExists: boolean;
  validUntil: Date | null;
  now: Date;
  dueSoonDays?: number;
}): WorkerCompetencyStatus {
  if (!input.completionExists) return 'NOT_COMPLETED';
  if (!input.validUntil) return 'CURRENT';
  if (input.validUntil < input.now) return 'EXPIRED';
  const boundary = new Date(input.now.getTime() + (input.dueSoonDays ?? 30) * 24 * 60 * 60 * 1000);
  return input.validUntil <= boundary ? 'DUE_SOON' : 'CURRENT';
}
