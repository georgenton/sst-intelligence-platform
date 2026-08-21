import { describe, expect, it } from 'vitest';
import {
  regulatoryCandidateStatusSchema,
  regulatorySourceDetailSchema,
  regulatorySourceListItemSchema,
  regulatorySupersessionStatusSchema,
} from './regulatory-source';

const identity = {
  sourceKey: 'EC_IESS_CD_527_INTERVIEW_REFERENCE',
  countryCode: 'EC',
  issuer: 'Desconocido — referencia de entrevista',
  documentType: 'OTHER' as const,
  referenceNumber: 'C.D. 527',
  canonicalTitle: 'C.D. 527 — título no verificado',
};

it('keeps editorial and supersession states finite without legal-status inference', () => {
  expect(regulatoryCandidateStatusSchema.safeParse('APPROVED_FOR_RULES').success).toBe(true);
  expect(regulatoryCandidateStatusSchema.safeParse('CURRENT').success).toBe(false);
  expect(regulatorySupersessionStatusSchema.safeParse('REPEALED').success).toBe(false);
});

it('accepts safe catalog metadata and rejects synthesized applicability fields', () => {
  const listItem = {
    ...identity,
    latestCatalogVersion: 1,
    candidateStatus: 'REJECTED_REFERENCE' as const,
    officialDocumentLocated: false,
    readyForExtraction: false,
    readyForRules: false,
    supersessionStatus: 'UNVERIFIED_REFERENCE' as const,
  };
  expect(regulatorySourceListItemSchema.parse(listItem)).toEqual(listItem);
  expect(() =>
    regulatorySourceListItemSchema.parse({ ...listItem, isApplicable: false }),
  ).toThrow();
});

describe('source detail boundary', () => {
  it('distinguishes catalog metadata from legal interpretation', () => {
    const detail = {
      source: identity,
      latestVersion: {
        catalogVersion: 1,
        candidateStatus: 'REJECTED_REFERENCE' as const,
        officialDocumentLocated: false,
        officialUrl: null,
        officialDocumentSha256: null,
        officialDocumentRetrievedAt: null,
        officialDocumentMediaType: null,
        officialPublicationReference: null,
        publicationDate: null,
        effectiveFrom: null,
        effectiveTo: null,
        supersessionStatus: 'UNVERIFIED_REFERENCE' as const,
        readyForExtraction: false,
        readyForRules: false,
        reviewNotes: 'Referencia no verificada.',
        recordedAt: '2026-08-18T00:00:00.000Z',
      },
      metadataBoundary: 'CATALOG_METADATA_NOT_LEGAL_INTERPRETATION' as const,
    };
    expect(regulatorySourceDetailSchema.parse(detail)).toEqual(detail);
  });
});
