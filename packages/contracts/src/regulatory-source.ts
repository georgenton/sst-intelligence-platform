import { z } from 'zod';

export const regulatoryDocumentTypeSchema = z.enum([
  'MINISTERIAL_AGREEMENT',
  'ANNEX',
  'EXECUTIVE_DECREE',
  'CODE',
  'RESOLUTION',
  'REGULATION',
  'OTHER',
]);

export const regulatoryCandidateStatusSchema = z.enum([
  'DISCOVERED',
  'OFFICIAL_DOCUMENT_LOCATED',
  'SUPERSESSION_REVIEW_REQUIRED',
  'TECHNICAL_REVIEW_PENDING',
  'LEGAL_REVIEW_PENDING',
  'APPROVED_FOR_EXTRACTION',
  'APPROVED_FOR_RULES',
  'SUPERSEDED',
  'REJECTED_REFERENCE',
]);

export const regulatorySupersessionStatusSchema = z.enum([
  'UNKNOWN_REVIEW_REQUIRED',
  'CURRENT_VERSION_NOT_ESTABLISHED',
  'UNVERIFIED_REFERENCE',
  'RELATION_REVIEW_REQUIRED',
  'NO_KNOWN_RELATION_RECORDED',
]);

export const regulatoryRelationshipTypeSchema = z.enum([
  'POSSIBLE_SUPERSESSION',
  'POSSIBLE_AMENDMENT',
  'POSSIBLE_REPLACEMENT',
  'RELATED_REFERENCE',
]);

export const regulatoryRelationshipReviewStatusSchema = z.enum([
  'PENDING_REVIEW',
  'CONFIRMED',
  'REJECTED',
]);

const nullableDateSchema = z.string().datetime().nullable();
const nullableSha256Schema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/)
  .nullable();

export const regulatorySourceIdentitySchema = z
  .object({
    sourceKey: z.string().min(1),
    countryCode: z.string().length(2),
    issuer: z.string().min(1),
    documentType: regulatoryDocumentTypeSchema,
    referenceNumber: z.string().min(1),
    canonicalTitle: z.string().min(1),
  })
  .strict();

export const regulatorySourceVersionSchema = z
  .object({
    catalogVersion: z.number().int().positive(),
    candidateStatus: regulatoryCandidateStatusSchema,
    officialDocumentLocated: z.boolean(),
    officialUrl: z.url().nullable(),
    officialDocumentSha256: nullableSha256Schema,
    officialDocumentRetrievedAt: nullableDateSchema,
    officialDocumentMediaType: z.string().trim().min(1).max(100).nullable(),
    officialPublicationReference: z.string().trim().min(1).max(500).nullable(),
    publicationDate: nullableDateSchema,
    effectiveFrom: nullableDateSchema,
    effectiveTo: nullableDateSchema,
    supersessionStatus: regulatorySupersessionStatusSchema,
    readyForExtraction: z.boolean(),
    readyForRules: z.boolean(),
    reviewNotes: z.string().nullable(),
    recordedAt: z.string().datetime(),
  })
  .strict();

export const regulatorySourceListItemSchema = regulatorySourceIdentitySchema
  .extend({
    latestCatalogVersion: z.number().int().positive(),
    candidateStatus: regulatoryCandidateStatusSchema,
    officialDocumentLocated: z.boolean(),
    readyForExtraction: z.boolean(),
    readyForRules: z.boolean(),
    supersessionStatus: regulatorySupersessionStatusSchema,
  })
  .strict();

export const regulatorySourceDetailSchema = z
  .object({
    source: regulatorySourceIdentitySchema,
    latestVersion: regulatorySourceVersionSchema,
    metadataBoundary: z.literal('CATALOG_METADATA_NOT_LEGAL_INTERPRETATION'),
  })
  .strict();

export const regulatorySourceRelationshipSchema = z
  .object({
    relationshipType: regulatoryRelationshipTypeSchema,
    reviewStatus: regulatoryRelationshipReviewStatusSchema,
    notes: z.string().nullable(),
    createdAt: z.string().datetime(),
    fromSource: regulatorySourceIdentitySchema,
    toSource: regulatorySourceIdentitySchema,
  })
  .strict();

export type RegulatoryDocumentType = z.infer<typeof regulatoryDocumentTypeSchema>;
export type RegulatoryCandidateStatus = z.infer<typeof regulatoryCandidateStatusSchema>;
export type RegulatorySupersessionStatus = z.infer<typeof regulatorySupersessionStatusSchema>;
export type RegulatoryRelationshipType = z.infer<typeof regulatoryRelationshipTypeSchema>;
export type RegulatoryRelationshipReviewStatus = z.infer<
  typeof regulatoryRelationshipReviewStatusSchema
>;
export type RegulatorySourceIdentity = z.infer<typeof regulatorySourceIdentitySchema>;
export type RegulatorySourceVersionRecord = z.infer<typeof regulatorySourceVersionSchema>;
export type RegulatorySourceListItem = z.infer<typeof regulatorySourceListItemSchema>;
export type RegulatorySourceDetail = z.infer<typeof regulatorySourceDetailSchema>;
export type RegulatorySourceRelationshipRecord = z.infer<typeof regulatorySourceRelationshipSchema>;
