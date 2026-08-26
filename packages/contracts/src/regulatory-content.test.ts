import { describe, expect, it } from 'vitest';
import { applicabilityRuleSchema } from './applicability.js';
import { regulatoryOfficialTextHash } from './regulatory-evidence.js';
import {
  REGULATORY_PROVISION_SUMMARY_MAX_LENGTH,
  REGULATORY_REQUIREMENT_DESCRIPTION_MAX_LENGTH,
  regulatoryProvisionSchema,
  regulatoryRequirementDetailSchema,
  regulatoryRequirementSchema,
} from './regulatory-content.js';

const provision = {
  id: '10000000-0000-4000-8000-000000000001',
  sourceVersionId: '20000000-0000-4000-8000-000000000001',
  provisionKey: 'DEMO_ARTICLE_A',
  locatorType: 'ARTICLE' as const,
  locatorLabel: 'Artículo sintético A',
  heading: 'Gobernanza sintética',
  summary: 'Resumen editorial sintético y breve.',
  editorialStatus: 'TECHNICAL_REVIEW_PENDING' as const,
  supersedesProvisionId: null,
  createdAt: '2026-08-18T00:00:00.000Z',
};

const requirement = {
  id: '30000000-0000-4000-8000-000000000001',
  requirementKey: 'DEMO_REQUIREMENT_001',
  title: 'Requisito sintético de gobernanza',
  description: 'Descripción editorial sintética.',
  editorialStatus: 'LEGAL_REVIEW_PENDING' as const,
  scopeHint: 'WORK_CENTER' as const,
  supersedesRequirementId: null,
  createdAt: '2026-08-18T00:00:00.000Z',
};

const unit = {
  id: '40000000-0000-4000-8000-000000000001',
  sourceVersionId: provision.sourceVersionId,
  parentUnitId: null,
  unitType: 'ARTICLE' as const,
  identifier: 'ARTICLE_DEMO_A',
  heading: 'Artículo sintético A',
  ordinal: 1,
  officialText: 'Texto oficial sintético para probar trazabilidad exacta.',
  editorialSummary: null,
  normalizedTextHash: regulatoryOfficialTextHash(
    'Texto oficial sintético para probar trazabilidad exacta.',
  ),
  pageStart: 1,
  pageEnd: 1,
  locator: 'p. 1 · Artículo sintético A',
  extractionStatus: 'EXTRACTED' as const,
  reviewStatus: 'TECHNICAL_REVIEW_PENDING' as const,
  createdAt: '2026-08-18T00:00:00.000Z',
};

describe('regulatory provision and requirement contracts', () => {
  it('accepts bounded editorial metadata and exact provenance', () => {
    expect(regulatoryProvisionSchema.parse(provision)).toEqual(provision);
    expect(regulatoryRequirementSchema.parse(requirement)).toEqual(requirement);
    expect(
      regulatoryRequirementDetailSchema.parse({
        requirement,
        provenance: [
          {
            relationshipType: 'PRIMARY_SOURCE',
            provision,
            sourceVersion: {
              catalogVersion: 1,
              candidateStatus: 'TECHNICAL_REVIEW_PENDING',
              recordedAt: '2026-08-18T00:00:00.000Z',
            },
            source: {
              sourceKey: 'DEMO_SYNTHETIC_SOURCE',
              countryCode: 'EC',
              issuer: 'Emisor sintético',
              documentType: 'OTHER',
              referenceNumber: 'DEMO-001',
              canonicalTitle: 'Fuente sintética',
            },
            units: [unit],
          },
        ],
        semanticBoundary: 'STRUCTURED_CANDIDATE_NOT_APPLICABILITY_DECISION',
      }).provenance[0]?.sourceVersion.catalogVersion,
    ).toBe(1);
  });

  it('rejects accidental legal-text storage through bounded summaries and descriptions', () => {
    expect(
      regulatoryProvisionSchema.safeParse({
        ...provision,
        summary: 'x'.repeat(REGULATORY_PROVISION_SUMMARY_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      regulatoryRequirementSchema.safeParse({
        ...requirement,
        description: 'x'.repeat(REGULATORY_REQUIREMENT_DESCRIPTION_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      regulatoryProvisionSchema.safeParse({ ...provision, fullText: 'forbidden' }).success,
    ).toBe(false);
  });

  it('keeps scopeHint outside the executable applicability rule schema', () => {
    expect(
      applicabilityRuleSchema.safeParse({
        id: 'DEMO_RULE_BOUNDARY',
        targetKey: 'DEMO_TARGET_BOUNDARY',
        condition: {
          mode: 'ALL',
          predicates: [{ field: 'organization.country', operator: 'EQUALS', value: 'EC' }],
        },
        state: 'OPTIONAL',
        reasonCode: 'DEMO_BOUNDARY_ONLY',
        explanation: 'Prueba sintética de límite.',
        scopeHint: requirement.scopeHint,
      }).success,
    ).toBe(false);
  });
});
