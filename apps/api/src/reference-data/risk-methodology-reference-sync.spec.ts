import {
  ANITA_GTC45_GUIDANCE_MANIFEST,
  RISK_METHOD_MANIFESTS,
  RISK_METHOD_REGULATORY_CONTEXT_MANIFESTS,
} from '../risk-methodology/risk-method-reference-data';
import { validateRiskMethodologyReferenceManifests } from './risk-methodology-reference-sync';

describe('production-safe Risk Methodology reference sync', () => {
  it('accepts only the canonical, hash-valid manifests compiled into the release', () => {
    expect(() => validateRiskMethodologyReferenceManifests()).not.toThrow();
  });

  it('preserves candidate and legal-review boundaries without encoding LOW as zero', () => {
    const gtc45 = RISK_METHOD_MANIFESTS.find(({ methodKey }) => methodKey === 'GTC45_2010');
    if (!gtc45 || !('canonicalSpecification' in gtc45)) throw new Error('GTC45 fixture missing');
    const low = gtc45.canonicalSpecification.deficiency.find(({ key }) => key === 'LOW');

    expect(gtc45).toMatchObject({
      publicationStatus: 'CANDIDATE',
      technicalReviewStatus: 'PENDING',
      legalReviewStatus: 'PENDING',
      regulatory: false,
    });
    expect(low).toMatchObject({
      numericValue: null,
      specialHandling: 'DIRECT_RISK_LEVEL_IV_WITHOUT_NUMERIC_ND_NP_NR',
    });
    expect(ANITA_GTC45_GUIDANCE_MANIFEST.reviewStatus).toBe('PENDING');
    expect(
      RISK_METHOD_REGULATORY_CONTEXT_MANIFESTS.every(
        ({ relationship, legalReviewStatus }) =>
          relationship === 'CONTEXT_NOT_LEGAL_ENDORSEMENT' && legalReviewStatus === 'PENDING',
      ),
    ).toBe(true);
  });
});
