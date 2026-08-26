import type { MembershipRole } from '@prisma/client';

export const UNIFIED_SST_EVALUATION_ROLES: MembershipRole[] = [
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
];

export const REGULATORY_INTERPRETATION_REVIEW_ROLES: MembershipRole[] = [
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
];
