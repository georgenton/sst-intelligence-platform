import { existsSync, readFileSync } from 'node:fs';
import { dirname, parse, resolve } from 'node:path';
import {
  Prisma,
  type PrismaClient,
  type RegulatoryCandidateStatus,
  type RegulatoryDocumentType,
  type RegulatoryRelationshipReviewStatus,
  type RegulatoryRelationshipType,
  type RegulatorySupersessionStatus,
} from '@prisma/client';
import { validateRegulatoryReviewCorpus, type RegulatoryReviewCorpusBundle } from '@sst/contracts';
import { assertPublishedVersionMatches } from '../src/adaptive-configuration/adaptive-reference-integrity';

const CORPUS_DIRECTORY = 'regulatory/corpus/ecuador-sst-review-v1';

function repositoryRoot(start = process.cwd()) {
  let current = resolve(start);
  const root = parse(current).root;
  while (current !== root) {
    if (existsSync(resolve(current, CORPUS_DIRECTORY, 'corpus.json'))) return current;
    current = dirname(current);
  }
  throw new Error('REGULATORY_REVIEW_CORPUS_REPOSITORY_ROOT_NOT_FOUND');
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadRegulatoryReviewCorpusReferenceData(start = process.cwd()) {
  const directory = resolve(repositoryRoot(start), CORPUS_DIRECTORY);
  const index = readJson(
    resolve(directory, 'corpus.json'),
  ) as RegulatoryReviewCorpusBundle['index'];
  return validateRegulatoryReviewCorpus({
    index,
    sources: index.sourceFiles.map((file) => readJson(resolve(directory, file))),
    relationships: readJson(resolve(directory, 'relationships.json')),
    scenarioMap: readJson(resolve(directory, 'scenario-review-map.json')),
  } as RegulatoryReviewCorpusBundle);
}

function asDate(value: string | null) {
  return value === null ? null : new Date(`${value}T00:00:00.000Z`);
}

function omitKeys<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const excluded = new Set<PropertyKey>(keys);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !excluded.has(key))) as Omit<
    T,
    K
  >;
}

const COMPLETE_TEXT_SOURCES = new Set([
  'EC_CAN_DECISION_584',
  'EC_CAN_RESOLUTION_957',
  'EC_IESS_CD_677',
  'EC_IESS_CD_692',
  'EC_LABOR_CODE',
  'EC_MDT_2024_196',
  'EC_MDT_2024_196_ANNEX_1',
  'EC_MDT_2025_122_CONSTRUCTION',
]);

const PARTIAL_TEXT_SOURCES = new Set([
  'EC_IESS_CD_513',
  'EC_IESS_CD_517',
  'EC_MDT_2024_196_ANNEX_3',
]);

const ARTIFACT_PAGE_COUNTS: Record<string, number> = {
  EC_CAN_DECISION_584: 15,
  EC_CAN_RESOLUTION_957: 8,
  EC_EXECUTIVE_DECREE_255: 43,
  EC_IESS_CD_513: 72,
  EC_IESS_CD_517: 19,
  EC_IESS_CD_677: 22,
  EC_IESS_CD_692: 5,
  EC_LABOR_CODE: 199,
  EC_MDT_2024_196: 23,
  EC_MDT_2024_196_ANNEX_1: 8,
  EC_MDT_2024_196_ANNEX_2: 91,
  EC_MDT_2024_196_ANNEX_3: 102,
  EC_MDT_2025_122_CONSTRUCTION: 70,
};

function evidenceClassification(source: RegulatoryReviewCorpusBundle['sources'][number]) {
  const artifactVerificationStatus =
    source.verificationStatus === 'VERIFIED_OFFICIAL_ARTIFACT'
      ? ('OFFICIAL_ARTIFACT_VERIFIED' as const)
      : source.verificationStatus === 'UNVERIFIED_REFERENCE'
        ? ('REJECTED_UNVERIFIED' as const)
        : source.verificationStatus === 'VERIFIED_OFFICIAL_REFERENCE' ||
            source.verificationStatus === 'OFFICIAL_REFERENCE_ONLY'
          ? ('OFFICIAL_REFERENCE_ONLY' as const)
          : ('ARTIFACT_PENDING' as const);
  const textExtractionStatus = COMPLETE_TEXT_SOURCES.has(source.sourceKey)
    ? ('COMPLETE' as const)
    : PARTIAL_TEXT_SOURCES.has(source.sourceKey)
      ? ('PARTIAL' as const)
      : artifactVerificationStatus === 'OFFICIAL_ARTIFACT_VERIFIED'
        ? ('PENDING' as const)
        : ('NOT_APPLICABLE' as const);
  return {
    artifactVerificationStatus,
    textExtractionStatus,
    vigenciaReviewStatus:
      source.sourceKey === 'EC_IESS_CD_517'
        ? ('REPEALED' as const)
        : source.sourceKey === 'EC_IESS_CD_513'
          ? ('PARTIALLY_AMENDED' as const)
          : artifactVerificationStatus === 'REJECTED_UNVERIFIED'
            ? ('UNKNOWN' as const)
            : ('PENDING_REVIEW' as const),
    artifactPageCount: ARTIFACT_PAGE_COUNTS[source.sourceKey] ?? null,
    artifactVersionKey: source.officialDocumentSha256
      ? `${source.sourceKey}:v${source.latestCatalogVersion}:${source.officialDocumentSha256}`
      : null,
  };
}

type DatabaseClient = Prisma.TransactionClient | PrismaClient;

export async function provisionRegulatoryReviewCorpus(
  prisma: DatabaseClient,
  corpus = loadRegulatoryReviewCorpusReferenceData(),
) {
  const sourceIds = new Map<string, string>();
  for (const source of corpus.sources) {
    const identity = {
      id: source.sourceId,
      sourceKey: source.sourceKey,
      countryCode: source.countryCode,
      issuer: source.issuer,
      documentType: source.documentType as RegulatoryDocumentType,
      referenceNumber: source.referenceNumber,
      canonicalTitle: source.displayTitle,
    };
    const existing = await prisma.regulatorySource.findUnique({
      where: { sourceKey: source.sourceKey },
    });
    if (existing)
      assertPublishedVersionMatches(`REGULATORY_SOURCE_IDENTITY:${source.sourceKey}`, existing, {
        ...identity,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      });
    const row =
      existing ??
      (await prisma.regulatorySource.create({
        data: identity,
      }));
    sourceIds.set(source.sourceKey, row.id);

    const evidence = evidenceClassification(source);
    const payload = {
      candidateStatus: source.candidateStatus as RegulatoryCandidateStatus,
      officialDocumentLocated: source.officialDocumentLocated,
      officialUrl: source.officialUrl,
      officialDocumentSha256: source.officialDocumentSha256,
      officialDocumentRetrievedAt:
        source.officialDocumentRetrievedAt === null
          ? null
          : new Date(source.officialDocumentRetrievedAt),
      officialDocumentMediaType: source.officialDocumentMediaType,
      officialPublicationReference: source.officialPublicationReference,
      publicationDate: asDate(source.publicationDate),
      effectiveFrom: null,
      effectiveTo: null,
      supersessionStatus: source.supersessionStatus as RegulatorySupersessionStatus,
      readyForExtraction: source.readyForExtraction,
      readyForRules: source.readyForRules,
      reviewNotes: source.reviewNotes,
      recordedAt: new Date(source.recordedAt),
    };
    const existingVersion = await prisma.regulatorySourceVersion.findUnique({
      where: {
        sourceId_catalogVersion: {
          sourceId: row.id,
          catalogVersion: source.latestCatalogVersion,
        },
      },
    });
    if (existingVersion) {
      const existingCore = omitKeys(existingVersion, [
        'artifactVerificationStatus',
        'textExtractionStatus',
        'vigenciaReviewStatus',
        'artifactPageCount',
        'artifactVersionKey',
      ] as const);
      assertPublishedVersionMatches(
        `REGULATORY_SOURCE:${source.sourceKey}:${source.latestCatalogVersion}`,
        existingCore,
        {
          id: source.versionId,
          sourceId: row.id,
          catalogVersion: source.latestCatalogVersion,
          ...payload,
        },
      );
      const evidenceMatches =
        existingVersion.artifactVerificationStatus === evidence.artifactVerificationStatus &&
        existingVersion.textExtractionStatus === evidence.textExtractionStatus &&
        existingVersion.vigenciaReviewStatus === evidence.vigenciaReviewStatus &&
        existingVersion.artifactPageCount === evidence.artifactPageCount &&
        existingVersion.artifactVersionKey === evidence.artifactVersionKey;
      if (!evidenceMatches)
        throw new Error(`REGULATORY_SOURCE_EVIDENCE_CLASSIFICATION_DRIFT:${source.sourceKey}`);
    } else
      await prisma.regulatorySourceVersion.create({
        data: {
          id: source.versionId,
          sourceId: row.id,
          catalogVersion: source.latestCatalogVersion,
          ...payload,
          ...evidence,
        },
      });
  }

  for (const relationship of corpus.relationships.relationships) {
    const fromSourceId = sourceIds.get(relationship.fromSourceKey)!;
    const toSourceId = sourceIds.get(relationship.toSourceKey)!;
    const existing = await prisma.regulatorySourceRelationship.findUnique({
      where: {
        fromSourceId_toSourceId_relationshipType: {
          fromSourceId,
          toSourceId,
          relationshipType: relationship.relationshipType as RegulatoryRelationshipType,
        },
      },
    });
    const payload = {
      id: relationship.id,
      fromSourceId,
      toSourceId,
      relationshipType: relationship.relationshipType as RegulatoryRelationshipType,
      reviewStatus: relationship.reviewStatus as RegulatoryRelationshipReviewStatus,
      notes: relationship.notes,
    };
    if (existing)
      assertPublishedVersionMatches(`REGULATORY_SOURCE_RELATIONSHIP:${relationship.id}`, existing, {
        ...payload,
        createdAt: existing.createdAt,
      });
    else
      await prisma.regulatorySourceRelationship.create({
        data: { ...payload, createdAt: new Date('2026-08-21T18:20:01.000Z') },
      });
  }
}
