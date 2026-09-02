export const EVIDENCE_PACKAGE_STATUSES = ['DRAFT', 'FINALIZED', 'ARCHIVED'] as const;

export const EVIDENCE_PACKAGE_ITEM_TYPES = [
  'INSPECTION',
  'FINDING',
  'CORRECTIVE_ACTION',
  'ACTION_EVIDENCE',
  'TECHNICAL_ASSESSMENT',
  'INCIDENT',
  'PPE_ISSUE',
  'TRAINING_COMPLETION',
  'WORK_PERMIT',
  'OBLIGATION_EXECUTION',
  'GOVERNANCE_MEETING',
  'GOVERNANCE_DECISION',
  'REGULATORY_UNIT',
  'INSPECTION_BASIS_VERSION',
] as const;

export type EvidencePackageStatus = (typeof EVIDENCE_PACKAGE_STATUSES)[number];
export type EvidencePackageItemType = (typeof EVIDENCE_PACKAGE_ITEM_TYPES)[number];

export function assertEvidencePackageTransition(
  from: EvidencePackageStatus,
  to: EvidencePackageStatus,
) {
  const allowed: Record<EvidencePackageStatus, readonly EvidencePackageStatus[]> = {
    DRAFT: ['FINALIZED'],
    FINALIZED: ['ARCHIVED'],
    ARCHIVED: [],
  };
  if (!allowed[from].includes(to)) {
    throw new Error(`INVALID_EVIDENCE_PACKAGE_TRANSITION:${from}:${to}`);
  }
}

export function orderEvidenceManifestItems<
  T extends { type: EvidencePackageItemType; sourceId: string },
>(items: readonly T[]) {
  return [...items].sort(
    (left, right) =>
      left.type.localeCompare(right.type) || left.sourceId.localeCompare(right.sourceId),
  );
}
