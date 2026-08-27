import { FeatureValueType, type Prisma } from '@prisma/client';
import { WORK_PERMITS_FEATURE_KEY } from '../catalog/entitlement';

export const WORK_PERMITS_FEATURE_DEFINITION = {
  key: WORK_PERMITS_FEATURE_KEY,
  description: 'Módulo de permisos',
  valueType: FeatureValueType.BOOLEAN,
} as const;

export async function syncCatalogReferences(prisma: Prisma.TransactionClient) {
  const existing = await prisma.featureDefinition.findUnique({
    where: { key: WORK_PERMITS_FEATURE_DEFINITION.key },
    select: { key: true, description: true, valueType: true },
  });
  if (existing) {
    if (
      existing.description !== WORK_PERMITS_FEATURE_DEFINITION.description ||
      existing.valueType !== WORK_PERMITS_FEATURE_DEFINITION.valueType
    ) {
      throw new Error(`CATALOG_REFERENCE_DRIFT:FEATURE:${WORK_PERMITS_FEATURE_DEFINITION.key}`);
    }
  } else {
    await prisma.featureDefinition.create({ data: WORK_PERMITS_FEATURE_DEFINITION });
  }

  await prisma.planFeature.deleteMany({
    where: { feature: { key: WORK_PERMITS_FEATURE_DEFINITION.key } },
  });

  return { featureDefinitions: 1, planFeatureAssignments: 0 };
}
