import { z } from 'zod';

export const INSPECTION_DOMAINS = [
  'ELECTRICAL',
  'FIRE_PROTECTION',
  'MACHINERY',
  'CHEMICAL_STORAGE',
  'EMERGENCY',
  'INFRASTRUCTURE',
] as const;

export type InspectionDomainKey = (typeof INSPECTION_DOMAINS)[number];

export const INSPECTION_DOMAIN_LABELS: Record<InspectionDomainKey, string> = {
  ELECTRICAL: 'Instalaciones eléctricas',
  FIRE_PROTECTION: 'Protección contra incendios',
  MACHINERY: 'Maquinaria',
  CHEMICAL_STORAGE: 'Almacenamiento de sustancias químicas',
  EMERGENCY: 'Emergencias',
  INFRASTRUCTURE: 'Infraestructura',
};

export const INSPECTION_STANDARD_RIGHTS_TYPES = [
  'PUBLIC_OFFICIAL',
  'LICENSED',
  'CUSTOMER_PROVIDED',
  'REFERENCE_ONLY',
  'INTERNAL_ORGANIZATION_STANDARD',
  'DEMO_SYNTHETIC',
] as const;

export const INSPECTION_STANDARD_RIGHTS_LABELS: Record<
  (typeof INSPECTION_STANDARD_RIGHTS_TYPES)[number],
  string
> = {
  PUBLIC_OFFICIAL: 'Fuente oficial pública',
  LICENSED: 'Contenido licenciado',
  CUSTOMER_PROVIDED: 'Proporcionado por la organización',
  REFERENCE_ONLY: 'Solo referencia',
  INTERNAL_ORGANIZATION_STANDARD: 'Estándar interno de la organización',
  DEMO_SYNTHETIC: 'Demostración conceptual',
};

export const INSPECTION_CRITERION_OUTCOMES = [
  'CONFORME',
  'NO_CONFORME',
  'NO_APLICA',
  'NO_VERIFICADO',
] as const;

export const INSPECTION_CRITERION_OUTCOME_LABELS: Record<
  (typeof INSPECTION_CRITERION_OUTCOMES)[number],
  string
> = {
  CONFORME: 'Conforme',
  NO_CONFORME: 'No conforme',
  NO_APLICA: 'No aplica',
  NO_VERIFICADO: 'No verificado',
};

export const inspectionStandardPolicyInputSchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
  bindings: z
    .array(
      z.object({
        inspectionDomain: z.enum(INSPECTION_DOMAINS),
        standardVersionId: z.string().uuid(),
      }),
    )
    .min(1)
    .max(INSPECTION_DOMAINS.length)
    .superRefine((bindings, context) => {
      const domains = bindings.map(({ inspectionDomain }) => inspectionDomain);
      if (new Set(domains).size !== domains.length) {
        context.addIssue({ code: 'custom', message: 'Cada dominio solo puede tener un estándar.' });
      }
    }),
});

export const inspectionCriterionResultInputSchema = z
  .object({
    outcome: z.enum(INSPECTION_CRITERION_OUTCOMES),
    note: z.string().trim().max(2000).optional(),
    evidenceReferences: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  })
  .superRefine((input, context) => {
    if (input.outcome === 'NO_CONFORME' && !input.note) {
      context.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'Describe la condición observada cuando el criterio no es conforme.',
      });
    }
  });

export function canUseCriterionOutcome(
  outcome: (typeof INSPECTION_CRITERION_OUTCOMES)[number],
  notApplicableAllowed: boolean,
) {
  return outcome !== 'NO_APLICA' || notApplicableAllowed;
}

export function nextInspectionStandardPolicyVersion(currentVersion: number | null) {
  return (currentVersion ?? 0) + 1;
}
