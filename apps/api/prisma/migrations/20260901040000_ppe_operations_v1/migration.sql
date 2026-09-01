CREATE TYPE "PpeCatalogStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "PpeCategory" AS ENUM ('HEAD', 'EYE_FACE', 'HEARING', 'RESPIRATORY', 'HAND_ARM', 'FOOT', 'BODY', 'FALL_PROTECTION', 'OTHER');
CREATE TYPE "PpeRequirementStatus" AS ENUM ('REQUIRED', 'FULFILLED', 'CANCELLED');
CREATE TYPE "PpeIssueStatus" AS ENUM ('ISSUED', 'IN_SERVICE', 'REPLACEMENT_DUE', 'REPLACED', 'RETIRED', 'LOST_DAMAGED');
CREATE TYPE "PpeAcknowledgementStatus" AS ENUM ('PENDING', 'RECORDED');
CREATE TYPE "PpeCondition" AS ENUM ('SERVICEABLE', 'REVIEW_REQUIRED', 'UNSERVICEABLE');

CREATE TABLE "PpeCatalogItem" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" "PpeCategory" NOT NULL,
    "description" VARCHAR(2000),
    "manufacturerModel" VARCHAR(200),
    "referenceStandard" VARCHAR(300),
    "defaultReplacementIntervalDays" INTEGER,
    "status" "PpeCatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PpeCatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkerPpeRequirement" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "ppeCatalogItemId" UUID NOT NULL,
    "workCenterId" UUID,
    "linkedAssessmentId" UUID,
    "linkedFindingId" UUID,
    "reason" VARCHAR(2000) NOT NULL,
    "status" "PpeRequirementStatus" NOT NULL DEFAULT 'REQUIRED',
    "assignedById" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkerPpeRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PpeIssue" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "ppeCatalogItemId" UUID NOT NULL,
    "requirementId" UUID,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "issuedById" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "assetReference" VARCHAR(160),
    "expectedReplacementAt" TIMESTAMP(3),
    "status" "PpeIssueStatus" NOT NULL DEFAULT 'ISSUED',
    "acknowledgementStatus" "PpeAcknowledgementStatus" NOT NULL DEFAULT 'PENDING',
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" UUID,
    "acknowledgementNote" VARCHAR(2000),
    "evidenceNote" VARCHAR(2000),
    "evidenceUrl" VARCHAR(2000),
    "replacesIssueId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PpeIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PpeInspection" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "issueId" UUID NOT NULL,
    "inspectedAt" TIMESTAMP(3) NOT NULL,
    "condition" "PpeCondition" NOT NULL,
    "note" VARCHAR(2000),
    "evidenceUrl" VARCHAR(2000),
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PpeInspection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PpeCatalogItem_organizationId_name_key" ON "PpeCatalogItem"("organizationId", "name");
CREATE INDEX "PpeCatalogItem_organizationId_status_category_idx" ON "PpeCatalogItem"("organizationId", "status", "category");
CREATE INDEX "WorkerPpeRequirement_organizationId_workerId_status_idx" ON "WorkerPpeRequirement"("organizationId", "workerId", "status");
CREATE INDEX "WorkerPpeRequirement_organizationId_workCenterId_status_idx" ON "WorkerPpeRequirement"("organizationId", "workCenterId", "status");
CREATE INDEX "WorkerPpeRequirement_organizationId_linkedAssessmentId_idx" ON "WorkerPpeRequirement"("organizationId", "linkedAssessmentId");
CREATE INDEX "WorkerPpeRequirement_organizationId_linkedFindingId_idx" ON "WorkerPpeRequirement"("organizationId", "linkedFindingId");
CREATE UNIQUE INDEX "PpeIssue_replacesIssueId_key" ON "PpeIssue"("replacesIssueId");
CREATE INDEX "PpeIssue_organizationId_workerId_status_expectedReplacementAt_idx" ON "PpeIssue"("organizationId", "workerId", "status", "expectedReplacementAt");
CREATE INDEX "PpeIssue_organizationId_status_expectedReplacementAt_idx" ON "PpeIssue"("organizationId", "status", "expectedReplacementAt");
CREATE INDEX "PpeIssue_organizationId_requirementId_idx" ON "PpeIssue"("organizationId", "requirementId");
CREATE INDEX "PpeInspection_organizationId_issueId_inspectedAt_idx" ON "PpeInspection"("organizationId", "issueId", "inspectedAt");
CREATE INDEX "PpeInspection_organizationId_condition_inspectedAt_idx" ON "PpeInspection"("organizationId", "condition", "inspectedAt");

ALTER TABLE "PpeCatalogItem" ADD CONSTRAINT "PpeCatalogItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PpeCatalogItem" ADD CONSTRAINT "PpeCatalogItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerPpeRequirement" ADD CONSTRAINT "WorkerPpeRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerPpeRequirement" ADD CONSTRAINT "WorkerPpeRequirement_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerPpeRequirement" ADD CONSTRAINT "WorkerPpeRequirement_ppeCatalogItemId_fkey" FOREIGN KEY ("ppeCatalogItemId") REFERENCES "PpeCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerPpeRequirement" ADD CONSTRAINT "WorkerPpeRequirement_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerPpeRequirement" ADD CONSTRAINT "WorkerPpeRequirement_linkedAssessmentId_fkey" FOREIGN KEY ("linkedAssessmentId") REFERENCES "TechnicalAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerPpeRequirement" ADD CONSTRAINT "WorkerPpeRequirement_linkedFindingId_fkey" FOREIGN KEY ("linkedFindingId") REFERENCES "InspectionFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerPpeRequirement" ADD CONSTRAINT "WorkerPpeRequirement_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PpeIssue" ADD CONSTRAINT "PpeIssue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PpeIssue" ADD CONSTRAINT "PpeIssue_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PpeIssue" ADD CONSTRAINT "PpeIssue_ppeCatalogItemId_fkey" FOREIGN KEY ("ppeCatalogItemId") REFERENCES "PpeCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PpeIssue" ADD CONSTRAINT "PpeIssue_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "WorkerPpeRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PpeIssue" ADD CONSTRAINT "PpeIssue_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PpeIssue" ADD CONSTRAINT "PpeIssue_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PpeIssue" ADD CONSTRAINT "PpeIssue_replacesIssueId_fkey" FOREIGN KEY ("replacesIssueId") REFERENCES "PpeIssue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PpeInspection" ADD CONSTRAINT "PpeInspection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PpeInspection" ADD CONSTRAINT "PpeInspection_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "PpeIssue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PpeInspection" ADD CONSTRAINT "PpeInspection_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
