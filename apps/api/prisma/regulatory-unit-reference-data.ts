import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  adaptiveContentHash,
  auditRegulatoryUnitCoverage,
  regulatoryUnitRecordSchema,
  type RegulatoryUnitRecord,
} from '@sst/contracts';
import {
  assertRegulatoryRuntimeResources,
  REGULATORY_EVIDENCE_DIRECTORY,
} from '../src/reference-data/regulatory-resource-path';

type DatabaseClient = Prisma.TransactionClient | PrismaClient;

type RegulatoryUnitEvidenceFile = {
  sourceKey: string;
  sourceVersionId: string;
  officialDocumentSha256: string;
  officialUrl: string;
  pageCount: number;
  textExtractionStatus: 'COMPLETE';
  expectedIdentifiers: string[];
  units: RegulatoryUnitRecord[];
};

export function loadRegulatoryUnitReferenceData() {
  assertRegulatoryRuntimeResources();
  const directory = REGULATORY_EVIDENCE_DIRECTORY;
  const index = JSON.parse(readFileSync(resolve(directory, 'index.json'), 'utf8')) as {
    corpusKey: string;
    version: string;
    sources: Array<{
      sourceKey: string;
      file: string;
      sourceVersionId: string;
      expectedUnitCount: number;
      articleCount: number;
      pageCount: number;
    }>;
  };
  if (index.corpusKey !== 'ECUADOR_OFFICIAL_REGULATORY_UNITS_V1' || index.version !== '1.0.0')
    throw new Error('REGULATORY_UNIT_EVIDENCE_INDEX_INVALID');
  return index.sources.map((entry) => {
    const raw = JSON.parse(
      readFileSync(resolve(directory, entry.file), 'utf8'),
    ) as RegulatoryUnitEvidenceFile;
    const units = raw.units.map((unit) => regulatoryUnitRecordSchema.parse(unit));
    if (
      raw.sourceKey !== entry.sourceKey ||
      raw.sourceVersionId !== entry.sourceVersionId ||
      raw.pageCount !== entry.pageCount ||
      units.length !== entry.expectedUnitCount ||
      units.filter(({ unitType }) => unitType === 'ARTICLE').length !== entry.articleCount
    )
      throw new Error(`REGULATORY_UNIT_EVIDENCE_INDEX_DRIFT:${entry.sourceKey}`);
    const coverage = auditRegulatoryUnitCoverage(units, raw.expectedIdentifiers);
    if (!coverage.complete)
      throw new Error(`REGULATORY_UNIT_COVERAGE_INCOMPLETE:${entry.sourceKey}`);
    return { ...raw, units, coverage };
  });
}

function unitProjection(unit: RegulatoryUnitRecord) {
  return {
    id: unit.id,
    sourceVersionId: unit.sourceVersionId,
    parentUnitId: unit.parentUnitId,
    unitType: unit.unitType,
    identifier: unit.identifier,
    heading: unit.heading,
    ordinal: unit.ordinal,
    officialText: unit.officialText,
    editorialSummary: unit.editorialSummary,
    normalizedTextHash: unit.normalizedTextHash,
    pageStart: unit.pageStart,
    pageEnd: unit.pageEnd,
    locator: unit.locator,
    extractionStatus: unit.extractionStatus,
    reviewStatus: unit.reviewStatus,
  };
}

export async function syncRegulatoryUnitReferenceData(
  database: DatabaseClient,
  manifests = loadRegulatoryUnitReferenceData(),
) {
  for (const manifest of manifests) {
    const sourceVersion = await database.regulatorySourceVersion.findUniqueOrThrow({
      where: { id: manifest.sourceVersionId },
      include: { source: { select: { sourceKey: true } } },
    });
    if (
      sourceVersion.source.sourceKey !== manifest.sourceKey ||
      sourceVersion.officialDocumentSha256 !== manifest.officialDocumentSha256 ||
      sourceVersion.officialUrl !== manifest.officialUrl ||
      sourceVersion.artifactVerificationStatus !== 'OFFICIAL_ARTIFACT_VERIFIED' ||
      sourceVersion.textExtractionStatus !== 'COMPLETE' ||
      sourceVersion.artifactPageCount !== manifest.pageCount
    )
      throw new Error(`REGULATORY_UNIT_SOURCE_VERSION_DRIFT:${manifest.sourceKey}`);

    for (const expected of manifest.units) {
      const existing = await database.regulatoryUnit.findUnique({
        where: {
          sourceVersionId_identifier: {
            sourceVersionId: expected.sourceVersionId,
            identifier: expected.identifier,
          },
        },
      });
      if (existing) {
        if (
          adaptiveContentHash(unitProjection(existing as unknown as RegulatoryUnitRecord)) !==
          adaptiveContentHash(unitProjection(expected))
        )
          throw new Error(
            `REGULATORY_UNIT_REFERENCE_DRIFT:${manifest.sourceKey}:${expected.identifier}`,
          );
        continue;
      }
      await database.regulatoryUnit.create({
        data: {
          ...unitProjection(expected),
          unitType: expected.unitType,
          extractionStatus: expected.extractionStatus,
          reviewStatus: expected.reviewStatus,
        },
      });
    }
  }
  return {
    sources: manifests.length,
    units: manifests.reduce((sum, manifest) => sum + manifest.units.length, 0),
    articles: manifests.reduce(
      (sum, manifest) =>
        sum + manifest.units.filter(({ unitType }) => unitType === 'ARTICLE').length,
      0,
    ),
    structuralCoveragePercent: 100,
  };
}

export async function linkRegulatoryPilotToExactUnits(database: DatabaseClient) {
  const trace = [
    { provisionKey: 'MDT_2024_196_ART_18', identifier: 'ARTICLE_18' },
    { provisionKey: 'MDT_2024_196_ART_19', identifier: 'ARTICLE_19' },
  ];
  for (const link of trace) {
    const provision = await database.regulatoryProvision.findFirstOrThrow({
      where: {
        provisionKey: link.provisionKey,
        sourceVersion: { source: { sourceKey: 'EC_MDT_2024_196' }, catalogVersion: 2 },
      },
    });
    const unit = await database.regulatoryUnit.findFirstOrThrow({
      where: {
        identifier: link.identifier,
        sourceVersion: { source: { sourceKey: 'EC_MDT_2024_196' }, catalogVersion: 2 },
      },
    });
    await database.regulatoryProvisionUnit.upsert({
      where: { provisionId_unitId: { provisionId: provision.id, unitId: unit.id } },
      update: {},
      create: { provisionId: provision.id, unitId: unit.id },
    });
  }
  return trace.length;
}
