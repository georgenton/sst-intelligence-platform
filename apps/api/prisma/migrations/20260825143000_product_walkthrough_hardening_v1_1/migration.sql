-- Product Walkthrough Hardening V1.1: bounded workflow provenance only.

CREATE TYPE "InspectionVerificationBasis" AS ENUM (
  'RECORDED_EVIDENCE',
  'FIELD_OBSERVATION',
  'OTHER_JUSTIFIED'
);

CREATE TYPE "InspectionSystemicReviewStatus" AS ENUM (
  'OPEN',
  'IN_REVIEW',
  'COMPLETED',
  'CANCELED'
);

CREATE TYPE "InspectionSystemicReviewSufficiency" AS ENUM (
  'YES',
  'NO',
  'NEEDS_MORE_INFORMATION'
);

ALTER TABLE "WorkCenter"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "CorrectiveAction"
  ADD COLUMN "verificationBasis" "InspectionVerificationBasis",
  ADD COLUMN "verificationNote" TEXT,
  ADD COLUMN "selfVerification" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "selfVerificationAcknowledged" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TechnicalAssessment"
  ADD COLUMN "revisedFromAssessmentId" UUID;

ALTER TABLE "TechnicalAssessmentReview"
  ADD COLUMN "isSelfReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "selfReviewAcknowledged" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "InspectionSystemicReview" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "alertId" UUID NOT NULL,
  "workCenterId" UUID NOT NULL,
  "workCenterName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "recurrenceWindowDays" INTEGER NOT NULL,
  "relatedFindingIds" JSONB NOT NULL,
  "relatedFindingsSnapshot" JSONB NOT NULL,
  "status" "InspectionSystemicReviewStatus" NOT NULL DEFAULT 'OPEN',
  "actionsSufficient" "InspectionSystemicReviewSufficiency",
  "broaderReviewRecommended" BOOLEAN,
  "notes" TEXT,
  "suspectedFactors" TEXT,
  "createdById" UUID NOT NULL,
  "completedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "InspectionSystemicReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TechnicalAssessment_revisedFromAssessmentId_key"
  ON "TechnicalAssessment"("revisedFromAssessmentId");

CREATE UNIQUE INDEX "InspectionSystemicReview_alertId_key"
  ON "InspectionSystemicReview"("alertId");

CREATE INDEX "InspectionSystemicReview_organizationId_status_createdAt_idx"
  ON "InspectionSystemicReview"("organizationId", "status", "createdAt");

CREATE INDEX "InspectionSystemicReview_organizationId_workCenterId_idx"
  ON "InspectionSystemicReview"("organizationId", "workCenterId");

ALTER TABLE "TechnicalAssessment"
  ADD CONSTRAINT "TechnicalAssessment_revisedFromAssessmentId_fkey"
  FOREIGN KEY ("revisedFromAssessmentId") REFERENCES "TechnicalAssessment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InspectionSystemicReview"
  ADD CONSTRAINT "InspectionSystemicReview_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InspectionSystemicReview"
  ADD CONSTRAINT "InspectionSystemicReview_alertId_fkey"
  FOREIGN KEY ("alertId") REFERENCES "InspectionAlert"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InspectionSystemicReview"
  ADD CONSTRAINT "InspectionSystemicReview_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InspectionSystemicReview"
  ADD CONSTRAINT "InspectionSystemicReview_completedById_fkey"
  FOREIGN KEY ("completedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
