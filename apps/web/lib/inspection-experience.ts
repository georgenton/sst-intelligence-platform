export type InspectionRole =
  'ORG_OWNER' | 'ORG_ADMIN' | 'SST_MANAGER' | 'SST_TECHNICIAN' | 'CONSULTANT' | 'VIEWER' | string;

export type StatusDomain = 'inspection' | 'finding' | 'action' | 'alert' | 'systemic-review';
export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

type StatusMeta = { label: string; symbol: string; tone: StatusTone };

const STATUS_META: Record<StatusDomain, Record<string, StatusMeta>> = {
  inspection: {
    DRAFT: { label: 'Borrador', symbol: '○', tone: 'neutral' },
    IN_PROGRESS: { label: 'En progreso', symbol: '→', tone: 'info' },
    COMPLETED: { label: 'Completada', symbol: '✓', tone: 'success' },
    CANCELED: { label: 'Cancelada', symbol: '×', tone: 'neutral' },
  },
  finding: {
    OPEN: { label: 'Abierto', symbol: '○', tone: 'neutral' },
    ACTION_IN_PROGRESS: { label: 'Acción en progreso', symbol: '→', tone: 'info' },
    PENDING_VERIFICATION: {
      label: 'Por verificar',
      symbol: '◇',
      tone: 'warning',
    },
    CLOSED: { label: 'Cerrado', symbol: '✓', tone: 'success' },
  },
  action: {
    OPEN: { label: 'Abierta', symbol: '○', tone: 'neutral' },
    IN_PROGRESS: { label: 'En progreso', symbol: '→', tone: 'info' },
    PENDING_VERIFICATION: {
      label: 'Pendiente de verificación',
      symbol: '◇',
      tone: 'warning',
    },
    COMPLETED: { label: 'Verificada', symbol: '✓', tone: 'success' },
    CANCELED: { label: 'Cancelada', symbol: '×', tone: 'neutral' },
  },
  alert: {
    OPEN: { label: 'Abierta', symbol: '△', tone: 'danger' },
    ACKNOWLEDGED: { label: 'Reconocida', symbol: '✓', tone: 'success' },
    RESOLVED: { label: 'Resuelta', symbol: '✓', tone: 'success' },
  },
  'systemic-review': {
    OPEN: { label: 'Abierta', symbol: '○', tone: 'neutral' },
    IN_REVIEW: { label: 'En revisión', symbol: '→', tone: 'info' },
    COMPLETED: { label: 'Completada', symbol: '✓', tone: 'success' },
    CANCELED: { label: 'Cancelada', symbol: '×', tone: 'neutral' },
  },
};

const WRITE_ROLES = new Set<InspectionRole>([
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
]);
const VERIFY_ROLES = new Set<InspectionRole>(['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']);

export function statusMeta(domain: StatusDomain, status: string): StatusMeta {
  return (
    STATUS_META[domain][status] ?? {
      label: status.replaceAll('_', ' ').toLocaleLowerCase('es'),
      symbol: '•',
      tone: 'neutral',
    }
  );
}

export function canWriteInspections(role: InspectionRole | undefined): boolean {
  return role !== undefined && WRITE_ROLES.has(role);
}

export function canVerifyFindings(role: InspectionRole | undefined): boolean {
  return role !== undefined && VERIFY_ROLES.has(role);
}

export function canAcknowledgeInspectionAlerts(role: InspectionRole | undefined): boolean {
  return canVerifyFindings(role);
}

export function canCompleteCorrectiveAction(input: {
  role: InspectionRole | undefined;
  userId: string | undefined;
  assignedToUserId: string | undefined;
}): boolean {
  if (!canWriteInspections(input.role)) return false;
  return input.role !== 'SST_TECHNICIAN' || input.assignedToUserId === input.userId;
}

export type InspectionFilters = {
  workCenterId?: string;
  workAreaId?: string;
  inspectionStatus?: string;
  category?: string;
  riskLevel?: string;
  findingStatus?: string;
  hasRecurrence?: string;
  overdue?: string;
  status?: string;
};

export function filterSearchParams(filters: InspectionFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function apiQuery(
  filters: InspectionFilters,
  pagination = { page: 1, pageSize: 20 },
): string {
  const params = new URLSearchParams(filterSearchParams(filters));
  params.set('page', String(pagination.page));
  params.set('pageSize', String(pagination.pageSize));
  return params.toString();
}

export function activeFilterCount(filters: InspectionFilters): number {
  return Object.values(filters).filter(Boolean).length;
}

export function actionPrimaryStep(status: string): 'start' | 'complete' | 'verify' | null {
  if (status === 'OPEN') return 'start';
  if (status === 'IN_PROGRESS') return 'complete';
  if (status === 'PENDING_VERIFICATION') return 'verify';
  return null;
}

export function actionPrimaryLabel(status: string): string | null {
  if (status === 'OPEN') return 'Iniciar acción';
  if (status === 'IN_PROGRESS') return 'Enviar a verificación';
  if (status === 'PENDING_VERIFICATION') return 'Verificar riesgo residual';
  return null;
}

export function actionProgressMeta(statuses: readonly string[]): {
  label: string;
  state: '' | 'current' | 'done';
} {
  const activeStatuses = statuses.filter((status) => status !== 'CANCELED');
  if (activeStatuses.length === 0) return { label: 'Ejecución por iniciar', state: '' };
  if (activeStatuses.every((status) => status === 'COMPLETED'))
    return { label: 'Acción verificada', state: 'done' };
  if (activeStatuses.some((status) => status === 'PENDING_VERIFICATION'))
    return { label: 'Pendiente de verificación', state: 'current' };
  if (activeStatuses.some((status) => status === 'IN_PROGRESS'))
    return { label: 'Ejecución en curso', state: 'current' };
  return { label: 'Ejecución por iniciar', state: 'current' };
}

export type InspectionAlertType = 'RECURRENCE' | 'OVERDUE_ACTION' | 'HIGH_RESIDUAL_RISK';

const ALERT_TYPE_LABELS: Record<InspectionAlertType, string> = {
  RECURRENCE: 'Recurrencia',
  OVERDUE_ACTION: 'Acción vencida',
  HIGH_RESIDUAL_RISK: 'Riesgo residual alto o crítico',
};

export function alertTypeLabel(value: string): string {
  if (value in ALERT_TYPE_LABELS) return ALERT_TYPE_LABELS[value as InspectionAlertType];
  return value.replaceAll('_', ' ').toLocaleLowerCase('es');
}

export function inspectionDepthLabel(
  depth: 'BASIC' | 'TECHNICAL' | 'SYSTEMIC' | null | undefined,
): string {
  if (depth === 'BASIC') return 'Básica';
  if (depth === 'TECHNICAL') return 'Técnica';
  if (depth === 'SYSTEMIC') return 'Sistémica';
  return 'No registrada (inspección histórica)';
}
