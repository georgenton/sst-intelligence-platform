CREATE FUNCTION "post_anita_prevent_reference_content_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'POST_ANITA_IMMUTABLE_REFERENCE_CONTENT';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "InspectionResource_immutable"
  BEFORE UPDATE OR DELETE ON "InspectionResource"
  FOR EACH ROW EXECUTE FUNCTION "post_anita_prevent_reference_content_mutation"();

CREATE TRIGGER "InspectionResourceCriterionMapping_immutable"
  BEFORE UPDATE OR DELETE ON "InspectionResourceCriterionMapping"
  FOR EACH ROW EXECUTE FUNCTION "post_anita_prevent_reference_content_mutation"();

CREATE FUNCTION "post_anita_guard_editorial_proposal_transition"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'AI_PROPOSED' AND NEW."status" = 'PENDING_EXPERT_REVIEW'
    AND (to_jsonb(OLD) - 'status' - 'submittedAt') = (to_jsonb(NEW) - 'status' - 'submittedAt') THEN
    RETURN NEW;
  END IF;
  IF OLD."status" = 'PENDING_EXPERT_REVIEW' AND NEW."status" IN ('APPROVED', 'REJECTED')
    AND (to_jsonb(OLD) - 'status' - 'reviewedById' - 'reviewComment' - 'reviewedAt') =
        (to_jsonb(NEW) - 'status' - 'reviewedById' - 'reviewComment' - 'reviewedAt') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'POST_ANITA_INVALID_EDITORIAL_PROPOSAL_MUTATION';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "InspectionDraftProposal_transition_guard"
  BEFORE UPDATE OR DELETE ON "InspectionDraftProposal"
  FOR EACH ROW EXECUTE FUNCTION "post_anita_guard_editorial_proposal_transition"();
