-- CreateEnum
CREATE TYPE "AdaptiveFactCategory" AS ENUM ('ORGANIZATION_PROFILE', 'WORKFORCE', 'WORK_CENTER_CONTEXT', 'INFRASTRUCTURE', 'OPERATION', 'HIGH_RISK_WORK', 'CONTRACTORS', 'ACTIVITY', 'STRATEGIC_PRIORITY', 'OTHER');

-- CreateEnum
CREATE TYPE "AdaptiveFactValueType" AS ENUM ('BOOLEAN', 'INTEGER', 'DECIMAL', 'SHORT_TEXT', 'SINGLE_CHOICE', 'MULTI_CHOICE');

-- CreateEnum
CREATE TYPE "AdaptiveFactCollectionMode" AS ENUM ('DERIVED_ONLY', 'USER_ASKABLE', 'DERIVED_OR_USER', 'CONTEXT_ONLY');

-- CreateEnum
CREATE TYPE "AdaptiveScopeKind" AS ENUM ('ORGANIZATION', 'WORK_CENTER');

-- CreateEnum
CREATE TYPE "AdaptiveTargetCategory" AS ENUM ('GOVERNANCE', 'EMERGENCY_PREPAREDNESS', 'WORKPLACE_CONDITIONS', 'HEALTH_MANAGEMENT', 'HIGH_RISK_WORK', 'CONTRACTOR_COORDINATION', 'INSPECTION', 'TRAINING', 'DOCUMENTATION', 'PROFESSIONAL_REVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "AdaptiveRuleDraftStatus" AS ENUM ('DRAFT', 'TECHNICAL_REVIEW_PENDING', 'LEGAL_REVIEW_PENDING', 'READY_TO_PUBLISH', 'REJECTED');

-- CreateEnum
CREATE TYPE "AdaptiveRuleRequirementType" AS ENUM ('PRIMARY_REQUIREMENT', 'SUPPORTING_REQUIREMENT', 'RELATED_REQUIREMENT');

-- CreateEnum
CREATE TYPE "AdaptiveSessionStatus" AS ENUM ('COLLECTING_INFORMATION', 'READY_TO_PROPOSE', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdaptiveAnswerSource" AS ENUM ('DERIVED_PROFILE', 'DERIVED_ORGANIZATION', 'DERIVED_WORK_CENTER', 'USER_DECLARED', 'EXPERT_DECLARED');

-- CreateEnum
CREATE TYPE "AdaptiveReviewDepth" AS ENUM ('BASIC_VISIBLE', 'TECHNICAL', 'SYSTEMIC', 'UNDETERMINED');

-- CreateEnum
CREATE TYPE "AdaptiveCurrentStateStatus" AS ENUM ('UNKNOWN', 'NOT_IMPLEMENTED', 'PLANNED', 'IN_PROGRESS', 'PARTIALLY_IMPLEMENTED', 'IMPLEMENTED');

-- CreateEnum
CREATE TYPE "AdaptiveCurrentStateEvidenceType" AS ENUM ('NOTE', 'EXTERNAL_LINK');

-- AlterTable
ALTER TABLE "RegulatorySource" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AdaptiveFactDefinition" (
    "id" UUID NOT NULL,
    "factKey" VARCHAR(160) NOT NULL,
    "category" "AdaptiveFactCategory" NOT NULL,
    "defaultScope" "AdaptiveScopeKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveFactDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveFactVersion" (
    "id" UUID NOT NULL,
    "factDefinitionId" UUID NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "valueType" "AdaptiveFactValueType" NOT NULL,
    "questionText" VARCHAR(240) NOT NULL,
    "helpText" VARCHAR(500) NOT NULL,
    "unknownAllowed" BOOLEAN NOT NULL DEFAULT true,
    "collectionMode" "AdaptiveFactCollectionMode" NOT NULL,
    "validation" JSONB NOT NULL,
    "choiceOptions" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedesFactVersionId" UUID,

    CONSTRAINT "AdaptiveFactVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveConfigurationTargetDefinition" (
    "id" UUID NOT NULL,
    "targetKey" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveConfigurationTargetDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveConfigurationTargetVersion" (
    "id" UUID NOT NULL,
    "targetDefinitionId" UUID NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "category" "AdaptiveTargetCategory" NOT NULL,
    "currentStateQuestion" VARCHAR(240) NOT NULL,
    "evidenceSuggestions" JSONB NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedesTargetVersionId" UUID,

    CONSTRAINT "AdaptiveConfigurationTargetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveRuleDefinition" (
    "id" UUID NOT NULL,
    "ruleKey" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveRuleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveRuleDraft" (
    "id" UUID NOT NULL,
    "ruleDefinitionId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "AdaptiveRuleDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "schema" JSONB NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "regulatory" BOOLEAN NOT NULL DEFAULT false,
    "demoDisclaimer" VARCHAR(500),
    "technicalReviewedAt" TIMESTAMP(3),
    "legalReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptiveRuleDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveRuleVersion" (
    "id" UUID NOT NULL,
    "ruleDefinitionId" UUID NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "schema" JSONB NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "regulatory" BOOLEAN NOT NULL DEFAULT false,
    "demoDisclaimer" VARCHAR(500),
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedesRuleVersionId" UUID,

    CONSTRAINT "AdaptiveRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveRuleRequirement" (
    "id" UUID NOT NULL,
    "ruleVersionId" UUID NOT NULL,
    "requirementId" UUID NOT NULL,
    "relationshipType" "AdaptiveRuleRequirementType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveRuleRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveRuleGroupDefinition" (
    "id" UUID NOT NULL,
    "groupKey" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveRuleGroupDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveRuleGroupVersion" (
    "id" UUID NOT NULL,
    "groupDefinitionId" UUID NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "priority" INTEGER NOT NULL,
    "scopeMode" VARCHAR(32) NOT NULL,
    "activationExpression" JSONB NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "regulatory" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedesGroupVersionId" UUID,

    CONSTRAINT "AdaptiveRuleGroupVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveRuleGroupRule" (
    "groupVersionId" UUID NOT NULL,
    "ruleVersionId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "AdaptiveRuleGroupRule_pkey" PRIMARY KEY ("groupVersionId","ruleVersionId")
);

-- CreateTable
CREATE TABLE "AdaptiveRulePackDefinition" (
    "id" UUID NOT NULL,
    "packKey" VARCHAR(160) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveRulePackDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveRulePackVersion" (
    "id" UUID NOT NULL,
    "packDefinitionId" UUID NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "engineSchemaVersion" VARCHAR(32) NOT NULL,
    "schema" JSONB NOT NULL,
    "contentHash" VARCHAR(100) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "regulatory" BOOLEAN NOT NULL DEFAULT false,
    "disclaimer" VARCHAR(500) NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveRulePackVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveRulePackGroup" (
    "packVersionId" UUID NOT NULL,
    "groupVersionId" UUID NOT NULL,

    CONSTRAINT "AdaptiveRulePackGroup_pkey" PRIMARY KEY ("packVersionId","groupVersionId")
);

-- CreateTable
CREATE TABLE "AdaptiveRulePackRule" (
    "packVersionId" UUID NOT NULL,
    "ruleVersionId" UUID NOT NULL,

    CONSTRAINT "AdaptiveRulePackRule_pkey" PRIMARY KEY ("packVersionId","ruleVersionId")
);

-- CreateTable
CREATE TABLE "AdaptiveRulePackFact" (
    "packVersionId" UUID NOT NULL,
    "factVersionId" UUID NOT NULL,

    CONSTRAINT "AdaptiveRulePackFact_pkey" PRIMARY KEY ("packVersionId","factVersionId")
);

-- CreateTable
CREATE TABLE "AdaptiveRulePackTarget" (
    "packVersionId" UUID NOT NULL,
    "targetVersionId" UUID NOT NULL,

    CONSTRAINT "AdaptiveRulePackTarget_pkey" PRIMARY KEY ("packVersionId","targetVersionId")
);

-- CreateTable
CREATE TABLE "AdaptiveConfigurationSession" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "profileVersionId" UUID NOT NULL,
    "rulePackVersionId" UUID NOT NULL,
    "status" "AdaptiveSessionStatus" NOT NULL DEFAULT 'COLLECTING_INFORMATION',
    "sessionRevision" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "AdaptiveConfigurationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveSessionScope" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "scopeKey" VARCHAR(200) NOT NULL,
    "kind" "AdaptiveScopeKind" NOT NULL,
    "workCenterId" UUID,
    "displayNameSnapshot" VARCHAR(240) NOT NULL,
    "activeSnapshot" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveSessionScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveFactAnswer" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "scopeId" UUID NOT NULL,
    "factVersionId" UUID NOT NULL,
    "typedValue" JSONB NOT NULL,
    "source" "AdaptiveAnswerSource" NOT NULL,
    "answeredById" UUID NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptiveFactAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveEvaluationRun" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "sessionRevision" INTEGER NOT NULL,
    "engineVersion" VARCHAR(32) NOT NULL,
    "packVersionId" UUID NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "outputSnapshot" JSONB NOT NULL,
    "inputHash" VARCHAR(100) NOT NULL,
    "outputHash" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveEvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveGeneratedQuestion" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "evaluationRunId" UUID NOT NULL,
    "scopeId" UUID NOT NULL,
    "factVersionId" UUID NOT NULL,
    "questionText" VARCHAR(240) NOT NULL,
    "helpText" VARCHAR(500) NOT NULL,
    "answerChoices" JSONB NOT NULL,
    "whyAsked" VARCHAR(500) NOT NULL,
    "relatedRuleVersions" JSONB NOT NULL,
    "relatedTargetVersions" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveGeneratedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveConfigurationProposal" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "evaluationRunId" UUID NOT NULL,
    "proposalVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveConfigurationProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveConfigurationItem" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "scopeId" UUID NOT NULL,
    "targetVersionId" UUID NOT NULL,
    "state" "ApplicabilityState" NOT NULL,
    "minimumDepth" "AdaptiveReviewDepth" NOT NULL,
    "professionalReview" BOOLEAN NOT NULL DEFAULT false,
    "reason" VARCHAR(500) NOT NULL,
    "ruleVersionProvenance" JSONB NOT NULL,
    "requirementProvenance" JSONB NOT NULL,
    "evidenceSuggestions" JSONB NOT NULL,
    "missingFacts" JSONB NOT NULL,
    "trace" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveConfigurationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveCurrentStateDeclaration" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "status" "AdaptiveCurrentStateStatus" NOT NULL,
    "declaredById" UUID NOT NULL,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptiveCurrentStateDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveCurrentStateEvidence" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "declarationId" UUID NOT NULL,
    "type" "AdaptiveCurrentStateEvidenceType" NOT NULL,
    "note" VARCHAR(1000),
    "externalUrl" VARCHAR(1000),
    "declaredById" UUID NOT NULL,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveCurrentStateEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveFactDefinition_factKey_key" ON "AdaptiveFactDefinition"("factKey");

-- CreateIndex
CREATE INDEX "AdaptiveFactDefinition_category_factKey_idx" ON "AdaptiveFactDefinition"("category", "factKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveFactVersion_supersedesFactVersionId_key" ON "AdaptiveFactVersion"("supersedesFactVersionId");

-- CreateIndex
CREATE INDEX "AdaptiveFactVersion_factDefinitionId_publishedAt_idx" ON "AdaptiveFactVersion"("factDefinitionId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveFactVersion_factDefinitionId_version_key" ON "AdaptiveFactVersion"("factDefinitionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveConfigurationTargetDefinition_targetKey_key" ON "AdaptiveConfigurationTargetDefinition"("targetKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveConfigurationTargetVersion_supersedesTargetVersionI_key" ON "AdaptiveConfigurationTargetVersion"("supersedesTargetVersionId");

-- CreateIndex
CREATE INDEX "AdaptiveConfigurationTargetVersion_targetDefinitionId_publi_idx" ON "AdaptiveConfigurationTargetVersion"("targetDefinitionId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveConfigurationTargetVersion_targetDefinitionId_versi_key" ON "AdaptiveConfigurationTargetVersion"("targetDefinitionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveRuleDefinition_ruleKey_key" ON "AdaptiveRuleDefinition"("ruleKey");

-- CreateIndex
CREATE INDEX "AdaptiveRuleDraft_status_updatedAt_idx" ON "AdaptiveRuleDraft"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveRuleDraft_ruleDefinitionId_revision_key" ON "AdaptiveRuleDraft"("ruleDefinitionId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveRuleVersion_supersedesRuleVersionId_key" ON "AdaptiveRuleVersion"("supersedesRuleVersionId");

-- CreateIndex
CREATE INDEX "AdaptiveRuleVersion_regulatory_isDemo_publishedAt_idx" ON "AdaptiveRuleVersion"("regulatory", "isDemo", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveRuleVersion_ruleDefinitionId_version_key" ON "AdaptiveRuleVersion"("ruleDefinitionId", "version");

-- CreateIndex
CREATE INDEX "AdaptiveRuleRequirement_requirementId_relationshipType_idx" ON "AdaptiveRuleRequirement"("requirementId", "relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveRuleRequirement_ruleVersionId_requirementId_relatio_key" ON "AdaptiveRuleRequirement"("ruleVersionId", "requirementId", "relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveRuleGroupDefinition_groupKey_key" ON "AdaptiveRuleGroupDefinition"("groupKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveRuleGroupVersion_supersedesGroupVersionId_key" ON "AdaptiveRuleGroupVersion"("supersedesGroupVersionId");

-- CreateIndex
CREATE INDEX "AdaptiveRuleGroupVersion_priority_publishedAt_idx" ON "AdaptiveRuleGroupVersion"("priority", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveRuleGroupVersion_groupDefinitionId_version_key" ON "AdaptiveRuleGroupVersion"("groupDefinitionId", "version");

-- CreateIndex
CREATE INDEX "AdaptiveRuleGroupRule_ruleVersionId_idx" ON "AdaptiveRuleGroupRule"("ruleVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveRulePackDefinition_packKey_key" ON "AdaptiveRulePackDefinition"("packKey");

-- CreateIndex
CREATE INDEX "AdaptiveRulePackVersion_isDemo_regulatory_publishedAt_idx" ON "AdaptiveRulePackVersion"("isDemo", "regulatory", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveRulePackVersion_packDefinitionId_version_key" ON "AdaptiveRulePackVersion"("packDefinitionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveRulePackVersion_packDefinitionId_contentHash_key" ON "AdaptiveRulePackVersion"("packDefinitionId", "contentHash");

-- CreateIndex
CREATE INDEX "AdaptiveRulePackGroup_groupVersionId_idx" ON "AdaptiveRulePackGroup"("groupVersionId");

-- CreateIndex
CREATE INDEX "AdaptiveRulePackRule_ruleVersionId_idx" ON "AdaptiveRulePackRule"("ruleVersionId");

-- CreateIndex
CREATE INDEX "AdaptiveRulePackFact_factVersionId_idx" ON "AdaptiveRulePackFact"("factVersionId");

-- CreateIndex
CREATE INDEX "AdaptiveRulePackTarget_targetVersionId_idx" ON "AdaptiveRulePackTarget"("targetVersionId");

-- CreateIndex
CREATE INDEX "AdaptiveConfigurationSession_organizationId_createdAt_idx" ON "AdaptiveConfigurationSession"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AdaptiveConfigurationSession_organizationId_status_idx" ON "AdaptiveConfigurationSession"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AdaptiveSessionScope_organizationId_sessionId_idx" ON "AdaptiveSessionScope"("organizationId", "sessionId");

-- CreateIndex
CREATE INDEX "AdaptiveSessionScope_workCenterId_idx" ON "AdaptiveSessionScope"("workCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveSessionScope_sessionId_scopeKey_key" ON "AdaptiveSessionScope"("sessionId", "scopeKey");

-- CreateIndex
CREATE INDEX "AdaptiveFactAnswer_organizationId_sessionId_idx" ON "AdaptiveFactAnswer"("organizationId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveFactAnswer_sessionId_scopeId_factVersionId_key" ON "AdaptiveFactAnswer"("sessionId", "scopeId", "factVersionId");

-- CreateIndex
CREATE INDEX "AdaptiveEvaluationRun_organizationId_sessionId_createdAt_idx" ON "AdaptiveEvaluationRun"("organizationId", "sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveEvaluationRun_sessionId_runNumber_key" ON "AdaptiveEvaluationRun"("sessionId", "runNumber");

-- CreateIndex
CREATE INDEX "AdaptiveGeneratedQuestion_organizationId_evaluationRunId_so_idx" ON "AdaptiveGeneratedQuestion"("organizationId", "evaluationRunId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveGeneratedQuestion_evaluationRunId_scopeId_factVersi_key" ON "AdaptiveGeneratedQuestion"("evaluationRunId", "scopeId", "factVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveConfigurationProposal_evaluationRunId_key" ON "AdaptiveConfigurationProposal"("evaluationRunId");

-- CreateIndex
CREATE INDEX "AdaptiveConfigurationProposal_organizationId_sessionId_crea_idx" ON "AdaptiveConfigurationProposal"("organizationId", "sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveConfigurationProposal_sessionId_proposalVersion_key" ON "AdaptiveConfigurationProposal"("sessionId", "proposalVersion");

-- CreateIndex
CREATE INDEX "AdaptiveConfigurationItem_organizationId_proposalId_idx" ON "AdaptiveConfigurationItem"("organizationId", "proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveConfigurationItem_proposalId_scopeId_targetVersionI_key" ON "AdaptiveConfigurationItem"("proposalId", "scopeId", "targetVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveCurrentStateDeclaration_itemId_key" ON "AdaptiveCurrentStateDeclaration"("itemId");

-- CreateIndex
CREATE INDEX "AdaptiveCurrentStateDeclaration_organizationId_itemId_idx" ON "AdaptiveCurrentStateDeclaration"("organizationId", "itemId");

-- CreateIndex
CREATE INDEX "AdaptiveCurrentStateEvidence_organizationId_declarationId_d_idx" ON "AdaptiveCurrentStateEvidence"("organizationId", "declarationId", "declaredAt");

-- AddForeignKey
ALTER TABLE "AdaptiveFactVersion" ADD CONSTRAINT "AdaptiveFactVersion_factDefinitionId_fkey" FOREIGN KEY ("factDefinitionId") REFERENCES "AdaptiveFactDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveFactVersion" ADD CONSTRAINT "AdaptiveFactVersion_supersedesFactVersionId_fkey" FOREIGN KEY ("supersedesFactVersionId") REFERENCES "AdaptiveFactVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveConfigurationTargetVersion" ADD CONSTRAINT "AdaptiveConfigurationTargetVersion_targetDefinitionId_fkey" FOREIGN KEY ("targetDefinitionId") REFERENCES "AdaptiveConfigurationTargetDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveConfigurationTargetVersion" ADD CONSTRAINT "AdaptiveConfigurationTargetVersion_supersedesTargetVersion_fkey" FOREIGN KEY ("supersedesTargetVersionId") REFERENCES "AdaptiveConfigurationTargetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRuleDraft" ADD CONSTRAINT "AdaptiveRuleDraft_ruleDefinitionId_fkey" FOREIGN KEY ("ruleDefinitionId") REFERENCES "AdaptiveRuleDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRuleVersion" ADD CONSTRAINT "AdaptiveRuleVersion_ruleDefinitionId_fkey" FOREIGN KEY ("ruleDefinitionId") REFERENCES "AdaptiveRuleDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRuleVersion" ADD CONSTRAINT "AdaptiveRuleVersion_supersedesRuleVersionId_fkey" FOREIGN KEY ("supersedesRuleVersionId") REFERENCES "AdaptiveRuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRuleRequirement" ADD CONSTRAINT "AdaptiveRuleRequirement_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "AdaptiveRuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRuleRequirement" ADD CONSTRAINT "AdaptiveRuleRequirement_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "RegulatoryRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRuleGroupVersion" ADD CONSTRAINT "AdaptiveRuleGroupVersion_groupDefinitionId_fkey" FOREIGN KEY ("groupDefinitionId") REFERENCES "AdaptiveRuleGroupDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRuleGroupVersion" ADD CONSTRAINT "AdaptiveRuleGroupVersion_supersedesGroupVersionId_fkey" FOREIGN KEY ("supersedesGroupVersionId") REFERENCES "AdaptiveRuleGroupVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRuleGroupRule" ADD CONSTRAINT "AdaptiveRuleGroupRule_groupVersionId_fkey" FOREIGN KEY ("groupVersionId") REFERENCES "AdaptiveRuleGroupVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRuleGroupRule" ADD CONSTRAINT "AdaptiveRuleGroupRule_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "AdaptiveRuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRulePackVersion" ADD CONSTRAINT "AdaptiveRulePackVersion_packDefinitionId_fkey" FOREIGN KEY ("packDefinitionId") REFERENCES "AdaptiveRulePackDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRulePackGroup" ADD CONSTRAINT "AdaptiveRulePackGroup_packVersionId_fkey" FOREIGN KEY ("packVersionId") REFERENCES "AdaptiveRulePackVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRulePackGroup" ADD CONSTRAINT "AdaptiveRulePackGroup_groupVersionId_fkey" FOREIGN KEY ("groupVersionId") REFERENCES "AdaptiveRuleGroupVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRulePackRule" ADD CONSTRAINT "AdaptiveRulePackRule_packVersionId_fkey" FOREIGN KEY ("packVersionId") REFERENCES "AdaptiveRulePackVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRulePackRule" ADD CONSTRAINT "AdaptiveRulePackRule_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "AdaptiveRuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRulePackFact" ADD CONSTRAINT "AdaptiveRulePackFact_packVersionId_fkey" FOREIGN KEY ("packVersionId") REFERENCES "AdaptiveRulePackVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRulePackFact" ADD CONSTRAINT "AdaptiveRulePackFact_factVersionId_fkey" FOREIGN KEY ("factVersionId") REFERENCES "AdaptiveFactVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRulePackTarget" ADD CONSTRAINT "AdaptiveRulePackTarget_packVersionId_fkey" FOREIGN KEY ("packVersionId") REFERENCES "AdaptiveRulePackVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRulePackTarget" ADD CONSTRAINT "AdaptiveRulePackTarget_targetVersionId_fkey" FOREIGN KEY ("targetVersionId") REFERENCES "AdaptiveConfigurationTargetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveConfigurationSession" ADD CONSTRAINT "AdaptiveConfigurationSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveConfigurationSession" ADD CONSTRAINT "AdaptiveConfigurationSession_profileVersionId_fkey" FOREIGN KEY ("profileVersionId") REFERENCES "OrganizationSstProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveConfigurationSession" ADD CONSTRAINT "AdaptiveConfigurationSession_rulePackVersionId_fkey" FOREIGN KEY ("rulePackVersionId") REFERENCES "AdaptiveRulePackVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveConfigurationSession" ADD CONSTRAINT "AdaptiveConfigurationSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveSessionScope" ADD CONSTRAINT "AdaptiveSessionScope_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveSessionScope" ADD CONSTRAINT "AdaptiveSessionScope_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdaptiveConfigurationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveSessionScope" ADD CONSTRAINT "AdaptiveSessionScope_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveFactAnswer" ADD CONSTRAINT "AdaptiveFactAnswer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveFactAnswer" ADD CONSTRAINT "AdaptiveFactAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdaptiveConfigurationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveFactAnswer" ADD CONSTRAINT "AdaptiveFactAnswer_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "AdaptiveSessionScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveFactAnswer" ADD CONSTRAINT "AdaptiveFactAnswer_factVersionId_fkey" FOREIGN KEY ("factVersionId") REFERENCES "AdaptiveFactVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveFactAnswer" ADD CONSTRAINT "AdaptiveFactAnswer_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveEvaluationRun" ADD CONSTRAINT "AdaptiveEvaluationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveEvaluationRun" ADD CONSTRAINT "AdaptiveEvaluationRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdaptiveConfigurationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveGeneratedQuestion" ADD CONSTRAINT "AdaptiveGeneratedQuestion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveGeneratedQuestion" ADD CONSTRAINT "AdaptiveGeneratedQuestion_evaluationRunId_fkey" FOREIGN KEY ("evaluationRunId") REFERENCES "AdaptiveEvaluationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveGeneratedQuestion" ADD CONSTRAINT "AdaptiveGeneratedQuestion_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "AdaptiveSessionScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveGeneratedQuestion" ADD CONSTRAINT "AdaptiveGeneratedQuestion_factVersionId_fkey" FOREIGN KEY ("factVersionId") REFERENCES "AdaptiveFactVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveConfigurationProposal" ADD CONSTRAINT "AdaptiveConfigurationProposal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveConfigurationProposal" ADD CONSTRAINT "AdaptiveConfigurationProposal_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdaptiveConfigurationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveConfigurationProposal" ADD CONSTRAINT "AdaptiveConfigurationProposal_evaluationRunId_fkey" FOREIGN KEY ("evaluationRunId") REFERENCES "AdaptiveEvaluationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveConfigurationItem" ADD CONSTRAINT "AdaptiveConfigurationItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveConfigurationItem" ADD CONSTRAINT "AdaptiveConfigurationItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AdaptiveConfigurationProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveConfigurationItem" ADD CONSTRAINT "AdaptiveConfigurationItem_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "AdaptiveSessionScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveConfigurationItem" ADD CONSTRAINT "AdaptiveConfigurationItem_targetVersionId_fkey" FOREIGN KEY ("targetVersionId") REFERENCES "AdaptiveConfigurationTargetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveCurrentStateDeclaration" ADD CONSTRAINT "AdaptiveCurrentStateDeclaration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveCurrentStateDeclaration" ADD CONSTRAINT "AdaptiveCurrentStateDeclaration_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AdaptiveConfigurationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveCurrentStateDeclaration" ADD CONSTRAINT "AdaptiveCurrentStateDeclaration_declaredById_fkey" FOREIGN KEY ("declaredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveCurrentStateEvidence" ADD CONSTRAINT "AdaptiveCurrentStateEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveCurrentStateEvidence" ADD CONSTRAINT "AdaptiveCurrentStateEvidence_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "AdaptiveCurrentStateDeclaration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveCurrentStateEvidence" ADD CONSTRAINT "AdaptiveCurrentStateEvidence_declaredById_fkey" FOREIGN KEY ("declaredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain safety checks
ALTER TABLE "AdaptiveFactVersion"
  ADD CONSTRAINT "AdaptiveFactVersion_no_self_supersession"
  CHECK ("supersedesFactVersionId" IS NULL OR "supersedesFactVersionId" <> "id");

ALTER TABLE "AdaptiveConfigurationTargetVersion"
  ADD CONSTRAINT "AdaptiveTargetVersion_no_self_supersession"
  CHECK ("supersedesTargetVersionId" IS NULL OR "supersedesTargetVersionId" <> "id");

ALTER TABLE "AdaptiveRuleVersion"
  ADD CONSTRAINT "AdaptiveRuleVersion_no_self_supersession"
  CHECK ("supersedesRuleVersionId" IS NULL OR "supersedesRuleVersionId" <> "id"),
  ADD CONSTRAINT "AdaptiveRuleVersion_demo_regulatory_exclusive"
  CHECK ("isDemo" <> "regulatory"),
  ADD CONSTRAINT "AdaptiveRuleVersion_demo_disclaimer_required"
  CHECK (NOT "isDemo" OR length(trim(coalesce("demoDisclaimer", ''))) > 0);

ALTER TABLE "AdaptiveRuleGroupVersion"
  ADD CONSTRAINT "AdaptiveGroupVersion_no_self_supersession"
  CHECK ("supersedesGroupVersionId" IS NULL OR "supersedesGroupVersionId" <> "id"),
  ADD CONSTRAINT "AdaptiveGroupVersion_demo_regulatory_exclusive"
  CHECK ("isDemo" <> "regulatory");

ALTER TABLE "AdaptiveRulePackVersion"
  ADD CONSTRAINT "AdaptiveRulePackVersion_demo_regulatory_exclusive"
  CHECK ("isDemo" <> "regulatory"),
  ADD CONSTRAINT "AdaptiveRulePackVersion_disclaimer_required"
  CHECK (length(trim("disclaimer")) > 0);

ALTER TABLE "AdaptiveCurrentStateEvidence"
  ADD CONSTRAINT "AdaptiveEvidence_exact_content"
  CHECK (
    ("type" = 'NOTE' AND "note" IS NOT NULL AND "externalUrl" IS NULL)
    OR
    ("type" = 'EXTERNAL_LINK' AND "note" IS NULL AND "externalUrl" ~ '^https://')
  );

-- Published catalog and historical evaluation snapshots are append-only.
CREATE FUNCTION prevent_adaptive_immutable_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'adaptive published and historical rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER adaptive_fact_version_immutable BEFORE UPDATE OR DELETE ON "AdaptiveFactVersion" FOR EACH ROW EXECUTE FUNCTION prevent_adaptive_immutable_change();
CREATE TRIGGER adaptive_target_version_immutable BEFORE UPDATE OR DELETE ON "AdaptiveConfigurationTargetVersion" FOR EACH ROW EXECUTE FUNCTION prevent_adaptive_immutable_change();
CREATE TRIGGER adaptive_rule_version_immutable BEFORE UPDATE OR DELETE ON "AdaptiveRuleVersion" FOR EACH ROW EXECUTE FUNCTION prevent_adaptive_immutable_change();
CREATE TRIGGER adaptive_group_version_immutable BEFORE UPDATE OR DELETE ON "AdaptiveRuleGroupVersion" FOR EACH ROW EXECUTE FUNCTION prevent_adaptive_immutable_change();
CREATE TRIGGER adaptive_pack_version_immutable BEFORE UPDATE OR DELETE ON "AdaptiveRulePackVersion" FOR EACH ROW EXECUTE FUNCTION prevent_adaptive_immutable_change();
CREATE TRIGGER adaptive_evaluation_run_immutable BEFORE UPDATE OR DELETE ON "AdaptiveEvaluationRun" FOR EACH ROW EXECUTE FUNCTION prevent_adaptive_immutable_change();
CREATE TRIGGER adaptive_generated_question_immutable BEFORE UPDATE OR DELETE ON "AdaptiveGeneratedQuestion" FOR EACH ROW EXECUTE FUNCTION prevent_adaptive_immutable_change();
CREATE TRIGGER adaptive_proposal_immutable BEFORE UPDATE OR DELETE ON "AdaptiveConfigurationProposal" FOR EACH ROW EXECUTE FUNCTION prevent_adaptive_immutable_change();
CREATE TRIGGER adaptive_item_immutable BEFORE UPDATE OR DELETE ON "AdaptiveConfigurationItem" FOR EACH ROW EXECUTE FUNCTION prevent_adaptive_immutable_change();

-- Answers may change only while their session is collecting information.
CREATE FUNCTION enforce_adaptive_answer_mutability() RETURNS trigger AS $$
DECLARE
  target_session_id uuid;
  target_status "AdaptiveSessionStatus";
BEGIN
  target_session_id := COALESCE(NEW."sessionId", OLD."sessionId");
  SELECT "status" INTO target_status FROM "AdaptiveConfigurationSession" WHERE "id" = target_session_id;
  IF target_status <> 'COLLECTING_INFORMATION' THEN
    RAISE EXCEPTION 'adaptive answers are frozen after collection';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER adaptive_answer_mutability
  BEFORE INSERT OR UPDATE OR DELETE ON "AdaptiveFactAnswer"
  FOR EACH ROW EXECUTE FUNCTION enforce_adaptive_answer_mutability();
