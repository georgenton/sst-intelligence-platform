import { Prisma } from '@prisma/client';
import {
  CANONICAL_ASSESSMENT_ADAPTIVE_RULE_PACK_V2,
  DEMO_ADAPTIVE_RULE_PACK,
  adaptivePackContentHash,
  normalizeAdaptiveGroupVersion,
  normalizeAdaptiveRuleVersion,
  type AdaptiveRulePackContract,
} from '@sst/contracts';
import { assertPublishedVersionMatches } from '../adaptive-configuration/adaptive-reference-integrity';

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

function drift(label: string): never {
  throw new Error(`ADAPTIVE_ASSESSMENT_REFERENCE_DRIFT:${label}`);
}

async function syncPack(prisma: Prisma.TransactionClient, pack: AdaptiveRulePackContract) {
  const factVersionIds = new Map<string, string>();
  for (const fact of pack.factVersions) {
    const definition = await prisma.adaptiveFactDefinition.upsert({
      where: { factKey: fact.factKey },
      update: {},
      create: { factKey: fact.factKey, category: fact.category, defaultScope: fact.defaultScope },
    });
    assertPublishedVersionMatches(`ADAPTIVE_FACT_DEFINITION:${fact.factKey}`, definition, {
      ...definition,
      category: fact.category,
      defaultScope: fact.defaultScope,
    });
    const payload = {
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
    const existing = await prisma.adaptiveFactVersion.findUnique({
      where: {
        factDefinitionId_version: { factDefinitionId: definition.id, version: fact.version },
      },
    });
    if (existing) {
      assertPublishedVersionMatches(`ADAPTIVE_FACT:${fact.factKey}:${fact.version}`, existing, {
        ...existing,
        ...payload,
      });
    }
    const version =
      existing ??
      (await prisma.adaptiveFactVersion.create({
        data: { factDefinitionId: definition.id, version: fact.version, ...payload },
      }));
    factVersionIds.set(fact.factKey, version.id);
  }

  const targetVersionIds = new Map<string, string>();
  for (const target of pack.targetVersions) {
    const definition = await prisma.adaptiveConfigurationTargetDefinition.upsert({
      where: { targetKey: target.targetKey },
      update: {},
      create: { targetKey: target.targetKey },
    });
    const payload = {
      title: target.title,
      description: target.description,
      category: target.category,
      currentStateQuestion: target.currentStateQuestion,
      evidenceSuggestions: target.evidenceSuggestions,
      isDemo: true,
    };
    const existing = await prisma.adaptiveConfigurationTargetVersion.findUnique({
      where: {
        targetDefinitionId_version: {
          targetDefinitionId: definition.id,
          version: target.version,
        },
      },
    });
    if (existing) {
      assertPublishedVersionMatches(
        `ADAPTIVE_TARGET:${target.targetKey}:${target.version}`,
        existing,
        { ...existing, ...payload },
      );
    }
    const version =
      existing ??
      (await prisma.adaptiveConfigurationTargetVersion.create({
        data: { targetDefinitionId: definition.id, version: target.version, ...payload },
      }));
    targetVersionIds.set(target.targetKey, version.id);
  }

  const ruleVersionIds = new Map<string, string>();
  for (const rule of pack.rules) {
    const revision = Number(rule.version.split('.')[0]);
    const schema = normalizeAdaptiveRuleVersion(rule);
    const definition = await prisma.adaptiveRuleDefinition.upsert({
      where: { ruleKey: rule.ruleKey },
      update: {},
      create: { ruleKey: rule.ruleKey },
    });
    const draft = await prisma.adaptiveRuleDraft.upsert({
      where: { ruleDefinitionId_revision: { ruleDefinitionId: definition.id, revision } },
      update: {},
      create: {
        ruleDefinitionId: definition.id,
        revision,
        status: 'READY_TO_PUBLISH',
        schema: asJson(schema),
        isDemo: true,
        regulatory: false,
        demoDisclaimer: pack.disclaimer,
        technicalReviewedAt: new Date(),
        legalReviewedAt: new Date(),
      },
    });
    assertPublishedVersionMatches(`ADAPTIVE_RULE_DRAFT:${rule.ruleKey}:${revision}`, draft, {
      ...draft,
      schema,
      isDemo: true,
      regulatory: false,
      demoDisclaimer: pack.disclaimer,
    });
    const payload = {
      schema,
      isDemo: true,
      regulatory: false,
      demoDisclaimer: pack.disclaimer,
      sourceDraftId: draft.id,
    };
    let version = await prisma.adaptiveRuleVersion.findUnique({
      where: {
        ruleDefinitionId_version: { ruleDefinitionId: definition.id, version: rule.version },
      },
    });
    if (version) {
      assertPublishedVersionMatches(`ADAPTIVE_RULE:${rule.ruleKey}:${rule.version}`, version, {
        ...version,
        ...payload,
      });
      if (!version.publishedAt || !version.sealedAt) drift(`RULE_UNSEALED:${rule.ruleKey}`);
    } else {
      const now = new Date();
      version = await prisma.adaptiveRuleVersion.create({
        data: {
          ruleDefinitionId: definition.id,
          version: rule.version,
          ...payload,
          schema: asJson(schema),
        },
      });
      version = await prisma.adaptiveRuleVersion.update({
        where: { id: version.id },
        data: { publishedAt: now, sealedAt: now },
      });
      await prisma.adaptiveRuleDraft.update({
        where: { id: draft.id },
        data: { status: 'PUBLISHED' },
      });
    }
    ruleVersionIds.set(rule.ruleKey, version.id);
  }

  const groupVersionIds = new Map<string, string>();
  for (const group of pack.groups) {
    const normalized = normalizeAdaptiveGroupVersion(group);
    const expectedRuleIds = normalized.ruleKeys.map((key) => ruleVersionIds.get(key)!);
    const definition = await prisma.adaptiveRuleGroupDefinition.upsert({
      where: { groupKey: group.groupKey },
      update: {},
      create: { groupKey: group.groupKey },
    });
    let version = await prisma.adaptiveRuleGroupVersion.findUnique({
      where: {
        groupDefinitionId_version: { groupDefinitionId: definition.id, version: group.version },
      },
      include: {
        groupRules: { orderBy: [{ sortOrder: 'asc' }, { ruleVersionId: 'asc' }] },
      },
    });
    const payload = {
      title: normalized.title,
      priority: normalized.priority,
      scopeMode: normalized.scopeMode,
      activationExpression: normalized.activation,
      isDemo: true,
      regulatory: false,
    };
    if (version) {
      assertPublishedVersionMatches(`ADAPTIVE_GROUP:${group.groupKey}:${group.version}`, version, {
        ...version,
        ...payload,
        groupRules: expectedRuleIds.map((ruleVersionId, sortOrder) => ({
          groupVersionId: version!.id,
          ruleVersionId,
          sortOrder,
        })),
      });
      if (!version.publishedAt || !version.sealedAt) drift(`GROUP_UNSEALED:${group.groupKey}`);
    } else {
      const now = new Date();
      version = await prisma.adaptiveRuleGroupVersion.create({
        data: {
          groupDefinitionId: definition.id,
          version: group.version,
          ...payload,
          activationExpression: asJson(normalized.activation),
          groupRules: {
            create: expectedRuleIds.map((ruleVersionId, sortOrder) => ({
              ruleVersionId,
              sortOrder,
            })),
          },
        },
        include: { groupRules: true },
      });
      version = await prisma.adaptiveRuleGroupVersion.update({
        where: { id: version.id },
        data: { publishedAt: now, sealedAt: now },
        include: { groupRules: true },
      });
    }
    groupVersionIds.set(group.groupKey, version.id);
  }

  const definition = await prisma.adaptiveRulePackDefinition.upsert({
    where: { packKey: pack.packKey },
    update: {},
    create: { packKey: pack.packKey, name: pack.name },
  });
  if (definition.name !== pack.name && pack.version === '1.0.0') {
    drift(`PACK_DEFINITION:${pack.packKey}`);
  }
  const contentHash = adaptivePackContentHash(pack, {
    factVersions: pack.factVersions.map((item) => ({
      id: factVersionIds.get(item.factKey)!,
      factKey: item.factKey,
      version: item.version,
    })),
    targetVersions: pack.targetVersions.map((item) => ({
      id: targetVersionIds.get(item.targetKey)!,
      targetKey: item.targetKey,
      version: item.version,
    })),
    ruleVersions: pack.rules.map((item) => ({
      id: ruleVersionIds.get(item.ruleKey)!,
      ruleKey: item.ruleKey,
      version: item.version,
    })),
    groupVersions: pack.groups.map((item) => ({
      id: groupVersionIds.get(item.groupKey)!,
      groupKey: item.groupKey,
      version: item.version,
    })),
  });
  let packVersion = await prisma.adaptiveRulePackVersion.findUnique({
    where: { packDefinitionId_version: { packDefinitionId: definition.id, version: pack.version } },
    include: {
      facts: { orderBy: { factVersionId: 'asc' } },
      targets: { orderBy: { targetVersionId: 'asc' } },
      rules: { orderBy: { ruleVersionId: 'asc' } },
      groups: { orderBy: { groupVersionId: 'asc' } },
    },
  });
  const relationships = {
    facts: [...factVersionIds.values()].sort(),
    targets: [...targetVersionIds.values()].sort(),
    rules: [...ruleVersionIds.values()].sort(),
    groups: [...groupVersionIds.values()].sort(),
  };
  const payload = {
    engineSchemaVersion: pack.engineSchemaVersion,
    schema: pack,
    contentHash,
    isDemo: true,
    regulatory: false,
    disclaimer: pack.disclaimer,
  };
  if (packVersion) {
    assertPublishedVersionMatches(`ADAPTIVE_PACK:${pack.packKey}:${pack.version}`, packVersion, {
      ...packVersion,
      ...payload,
      facts: relationships.facts.map((factVersionId) => ({
        packVersionId: packVersion!.id,
        factVersionId,
      })),
      targets: relationships.targets.map((targetVersionId) => ({
        packVersionId: packVersion!.id,
        targetVersionId,
      })),
      rules: relationships.rules.map((ruleVersionId) => ({
        packVersionId: packVersion!.id,
        ruleVersionId,
      })),
      groups: relationships.groups.map((groupVersionId) => ({
        packVersionId: packVersion!.id,
        groupVersionId,
      })),
    });
    if (!packVersion.publishedAt || !packVersion.sealedAt) drift(`PACK_UNSEALED:${pack.version}`);
  } else {
    const now = new Date();
    packVersion = await prisma.adaptiveRulePackVersion.create({
      data: {
        packDefinitionId: definition.id,
        version: pack.version,
        ...payload,
        schema: asJson(pack),
        facts: { create: relationships.facts.map((factVersionId) => ({ factVersionId })) },
        targets: { create: relationships.targets.map((targetVersionId) => ({ targetVersionId })) },
        rules: { create: relationships.rules.map((ruleVersionId) => ({ ruleVersionId })) },
        groups: { create: relationships.groups.map((groupVersionId) => ({ groupVersionId })) },
      },
      include: { facts: true, targets: true, rules: true, groups: true },
    });
    packVersion = await prisma.adaptiveRulePackVersion.update({
      where: { id: packVersion.id },
      data: { publishedAt: now, sealedAt: now },
      include: { facts: true, targets: true, rules: true, groups: true },
    });
  }
  return { version: pack.version, id: packVersion.id, contentHash };
}

export async function syncAdaptiveAssessmentReferences(prisma: Prisma.TransactionClient) {
  const versions = [];
  versions.push(await syncPack(prisma, DEMO_ADAPTIVE_RULE_PACK));
  versions.push(await syncPack(prisma, CANONICAL_ASSESSMENT_ADAPTIVE_RULE_PACK_V2));
  return {
    definitions: await prisma.adaptiveRulePackDefinition.count({
      where: { packKey: DEMO_ADAPTIVE_RULE_PACK.packKey },
    }),
    versions: await prisma.adaptiveRulePackVersion.count({
      where: { packDefinition: { packKey: DEMO_ADAPTIVE_RULE_PACK.packKey } },
    }),
    synchronized: versions,
  };
}
