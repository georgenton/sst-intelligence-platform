import { z } from 'zod';
import {
  regulatoryCandidateStatusSchema,
  regulatorySourceIdentitySchema,
} from './regulatory-source.js';

export const REGULATORY_PROVISION_SUMMARY_MAX_LENGTH = 1000;
export const REGULATORY_REQUIREMENT_DESCRIPTION_MAX_LENGTH = 2000;

const stableEditorialKeySchema = z.string().regex(/^[A-Z][A-Z0-9_]{2,159}$/);

export const regulatoryProvisionLocatorTypeSchema = z.enum([
  'ARTICLE',
  'SECTION',
  'NUMERAL',
  'ANNEX',
  'TABLE',
  'OTHER',
]);

export const regulatoryProvisionEditorialStatusSchema = z.enum([
  'DRAFT',
  'EXTRACTED',
  'TECHNICAL_REVIEW_PENDING',
  'LEGAL_REVIEW_PENDING',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED',
]);

export const regulatoryRequirementEditorialStatusSchema = z.enum([
  'DRAFT',
  'TECHNICAL_REVIEW_PENDING',
  'LEGAL_REVIEW_PENDING',
  'APPROVED_FOR_RULE_DRAFTING',
  'REJECTED',
  'SUPERSEDED',
]);

export const regulatoryRequirementScopeHintSchema = z.enum([
  'UNKNOWN',
  'ORGANIZATION',
  'WORK_CENTER',
  'AREA_PROCESS',
  'ACTIVITY',
  'ASSET',
  'MULTI_SCOPE',
]);

export const regulatoryRequirementRelationshipTypeSchema = z.enum([
  'PRIMARY_SOURCE',
  'SUPPORTING_SOURCE',
  'RELATED_SOURCE',
]);

export const regulatoryProvisionSchema = z
  .object({
    id: z.uuid(),
    sourceVersionId: z.uuid(),
    provisionKey: stableEditorialKeySchema,
    locatorType: regulatoryProvisionLocatorTypeSchema,
    locatorLabel: z.string().trim().min(1).max(240),
    heading: z.string().trim().min(1).max(500).nullable(),
    summary: z.string().trim().min(1).max(REGULATORY_PROVISION_SUMMARY_MAX_LENGTH).nullable(),
    editorialStatus: regulatoryProvisionEditorialStatusSchema,
    supersedesProvisionId: z.uuid().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const regulatoryRequirementSchema = z
  .object({
    id: z.uuid(),
    requirementKey: stableEditorialKeySchema,
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().min(1).max(REGULATORY_REQUIREMENT_DESCRIPTION_MAX_LENGTH),
    editorialStatus: regulatoryRequirementEditorialStatusSchema,
    scopeHint: regulatoryRequirementScopeHintSchema,
    supersedesRequirementId: z.uuid().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const regulatorySourceVersionReferenceSchema = z
  .object({
    catalogVersion: z.number().int().positive(),
    candidateStatus: regulatoryCandidateStatusSchema,
    recordedAt: z.string().datetime(),
  })
  .strict();

export const regulatoryProvisionRequirementLinkSchema = z
  .object({
    relationshipType: regulatoryRequirementRelationshipTypeSchema,
    requirement: regulatoryRequirementSchema,
  })
  .strict();

export const regulatorySourceProvisionSchema = z
  .object({
    provision: regulatoryProvisionSchema,
    sourceVersion: regulatorySourceVersionReferenceSchema,
    requirements: z.array(regulatoryProvisionRequirementLinkSchema),
  })
  .strict();

export const regulatoryRequirementCatalogItemSchema = regulatoryRequirementSchema
  .extend({ provenanceCount: z.number().int().nonnegative() })
  .strict();

export const regulatoryRequirementProvenanceSchema = z
  .object({
    relationshipType: regulatoryRequirementRelationshipTypeSchema,
    provision: regulatoryProvisionSchema,
    sourceVersion: regulatorySourceVersionReferenceSchema,
    source: regulatorySourceIdentitySchema,
  })
  .strict();

export const regulatoryRequirementDetailSchema = z
  .object({
    requirement: regulatoryRequirementSchema,
    provenance: z.array(regulatoryRequirementProvenanceSchema),
    semanticBoundary: z.literal('STRUCTURED_CANDIDATE_NOT_APPLICABILITY_DECISION'),
  })
  .strict();

export type RegulatoryProvisionLocatorType = z.infer<typeof regulatoryProvisionLocatorTypeSchema>;
export type RegulatoryProvisionEditorialStatus = z.infer<
  typeof regulatoryProvisionEditorialStatusSchema
>;
export type RegulatoryRequirementEditorialStatus = z.infer<
  typeof regulatoryRequirementEditorialStatusSchema
>;
export type RegulatoryRequirementScopeHint = z.infer<typeof regulatoryRequirementScopeHintSchema>;
export type RegulatoryRequirementRelationshipType = z.infer<
  typeof regulatoryRequirementRelationshipTypeSchema
>;
export type RegulatoryProvisionRecord = z.infer<typeof regulatoryProvisionSchema>;
export type RegulatoryRequirementRecord = z.infer<typeof regulatoryRequirementSchema>;
export type RegulatorySourceProvision = z.infer<typeof regulatorySourceProvisionSchema>;
export type RegulatoryRequirementCatalogItem = z.infer<
  typeof regulatoryRequirementCatalogItemSchema
>;
export type RegulatoryRequirementDetail = z.infer<typeof regulatoryRequirementDetailSchema>;
