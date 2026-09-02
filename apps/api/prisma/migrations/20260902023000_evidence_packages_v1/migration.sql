CREATE TYPE "EvidencePackageStatus" AS ENUM ('DRAFT', 'FINALIZED', 'ARCHIVED');

CREATE TYPE "EvidencePackageItemType" AS ENUM (
  'INSPECTION',
  'FINDING',
  'CORRECTIVE_ACTION',
  'ACTION_EVIDENCE',
  'TECHNICAL_ASSESSMENT',
  'INCIDENT',
  'PPE_ISSUE',
  'TRAINING_COMPLETION',
  'WORK_PERMIT',
  'OBLIGATION_EXECUTION',
  'GOVERNANCE_MEETING',
  'GOVERNANCE_DECISION',
  'REGULATORY_UNIT',
  'INSPECTION_BASIS_VERSION'
);

CREATE TABLE "EvidencePackage" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "scope" VARCHAR(1000) NOT NULL,
  "status" "EvidencePackageStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "generatedAt" TIMESTAMP(3),
  "generatedById" UUID,
  "finalizedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "manifest" JSONB,
  "manifestDigest" VARCHAR(64),
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvidencePackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvidencePackageItem" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "packageId" UUID NOT NULL,
  "type" "EvidencePackageItemType" NOT NULL,
  "sourceId" UUID NOT NULL,
  "sourceVersion" VARCHAR(100),
  "labelSnapshot" VARCHAR(500) NOT NULL,
  "provenance" JSONB NOT NULL,
  "contentDigest" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidencePackageItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvidencePackage_organizationId_status_createdAt_idx"
  ON "EvidencePackage"("organizationId", "status", "createdAt");
CREATE INDEX "EvidencePackage_organizationId_generatedAt_idx"
  ON "EvidencePackage"("organizationId", "generatedAt");
CREATE UNIQUE INDEX "EvidencePackageItem_packageId_type_sourceId_key"
  ON "EvidencePackageItem"("packageId", "type", "sourceId");
CREATE INDEX "EvidencePackageItem_organizationId_type_sourceId_idx"
  ON "EvidencePackageItem"("organizationId", "type", "sourceId");
CREATE INDEX "EvidencePackageItem_organizationId_packageId_idx"
  ON "EvidencePackageItem"("organizationId", "packageId");

ALTER TABLE "EvidencePackage"
  ADD CONSTRAINT "EvidencePackage_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidencePackage"
  ADD CONSTRAINT "EvidencePackage_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidencePackage"
  ADD CONSTRAINT "EvidencePackage_generatedById_fkey"
  FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidencePackageItem"
  ADD CONSTRAINT "EvidencePackageItem_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidencePackageItem"
  ADD CONSTRAINT "EvidencePackageItem_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "EvidencePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "protect_finalized_evidence_package_item"()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "EvidencePackage"
    WHERE "id" = COALESCE(OLD."packageId", NEW."packageId")
      AND "status" IN ('FINALIZED', 'ARCHIVED')
  ) THEN
    RAISE EXCEPTION 'Finalized evidence package items are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "EvidencePackageItem_finalized_immutability"
BEFORE INSERT OR UPDATE OR DELETE ON "EvidencePackageItem"
FOR EACH ROW EXECUTE FUNCTION "protect_finalized_evidence_package_item"();

CREATE OR REPLACE FUNCTION "protect_finalized_evidence_package"()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" IN ('FINALIZED', 'ARCHIVED') THEN
    IF NOT (
      OLD."status" = 'FINALIZED'
      AND NEW."status" = 'ARCHIVED'
      AND NEW."title" = OLD."title"
      AND NEW."scope" = OLD."scope"
      AND NEW."version" = OLD."version"
      AND NEW."generatedAt" IS NOT DISTINCT FROM OLD."generatedAt"
      AND NEW."generatedById" IS NOT DISTINCT FROM OLD."generatedById"
      AND NEW."finalizedAt" IS NOT DISTINCT FROM OLD."finalizedAt"
      AND NEW."manifest" IS NOT DISTINCT FROM OLD."manifest"
      AND NEW."manifestDigest" IS NOT DISTINCT FROM OLD."manifestDigest"
    ) THEN
      RAISE EXCEPTION 'Finalized evidence package manifest is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "EvidencePackage_finalized_immutability"
BEFORE UPDATE OR DELETE ON "EvidencePackage"
FOR EACH ROW EXECUTE FUNCTION "protect_finalized_evidence_package"();
