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
import {
  adaptiveContentHash,
  auditRegulatoryUnitCoverage,
  regulatoryUnitRecordSchema,
  validateRegulatoryPilotManifest,
  validateRegulatoryReviewCorpus,
  type RegulatoryPilotManifestBundle,
  type RegulatoryReviewCorpusBundle,
  type RegulatoryUnitRecord,
} from '@sst/contracts';

type DatabaseClient = Prisma.TransactionClient | PrismaClient;

const CORPUS_DIRECTORY = 'regulatory/corpus/ecuador-sst-review-v1';
const EVIDENCE_DIRECTORY = 'regulatory/evidence/ecuador-official-units-v1';
const PILOT_DIRECTORY = 'regulatory/pilots/ec-mdt-2024-196-v1';

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

function repositoryRoot(start = process.cwd()) {
  let current = resolve(start);
  const root = parse(current).root;
  while (current !== root) {
    if (
      existsSync(resolve(current, CORPUS_DIRECTORY, 'corpus.json')) &&
      existsSync(resolve(current, EVIDENCE_DIRECTORY, 'index.json')) &&
      existsSync(resolve(current, PILOT_DIRECTORY, 'manifest.json'))
    )
      return current;
    current = dirname(current);
  }
  throw new Error('REGULATORY_EVIDENCE_REPOSITORY_ROOT_NOT_FOUND');
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function omitKeys<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const excluded = new Set<PropertyKey>(keys);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !excluded.has(key))) as Omit<
    T,
    K
  >;
}

function loadCorpus(root: string) {
  const directory = resolve(root, CORPUS_DIRECTORY);
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

function loadPilot(root: string) {
  const directory = resolve(root, PILOT_DIRECTORY);
  const read = (name: string) => readJson(resolve(directory, name));
  return validateRegulatoryPilotManifest({
    index: read('manifest.json'),
    source: read('source.json'),
    provisions: read('provisions.json'),
    requirements: read('requirements.json'),
    ruleDrafts: read('rule-drafts.json'),
    shadowPack: read('shadow-pack.json'),
  } as RegulatoryPilotManifestBundle);
}

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
  return {
    artifactVerificationStatus,
    textExtractionStatus: COMPLETE_TEXT_SOURCES.has(source.sourceKey)
      ? ('COMPLETE' as const)
      : PARTIAL_TEXT_SOURCES.has(source.sourceKey)
        ? ('PARTIAL' as const)
        : artifactVerificationStatus === 'OFFICIAL_ARTIFACT_VERIFIED'
          ? ('PENDING' as const)
          : ('NOT_APPLICABLE' as const),
    vigenciaReviewStatus:
      source.sourceKey === 'EC_IESS_CD_513'
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

function date(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function assertSame(label: string, actual: unknown, expected: unknown) {
  if (adaptiveContentHash(actual) !== adaptiveContentHash(expected))
    throw new Error(`REGULATORY_REFERENCE_DRIFT:${label}`);
}

async function syncCorpus(database: DatabaseClient, corpus: RegulatoryReviewCorpusBundle) {
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
    const existingSource = await database.regulatorySource.findUnique({
      where: { sourceKey: source.sourceKey },
    });
    if (existingSource)
      assertSame(
        `SOURCE_IDENTITY:${source.sourceKey}`,
        { ...identity, createdAt: existingSource.createdAt, updatedAt: existingSource.updatedAt },
        existingSource,
      );
    else await database.regulatorySource.create({ data: identity });
    sourceIds.set(source.sourceKey, source.sourceId);

    const classification = evidenceClassification(source);
    const payload = {
      id: source.versionId,
      sourceId: source.sourceId,
      catalogVersion: source.latestCatalogVersion,
      candidateStatus: source.candidateStatus as RegulatoryCandidateStatus,
      officialDocumentLocated: source.officialDocumentLocated,
      officialUrl: source.officialUrl,
      officialDocumentSha256: source.officialDocumentSha256,
      officialDocumentRetrievedAt: source.officialDocumentRetrievedAt
        ? new Date(source.officialDocumentRetrievedAt)
        : null,
      officialDocumentMediaType: source.officialDocumentMediaType,
      officialPublicationReference: source.officialPublicationReference,
      publicationDate: date(source.publicationDate),
      effectiveFrom: null,
      effectiveTo: null,
      supersessionStatus: source.supersessionStatus as RegulatorySupersessionStatus,
      readyForExtraction: source.readyForExtraction,
      readyForRules: false,
      reviewNotes: source.reviewNotes,
      recordedAt: new Date(source.recordedAt),
      ...classification,
    };
    const existingVersion = await database.regulatorySourceVersion.findUnique({
      where: {
        sourceId_catalogVersion: {
          sourceId: source.sourceId,
          catalogVersion: source.latestCatalogVersion,
        },
      },
    });
    if (existingVersion) {
      const {
        artifactVerificationStatus,
        textExtractionStatus,
        vigenciaReviewStatus,
        artifactPageCount,
        artifactVersionKey,
        ...core
      } = existingVersion;
      const expectedCore = omitKeys(payload, [
        'artifactVerificationStatus',
        'textExtractionStatus',
        'vigenciaReviewStatus',
        'artifactPageCount',
        'artifactVersionKey',
      ] as const);
      assertSame(
        `SOURCE_VERSION:${source.sourceKey}:${source.latestCatalogVersion}`,
        core,
        expectedCore,
      );
      const currentClassification = {
        artifactVerificationStatus,
        textExtractionStatus,
        vigenciaReviewStatus,
        artifactPageCount,
        artifactVersionKey,
      };
      assertSame(
        `SOURCE_CLASSIFICATION:${source.sourceKey}`,
        currentClassification,
        classification,
      );
    } else await database.regulatorySourceVersion.create({ data: payload });
  }

  for (const relationship of corpus.relationships.relationships) {
    const payload = {
      id: relationship.id,
      fromSourceId: sourceIds.get(relationship.fromSourceKey)!,
      toSourceId: sourceIds.get(relationship.toSourceKey)!,
      relationshipType: relationship.relationshipType as RegulatoryRelationshipType,
      reviewStatus: relationship.reviewStatus as RegulatoryRelationshipReviewStatus,
      notes: relationship.notes,
    };
    const existing = await database.regulatorySourceRelationship.findUnique({
      where: {
        fromSourceId_toSourceId_relationshipType: {
          fromSourceId: payload.fromSourceId,
          toSourceId: payload.toSourceId,
          relationshipType: payload.relationshipType,
        },
      },
    });
    if (existing)
      assertSame(
        `SOURCE_RELATIONSHIP:${relationship.id}`,
        { ...payload, createdAt: existing.createdAt },
        existing,
      );
    else await database.regulatorySourceRelationship.create({ data: payload });
  }
}

type EvidenceFile = {
  sourceKey: string;
  sourceVersionId: string;
  officialDocumentSha256: string;
  officialUrl: string;
  pageCount: number;
  expectedIdentifiers: string[];
  units: RegulatoryUnitRecord[];
};

function loadEvidence(root: string) {
  const directory = resolve(root, EVIDENCE_DIRECTORY);
  const index = readJson(resolve(directory, 'index.json')) as {
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
    const file = readJson(resolve(directory, entry.file)) as EvidenceFile;
    file.units = file.units.map((unit) => regulatoryUnitRecordSchema.parse(unit));
    const audit = auditRegulatoryUnitCoverage(file.units, file.expectedIdentifiers);
    if (
      !audit.complete ||
      file.units.length !== entry.expectedUnitCount ||
      file.units.filter(({ unitType }) => unitType === 'ARTICLE').length !== entry.articleCount ||
      file.sourceVersionId !== entry.sourceVersionId ||
      file.pageCount !== entry.pageCount
    )
      throw new Error(`REGULATORY_UNIT_COVERAGE_INCOMPLETE:${entry.sourceKey}`);
    return file;
  });
}

async function syncUnits(database: DatabaseClient, files: EvidenceFile[]) {
  for (const file of files) {
    const version = await database.regulatorySourceVersion.findUniqueOrThrow({
      where: { id: file.sourceVersionId },
      include: { source: { select: { sourceKey: true } } },
    });
    if (
      version.source.sourceKey !== file.sourceKey ||
      version.officialDocumentSha256 !== file.officialDocumentSha256 ||
      version.officialUrl !== file.officialUrl ||
      version.textExtractionStatus !== 'COMPLETE'
    )
      throw new Error(`REGULATORY_UNIT_SOURCE_VERSION_DRIFT:${file.sourceKey}`);
    for (const unit of file.units) {
      const existing = await database.regulatoryUnit.findUnique({
        where: {
          sourceVersionId_identifier: {
            sourceVersionId: unit.sourceVersionId,
            identifier: unit.identifier,
          },
        },
      });
      const expected = {
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
      if (existing) {
        const actual = omitKeys(existing, ['createdAt'] as const);
        assertSame(`UNIT:${file.sourceKey}:${unit.identifier}`, actual, expected);
      } else await database.regulatoryUnit.create({ data: expected });
    }
  }
}

async function syncPilot(database: DatabaseClient, pilot: RegulatoryPilotManifestBundle) {
  const source = await database.regulatorySource.findUniqueOrThrow({
    where: { sourceKey: pilot.source.sourceKey },
    select: { id: true },
  });
  const sourceVersion = await database.regulatorySourceVersion.findUniqueOrThrow({
    where: {
      sourceId_catalogVersion: {
        sourceId: source.id,
        catalogVersion: pilot.source.sourceCatalogVersion,
      },
    },
  });
  if (
    sourceVersion.officialDocumentSha256 !== pilot.source.officialDocumentSha256 ||
    sourceVersion.readyForRules
  )
    throw new Error('EDITORIAL_SOURCE_VERSION_DRIFT');
  const provisionIds = new Map<string, string>();
  for (const candidate of pilot.provisions) {
    const expected = {
      id: candidate.candidateId,
      sourceVersionId: sourceVersion.id,
      provisionKey: candidate.provisionKey,
      locatorType: candidate.locatorType,
      locatorLabel: candidate.locatorLabel,
      heading: candidate.heading,
      summary: candidate.summary,
      editorialStatus: 'TECHNICAL_REVIEW_PENDING' as const,
      supersedesProvisionId: null,
    };
    const existing = await database.regulatoryProvision.findUnique({
      where: {
        sourceVersionId_provisionKey: {
          sourceVersionId: sourceVersion.id,
          provisionKey: candidate.provisionKey,
        },
      },
    });
    if (existing) {
      const actual = omitKeys(existing, ['createdAt'] as const);
      assertSame(`PROVISION:${candidate.provisionKey}`, actual, expected);
    } else {
      await database.regulatoryProvision.create({
        data: { ...expected, editorialStatus: 'DRAFT' },
      });
      await database.regulatoryProvision.update({
        where: { id: candidate.candidateId },
        data: { editorialStatus: 'EXTRACTED' },
      });
      await database.regulatoryProvision.update({
        where: { id: candidate.candidateId },
        data: { editorialStatus: 'TECHNICAL_REVIEW_PENDING' },
      });
    }
    provisionIds.set(candidate.provisionKey, candidate.candidateId);
    const identifier = candidate.locatorLabel === 'Artículo 18' ? 'ARTICLE_18' : 'ARTICLE_19';
    const unit = await database.regulatoryUnit.findUniqueOrThrow({
      where: { sourceVersionId_identifier: { sourceVersionId: sourceVersion.id, identifier } },
    });
    await database.regulatoryProvisionUnit.upsert({
      where: { provisionId_unitId: { provisionId: candidate.candidateId, unitId: unit.id } },
      update: {},
      create: { provisionId: candidate.candidateId, unitId: unit.id },
    });
  }
  const requirementIds = new Map<string, string>();
  for (const candidate of pilot.requirements) {
    const expected = {
      id: candidate.candidateId,
      requirementKey: candidate.requirementKey,
      title: candidate.title,
      description: candidate.description,
      editorialStatus: 'TECHNICAL_REVIEW_PENDING' as const,
      scopeHint: candidate.scopeHint,
      supersedesRequirementId: null,
    };
    const existing = await database.regulatoryRequirement.findUnique({
      where: { requirementKey: candidate.requirementKey },
    });
    if (existing) {
      const actual = omitKeys(existing, ['createdAt'] as const);
      assertSame(`REQUIREMENT:${candidate.requirementKey}`, actual, expected);
    } else {
      await database.regulatoryRequirement.create({
        data: { ...expected, editorialStatus: 'DRAFT' },
      });
      await database.regulatoryRequirement.update({
        where: { id: candidate.candidateId },
        data: { editorialStatus: 'TECHNICAL_REVIEW_PENDING' },
      });
    }
    requirementIds.set(candidate.requirementKey, candidate.candidateId);
    for (const provisionKey of candidate.provisionKeys)
      await database.regulatoryRequirementSource.upsert({
        where: {
          requirementId_provisionId_relationshipType: {
            requirementId: candidate.candidateId,
            provisionId: provisionIds.get(provisionKey)!,
            relationshipType: candidate.relationshipType,
          },
        },
        update: {},
        create: {
          requirementId: candidate.candidateId,
          provisionId: provisionIds.get(provisionKey)!,
          relationshipType: candidate.relationshipType,
        },
      });
  }
  for (const candidate of pilot.ruleDrafts) {
    const definition = await database.adaptiveRuleDefinition.upsert({
      where: { ruleKey: candidate.rule.ruleKey },
      update: {},
      create: { id: candidate.ruleDefinitionId, ruleKey: candidate.rule.ruleKey },
    });
    if (definition.id !== candidate.ruleDefinitionId)
      throw new Error(`REGULATORY_REFERENCE_DRIFT:RULE_DEFINITION:${candidate.rule.ruleKey}`);
    const existing = await database.adaptiveRuleDraft.findUnique({
      where: {
        ruleDefinitionId_revision: {
          ruleDefinitionId: definition.id,
          revision: candidate.revision,
        },
      },
    });
    const expected = {
      id: candidate.draftId,
      ruleDefinitionId: definition.id,
      revision: candidate.revision,
      status: 'TECHNICAL_REVIEW_PENDING' as const,
      schema: candidate.rule,
      isDemo: false,
      regulatory: true,
      demoDisclaimer: null,
      technicalReviewedAt: null,
      legalReviewedAt: null,
    };
    if (existing) {
      const actual = omitKeys(existing, ['createdAt', 'updatedAt'] as const);
      assertSame(`RULE_DRAFT:${candidate.rule.ruleKey}`, actual, expected);
    } else
      await database.adaptiveRuleDraft.create({
        data: { ...expected, schema: candidate.rule as Prisma.InputJsonValue },
      });
    for (const requirementKey of candidate.requirementKeys)
      await database.regulatoryRuleDraftRequirement.upsert({
        where: {
          ruleDraftId_requirementId_relationshipType: {
            ruleDraftId: candidate.draftId,
            requirementId: requirementIds.get(requirementKey)!,
            relationshipType: 'PRIMARY_REQUIREMENT',
          },
        },
        update: {},
        create: {
          ruleDraftId: candidate.draftId,
          requirementId: requirementIds.get(requirementKey)!,
          relationshipType: 'PRIMARY_REQUIREMENT',
        },
      });
  }
}

export async function syncRegulatoryEvidenceReferences(database: DatabaseClient) {
  const root = repositoryRoot();
  const corpus = loadCorpus(root);
  const evidence = loadEvidence(root);
  const pilot = loadPilot(root);
  await syncCorpus(database, corpus);
  await syncUnits(database, evidence);
  await syncPilot(database, pilot);
  return {
    sources: corpus.sources.length,
    sourceVersions: corpus.sources.length,
    verifiedArtifacts: corpus.sources.filter(
      ({ verificationStatus }) => verificationStatus === 'VERIFIED_OFFICIAL_ARTIFACT',
    ).length,
    pendingArtifacts: corpus.sources.filter(
      ({ verificationStatus }) => verificationStatus !== 'VERIFIED_OFFICIAL_ARTIFACT',
    ).length,
    units: evidence.reduce((sum, file) => sum + file.units.length, 0),
    articles: evidence.reduce(
      (sum, file) => sum + file.units.filter(({ unitType }) => unitType === 'ARTICLE').length,
      0,
    ),
    structuralCoveragePercent: 100,
    requirements: pilot.requirements.length,
    ruleDrafts: pilot.ruleDrafts.length,
    publishedRules: 0,
  };
}
