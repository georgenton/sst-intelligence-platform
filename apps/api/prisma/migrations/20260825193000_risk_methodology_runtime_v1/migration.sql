-- Risk Methodology Engine V1: global versioned reference data and exact inspection binding.
CREATE TABLE "MethodologySource" (
    "id" UUID NOT NULL,
    "sourceKey" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MethodologySource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MethodologySourceVersion" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "semanticVersion" VARCHAR(32) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "issuer" VARCHAR(200) NOT NULL,
    "originCountry" CHAR(2),
    "documentType" VARCHAR(40) NOT NULL,
    "edition" VARCHAR(120) NOT NULL,
    "publicationDate" DATE,
    "sourceFingerprint" VARCHAR(64) NOT NULL,
    "sourceStatus" VARCHAR(40) NOT NULL,
    "licenseReproductionNote" VARCHAR(500) NOT NULL,
    "officialUrl" TEXT,
    "reviewStatus" VARCHAR(32) NOT NULL,
    "publicationStatus" VARCHAR(32) NOT NULL,
    "manifest" JSONB NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MethodologySourceVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskMethodDefinition" (
    "id" UUID NOT NULL,
    "methodKey" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskMethodDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskMethodVersion" (
    "id" UUID NOT NULL,
    "methodDefinitionId" UUID NOT NULL,
    "semanticVersion" VARCHAR(32) NOT NULL,
    "displayName" VARCHAR(200) NOT NULL,
    "methodKind" VARCHAR(80) NOT NULL,
    "calculationProviderKey" VARCHAR(160) NOT NULL,
    "calculationProviderVersion" VARCHAR(32) NOT NULL,
    "inputSchemaVersion" VARCHAR(32) NOT NULL,
    "resultSchemaVersion" VARCHAR(32) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "regulatory" BOOLEAN NOT NULL DEFAULT false,
    "publicationStatus" VARCHAR(32) NOT NULL,
    "technicalReviewStatus" VARCHAR(32) NOT NULL,
    "legalReviewStatus" VARCHAR(32) NOT NULL,
    "disclaimer" VARCHAR(1000) NOT NULL,
    "manifest" JSONB NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskMethodVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskMethodSourceLink" (
    "id" UUID NOT NULL,
    "riskMethodVersionId" UUID NOT NULL,
    "methodologySourceVersionId" UUID NOT NULL,
    "relationship" VARCHAR(40) NOT NULL DEFAULT 'TECHNICAL_BASIS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskMethodSourceLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskMethodExpertGuidanceVersion" (
    "id" UUID NOT NULL,
    "guidanceKey" VARCHAR(160) NOT NULL,
    "guidanceVersion" VARCHAR(32) NOT NULL,
    "riskMethodVersionId" UUID NOT NULL,
    "authorSource" VARCHAR(200) NOT NULL,
    "evidenceClassification" VARCHAR(60) NOT NULL,
    "reviewStatus" VARCHAR(32) NOT NULL,
    "officialUiVerification" VARCHAR(32) NOT NULL,
    "helpDefinitions" JSONB NOT NULL,
    "disclaimer" VARCHAR(1000) NOT NULL,
    "manifest" JSONB NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "publicationStatus" VARCHAR(32) NOT NULL DEFAULT 'CANDIDATE',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskMethodExpertGuidanceVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskMethodRegulatoryContext" (
    "id" UUID NOT NULL,
    "contextKey" VARCHAR(160) NOT NULL,
    "contextVersion" VARCHAR(32) NOT NULL,
    "riskMethodVersionId" UUID NOT NULL,
    "jurisdiction" CHAR(2) NOT NULL,
    "relationship" VARCHAR(80) NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "statement" VARCHAR(1000) NOT NULL,
    "technicalReviewStatus" VARCHAR(32) NOT NULL,
    "legalReviewStatus" VARCHAR(32) NOT NULL,
    "officialSutMethodOptions" VARCHAR(32) NOT NULL,
    "manifest" JSONB NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskMethodRegulatoryContext_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MethodologySource_sourceKey_key" ON "MethodologySource"("sourceKey");
CREATE UNIQUE INDEX "MethodologySourceVersion_sourceId_semanticVersion_key" ON "MethodologySourceVersion"("sourceId", "semanticVersion");
CREATE INDEX "MethodologySourceVersion_publicationStatus_sourceId_idx" ON "MethodologySourceVersion"("publicationStatus", "sourceId");
CREATE UNIQUE INDEX "RiskMethodDefinition_methodKey_key" ON "RiskMethodDefinition"("methodKey");
CREATE UNIQUE INDEX "RiskMethodVersion_methodDefinitionId_semanticVersion_key" ON "RiskMethodVersion"("methodDefinitionId", "semanticVersion");
CREATE INDEX "RiskMethodVersion_publicationStatus_methodDefinitionId_idx" ON "RiskMethodVersion"("publicationStatus", "methodDefinitionId");
CREATE UNIQUE INDEX "RiskMethodSourceLink_riskMethodVersionId_methodologySourceVersionId_relationship_key" ON "RiskMethodSourceLink"("riskMethodVersionId", "methodologySourceVersionId", "relationship");
CREATE UNIQUE INDEX "RiskMethodExpertGuidanceVersion_guidanceKey_guidanceVersion_key" ON "RiskMethodExpertGuidanceVersion"("guidanceKey", "guidanceVersion");
CREATE INDEX "RiskMethodExpertGuidanceVersion_riskMethodVersionId_publicationStatus_idx" ON "RiskMethodExpertGuidanceVersion"("riskMethodVersionId", "publicationStatus");
CREATE UNIQUE INDEX "RiskMethodRegulatoryContext_contextKey_contextVersion_key" ON "RiskMethodRegulatoryContext"("contextKey", "contextVersion");
CREATE INDEX "RiskMethodRegulatoryContext_riskMethodVersionId_jurisdiction_idx" ON "RiskMethodRegulatoryContext"("riskMethodVersionId", "jurisdiction");

ALTER TABLE "MethodologySourceVersion" ADD CONSTRAINT "MethodologySourceVersion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MethodologySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskMethodVersion" ADD CONSTRAINT "RiskMethodVersion_methodDefinitionId_fkey" FOREIGN KEY ("methodDefinitionId") REFERENCES "RiskMethodDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskMethodSourceLink" ADD CONSTRAINT "RiskMethodSourceLink_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "RiskMethodVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskMethodSourceLink" ADD CONSTRAINT "RiskMethodSourceLink_methodologySourceVersionId_fkey" FOREIGN KEY ("methodologySourceVersionId") REFERENCES "MethodologySourceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskMethodExpertGuidanceVersion" ADD CONSTRAINT "RiskMethodExpertGuidanceVersion_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "RiskMethodVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskMethodRegulatoryContext" ADD CONSTRAINT "RiskMethodRegulatoryContext_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "RiskMethodVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Stable historical identity required before adding defaulted foreign keys.
INSERT INTO "RiskMethodDefinition" ("id", "methodKey")
VALUES ('53000000-0000-4000-8000-000000000001', 'DEMO_5X5');

INSERT INTO "RiskMethodVersion" (
  "id", "methodDefinitionId", "semanticVersion", "displayName", "methodKind",
  "calculationProviderKey", "calculationProviderVersion", "inputSchemaVersion",
  "resultSchemaVersion", "isDemo", "regulatory", "publicationStatus",
  "technicalReviewStatus", "legalReviewStatus", "disclaimer", "manifest",
  "contentHash", "publishedAt"
) VALUES (
  '54000000-0000-4000-8000-000000000001',
  '53000000-0000-4000-8000-000000000001',
  '1.0.0', 'Matriz demostrativa 5×5 histórica', 'INSPECTION_FINDING_RISK',
  'HISTORICAL_DEMO_5X5', '1.0.0', '1.0.0', '1.0.0', true, false,
  'PUBLISHED', 'PENDING', 'NOT_APPLICABLE',
  'Método histórico demostrativo. No constituye metodología ecuatoriana validada y sus resultados existentes no se recalculan.',
  '{"methodKey":"DEMO_5X5","semanticVersion":"1.0.0","displayName":"Matriz demostrativa 5×5 histórica","methodKind":"INSPECTION_FINDING_RISK","calculationProviderKey":"HISTORICAL_DEMO_5X5","calculationProviderVersion":"1.0.0","inputSchemaVersion":"1.0.0","resultSchemaVersion":"1.0.0","isDemo":true,"regulatory":false,"publicationStatus":"PUBLISHED","technicalReviewStatus":"PENDING","legalReviewStatus":"NOT_APPLICABLE","sourceReferences":[],"regulatoryContextReferences":[],"disclaimer":"Método histórico demostrativo. No constituye metodología ecuatoriana validada y sus resultados existentes no se recalculan.","contentHash":"6fe9d271921d5cc8c9690afc2f55592079c1f4ca28c2a6a04e23e51486919ea2"}'::jsonb,
  '6fe9d271921d5cc8c9690afc2f55592079c1f4ca28c2a6a04e23e51486919ea2',
  CURRENT_TIMESTAMP
);

ALTER TABLE "Inspection"
  ADD COLUMN "riskMethodVersionId" UUID NOT NULL DEFAULT '54000000-0000-4000-8000-000000000001',
  ADD COLUMN "riskMethodSnapshot" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "InspectionFinding"
  ADD COLUMN "riskMethodVersionId" UUID NOT NULL DEFAULT '54000000-0000-4000-8000-000000000001',
  ADD COLUMN "riskMethodSnapshot" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "initialMethodInput" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "initialMethodResult" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "guidanceVersionId" UUID,
  ADD COLUMN "guidanceSnapshot" JSONB,
  ADD COLUMN "initialResultLabel" TEXT,
  ADD COLUMN "residualResultLabel" TEXT,
  ADD COLUMN "residualMethodInput" JSONB,
  ADD COLUMN "residualMethodResult" JSONB,
  ADD COLUMN "residualRationale" TEXT,
  ADD COLUMN "residualMethodVersionId" UUID,
  ALTER COLUMN "initialLikelihood" DROP NOT NULL,
  ALTER COLUMN "initialConsequence" DROP NOT NULL,
  ALTER COLUMN "initialScore" DROP NOT NULL,
  ALTER COLUMN "initialRiskLevel" DROP NOT NULL;

UPDATE "Inspection" SET "riskMethodSnapshot" = (
  SELECT "manifest" FROM "RiskMethodVersion" WHERE "id" = '54000000-0000-4000-8000-000000000001'
);

UPDATE "InspectionFinding" SET
  "riskMethodSnapshot" = (SELECT "manifest" FROM "RiskMethodVersion" WHERE "id" = '54000000-0000-4000-8000-000000000001'),
  "initialMethodInput" = jsonb_build_object('likelihood', "initialLikelihood", 'consequence', "initialConsequence"),
  "initialMethodResult" = jsonb_build_object('methodKey', "riskMethodKey", 'methodVersion', "riskMethodVersion", 'likelihood', "initialLikelihood", 'consequence', "initialConsequence", 'score', "initialScore", 'level', "initialRiskLevel"),
  "initialResultLabel" = "initialRiskLevel"::text,
  "residualMethodInput" = CASE WHEN "residualLikelihood" IS NULL THEN NULL ELSE jsonb_build_object('likelihood', "residualLikelihood", 'consequence', "residualConsequence") END,
  "residualMethodResult" = CASE WHEN "residualLikelihood" IS NULL THEN NULL ELSE jsonb_build_object('methodKey', "riskMethodKey", 'methodVersion', "riskMethodVersion", 'likelihood', "residualLikelihood", 'consequence', "residualConsequence", 'score', "residualScore", 'level', "residualRiskLevel") END,
  "residualResultLabel" = "residualRiskLevel"::text,
  "residualMethodVersionId" = CASE WHEN "residualLikelihood" IS NULL THEN NULL ELSE '54000000-0000-4000-8000-000000000001'::uuid END;

CREATE INDEX "Inspection_riskMethodVersionId_idx" ON "Inspection"("riskMethodVersionId");
CREATE INDEX "InspectionFinding_riskMethodVersionId_idx" ON "InspectionFinding"("riskMethodVersionId");
CREATE INDEX "InspectionFinding_residualMethodVersionId_idx" ON "InspectionFinding"("residualMethodVersionId");

ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "RiskMethodVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_riskMethodVersionId_fkey" FOREIGN KEY ("riskMethodVersionId") REFERENCES "RiskMethodVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_residualMethodVersionId_fkey" FOREIGN KEY ("residualMethodVersionId") REFERENCES "RiskMethodVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_guidanceVersionId_fkey" FOREIGN KEY ("guidanceVersionId") REFERENCES "RiskMethodExpertGuidanceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_residual_same_method_check" CHECK ("residualMethodVersionId" IS NULL OR "residualMethodVersionId" = "riskMethodVersionId");

-- Published reference versions are append-only. Candidates remain editable until publication.
CREATE OR REPLACE FUNCTION "reject_published_risk_reference_mutation"() RETURNS trigger AS $$
BEGIN
  IF OLD."publicationStatus" = 'PUBLISHED' THEN
    RAISE EXCEPTION 'PUBLISHED_REFERENCE_IMMUTABLE:%', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MethodologySourceVersion_published_immutable"
BEFORE UPDATE OR DELETE ON "MethodologySourceVersion"
FOR EACH ROW EXECUTE FUNCTION "reject_published_risk_reference_mutation"();

CREATE TRIGGER "RiskMethodVersion_published_immutable"
BEFORE UPDATE OR DELETE ON "RiskMethodVersion"
FOR EACH ROW EXECUTE FUNCTION "reject_published_risk_reference_mutation"();

CREATE TRIGGER "RiskMethodExpertGuidanceVersion_published_immutable"
BEFORE UPDATE OR DELETE ON "RiskMethodExpertGuidanceVersion"
FOR EACH ROW EXECUTE FUNCTION "reject_published_risk_reference_mutation"();

CREATE OR REPLACE FUNCTION "enforce_inspection_method_lock"() RETURNS trigger AS $$
BEGIN
  IF NEW."riskMethodVersionId" <> OLD."riskMethodVersionId" AND EXISTS (
    SELECT 1 FROM "InspectionFinding" WHERE "inspectionId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'INSPECTION_RISK_METHOD_LOCKED_AFTER_VALUATION';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Inspection_method_locked_after_valuation"
BEFORE UPDATE OF "riskMethodVersionId" ON "Inspection"
FOR EACH ROW EXECUTE FUNCTION "enforce_inspection_method_lock"();

CREATE OR REPLACE FUNCTION "enforce_finding_method_binding"() RETURNS trigger AS $$
DECLARE
  inspection_method_id UUID;
BEGIN
  SELECT "riskMethodVersionId" INTO inspection_method_id
  FROM "Inspection" WHERE "id" = NEW."inspectionId";
  IF inspection_method_id IS NULL OR inspection_method_id <> NEW."riskMethodVersionId" THEN
    RAISE EXCEPTION 'FINDING_RISK_METHOD_MUST_MATCH_INSPECTION';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW."riskMethodVersionId" <> OLD."riskMethodVersionId"
    OR NEW."riskMethodSnapshot" IS DISTINCT FROM OLD."riskMethodSnapshot"
    OR NEW."initialMethodInput" IS DISTINCT FROM OLD."initialMethodInput"
    OR NEW."initialMethodResult" IS DISTINCT FROM OLD."initialMethodResult"
  ) THEN
    RAISE EXCEPTION 'INITIAL_RISK_VALUATION_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "InspectionFinding_method_binding"
BEFORE INSERT OR UPDATE ON "InspectionFinding"
FOR EACH ROW EXECUTE FUNCTION "enforce_finding_method_binding"();
