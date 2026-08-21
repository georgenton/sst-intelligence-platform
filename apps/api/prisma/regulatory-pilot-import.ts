import { existsSync, readFileSync } from 'node:fs';
import { dirname, parse, resolve } from 'node:path';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  adaptiveContentHash,
  validateRegulatoryPilotManifest,
  type RegulatoryPilotManifestBundle,
} from '@sst/contracts';

const PILOT_DIRECTORY = 'regulatory/pilots/ec-mdt-2024-196-v1';

export function assertRegulatoryEditorialImportAllowed(
  environment: NodeJS.ProcessEnv,
  argumentsList: string[],
) {
  if (argumentsList.length > 0) throw new Error('REGULATORY_IMPORT_ARGUMENTS_REJECTED');
  const productionMarkers = [
    environment.NODE_ENV,
    environment.RAILWAY_ENVIRONMENT_NAME,
    environment.VERCEL_ENV,
  ].filter(Boolean);
  if (productionMarkers.some((value) => value?.toLowerCase() === 'production'))
    throw new Error('REGULATORY_IMPORT_PRODUCTION_REFUSED');
  if (
    environment.REGULATORY_EDITORIAL_MODE !== 'true' ||
    environment.REGULATORY_EDITORIAL_DATABASE !== 'ephemeral'
  )
    throw new Error('REGULATORY_IMPORT_EXPLICIT_EPHEMERAL_GUARD_REQUIRED');
}

function repositoryRoot(start = process.cwd()) {
  let current = resolve(start);
  const root = parse(current).root;
  while (current !== root) {
    if (existsSync(resolve(current, PILOT_DIRECTORY, 'manifest.json'))) return current;
    current = dirname(current);
  }
  throw new Error('REGULATORY_PILOT_REPOSITORY_ROOT_NOT_FOUND');
}

export function loadRegulatoryPilotImportManifest(start = process.cwd()) {
  const directory = resolve(repositoryRoot(start), PILOT_DIRECTORY);
  const read = (name: string) => JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
  return validateRegulatoryPilotManifest({
    index: read('manifest.json'),
    source: read('source.json'),
    provisions: read('provisions.json'),
    requirements: read('requirements.json'),
    ruleDrafts: read('rule-drafts.json'),
    shadowPack: read('shadow-pack.json'),
  } as RegulatoryPilotManifestBundle);
}

type DatabaseClient = Prisma.TransactionClient | PrismaClient;

function contentEqual(left: unknown, right: unknown) {
  return adaptiveContentHash(left) === adaptiveContentHash(right);
}

export async function importRegulatoryPilotCandidates(
  database: DatabaseClient,
  manifest: RegulatoryPilotManifestBundle,
) {
  const source = await database.regulatorySource.findUniqueOrThrow({
    where: { sourceKey: manifest.source.sourceKey },
  });
  const sourceVersion = await database.regulatorySourceVersion.findUniqueOrThrow({
    where: {
      sourceId_catalogVersion: {
        sourceId: source.id,
        catalogVersion: manifest.source.sourceCatalogVersion,
      },
    },
  });
  if (
    sourceVersion.officialDocumentSha256 !== manifest.source.officialDocumentSha256 ||
    sourceVersion.officialUrl !== manifest.source.officialUrl ||
    sourceVersion.readyForRules ||
    !sourceVersion.readyForExtraction
  )
    throw new Error('EDITORIAL_SOURCE_VERSION_DRIFT');

  const provisionIds = new Map<string, string>();
  for (const candidate of manifest.provisions) {
    let provision = await database.regulatoryProvision.findUnique({
      where: {
        sourceVersionId_provisionKey: {
          sourceVersionId: sourceVersion.id,
          provisionKey: candidate.provisionKey,
        },
      },
    });
    if (!provision) {
      provision = await database.regulatoryProvision.create({
        data: {
          id: candidate.candidateId,
          sourceVersionId: sourceVersion.id,
          provisionKey: candidate.provisionKey,
          locatorType: candidate.locatorType,
          locatorLabel: candidate.locatorLabel,
          heading: candidate.heading,
          summary: candidate.summary,
          editorialStatus: 'DRAFT',
        },
      });
      provision = await database.regulatoryProvision.update({
        where: { id: provision.id },
        data: { editorialStatus: 'EXTRACTED' },
      });
      provision = await database.regulatoryProvision.update({
        where: { id: provision.id },
        data: { editorialStatus: 'TECHNICAL_REVIEW_PENDING' },
      });
    } else if (
      provision.id !== candidate.candidateId ||
      provision.locatorLabel !== candidate.locatorLabel ||
      provision.heading !== candidate.heading ||
      provision.summary !== candidate.summary ||
      provision.editorialStatus !== 'TECHNICAL_REVIEW_PENDING'
    )
      throw new Error(`EDITORIAL_PROVISION_DRIFT:${candidate.provisionKey}`);
    provisionIds.set(candidate.provisionKey, provision.id);
  }

  const requirementIds = new Map<string, string>();
  for (const candidate of manifest.requirements) {
    let requirement = await database.regulatoryRequirement.findUnique({
      where: { requirementKey: candidate.requirementKey },
    });
    if (!requirement) {
      requirement = await database.regulatoryRequirement.create({
        data: {
          id: candidate.candidateId,
          requirementKey: candidate.requirementKey,
          title: candidate.title,
          description: candidate.description,
          scopeHint: candidate.scopeHint,
          editorialStatus: 'DRAFT',
        },
      });
      await database.regulatoryRequirementSource.createMany({
        data: candidate.provisionKeys.map((provisionKey) => ({
          requirementId: requirement!.id,
          provisionId: provisionIds.get(provisionKey)!,
          relationshipType: candidate.relationshipType,
        })),
      });
      requirement = await database.regulatoryRequirement.update({
        where: { id: requirement.id },
        data: { editorialStatus: 'TECHNICAL_REVIEW_PENDING' },
      });
    } else if (
      requirement.id !== candidate.candidateId ||
      requirement.title !== candidate.title ||
      requirement.description !== candidate.description ||
      requirement.scopeHint !== candidate.scopeHint ||
      requirement.editorialStatus !== 'TECHNICAL_REVIEW_PENDING'
    )
      throw new Error(`EDITORIAL_REQUIREMENT_DRIFT:${candidate.requirementKey}`);
    requirementIds.set(candidate.requirementKey, requirement.id);
  }

  for (const candidate of manifest.ruleDrafts) {
    const existingDefinition = await database.adaptiveRuleDefinition.findUnique({
      where: { ruleKey: candidate.rule.ruleKey },
    });
    if (existingDefinition && existingDefinition.id !== candidate.ruleDefinitionId)
      throw new Error(`EDITORIAL_RULE_DEFINITION_DRIFT:${candidate.rule.ruleKey}`);
    const definition =
      existingDefinition ??
      (await database.adaptiveRuleDefinition.create({
        data: { id: candidate.ruleDefinitionId, ruleKey: candidate.rule.ruleKey },
      }));
    const existingDraft = await database.adaptiveRuleDraft.findUnique({
      where: {
        ruleDefinitionId_revision: {
          ruleDefinitionId: definition.id,
          revision: candidate.revision,
        },
      },
    });
    if (!existingDraft) {
      await database.adaptiveRuleDraft.create({
        data: {
          id: candidate.draftId,
          ruleDefinitionId: definition.id,
          revision: candidate.revision,
          status: 'TECHNICAL_REVIEW_PENDING',
          schema: candidate.rule as Prisma.InputJsonValue,
          isDemo: false,
          regulatory: true,
        },
      });
    } else if (
      existingDraft.id !== candidate.draftId ||
      existingDraft.status !== 'TECHNICAL_REVIEW_PENDING' ||
      existingDraft.isDemo ||
      !existingDraft.regulatory ||
      !contentEqual(existingDraft.schema, candidate.rule)
    )
      throw new Error(`EDITORIAL_RULE_DRAFT_DRIFT:${candidate.rule.ruleKey}`);
  }

  return {
    provisions: provisionIds.size,
    requirements: requirementIds.size,
    ruleDrafts: manifest.ruleDrafts.length,
    technicalReview: 'PENDING' as const,
    legalReview: 'PENDING' as const,
    publishedRuleVersions: 0,
    publishedPackVersions: 0,
  };
}
