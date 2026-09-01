import type { MembershipRole } from '@prisma/client';

export const PPE_WRITE_ROLES: MembershipRole[] = [
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
];

export const PPE_REVIEW_ROLES: MembershipRole[] = ['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER'];
