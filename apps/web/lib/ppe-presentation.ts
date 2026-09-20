import type { PositionRiskCategory } from '@sst/contracts';

export type PpeCategory =
  | 'HEAD'
  | 'EYE_FACE'
  | 'HEARING'
  | 'RESPIRATORY'
  | 'HAND_ARM'
  | 'FOOT'
  | 'BODY'
  | 'FALL_PROTECTION'
  | 'OTHER';
export type CatalogItem = {
  id: string;
  name: string;
  category: PpeCategory;
  description?: string | null;
  manufacturerModel?: string | null;
  referenceStandard?: string | null;
  referenceJurisdiction?: string | null;
  referenceProvenance?: string | null;
  referenceReviewStatus?: 'PENDING_PROFESSIONAL_REVIEW' | 'REVIEWED' | 'REJECTED' | null;
  defaultReplacementIntervalDays?: number | null;
  status: 'ACTIVE' | 'INACTIVE';
};
export type CatalogResponse = { items: CatalogItem[]; total: number };
export type Position = {
  id: string;
  name: string;
  isActive: boolean;
  _count: { workers: number; ppeRequirements: number };
  riskContexts: Array<{ id: string; category: PositionRiskCategory; description: string }>;
};
export type PositionCandidates = {
  position: Position;
  categories: PpeCategory[];
  suggestions: Array<{
    risk: { id: string; category: PositionRiskCategory; description: string };
    categories: PpeCategory[];
  }>;
  catalogItems: CatalogItem[];
  decisionBoundary: string;
};
export type PositionRequirement = {
  id: string;
  createdAt: string;
  selectedBy: { id: string; displayName: string };
  riskContext?: { id: string; category: PositionRiskCategory; description: string } | null;
  reason: string;
  decision: 'SELECTED_BY_PROFESSIONAL' | 'REQUIRED_INTERNALLY';
  position: { id: string; name: string };
  ppeCatalogItem: CatalogItem;
  workCenter?: { id: string; name: string } | null;
  workArea?: { id: string; name: string } | null;
};
export type PpeRequirement = {
  id: string;
  reason: string;
  status: 'REQUIRED' | 'FULFILLED' | 'CANCELLED';
  assignedAt: string;
  assignedBy: { id: string; displayName: string };
  positionRequirementId?: string | null;
  positionRequirement?: Omit<PositionRequirement, 'ppeCatalogItem'> | null;
  ppeCatalogItem: Pick<CatalogItem, 'id' | 'name' | 'category' | 'status'>;
  workCenter?: { id: string; name: string } | null;
  linkedAssessment?: { id: string; title: string } | null;
  linkedFinding?: { id: string; title: string; inspectionId: string } | null;
};
export type PpeIssue = {
  id: string;
  status: 'ISSUED' | 'IN_SERVICE' | 'REPLACEMENT_DUE' | 'REPLACED' | 'RETIRED' | 'LOST_DAMAGED';
  acknowledgementStatus: 'PENDING' | 'RECORDED';
  acknowledgementNote?: string | null;
  issuedAt: string;
  issuedBy?: { id: string; displayName: string } | null;
  acknowledgedBy?: { id: string; displayName: string } | null;
  acknowledgedAt?: string | null;
  replacementReason?: ReplacementReason | null;
  replacementReasonNote?: string | null;
  replacesIssue?: { id: string; issuedAt: string; status: PpeIssue['status'] } | null;
  replacementIssue?: { id: string; issuedAt: string; status: PpeIssue['status'] } | null;
  incidentLinks: Array<{
    id: string;
    note?: string | null;
    incident: { id: string; title: string; status: string };
  }>;

  expectedReplacementAt?: string | null;
  assetReference?: string | null;
  evidenceNote?: string | null;
  evidenceUrl?: string | null;
  replacesIssueId?: string | null;
  version: number;
  replacementDue: boolean;
  ppeCatalogItem: CatalogItem;
  requirement?: { id: string; reason: string; status: string } | null;
  inspections: Array<{
    id: string;
    inspectedAt: string;
    condition: 'SERVICEABLE' | 'REVIEW_REQUIRED' | 'UNSERVICEABLE';
    note?: string | null;
    evidenceUrl?: string | null;
    recordedBy?: { id: string; displayName: string } | null;
  }>;
};
export type WorkerPpeWorkspace = {
  worker: {
    id: string;
    displayName: string;
    status: 'ACTIVE' | 'INACTIVE';
    workCenterId?: string | null;
    workAreaId?: string | null;
    positionId?: string | null;
    position?: { id: string; name: string } | null;
  };
  requirements: PpeRequirement[];
  issues: PpeIssue[];
};
export const CATEGORY_LABELS: Record<PpeCategory, string> = {
  HEAD: 'Cabeza',
  EYE_FACE: 'Ojos y rostro',
  HEARING: 'Protección auditiva',
  RESPIRATORY: 'Protección respiratoria',
  HAND_ARM: 'Manos y brazos',
  FOOT: 'Pies',
  BODY: 'Cuerpo',
  FALL_PROTECTION: 'Protección contra caídas',
  OTHER: 'Otro',
};
export const ISSUE_LABELS: Record<PpeIssue['status'], string> = {
  ISSUED: 'Entregado, pendiente de confirmación',
  IN_SERVICE: 'En servicio',
  REPLACEMENT_DUE: 'Reemplazo requerido',
  REPLACED: 'Reemplazado',
  RETIRED: 'Retirado',
  LOST_DAMAGED: 'Perdido o dañado',
};
export const WRITE_ROLES = new Set([
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
]);
export const REVIEW_ROLES = new Set(['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']);
export const REPLACEMENT_REASON_LABELS: Record<ReplacementReason, string> = {
  EXPIRY: 'Vencimiento',
  WEAR: 'Desgaste',
  DAMAGE: 'Daño',
  LOSS: 'Pérdida',
  OTHER_JUSTIFIED: 'Otra razón justificada',
};

export type ReplacementReason = 'EXPIRY' | 'WEAR' | 'DAMAGE' | 'LOSS' | 'OTHER_JUSTIFIED';
export type WorkerChoice = {
  id: string;
  displayName: string;
  status: 'ACTIVE' | 'INACTIVE';
  position?: { id: string; name: string } | null;
  workCenter?: { id: string; name: string } | null;
  workArea?: { id: string; name: string } | null;
};
export type IncidentChoice = { id: string; title: string; status: string; occurredAt: string };
export const RISK_LABELS: Record<PositionRiskCategory, string> = {
  ELECTRICAL: 'Eléctrico',
  ARC_FLASH: 'Arco eléctrico',
  PROJECTION: 'Proyección',
  MECHANICAL: 'Mecánico',
  CHEMICAL: 'Químico',
  BIOLOGICAL: 'Biológico',
  PHYSICAL: 'Físico',
  ERGONOMIC: 'Ergonómico',
  OTHER: 'Otro',
};
export const CONDITION_LABELS = {
  SERVICEABLE: 'Apto para servicio',
  REVIEW_REQUIRED: 'Requiere revisión',
  UNSERVICEABLE: 'No apto para servicio',
} as const;
export const REVIEW_LABELS = {
  PENDING_PROFESSIONAL_REVIEW: 'Pendiente de revisión',
  REVIEWED: 'Revisada internamente',
  REJECTED: 'Descartada',
} as const;
export function ppeDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'Sin registro';
}
export function ppeScope(value: {
  workCenter?: { name: string } | null;
  workArea?: { name: string } | null;
}) {
  return (
    [value.workCenter?.name, value.workArea?.name].filter(Boolean).join(' · ') || 'Organización'
  );
}
