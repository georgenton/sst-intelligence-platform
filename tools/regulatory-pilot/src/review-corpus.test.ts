import { describe, expect, it } from 'vitest';
import {
  assertRegulatoryReviewCorpusRevision,
  regulatoryReviewCorpusMaterialHash,
  validateRegulatoryReviewCorpus,
  type RegulatoryReviewCorpusBundle,
} from '@sst/contracts';
import {
  loadRegulatoryReviewCorpus,
  suggestSourcesForReview,
  validateRegulatoryReviewCorpusCampaign,
} from './review-corpus.js';

function cloneCorpus() {
  return structuredClone(loadRegulatoryReviewCorpus());
}

function rehash(corpus: RegulatoryReviewCorpusBundle) {
  corpus.index.corpusSha256 = regulatoryReviewCorpusMaterialHash({
    sources: corpus.sources,
    relationships: corpus.relationships,
    scenarioMap: corpus.scenarioMap,
  });
  return corpus;
}

describe('Ecuador SST multi-source review corpus', () => {
  it('keeps unique identities, honest verification states and every source away from rules', () => {
    const corpus = loadRegulatoryReviewCorpus();
    const report = validateRegulatoryReviewCorpusCampaign(corpus);
    expect(report).toMatchObject({
      corpusVersion: '1.0.0',
      corpusSourceCount: 15,
      officialReferencesVerified: 14,
      officialArtifactsVerified: 11,
      readyForExtraction: 11,
      structuredSources: 1,
      publishedRealRules: 0,
      unverifiedReferences: 1,
      sourceReviewRouterCreatesApplicability: false,
      sourceReviewRouterChangesDepth: false,
    });
    expect(new Set(corpus.sources.map(({ sourceKey }) => sourceKey)).size).toBe(15);
    expect(corpus.sources.every(({ readyForRules }) => !readyForRules)).toBe(true);
    expect(
      corpus.sources
        .filter(({ verificationStatus }) => verificationStatus === 'VERIFIED_OFFICIAL_ARTIFACT')
        .every(
          ({ officialDocumentSha256, officialDocumentBytes, officialDocumentMediaType }) =>
            /^sha256:[0-9a-f]{64}$/.test(officialDocumentSha256 ?? '') &&
            (officialDocumentBytes ?? 0) > 0 &&
            officialDocumentMediaType === 'application/pdf',
        ),
    ).toBe(true);
  });

  it('keeps C.D. 527 rejected and separates confirmed amendment from pending supersession review', () => {
    const corpus = loadRegulatoryReviewCorpus();
    expect(
      corpus.sources.find(({ sourceKey }) => sourceKey === 'EC_IESS_CD_527_INTERVIEW_REFERENCE'),
    ).toMatchObject({
      verificationStatus: 'UNVERIFIED_REFERENCE',
      candidateStatus: 'REJECTED_REFERENCE',
      officialDocumentLocated: false,
      readyForExtraction: false,
      readyForRules: false,
    });
    expect(
      corpus.relationships.relationships.find(
        ({ fromSourceKey }) => fromSourceKey === 'EC_IESS_CD_692',
      ),
    ).toMatchObject({
      toSourceKey: 'EC_IESS_CD_513',
      reviewStatus: 'CONFIRMED',
      dependencyState: 'AMENDMENT_CONFIRMED',
    });
    expect(
      corpus.relationships.relationships.find(
        ({ fromSourceKey }) => fromSourceKey === 'EC_IESS_CD_517',
      ),
    ).toMatchObject({
      toSourceKey: 'EC_IESS_CD_677',
      reviewStatus: 'PENDING_REVIEW',
      dependencyState: 'RELATION_REVIEW_REQUIRED',
    });
  });

  it('shows construction and SISAT in the right review maps without applicability or depth output', () => {
    const corpus = loadRegulatoryReviewCorpus();
    const construction = suggestSourcesForReview(corpus, 'construction');
    const chemical = suggestSourcesForReview(corpus, 'chemical-pharma');
    expect(construction.map(({ sourceKey }) => sourceKey)).toContain(
      'EC_MDT_2025_122_CONSTRUCTION',
    );
    expect(chemical.map(({ sourceKey }) => sourceKey)).toContain('EC_MSP_00004_2026_SISAT');
    for (const suggestion of [...construction, ...chemical]) {
      expect(Object.keys(suggestion).sort()).toEqual(['reviewReason', 'sourceKey', 'status']);
      expect(suggestion.status).toBe('PENDING_EXPERT_REVIEW');
    }
  });

  it('rejects applicability state in a source suggestion even with a recomputed hash', () => {
    const corpus = cloneCorpus();
    Object.assign(corpus.scenarioMap.scenarios[0]!.sourceSuggestions[0]!, {
      applicability: 'MANDATORY',
    });
    expect(() => validateRegulatoryReviewCorpus(rehash(corpus))).toThrow();
  });

  it('rejects same-version canonical drift', () => {
    const current = cloneCorpus();
    const incoming = cloneCorpus();
    incoming.sources[0]!.reviewNotes = 'Changed review note without a new corpus version.';
    rehash(incoming);
    expect(() => assertRegulatoryReviewCorpusRevision(current.index, incoming.index)).toThrow(
      'CORPUS_VERSION_DRIFT',
    );
  });
});
