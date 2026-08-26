-- CreateEnum
CREATE TYPE "RegulatoryArtifactVerificationStatus" AS ENUM ('OFFICIAL_ARTIFACT_VERIFIED', 'OFFICIAL_REFERENCE_ONLY', 'ARTIFACT_PENDING', 'REJECTED_UNVERIFIED');

-- CreateEnum
CREATE TYPE "RegulatoryTextExtractionStatus" AS ENUM ('COMPLETE', 'PARTIAL', 'PENDING', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "RegulatoryVigenciaReviewStatus" AS ENUM ('CURRENT_VERIFIED', 'AMENDED', 'PARTIALLY_AMENDED', 'REPEALED', 'SUPERSEDED', 'PENDING_REVIEW', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RegulatoryUnitType" AS ENUM ('TITLE', 'CHAPTER', 'SECTION', 'ARTICLE', 'DISPOSITION_GENERAL', 'DISPOSITION_TRANSITORY', 'DISPOSITION_REPEAL', 'DISPOSITION_FINAL', 'ANNEX', 'ANNEX_ITEM', 'OTHER');

-- CreateEnum
CREATE TYPE "RegulatoryUnitExtractionStatus" AS ENUM ('EXTRACTED', 'OCR_REVIEW_REQUIRED', 'MANUAL_REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "RegulatoryUnitReviewStatus" AS ENUM ('UNREVIEWED', 'TECHNICAL_REVIEW_PENDING', 'LEGAL_REVIEW_PENDING', 'VERIFIED');

-- CreateEnum
CREATE TYPE "RegulatoryInterpretationReviewDecision" AS ENUM ('APPROVED', 'CHANGES_REQUESTED', 'LEGAL_REVIEW_REQUIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RegulatoryRiskLinkProvenance" AS ENUM ('SYSTEM_RULE_MATCH', 'EXPERT_LINK', 'USER_REFERENCE');

-- CreateEnum
CREATE TYPE "UnifiedSstEvaluationStatus" AS ENUM ('DRAFT', 'EVALUATED', 'REVIEW_PENDING', 'CLOSED');

-- AlterTable
ALTER TABLE "RegulatorySourceVersion" ADD COLUMN     "artifactPageCount" INTEGER,
ADD COLUMN     "artifactVerificationStatus" "RegulatoryArtifactVerificationStatus" NOT NULL DEFAULT 'ARTIFACT_PENDING',
ADD COLUMN     "artifactVersionKey" VARCHAR(160),
ADD COLUMN     "textExtractionStatus" "RegulatoryTextExtractionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "vigenciaReviewStatus" "RegulatoryVigenciaReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW';

-- One-time classification backfill into columns introduced by this migration. It does not rewrite
-- source text, artifact hashes, URLs or prior editorial content.
ALTER TABLE "RegulatorySourceVersion" DISABLE TRIGGER "RegulatorySourceVersion_immutable";
UPDATE "RegulatorySourceVersion" AS version
SET
  "artifactVerificationStatus" = CASE
    WHEN source."sourceKey" = 'EC_IESS_CD_527_INTERVIEW_REFERENCE' THEN 'REJECTED_UNVERIFIED'::"RegulatoryArtifactVerificationStatus"
    WHEN source."sourceKey" = 'EC_MSP_00004_2026_SISAT' THEN 'OFFICIAL_REFERENCE_ONLY'::"RegulatoryArtifactVerificationStatus"
    WHEN version."officialDocumentSha256" IS NOT NULL THEN 'OFFICIAL_ARTIFACT_VERIFIED'::"RegulatoryArtifactVerificationStatus"
    ELSE 'ARTIFACT_PENDING'::"RegulatoryArtifactVerificationStatus"
  END,
  "textExtractionStatus" = CASE
    WHEN source."sourceKey" IN (
      'EC_CAN_DECISION_584', 'EC_CAN_RESOLUTION_957', 'EC_IESS_CD_677', 'EC_IESS_CD_692',
      'EC_LABOR_CODE', 'EC_MDT_2024_196', 'EC_MDT_2024_196_ANNEX_1',
      'EC_MDT_2025_122_CONSTRUCTION'
    ) AND version."officialDocumentSha256" IS NOT NULL THEN 'COMPLETE'::"RegulatoryTextExtractionStatus"
    WHEN source."sourceKey" IN ('EC_IESS_CD_513', 'EC_IESS_CD_517', 'EC_MDT_2024_196_ANNEX_3')
      AND version."officialDocumentSha256" IS NOT NULL THEN 'PARTIAL'::"RegulatoryTextExtractionStatus"
    WHEN version."officialDocumentSha256" IS NOT NULL THEN 'PENDING'::"RegulatoryTextExtractionStatus"
    WHEN source."sourceKey" IN ('EC_IESS_CD_527_INTERVIEW_REFERENCE', 'EC_MSP_00004_2026_SISAT') THEN 'NOT_APPLICABLE'::"RegulatoryTextExtractionStatus"
    ELSE 'PENDING'::"RegulatoryTextExtractionStatus"
  END,
  "vigenciaReviewStatus" = CASE
    WHEN source."sourceKey" = 'EC_IESS_CD_513' THEN 'PARTIALLY_AMENDED'::"RegulatoryVigenciaReviewStatus"
    WHEN source."sourceKey" = 'EC_IESS_CD_527_INTERVIEW_REFERENCE' THEN 'UNKNOWN'::"RegulatoryVigenciaReviewStatus"
    ELSE 'PENDING_REVIEW'::"RegulatoryVigenciaReviewStatus"
  END,
  "artifactPageCount" = CASE source."sourceKey"
    WHEN 'EC_CAN_DECISION_584' THEN 15 WHEN 'EC_CAN_RESOLUTION_957' THEN 8
    WHEN 'EC_EXECUTIVE_DECREE_255' THEN 43 WHEN 'EC_IESS_CD_513' THEN 72
    WHEN 'EC_IESS_CD_517' THEN 19 WHEN 'EC_IESS_CD_677' THEN 22
    WHEN 'EC_IESS_CD_692' THEN 5 WHEN 'EC_LABOR_CODE' THEN 199
    WHEN 'EC_MDT_2024_196' THEN 23 WHEN 'EC_MDT_2024_196_ANNEX_1' THEN 8
    WHEN 'EC_MDT_2024_196_ANNEX_2' THEN 91 WHEN 'EC_MDT_2024_196_ANNEX_3' THEN 102
    WHEN 'EC_MDT_2025_122_CONSTRUCTION' THEN 70 ELSE NULL
  END,
  "artifactVersionKey" = CASE WHEN version."officialDocumentSha256" IS NOT NULL
    THEN source."sourceKey" || ':v' || version."catalogVersion"::text || ':' || version."officialDocumentSha256"
    ELSE NULL END
FROM "RegulatorySource" AS source
WHERE version."sourceId" = source."id";
ALTER TABLE "RegulatorySourceVersion" ENABLE TRIGGER "RegulatorySourceVersion_immutable";

-- CreateTable
CREATE TABLE "TechnicalAssessmentRiskValuation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "riskMethodVersionId" UUID NOT NULL,
    "methodSnapshot" JSONB NOT NULL,
    "riskInput" JSONB NOT NULL,
    "riskResult" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicalAssessmentRiskValuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationRiskMethodPolicyVersion" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "defaultRiskMethodVersionId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationRiskMethodPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationRiskMethodPolicyAllowed" (
    "policyVersionId" UUID NOT NULL,
    "riskMethodVersionId" UUID NOT NULL,

    CONSTRAINT "OrganizationRiskMethodPolicyAllowed_pkey" PRIMARY KEY ("policyVersionId","riskMethodVersionId")
);

-- CreateTable
CREATE TABLE "OrganizationGuided5x5ProfileVersion" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "riskMethodVersionId" UUID NOT NULL,
    "guidance" JSONB NOT NULL,
    "contentHash" VARCHAR(71) NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationGuided5x5ProfileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryUnit" (
    "id" UUID NOT NULL,
    "sourceVersionId" UUID NOT NULL,
    "parentUnitId" UUID,
    "unitType" "RegulatoryUnitType" NOT NULL,
    "identifier" VARCHAR(160) NOT NULL,
    "heading" VARCHAR(500),
    "ordinal" INTEGER NOT NULL,
    "officialText" TEXT NOT NULL,
    "editorialSummary" TEXT,
    "normalizedTextHash" VARCHAR(71) NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "locator" VARCHAR(240) NOT NULL,
    "extractionStatus" "RegulatoryUnitExtractionStatus" NOT NULL,
    "reviewStatus" "RegulatoryUnitReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatoryUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryProvisionUnit" (
    "provisionId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatoryProvisionUnit_pkey" PRIMARY KEY ("provisionId","unitId")
);

-- CreateTable
CREATE TABLE "RegulatoryRuleDraftRequirement" (
    "ruleDraftId" UUID NOT NULL,
    "requirementId" UUID NOT NULL,
    "relationshipType" "AdaptiveRuleRequirementType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatoryRuleDraftRequirement_pkey" PRIMARY KEY ("ruleDraftId","requirementId","relationshipType")
);

-- CreateTable
CREATE TABLE "RegulatoryInterpretationReview" (
    "id" UUID NOT NULL,
    "ruleDraftId" UUID NOT NULL,
    "requirementId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "reviewerUserId" UUID NOT NULL,
    "decision" "RegulatoryInterpretationReviewDecision" NOT NULL,
    "comment" VARCHAR(2000),
    "engineOutputHash" VARCHAR(71) NOT NULL,
    "sourceVersionIdSnapshot" UUID NOT NULL,
    "requirementSnapshot" JSONB NOT NULL,
    "ruleDraftSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatoryInterpretationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnifiedSstEvaluation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "profileVersionId" UUID NOT NULL,
    "status" "UnifiedSstEvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "contextSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "UnifiedSstEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnifiedSstEvaluationItem" (
    "id" UUID NOT NULL,
    "evaluationId" UUID NOT NULL,
    "requirementId" UUID NOT NULL,
    "ruleDraftId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "proposedState" "ApplicabilityState" NOT NULL,
    "whyMatched" VARCHAR(1000) NOT NULL,
    "organizationFacts" JSONB NOT NULL,
    "predicateTrace" JSONB NOT NULL,
    "regulatoryTrace" JSONB NOT NULL,
    "currentStateSnapshot" JSONB,
    "organizationEvidence" JSONB NOT NULL,
    "riskReferences" JSONB NOT NULL,
    "engineOutputHash" VARCHAR(71) NOT NULL,
    "professionalReviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnifiedSstEvaluationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionFindingRegulatoryLink" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "unitId" UUID,
    "requirementId" UUID,
    "provenance" "RegulatoryRiskLinkProvenance" NOT NULL,
    "rationale" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionFindingRegulatoryLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicalAssessmentRegulatoryLink" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "unitId" UUID,
    "requirementId" UUID,
    "provenance" "RegulatoryRiskLinkProvenance" NOT NULL,
    "rationale" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicalAssessmentRegulatoryLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TechnicalAssessmentRiskValuation_assessmentId_key" ON "TechnicalAssessmentRiskValuation"("assessmentId");

-- CreateIndex
CREATE INDEX "TechnicalAssessmentRiskValuation_organizationId_calculatedA_idx" ON "TechnicalAssessmentRiskValuation"("organizationId", "calculatedAt");

-- CreateIndex
CREATE INDEX "TechnicalAssessmentRiskValuation_riskMethodVersionId_idx" ON "TechnicalAssessmentRiskValuation"("riskMethodVersionId");

-- CreateIndex
CREATE INDEX "OrganizationRiskMethodPolicyVersion_organizationId_createdA_idx" ON "OrganizationRiskMethodPolicyVersion"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationRiskMethodPolicyVersion_organizationId_version_key" ON "OrganizationRiskMethodPolicyVersion"("organizationId", "version");

-- CreateIndex
CREATE INDEX "OrganizationRiskMethodPolicyAllowed_riskMethodVersionId_idx" ON "OrganizationRiskMethodPolicyAllowed"("riskMethodVersionId");

-- CreateIndex
CREATE INDEX "OrganizationGuided5x5ProfileVersion_organizationId_createdA_idx" ON "OrganizationGuided5x5ProfileVersion"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationGuided5x5ProfileVersion_organizationId_version_key" ON "OrganizationGuided5x5ProfileVersion"("organizationId", "version");

-- CreateIndex
CREATE INDEX "RegulatoryUnit_sourceVersionId_unitType_ordinal_idx" ON "RegulatoryUnit"("sourceVersionId", "unitType", "ordinal");

-- CreateIndex
CREATE INDEX "RegulatoryUnit_normalizedTextHash_idx" ON "RegulatoryUnit"("normalizedTextHash");

-- CreateIndex
CREATE UNIQUE INDEX "RegulatoryUnit_sourceVersionId_identifier_key" ON "RegulatoryUnit"("sourceVersionId", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "RegulatoryUnit_sourceVersionId_ordinal_key" ON "RegulatoryUnit"("sourceVersionId", "ordinal");

-- CreateIndex
CREATE INDEX "RegulatoryProvisionUnit_unitId_idx" ON "RegulatoryProvisionUnit"("unitId");

-- CreateIndex
CREATE INDEX "RegulatoryRuleDraftRequirement_requirementId_idx" ON "RegulatoryRuleDraftRequirement"("requirementId");

-- CreateIndex
CREATE INDEX "RegulatoryInterpretationReview_ruleDraftId_requirementId_cr_idx" ON "RegulatoryInterpretationReview"("ruleDraftId", "requirementId", "createdAt");

-- CreateIndex
CREATE INDEX "RegulatoryInterpretationReview_unitId_createdAt_idx" ON "RegulatoryInterpretationReview"("unitId", "createdAt");

-- CreateIndex
CREATE INDEX "UnifiedSstEvaluation_organizationId_createdAt_idx" ON "UnifiedSstEvaluation"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "UnifiedSstEvaluation_organizationId_status_idx" ON "UnifiedSstEvaluation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "UnifiedSstEvaluationItem_requirementId_unitId_idx" ON "UnifiedSstEvaluationItem"("requirementId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "UnifiedSstEvaluationItem_evaluationId_ruleDraftId_key" ON "UnifiedSstEvaluationItem"("evaluationId", "ruleDraftId");

-- CreateIndex
CREATE INDEX "InspectionFindingRegulatoryLink_organizationId_findingId_idx" ON "InspectionFindingRegulatoryLink"("organizationId", "findingId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionFindingRegulatoryLink_findingId_unitId_requiremen_key" ON "InspectionFindingRegulatoryLink"("findingId", "unitId", "requirementId", "provenance");

-- CreateIndex
CREATE INDEX "TechnicalAssessmentRegulatoryLink_organizationId_assessment_idx" ON "TechnicalAssessmentRegulatoryLink"("organizationId", "assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicalAssessmentRegulatoryLink_assessmentId_unitId_requi_key" ON "TechnicalAssessmentRegulatoryLink"("assessmentId", "unitId", "requirementId", "provenance");

-- AddForeignKey
ALTER TABLE "TechnicalAssessmentRiskValuation" ADD CONSTRAINT "TechnicalAssessmentRiskValuation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalAssessmentRiskValuation" ADD CONSTRAINT "TechnicalAssessmentRiskValuation_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "TechnicalAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalAssessmentRiskValuation" ADD CONSTRAINT "TechnicalAssessmentRiskValuation_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "RiskMethodVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationRiskMethodPolicyVersion" ADD CONSTRAINT "OrganizationRiskMethodPolicyVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationRiskMethodPolicyVersion" ADD CONSTRAINT "OrganizationRiskMethodPolicyVersion_defaultRiskMethodVersi_fkey" FOREIGN KEY ("defaultRiskMethodVersionId") REFERENCES "RiskMethodVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationRiskMethodPolicyVersion" ADD CONSTRAINT "OrganizationRiskMethodPolicyVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationRiskMethodPolicyAllowed" ADD CONSTRAINT "OrganizationRiskMethodPolicyAllowed_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "OrganizationRiskMethodPolicyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationRiskMethodPolicyAllowed" ADD CONSTRAINT "OrganizationRiskMethodPolicyAllowed_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "RiskMethodVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationGuided5x5ProfileVersion" ADD CONSTRAINT "OrganizationGuided5x5ProfileVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationGuided5x5ProfileVersion" ADD CONSTRAINT "OrganizationGuided5x5ProfileVersion_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "RiskMethodVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationGuided5x5ProfileVersion" ADD CONSTRAINT "OrganizationGuided5x5ProfileVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryUnit" ADD CONSTRAINT "RegulatoryUnit_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "RegulatorySourceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryUnit" ADD CONSTRAINT "RegulatoryUnit_parentUnitId_fkey" FOREIGN KEY ("parentUnitId") REFERENCES "RegulatoryUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryProvisionUnit" ADD CONSTRAINT "RegulatoryProvisionUnit_provisionId_fkey" FOREIGN KEY ("provisionId") REFERENCES "RegulatoryProvision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryProvisionUnit" ADD CONSTRAINT "RegulatoryProvisionUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RegulatoryUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryRuleDraftRequirement" ADD CONSTRAINT "RegulatoryRuleDraftRequirement_ruleDraftId_fkey" FOREIGN KEY ("ruleDraftId") REFERENCES "AdaptiveRuleDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryRuleDraftRequirement" ADD CONSTRAINT "RegulatoryRuleDraftRequirement_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "RegulatoryRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryInterpretationReview" ADD CONSTRAINT "RegulatoryInterpretationReview_ruleDraftId_fkey" FOREIGN KEY ("ruleDraftId") REFERENCES "AdaptiveRuleDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryInterpretationReview" ADD CONSTRAINT "RegulatoryInterpretationReview_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "RegulatoryRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryInterpretationReview" ADD CONSTRAINT "RegulatoryInterpretationReview_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RegulatoryUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryInterpretationReview" ADD CONSTRAINT "RegulatoryInterpretationReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnifiedSstEvaluation" ADD CONSTRAINT "UnifiedSstEvaluation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnifiedSstEvaluation" ADD CONSTRAINT "UnifiedSstEvaluation_profileVersionId_fkey" FOREIGN KEY ("profileVersionId") REFERENCES "OrganizationSstProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnifiedSstEvaluation" ADD CONSTRAINT "UnifiedSstEvaluation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnifiedSstEvaluationItem" ADD CONSTRAINT "UnifiedSstEvaluationItem_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "UnifiedSstEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnifiedSstEvaluationItem" ADD CONSTRAINT "UnifiedSstEvaluationItem_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "RegulatoryRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnifiedSstEvaluationItem" ADD CONSTRAINT "UnifiedSstEvaluationItem_ruleDraftId_fkey" FOREIGN KEY ("ruleDraftId") REFERENCES "AdaptiveRuleDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnifiedSstEvaluationItem" ADD CONSTRAINT "UnifiedSstEvaluationItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RegulatoryUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFindingRegulatoryLink" ADD CONSTRAINT "InspectionFindingRegulatoryLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFindingRegulatoryLink" ADD CONSTRAINT "InspectionFindingRegulatoryLink_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "InspectionFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFindingRegulatoryLink" ADD CONSTRAINT "InspectionFindingRegulatoryLink_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RegulatoryUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFindingRegulatoryLink" ADD CONSTRAINT "InspectionFindingRegulatoryLink_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "RegulatoryRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalAssessmentRegulatoryLink" ADD CONSTRAINT "TechnicalAssessmentRegulatoryLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalAssessmentRegulatoryLink" ADD CONSTRAINT "TechnicalAssessmentRegulatoryLink_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "TechnicalAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalAssessmentRegulatoryLink" ADD CONSTRAINT "TechnicalAssessmentRegulatoryLink_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RegulatoryUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalAssessmentRegulatoryLink" ADD CONSTRAINT "TechnicalAssessmentRegulatoryLink_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "RegulatoryRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain integrity: risk-to-regulation links require at least one exact legal target.
ALTER TABLE "InspectionFindingRegulatoryLink"
ADD CONSTRAINT "InspectionFindingRegulatoryLink_target_check"
CHECK ("unitId" IS NOT NULL OR "requirementId" IS NOT NULL);

ALTER TABLE "TechnicalAssessmentRegulatoryLink"
ADD CONSTRAINT "TechnicalAssessmentRegulatoryLink_target_check"
CHECK ("unitId" IS NOT NULL OR "requirementId" IS NOT NULL);

ALTER TABLE "RegulatoryUnit"
ADD CONSTRAINT "RegulatoryUnit_page_range_check"
CHECK (
  ("pageStart" IS NULL AND "pageEnd" IS NULL)
  OR ("pageStart" > 0 AND "pageEnd" >= "pageStart")
),
ADD CONSTRAINT "RegulatoryUnit_text_hash_check"
CHECK ("normalizedTextHash" ~ '^sha256:[0-9a-f]{64}$'),
ADD CONSTRAINT "RegulatoryUnit_official_text_nonempty_check"
CHECK (length(btrim("officialText")) > 0);

-- A verified unit is a historical record. A changed artifact is represented by a new
-- RegulatorySourceVersion and a new unit set, never by rewriting published wording.
CREATE FUNCTION prevent_verified_regulatory_unit_mutation()
RETURNS trigger AS $$
BEGIN
  IF OLD."reviewStatus" = 'VERIFIED' THEN
    RAISE EXCEPTION 'VERIFIED_REGULATORY_UNIT_IMMUTABLE';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RegulatoryUnit_verified_immutable"
BEFORE UPDATE OR DELETE ON "RegulatoryUnit"
FOR EACH ROW EXECUTE FUNCTION prevent_verified_regulatory_unit_mutation();

-- RenameIndex
ALTER INDEX "RegulatoryRequirementSource_requirementId_provisionId_relations" RENAME TO "RegulatoryRequirementSource_requirementId_provisionId_relat_key";

-- RenameIndex
ALTER INDEX "RegulatorySourceRelationship_fromSourceId_toSourceId_relationsh" RENAME TO "RegulatorySourceRelationship_fromSourceId_toSourceId_relati_key";

-- RenameIndex
ALTER INDEX "RiskMethodExpertGuidanceVersion_riskMethodVersionId_publication" RENAME TO "RiskMethodExpertGuidanceVersion_riskMethodVersionId_publica_idx";

-- RenameIndex
ALTER INDEX "RiskMethodRegulatoryContext_riskMethodVersionId_jurisdiction_id" RENAME TO "RiskMethodRegulatoryContext_riskMethodVersionId_jurisdictio_idx";

-- RenameIndex
ALTER INDEX "RiskMethodSourceLink_riskMethodVersionId_methodologySourceVersi" RENAME TO "RiskMethodSourceLink_riskMethodVersionId_methodologySourceV_key";

-- RenameIndex
ALTER INDEX "TechnicalAssessmentReview_organizationId_assessmentId_createdAt" RENAME TO "TechnicalAssessmentReview_organizationId_assessmentId_creat_idx";
