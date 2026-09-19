import { ModuleKey, type Prisma } from '@prisma/client';

// Existing public demo entry references. Definitions do not grant entitlements or
// activate modules; demo activation remains an explicit authenticated human act.
export const SOLUTION_ENTRY_MODULES = [
  [
    ModuleKey.INSPECTIONS_INTELLIGENCE,
    'Inspecciones inteligentes',
    'Centraliza hallazgos y recurrencias.',
  ],
  [
    ModuleKey.TECHNICAL_RISK,
    'Riesgo técnico',
    'Presenta controles e indicadores técnicos sintéticos.',
  ],
  [
    ModuleKey.WORK_PERMITS,
    'Permisos de trabajo',
    'Prepara la trazabilidad de actividades críticas.',
  ],
  [
    ModuleKey.PSYCHOSOCIAL,
    'Gestión psicosocial',
    'Organiza campañas y seguimiento agregado no clínico.',
  ],
  [ModuleKey.COMPLIANCE, 'Cumplimiento', 'Ordena evidencias, compromisos y reportería.'],
] as const;

export const SOLUTION_ENTRY_FLOW = {
  key: 'solution-finder',
  version: '1.0.0',
  schema: { steps: ['company', 'operation', 'management', 'people', 'objectives', 'commercial'] },
} satisfies Prisma.GuidedFlowDefinitionCreateInput;

export async function syncSolutionEntryReferences(prisma: Prisma.TransactionClient) {
  await prisma.guidedFlowDefinition.upsert({
    where: { key_version: { key: SOLUTION_ENTRY_FLOW.key, version: SOLUTION_ENTRY_FLOW.version } },
    create: SOLUTION_ENTRY_FLOW,
    // Preserve configured content and activation state on existing deployments.
    update: {},
  });
  for (const [index, [key, name, description]] of SOLUTION_ENTRY_MODULES.entries()) {
    await prisma.moduleDefinition.upsert({
      where: { key },
      create: {
        key,
        name,
        description,
        objective: description,
        sortOrder: index + 1,
        demoContent: {
          label: 'Demostración conceptual',
          indicators: [
            { label: 'Registros sintéticos', value: 12 },
            { label: 'Seguimiento de ejemplo', value: '83%' },
          ],
        },
      },
      update: {},
    });
  }
  return { flowDefinitions: 1, moduleDefinitions: SOLUTION_ENTRY_MODULES.length };
}
