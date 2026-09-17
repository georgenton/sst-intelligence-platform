import { FeatureValueType, ModuleKey, PlanKey, type Prisma } from '@prisma/client';

// These are the existing seed's normal organization defaults, shared with the release.
export const ORGANIZATION_BASELINE_PLAN = {
  key: PlanKey.FREE,
  name: 'Free',
  description: 'Exploración y diagnóstico inicial.',
  sortOrder: 0,
};

export const ORGANIZATION_BASELINE_MODULE = {
  key: ModuleKey.CORE,
  name: 'Núcleo SST',
  description: 'Organización, acceso, evidencias y trazabilidad común.',
  objective: 'Organización, acceso, evidencias y trazabilidad común.',
  sortOrder: 0,
  demoContent: {
    label: 'Demostración conceptual',
    indicators: [
      { label: 'Registros sintéticos', value: 12 },
      { label: 'Seguimiento de ejemplo', value: '83%' },
    ],
  },
} satisfies Prisma.ModuleDefinitionCreateInput;

export const ORGANIZATION_BASELINE_FEATURES = [
  ['organization.max_work_centers', 'Máximo de centros de trabajo', FeatureValueType.INTEGER, '1'],
  ['organization.max_members', 'Máximo de miembros', FeatureValueType.INTEGER, '2'],
  ['demo.enabled', 'Permite activar demostración', FeatureValueType.BOOLEAN, 'true'],
  ['demo.duration_days', 'Duración de demostración', FeatureValueType.INTEGER, '14'],
  ['ai.monthly_actions', 'Acciones mensuales de IA', FeatureValueType.INTEGER, '0'],
  ['module.inspections', 'Módulo de inspecciones', FeatureValueType.BOOLEAN, 'false'],
  ['module.technical_risk', 'Módulo de riesgo técnico', FeatureValueType.BOOLEAN, 'false'],
  ['module.psychosocial', 'Módulo psicosocial', FeatureValueType.BOOLEAN, 'false'],
  ['module.compliance', 'Módulo de cumplimiento', FeatureValueType.BOOLEAN, 'false'],
] as const;

export const ORGANIZATION_BASELINE_VALUES = Object.fromEntries(
  ORGANIZATION_BASELINE_FEATURES.map(([key, , , value]) => [key, value]),
);

export async function syncOrganizationBaseline(prisma: Prisma.TransactionClient) {
  const plan = await prisma.plan.upsert({
    where: { key: ORGANIZATION_BASELINE_PLAN.key },
    create: ORGANIZATION_BASELINE_PLAN,
    update: {},
    select: { id: true },
  });
  await prisma.moduleDefinition.upsert({
    where: { key: ORGANIZATION_BASELINE_MODULE.key },
    create: ORGANIZATION_BASELINE_MODULE,
    update: {},
  });
  for (const [key, description, valueType, value] of ORGANIZATION_BASELINE_FEATURES) {
    const feature = await prisma.featureDefinition.upsert({
      where: { key },
      create: { key, description, valueType },
      update: {},
      select: { id: true, valueType: true },
    });
    if (feature.valueType !== valueType) {
      throw new Error(`CATALOG_REFERENCE_DRIFT:FEATURE_TYPE:${key}`);
    }
    await prisma.planFeature.upsert({
      where: { planId_featureId: { planId: plan.id, featureId: feature.id } },
      create: { planId: plan.id, featureId: feature.id, value },
      update: {},
    });
  }
  return { plans: 1, modules: 1, features: ORGANIZATION_BASELINE_FEATURES.length };
}
