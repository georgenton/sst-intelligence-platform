import { z } from 'zod';
import {
  ADAPTIVE_ENGINE_VERSION,
  CANONICAL_ASSESSMENT_ADAPTIVE_FACT_VERSIONS_V2,
  adaptiveContentHash,
  adaptiveRuleGroupVersionSchema,
  adaptiveRuleVersionSchema,
  adaptiveTargetVersionSchema,
  validateAdaptivePack,
  type AdaptiveRulePackContract,
} from './adaptive-configuration.js';
import {
  regulatoryProvisionEditorialStatusSchema,
  regulatoryProvisionLocatorTypeSchema,
  regulatoryRequirementEditorialStatusSchema,
  regulatoryRequirementRelationshipTypeSchema,
  regulatoryRequirementScopeHintSchema,
} from './regulatory-content.js';
import { regulatoryCandidateStatusSchema } from './regulatory-source.js';

export const REGULATORY_PILOT_CANDIDATE_DISCLAIMER =
  'Interpretación regulatoria candidata. Requiere revisión profesional y no constituye todavía una regla publicada del sistema.';
export const REGULATORY_PILOT_SOURCE_KEY = 'EC_MDT_2024_196';
export const REGULATORY_PILOT_SOURCE_CATALOG_VERSION = 2;
export const REGULATORY_PILOT_SOURCE_SHA256 =
  'sha256:4fe2da2ddf2b730c0c9e56e321d5a817f94b98d6d9f9e02bb97c18f2cc47473d';

const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const stableKeySchema = z.string().regex(/^[A-Z][A-Z0-9_]{2,159}$/);
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const decisionSchema = z.literal('PENDING');

export const regulatoryPilotManifestIndexSchema = z
  .object({
    pilotKey: z.literal('EC_MDT_2024_196_V1'),
    pilotVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    status: z.literal('TECHNICAL_REVIEW_PENDING'),
    materialFiles: z
      .array(
        z.enum([
          'source.json',
          'provisions.json',
          'requirements.json',
          'rule-drafts.json',
          'shadow-pack.json',
        ]),
      )
      .length(5),
    manifestSha256: sha256Schema,
  })
  .strict();

export const regulatoryPilotSourceSchema = z
  .object({
    sourceKey: z.literal(REGULATORY_PILOT_SOURCE_KEY),
    sourceCatalogVersion: z.literal(REGULATORY_PILOT_SOURCE_CATALOG_VERSION),
    canonicalTitle: z.string().trim().min(1).max(240),
    issuer: z.string().trim().min(1).max(160),
    officialCatalogUrl: z.url(),
    officialUrl: z.url(),
    officialPublicationUrl: z.url(),
    officialPublicationReference: z.string().trim().min(1).max(500),
    publicationDate: dateOnlySchema,
    officialDocumentSha256: z.literal(REGULATORY_PILOT_SOURCE_SHA256),
    officialDocumentMediaType: z.literal('application/pdf'),
    officialDocumentBytes: z.number().int().positive().max(25_000_000),
    officialDocumentRetrievedAt: z.string().datetime(),
    candidateStatus: regulatoryCandidateStatusSchema.extract(['APPROVED_FOR_EXTRACTION']),
    readyForExtraction: z.literal(true),
    readyForRules: z.literal(false),
    reviewNotes: z.string().trim().min(1).max(1000),
  })
  .strict();

export const regulatoryPilotProvisionSchema = z
  .object({
    candidateId: z.uuid(),
    provisionKey: stableKeySchema,
    sourceKey: z.literal(REGULATORY_PILOT_SOURCE_KEY),
    sourceCatalogVersion: z.literal(REGULATORY_PILOT_SOURCE_CATALOG_VERSION),
    officialDocumentSha256: z.literal(REGULATORY_PILOT_SOURCE_SHA256),
    locatorType: regulatoryProvisionLocatorTypeSchema.extract(['ARTICLE']),
    locatorLabel: z.enum(['Artículo 18', 'Artículo 19']),
    heading: z.string().trim().min(1).max(500),
    summary: z.string().trim().min(1).max(1000),
    editorialStatus: regulatoryProvisionEditorialStatusSchema.extract(['TECHNICAL_REVIEW_PENDING']),
    reviewNotes: z.string().trim().min(1).max(1000),
  })
  .strict();

const dependencySchema = z.discriminatedUnion('dependencyStatus', [
  z
    .object({
      dependencyStatus: z.literal('NONE_RECORDED'),
      dependencySourceKeys: z.array(stableKeySchema).length(0),
    })
    .strict(),
  z
    .object({
      dependencyStatus: z.literal('DEPENDENCY_REQUIRES_ADDITIONAL_SOURCE'),
      dependencySourceKeys: z.array(stableKeySchema).min(1).max(5),
    })
    .strict(),
]);

export const regulatoryPilotRequirementSchema = z
  .object({
    candidateId: z.uuid(),
    requirementKey: stableKeySchema,
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().min(1).max(2000),
    editorialStatus: regulatoryRequirementEditorialStatusSchema.extract([
      'TECHNICAL_REVIEW_PENDING',
    ]),
    scopeHint: regulatoryRequirementScopeHintSchema.extract(['ORGANIZATION']),
    provisionKeys: z.array(stableKeySchema).min(1).max(2),
    relationshipType: regulatoryRequirementRelationshipTypeSchema.extract(['PRIMARY_SOURCE']),
    reviewNotes: z.string().trim().min(1).max(1000),
  })
  .and(dependencySchema);

export const regulatoryPilotRuleDraftSchema = z
  .object({
    ruleDefinitionId: z.uuid(),
    draftId: z.uuid(),
    revision: z.literal(1),
    status: z.literal('TECHNICAL_REVIEW_PENDING'),
    technicalExpertDecision: decisionSchema,
    legalReviewDecision: decisionSchema,
    requirementKeys: z.array(stableKeySchema).min(1).max(5),
    rule: adaptiveRuleVersionSchema,
  })
  .strict()
  .superRefine((draft, context) => {
    if (draft.rule.isDemo || !draft.rule.regulatory)
      context.addIssue({
        code: 'custom',
        path: ['rule'],
        message: 'Real pilot drafts must remain regulatory and non-DEMO',
      });
  });

export const regulatoryPilotShadowPackSchema = z
  .object({
    packKey: stableKeySchema,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    engineSchemaVersion: z.literal(ADAPTIVE_ENGINE_VERSION),
    name: z.string().trim().min(1).max(160),
    isDemo: z.literal(false),
    regulatory: z.literal(true),
    disclaimer: z.literal(REGULATORY_PILOT_CANDIDATE_DISCLAIMER),
    factKeys: z.array(z.enum(['organization.country', 'organization.totalWorkerCount'])).length(2),
    targetVersions: z.array(adaptiveTargetVersionSchema).min(1).max(6),
    group: adaptiveRuleGroupVersionSchema,
  })
  .strict();

export const regulatoryPilotManifestBundleSchema = z
  .object({
    index: regulatoryPilotManifestIndexSchema,
    source: regulatoryPilotSourceSchema,
    provisions: z.array(regulatoryPilotProvisionSchema).length(2),
    requirements: z.array(regulatoryPilotRequirementSchema).min(1).max(5),
    ruleDrafts: z.array(regulatoryPilotRuleDraftSchema).min(1).max(6),
    shadowPack: regulatoryPilotShadowPackSchema,
  })
  .strict();

export type RegulatoryPilotManifestBundle = z.infer<typeof regulatoryPilotManifestBundleSchema>;

export function regulatoryPilotMaterialHash(
  manifest: Omit<RegulatoryPilotManifestBundle, 'index'>,
) {
  return adaptiveContentHash(manifest);
}

function requireUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`DUPLICATE_${label}`);
}

export function buildRegulatoryPilotShadowPack(
  manifest: RegulatoryPilotManifestBundle,
): AdaptiveRulePackContract {
  const facts = CANONICAL_ASSESSMENT_ADAPTIVE_FACT_VERSIONS_V2.filter(({ factKey }) =>
    manifest.shadowPack.factKeys.includes(factKey as (typeof manifest.shadowPack.factKeys)[number]),
  );
  const pack: AdaptiveRulePackContract = {
    packKey: manifest.shadowPack.packKey,
    version: manifest.shadowPack.version,
    engineSchemaVersion: manifest.shadowPack.engineSchemaVersion,
    name: manifest.shadowPack.name,
    isDemo: false,
    regulatory: true,
    disclaimer: manifest.shadowPack.disclaimer,
    factVersions: facts,
    targetVersions: manifest.shadowPack.targetVersions,
    groups: [manifest.shadowPack.group],
    rules: manifest.ruleDrafts.map(({ rule }) => rule),
  };
  return validateAdaptivePack(pack);
}

export function validateRegulatoryPilotManifest(
  input: RegulatoryPilotManifestBundle,
): RegulatoryPilotManifestBundle {
  const manifest = regulatoryPilotManifestBundleSchema.parse(input);
  const expectedFiles = [
    'source.json',
    'provisions.json',
    'requirements.json',
    'rule-drafts.json',
    'shadow-pack.json',
  ].sort();
  if (JSON.stringify([...manifest.index.materialFiles].sort()) !== JSON.stringify(expectedFiles))
    throw new Error('MANIFEST_MATERIAL_FILES_INVALID');

  requireUnique(
    manifest.provisions.map(({ candidateId }) => candidateId),
    'PROVISION_ID',
  );
  requireUnique(
    manifest.provisions.map(({ provisionKey }) => provisionKey),
    'PROVISION_KEY',
  );
  requireUnique(
    manifest.requirements.map(({ candidateId }) => candidateId),
    'REQUIREMENT_ID',
  );
  requireUnique(
    manifest.requirements.map(({ requirementKey }) => requirementKey),
    'REQUIREMENT_KEY',
  );
  requireUnique(
    manifest.ruleDrafts.map(({ draftId }) => draftId),
    'RULE_DRAFT_ID',
  );
  requireUnique(
    manifest.ruleDrafts.map(({ rule }) => rule.ruleKey),
    'RULE_KEY',
  );

  const provisionKeys = new Set(manifest.provisions.map(({ provisionKey }) => provisionKey));
  const requirementKeys = new Set(
    manifest.requirements.map(({ requirementKey }) => requirementKey),
  );
  for (const requirement of manifest.requirements)
    if (requirement.provisionKeys.some((key) => !provisionKeys.has(key)))
      throw new Error(`UNKNOWN_PROVISION_REFERENCE:${requirement.requirementKey}`);
  for (const draft of manifest.ruleDrafts)
    if (draft.requirementKeys.some((key) => !requirementKeys.has(key)))
      throw new Error(`UNKNOWN_REQUIREMENT_REFERENCE:${draft.rule.ruleKey}`);

  const articleKeys = [...provisionKeys].sort();
  if (
    JSON.stringify(articleKeys) !== JSON.stringify(['MDT_2024_196_ART_18', 'MDT_2024_196_ART_19'])
  )
    throw new Error('PILOT_ARTICLE_SCOPE_INVALID');

  const ruleKeys = manifest.ruleDrafts.map(({ rule }) => rule.ruleKey).sort();
  if (JSON.stringify([...manifest.shadowPack.group.ruleKeys].sort()) !== JSON.stringify(ruleKeys))
    throw new Error('SHADOW_GROUP_RULE_MEMBERSHIP_INVALID');

  const materialHash = regulatoryPilotMaterialHash({
    source: manifest.source,
    provisions: manifest.provisions,
    requirements: manifest.requirements,
    ruleDrafts: manifest.ruleDrafts,
    shadowPack: manifest.shadowPack,
  });
  if (materialHash !== manifest.index.manifestSha256) throw new Error('MANIFEST_SHA256_MISMATCH');

  buildRegulatoryPilotShadowPack(manifest);
  return manifest;
}

export function assertRegulatoryPilotManifestRevision(
  existing: Pick<RegulatoryPilotManifestBundle['index'], 'pilotVersion' | 'manifestSha256'>,
  incoming: Pick<RegulatoryPilotManifestBundle['index'], 'pilotVersion' | 'manifestSha256'>,
) {
  if (
    existing.pilotVersion === incoming.pilotVersion &&
    existing.manifestSha256 !== incoming.manifestSha256
  )
    throw new Error('MANIFEST_VERSION_DRIFT');
}
