import { FeatureValueType, type Prisma } from '@prisma/client';
import {
  INCIDENTS_FEATURE_KEY,
  PPE_FEATURE_KEY,
  TRAINING_FEATURE_KEY,
  WORK_PERMITS_FEATURE_KEY,
} from '../catalog/entitlement';

export const PREVIEW_FEATURE_DEFINITIONS = [
  {
    key: WORK_PERMITS_FEATURE_KEY,
    description: 'Módulo de permisos',
    valueType: FeatureValueType.BOOLEAN,
  },
  {
    key: INCIDENTS_FEATURE_KEY,
    description: 'Módulo de incidentes',
    valueType: FeatureValueType.BOOLEAN,
  },
  {
    key: PPE_FEATURE_KEY,
    description: 'Módulo de EPP',
    valueType: FeatureValueType.BOOLEAN,
  },
  {
    key: TRAINING_FEATURE_KEY,
    description: 'Módulo de capacitación',
    valueType: FeatureValueType.BOOLEAN,
  },
] as const;

export async function syncCatalogReferences(prisma: Prisma.TransactionClient) {
  for (const definition of PREVIEW_FEATURE_DEFINITIONS) {
    const existing = await prisma.featureDefinition.findUnique({
      where: { key: definition.key },
      select: { key: true, description: true, valueType: true },
    });
    if (existing) {
      if (
        existing.description !== definition.description ||
        existing.valueType !== definition.valueType
      ) {
        throw new Error(`CATALOG_REFERENCE_DRIFT:FEATURE:${definition.key}`);
      }
    } else {
      await prisma.featureDefinition.create({ data: definition });
    }
  }

  await prisma.planFeature.deleteMany({
    where: { feature: { key: { in: PREVIEW_FEATURE_DEFINITIONS.map(({ key }) => key) } } },
  });

  return { featureDefinitions: PREVIEW_FEATURE_DEFINITIONS.length, planFeatureAssignments: 0 };
}
