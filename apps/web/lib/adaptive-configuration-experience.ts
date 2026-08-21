export const ADAPTIVE_DEMO_NOTICE =
  'Esta experiencia usa reglas sintéticas de demostración. No representa todavía normativa ecuatoriana real ni acredita cumplimiento legal.';

export const adaptiveSessionStatusLabel: Record<string, string> = {
  COLLECTING_INFORMATION: 'Recopilando información',
  READY_TO_PROPOSE: 'Propuesta disponible',
  FINALIZED: 'Finalizada',
  CANCELLED: 'Cancelada',
};

export const adaptiveDepthLabel: Record<string, string> = {
  BASIC_VISIBLE: 'Básico / visible',
  TECHNICAL: 'Técnico',
  SYSTEMIC: 'Sistémico',
  UNDETERMINED: 'Por determinar',
};

export const adaptiveStateLabel: Record<string, string> = {
  MANDATORY: 'El motor demo dice que sí corresponde',
  RECOMMENDED: 'El motor demo recomienda considerarlo',
  OPTIONAL: 'El motor demo lo presenta como opcional',
  NOT_APPLICABLE: 'El motor demo dice que no corresponde en este caso',
  NEEDS_INFORMATION: 'Falta información para resolver',
  NEEDS_EXPERT_REVIEW: 'Necesita criterio profesional',
};

export const adaptiveCurrentStateOptions = [
  ['UNKNOWN', 'No sabemos'],
  ['NOT_IMPLEMENTED', 'No lo tiene'],
  ['PLANNED', 'Lo tiene planificado'],
  ['IN_PROGRESS', 'Lo está implementando'],
  ['PARTIALLY_IMPLEMENTED', 'Lo tiene parcialmente'],
  ['IMPLEMENTED', 'Lo tiene implementado'],
] as const;

export function canManageAdaptiveConfiguration(role: string | undefined) {
  return role === 'ORG_OWNER' || role === 'ORG_ADMIN' || role === 'SST_MANAGER';
}

export function adaptiveMutationMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No pudimos guardar el cambio.';
}
