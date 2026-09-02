import type { MembershipRole } from '@prisma/client';

export const EVIDENCE_PACKAGE_WRITE_ROLES: MembershipRole[] = [
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
];
