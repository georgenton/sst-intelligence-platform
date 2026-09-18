export type PlanItem = {
  id: string;
  title: string;
  description?: string | null;
  startsAt?: string | null;
  dueAt?: string | null;
  frequency?: string | null;
  priority: string;
  evidenceReferences: string[];
  provenanceType: string;
  provenanceReference?: string | null;
  provenanceSnapshot: Record<string, unknown>;
  workCenter?: { id: string; name: string } | null;
  responsible?: { id: string; displayName: string } | null;
  execution?: { status: string; version: number } | null;
};
export type PlanVersion = {
  id: string;
  version: number;
  status: string;
  origin: string;
  name: string;
  description?: string | null;
  periodStart: string;
  periodEnd: string;
  contentDigest: string;
  responsibleUserId?: string | null;
  provenance: Record<string, unknown>;
  responsible?: { id: string; displayName: string } | null;
  items: PlanItem[];
};
export type Plan = { id: string; versions: PlanVersion[] };
export type PlanList = { items: Plan[]; total: number };
export type ActivePlanContext = {
  planId: string;
  versionId: string;
  version: number;
  nextVersion: number;
  name: string;
  periodStart: string;
  periodEnd: string;
  itemCount: number;
  responsible?: { id: string; displayName: string } | null;
};

export function planDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('es-EC', { timeZone: 'UTC' }) : 'Por definir';
}
export function planStateLabel(value: string) {
  return (
    (
      {
        DRAFT: 'Borrador',
        ACTIVE: 'Activo',
        RETIRED: 'Histórico',
        PLANNED: 'Planificado',
        IN_PROGRESS: 'En curso',
        COMPLETED: 'Completado',
        CANCELED: 'Cancelado',
      } as Record<string, string>
    )[value] ?? 'Sin definir'
  );
}
export function planExecutionCounts(items: readonly PlanItem[]) {
  return {
    completed: items.filter((item) => item.execution?.status === 'COMPLETED').length,
    inProgress: items.filter((item) => item.execution?.status === 'IN_PROGRESS').length,
    planned: items.filter((item) => !item.execution || item.execution.status === 'PLANNED').length,
    canceled: items.filter((item) => item.execution?.status === 'CANCELED').length,
  };
}
export function planMissingFields(items: readonly PlanItem[]) {
  return {
    responsible: items.filter((item) => !item.responsible).length,
    dueAt: items.filter((item) => !item.dueAt).length,
    frequency: items.filter((item) => !item.frequency).length,
  };
}
export function isInheritedPlanItem(item: PlanItem) {
  return typeof item.provenanceSnapshot.inheritedFromItemId === 'string';
}
export function planVersionSource(version: PlanVersion) {
  if (version.provenance.createdFrom === 'EXISTING_PLAN_AND_SST_ASSESSMENT')
    return 'Plan vigente + diagnóstico';
  if (version.provenance.createdFrom === 'SST_ASSESSMENT') return 'Diagnóstico SST';
  return version.origin === 'MANUAL' ? 'Plan manual' : 'Propuestas revisadas';
}
