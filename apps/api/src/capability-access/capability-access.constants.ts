import { ModuleKey } from '@prisma/client';

export type CapabilityAccessKey =
  | 'WORKFORCE'
  | 'INSPECTIONS'
  | 'TECHNICAL_RISK'
  | 'INCIDENTS'
  | 'PPE'
  | 'TRAINING'
  | 'GOVERNANCE'
  | 'WORK_PERMITS';

export type CapabilityAccessDefinition = {
  capabilityKey: CapabilityAccessKey;
  title: string;
  description: string;
  moduleKey: ModuleKey | null;
  featureKey: string | null;
  href: string;
  demoEligible: boolean;
};

export const CAPABILITY_ACCESS_MAP: readonly CapabilityAccessDefinition[] = [
  {
    capabilityKey: 'WORKFORCE',
    title: 'Personas y trabajadores',
    description: 'Base operativa de personas, cargos y centros de trabajo.',
    moduleKey: null,
    featureKey: null,
    href: '/app/workers',
    demoEligible: false,
  },
  {
    capabilityKey: 'INSPECTIONS',
    title: 'Inspecciones inteligentes',
    description: 'Inspecciones, hallazgos, acciones y seguimiento.',
    moduleKey: ModuleKey.INSPECTIONS_INTELLIGENCE,
    featureKey: 'module.inspections',
    href: '/app/inspections',
    demoEligible: true,
  },
  {
    capabilityKey: 'TECHNICAL_RISK',
    title: 'Evaluación de riesgo técnico',
    description: 'Metodologías técnicas versionadas para peligros confirmados.',
    moduleKey: ModuleKey.TECHNICAL_RISK,
    featureKey: 'module.technical_risk',
    href: '/app/technical-risk',
    demoEligible: true,
  },
  {
    capabilityKey: 'INCIDENTS',
    title: 'Accidentes e incidentes',
    description: 'Eventos, personas involucradas, evidencia y seguimiento.',
    moduleKey: ModuleKey.INCIDENTS,
    featureKey: 'module.incidents',
    href: '/app/incidents',
    demoEligible: true,
  },
  {
    capabilityKey: 'PPE',
    title: 'Equipos de protección personal',
    description: 'Requisitos, entregas, reemplazos y trazabilidad de EPP.',
    moduleKey: ModuleKey.PPE,
    featureKey: 'module.ppe',
    href: '/app/ppe',
    demoEligible: true,
  },
  {
    capabilityKey: 'TRAINING',
    title: 'Capacitación y competencia',
    description: 'Necesidades, sesiones y seguimiento de competencias.',
    moduleKey: ModuleKey.TRAINING,
    featureKey: 'module.training',
    href: '/app/training',
    demoEligible: true,
  },
  {
    capabilityKey: 'GOVERNANCE',
    title: 'Gobernanza SST',
    description: 'Responsabilidades, decisiones, revisiones y evidencia.',
    moduleKey: null,
    featureKey: null,
    href: '/app/governance',
    demoEligible: false,
  },
  {
    capabilityKey: 'WORK_PERMITS',
    title: 'Permisos de trabajo',
    description: 'Trabajos críticos con autorización y evidencia trazable.',
    moduleKey: ModuleKey.WORK_PERMITS,
    featureKey: 'module.work_permits',
    href: '/app/work-permits',
    demoEligible: true,
  },
] as const;

export const CAPABILITY_ACCESS_BY_KEY = new Map(
  CAPABILITY_ACCESS_MAP.map((definition) => [definition.capabilityKey, definition]),
);
