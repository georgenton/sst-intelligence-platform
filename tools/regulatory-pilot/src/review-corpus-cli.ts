import {
  generateAnitaMultiSourceReview,
  loadRegulatoryReviewCorpus,
  validateRegulatoryReviewCorpusCampaign,
} from './review-corpus.js';

const corpus = loadRegulatoryReviewCorpus();
const report = validateRegulatoryReviewCorpusCampaign(corpus);
const artifacts = generateAnitaMultiSourceReview(corpus);
process.stdout.write(
  `${JSON.stringify(
    {
      CORPUS_VERSION: report.corpusVersion,
      CORPUS_SHA256: report.corpusSha256,
      CORPUS_SOURCE_COUNT: report.corpusSourceCount,
      OFFICIAL_REFERENCES_VERIFIED: report.officialReferencesVerified,
      OFFICIAL_ARTIFACTS_VERIFIED: report.officialArtifactsVerified,
      READY_FOR_EXTRACTION: report.readyForExtraction,
      STRUCTURED_SOURCES: report.structuredSources,
      PUBLISHED_REAL_RULES: report.publishedRealRules,
      UNVERIFIED_REFERENCES: report.unverifiedReferences,
      RELATIONSHIPS_PENDING_REVIEW: report.relationshipsPendingReview,
      SOURCE_REVIEW_ROUTER_CREATES_APPLICABILITY: report.sourceReviewRouterCreatesApplicability,
      SOURCE_REVIEW_ROUTER_CHANGES_DEPTH: report.sourceReviewRouterChangesDepth,
      SUGGESTED_SOURCES_FOR_REVIEW: report.scenarios,
      ARTIFACTS: artifacts,
    },
    null,
    2,
  )}\n`,
);
