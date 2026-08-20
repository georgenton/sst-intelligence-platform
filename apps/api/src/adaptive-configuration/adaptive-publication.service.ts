import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, type AdaptiveRuleRequirementType } from '@prisma/client';
import {
  adaptivePackContentHash,
  adaptiveRuleGroupVersionSchema,
  adaptiveRuleVersionSchema,
  assertAdaptiveRulePublication,
  normalizeAdaptiveGroupVersion,
  normalizeAdaptiveRuleVersion,
  validateAdaptivePack,
  type AdaptiveRuleGroupVersionContract,
  type AdaptiveRulePackContract,
} from '@sst/contracts';
import { PrismaService } from '../prisma/prisma.service';

type RequirementLink = {
  requirementId: string;
  relationshipType: AdaptiveRuleRequirementType;
};

@Injectable()
export class AdaptivePublicationService {
  constructor(private readonly prisma: PrismaService) {}

  publishRuleDraft(
    input: {
      draftId: string;
      version: string;
      requirementLinks?: RequirementLink[];
      supersedesRuleVersionId?: string;
    },
    transaction?: Prisma.TransactionClient,
  ) {
    const publish = async (tx: Prisma.TransactionClient) => {
      const draft = await tx.adaptiveRuleDraft.findUnique({
        where: { id: input.draftId },
        include: { ruleDefinition: true },
      });
      if (!draft || draft.status !== 'READY_TO_PUBLISH')
        throw new BadRequestException('ADAPTIVE_DRAFT_NOT_READY');
      const rule = normalizeAdaptiveRuleVersion(adaptiveRuleVersionSchema.parse(draft.schema));
      if (rule.ruleKey !== draft.ruleDefinition.ruleKey)
        throw new BadRequestException('ADAPTIVE_RULE_DEFINITION_MISMATCH');
      if (rule.version !== input.version)
        throw new BadRequestException('ADAPTIVE_RULE_VERSION_MISMATCH');
      if (rule.isDemo !== draft.isDemo || rule.regulatory !== draft.regulatory)
        throw new BadRequestException('ADAPTIVE_RULE_BOUNDARY_MISMATCH');
      if (input.supersedesRuleVersionId) {
        const predecessor = await tx.adaptiveRuleVersion.findUnique({
          where: { id: input.supersedesRuleVersionId },
          select: { ruleDefinitionId: true, sealedAt: true },
        });
        if (!predecessor?.sealedAt || predecessor.ruleDefinitionId !== draft.ruleDefinitionId)
          throw new BadRequestException('ADAPTIVE_RULE_PREDECESSOR_INVALID');
      }

      const requirementLinks = input.requirementLinks ?? [];
      const requirements = await tx.regulatoryRequirement.findMany({
        where: { id: { in: requirementLinks.map(({ requirementId }) => requirementId) } },
        select: { id: true, editorialStatus: true },
      });
      if (
        requirements.length !==
        new Set(requirementLinks.map(({ requirementId }) => requirementId)).size
      )
        throw new BadRequestException('ADAPTIVE_REQUIREMENT_NOT_FOUND');
      assertAdaptiveRulePublication({
        isDemo: draft.isDemo,
        regulatory: draft.regulatory,
        disclaimer: draft.demoDisclaimer ?? undefined,
        requirementStatuses: requirements.map(({ editorialStatus }) => editorialStatus),
      });

      const version = await tx.adaptiveRuleVersion.create({
        data: {
          ruleDefinitionId: draft.ruleDefinitionId,
          version: input.version,
          schema: rule as Prisma.InputJsonValue,
          isDemo: draft.isDemo,
          regulatory: draft.regulatory,
          demoDisclaimer: draft.demoDisclaimer,
          sourceDraftId: draft.id,
          supersedesRuleVersionId: input.supersedesRuleVersionId,
        },
      });
      if (requirementLinks.length > 0) {
        await tx.adaptiveRuleRequirement.createMany({
          data: requirementLinks.map((link) => ({ ...link, ruleVersionId: version.id })),
        });
      }
      const now = new Date();
      const sealed = await tx.adaptiveRuleVersion.update({
        where: { id: version.id },
        data: { publishedAt: now, sealedAt: now },
        include: { requirements: true, sourceDraft: true },
      });
      await tx.adaptiveRuleDraft.update({
        where: { id: draft.id },
        data: { status: 'PUBLISHED' },
      });
      return sealed;
    };
    return transaction ? publish(transaction) : this.prisma.$transaction(publish);
  }

  publishRuleGroupVersion(
    input: {
      groupDefinitionId: string;
      group: AdaptiveRuleGroupVersionContract;
      ruleVersionIds: string[];
      supersedesGroupVersionId?: string;
    },
    transaction?: Prisma.TransactionClient,
  ) {
    const publish = async (tx: Prisma.TransactionClient) => {
      const group = normalizeAdaptiveGroupVersion(
        adaptiveRuleGroupVersionSchema.parse(input.group),
      );
      if (group.isDemo === group.regulatory)
        throw new BadRequestException('ADAPTIVE_GROUP_BOUNDARY_INVALID');
      const definition = await tx.adaptiveRuleGroupDefinition.findUniqueOrThrow({
        where: { id: input.groupDefinitionId },
      });
      if (definition.groupKey !== group.groupKey)
        throw new BadRequestException('ADAPTIVE_GROUP_DEFINITION_MISMATCH');
      if (input.supersedesGroupVersionId) {
        const predecessor = await tx.adaptiveRuleGroupVersion.findUnique({
          where: { id: input.supersedesGroupVersionId },
          select: { groupDefinitionId: true, sealedAt: true },
        });
        if (!predecessor?.sealedAt || predecessor.groupDefinitionId !== definition.id)
          throw new BadRequestException('ADAPTIVE_GROUP_PREDECESSOR_INVALID');
      }
      const rules = await tx.adaptiveRuleVersion.findMany({
        where: { id: { in: input.ruleVersionIds } },
        include: { ruleDefinition: true },
      });
      const actualKeys = rules.map(({ ruleDefinition }) => ruleDefinition.ruleKey).sort();
      if (
        rules.length !== new Set(input.ruleVersionIds).size ||
        rules.some(
          (rule) =>
            !rule.sealedAt || rule.isDemo !== group.isDemo || rule.regulatory !== group.regulatory,
        ) ||
        actualKeys.join('|') !== [...group.ruleKeys].sort().join('|')
      )
        throw new BadRequestException('ADAPTIVE_GROUP_RULE_MEMBERSHIP_INVALID');

      const version = await tx.adaptiveRuleGroupVersion.create({
        data: {
          groupDefinitionId: definition.id,
          version: group.version,
          title: group.title,
          priority: group.priority,
          scopeMode: group.scopeMode,
          activationExpression: group.activation as Prisma.InputJsonValue,
          isDemo: group.isDemo,
          regulatory: group.regulatory,
          supersedesGroupVersionId: input.supersedesGroupVersionId,
        },
      });
      await tx.adaptiveRuleGroupRule.createMany({
        data: [...rules]
          .sort((left, right) =>
            left.ruleDefinition.ruleKey.localeCompare(right.ruleDefinition.ruleKey),
          )
          .map((rule, sortOrder) => ({
            groupVersionId: version.id,
            ruleVersionId: rule.id,
            sortOrder,
          })),
      });
      const now = new Date();
      return tx.adaptiveRuleGroupVersion.update({
        where: { id: version.id },
        data: { publishedAt: now, sealedAt: now },
        include: { groupRules: true },
      });
    };
    return transaction ? publish(transaction) : this.prisma.$transaction(publish);
  }

  publishRulePackVersion(
    input: {
      packDefinitionId: string;
      pack: AdaptiveRulePackContract;
      factVersionIds: string[];
      targetVersionIds: string[];
      ruleVersionIds: string[];
      groupVersionIds: string[];
    },
    transaction?: Prisma.TransactionClient,
  ) {
    const publish = async (tx: Prisma.TransactionClient) => {
      const pack = validateAdaptivePack(input.pack);
      const [definition, facts, targets, rules, groups] = await Promise.all([
        tx.adaptiveRulePackDefinition.findUniqueOrThrow({
          where: { id: input.packDefinitionId },
        }),
        tx.adaptiveFactVersion.findMany({
          where: { id: { in: input.factVersionIds } },
          include: { factDefinition: true },
        }),
        tx.adaptiveConfigurationTargetVersion.findMany({
          where: { id: { in: input.targetVersionIds } },
          include: { targetDefinition: true },
        }),
        tx.adaptiveRuleVersion.findMany({
          where: { id: { in: input.ruleVersionIds } },
          include: { ruleDefinition: true, requirements: { include: { requirement: true } } },
        }),
        tx.adaptiveRuleGroupVersion.findMany({
          where: { id: { in: input.groupVersionIds } },
          include: { groupDefinition: true, groupRules: true },
        }),
      ]);
      if (definition.packKey !== pack.packKey)
        throw new BadRequestException('ADAPTIVE_PACK_DEFINITION_MISMATCH');
      const exact = (expected: string[], actual: string[]) =>
        expected.length === actual.length &&
        [...expected].sort().join('|') === [...actual].sort().join('|');
      if (
        !exact(
          pack.factVersions.map(({ factKey }) => factKey),
          facts.map((x) => x.factDefinition.factKey),
        ) ||
        !exact(
          pack.targetVersions.map(({ targetKey }) => targetKey),
          targets.map((x) => x.targetDefinition.targetKey),
        ) ||
        !exact(
          pack.rules.map(({ ruleKey }) => ruleKey),
          rules.map((x) => x.ruleDefinition.ruleKey),
        ) ||
        !exact(
          pack.groups.map(({ groupKey }) => groupKey),
          groups.map((x) => x.groupDefinition.groupKey),
        )
      )
        throw new BadRequestException('ADAPTIVE_PACK_MEMBERSHIP_INVALID');
      if (
        targets.some((target) => target.isDemo !== pack.isDemo) ||
        rules.some(
          (rule) =>
            !rule.sealedAt || rule.isDemo !== pack.isDemo || rule.regulatory !== pack.regulatory,
        ) ||
        groups.some(
          (group) =>
            !group.sealedAt || group.isDemo !== pack.isDemo || group.regulatory !== pack.regulatory,
        )
      )
        throw new BadRequestException('ADAPTIVE_PACK_BOUNDARY_INVALID');
      if (
        pack.regulatory &&
        rules.some(
          (rule) =>
            rule.requirements.length === 0 ||
            rule.requirements.some(
              ({ requirement }) => requirement.editorialStatus !== 'APPROVED_FOR_RULE_DRAFTING',
            ),
        )
      )
        throw new BadRequestException('ADAPTIVE_PACK_REGULATORY_PROVENANCE_INVALID');
      const packRuleIds = new Set(rules.map(({ id }) => id));
      if (
        groups.some(({ groupRules }) =>
          groupRules.some(({ ruleVersionId }) => !packRuleIds.has(ruleVersionId)),
        )
      )
        throw new BadRequestException('ADAPTIVE_PACK_TRANSITIVE_MEMBERSHIP_INVALID');

      const contentHash = adaptivePackContentHash(pack, {
        factVersions: facts.map((fact) => ({
          id: fact.id,
          factKey: fact.factDefinition.factKey,
          version: fact.version,
        })),
        targetVersions: targets.map((target) => ({
          id: target.id,
          targetKey: target.targetDefinition.targetKey,
          version: target.version,
        })),
        ruleVersions: rules.map((rule) => ({
          id: rule.id,
          ruleKey: rule.ruleDefinition.ruleKey,
          version: rule.version,
        })),
        groupVersions: groups.map((group) => ({
          id: group.id,
          groupKey: group.groupDefinition.groupKey,
          version: group.version,
        })),
      });
      const version = await tx.adaptiveRulePackVersion.create({
        data: {
          packDefinitionId: definition.id,
          version: pack.version,
          engineSchemaVersion: pack.engineSchemaVersion,
          schema: pack as Prisma.InputJsonValue,
          contentHash,
          isDemo: pack.isDemo,
          regulatory: pack.regulatory,
          disclaimer: pack.disclaimer,
        },
      });
      await Promise.all([
        tx.adaptiveRulePackFact.createMany({
          data: facts.map(({ id }) => ({ packVersionId: version.id, factVersionId: id })),
        }),
        tx.adaptiveRulePackTarget.createMany({
          data: targets.map(({ id }) => ({ packVersionId: version.id, targetVersionId: id })),
        }),
        tx.adaptiveRulePackRule.createMany({
          data: rules.map(({ id }) => ({ packVersionId: version.id, ruleVersionId: id })),
        }),
        tx.adaptiveRulePackGroup.createMany({
          data: groups.map(({ id }) => ({ packVersionId: version.id, groupVersionId: id })),
        }),
      ]);
      const now = new Date();
      return tx.adaptiveRulePackVersion.update({
        where: { id: version.id },
        data: { publishedAt: now, sealedAt: now },
        include: { facts: true, targets: true, rules: true, groups: true },
      });
    };
    return transaction ? publish(transaction) : this.prisma.$transaction(publish);
  }
}
