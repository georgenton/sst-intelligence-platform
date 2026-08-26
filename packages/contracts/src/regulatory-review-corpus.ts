import { z } from 'zod';
import { adaptiveContentHash } from './adaptive-configuration.js';
import {
  regulatoryCandidateStatusSchema,
  regulatoryDocumentTypeSchema,
  regulatoryRelationshipReviewStatusSchema,
  regulatoryRelationshipTypeSchema,
  regulatorySupersessionStatusSchema,
} from './regulatory-source.js';

const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const stableKeySchema = z.string().regex(/^[A-Z][A-Z0-9_]{2,159}$/);
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const regulatoryCorpusVerificationStatusSchema = z.enum([
  'VERIFIED_OFFICIAL_REFERENCE',
  'VERIFIED_OFFICIAL_ARTIFACT',
  'OFFICIAL_REFERENCE_ONLY',
  'UNVERIFIED_REFERENCE',
  'BLOCKED',
]);

export const regulatoryCorpusReviewPrioritySchema = z.enum([
  'CORE',
  'SECTOR_SPECIFIC',
  'HEALTH',
  'SOCIAL_SECURITY',
  'TECHNICAL',
  'REFERENCE',
]);

export const regulatoryCorpusSourceSchema = z
  .object({
    sourceId: z.uuid(),
    sourceKey: stableKeySchema,
    countryCode: z.literal('EC'),
    displayTitle: z.string().trim().min(1).max(240),
    issuer: z.string().trim().min(1).max(200),
    documentType: regulatoryDocumentTypeSchema,
    referenceNumber: z.string().trim().min(1).max(120),
    verificationStatus: regulatoryCorpusVerificationStatusSchema,
    latestCatalogVersion: z.number().int().positive(),
    versionId: z.uuid(),
    candidateStatus: regulatoryCandidateStatusSchema,
    officialDocumentLocated: z.boolean(),
    officialUrl: z.url().nullable(),
    officialDocumentSha256: sha256Schema.nullable(),
    officialDocumentBytes: z.number().int().positive().max(25_000_000).nullable(),
    officialDocumentRetrievedAt: z.string().datetime().nullable(),
    officialDocumentMediaType: z.literal('application/pdf').nullable(),
    officialPublicationReference: z.string().trim().min(1).max(500).nullable(),
    publicationDate: dateOnlySchema.nullable(),
    supersessionStatus: regulatorySupersessionStatusSchema,
    currentnessNote: z.string().trim().min(1).max(1000),
    readyForExtraction: z.boolean(),
    readyForRules: z.literal(false),
    structuredContentStatus: z.enum(['NOT_STRUCTURED', 'STRUCTURED_CANDIDATE']),
    ruleStatus: z.enum(['NO_RULE_DRAFT', 'RULE_DRAFT_PENDING']),
    reviewPriority: regulatoryCorpusReviewPrioritySchema,
    expertNotes: z.literal('PENDING'),
    legalReview: z.literal('PENDING'),
    reviewNotes: z.string().trim().min(1).max(1000),
    recordedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((source, context) => {
    const artifactVerified = source.verificationStatus === 'VERIFIED_OFFICIAL_ARTIFACT';
    const artifactFieldsPresent =
      source.officialDocumentLocated &&
      source.officialUrl !== null &&
      source.officialDocumentSha256 !== null &&
      source.officialDocumentBytes !== null &&
      source.officialDocumentRetrievedAt !== null &&
      source.officialDocumentMediaType === 'application/pdf';
    if (artifactVerified !== artifactFieldsPresent)
      context.addIssue({
        code: 'custom',
        path: ['verificationStatus'],
        message: 'Verified artifacts require a complete official fingerprint and only those do',
      });
    if (source.readyForExtraction && !artifactVerified)
      context.addIssue({
        code: 'custom',
        path: ['readyForExtraction'],
        message: 'Only verified official artifacts may be ready for extraction',
      });
    if (source.readyForExtraction && source.candidateStatus !== 'APPROVED_FOR_EXTRACTION')
      context.addIssue({
        code: 'custom',
        path: ['candidateStatus'],
        message: 'Extraction-ready artifacts use the existing editorial status',
      });
    if (
      source.verificationStatus === 'UNVERIFIED_REFERENCE' &&
      (source.officialDocumentLocated || source.officialUrl !== null)
    )
      context.addIssue({
        code: 'custom',
        path: ['officialUrl'],
        message: 'Unverified references cannot claim an official document',
      });
  });

export const regulatoryCorpusRelationshipSchema = z
  .object({
    id: z.uuid(),
    fromSourceKey: stableKeySchema,
    toSourceKey: stableKeySchema,
    relationshipType: regulatoryRelationshipTypeSchema,
    reviewStatus: regulatoryRelationshipReviewStatusSchema,
    dependencyState: z.enum([
      'NO_DEPENDENCY_IDENTIFIED',
      'RELATED_SOURCE',
      'INTERPRETATION_REQUIRES_SOURCE',
      'AMENDMENT_CONFIRMED',
      'SUPERSESSION_CONFIRMED',
      'RELATION_REVIEW_REQUIRED',
    ]),
    notes: z.string().trim().min(1).max(1000),
  })
  .strict();

export const regulatoryCorpusScenarioKeySchema = z.enum([
  'small-services',
  'chemical-pharma',
  'construction',
]);

export const regulatoryCorpusScenarioSourceSchema = z
  .object({
    sourceKey: stableKeySchema,
    reviewReason: z.string().trim().min(1).max(240),
    status: z.literal('PENDING_EXPERT_REVIEW'),
    presentation: z.enum(['REVIEW_SOURCE', 'POSSIBLE_REVIEW_SOURCE']),
  })
  .strict();

export const regulatoryCorpusScenarioSchema = z
  .object({
    scenarioKey: regulatoryCorpusScenarioKeySchema,
    displayName: z.string().trim().min(1).max(160),
    heading: z.literal('Fuentes que proponemos revisar para este caso'),
    sourceSuggestions: z.array(regulatoryCorpusScenarioSourceSchema).min(1),
    missingSourcePrompt: z.literal('¿Falta algún documento que tú revisarías?'),
    exclusionPrompt: z.literal('¿Hay algún documento aquí que no usarías para este caso?'),
  })
  .strict();

export const regulatoryCorpusRelationshipsFileSchema = z
  .object({ relationships: z.array(regulatoryCorpusRelationshipSchema) })
  .strict();

export const regulatoryCorpusScenarioMapSchema = z
  .object({
    outputType: z.literal('SUGGESTED_SOURCES_FOR_REVIEW'),
    applicabilityBoundary: z.literal('REVIEW_SOURCE_IS_NOT_APPLICABLE_RULE'),
    scenarios: z.array(regulatoryCorpusScenarioSchema).length(3),
    missingSourceCapture: z
      .object({
        type: z.literal('MISSING_SOURCE_REFERENCE'),
        title: z.literal(''),
        issuer: z.literal(''),
        referenceNumber: z.literal(''),
        whyRelevant: z.literal(''),
        scenario: z.literal(''),
        expertNotes: z.literal(''),
      })
      .strict(),
  })
  .strict();

export const regulatoryCorpusIndexSchema = z
  .object({
    corpusKey: z.literal('ECUADOR_SST_MULTI_SOURCE_REVIEW_V1'),
    corpusVersion: z.literal('1.0.0'),
    status: z.literal('REVIEW_ONLY'),
    sourceFiles: z.array(z.string().regex(/^sources\/[a-z0-9-]+\.json$/)).min(1),
    materialFiles: z.tuple([
      z.literal('relationships.json'),
      z.literal('scenario-review-map.json'),
    ]),
    corpusSha256: sha256Schema,
  })
  .strict();

export type RegulatoryCorpusSource = z.infer<typeof regulatoryCorpusSourceSchema>;
export type RegulatoryCorpusRelationship = z.infer<typeof regulatoryCorpusRelationshipSchema>;
export type RegulatoryCorpusScenario = z.infer<typeof regulatoryCorpusScenarioSchema>;
export type RegulatoryCorpusScenarioKey = z.infer<typeof regulatoryCorpusScenarioKeySchema>;

export type RegulatoryReviewCorpusBundle = {
  index: z.infer<typeof regulatoryCorpusIndexSchema>;
  sources: RegulatoryCorpusSource[];
  relationships: z.infer<typeof regulatoryCorpusRelationshipsFileSchema>;
  scenarioMap: z.infer<typeof regulatoryCorpusScenarioMapSchema>;
};

export function regulatoryReviewCorpusMaterialHash(
  material: Omit<RegulatoryReviewCorpusBundle, 'index'>,
) {
  return adaptiveContentHash(material);
}

export function validateRegulatoryReviewCorpus(input: RegulatoryReviewCorpusBundle) {
  const bundle: RegulatoryReviewCorpusBundle = {
    index: regulatoryCorpusIndexSchema.parse(input.index),
    sources: z.array(regulatoryCorpusSourceSchema).parse(input.sources),
    relationships: regulatoryCorpusRelationshipsFileSchema.parse(input.relationships),
    scenarioMap: regulatoryCorpusScenarioMapSchema.parse(input.scenarioMap),
  };
  const sourceKeys = bundle.sources.map(({ sourceKey }) => sourceKey);
  if (new Set(sourceKeys).size !== sourceKeys.length)
    throw new Error('CORPUS_SOURCE_KEY_DUPLICATE');
  if (new Set(bundle.sources.map(({ sourceId }) => sourceId)).size !== bundle.sources.length)
    throw new Error('CORPUS_SOURCE_ID_DUPLICATE');
  if (bundle.index.sourceFiles.length !== bundle.sources.length)
    throw new Error('CORPUS_SOURCE_FILE_COUNT_MISMATCH');
  const knownSources = new Set(sourceKeys);
  for (const relationship of bundle.relationships.relationships) {
    if (
      !knownSources.has(relationship.fromSourceKey) ||
      !knownSources.has(relationship.toSourceKey) ||
      relationship.fromSourceKey === relationship.toSourceKey
    )
      throw new Error('CORPUS_RELATIONSHIP_SOURCE_INVALID');
  }
  for (const scenario of bundle.scenarioMap.scenarios) {
    const suggestions = scenario.sourceSuggestions.map(({ sourceKey }) => sourceKey);
    if (new Set(suggestions).size !== suggestions.length)
      throw new Error(`CORPUS_SCENARIO_SOURCE_DUPLICATE:${scenario.scenarioKey}`);
    if (suggestions.some((sourceKey) => !knownSources.has(sourceKey)))
      throw new Error(`CORPUS_SCENARIO_SOURCE_UNKNOWN:${scenario.scenarioKey}`);
  }
  const rejected = bundle.sources.find(
    ({ sourceKey }) => sourceKey === 'EC_IESS_CD_527_INTERVIEW_REFERENCE',
  );
  if (
    rejected?.verificationStatus !== 'UNVERIFIED_REFERENCE' ||
    rejected.candidateStatus !== 'REJECTED_REFERENCE' ||
    rejected.readyForExtraction
  )
    throw new Error('CORPUS_CD_527_SAFETY_INVALID');
  if (
    bundle.sources
      .filter(({ structuredContentStatus }) => structuredContentStatus === 'STRUCTURED_CANDIDATE')
      .map(({ sourceKey }) => sourceKey)
      .join() !== 'EC_MDT_2024_196'
  )
    throw new Error('CORPUS_STRUCTURED_SOURCE_BOUNDARY_INVALID');
  const amendment = bundle.relationships.relationships.find(
    ({ fromSourceKey, toSourceKey }) =>
      fromSourceKey === 'EC_IESS_CD_692' && toSourceKey === 'EC_IESS_CD_513',
  );
  if (
    amendment?.relationshipType !== 'POSSIBLE_AMENDMENT' ||
    amendment.reviewStatus !== 'CONFIRMED' ||
    amendment.dependencyState !== 'AMENDMENT_CONFIRMED'
  )
    throw new Error('CORPUS_CD_513_CD_692_RELATION_INVALID');
  const supersession = bundle.relationships.relationships.find(
    ({ fromSourceKey, toSourceKey }) =>
      fromSourceKey === 'EC_IESS_CD_517' && toSourceKey === 'EC_IESS_CD_677',
  );
  if (
    supersession?.reviewStatus !== 'CONFIRMED' ||
    supersession.dependencyState !== 'SUPERSESSION_CONFIRMED'
  )
    throw new Error('CORPUS_CD_517_CD_677_REVIEW_GATE_INVALID');
  const expectedHash = regulatoryReviewCorpusMaterialHash({
    sources: bundle.sources,
    relationships: bundle.relationships,
    scenarioMap: bundle.scenarioMap,
  });
  if (bundle.index.corpusSha256 !== expectedHash) throw new Error('CORPUS_SHA256_MISMATCH');
  return bundle;
}

export function assertRegulatoryReviewCorpusRevision(
  current: RegulatoryReviewCorpusBundle['index'],
  incoming: RegulatoryReviewCorpusBundle['index'],
) {
  if (
    current.corpusVersion === incoming.corpusVersion &&
    current.corpusSha256 !== incoming.corpusSha256
  )
    throw new Error('CORPUS_VERSION_DRIFT');
}
