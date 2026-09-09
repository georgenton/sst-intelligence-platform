import type { EvidencePackageItemType, MembershipRole } from '@prisma/client';
import {
  INCIDENTS_FEATURE_KEY,
  PPE_FEATURE_KEY,
  TRAINING_FEATURE_KEY,
  WORK_PERMITS_FEATURE_KEY,
} from '../catalog/entitlement';

export const EVIDENCE_PACKAGE_WRITE_ROLES: MembershipRole[] = [
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
];

export const EVIDENCE_REFERENCE_ENTITLEMENTS = {
  INSPECTION: 'module.inspections',
  FINDING: 'module.inspections',
  CORRECTIVE_ACTION: 'module.inspections',
  ACTION_EVIDENCE: 'module.inspections',
  TECHNICAL_ASSESSMENT: 'module.technical_risk',
  INCIDENT: INCIDENTS_FEATURE_KEY,
  PPE_ISSUE: PPE_FEATURE_KEY,
  TRAINING_COMPLETION: TRAINING_FEATURE_KEY,
  WORK_PERMIT: WORK_PERMITS_FEATURE_KEY,
  OBLIGATION_EXECUTION: null,
  GOVERNANCE_MEETING: null,
  GOVERNANCE_DECISION: null,
  REGULATORY_UNIT: null,
  INSPECTION_BASIS_VERSION: 'module.inspections',
} as const satisfies Record<EvidencePackageItemType, string | null>;
