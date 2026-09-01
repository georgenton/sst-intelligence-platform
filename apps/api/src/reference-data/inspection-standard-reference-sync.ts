import type { Prisma } from '@prisma/client';
import { adaptiveContentHash } from '@sst/contracts';
import {
  INSPECTION_STANDARD_MANIFESTS,
  inspectionStandardManifestDigest,
} from '../inspection-standards/inspection-standard-reference-data';

function drift(label: string): never {
  throw new Error(`INSPECTION_STANDARD_REFERENCE_DRIFT:${label}`);
}

function assertSame(label: string, actual: unknown, expected: unknown) {
  if (adaptiveContentHash(actual) !== adaptiveContentHash(expected)) drift(label);
}

export async function syncInspectionStandardReferences(prisma: Prisma.TransactionClient) {
  for (const manifest of INSPECTION_STANDARD_MANIFESTS) {
    const rightsType = manifest.source.rightsType ?? 'DEMO_SYNTHETIC';
    const versionStatus = manifest.version.status ?? 'AVAILABLE';
    const versionMetadata = manifest.version.metadata
      ? { domain: manifest.version.domain, ...manifest.version.metadata }
      : { domain: manifest.version.domain, synthetic: true };
    const source = await prisma.inspectionStandardSource.upsert({
      where: { code: manifest.source.code },
      update: {},
      create: {
        id: manifest.source.id,
        code: manifest.source.code,
        name: manifest.source.name,
        publisher: manifest.source.publisher,
        originCountry: manifest.source.originCountry,
        referenceUrl: manifest.source.referenceUrl,
        rightsType,
        sourceType: 'GLOBAL_REFERENCE',
        status: 'ACTIVE',
      },
    });
    if (source.id !== manifest.source.id) drift(`${manifest.source.code}:IDENTITY`);
    assertSame(
      `${manifest.source.code}:SOURCE`,
      {
        organizationId: source.organizationId,
        name: source.name,
        publisher: source.publisher,
        originCountry: source.originCountry,
        referenceUrl: source.referenceUrl,
        rightsType: source.rightsType,
        sourceType: source.sourceType,
        status: source.status,
      },
      {
        organizationId: null,
        name: manifest.source.name,
        publisher: manifest.source.publisher,
        originCountry: manifest.source.originCountry ?? null,
        referenceUrl: manifest.source.referenceUrl ?? null,
        rightsType,
        sourceType: 'GLOBAL_REFERENCE',
        status: 'ACTIVE',
      },
    );

    const version = await prisma.inspectionStandardVersion.upsert({
      where: {
        sourceId_versionCode: { sourceId: source.id, versionCode: manifest.version.versionCode },
      },
      update: {},
      create: {
        id: manifest.version.id,
        sourceId: source.id,
        versionCode: manifest.version.versionCode,
        editionLabel: manifest.version.editionLabel,
        status: versionStatus,
        contentDigest: inspectionStandardManifestDigest(manifest),
        metadata: versionMetadata,
      },
    });
    if (version.id !== manifest.version.id) drift(`${manifest.source.code}:VERSION_IDENTITY`);
    assertSame(
      `${manifest.source.code}:VERSION`,
      {
        editionLabel: version.editionLabel,
        status: version.status,
        contentDigest: version.contentDigest,
        metadata: version.metadata,
      },
      {
        editionLabel: manifest.version.editionLabel,
        status: versionStatus,
        contentDigest: inspectionStandardManifestDigest(manifest),
        metadata: versionMetadata,
      },
    );

    const section = await prisma.inspectionStandardSection.upsert({
      where: {
        standardVersionId_code: {
          standardVersionId: version.id,
          code: manifest.section.code,
        },
      },
      update: {},
      create: { ...manifest.section, standardVersionId: version.id },
    });
    if (section.id !== manifest.section.id) drift(`${manifest.source.code}:SECTION_IDENTITY`);
    assertSame(
      `${manifest.source.code}:SECTION`,
      {
        title: section.title,
        displayOrder: section.displayOrder,
        parentSectionId: section.parentSectionId,
      },
      {
        title: manifest.section.title,
        displayOrder: manifest.section.displayOrder,
        parentSectionId: null,
      },
    );

    for (const criterion of manifest.criteria) {
      const contentDigest = adaptiveContentHash({
        code: criterion.code,
        title: criterion.title,
        guidance: criterion.guidance,
        evidenceExpectation: criterion.evidenceExpectation ?? null,
        displayOrder: criterion.displayOrder,
        notApplicableAllowed: criterion.notApplicableAllowed,
        required: criterion.required,
        ...(criterion.sourceLocator ? { sourceLocator: criterion.sourceLocator } : {}),
      });
      const row = await prisma.inspectionStandardCriterion.upsert({
        where: {
          standardVersionId_code: { standardVersionId: version.id, code: criterion.code },
        },
        update: {},
        create: {
          ...criterion,
          standardVersionId: version.id,
          sectionId: section.id,
          contentDigest,
        },
      });
      if (row.id !== criterion.id) drift(`${manifest.source.code}:${criterion.code}:IDENTITY`);
      assertSame(
        `${manifest.source.code}:${criterion.code}`,
        {
          title: row.title,
          guidance: row.guidance,
          evidenceExpectation: row.evidenceExpectation,
          sourceLocator: row.sourceLocator,
          displayOrder: row.displayOrder,
          notApplicableAllowed: row.notApplicableAllowed,
          required: row.required,
          contentDigest: row.contentDigest,
        },
        {
          title: criterion.title,
          guidance: criterion.guidance,
          evidenceExpectation: criterion.evidenceExpectation ?? null,
          sourceLocator: criterion.sourceLocator ?? null,
          displayOrder: criterion.displayOrder,
          notApplicableAllowed: criterion.notApplicableAllowed,
          required: criterion.required,
          contentDigest,
        },
      );
    }
    const counts = await prisma.inspectionStandardCriterion.count({
      where: { standardVersionId: version.id },
    });
    if (counts !== manifest.criteria.length) drift(`${manifest.source.code}:CRITERIA_COUNT`);
  }

  return {
    inspectionStandardSources: await prisma.inspectionStandardSource.count({
      where: { sourceType: 'GLOBAL_REFERENCE' },
    }),
    inspectionStandardVersions: await prisma.inspectionStandardVersion.count({
      where: { source: { sourceType: 'GLOBAL_REFERENCE' } },
    }),
    inspectionStandardCriteria: await prisma.inspectionStandardCriterion.count({
      where: { standardVersion: { source: { sourceType: 'GLOBAL_REFERENCE' } } },
    }),
  };
}
