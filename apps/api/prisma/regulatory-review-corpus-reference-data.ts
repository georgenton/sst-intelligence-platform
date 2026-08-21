import { existsSync, readFileSync } from 'node:fs';
import { dirname, parse, resolve } from 'node:path';
import {
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

export async function provisionRegulatoryReviewCorpus(
  prisma: PrismaClient,
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
    if (existingVersion)
      assertPublishedVersionMatches(
        `REGULATORY_SOURCE:${source.sourceKey}:${source.latestCatalogVersion}`,
        existingVersion,
        {
          id: source.versionId,
          sourceId: row.id,
          catalogVersion: source.latestCatalogVersion,
          ...payload,
        },
      );
    else
      await prisma.regulatorySourceVersion.create({
        data: {
          id: source.versionId,
          sourceId: row.id,
          catalogVersion: source.latestCatalogVersion,
          ...payload,
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
