CREATE TYPE "RegulatoryProvisionLocatorType" AS ENUM (
  'ARTICLE',
  'SECTION',
  'NUMERAL',
  'ANNEX',
  'TABLE',
  'OTHER'
);

CREATE TYPE "RegulatoryProvisionEditorialStatus" AS ENUM (
  'DRAFT',
  'EXTRACTED',
  'TECHNICAL_REVIEW_PENDING',
  'LEGAL_REVIEW_PENDING',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED'
);

CREATE TYPE "RegulatoryRequirementEditorialStatus" AS ENUM (
  'DRAFT',
  'TECHNICAL_REVIEW_PENDING',
  'LEGAL_REVIEW_PENDING',
  'APPROVED_FOR_RULE_DRAFTING',
  'REJECTED',
  'SUPERSEDED'
);

CREATE TYPE "RegulatoryRequirementScopeHint" AS ENUM (
  'UNKNOWN',
  'ORGANIZATION',
  'WORK_CENTER',
  'AREA_PROCESS',
  'ACTIVITY',
  'ASSET',
  'MULTI_SCOPE'
);

CREATE TYPE "RegulatoryRequirementRelationshipType" AS ENUM (
  'PRIMARY_SOURCE',
  'SUPPORTING_SOURCE',
  'RELATED_SOURCE'
);

CREATE TABLE "RegulatoryProvision" (
  "id" UUID NOT NULL,
  "sourceVersionId" UUID NOT NULL,
  "provisionKey" VARCHAR(160) NOT NULL,
  "locatorType" "RegulatoryProvisionLocatorType" NOT NULL,
  "locatorLabel" VARCHAR(240) NOT NULL,
  "heading" VARCHAR(500),
  "summary" VARCHAR(1000),
  "editorialStatus" "RegulatoryProvisionEditorialStatus" NOT NULL,
  "supersedesProvisionId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryProvision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RegulatoryProvision_no_self_replacement_check"
    CHECK ("supersedesProvisionId" IS NULL OR "supersedesProvisionId" <> "id"),
  CONSTRAINT "RegulatoryProvision_provisionKey_check" CHECK ("provisionKey" ~ '^[A-Z][A-Z0-9_]{2,159}$'),
  CONSTRAINT "RegulatoryProvision_locatorLabel_check" CHECK (char_length("locatorLabel") >= 1),
  CONSTRAINT "RegulatoryProvision_heading_check" CHECK ("heading" IS NULL OR char_length("heading") >= 1),
  CONSTRAINT "RegulatoryProvision_summary_check" CHECK ("summary" IS NULL OR char_length("summary") >= 1)
);

CREATE TABLE "RegulatoryRequirement" (
  "id" UUID NOT NULL,
  "requirementKey" VARCHAR(160) NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "editorialStatus" "RegulatoryRequirementEditorialStatus" NOT NULL,
  "scopeHint" "RegulatoryRequirementScopeHint" NOT NULL DEFAULT 'UNKNOWN',
  "supersedesRequirementId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryRequirement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RegulatoryRequirement_no_self_replacement_check"
    CHECK ("supersedesRequirementId" IS NULL OR "supersedesRequirementId" <> "id"),
  CONSTRAINT "RegulatoryRequirement_requirementKey_check" CHECK ("requirementKey" ~ '^[A-Z][A-Z0-9_]{2,159}$'),
  CONSTRAINT "RegulatoryRequirement_title_check" CHECK (char_length("title") >= 1),
  CONSTRAINT "RegulatoryRequirement_description_check" CHECK (char_length("description") >= 1)
);

CREATE TABLE "RegulatoryRequirementSource" (
  "id" UUID NOT NULL,
  "requirementId" UUID NOT NULL,
  "provisionId" UUID NOT NULL,
  "relationshipType" "RegulatoryRequirementRelationshipType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryRequirementSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegulatoryProvision_sourceVersionId_provisionKey_key"
  ON "RegulatoryProvision"("sourceVersionId", "provisionKey");
CREATE INDEX "RegulatoryProvision_sourceVersionId_editorialStatus_idx"
  ON "RegulatoryProvision"("sourceVersionId", "editorialStatus");
CREATE INDEX "RegulatoryProvision_provisionKey_idx"
  ON "RegulatoryProvision"("provisionKey");
CREATE UNIQUE INDEX "RegulatoryProvision_supersedesProvisionId_key"
  ON "RegulatoryProvision"("supersedesProvisionId");
CREATE UNIQUE INDEX "RegulatoryRequirement_requirementKey_key"
  ON "RegulatoryRequirement"("requirementKey");
CREATE UNIQUE INDEX "RegulatoryRequirement_supersedesRequirementId_key"
  ON "RegulatoryRequirement"("supersedesRequirementId");
CREATE INDEX "RegulatoryRequirement_editorialStatus_createdAt_idx"
  ON "RegulatoryRequirement"("editorialStatus", "createdAt");
CREATE INDEX "RegulatoryRequirement_scopeHint_idx"
  ON "RegulatoryRequirement"("scopeHint");
CREATE UNIQUE INDEX "RegulatoryRequirementSource_requirementId_provisionId_relationshipType_key"
  ON "RegulatoryRequirementSource"("requirementId", "provisionId", "relationshipType");
CREATE INDEX "RegulatoryRequirementSource_requirementId_relationshipType_idx"
  ON "RegulatoryRequirementSource"("requirementId", "relationshipType");
CREATE INDEX "RegulatoryRequirementSource_provisionId_relationshipType_idx"
  ON "RegulatoryRequirementSource"("provisionId", "relationshipType");

ALTER TABLE "RegulatoryProvision"
  ADD CONSTRAINT "RegulatoryProvision_sourceVersionId_fkey"
  FOREIGN KEY ("sourceVersionId") REFERENCES "RegulatorySourceVersion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RegulatoryProvision"
  ADD CONSTRAINT "RegulatoryProvision_supersedesProvisionId_fkey"
  FOREIGN KEY ("supersedesProvisionId") REFERENCES "RegulatoryProvision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RegulatoryRequirement"
  ADD CONSTRAINT "RegulatoryRequirement_supersedesRequirementId_fkey"
  FOREIGN KEY ("supersedesRequirementId") REFERENCES "RegulatoryRequirement"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RegulatoryRequirementSource"
  ADD CONSTRAINT "RegulatoryRequirementSource_requirementId_fkey"
  FOREIGN KEY ("requirementId") REFERENCES "RegulatoryRequirement"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RegulatoryRequirementSource"
  ADD CONSTRAINT "RegulatoryRequirementSource_provisionId_fkey"
  FOREIGN KEY ("provisionId") REFERENCES "RegulatoryProvision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "enforce_regulatory_provision_lifecycle"()
RETURNS trigger AS $$
DECLARE
  replacement_status "RegulatoryProvisionEditorialStatus";
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."editorialStatus" <> 'DRAFT' THEN
      RAISE EXCEPTION 'RegulatoryProvision must start in DRAFT';
    END IF;

    IF NEW."supersedesProvisionId" IS NOT NULL THEN
      IF NEW."supersedesProvisionId" = NEW."id" THEN
        RAISE EXCEPTION 'RegulatoryProvision cannot supersede itself';
      END IF;

      SELECT "editorialStatus"
      INTO replacement_status
      FROM "RegulatoryProvision"
      WHERE "id" = NEW."supersedesProvisionId"
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Superseded RegulatoryProvision does not exist';
      END IF;
      IF replacement_status <> 'APPROVED' THEN
        RAISE EXCEPTION 'A replacement RegulatoryProvision must reference an APPROVED record';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM "RegulatoryProvision"
        WHERE "id" = NEW."supersedesProvisionId"
          AND "supersedesProvisionId" = NEW."id"
      ) THEN
        RAISE EXCEPTION 'Direct RegulatoryProvision replacement cycle is not allowed';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'RegulatoryProvision rows cannot be deleted';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."sourceVersionId" IS DISTINCT FROM OLD."sourceVersionId"
    OR NEW."provisionKey" IS DISTINCT FROM OLD."provisionKey"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    OR NEW."supersedesProvisionId" IS DISTINCT FROM OLD."supersedesProvisionId"
  THEN
    RAISE EXCEPTION 'RegulatoryProvision identity and replacement provenance are immutable';
  END IF;

  IF OLD."editorialStatus" IN ('REJECTED', 'SUPERSEDED') THEN
    RAISE EXCEPTION 'Terminal RegulatoryProvision rows are immutable';
  END IF;

  IF OLD."editorialStatus" = 'APPROVED' THEN
    IF NEW."editorialStatus" <> 'SUPERSEDED' THEN
      RAISE EXCEPTION 'APPROVED RegulatoryProvision may only transition to SUPERSEDED';
    END IF;
    IF NEW."locatorType" IS DISTINCT FROM OLD."locatorType"
      OR NEW."locatorLabel" IS DISTINCT FROM OLD."locatorLabel"
      OR NEW."heading" IS DISTINCT FROM OLD."heading"
      OR NEW."summary" IS DISTINCT FROM OLD."summary"
    THEN
      RAISE EXCEPTION 'APPROVED RegulatoryProvision content is frozen';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM "RegulatoryProvision" WHERE "supersedesProvisionId" = OLD."id"
    ) THEN
      RAISE EXCEPTION 'RegulatoryProvision requires an explicit replacement before SUPERSEDED';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."editorialStatus" IS DISTINCT FROM OLD."editorialStatus"
    AND NOT (
      (OLD."editorialStatus" = 'DRAFT' AND NEW."editorialStatus" IN ('EXTRACTED', 'REJECTED'))
      OR (OLD."editorialStatus" = 'EXTRACTED' AND NEW."editorialStatus" IN ('DRAFT', 'TECHNICAL_REVIEW_PENDING', 'REJECTED'))
      OR (OLD."editorialStatus" = 'TECHNICAL_REVIEW_PENDING' AND NEW."editorialStatus" IN ('EXTRACTED', 'LEGAL_REVIEW_PENDING', 'REJECTED'))
      OR (OLD."editorialStatus" = 'LEGAL_REVIEW_PENDING' AND NEW."editorialStatus" IN ('TECHNICAL_REVIEW_PENDING', 'APPROVED', 'REJECTED'))
    )
  THEN
    RAISE EXCEPTION 'Invalid RegulatoryProvision editorial status transition: % -> %',
      OLD."editorialStatus", NEW."editorialStatus";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RegulatoryProvision_lifecycle"
BEFORE INSERT OR UPDATE OR DELETE ON "RegulatoryProvision"
FOR EACH ROW EXECUTE FUNCTION "enforce_regulatory_provision_lifecycle"();

CREATE FUNCTION "enforce_regulatory_requirement_lifecycle"()
RETURNS trigger AS $$
DECLARE
  replacement_status "RegulatoryRequirementEditorialStatus";
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."editorialStatus" <> 'DRAFT' THEN
      RAISE EXCEPTION 'RegulatoryRequirement must start in DRAFT';
    END IF;

    IF NEW."supersedesRequirementId" IS NOT NULL THEN
      IF NEW."supersedesRequirementId" = NEW."id" THEN
        RAISE EXCEPTION 'RegulatoryRequirement cannot supersede itself';
      END IF;

      SELECT "editorialStatus"
      INTO replacement_status
      FROM "RegulatoryRequirement"
      WHERE "id" = NEW."supersedesRequirementId"
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Superseded RegulatoryRequirement does not exist';
      END IF;
      IF replacement_status <> 'APPROVED_FOR_RULE_DRAFTING' THEN
        RAISE EXCEPTION 'A replacement RegulatoryRequirement must reference an APPROVED_FOR_RULE_DRAFTING record';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM "RegulatoryRequirement"
        WHERE "id" = NEW."supersedesRequirementId"
          AND "supersedesRequirementId" = NEW."id"
      ) THEN
        RAISE EXCEPTION 'Direct RegulatoryRequirement replacement cycle is not allowed';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'RegulatoryRequirement rows cannot be deleted';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."requirementKey" IS DISTINCT FROM OLD."requirementKey"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    OR NEW."supersedesRequirementId" IS DISTINCT FROM OLD."supersedesRequirementId"
  THEN
    RAISE EXCEPTION 'RegulatoryRequirement identity and replacement provenance are immutable';
  END IF;

  IF OLD."editorialStatus" IN ('REJECTED', 'SUPERSEDED') THEN
    RAISE EXCEPTION 'Terminal RegulatoryRequirement rows are immutable';
  END IF;

  IF OLD."editorialStatus" = 'APPROVED_FOR_RULE_DRAFTING' THEN
    IF NEW."editorialStatus" <> 'SUPERSEDED' THEN
      RAISE EXCEPTION 'APPROVED_FOR_RULE_DRAFTING RegulatoryRequirement may only transition to SUPERSEDED';
    END IF;
    IF NEW."title" IS DISTINCT FROM OLD."title"
      OR NEW."description" IS DISTINCT FROM OLD."description"
      OR NEW."scopeHint" IS DISTINCT FROM OLD."scopeHint"
    THEN
      RAISE EXCEPTION 'APPROVED_FOR_RULE_DRAFTING RegulatoryRequirement content is frozen';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM "RegulatoryRequirement" WHERE "supersedesRequirementId" = OLD."id"
    ) THEN
      RAISE EXCEPTION 'RegulatoryRequirement requires an explicit replacement before SUPERSEDED';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."editorialStatus" IS DISTINCT FROM OLD."editorialStatus"
    AND NOT (
      (OLD."editorialStatus" = 'DRAFT' AND NEW."editorialStatus" IN ('TECHNICAL_REVIEW_PENDING', 'REJECTED'))
      OR (OLD."editorialStatus" = 'TECHNICAL_REVIEW_PENDING' AND NEW."editorialStatus" IN ('DRAFT', 'LEGAL_REVIEW_PENDING', 'REJECTED'))
      OR (OLD."editorialStatus" = 'LEGAL_REVIEW_PENDING' AND NEW."editorialStatus" IN ('TECHNICAL_REVIEW_PENDING', 'APPROVED_FOR_RULE_DRAFTING', 'REJECTED'))
    )
  THEN
    RAISE EXCEPTION 'Invalid RegulatoryRequirement editorial status transition: % -> %',
      OLD."editorialStatus", NEW."editorialStatus";
  END IF;

  IF NEW."editorialStatus" = 'APPROVED_FOR_RULE_DRAFTING'
    AND NOT EXISTS (
      SELECT 1 FROM "RegulatoryRequirementSource" WHERE "requirementId" = OLD."id"
    )
  THEN
    RAISE EXCEPTION 'RegulatoryRequirement requires provenance before approval';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RegulatoryRequirement_lifecycle"
BEFORE INSERT OR UPDATE OR DELETE ON "RegulatoryRequirement"
FOR EACH ROW EXECUTE FUNCTION "enforce_regulatory_requirement_lifecycle"();

CREATE FUNCTION "enforce_regulatory_requirement_source_lifecycle"()
RETURNS trigger AS $$
DECLARE
  requirement_status "RegulatoryRequirementEditorialStatus";
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."requirementId" IS DISTINCT FROM OLD."requirementId"
    OR NEW."provisionId" IS DISTINCT FROM OLD."provisionId"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'RegulatoryRequirementSource identity and provenance are immutable';
  END IF;

  SELECT "editorialStatus"
  INTO requirement_status
  FROM "RegulatoryRequirement"
  WHERE "id" = CASE WHEN TG_OP = 'DELETE' THEN OLD."requirementId" ELSE NEW."requirementId" END
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RegulatoryRequirement for provenance link does not exist';
  END IF;
  IF requirement_status NOT IN ('DRAFT', 'TECHNICAL_REVIEW_PENDING', 'LEGAL_REVIEW_PENDING') THEN
    RAISE EXCEPTION 'RegulatoryRequirement provenance is frozen outside pre-approval states';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RegulatoryRequirementSource_lifecycle"
BEFORE INSERT OR UPDATE OR DELETE ON "RegulatoryRequirementSource"
FOR EACH ROW EXECUTE FUNCTION "enforce_regulatory_requirement_source_lifecycle"();
