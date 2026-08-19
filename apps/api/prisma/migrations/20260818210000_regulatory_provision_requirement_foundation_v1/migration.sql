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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryProvision_pkey" PRIMARY KEY ("id"),
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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryRequirement_pkey" PRIMARY KEY ("id"),
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
CREATE UNIQUE INDEX "RegulatoryRequirement_requirementKey_key"
  ON "RegulatoryRequirement"("requirementKey");
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

ALTER TABLE "RegulatoryRequirementSource"
  ADD CONSTRAINT "RegulatoryRequirementSource_requirementId_fkey"
  FOREIGN KEY ("requirementId") REFERENCES "RegulatoryRequirement"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RegulatoryRequirementSource"
  ADD CONSTRAINT "RegulatoryRequirementSource_provisionId_fkey"
  FOREIGN KEY ("provisionId") REFERENCES "RegulatoryProvision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "prevent_regulatory_provision_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'RegulatoryProvision rows are immutable; create a replacement row';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RegulatoryProvision_immutable"
BEFORE UPDATE OR DELETE ON "RegulatoryProvision"
FOR EACH ROW EXECUTE FUNCTION "prevent_regulatory_provision_mutation"();

CREATE FUNCTION "prevent_regulatory_requirement_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'RegulatoryRequirement rows are immutable; create a replacement row';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RegulatoryRequirement_immutable"
BEFORE UPDATE OR DELETE ON "RegulatoryRequirement"
FOR EACH ROW EXECUTE FUNCTION "prevent_regulatory_requirement_mutation"();

CREATE FUNCTION "prevent_regulatory_requirement_source_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'RegulatoryRequirementSource rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RegulatoryRequirementSource_immutable"
BEFORE UPDATE OR DELETE ON "RegulatoryRequirementSource"
FOR EACH ROW EXECUTE FUNCTION "prevent_regulatory_requirement_source_mutation"();
