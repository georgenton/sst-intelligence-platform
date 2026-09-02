CREATE TYPE "InspectionBasisStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "InspectionBasisTechnicalRole" AS ENUM ('PRIMARY_TECHNICAL', 'SUPPLEMENTAL_TECHNICAL', 'INTERNAL_ORGANIZATION');

CREATE TABLE "InspectionBasisDefinition" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "inspectionDomain" "InspectionDomain" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "InspectionBasisStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InspectionBasisDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionBasisVersion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "definitionId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "inspectionDomain" "InspectionDomain" NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "InspectionBasisStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" VARCHAR(500),
    "contentDigest" VARCHAR(71) NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    CONSTRAINT "InspectionBasisVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionBasisTechnicalSourceLink" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "basisVersionId" UUID NOT NULL,
    "standardVersionId" UUID NOT NULL,
    "role" "InspectionBasisTechnicalRole" NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "organizationNote" VARCHAR(500),
    CONSTRAINT "InspectionBasisTechnicalSourceLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionBasisRegulatoryUnitLink" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "basisVersionId" UUID NOT NULL,
    "regulatoryUnitId" UUID NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "organizationNote" VARCHAR(500),
    CONSTRAINT "InspectionBasisRegulatoryUnitLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionBasisCriterionRegulatoryLink" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "basisVersionId" UUID NOT NULL,
    "criterionId" UUID NOT NULL,
    "regulatoryUnitId" UUID NOT NULL,
    CONSTRAINT "InspectionBasisCriterionRegulatoryLink_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Inspection"
    ADD COLUMN "inspectionBasisVersionId" UUID,
    ADD COLUMN "inspectionBasisSnapshot" JSONB;

CREATE UNIQUE INDEX "InspectionBasisDefinition_organization_domain_name_key"
    ON "InspectionBasisDefinition"("organizationId", "inspectionDomain", "name");
CREATE INDEX "InspectionBasisDefinition_organization_domain_status_idx"
    ON "InspectionBasisDefinition"("organizationId", "inspectionDomain", "status");
CREATE UNIQUE INDEX "InspectionBasisVersion_definition_version_key"
    ON "InspectionBasisVersion"("definitionId", "version");
CREATE INDEX "InspectionBasisVersion_organization_domain_status_idx"
    ON "InspectionBasisVersion"("organizationId", "inspectionDomain", "status");
CREATE INDEX "InspectionBasisVersion_contentDigest_idx" ON "InspectionBasisVersion"("contentDigest");
CREATE UNIQUE INDEX "InspectionBasisVersion_one_active_per_org_domain_key"
    ON "InspectionBasisVersion"("organizationId", "inspectionDomain") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "InspectionBasisTechnicalSourceLink_basis_standard_key"
    ON "InspectionBasisTechnicalSourceLink"("basisVersionId", "standardVersionId");
CREATE UNIQUE INDEX "InspectionBasisTechnicalSourceLink_basis_order_key"
    ON "InspectionBasisTechnicalSourceLink"("basisVersionId", "displayOrder");
CREATE INDEX "InspectionBasisTechnicalSourceLink_standard_idx"
    ON "InspectionBasisTechnicalSourceLink"("standardVersionId");
CREATE UNIQUE INDEX "InspectionBasisRegulatoryUnitLink_basis_unit_key"
    ON "InspectionBasisRegulatoryUnitLink"("basisVersionId", "regulatoryUnitId");
CREATE UNIQUE INDEX "InspectionBasisRegulatoryUnitLink_basis_order_key"
    ON "InspectionBasisRegulatoryUnitLink"("basisVersionId", "displayOrder");
CREATE INDEX "InspectionBasisRegulatoryUnitLink_unit_idx"
    ON "InspectionBasisRegulatoryUnitLink"("regulatoryUnitId");
CREATE UNIQUE INDEX "InspectionBasisCriterionRegulatoryLink_basis_criterion_unit_key"
    ON "InspectionBasisCriterionRegulatoryLink"("basisVersionId", "criterionId", "regulatoryUnitId");
CREATE INDEX "InspectionBasisCriterionRegulatoryLink_criterion_idx"
    ON "InspectionBasisCriterionRegulatoryLink"("criterionId");
CREATE INDEX "InspectionBasisCriterionRegulatoryLink_unit_idx"
    ON "InspectionBasisCriterionRegulatoryLink"("regulatoryUnitId");
CREATE INDEX "Inspection_inspectionBasisVersionId_idx" ON "Inspection"("inspectionBasisVersionId");

ALTER TABLE "InspectionBasisDefinition" ADD CONSTRAINT "InspectionBasisDefinition_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionBasisDefinition" ADD CONSTRAINT "InspectionBasisDefinition_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionBasisVersion" ADD CONSTRAINT "InspectionBasisVersion_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "InspectionBasisDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionBasisVersion" ADD CONSTRAINT "InspectionBasisVersion_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionBasisVersion" ADD CONSTRAINT "InspectionBasisVersion_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionBasisTechnicalSourceLink" ADD CONSTRAINT "InspectionBasisTechnicalSourceLink_basisVersionId_fkey"
    FOREIGN KEY ("basisVersionId") REFERENCES "InspectionBasisVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionBasisTechnicalSourceLink" ADD CONSTRAINT "InspectionBasisTechnicalSourceLink_standardVersionId_fkey"
    FOREIGN KEY ("standardVersionId") REFERENCES "InspectionStandardVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionBasisRegulatoryUnitLink" ADD CONSTRAINT "InspectionBasisRegulatoryUnitLink_basisVersionId_fkey"
    FOREIGN KEY ("basisVersionId") REFERENCES "InspectionBasisVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionBasisRegulatoryUnitLink" ADD CONSTRAINT "InspectionBasisRegulatoryUnitLink_regulatoryUnitId_fkey"
    FOREIGN KEY ("regulatoryUnitId") REFERENCES "RegulatoryUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionBasisCriterionRegulatoryLink" ADD CONSTRAINT "InspectionBasisCriterionRegulatoryLink_basisVersionId_fkey"
    FOREIGN KEY ("basisVersionId") REFERENCES "InspectionBasisVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionBasisCriterionRegulatoryLink" ADD CONSTRAINT "InspectionBasisCriterionRegulatoryLink_criterionId_fkey"
    FOREIGN KEY ("criterionId") REFERENCES "InspectionStandardCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionBasisCriterionRegulatoryLink" ADD CONSTRAINT "InspectionBasisCriterionRegulatoryLink_regulatoryUnitId_fkey"
    FOREIGN KEY ("regulatoryUnitId") REFERENCES "RegulatoryUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inspectionBasisVersionId_fkey"
    FOREIGN KEY ("inspectionBasisVersionId") REFERENCES "InspectionBasisVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
