-- Source-to-runtime integrity hardening for published aggregates and valuation history.

-- DELETE triggers must return OLD. Published rows still raise; candidate rows retain their normal
-- editorial lifecycle instead of being silently suppressed by a NULL trigger result.
CREATE OR REPLACE FUNCTION "reject_published_risk_reference_mutation"() RETURNS trigger AS $$
BEGIN
  IF OLD."publicationStatus" = 'PUBLISHED' THEN
    RAISE EXCEPTION 'PUBLISHED_REFERENCE_IMMUTABLE:%', TG_TABLE_NAME;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
    NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
    OR NEW."inspectionId" IS DISTINCT FROM OLD."inspectionId"
    OR NEW."riskMethodKey" IS DISTINCT FROM OLD."riskMethodKey"
    OR NEW."riskMethodVersion" IS DISTINCT FROM OLD."riskMethodVersion"
    OR NEW."riskMethodVersionId" IS DISTINCT FROM OLD."riskMethodVersionId"
    OR NEW."riskMethodSnapshot" IS DISTINCT FROM OLD."riskMethodSnapshot"
    OR NEW."initialMethodInput" IS DISTINCT FROM OLD."initialMethodInput"
    OR NEW."initialMethodResult" IS DISTINCT FROM OLD."initialMethodResult"
    OR NEW."guidanceVersionId" IS DISTINCT FROM OLD."guidanceVersionId"
    OR NEW."guidanceSnapshot" IS DISTINCT FROM OLD."guidanceSnapshot"
    OR NEW."initialLikelihood" IS DISTINCT FROM OLD."initialLikelihood"
    OR NEW."initialConsequence" IS DISTINCT FROM OLD."initialConsequence"
    OR NEW."initialScore" IS DISTINCT FROM OLD."initialScore"
    OR NEW."initialRiskLevel" IS DISTINCT FROM OLD."initialRiskLevel"
    OR NEW."initialResultLabel" IS DISTINCT FROM OLD."initialResultLabel"
  ) THEN
    RAISE EXCEPTION 'INITIAL_RISK_VALUATION_IMMUTABLE';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."residualMethodVersionId" IS NOT NULL AND (
    NEW."residualMethodVersionId" IS DISTINCT FROM OLD."residualMethodVersionId"
    OR NEW."residualMethodInput" IS DISTINCT FROM OLD."residualMethodInput"
    OR NEW."residualMethodResult" IS DISTINCT FROM OLD."residualMethodResult"
    OR NEW."residualRationale" IS DISTINCT FROM OLD."residualRationale"
    OR NEW."residualLikelihood" IS DISTINCT FROM OLD."residualLikelihood"
    OR NEW."residualConsequence" IS DISTINCT FROM OLD."residualConsequence"
    OR NEW."residualScore" IS DISTINCT FROM OLD."residualScore"
    OR NEW."residualRiskLevel" IS DISTINCT FROM OLD."residualRiskLevel"
    OR NEW."residualResultLabel" IS DISTINCT FROM OLD."residualResultLabel"
  ) THEN
    RAISE EXCEPTION 'RESIDUAL_RISK_VALUATION_IMMUTABLE';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "reject_published_method_aggregate_mutation"() RETURNS trigger AS $$
DECLARE
  old_method_id UUID;
  new_method_id UUID;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_method_id := OLD."riskMethodVersionId";
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_method_id := NEW."riskMethodVersionId";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "RiskMethodVersion"
    WHERE "id" IN (old_method_id, new_method_id)
      AND "publicationStatus" = 'PUBLISHED'
  ) THEN
    RAISE EXCEPTION 'PUBLISHED_METHOD_AGGREGATE_IMMUTABLE:%', TG_TABLE_NAME;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RiskMethodSourceLink_published_method_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "RiskMethodSourceLink"
FOR EACH ROW EXECUTE FUNCTION "reject_published_method_aggregate_mutation"();

CREATE TRIGGER "RiskMethodRegulatoryContext_published_method_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "RiskMethodRegulatoryContext"
FOR EACH ROW EXECUTE FUNCTION "reject_published_method_aggregate_mutation"();
