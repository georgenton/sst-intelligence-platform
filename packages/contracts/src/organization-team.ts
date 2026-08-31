export const ORGANIZATION_MEMBERSHIP_ROLES = [
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
  'VIEWER',
] as const;

export type OrganizationMembershipRole = (typeof ORGANIZATION_MEMBERSHIP_ROLES)[number];

export const INVITABLE_ORGANIZATION_ROLES = [
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
  'VIEWER',
] as const satisfies readonly OrganizationMembershipRole[];

export const TEAM_MANAGEMENT_ROLES = [
  'ORG_OWNER',
  'ORG_ADMIN',
] as const satisfies readonly OrganizationMembershipRole[];

export const WORK_PERMIT_APPROVER_ROLES = [
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
] as const satisfies readonly OrganizationMembershipRole[];

export const ORGANIZATION_INVITATION_TTL_DAYS = 7;

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function canManageOrganizationTeam(role: string) {
  return TEAM_MANAGEMENT_ROLES.includes(role as (typeof TEAM_MANAGEMENT_ROLES)[number]);
}

export function canInviteOrganizationRole(role: string) {
  return INVITABLE_ORGANIZATION_ROLES.includes(
    role as (typeof INVITABLE_ORGANIZATION_ROLES)[number],
  );
}

export function canApproveWorkPermit(role: string) {
  return WORK_PERMIT_APPROVER_ROLES.includes(role as (typeof WORK_PERMIT_APPROVER_ROLES)[number]);
}

export function invitationExpiresAt(createdAt: Date) {
  return new Date(createdAt.getTime() + ORGANIZATION_INVITATION_TTL_DAYS * 86_400_000);
}

export function effectiveInvitationStatus(
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED',
  expiresAt: Date,
  now = new Date(),
) {
  return status === 'PENDING' && expiresAt.getTime() <= now.getTime() ? 'EXPIRED' : status;
}
