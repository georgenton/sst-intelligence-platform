CREATE TYPE "InspectionDomain" AS ENUM (
  'ELECTRICAL',
  'FIRE_PROTECTION',
  'MACHINERY',
  'CHEMICAL_STORAGE',
  'EMERGENCY',
  'INFRASTRUCTURE'
);

CREATE TYPE "InspectionStandardRightsType" AS ENUM (
  'PUBLIC_OFFICIAL',
  'LICENSED',
  'CUSTOMER_PROVIDED',
  'REFERENCE_ONLY',
  'INTERNAL_ORGANIZATION_STANDARD',
  'DEMO_SYNTHETIC'
);

CREATE TYPE "InspectionStandardSourceType" AS ENUM ('GLOBAL_REFERENCE', 'ORGANIZATION_AUTHORED');
CREATE TYPE "InspectionStandardSourceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "InspectionStandardVersionStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'RETIRED');
CREATE TYPE "InspectionCriterionOutcome" AS ENUM (
  'CONFORME',
  'NO_CONFORME',
  'NO_APLICA',
  'NO_VERIFICADO'
);

CREATE TABLE "InspectionStandardSource" (
  "id" UUID NOT NULL,
  "organizationId" UUID,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "publisher" TEXT NOT NULL,
  "originCountry" TEXT,
  "referenceUrl" TEXT,
  "rightsType" "InspectionStandardRightsType" NOT NULL,
  "sourceType" "InspectionStandardSourceType" NOT NULL,
  "status" "InspectionStandardSourceStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InspectionStandardSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionStandardVersion" (
  "id" UUID NOT NULL,
  "sourceId" UUID NOT NULL,
  "versionCode" TEXT NOT NULL,
  "editionLabel" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "status" "InspectionStandardVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "contentDigest" VARCHAR(71) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InspectionStandardVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionStandardSection" (
  "id" UUID NOT NULL,
  "standardVersionId" UUID NOT NULL,
  "parentSectionId" UUID,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL,
  CONSTRAINT "InspectionStandardSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionStandardCriterion" (
  "id" UUID NOT NULL,
  "standardVersionId" UUID NOT NULL,
  "sectionId" UUID,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "guidance" TEXT NOT NULL,
  "evidenceExpectation" TEXT,
  "sourceLocator" TEXT,
  "displayOrder" INTEGER NOT NULL,
  "notApplicableAllowed" BOOLEAN NOT NULL DEFAULT false,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "contentDigest" VARCHAR(71) NOT NULL,
  CONSTRAINT "InspectionStandardCriterion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationInspectionStandardPolicyVersion" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "createdById" UUID NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationInspectionStandardPolicyVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationInspectionStandardPolicyBinding" (
  "id" UUID NOT NULL,
  "policyVersionId" UUID NOT NULL,
  "inspectionDomain" "InspectionDomain" NOT NULL,
  "standardVersionId" UUID NOT NULL,
  CONSTRAINT "OrganizationInspectionStandardPolicyBinding_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Inspection"
  ADD COLUMN "inspectionDomain" "InspectionDomain",
  ADD COLUMN "standardPolicyVersionId" UUID,
  ADD COLUMN "standardVersionId" UUID,
  ADD COLUMN "standardSnapshot" JSONB;

CREATE TABLE "InspectionCriterionResult" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "inspectionId" UUID NOT NULL,
  "criterionId" UUID NOT NULL,
  "outcome" "InspectionCriterionOutcome" NOT NULL DEFAULT 'NO_VERIFICADO',
  "note" TEXT,
  "evidenceReferences" JSONB NOT NULL DEFAULT '[]',
  "actorUserId" UUID NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InspectionCriterionResult_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InspectionFinding" ADD COLUMN "criterionResultId" UUID;

CREATE UNIQUE INDEX "InspectionStandardSource_code_key" ON "InspectionStandardSource"("code");
CREATE INDEX "InspectionStandardSource_organizationId_status_idx" ON "InspectionStandardSource"("organizationId", "status");
CREATE INDEX "InspectionStandardSource_sourceType_status_idx" ON "InspectionStandardSource"("sourceType", "status");
CREATE UNIQUE INDEX "InspectionStandardVersion_sourceId_versionCode_key" ON "InspectionStandardVersion"("sourceId", "versionCode");
CREATE INDEX "InspectionStandardVersion_status_createdAt_idx" ON "InspectionStandardVersion"("status", "createdAt");
CREATE UNIQUE INDEX "InspectionStandardSection_standardVersionId_code_key" ON "InspectionStandardSection"("standardVersionId", "code");
CREATE INDEX "InspectionStandardSection_standardVersionId_displayOrder_idx" ON "InspectionStandardSection"("standardVersionId", "displayOrder");
CREATE UNIQUE INDEX "InspectionStandardCriterion_standardVersionId_code_key" ON "InspectionStandardCriterion"("standardVersionId", "code");
CREATE INDEX "InspectionStandardCriterion_standardVersionId_displayOrder_idx" ON "InspectionStandardCriterion"("standardVersionId", "displayOrder");
CREATE INDEX "InspectionStandardCriterion_sectionId_displayOrder_idx" ON "InspectionStandardCriterion"("sectionId", "displayOrder");
CREATE UNIQUE INDEX "OrganizationInspectionStandardPolicyVersion_organizationId_version_key" ON "OrganizationInspectionStandardPolicyVersion"("organizationId", "version");
CREATE INDEX "OrganizationInspectionStandardPolicyVersion_organizationId_createdAt_idx" ON "OrganizationInspectionStandardPolicyVersion"("organizationId", "createdAt");
CREATE UNIQUE INDEX "OrganizationInspectionStandardPolicyBinding_policyVersionId_inspectionDomain_key" ON "OrganizationInspectionStandardPolicyBinding"("policyVersionId", "inspectionDomain");
CREATE INDEX "OrganizationInspectionStandardPolicyBinding_standardVersionId_idx" ON "OrganizationInspectionStandardPolicyBinding"("standardVersionId");
CREATE INDEX "Inspection_organizationId_inspectionDomain_idx" ON "Inspection"("organizationId", "inspectionDomain");
CREATE INDEX "Inspection_standardPolicyVersionId_idx" ON "Inspection"("standardPolicyVersionId");
CREATE INDEX "Inspection_standardVersionId_idx" ON "Inspection"("standardVersionId");
CREATE UNIQUE INDEX "InspectionCriterionResult_inspectionId_criterionId_key" ON "InspectionCriterionResult"("inspectionId", "criterionId");
CREATE INDEX "InspectionCriterionResult_organizationId_inspectionId_outcome_idx" ON "InspectionCriterionResult"("organizationId", "inspectionId", "outcome");
CREATE INDEX "InspectionCriterionResult_criterionId_idx" ON "InspectionCriterionResult"("criterionId");
CREATE UNIQUE INDEX "InspectionFinding_criterionResultId_key" ON "InspectionFinding"("criterionResultId");

ALTER TABLE "InspectionStandardSource" ADD CONSTRAINT "InspectionStandardSource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionStandardVersion" ADD CONSTRAINT "InspectionStandardVersion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "InspectionStandardSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionStandardSection" ADD CONSTRAINT "InspectionStandardSection_standardVersionId_fkey" FOREIGN KEY ("standardVersionId") REFERENCES "InspectionStandardVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionStandardSection" ADD CONSTRAINT "InspectionStandardSection_parentSectionId_fkey" FOREIGN KEY ("parentSectionId") REFERENCES "InspectionStandardSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionStandardCriterion" ADD CONSTRAINT "InspectionStandardCriterion_standardVersionId_fkey" FOREIGN KEY ("standardVersionId") REFERENCES "InspectionStandardVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionStandardCriterion" ADD CONSTRAINT "InspectionStandardCriterion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "InspectionStandardSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationInspectionStandardPolicyVersion" ADD CONSTRAINT "OrganizationInspectionStandardPolicyVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationInspectionStandardPolicyVersion" ADD CONSTRAINT "OrganizationInspectionStandardPolicyVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationInspectionStandardPolicyBinding" ADD CONSTRAINT "OrganizationInspectionStandardPolicyBinding_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "OrganizationInspectionStandardPolicyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationInspectionStandardPolicyBinding" ADD CONSTRAINT "OrganizationInspectionStandardPolicyBinding_standardVersionId_fkey" FOREIGN KEY ("standardVersionId") REFERENCES "InspectionStandardVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_standardPolicyVersionId_fkey" FOREIGN KEY ("standardPolicyVersionId") REFERENCES "OrganizationInspectionStandardPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_standardVersionId_fkey" FOREIGN KEY ("standardVersionId") REFERENCES "InspectionStandardVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionCriterionResult" ADD CONSTRAINT "InspectionCriterionResult_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionCriterionResult" ADD CONSTRAINT "InspectionCriterionResult_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionCriterionResult" ADD CONSTRAINT "InspectionCriterionResult_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "InspectionStandardCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionCriterionResult" ADD CONSTRAINT "InspectionCriterionResult_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_criterionResultId_fkey" FOREIGN KEY ("criterionResultId") REFERENCES "InspectionCriterionResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
