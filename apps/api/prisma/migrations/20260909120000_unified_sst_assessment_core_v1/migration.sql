-- CreateEnum
CREATE TYPE "SstAssessmentChannel" AS ENUM ('PUBLIC', 'AUTHENTICATED');

-- CreateEnum
CREATE TYPE "SstAssessmentKind" AS ENUM ('INITIAL_ASSESSMENT', 'REASSESSMENT');

-- CreateEnum
CREATE TYPE "SstAssessmentStatus" AS ENUM ('COLLECTING_INFORMATION', 'DIAGNOSIS_READY', 'FINALIZED', 'EXPIRED');

-- CreateTable
CREATE TABLE "SstAssessmentSession" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "createdById" UUID,
    "claimedById" UUID,
    "publicTokenHash" VARCHAR(71),
    "channel" "SstAssessmentChannel" NOT NULL,
    "kind" "SstAssessmentKind" NOT NULL DEFAULT 'INITIAL_ASSESSMENT',
    "status" "SstAssessmentStatus" NOT NULL DEFAULT 'COLLECTING_INFORMATION',
    "sessionRevision" INTEGER NOT NULL DEFAULT 0,
    "schemaVersion" VARCHAR(32) NOT NULL,
    "catalogVersion" VARCHAR(32) NOT NULL,
    "scopes" JSONB NOT NULL,
    "facts" JSONB NOT NULL,
    "latestResult" JSONB,
    "finalSnapshot" JSONB,
    "semanticInputHash" VARCHAR(71),
    "semanticOutputHash" VARCHAR(71),
    "evaluatorVersions" JSONB,
    "claimScopeMappings" JSONB,
    "profileVersionId" UUID,
    "adaptiveSessionId" UUID,
    "unifiedEvaluationId" UUID,
    "parentAssessmentId" UUID,
    "expiresAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SstAssessmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SstAssessmentSession_publicTokenHash_key" ON "SstAssessmentSession"("publicTokenHash");
CREATE INDEX "SstAssessmentSession_organizationId_createdAt_idx" ON "SstAssessmentSession"("organizationId", "createdAt");
CREATE INDEX "SstAssessmentSession_organizationId_status_idx" ON "SstAssessmentSession"("organizationId", "status");
CREATE INDEX "SstAssessmentSession_expiresAt_idx" ON "SstAssessmentSession"("expiresAt");
CREATE INDEX "SstAssessmentSession_parentAssessmentId_idx" ON "SstAssessmentSession"("parentAssessmentId");
CREATE INDEX "SstAssessmentSession_profileVersionId_idx" ON "SstAssessmentSession"("profileVersionId");
CREATE INDEX "SstAssessmentSession_adaptiveSessionId_idx" ON "SstAssessmentSession"("adaptiveSessionId");
CREATE INDEX "SstAssessmentSession_unifiedEvaluationId_idx" ON "SstAssessmentSession"("unifiedEvaluationId");

-- AddForeignKey
ALTER TABLE "SstAssessmentSession" ADD CONSTRAINT "SstAssessmentSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SstAssessmentSession" ADD CONSTRAINT "SstAssessmentSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SstAssessmentSession" ADD CONSTRAINT "SstAssessmentSession_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SstAssessmentSession" ADD CONSTRAINT "SstAssessmentSession_parentAssessmentId_fkey" FOREIGN KEY ("parentAssessmentId") REFERENCES "SstAssessmentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SstAssessmentSession" ADD CONSTRAINT "SstAssessmentSession_profileVersionId_fkey" FOREIGN KEY ("profileVersionId") REFERENCES "OrganizationSstProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SstAssessmentSession" ADD CONSTRAINT "SstAssessmentSession_adaptiveSessionId_fkey" FOREIGN KEY ("adaptiveSessionId") REFERENCES "AdaptiveConfigurationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SstAssessmentSession" ADD CONSTRAINT "SstAssessmentSession_unifiedEvaluationId_fkey" FOREIGN KEY ("unifiedEvaluationId") REFERENCES "UnifiedSstEvaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
