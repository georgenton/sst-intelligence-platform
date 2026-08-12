CREATE TYPE "TechnicalMethodStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');
CREATE TYPE "TechnicalAssessmentStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'CANCELED');
CREATE TYPE "TechnicalEvidenceType" AS ENUM ('NOTE', 'EXTERNAL_LINK');
CREATE TYPE "TechnicalReviewDecision" AS ENUM ('APPROVED', 'NEEDS_REVISION');

CREATE TABLE "TechnicalMethodDefinition" (
  "id" UUID NOT NULL,
  "organizationId" UUID,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" "TechnicalMethodStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TechnicalMethodDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechnicalMethodVersion" (
  "id" UUID NOT NULL,
  "organizationId" UUID,
  "methodDefinitionId" UUID NOT NULL,
  "version" TEXT NOT NULL,
  "schema" JSONB NOT NULL,
  "calculationKey" TEXT NOT NULL,
  "regulatory" BOOLEAN NOT NULL DEFAULT false,
  "country" TEXT,
  "validFrom" TIMESTAMP(3),
  "validTo" TIMESTAMP(3),
  "status" "TechnicalMethodStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TechnicalMethodVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechnicalAssessment" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "workCenterId" UUID NOT NULL,
  "workAreaId" UUID,
  "methodVersionId" UUID NOT NULL,
  "methodKey" TEXT NOT NULL,
  "methodVersion" TEXT NOT NULL,
  "calculationKey" TEXT NOT NULL,
  "methodSnapshot" JSONB NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "TechnicalAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" UUID NOT NULL,
  "reviewedById" UUID,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TechnicalAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechnicalAssessmentResponse" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "assessmentId" UUID NOT NULL,
  "questionKey" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TechnicalAssessmentResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechnicalAssessmentResult" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "assessmentId" UUID NOT NULL,
  "methodKey" TEXT NOT NULL,
  "methodVersion" TEXT NOT NULL,
  "calculationKey" TEXT NOT NULL,
  "score" DOUBLE PRECISION,
  "level" "RiskLevel",
  "result" JSONB NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TechnicalAssessmentResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechnicalAssessmentEvidence" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "assessmentId" UUID NOT NULL,
  "questionKey" TEXT,
  "type" "TechnicalEvidenceType" NOT NULL,
  "note" TEXT,
  "externalUrl" TEXT,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TechnicalAssessmentEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechnicalAssessmentReview" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "assessmentId" UUID NOT NULL,
  "reviewerUserId" UUID NOT NULL,
  "decision" "TechnicalReviewDecision" NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TechnicalAssessmentReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TechnicalMethodDefinition_organizationId_key_key" ON "TechnicalMethodDefinition"("organizationId", "key");
CREATE UNIQUE INDEX "TechnicalMethodDefinition_global_key_key" ON "TechnicalMethodDefinition"("key") WHERE "organizationId" IS NULL;
CREATE INDEX "TechnicalMethodDefinition_key_status_idx" ON "TechnicalMethodDefinition"("key", "status");
CREATE INDEX "TechnicalMethodDefinition_organizationId_status_idx" ON "TechnicalMethodDefinition"("organizationId", "status");
CREATE UNIQUE INDEX "TechnicalMethodVersion_methodDefinitionId_version_key" ON "TechnicalMethodVersion"("methodDefinitionId", "version");
CREATE INDEX "TechnicalMethodVersion_organizationId_status_idx" ON "TechnicalMethodVersion"("organizationId", "status");
CREATE INDEX "TechnicalMethodVersion_calculationKey_status_idx" ON "TechnicalMethodVersion"("calculationKey", "status");
CREATE INDEX "TechnicalAssessment_organizationId_status_createdAt_idx" ON "TechnicalAssessment"("organizationId", "status", "createdAt");
CREATE INDEX "TechnicalAssessment_organizationId_workCenterId_idx" ON "TechnicalAssessment"("organizationId", "workCenterId");
CREATE INDEX "TechnicalAssessment_organizationId_methodKey_idx" ON "TechnicalAssessment"("organizationId", "methodKey");
CREATE UNIQUE INDEX "TechnicalAssessmentResponse_assessmentId_questionKey_key" ON "TechnicalAssessmentResponse"("assessmentId", "questionKey");
CREATE INDEX "TechnicalAssessmentResponse_organizationId_assessmentId_idx" ON "TechnicalAssessmentResponse"("organizationId", "assessmentId");
CREATE UNIQUE INDEX "TechnicalAssessmentResult_assessmentId_key" ON "TechnicalAssessmentResult"("assessmentId");
CREATE INDEX "TechnicalAssessmentResult_organizationId_level_idx" ON "TechnicalAssessmentResult"("organizationId", "level");
CREATE INDEX "TechnicalAssessmentEvidence_organizationId_assessmentId_idx" ON "TechnicalAssessmentEvidence"("organizationId", "assessmentId");
CREATE INDEX "TechnicalAssessmentReview_organizationId_assessmentId_createdAt_idx" ON "TechnicalAssessmentReview"("organizationId", "assessmentId", "createdAt");

ALTER TABLE "TechnicalMethodDefinition" ADD CONSTRAINT "TechnicalMethodDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalMethodVersion" ADD CONSTRAINT "TechnicalMethodVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalMethodVersion" ADD CONSTRAINT "TechnicalMethodVersion_methodDefinitionId_fkey" FOREIGN KEY ("methodDefinitionId") REFERENCES "TechnicalMethodDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessment" ADD CONSTRAINT "TechnicalAssessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessment" ADD CONSTRAINT "TechnicalAssessment_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessment" ADD CONSTRAINT "TechnicalAssessment_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessment" ADD CONSTRAINT "TechnicalAssessment_methodVersionId_fkey" FOREIGN KEY ("methodVersionId") REFERENCES "TechnicalMethodVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessment" ADD CONSTRAINT "TechnicalAssessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessment" ADD CONSTRAINT "TechnicalAssessment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessmentResponse" ADD CONSTRAINT "TechnicalAssessmentResponse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessmentResponse" ADD CONSTRAINT "TechnicalAssessmentResponse_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "TechnicalAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessmentResult" ADD CONSTRAINT "TechnicalAssessmentResult_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessmentResult" ADD CONSTRAINT "TechnicalAssessmentResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "TechnicalAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessmentEvidence" ADD CONSTRAINT "TechnicalAssessmentEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessmentEvidence" ADD CONSTRAINT "TechnicalAssessmentEvidence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "TechnicalAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessmentEvidence" ADD CONSTRAINT "TechnicalAssessmentEvidence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessmentReview" ADD CONSTRAINT "TechnicalAssessmentReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessmentReview" ADD CONSTRAINT "TechnicalAssessmentReview_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "TechnicalAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalAssessmentReview" ADD CONSTRAINT "TechnicalAssessmentReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
