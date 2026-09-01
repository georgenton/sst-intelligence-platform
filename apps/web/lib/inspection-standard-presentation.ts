import type { InspectionDomainKey } from '@sst/contracts';

export const INSPECTION_DOMAINS = [
  'ELECTRICAL',
  'FIRE_PROTECTION',
  'MACHINERY',
  'CHEMICAL_STORAGE',
  'EMERGENCY',
  'INFRASTRUCTURE',
] as const satisfies readonly InspectionDomainKey[];

export const INSPECTION_DOMAIN_LABELS: Record<InspectionDomainKey, string> = {
  ELECTRICAL: 'Instalaciones eléctricas',
  FIRE_PROTECTION: 'Protección contra incendios',
  MACHINERY: 'Maquinaria',
  CHEMICAL_STORAGE: 'Almacenamiento de sustancias químicas',
  EMERGENCY: 'Emergencias',
  INFRASTRUCTURE: 'Infraestructura',
};

export type InspectionStandardRightsType =
  | 'PUBLIC_OFFICIAL'
  | 'LICENSED'
  | 'CUSTOMER_PROVIDED'
  | 'REFERENCE_ONLY'
  | 'INTERNAL_ORGANIZATION_STANDARD'
  | 'DEMO_SYNTHETIC';

export const INSPECTION_STANDARD_RIGHTS_LABELS: Record<InspectionStandardRightsType, string> = {
  PUBLIC_OFFICIAL: 'Fuente oficial pública',
  LICENSED: 'Contenido licenciado',
  CUSTOMER_PROVIDED: 'Proporcionado por la organización',
  REFERENCE_ONLY: 'Solo referencia',
  INTERNAL_ORGANIZATION_STANDARD: 'Estándar interno de la organización',
  DEMO_SYNTHETIC: 'Demostración conceptual',
};

export type InspectionCriterionOutcome = 'CONFORME' | 'NO_CONFORME' | 'NO_APLICA' | 'NO_VERIFICADO';

export const INSPECTION_CRITERION_OUTCOME_LABELS: Record<InspectionCriterionOutcome, string> = {
  CONFORME: 'Conforme',
  NO_CONFORME: 'No conforme',
  NO_APLICA: 'No aplica',
  NO_VERIFICADO: 'No verificado',
};
