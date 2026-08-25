import type {
  ApplicabilityRulePack,
  ApplicabilityState,
  OrganizationSstProfile,
  PredicateResult,
} from '@sst/contracts';

export const APPLICABILITY_ADMIN_ROLES = ['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER'] as const;

export const DEMO_APPLICABILITY_DISCLAIMER =
  'Reglas sintéticas de demostración. No representan normativa ni acreditan cumplimiento legal.';

type StateTone = 'demo' | 'positive' | 'neutral' | 'information' | 'attention' | 'expert';

export type ApplicabilityStateMeta = {
  label: string;
  description: string;
  symbol: string;
  tone: StateTone;
};

const STATE_PRESENTATION: Record<ApplicabilityState, ApplicabilityStateMeta> = {
  MANDATORY: {
    label: 'Obligatorio en esta demostración',
    description: 'Las reglas sintéticas seleccionadas asignaron este estado demostrativo.',
    symbol: '◆',
    tone: 'demo',
  },
  RECOMMENDED: {
    label: 'Recomendado',
    description: 'Las reglas de la demostración presentan esta propuesta.',
    symbol: '●',
    tone: 'positive',
  },
  OPTIONAL: {
    label: 'Opcional',
    description: 'La demostración identifica esta alternativa como opcional.',
    symbol: '○',
    tone: 'neutral',
  },
  NOT_APPLICABLE: {
    label: 'No aplica en esta demostración',
    description: 'No aplica según las reglas sintéticas de esta evaluación.',
    symbol: '—',
    tone: 'neutral',
  },
  NEEDS_INFORMATION: {
    label: 'Falta información',
    description: 'La evaluación necesita uno o más datos del perfil para resolver este resultado.',
    symbol: '?',
    tone: 'information',
  },
  NEEDS_EXPERT_REVIEW: {
    label: 'Requiere revisión profesional',
    description:
      'El escenario debe ser analizado por una persona profesional; no existe aprobación en este flujo.',
    symbol: '!',
    tone: 'expert',
  },
};

export function applicabilityStateMeta(state: ApplicabilityState): ApplicabilityStateMeta {
  return STATE_PRESENTATION[state];
}

export function canManageApplicability(role?: string): boolean {
  return APPLICABILITY_ADMIN_ROLES.includes(role as (typeof APPLICABILITY_ADMIN_ROLES)[number]);
}

export type TriStateInput = 'YES' | 'NO' | 'UNKNOWN';

export type SstProfileFormValues = {
  workerCount: string;
  hasChemicalProcesses: TriStateInput;
  hasHighEnergyOperations: TriStateInput;
};

export type CreateSstProfilePayload = {
  workerCount?: number;
  hasChemicalProcesses?: boolean;
  hasHighEnergyOperations?: boolean;
};

export function buildSstProfilePayload(values: SstProfileFormValues): CreateSstProfilePayload {
  return {
    ...(values.workerCount.trim() === '' ? {} : { workerCount: Number(values.workerCount) }),
    ...(values.hasChemicalProcesses === 'UNKNOWN'
      ? {}
      : { hasChemicalProcesses: values.hasChemicalProcesses === 'YES' }),
    ...(values.hasHighEnergyOperations === 'UNKNOWN'
      ? {}
      : { hasHighEnergyOperations: values.hasHighEnergyOperations === 'YES' }),
  };
}

export function profileMutationError(error: unknown): string {
  const status = (error as { status?: number }).status;
  if (status === 400) return 'Revisa los datos del perfil. La versión no fue creada.';
  if (status === 403) return 'Tu rol permite consultar, pero no crear versiones del perfil SST.';
  if (status === 404) return 'La organización o versión seleccionada ya no está disponible.';
  if (status === 409)
    return 'Otra versión fue creada al mismo tiempo. Recarga el historial antes de intentarlo de nuevo.';
  return 'No pudimos completar la operación. Los datos del formulario permanecen disponibles.';
}

export function formatApplicabilityDate(value?: string | null): string {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function profileFactLabel(value: string | number | boolean | undefined): string {
  if (value === undefined) return 'Sin información';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return String(value);
}

export function predicateValueLabel(
  value: string | number | boolean | readonly (string | number)[] | null,
): string {
  if (value === null) return 'Sin información';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return String(value);
}

export function predicateResultLabel(result: PredicateResult): string {
  if (result === 'TRUE') return 'La condición coincidió';
  if (result === 'FALSE') return 'La condición no coincidió';
  return 'Sin información';
}

const TARGET_LABELS: Record<string, string> = {
  DEMO_BASELINE_MANAGEMENT: 'Gestión base demostrativa',
  DEMO_MULTI_SITE_COORDINATION: 'Coordinación entre centros',
  DEMO_SECTOR_GUIDANCE: 'Orientación por sector',
  DEMO_CHEMICAL_CONTROL: 'Control de procesos químicos',
  DEMO_HIGH_ENERGY_REVIEW: 'Revisión de operaciones de alta energía',
  DEMO_WORKFORCE_GUIDANCE: 'Orientación por tamaño de plantilla',
};

export function applicabilityTargetLabel(targetKey: string): string {
  return TARGET_LABELS[targetKey] ?? targetKey;
}

export function profileFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    'organization.country': 'País',
    'organization.sector': 'Sector',
    'organization.workCenterCount': 'Centros de trabajo',
    'organization.workerCount': 'Personas trabajadoras',
    'operations.hasChemicalProcesses': 'Procesos químicos',
    'operations.hasHighEnergyOperations': 'Operaciones de alta energía',
  };
  return labels[field] ?? field;
}

export function summarizeDecisionStates(
  decisions: readonly { state: ApplicabilityState }[],
): Partial<Record<ApplicabilityState, number>> {
  const counts: Partial<Record<ApplicabilityState, number>> = {};
  for (const decision of decisions) counts[decision.state] = (counts[decision.state] ?? 0) + 1;
  return counts;
}

export function assessmentSnapshotPresentation(assessment: {
  profileSnapshot: OrganizationSstProfile;
  rulePackSnapshot: ApplicabilityRulePack;
}) {
  return {
    profile: assessment.profileSnapshot,
    rulePack: {
      key: assessment.rulePackSnapshot.key,
      name: assessment.rulePackSnapshot.name,
      version: assessment.rulePackSnapshot.version,
      sourceType: assessment.rulePackSnapshot.source.type,
      sourceReference: assessment.rulePackSnapshot.source.reference,
      regulatory: assessment.rulePackSnapshot.regulatory,
      isDemo: assessment.rulePackSnapshot.isDemo,
      disclaimer: assessment.rulePackSnapshot.disclaimer,
    },
  };
}
