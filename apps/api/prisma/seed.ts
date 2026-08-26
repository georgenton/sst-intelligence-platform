import {
  PrismaClient,
  FeatureValueType,
  ModuleKey,
  PlanKey,
  Prisma,
  type RegulatoryCandidateStatus,
  type RegulatoryDocumentType,
  type RegulatoryRelationshipReviewStatus,
  type RegulatoryRelationshipType,
  type RegulatorySupersessionStatus,
} from '@prisma/client';
import {
  DEMO_ADAPTIVE_RULE_PACK,
  DEMO_APPLICABILITY_RULE_PACK,
  DEMO_TECHNICAL_RISK_METHOD,
  adaptiveContentHash,
  adaptivePackContentHash,
  normalizeAdaptiveGroupVersion,
  normalizeAdaptiveRuleVersion,
  riskMethodContentHash,
} from '@sst/contracts';
import {
  REGULATORY_SOURCE_RECORDED_AT,
  REGULATORY_SOURCE_RELATIONSHIPS_V1,
  REGULATORY_SOURCE_V1,
} from './regulatory-source-reference-data';
import { assertPublishedVersionMatches } from '../src/adaptive-configuration/adaptive-reference-integrity';
import {
  ANITA_GTC45_GUIDANCE_MANIFEST,
  METHODOLOGY_SOURCE_MANIFESTS,
  RISK_METHOD_MANIFESTS,
  RISK_METHOD_REFERENCE_IDS,
  RISK_METHOD_REGULATORY_CONTEXT_MANIFESTS,
} from '../src/risk-methodology/risk-method-reference-data';

const prisma = new PrismaClient();

function asJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function assertRiskReferenceMatches(label: string, actual: unknown, expected: unknown) {
  if (adaptiveContentHash(actual) !== adaptiveContentHash(expected))
    throw new Error(`RISK_METHOD_REFERENCE_DRIFT:${label}`);
}

async function provisionRiskMethodologyReferenceData() {
  for (const method of RISK_METHOD_MANIFESTS) {
    if (riskMethodContentHash(method) !== method.contentHash)
      throw new Error(`RISK_METHOD_CONTENT_HASH_MISMATCH:${method.methodKey}`);
  }

  for (const source of METHODOLOGY_SOURCE_MANIFESTS) {
    const definition = await prisma.methodologySource.upsert({
      where: { sourceKey: source.sourceKey },
      update: {},
      create: {
        id: RISK_METHOD_REFERENCE_IDS.sources[source.sourceKey],
        sourceKey: source.sourceKey,
      },
      select: { id: true },
    });
    const existing = await prisma.methodologySourceVersion.findUnique({
      where: {
        sourceId_semanticVersion: {
          sourceId: definition.id,
          semanticVersion: source.sourceVersion,
        },
      },
    });
    if (existing) {
      assertRiskReferenceMatches(
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
        id: RISK_METHOD_REFERENCE_IDS.sourceVersions[source.sourceKey],
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
    const definition = await prisma.riskMethodDefinition.upsert({
      where: { methodKey: method.methodKey },
      update: {},
      create: {
        id: RISK_METHOD_REFERENCE_IDS.definitions[method.methodKey],
        methodKey: method.methodKey,
      },
      select: { id: true },
    });
    const existing = await prisma.riskMethodVersion.findUnique({
      where: {
        methodDefinitionId_semanticVersion: {
          methodDefinitionId: definition.id,
          semanticVersion: method.semanticVersion,
        },
      },
    });
    if (existing) {
      assertRiskReferenceMatches(
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
        id: RISK_METHOD_REFERENCE_IDS.versions[method.methodKey],
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
  if (!gtcLink)
    await prisma.riskMethodSourceLink.create({
      data: {
        id: RISK_METHOD_REFERENCE_IDS.sourceLinks.GTC45_2010,
        riskMethodVersionId: RISK_METHOD_REFERENCE_IDS.versions.GTC45_2010,
        methodologySourceVersionId: RISK_METHOD_REFERENCE_IDS.sourceVersions.CO_GTC45_2010,
      },
    });

  const guidance = ANITA_GTC45_GUIDANCE_MANIFEST;
  const existingGuidance = await prisma.riskMethodExpertGuidanceVersion.findUnique({
    where: {
      guidanceKey_guidanceVersion: {
        guidanceKey: guidance.guidanceKey,
        guidanceVersion: guidance.guidanceVersion,
      },
    },
  });
  if (existingGuidance)
    assertRiskReferenceMatches(
      `GUIDANCE:${guidance.guidanceKey}:${guidance.guidanceVersion}`,
      {
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
  else
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

  for (const context of RISK_METHOD_REGULATORY_CONTEXT_MANIFESTS) {
    const existing = await prisma.riskMethodRegulatoryContext.findUnique({
      where: {
        contextKey_contextVersion: {
          contextKey: context.contextKey,
          contextVersion: context.contextVersion,
        },
      },
    });
    if (existing) {
      assertRiskReferenceMatches(
        `CONTEXT:${context.contextKey}:${context.contextVersion}`,
        {
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
    const methodKey = context.methodKey as keyof typeof RISK_METHOD_REFERENCE_IDS.versions;
    const contextId =
      context.methodKey === 'GUIDED_5X5'
        ? RISK_METHOD_REFERENCE_IDS.contexts.GUIDED_5X5_EC
        : RISK_METHOD_REFERENCE_IDS.contexts.GTC45_2010_EC;
    await prisma.riskMethodRegulatoryContext.create({
      data: {
        id: contextId,
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

async function provisionAdaptiveDemoReferenceData() {
  const factVersionIds = new Map<string, string>();
  for (const fact of DEMO_ADAPTIVE_RULE_PACK.factVersions) {
    const definition = await prisma.adaptiveFactDefinition.upsert({
      where: { factKey: fact.factKey },
      update: {},
      create: {
        factKey: fact.factKey,
        category: fact.category,
        defaultScope: fact.defaultScope,
      },
      select: { id: true },
    });
    const existing = await prisma.adaptiveFactVersion.findUnique({
      where: {
        factDefinitionId_version: { factDefinitionId: definition.id, version: fact.version },
      },
      select: {
        id: true,
        valueType: true,
        questionText: true,
        helpText: true,
        unknownAllowed: true,
        collectionMode: true,
        validation: true,
        choiceOptions: true,
        priority: true,
      },
    });
    const factPayload = {
      valueType: fact.valueType,
      questionText: fact.questionText,
      helpText: fact.helpText,
      unknownAllowed: fact.unknownAllowed,
      collectionMode: fact.collectionMode,
      validation: {
        ...(fact.min === undefined ? {} : { min: fact.min }),
        ...(fact.max === undefined ? {} : { max: fact.max }),
        ...(fact.maxLength === undefined ? {} : { maxLength: fact.maxLength }),
      },
      choiceOptions: fact.choices,
      priority: fact.priority,
    };
    if (existing)
      assertPublishedVersionMatches(`FACT:${fact.factKey}:${fact.version}`, existing, {
        id: existing.id,
        ...factPayload,
      });
    const version =
      existing ??
      (await prisma.adaptiveFactVersion.create({
        data: {
          factDefinitionId: definition.id,
          version: fact.version,
          ...factPayload,
        },
        select: { id: true },
      }));
    factVersionIds.set(fact.factKey, version.id);
  }

  const targetVersionIds = new Map<string, string>();
  for (const target of DEMO_ADAPTIVE_RULE_PACK.targetVersions) {
    const definition = await prisma.adaptiveConfigurationTargetDefinition.upsert({
      where: { targetKey: target.targetKey },
      update: {},
      create: { targetKey: target.targetKey },
      select: { id: true },
    });
    const existing = await prisma.adaptiveConfigurationTargetVersion.findUnique({
      where: {
        targetDefinitionId_version: {
          targetDefinitionId: definition.id,
          version: target.version,
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        currentStateQuestion: true,
        evidenceSuggestions: true,
        isDemo: true,
      },
    });
    const targetPayload = {
      title: target.title,
      description: target.description,
      category: target.category,
      currentStateQuestion: target.currentStateQuestion,
      evidenceSuggestions: target.evidenceSuggestions,
      isDemo: true,
    };
    if (existing)
      assertPublishedVersionMatches(`TARGET:${target.targetKey}:${target.version}`, existing, {
        id: existing.id,
        ...targetPayload,
      });
    const version =
      existing ??
      (await prisma.adaptiveConfigurationTargetVersion.create({
        data: {
          targetDefinitionId: definition.id,
          version: target.version,
          ...targetPayload,
        },
        select: { id: true },
      }));
    targetVersionIds.set(target.targetKey, version.id);
  }

  const ruleVersionIds = new Map<string, string>();
  for (const rule of DEMO_ADAPTIVE_RULE_PACK.rules) {
    const normalizedRule = normalizeAdaptiveRuleVersion(rule);
    const definition = await prisma.adaptiveRuleDefinition.upsert({
      where: { ruleKey: rule.ruleKey },
      update: {},
      create: { ruleKey: rule.ruleKey },
      select: { id: true },
    });
    const draft = await prisma.adaptiveRuleDraft.upsert({
      where: { ruleDefinitionId_revision: { ruleDefinitionId: definition.id, revision: 1 } },
      update: {},
      create: {
        ruleDefinitionId: definition.id,
        revision: 1,
        status: 'READY_TO_PUBLISH',
        schema: normalizedRule as Prisma.InputJsonValue,
        isDemo: true,
        regulatory: false,
        demoDisclaimer: DEMO_ADAPTIVE_RULE_PACK.disclaimer,
        technicalReviewedAt: new Date(),
        legalReviewedAt: new Date(),
      },
    });
    assertPublishedVersionMatches(
      `RULE_DRAFT:${rule.ruleKey}:1`,
      {
        schema: draft.schema,
        isDemo: draft.isDemo,
        regulatory: draft.regulatory,
        demoDisclaimer: draft.demoDisclaimer,
      },
      {
        schema: normalizedRule,
        isDemo: true,
        regulatory: false,
        demoDisclaimer: DEMO_ADAPTIVE_RULE_PACK.disclaimer,
      },
    );
    const existing = await prisma.adaptiveRuleVersion.findUnique({
      where: {
        ruleDefinitionId_version: { ruleDefinitionId: definition.id, version: rule.version },
      },
      select: {
        id: true,
        schema: true,
        isDemo: true,
        regulatory: true,
        demoDisclaimer: true,
        sourceDraftId: true,
        sealedAt: true,
      },
    });
    if (existing) {
      assertPublishedVersionMatches(
        `RULE:${rule.ruleKey}:${rule.version}`,
        {
          schema: existing.schema,
          isDemo: existing.isDemo,
          regulatory: existing.regulatory,
          demoDisclaimer: existing.demoDisclaimer,
          sourceDraftId: existing.sourceDraftId,
        },
        {
          schema: normalizedRule,
          isDemo: true,
          regulatory: false,
          demoDisclaimer: DEMO_ADAPTIVE_RULE_PACK.disclaimer,
          sourceDraftId: draft.id,
        },
      );
      if (!existing.sealedAt)
        throw new Error(`PUBLISHED_VERSION_DRIFT:RULE_UNSEALED:${rule.ruleKey}`);
    }
    let versionId = existing?.id;
    if (!versionId) {
      const createdVersion = await prisma.adaptiveRuleVersion.create({
        data: {
          ruleDefinitionId: definition.id,
          version: rule.version,
          schema: normalizedRule as Prisma.InputJsonValue,
          isDemo: true,
          regulatory: false,
          demoDisclaimer: DEMO_ADAPTIVE_RULE_PACK.disclaimer,
          sourceDraftId: draft.id,
        },
        select: { id: true },
      });
      versionId = createdVersion.id;
      const now = new Date();
      await prisma.adaptiveRuleVersion.update({
        where: { id: versionId },
        data: { publishedAt: now, sealedAt: now },
      });
      await prisma.adaptiveRuleDraft.update({
        where: { id: draft.id },
        data: { status: 'PUBLISHED' },
      });
    }
    ruleVersionIds.set(rule.ruleKey, versionId);
  }

  const groupVersionIds = new Map<string, string>();
  for (const group of DEMO_ADAPTIVE_RULE_PACK.groups) {
    const normalizedGroup = normalizeAdaptiveGroupVersion(group);
    const expectedRuleVersionIds = normalizedGroup.ruleKeys.map((ruleKey) =>
      ruleVersionIds.get(ruleKey)!,
    );
    const definition = await prisma.adaptiveRuleGroupDefinition.upsert({
      where: { groupKey: group.groupKey },
      update: {},
      create: { groupKey: group.groupKey },
      select: { id: true },
    });
    const existing = await prisma.adaptiveRuleGroupVersion.findUnique({
      where: {
        groupDefinitionId_version: { groupDefinitionId: definition.id, version: group.version },
      },
      select: {
        id: true,
        title: true,
        priority: true,
        scopeMode: true,
        activationExpression: true,
        isDemo: true,
        regulatory: true,
        sealedAt: true,
        groupRules: { select: { ruleVersionId: true, sortOrder: true } },
      },
    });
    if (existing) {
      assertPublishedVersionMatches(
        `GROUP:${group.groupKey}:${group.version}`,
        {
          title: existing.title,
          priority: existing.priority,
          scopeMode: existing.scopeMode,
          activationExpression: existing.activationExpression,
          isDemo: existing.isDemo,
          regulatory: existing.regulatory,
          ruleVersionIds: existing.groupRules
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map(({ ruleVersionId }) => ruleVersionId),
        },
        {
          title: normalizedGroup.title,
          priority: normalizedGroup.priority,
          scopeMode: normalizedGroup.scopeMode,
          activationExpression: normalizedGroup.activation,
          isDemo: true,
          regulatory: false,
          ruleVersionIds: expectedRuleVersionIds,
        },
      );
      if (!existing.sealedAt)
        throw new Error(`PUBLISHED_VERSION_DRIFT:GROUP_UNSEALED:${group.groupKey}`);
    }
    let versionId = existing?.id;
    if (!versionId) {
      const createdVersion = await prisma.adaptiveRuleGroupVersion.create({
        data: {
          groupDefinitionId: definition.id,
          version: group.version,
          title: normalizedGroup.title,
          priority: normalizedGroup.priority,
          scopeMode: normalizedGroup.scopeMode,
          activationExpression: normalizedGroup.activation as Prisma.InputJsonValue,
          isDemo: true,
          regulatory: false,
        },
        select: { id: true },
      });
      versionId = createdVersion.id;
      const createdVersionId = createdVersion.id;
      await prisma.adaptiveRuleGroupRule.createMany({
        data: expectedRuleVersionIds.map((ruleVersionId, sortOrder) => ({
          groupVersionId: createdVersionId,
          ruleVersionId,
          sortOrder,
        })),
      });
      const now = new Date();
      await prisma.adaptiveRuleGroupVersion.update({
        where: { id: createdVersionId },
        data: { publishedAt: now, sealedAt: now },
      });
    }
    groupVersionIds.set(group.groupKey, versionId);
  }

  const packDefinition = await prisma.adaptiveRulePackDefinition.upsert({
    where: { packKey: DEMO_ADAPTIVE_RULE_PACK.packKey },
    update: {},
    create: {
      packKey: DEMO_ADAPTIVE_RULE_PACK.packKey,
      name: DEMO_ADAPTIVE_RULE_PACK.name,
    },
    select: { id: true },
  });
  const packContentHash = adaptivePackContentHash(DEMO_ADAPTIVE_RULE_PACK, {
    factVersions: DEMO_ADAPTIVE_RULE_PACK.factVersions.map((fact) => ({
      id: factVersionIds.get(fact.factKey)!,
      factKey: fact.factKey,
      version: fact.version,
    })),
    targetVersions: DEMO_ADAPTIVE_RULE_PACK.targetVersions.map((target) => ({
      id: targetVersionIds.get(target.targetKey)!,
      targetKey: target.targetKey,
      version: target.version,
    })),
    ruleVersions: DEMO_ADAPTIVE_RULE_PACK.rules.map((rule) => ({
      id: ruleVersionIds.get(rule.ruleKey)!,
      ruleKey: rule.ruleKey,
      version: rule.version,
    })),
    groupVersions: DEMO_ADAPTIVE_RULE_PACK.groups.map((group) => ({
      id: groupVersionIds.get(group.groupKey)!,
      groupKey: group.groupKey,
      version: group.version,
    })),
  });
  const packVersion = await prisma.adaptiveRulePackVersion.findUnique({
    where: {
      packDefinitionId_version: {
        packDefinitionId: packDefinition.id,
        version: DEMO_ADAPTIVE_RULE_PACK.version,
      },
    },
    select: {
      id: true,
      engineSchemaVersion: true,
      schema: true,
      contentHash: true,
      isDemo: true,
      regulatory: true,
      disclaimer: true,
      sealedAt: true,
      facts: { select: { factVersionId: true } },
      targets: { select: { targetVersionId: true } },
      rules: { select: { ruleVersionId: true } },
      groups: { select: { groupVersionId: true } },
    },
  });
  let packVersionId: string;
  if (packVersion) {
    packVersionId = packVersion.id;
    assertPublishedVersionMatches(
      `PACK:${DEMO_ADAPTIVE_RULE_PACK.packKey}:1.0.0`,
      {
        engineSchemaVersion: packVersion.engineSchemaVersion,
        schema: packVersion.schema,
        contentHash: packVersion.contentHash,
        isDemo: packVersion.isDemo,
        regulatory: packVersion.regulatory,
        disclaimer: packVersion.disclaimer,
        facts: packVersion.facts.map(({ factVersionId }) => factVersionId).sort(),
        targets: packVersion.targets.map(({ targetVersionId }) => targetVersionId).sort(),
        rules: packVersion.rules.map(({ ruleVersionId }) => ruleVersionId).sort(),
        groups: packVersion.groups.map(({ groupVersionId }) => groupVersionId).sort(),
      },
      {
        engineSchemaVersion: DEMO_ADAPTIVE_RULE_PACK.engineSchemaVersion,
        schema: DEMO_ADAPTIVE_RULE_PACK,
        contentHash: packContentHash,
        isDemo: true,
        regulatory: false,
        disclaimer: DEMO_ADAPTIVE_RULE_PACK.disclaimer,
        facts: [...factVersionIds.values()].sort(),
        targets: [...targetVersionIds.values()].sort(),
        rules: [...ruleVersionIds.values()].sort(),
        groups: [...groupVersionIds.values()].sort(),
      },
    );
    if (!packVersion.sealedAt) throw new Error('PUBLISHED_VERSION_DRIFT:PACK_UNSEALED');
  } else {
    const createdPackVersion = await prisma.adaptiveRulePackVersion.create({
      data: {
        packDefinitionId: packDefinition.id,
        version: DEMO_ADAPTIVE_RULE_PACK.version,
        engineSchemaVersion: DEMO_ADAPTIVE_RULE_PACK.engineSchemaVersion,
        schema: DEMO_ADAPTIVE_RULE_PACK as Prisma.InputJsonValue,
        contentHash: packContentHash,
        isDemo: true,
        regulatory: false,
        disclaimer: DEMO_ADAPTIVE_RULE_PACK.disclaimer,
      },
      select: { id: true },
    });
    packVersionId = createdPackVersion.id;
    await Promise.all([
      prisma.adaptiveRulePackFact.createMany({
        data: [...factVersionIds.values()].map((factVersionId) => ({
          packVersionId,
          factVersionId,
        })),
      }),
      prisma.adaptiveRulePackTarget.createMany({
        data: [...targetVersionIds.values()].map((targetVersionId) => ({
          packVersionId,
          targetVersionId,
        })),
      }),
      prisma.adaptiveRulePackRule.createMany({
        data: [...ruleVersionIds.values()].map((ruleVersionId) => ({
          packVersionId,
          ruleVersionId,
        })),
      }),
      prisma.adaptiveRulePackGroup.createMany({
        data: [...groupVersionIds.values()].map((groupVersionId) => ({
          packVersionId,
          groupVersionId,
        })),
      }),
    ]);
    const now = new Date();
    await prisma.adaptiveRulePackVersion.update({
      where: { id: packVersionId },
      data: { publishedAt: now, sealedAt: now },
    });
  }
}

const modules = [
  ['CORE', 'Núcleo SST', 'Organización, acceso, evidencias y trazabilidad común.'],
  ['INSPECTIONS_INTELLIGENCE', 'Inspecciones inteligentes', 'Centraliza hallazgos y recurrencias.'],
  ['TECHNICAL_RISK', 'Riesgo técnico', 'Presenta controles e indicadores técnicos sintéticos.'],
  ['WORK_PERMITS', 'Permisos de trabajo', 'Prepara la trazabilidad de actividades críticas.'],
  ['PSYCHOSOCIAL', 'Gestión psicosocial', 'Organiza campañas y seguimiento agregado no clínico.'],
  ['COMPLIANCE', 'Cumplimiento', 'Ordena evidencias, compromisos y reportería.'],
] as const;

const plans = [
  ['FREE', 'Free', 'Exploración y diagnóstico inicial.'],
  ['STARTER', 'Starter', 'Inicio gradual para equipos pequeños.'],
  ['GROWTH', 'Growth', 'Operaciones con varios centros y módulos.'],
  ['ENTERPRISE', 'Enterprise', 'Gobierno y escala empresarial.'],
] as const;

const features = [
  ['organization.max_work_centers', 'Máximo de centros de trabajo', 'INTEGER'],
  ['organization.max_members', 'Máximo de miembros', 'INTEGER'],
  ['demo.enabled', 'Permite activar demostración', 'BOOLEAN'],
  ['demo.duration_days', 'Duración de demostración', 'INTEGER'],
  ['ai.monthly_actions', 'Acciones mensuales de IA', 'INTEGER'],
  ['module.inspections', 'Módulo de inspecciones', 'BOOLEAN'],
  ['module.technical_risk', 'Módulo de riesgo técnico', 'BOOLEAN'],
  ['module.work_permits', 'Módulo de permisos', 'BOOLEAN'],
  ['module.psychosocial', 'Módulo psicosocial', 'BOOLEAN'],
  ['module.compliance', 'Módulo de cumplimiento', 'BOOLEAN'],
] as const;

const planValues: Record<PlanKey, Record<string, string>> = {
  FREE: {
    'organization.max_work_centers': '1',
    'organization.max_members': '2',
    'demo.enabled': 'true',
    'demo.duration_days': '14',
    'ai.monthly_actions': '0',
    'module.inspections': 'false',
    'module.technical_risk': 'false',
    'module.work_permits': 'false',
    'module.psychosocial': 'false',
    'module.compliance': 'false',
  },
  STARTER: {
    'organization.max_work_centers': '3',
    'organization.max_members': '10',
    'demo.enabled': 'true',
    'demo.duration_days': '14',
    'ai.monthly_actions': '25',
    'module.inspections': 'true',
    'module.technical_risk': 'false',
    'module.work_permits': 'false',
    'module.psychosocial': 'false',
    'module.compliance': 'true',
  },
  GROWTH: {
    'organization.max_work_centers': '12',
    'organization.max_members': '50',
    'demo.enabled': 'true',
    'demo.duration_days': '21',
    'ai.monthly_actions': '150',
    'module.inspections': 'true',
    'module.technical_risk': 'true',
    'module.work_permits': 'true',
    'module.psychosocial': 'true',
    'module.compliance': 'true',
  },
  ENTERPRISE: {
    'organization.max_work_centers': '10000',
    'organization.max_members': '10000',
    'demo.enabled': 'true',
    'demo.duration_days': '30',
    'ai.monthly_actions': '1000',
    'module.inspections': 'true',
    'module.technical_risk': 'true',
    'module.work_permits': 'true',
    'module.psychosocial': 'true',
    'module.compliance': 'true',
  },
};

async function main() {
  await provisionRiskMethodologyReferenceData();
  for (const [index, [key, name, description]] of modules.entries()) {
    await prisma.moduleDefinition.upsert({
      where: { key: key as ModuleKey },
      update: { name, description },
      create: {
        key: key as ModuleKey,
        name,
        description,
        objective: description,
        sortOrder: index,
        demoContent: {
          label: 'Demostración conceptual',
          indicators: [
            { label: 'Registros sintéticos', value: 12 },
            { label: 'Seguimiento de ejemplo', value: '83%' },
          ],
        },
      },
    });
  }

  const planRows = new Map<PlanKey, string>();
  for (const [index, [key, name, description]] of plans.entries()) {
    const plan = await prisma.plan.upsert({
      where: { key: key as PlanKey },
      update: { name, description, sortOrder: index },
      create: { key: key as PlanKey, name, description, sortOrder: index },
    });
    planRows.set(key as PlanKey, plan.id);
  }

  const featureRows = new Map<string, string>();
  for (const [key, description, valueType] of features) {
    const feature = await prisma.featureDefinition.upsert({
      where: { key },
      update: { description, valueType: valueType as FeatureValueType },
      create: { key, description, valueType: valueType as FeatureValueType },
    });
    featureRows.set(key, feature.id);
  }

  for (const [planKey, values] of Object.entries(planValues) as [
    PlanKey,
    Record<string, string>,
  ][]) {
    for (const [featureKey, value] of Object.entries(values)) {
      await prisma.planFeature.upsert({
        where: {
          planId_featureId: {
            planId: planRows.get(planKey)!,
            featureId: featureRows.get(featureKey)!,
          },
        },
        update: { value },
        create: {
          planId: planRows.get(planKey)!,
          featureId: featureRows.get(featureKey)!,
          value,
        },
      });
    }
  }

  await prisma.guidedFlowDefinition.upsert({
    where: { key_version: { key: 'solution-finder', version: '1.0.0' } },
    update: { active: true },
    create: {
      key: 'solution-finder',
      version: '1.0.0',
      schema: {
        steps: ['company', 'operation', 'management', 'people', 'objectives', 'commercial'],
      },
    },
  });

  let demoMethod = await prisma.technicalMethodDefinition.findFirst({
    where: { organizationId: null, key: DEMO_TECHNICAL_RISK_METHOD.methodKey },
  });
  demoMethod ??= await prisma.technicalMethodDefinition.create({
    data: {
      key: DEMO_TECHNICAL_RISK_METHOD.methodKey,
      name: DEMO_TECHNICAL_RISK_METHOD.methodName,
      description:
        'Método sintético para demostrar evaluaciones técnicas determinísticas y versionadas.',
      category: 'GENERAL_RISK',
      status: 'ACTIVE',
    },
  });
  const existingVersion = await prisma.technicalMethodVersion.findUnique({
    where: {
      methodDefinitionId_version: {
        methodDefinitionId: demoMethod.id,
        version: DEMO_TECHNICAL_RISK_METHOD.methodVersion,
      },
    },
  });
  if (!existingVersion) {
    await prisma.technicalMethodVersion.create({
      data: {
        methodDefinitionId: demoMethod.id,
        version: DEMO_TECHNICAL_RISK_METHOD.methodVersion,
        schema: DEMO_TECHNICAL_RISK_METHOD.schema as Prisma.InputJsonValue,
        calculationKey: DEMO_TECHNICAL_RISK_METHOD.calculationKey,
        regulatory: false,
        isDemo: true,
        disclaimer: DEMO_TECHNICAL_RISK_METHOD.disclaimer,
        country: null,
        status: 'ACTIVE',
      },
    });
  } else if (
    !existingVersion.isDemo ||
    existingVersion.disclaimer !== DEMO_TECHNICAL_RISK_METHOD.disclaimer
  ) {
    await prisma.technicalMethodVersion.update({
      where: { id: existingVersion.id },
      data: {
        isDemo: true,
        disclaimer: DEMO_TECHNICAL_RISK_METHOD.disclaimer,
      },
    });
  }

  const existingApplicabilityPack = await prisma.applicabilityRulePackVersion.findUnique({
    where: {
      key_version: {
        key: DEMO_APPLICABILITY_RULE_PACK.key,
        version: DEMO_APPLICABILITY_RULE_PACK.version,
      },
    },
    select: { id: true },
  });
  if (!existingApplicabilityPack) {
    await prisma.applicabilityRulePackVersion.create({
      data: {
        key: DEMO_APPLICABILITY_RULE_PACK.key,
        name: DEMO_APPLICABILITY_RULE_PACK.name,
        version: DEMO_APPLICABILITY_RULE_PACK.version,
        schema: DEMO_APPLICABILITY_RULE_PACK as Prisma.InputJsonValue,
        status: 'ACTIVE',
        sourceType: DEMO_APPLICABILITY_RULE_PACK.source.type,
        sourceReference: DEMO_APPLICABILITY_RULE_PACK.source.reference,
        regulatory: DEMO_APPLICABILITY_RULE_PACK.regulatory,
        isDemo: DEMO_APPLICABILITY_RULE_PACK.isDemo,
        disclaimer: DEMO_APPLICABILITY_RULE_PACK.disclaimer,
        activatedAt: new Date(),
      },
    });
  }

  const sourceIds = new Map<string, string>();
  for (const source of REGULATORY_SOURCE_V1) {
    const row = await prisma.regulatorySource.upsert({
      where: { sourceKey: source.sourceKey },
      update: {},
      create: {
        id: source.id,
        sourceKey: source.sourceKey,
        countryCode: source.countryCode,
        issuer: source.issuer,
        documentType: source.documentType as RegulatoryDocumentType,
        referenceNumber: source.referenceNumber,
        canonicalTitle: source.canonicalTitle,
      },
      select: { id: true },
    });
    sourceIds.set(source.sourceKey, row.id);
  }

  await prisma.regulatorySourceVersion.createMany({
    data: REGULATORY_SOURCE_V1.map((source, index) => ({
      id: `a2000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      sourceId: sourceIds.get(source.sourceKey)!,
      catalogVersion: 1,
      candidateStatus: source.candidateStatus as RegulatoryCandidateStatus,
      officialDocumentLocated: source.officialDocumentLocated,
      officialUrl: source.officialUrl,
      publicationDate: null,
      effectiveFrom: null,
      effectiveTo: null,
      supersessionStatus: source.supersessionStatus as RegulatorySupersessionStatus,
      readyForExtraction: false,
      readyForRules: false,
      reviewNotes: source.reviewNotes,
      recordedAt: REGULATORY_SOURCE_RECORDED_AT,
    })),
    skipDuplicates: true,
  });

  await prisma.regulatorySourceRelationship.createMany({
    data: REGULATORY_SOURCE_RELATIONSHIPS_V1.map((relationship) => ({
      id: relationship.id,
      fromSourceId: sourceIds.get(relationship.fromSourceKey)!,
      toSourceId: sourceIds.get(relationship.toSourceKey)!,
      relationshipType: relationship.relationshipType as RegulatoryRelationshipType,
      reviewStatus: relationship.reviewStatus as RegulatoryRelationshipReviewStatus,
      notes: relationship.notes,
      createdAt: REGULATORY_SOURCE_RECORDED_AT,
    })),
    skipDuplicates: true,
  });

  await provisionAdaptiveDemoReferenceData();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
