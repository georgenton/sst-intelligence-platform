CREATE TYPE "OperationalPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "OperationalPlanOrigin" AS ENUM ('MANUAL', 'DETERMINISTIC_DRAFT');
CREATE TYPE "OperationalPlanItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "OperationalPlanItemStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');
CREATE TYPE "OperationalPlanItemProvenanceType" AS ENUM ('MANUAL', 'APPLICABILITY_DECISION', 'UNIFIED_SST_EVALUATION', 'FINDING', 'CORRECTIVE_ACTION', 'OBLIGATION_EXECUTION');
CREATE TYPE "InspectionResourceTaxonomyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "InspectionResourceLevel" AS ENUM ('MINOR', 'MAJOR', 'INDUSTRIAL_SERVICE');
CREATE TYPE "InspectionResourceMappingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "InspectionDraftProposalStatus" AS ENUM ('AI_PROPOSED', 'PENDING_EXPERT_REVIEW', 'APPROVED', 'REJECTED');

CREATE TABLE "OperationalPlan" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalPlanVersion" (
  "id" UUID NOT NULL,
  "planId" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "OperationalPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "origin" "OperationalPlanOrigin" NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "description" VARCHAR(2000),
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "responsibleUserId" UUID,
  "provenance" JSONB NOT NULL DEFAULT '{}',
  "contentDigest" VARCHAR(71) NOT NULL,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  CONSTRAINT "OperationalPlanVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OperationalPlanVersion_period_check" CHECK ("periodEnd" >= "periodStart")
);

CREATE TABLE "OperationalPlanItem" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "planVersionId" UUID NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "description" VARCHAR(2000),
  "startsAt" DATE,
  "dueAt" DATE,
  "frequency" VARCHAR(120),
  "priority" "OperationalPlanItemPriority" NOT NULL DEFAULT 'MEDIUM',
  "workCenterId" UUID,
  "responsibleUserId" UUID,
  "evidenceReferences" JSONB NOT NULL DEFAULT '[]',
  "provenanceType" "OperationalPlanItemProvenanceType" NOT NULL,
  "provenanceReference" VARCHAR(240),
  "provenanceSnapshot" JSONB NOT NULL DEFAULT '{}',
  "displayOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalPlanItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OperationalPlanItem_dates_check" CHECK ("dueAt" IS NULL OR "startsAt" IS NULL OR "dueAt" >= "startsAt")
);

CREATE TABLE "OperationalPlanItemExecution" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "planItemId" UUID NOT NULL,
  "status" "OperationalPlanItemStatus" NOT NULL DEFAULT 'PLANNED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "actorUserId" UUID NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalPlanItemExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionResourceTaxonomy" (
  "id" UUID NOT NULL,
  "organizationId" UUID,
  "code" VARCHAR(160) NOT NULL,
  "inspectionDomain" "InspectionDomain" NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InspectionResourceTaxonomy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionResourceTaxonomyVersion" (
  "id" UUID NOT NULL,
  "taxonomyId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "InspectionResourceTaxonomyStatus" NOT NULL DEFAULT 'DRAFT',
  "contentDigest" VARCHAR(71) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  CONSTRAINT "InspectionResourceTaxonomyVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionResource" (
  "id" UUID NOT NULL,
  "taxonomyVersionId" UUID NOT NULL,
  "parentId" UUID,
  "code" VARCHAR(160) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "level" "InspectionResourceLevel" NOT NULL,
  "displayOrder" INTEGER NOT NULL,
  CONSTRAINT "InspectionResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionResourceCriterionMappingVersion" (
  "id" UUID NOT NULL,
  "organizationId" UUID,
  "taxonomyVersionId" UUID NOT NULL,
  "standardVersionId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "InspectionResourceMappingStatus" NOT NULL DEFAULT 'DRAFT',
  "contentDigest" VARCHAR(71) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  CONSTRAINT "InspectionResourceCriterionMappingVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionResourceCriterionMapping" (
  "id" UUID NOT NULL,
  "mappingVersionId" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "criterionId" UUID NOT NULL,
  "displayOrder" INTEGER NOT NULL,
  CONSTRAINT "InspectionResourceCriterionMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionDraftProposal" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "status" "InspectionDraftProposalStatus" NOT NULL DEFAULT 'AI_PROPOSED',
  "provider" VARCHAR(80) NOT NULL,
  "model" VARCHAR(120) NOT NULL,
  "jurisdictionCode" CHAR(2) NOT NULL,
  "sourceUnitIds" JSONB NOT NULL,
  "proposedCriteria" JSONB NOT NULL,
  "validationSnapshot" JSONB NOT NULL,
  "createdById" UUID NOT NULL,
  "reviewedById" UUID,
  "reviewComment" VARCHAR(2000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "InspectionDraftProposal_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Inspection"
  ADD COLUMN "resourceTaxonomyVersionId" UUID,
  ADD COLUMN "resourceMappingVersionId" UUID,
  ADD COLUMN "resourceScopeSnapshot" JSONB;

CREATE UNIQUE INDEX "OperationalPlanVersion_planId_version_key" ON "OperationalPlanVersion"("planId", "version");
CREATE INDEX "OperationalPlan_organizationId_createdAt_idx" ON "OperationalPlan"("organizationId", "createdAt");
CREATE INDEX "OperationalPlanVersion_organizationId_status_createdAt_idx" ON "OperationalPlanVersion"("organizationId", "status", "createdAt");
CREATE INDEX "OperationalPlanVersion_contentDigest_idx" ON "OperationalPlanVersion"("contentDigest");
CREATE UNIQUE INDEX "OperationalPlanVersion_one_active" ON "OperationalPlanVersion"("organizationId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "OperationalPlanItem_planVersionId_displayOrder_key" ON "OperationalPlanItem"("planVersionId", "displayOrder");
CREATE INDEX "OperationalPlanItem_organizationId_dueAt_priority_idx" ON "OperationalPlanItem"("organizationId", "dueAt", "priority");
CREATE INDEX "OperationalPlanItem_workCenterId_idx" ON "OperationalPlanItem"("workCenterId");
CREATE UNIQUE INDEX "OperationalPlanItemExecution_planItemId_key" ON "OperationalPlanItemExecution"("planItemId");
CREATE INDEX "OperationalPlanItemExecution_organizationId_status_updatedAt_idx" ON "OperationalPlanItemExecution"("organizationId", "status", "updatedAt");
CREATE UNIQUE INDEX "InspectionResourceTaxonomy_code_key" ON "InspectionResourceTaxonomy"("code");
CREATE INDEX "InspectionResourceTaxonomy_organizationId_inspectionDomain_idx" ON "InspectionResourceTaxonomy"("organizationId", "inspectionDomain");
CREATE UNIQUE INDEX "InspectionResourceTaxonomyVersion_taxonomyId_version_key" ON "InspectionResourceTaxonomyVersion"("taxonomyId", "version");
CREATE INDEX "InspectionResourceTaxonomyVersion_status_createdAt_idx" ON "InspectionResourceTaxonomyVersion"("status", "createdAt");
CREATE INDEX "InspectionResourceTaxonomyVersion_contentDigest_idx" ON "InspectionResourceTaxonomyVersion"("contentDigest");
CREATE UNIQUE INDEX "InspectionResourceTaxonomyVersion_one_active" ON "InspectionResourceTaxonomyVersion"("taxonomyId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "InspectionResource_taxonomyVersionId_code_key" ON "InspectionResource"("taxonomyVersionId", "code");
CREATE UNIQUE INDEX "InspectionResource_taxonomyVersionId_displayOrder_key" ON "InspectionResource"("taxonomyVersionId", "displayOrder");
CREATE INDEX "InspectionResource_parentId_idx" ON "InspectionResource"("parentId");
CREATE UNIQUE INDEX "InspectionResourceCriterionMappingVersion_taxonomy_standard_version_key" ON "InspectionResourceCriterionMappingVersion"("taxonomyVersionId", "standardVersionId", "version");
CREATE INDEX "InspectionResourceCriterionMappingVersion_organizationId_status_idx" ON "InspectionResourceCriterionMappingVersion"("organizationId", "status");
CREATE INDEX "InspectionResourceCriterionMappingVersion_standardVersionId_status_idx" ON "InspectionResourceCriterionMappingVersion"("standardVersionId", "status");
CREATE UNIQUE INDEX "InspectionResourceCriterionMapping_mapping_resource_criterion_key" ON "InspectionResourceCriterionMapping"("mappingVersionId", "resourceId", "criterionId");
CREATE INDEX "InspectionResourceCriterionMapping_resourceId_displayOrder_idx" ON "InspectionResourceCriterionMapping"("resourceId", "displayOrder");
CREATE INDEX "InspectionResourceCriterionMapping_criterionId_idx" ON "InspectionResourceCriterionMapping"("criterionId");
CREATE INDEX "InspectionDraftProposal_organizationId_status_createdAt_idx" ON "InspectionDraftProposal"("organizationId", "status", "createdAt");
CREATE INDEX "InspectionDraftProposal_resourceId_createdAt_idx" ON "InspectionDraftProposal"("resourceId", "createdAt");
CREATE INDEX "Inspection_resourceTaxonomyVersionId_idx" ON "Inspection"("resourceTaxonomyVersionId");
CREATE INDEX "Inspection_resourceMappingVersionId_idx" ON "Inspection"("resourceMappingVersionId");

ALTER TABLE "OperationalPlan" ADD CONSTRAINT "OperationalPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalPlan" ADD CONSTRAINT "OperationalPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalPlanVersion" ADD CONSTRAINT "OperationalPlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "OperationalPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalPlanVersion" ADD CONSTRAINT "OperationalPlanVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalPlanVersion" ADD CONSTRAINT "OperationalPlanVersion_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalPlanVersion" ADD CONSTRAINT "OperationalPlanVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalPlanItem" ADD CONSTRAINT "OperationalPlanItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalPlanItem" ADD CONSTRAINT "OperationalPlanItem_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "OperationalPlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalPlanItem" ADD CONSTRAINT "OperationalPlanItem_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalPlanItem" ADD CONSTRAINT "OperationalPlanItem_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalPlanItemExecution" ADD CONSTRAINT "OperationalPlanItemExecution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalPlanItemExecution" ADD CONSTRAINT "OperationalPlanItemExecution_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "OperationalPlanItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalPlanItemExecution" ADD CONSTRAINT "OperationalPlanItemExecution_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionResourceTaxonomy" ADD CONSTRAINT "InspectionResourceTaxonomy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionResourceTaxonomyVersion" ADD CONSTRAINT "InspectionResourceTaxonomyVersion_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "InspectionResourceTaxonomy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionResource" ADD CONSTRAINT "InspectionResource_taxonomyVersionId_fkey" FOREIGN KEY ("taxonomyVersionId") REFERENCES "InspectionResourceTaxonomyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionResource" ADD CONSTRAINT "InspectionResource_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "InspectionResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionResourceCriterionMappingVersion" ADD CONSTRAINT "InspectionResourceCriterionMappingVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionResourceCriterionMappingVersion" ADD CONSTRAINT "InspectionResourceCriterionMappingVersion_taxonomyVersionId_fkey" FOREIGN KEY ("taxonomyVersionId") REFERENCES "InspectionResourceTaxonomyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionResourceCriterionMappingVersion" ADD CONSTRAINT "InspectionResourceCriterionMappingVersion_standardVersionId_fkey" FOREIGN KEY ("standardVersionId") REFERENCES "InspectionStandardVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionResourceCriterionMapping" ADD CONSTRAINT "InspectionResourceCriterionMapping_mappingVersionId_fkey" FOREIGN KEY ("mappingVersionId") REFERENCES "InspectionResourceCriterionMappingVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionResourceCriterionMapping" ADD CONSTRAINT "InspectionResourceCriterionMapping_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "InspectionResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionResourceCriterionMapping" ADD CONSTRAINT "InspectionResourceCriterionMapping_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "InspectionStandardCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionDraftProposal" ADD CONSTRAINT "InspectionDraftProposal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionDraftProposal" ADD CONSTRAINT "InspectionDraftProposal_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "InspectionResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionDraftProposal" ADD CONSTRAINT "InspectionDraftProposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionDraftProposal" ADD CONSTRAINT "InspectionDraftProposal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_resourceTaxonomyVersionId_fkey" FOREIGN KEY ("resourceTaxonomyVersionId") REFERENCES "InspectionResourceTaxonomyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_resourceMappingVersionId_fkey" FOREIGN KEY ("resourceMappingVersionId") REFERENCES "InspectionResourceCriterionMappingVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "post_anita_assert_tenant_links"() RETURNS trigger AS $$
DECLARE linked_org UUID;
BEGIN
  IF TG_TABLE_NAME = 'OperationalPlanVersion' THEN
    SELECT "organizationId" INTO linked_org FROM "OperationalPlan" WHERE id = NEW."planId";
  ELSIF TG_TABLE_NAME = 'OperationalPlanItem' THEN
    SELECT "organizationId" INTO linked_org FROM "OperationalPlanVersion" WHERE id = NEW."planVersionId";
  ELSIF TG_TABLE_NAME = 'OperationalPlanItemExecution' THEN
    SELECT "organizationId" INTO linked_org FROM "OperationalPlanItem" WHERE id = NEW."planItemId";
  END IF;
  IF linked_org IS DISTINCT FROM NEW."organizationId" THEN
    RAISE EXCEPTION 'POST_ANITA_TENANT_REFERENCE_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OperationalPlanVersion_tenant_guard" BEFORE INSERT OR UPDATE ON "OperationalPlanVersion" FOR EACH ROW EXECUTE FUNCTION "post_anita_assert_tenant_links"();
CREATE TRIGGER "OperationalPlanItem_tenant_guard" BEFORE INSERT OR UPDATE ON "OperationalPlanItem" FOR EACH ROW EXECUTE FUNCTION "post_anita_assert_tenant_links"();
CREATE TRIGGER "OperationalPlanItemExecution_tenant_guard" BEFORE INSERT OR UPDATE ON "OperationalPlanItemExecution" FOR EACH ROW EXECUTE FUNCTION "post_anita_assert_tenant_links"();

CREATE FUNCTION "post_anita_prevent_version_mutation"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'DRAFT' AND NEW."status" = 'ACTIVE'
    AND (to_jsonb(OLD) - 'status' - 'activatedAt') = (to_jsonb(NEW) - 'status' - 'activatedAt') THEN
    RETURN NEW;
  END IF;
  IF OLD."status" = 'ACTIVE' AND NEW."status" = 'RETIRED'
    AND (to_jsonb(OLD) - 'status' - 'retiredAt') = (to_jsonb(NEW) - 'status' - 'retiredAt') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'POST_ANITA_IMMUTABLE_VERSION';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OperationalPlanVersion_immutable" BEFORE UPDATE ON "OperationalPlanVersion" FOR EACH ROW EXECUTE FUNCTION "post_anita_prevent_version_mutation"();
CREATE TRIGGER "InspectionResourceTaxonomyVersion_immutable" BEFORE UPDATE ON "InspectionResourceTaxonomyVersion" FOR EACH ROW EXECUTE FUNCTION "post_anita_prevent_version_mutation"();
CREATE TRIGGER "InspectionResourceCriterionMappingVersion_immutable" BEFORE UPDATE ON "InspectionResourceCriterionMappingVersion" FOR EACH ROW EXECUTE FUNCTION "post_anita_prevent_version_mutation"();

CREATE FUNCTION "post_anita_prevent_plan_item_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'POST_ANITA_IMMUTABLE_PLAN_ITEM';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "OperationalPlanItem_immutable" BEFORE UPDATE OR DELETE ON "OperationalPlanItem" FOR EACH ROW EXECUTE FUNCTION "post_anita_prevent_plan_item_mutation"();

CREATE FUNCTION "post_anita_prevent_inspection_scope_mutation"() RETURNS trigger AS $$
BEGIN
  IF OLD."resourceTaxonomyVersionId" IS DISTINCT FROM NEW."resourceTaxonomyVersionId"
    OR OLD."resourceMappingVersionId" IS DISTINCT FROM NEW."resourceMappingVersionId"
    OR OLD."resourceScopeSnapshot" IS DISTINCT FROM NEW."resourceScopeSnapshot" THEN
    RAISE EXCEPTION 'INSPECTION_RESOURCE_SCOPE_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Inspection_resource_scope_immutable" BEFORE UPDATE ON "Inspection" FOR EACH ROW EXECUTE FUNCTION "post_anita_prevent_inspection_scope_mutation"();
