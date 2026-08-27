import { describe, expect, it } from 'vitest';
import {
  canApproveWorkPermit,
  canInviteOrganizationRole,
  canManageOrganizationTeam,
  effectiveInvitationStatus,
  invitationExpiresAt,
  normalizeInvitationEmail,
  ORGANIZATION_INVITATION_TTL_DAYS,
} from './organization-team.js';

describe('organization team rules', () => {
  it('normalizes invitation email and applies a bounded seven-day TTL', () => {
    const createdAt = new Date('2026-08-27T00:00:00.000Z');
    expect(normalizeInvitationEmail('  Alice@Example.COM ')).toBe('alice@example.com');
    expect(invitationExpiresAt(createdAt).toISOString()).toBe('2026-09-03T00:00:00.000Z');
    expect(ORGANIZATION_INVITATION_TTL_DAYS).toBe(7);
  });

  it('keeps owner creation outside invitations and team administration owner/admin only', () => {
    expect(canInviteOrganizationRole('ORG_OWNER')).toBe(false);
    expect(canInviteOrganizationRole('SST_MANAGER')).toBe(true);
    expect(canManageOrganizationTeam('ORG_OWNER')).toBe(true);
    expect(canManageOrganizationTeam('ORG_ADMIN')).toBe(true);
    expect(canManageOrganizationTeam('SST_MANAGER')).toBe(false);
    expect(canManageOrganizationTeam('VIEWER')).toBe(false);
  });

  it('keeps permit approval restricted to current professional management roles', () => {
    expect(canApproveWorkPermit('ORG_OWNER')).toBe(true);
    expect(canApproveWorkPermit('ORG_ADMIN')).toBe(true);
    expect(canApproveWorkPermit('SST_MANAGER')).toBe(true);
    expect(canApproveWorkPermit('SST_TECHNICIAN')).toBe(false);
    expect(canApproveWorkPermit('CONSULTANT')).toBe(false);
    expect(canApproveWorkPermit('VIEWER')).toBe(false);
  });

  it('derives expiry without a background job and preserves terminal states', () => {
    const expiry = new Date('2026-08-27T12:00:00.000Z');
    const after = new Date('2026-08-27T12:00:00.001Z');
    expect(effectiveInvitationStatus('PENDING', expiry, after)).toBe('EXPIRED');
    expect(effectiveInvitationStatus('ACCEPTED', expiry, after)).toBe('ACCEPTED');
    expect(effectiveInvitationStatus('REVOKED', expiry, after)).toBe('REVOKED');
  });
});
