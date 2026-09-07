import type { Prisma } from '@prisma/client';
import { adaptiveContentHash } from '@sst/contracts';
import {
  ELECTRICAL_RESOURCE_MANIFEST,
  ELECTRICAL_RESOURCE_MAPPINGS,
  electricalResourceDigest,
} from '../inspection-resources/inspection-resource-reference-data';

function drift(label: string): never {
  throw new Error(`INSPECTION_RESOURCE_REFERENCE_DRIFT:${label}`);
}

export async function syncInspectionResourceReferences(prisma: Prisma.TransactionClient) {
  const { taxonomy, resources } = ELECTRICAL_RESOURCE_MANIFEST;
  const taxonomyRow = await prisma.inspectionResourceTaxonomy.upsert({
    where: { code: taxonomy.code },
    update: {},
    create: {
      id: taxonomy.id,
      code: taxonomy.code,
      inspectionDomain: taxonomy.inspectionDomain,
      name: taxonomy.name,
    },
  });
  if (taxonomyRow.id !== taxonomy.id || taxonomyRow.organizationId !== null) drift('TAXONOMY');
  const version = await prisma.inspectionResourceTaxonomyVersion.upsert({
    where: { taxonomyId_version: { taxonomyId: taxonomy.id, version: taxonomy.version } },
    update: {},
    create: {
      id: taxonomy.versionId,
      taxonomyId: taxonomy.id,
      version: taxonomy.version,
      status: 'ACTIVE',
      activatedAt: new Date('2026-09-07T00:00:00.000Z'),
      contentDigest: electricalResourceDigest(),
    },
  });
  if (version.id !== taxonomy.versionId || version.contentDigest !== electricalResourceDigest())
    drift('TAXONOMY_VERSION');

  for (const resource of resources) {
    const row = await prisma.inspectionResource.upsert({
      where: {
        taxonomyVersionId_code: { taxonomyVersionId: version.id, code: resource.code },
      },
      update: {},
      create: { ...resource, taxonomyVersionId: version.id, parentId: resource.parentId ?? null },
    });
    if (
      row.id !== resource.id ||
      adaptiveContentHash({
        code: row.code,
        name: row.name,
        level: row.level,
        displayOrder: row.displayOrder,
      }) !==
        adaptiveContentHash({
          code: resource.code,
          name: resource.name,
          level: resource.level,
          displayOrder: resource.displayOrder,
        })
    )
      drift(`RESOURCE:${resource.code}`);
  }

  let mappingCount = 0;
  for (const mappingManifest of ELECTRICAL_RESOURCE_MAPPINGS) {
    const criteria = await prisma.inspectionStandardCriterion.findMany({
      where: { standardVersionId: mappingManifest.standardVersionId },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    if (!criteria.length) drift(`MAPPING_STANDARD_EMPTY:${mappingManifest.standardVersionId}`);
    const mappingRows = resources.flatMap((resource) =>
      criteria.map((criterion, index) => ({
        resourceId: resource.id,
        criterionId: criterion.id,
        displayOrder: index + 1,
      })),
    );
    const mappingDigest = adaptiveContentHash({
      taxonomyVersionId: version.id,
      standardVersionId: mappingManifest.standardVersionId,
      version: mappingManifest.version,
      mappings: mappingRows,
    });
    const mapping = await prisma.inspectionResourceCriterionMappingVersion.upsert({
      where: {
        taxonomyVersionId_standardVersionId_version: {
          taxonomyVersionId: version.id,
          standardVersionId: mappingManifest.standardVersionId,
          version: mappingManifest.version,
        },
      },
      update: {},
      create: {
        id: mappingManifest.id,
        taxonomyVersionId: version.id,
        standardVersionId: mappingManifest.standardVersionId,
        version: mappingManifest.version,
        status: 'ACTIVE',
        activatedAt: new Date('2026-09-07T00:00:00.000Z'),
        contentDigest: mappingDigest,
      },
    });
    if (mapping.id !== mappingManifest.id || mapping.contentDigest !== mappingDigest)
      drift(`MAPPING_VERSION:${mappingManifest.standardVersionId}`);
    for (const row of mappingRows) {
      await prisma.inspectionResourceCriterionMapping.upsert({
        where: {
          mappingVersionId_resourceId_criterionId: {
            mappingVersionId: mapping.id,
            resourceId: row.resourceId,
            criterionId: row.criterionId,
          },
        },
        update: {},
        create: { ...row, mappingVersionId: mapping.id },
      });
    }
    const counts = await prisma.inspectionResourceCriterionMapping.count({
      where: { mappingVersionId: mapping.id },
    });
    if (counts !== mappingRows.length) drift(`MAPPING_COUNT:${mappingManifest.standardVersionId}`);
    mappingCount += counts;
  }
  return {
    inspectionResourceTaxonomies: 1,
    inspectionResources: resources.length,
    inspectionResourceMappings: mappingCount,
  };
}
