import { Prisma, PrismaClient } from '@prisma/client';
import {
  adaptiveContentHash,
  methodologySourceVersionManifestSchema,
  riskMethodContentHash,
  riskMethodExpertGuidanceVersionSchema,
  riskMethodRegulatoryContextSchema,
  riskMethodVersionManifestSchema,
} from '@sst/contracts';
import {
  ANITA_GTC45_GUIDANCE_MANIFEST,
  METHODOLOGY_SOURCE_MANIFESTS,
  RISK_METHOD_MANIFESTS,
  RISK_METHOD_REFERENCE_IDS,
  RISK_METHOD_REGULATORY_CONTEXT_MANIFESTS,
} from '../risk-methodology/risk-method-reference-data';
import { syncCatalogReferences } from './catalog-reference-sync';
import { syncRegulatoryEvidenceReferences } from './regulatory-evidence-reference-sync';

type JsonValue = Prisma.InputJsonValue;

export type RiskMethodologyReferenceCounts = {
  methodologySources: number;
  methodologySourceVersions: number;
  riskMethodDefinitions: number;
  riskMethodVersions: number;
  sourceLinks: number;
  expertGuidanceVersions: number;
  regulatoryContexts: number;
};

function asJson(value: unknown) {
  return value as JsonValue;
}

function referenceDrift(label: string): never {
  throw new Error(`RISK_METHOD_REFERENCE_DRIFT:${label}`);
}

function assertReferenceMatches(label: string, actual: unknown, expected: unknown) {
  if (adaptiveContentHash(actual) !== adaptiveContentHash(expected)) referenceDrift(label);
}

function assertExpectedId(label: string, actual: string, expected: string) {
  if (actual !== expected) referenceDrift(`${label}:IDENTITY`);
}

export function validateRiskMethodologyReferenceManifests() {
  for (const source of METHODOLOGY_SOURCE_MANIFESTS) {
    methodologySourceVersionManifestSchema.parse(source);
  }
  for (const method of RISK_METHOD_MANIFESTS) {
    riskMethodVersionManifestSchema.parse(method);
    if (riskMethodContentHash(method) !== method.contentHash) {
      throw new Error(`RISK_METHOD_CONTENT_HASH_MISMATCH:${method.methodKey}`);
    }
  }

  riskMethodExpertGuidanceVersionSchema.parse(ANITA_GTC45_GUIDANCE_MANIFEST);
  if (
    riskMethodContentHash(ANITA_GTC45_GUIDANCE_MANIFEST) !==
    ANITA_GTC45_GUIDANCE_MANIFEST.contentHash
  ) {
    throw new Error(
      `RISK_METHOD_CONTENT_HASH_MISMATCH:${ANITA_GTC45_GUIDANCE_MANIFEST.guidanceKey}`,
    );
  }

  for (const context of RISK_METHOD_REGULATORY_CONTEXT_MANIFESTS) {
    riskMethodRegulatoryContextSchema.parse(context);
    if (riskMethodContentHash(context) !== context.contentHash) {
      throw new Error(`RISK_METHOD_CONTENT_HASH_MISMATCH:${context.contextKey}`);
    }
  }
}

async function syncRiskMethodologyReferences(prisma: Prisma.TransactionClient) {
  validateRiskMethodologyReferenceManifests();

  for (const source of METHODOLOGY_SOURCE_MANIFESTS) {
    const expectedDefinitionId = RISK_METHOD_REFERENCE_IDS.sources[source.sourceKey];
    const definition = await prisma.methodologySource.upsert({
      where: { sourceKey: source.sourceKey },
      update: {},
      create: { id: expectedDefinitionId, sourceKey: source.sourceKey },
      select: { id: true },
    });
    assertExpectedId(`SOURCE_DEFINITION:${source.sourceKey}`, definition.id, expectedDefinitionId);

    const existing = await prisma.methodologySourceVersion.findUnique({
      where: {
        sourceId_semanticVersion: {
          sourceId: definition.id,
          semanticVersion: source.sourceVersion,
        },
      },
    });
    const expectedVersionId = RISK_METHOD_REFERENCE_IDS.sourceVersions[source.sourceKey];
    if (existing) {
      assertExpectedId(
        `SOURCE:${source.sourceKey}:${source.sourceVersion}`,
        existing.id,
        expectedVersionId,
      );
      assertReferenceMatches(
        `SOURCE:${source.sourceKey}:${source.sourceVersion}`,
        {
          semanticVersion: existing.semanticVersion,
          title: existing.title,
          issuer: existing.issuer,
          originCountry: existing.originCountry,
          documentType: existing.documentType,
          edition: existing.edition,
          publicationDate: existing.publicationDate?.toISOString().slice(0, 10) ?? null,
          sourceFingerprint: existing.sourceFingerprint,
          sourceStatus: existing.sourceStatus,
          licenseReproductionNote: existing.licenseReproductionNote,
          officialUrl: existing.officialUrl,
          reviewStatus: existing.reviewStatus,
          publicationStatus: existing.publicationStatus,
          manifest: existing.manifest,
          contentHash: existing.contentHash,
        },
        {
          semanticVersion: source.sourceVersion,
          title: source.title,
          issuer: source.issuer,
          originCountry: source.originCountry,
          documentType: source.documentType,
          edition: source.edition,
          publicationDate: source.publicationDate,
          sourceFingerprint: source.sourceFingerprint,
          sourceStatus: source.sourceStatus,
          licenseReproductionNote: source.licenseReproductionNote,
          officialUrl: source.officialUrl,
          reviewStatus: source.reviewStatus,
          publicationStatus: source.publicationStatus,
          manifest: source,
          contentHash: source.sourceFingerprint,
        },
      );
      continue;
    }

    await prisma.methodologySourceVersion.create({
      data: {
        id: expectedVersionId,
        sourceId: definition.id,
        semanticVersion: source.sourceVersion,
        title: source.title,
        issuer: source.issuer,
        originCountry: source.originCountry,
        documentType: source.documentType,
        edition: source.edition,
        publicationDate: source.publicationDate ? new Date(source.publicationDate) : null,
        sourceFingerprint: source.sourceFingerprint,
        sourceStatus: source.sourceStatus,
        licenseReproductionNote: source.licenseReproductionNote,
        officialUrl: source.officialUrl,
        reviewStatus: source.reviewStatus,
        publicationStatus: source.publicationStatus,
        manifest: asJson(source),
        contentHash: source.sourceFingerprint,
      },
    });
  }

  for (const method of RISK_METHOD_MANIFESTS) {
    const expectedDefinitionId = RISK_METHOD_REFERENCE_IDS.definitions[method.methodKey];
    const definition = await prisma.riskMethodDefinition.upsert({
      where: { methodKey: method.methodKey },
      update: {},
      create: { id: expectedDefinitionId, methodKey: method.methodKey },
      select: { id: true },
    });
    assertExpectedId(`METHOD_DEFINITION:${method.methodKey}`, definition.id, expectedDefinitionId);

    const existing = await prisma.riskMethodVersion.findUnique({
      where: {
        methodDefinitionId_semanticVersion: {
          methodDefinitionId: definition.id,
          semanticVersion: method.semanticVersion,
        },
      },
    });
    const expectedVersionId = RISK_METHOD_REFERENCE_IDS.versions[method.methodKey];
    if (existing) {
      assertExpectedId(
        `METHOD:${method.methodKey}:${method.semanticVersion}`,
        existing.id,
        expectedVersionId,
      );
      assertReferenceMatches(
        `METHOD:${method.methodKey}:${method.semanticVersion}`,
        {
          semanticVersion: existing.semanticVersion,
          displayName: existing.displayName,
          methodKind: existing.methodKind,
          calculationProviderKey: existing.calculationProviderKey,
          calculationProviderVersion: existing.calculationProviderVersion,
          inputSchemaVersion: existing.inputSchemaVersion,
          resultSchemaVersion: existing.resultSchemaVersion,
          isDemo: existing.isDemo,
          regulatory: existing.regulatory,
          publicationStatus: existing.publicationStatus,
          technicalReviewStatus: existing.technicalReviewStatus,
          legalReviewStatus: existing.legalReviewStatus,
          disclaimer: existing.disclaimer,
          manifest: existing.manifest,
          contentHash: existing.contentHash,
        },
        {
          semanticVersion: method.semanticVersion,
          displayName: method.displayName,
          methodKind: method.methodKind,
          calculationProviderKey: method.calculationProviderKey,
          calculationProviderVersion: method.calculationProviderVersion,
          inputSchemaVersion: method.inputSchemaVersion,
          resultSchemaVersion: method.resultSchemaVersion,
          isDemo: method.isDemo,
          regulatory: method.regulatory,
          publicationStatus: method.publicationStatus,
          technicalReviewStatus: method.technicalReviewStatus,
          legalReviewStatus: method.legalReviewStatus,
          disclaimer: method.disclaimer,
          manifest: method,
          contentHash: method.contentHash,
        },
      );
      continue;
    }

    await prisma.riskMethodVersion.create({
      data: {
        id: expectedVersionId,
        methodDefinitionId: definition.id,
        semanticVersion: method.semanticVersion,
        displayName: method.displayName,
        methodKind: method.methodKind,
        calculationProviderKey: method.calculationProviderKey,
        calculationProviderVersion: method.calculationProviderVersion,
        inputSchemaVersion: method.inputSchemaVersion,
        resultSchemaVersion: method.resultSchemaVersion,
        isDemo: method.isDemo,
        regulatory: method.regulatory,
        publicationStatus: method.publicationStatus,
        technicalReviewStatus: method.technicalReviewStatus,
        legalReviewStatus: method.legalReviewStatus,
        disclaimer: method.disclaimer,
        manifest: asJson(method),
        contentHash: method.contentHash,
        publishedAt: method.publicationStatus === 'PUBLISHED' ? new Date() : null,
      },
    });
  }

  const gtcLink = await prisma.riskMethodSourceLink.findUnique({
    where: {
      riskMethodVersionId_methodologySourceVersionId_relationship: {
        riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
        methodologySourceVersionId: RISK_METHOD_REFERENCE_IDS.sourceVersions.CO_GTC45_2010,
        relationship: 'TECHNICAL_BASIS',
      },
    },
  });
  if (gtcLink) {
    assertExpectedId(
      'SOURCE_LINK:GTC45_2010',
      gtcLink.id,
      RISK_METHOD_REFERENCE_IDS.sourceLinks.GTC45_2010,
    );
  } else {
    await prisma.riskMethodSourceLink.create({
      data: {
        id: RISK_METHOD_REFERENCE_IDS.sourceLinks.GTC45_2010,
        riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
        methodologySourceVersionId: RISK_METHOD_REFERENCE_IDS.sourceVersions.CO_GTC45_2010,
      },
    });
  }

  const guidance = ANITA_GTC45_GUIDANCE_MANIFEST;
  const existingGuidance = await prisma.riskMethodExpertGuidanceVersion.findUnique({
    where: {
      guidanceKey_guidanceVersion: {
        guidanceKey: guidance.guidanceKey,
        guidanceVersion: guidance.guidanceVersion,
      },
    },
  });
  if (existingGuidance) {
    assertExpectedId(
      `GUIDANCE:${guidance.guidanceKey}:${guidance.guidanceVersion}`,
      existingGuidance.id,
      RISK_METHOD_REFERENCE_IDS.guidance.ANITA_GTC45,
    );
    assertReferenceMatches(
      `GUIDANCE:${guidance.guidanceKey}:${guidance.guidanceVersion}`,
      {
        riskMethodVersionId: existingGuidance.riskMethodVersionId,
        guidanceKey: existingGuidance.guidanceKey,
        guidanceVersion: existingGuidance.guidanceVersion,
        authorSource: existingGuidance.authorSource,
        evidenceClassification: existingGuidance.evidenceClassification,
        reviewStatus: existingGuidance.reviewStatus,
        officialUiVerification: existingGuidance.officialUiVerification,
        helpDefinitions: existingGuidance.helpDefinitions,
        disclaimer: existingGuidance.disclaimer,
        manifest: existingGuidance.manifest,
        contentHash: existingGuidance.contentHash,
        publicationStatus: existingGuidance.publicationStatus,
      },
      {
        riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
        guidanceKey: guidance.guidanceKey,
        guidanceVersion: guidance.guidanceVersion,
        authorSource: guidance.authorSource,
        evidenceClassification: guidance.evidenceClassification,
        reviewStatus: guidance.reviewStatus,
        officialUiVerification: guidance.officialUiVerification,
        helpDefinitions: guidance.helpDefinitions,
        disclaimer: guidance.disclaimer,
        manifest: guidance,
        contentHash: guidance.contentHash,
        publicationStatus: 'CANDIDATE',
      },
    );
  } else {
    await prisma.riskMethodExpertGuidanceVersion.create({
      data: {
        id: RISK_METHOD_REFERENCE_IDS.guidance.ANITA_GTC45,
        guidanceKey: guidance.guidanceKey,
        guidanceVersion: guidance.guidanceVersion,
        riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
        authorSource: guidance.authorSource,
        evidenceClassification: guidance.evidenceClassification,
        reviewStatus: guidance.reviewStatus,
        officialUiVerification: guidance.officialUiVerification,
        helpDefinitions: asJson(guidance.helpDefinitions),
        disclaimer: guidance.disclaimer,
        manifest: asJson(guidance),
        contentHash: guidance.contentHash,
      },
    });
  }

  for (const context of RISK_METHOD_REGULATORY_CONTEXT_MANIFESTS) {
    const expectedContextId =
      context.methodKey === 'GUIDED_5X5'
        ? RISK_METHOD_REFERENCE_IDS.contexts.GUIDED_5X5_EC
        : RISK_METHOD_REFERENCE_IDS.contexts.GTC45_2010_EC;
    const existing = await prisma.riskMethodRegulatoryContext.findUnique({
      where: {
        contextKey_contextVersion: {
          contextKey: context.contextKey,
          contextVersion: context.contextVersion,
        },
      },
    });
    const methodKey = context.methodKey as keyof typeof RISK_METHOD_REFERENCE_IDS.versions;
    if (existing) {
      assertExpectedId(
        `CONTEXT:${context.contextKey}:${context.contextVersion}`,
        existing.id,
        expectedContextId,
      );
      assertReferenceMatches(
        `CONTEXT:${context.contextKey}:${context.contextVersion}`,
        {
          riskMethodVersionId: existing.riskMethodVersionId,
          contextKey: existing.contextKey,
          contextVersion: existing.contextVersion,
          jurisdiction: existing.jurisdiction,
          relationship: existing.relationship,
          sourceReferences: existing.sourceReferences,
          statement: existing.statement,
          technicalReviewStatus: existing.technicalReviewStatus,
          legalReviewStatus: existing.legalReviewStatus,
          officialSutMethodOptions: existing.officialSutMethodOptions,
          manifest: existing.manifest,
          contentHash: existing.contentHash,
        },
        {
          riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions[methodKey],
          contextKey: context.contextKey,
          contextVersion: context.contextVersion,
          jurisdiction: context.jurisdiction,
          relationship: context.relationship,
          sourceReferences: context.regulatorySourceReferences,
          statement: context.statement,
          technicalReviewStatus: context.technicalReviewStatus,
          legalReviewStatus: context.legalReviewStatus,
          officialSutMethodOptions: context.officialSutMethodOptions,
          manifest: context,
          contentHash: context.contentHash,
        },
      );
      continue;
    }

    await prisma.riskMethodRegulatoryContext.create({
      data: {
        id: expectedContextId,
        contextKey: context.contextKey,
        contextVersion: context.contextVersion,
        riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions[methodKey],
        jurisdiction: context.jurisdiction,
        relationship: context.relationship,
        sourceReferences: asJson(context.regulatorySourceReferences),
        statement: context.statement,
        technicalReviewStatus: context.technicalReviewStatus,
        legalReviewStatus: context.legalReviewStatus,
        officialSutMethodOptions: context.officialSutMethodOptions,
        manifest: asJson(context),
        contentHash: context.contentHash,
      },
    });
  }
}

async function referenceCounts(
  prisma: Prisma.TransactionClient,
): Promise<RiskMethodologyReferenceCounts> {
  const [
    methodologySources,
    methodologySourceVersions,
    riskMethodDefinitions,
    riskMethodVersions,
    sourceLinks,
    expertGuidanceVersions,
    regulatoryContexts,
  ] = await Promise.all([
    prisma.methodologySource.count(),
    prisma.methodologySourceVersion.count(),
    prisma.riskMethodDefinition.count(),
    prisma.riskMethodVersion.count(),
    prisma.riskMethodSourceLink.count(),
    prisma.riskMethodExpertGuidanceVersion.count(),
    prisma.riskMethodRegulatoryContext.count(),
  ]);
  return {
    methodologySources,
    methodologySourceVersions,
    riskMethodDefinitions,
    riskMethodVersions,
    sourceLinks,
    expertGuidanceVersions,
    regulatoryContexts,
  };
}

export function syncGlobalReferenceData(prisma: PrismaClient) {
  return prisma.$transaction(
    async (transaction) => {
      await transaction.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext('sst-global-reference-sync-v1'))",
      );
      const catalog = await syncCatalogReferences(transaction);
      await syncRiskMethodologyReferences(transaction);
      const regulatory = await syncRegulatoryEvidenceReferences(transaction);
      return { catalog, riskMethodology: await referenceCounts(transaction), regulatory };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 30_000,
    },
  );
}
