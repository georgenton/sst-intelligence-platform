export const GOVERNANCE_BODY_CATEGORIES = [
  'COMMITTEE',
  'WORK_GROUP',
  'SAFETY_MEETING',
  'OTHER',
] as const;

export const GOVERNANCE_MEETING_STATUSES = ['DRAFT', 'SCHEDULED', 'HELD', 'CANCELLED'] as const;

export const GOVERNANCE_ACTION_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;

export type GovernanceMeetingStatus = (typeof GOVERNANCE_MEETING_STATUSES)[number];
export type GovernanceActionStatus = (typeof GOVERNANCE_ACTION_STATUSES)[number];

const meetingTransitions: Record<GovernanceMeetingStatus, readonly GovernanceMeetingStatus[]> = {
  DRAFT: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['HELD', 'CANCELLED'],
  HELD: [],
  CANCELLED: [],
};

const actionTransitions: Record<GovernanceActionStatus, readonly GovernanceActionStatus[]> = {
  OPEN: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertGovernanceMeetingTransition(
  from: GovernanceMeetingStatus,
  to: GovernanceMeetingStatus,
) {
  if (!meetingTransitions[from].includes(to)) {
    throw new Error(`INVALID_GOVERNANCE_MEETING_TRANSITION:${from}:${to}`);
  }
}

export function assertGovernanceActionTransition(
  from: GovernanceActionStatus,
  to: GovernanceActionStatus,
) {
  if (!actionTransitions[from].includes(to)) {
    throw new Error(`INVALID_GOVERNANCE_ACTION_TRANSITION:${from}:${to}`);
  }
}

export function governanceRegulatoryReferenceLabel(input: {
  unitReviewStatus?: string | null;
  requirementEditorialStatus?: string | null;
}) {
  if (!input.unitReviewStatus && !input.requirementEditorialStatus) return 'SIN_REFERENCIA';
  const approvedUnit = input.unitReviewStatus === 'APPROVED';
  const approvedRequirement = input.requirementEditorialStatus === 'APPROVED_FOR_RULE_DRAFTING';
  return approvedUnit || approvedRequirement ? 'REFERENCIA_REVISADA' : 'REFERENCIA_CANDIDATA';
}
