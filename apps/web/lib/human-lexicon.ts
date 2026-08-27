const roleLabels: Record<string, string> = {
  ORG_OWNER: 'Propietario',
  ORG_ADMIN: 'Administrador',
  SST_MANAGER: 'Responsable SST',
  SST_TECHNICIAN: 'Técnico SST',
  CONSULTANT: 'Consultor',
  VIEWER: 'Solo lectura',
};

export function humanRoleLabel(role?: string | null): string {
  return role ? (roleLabels[role] ?? 'Rol de la organización') : 'Rol sin definir';
}

export const AUTHORIZED_TECHNICAL_REVIEWER_LABELS = 'Propietario, Administrador o Responsable SST';

export const AUTHORIZED_TECHNICAL_WRITER_LABELS =
  'Propietario, Administrador, Responsable SST, Técnico SST o Consultor';

export const applicabilityStateLabels: Record<string, string> = {
  MANDATORY: 'Obligatorio',
  RECOMMENDED: 'Recomendado',
  OPTIONAL: 'Opcional',
  NOT_APPLICABLE: 'No aplica',
  NEEDS_INFORMATION: 'Falta información',
  NEEDS_EXPERT_REVIEW: 'Requiere revisión profesional',
};

const moduleLabels: Record<string, string> = {
  CORE: 'Gestión SST básica',
  INSPECTIONS_INTELLIGENCE: 'Inspecciones inteligentes',
  TECHNICAL_RISK: 'Evaluación de riesgo técnico',
  WORK_PERMITS: 'Permisos de trabajo',
  PSYCHOSOCIAL: 'Gestión psicosocial',
  COMPLIANCE: 'Gestión regulatoria',
};

export function humanModuleLabel(moduleKey: string): string {
  return moduleLabels[moduleKey] ?? 'Módulo recomendado';
}

export function humanPriorityLabel(priority: string): string {
  return { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' }[priority] ?? 'Media';
}

const operationalPriorityLabels: Record<string, string> = {
  URGENT: 'Urgente',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};

export function humanOperationalPriorityLabel(priority?: string | null): string {
  return priority
    ? (operationalPriorityLabels[priority] ?? 'Prioridad registrada')
    : 'Sin prioridad';
}

const semanticRiskLevelLabels: Record<string, string> = {
  CRITICAL: 'Crítico',
  HIGH: 'Alto',
  MODERATE: 'Moderado',
  MEDIUM: 'Medio',
  LOW: 'Bajo',
};

export function humanRiskLevelLabel(level?: string | null): string {
  return level ? (semanticRiskLevelLabels[level] ?? level) : 'Sin nivel';
}

const moduleAccessStatusLabels: Record<string, string> = {
  ACTIVE: 'Activo',
  TRIAL: 'Prueba temporal',
  DEMO: 'Demostración temporal',
  SUSPENDED: 'Suspendido',
  EXPIRED: 'Vencido',
};

export function humanModuleAccessStatusLabel(status?: string | null): string {
  return status ? (moduleAccessStatusLabels[status] ?? 'Estado registrado') : 'No incluido';
}

const organizationImplementationStatusLabels: Record<string, string> = {
  UNKNOWN: 'Sin información',
  NOT_IMPLEMENTED: 'No implementado',
  PLANNED: 'Planificado',
  IN_PROGRESS: 'En progreso',
  PARTIALLY_IMPLEMENTED: 'Parcialmente implementado',
  IMPLEMENTED: 'Implementado',
};

export function humanOrganizationImplementationStatusLabel(status?: string | null): string {
  return status
    ? (organizationImplementationStatusLabels[status] ?? 'Estado declarado')
    : 'No declarado todavía';
}

const featureLabels: Record<string, string> = {
  'module.inspections': 'Inspecciones inteligentes',
  'module.technical_risk': 'Evaluación de riesgo técnico',
  'module.work_permits': 'Permisos de trabajo',
  'module.psychosocial': 'Gestión psicosocial',
  'module.compliance': 'Gestión regulatoria',
  'organization.max_work_centers': 'Centros de trabajo permitidos',
  'organization.max_members': 'Miembros permitidos',
  'demo.enabled': 'Demostración disponible',
  'demo.duration_days': 'Duración de la demostración (días)',
};

export function humanFeatureLabel(featureKey: string): string {
  return featureLabels[featureKey] ?? 'Capacidad incluida';
}
