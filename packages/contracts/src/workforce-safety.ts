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
