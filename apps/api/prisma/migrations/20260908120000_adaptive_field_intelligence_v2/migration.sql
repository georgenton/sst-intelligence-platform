CREATE TYPE "InspectionDepth" AS ENUM ('BASIC', 'TECHNICAL', 'SYSTEMIC');

ALTER TYPE "OperationalPlanItemProvenanceType" ADD VALUE 'GAP_ANALYSIS';

ALTER TABLE "Inspection"
ADD COLUMN "inspectionDepth" "InspectionDepth",
ADD COLUMN "inspectionDepthVersion" VARCHAR(32),
ADD COLUMN "inspectionDepthSnapshot" JSONB;

CREATE TABLE "OrganizationGapAnalysis" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "profileVersionId" UUID,
  "sourceType" VARCHAR(48) NOT NULL,
  "sourceId" UUID NOT NULL,
  "inputHash" VARCHAR(71) NOT NULL,
  "outputHash" VARCHAR(71) NOT NULL,
  "items" JSONB NOT NULL,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationGapAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationGapAnalysis_organizationId_version_key"
ON "OrganizationGapAnalysis"("organizationId", "version");
CREATE INDEX "OrganizationGapAnalysis_organizationId_createdAt_idx"
ON "OrganizationGapAnalysis"("organizationId", "createdAt");
CREATE INDEX "OrganizationGapAnalysis_organizationId_sourceType_sourceId_idx"
ON "OrganizationGapAnalysis"("organizationId", "sourceType", "sourceId");

ALTER TABLE "OrganizationGapAnalysis"
ADD CONSTRAINT "OrganizationGapAnalysis_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationGapAnalysis"
ADD CONSTRAINT "OrganizationGapAnalysis_profileVersionId_fkey"
FOREIGN KEY ("profileVersionId") REFERENCES "OrganizationSstProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationGapAnalysis"
ADD CONSTRAINT "OrganizationGapAnalysis_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL-first tenant search indexes. These are accelerators, never canonical state.
CREATE INDEX "Inspection_search_document_idx" ON "Inspection" USING GIN
(to_tsvector('simple'::regconfig, coalesce("title", '') || ' ' || coalesce("description", '')));
CREATE INDEX "InspectionFinding_search_document_idx" ON "InspectionFinding" USING GIN
(to_tsvector('simple'::regconfig, coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("category", '')));
CREATE INDEX "SafetyObservation_search_document_idx" ON "SafetyObservation" USING GIN
(to_tsvector('simple'::regconfig, coalesce("title", '') || ' ' || coalesce("description", '')));
CREATE INDEX "Incident_search_document_idx" ON "Incident" USING GIN
(to_tsvector('simple'::regconfig, coalesce("title", '') || ' ' || coalesce("description", '')));
CREATE INDEX "CorrectiveAction_search_document_idx" ON "CorrectiveAction" USING GIN
(to_tsvector('simple'::regconfig, coalesce("title", '') || ' ' || coalesce("description", '')));
CREATE INDEX "OperationalPlanItem_search_document_idx" ON "OperationalPlanItem" USING GIN
(to_tsvector('simple'::regconfig, coalesce("title", '') || ' ' || coalesce("description", '')));
CREATE INDEX "Worker_search_document_idx" ON "Worker" USING GIN
(to_tsvector('simple'::regconfig, coalesce("displayName", '') || ' ' || coalesce("internalCode", '') || ' ' || coalesce("jobTitle", '')));
CREATE INDEX "Position_search_document_idx" ON "Position" USING GIN
(to_tsvector('simple'::regconfig, coalesce("name", '') || ' ' || coalesce("code", '') || ' ' || coalesce("description", '')));
CREATE INDEX "WorkCenter_search_document_idx" ON "WorkCenter" USING GIN
(to_tsvector('simple'::regconfig, coalesce("name", '') || ' ' || coalesce("city", '')));
CREATE INDEX "TrainingDefinition_search_document_idx" ON "TrainingDefinition" USING GIN
(to_tsvector('simple'::regconfig, coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("category", '')));
CREATE INDEX "PpeCatalogItem_search_document_idx" ON "PpeCatalogItem" USING GIN
(to_tsvector('simple'::regconfig, coalesce("name", '') || ' ' || coalesce("description", '')));
