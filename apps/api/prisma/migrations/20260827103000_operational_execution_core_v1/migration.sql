CREATE TYPE "ObligationExecutionOriginType" AS ENUM (
  'APPROVED_REQUIREMENT',
  'CANDIDATE_REQUIREMENT',
  'INTERNAL_PROGRAM',
  'MANUAL'
);

CREATE TYPE "ObligationExecutionStatus" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'BLOCKED',
  'READY_FOR_REVIEW',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "ObligationExecutionReviewDecision" AS ENUM ('APPROVED', 'NEEDS_REVISION');
CREATE TYPE "ObligationExecutionEvidenceType" AS ENUM ('NOTE', 'EXTERNAL_LINK');

CREATE TABLE "ObligationExecution" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "workCenterId" UUID,
  "title" VARCHAR(200) NOT NULL,
  "description" VARCHAR(4000),
  "originType" "ObligationExecutionOriginType" NOT NULL,
  "requirementId" UUID,
  "regulatoryUnitId" UUID,
  "internalReference" VARCHAR(500),
  "manualReference" VARCHAR(500),
  "status" "ObligationExecutionStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
  "assignedToUserId" UUID,
  "dueAt" TIMESTAMP(3),
  "evidenceExpectation" VARCHAR(2000),
  "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdById" UUID NOT NULL,
  "completedById" UUID,
  "completedAt" TIMESTAMP(3),
  "reviewedById" UUID,
  "reviewDecision" "ObligationExecutionReviewDecision",
  "reviewedAt" TIMESTAMP(3),
  "reviewComment" VARCHAR(2000),
  "provenanceSnapshot" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ObligationExecution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ObligationExecution_origin_reference_check" CHECK (
    ("originType" IN ('APPROVED_REQUIREMENT', 'CANDIDATE_REQUIREMENT') AND "requirementId" IS NOT NULL)
    OR ("originType" = 'INTERNAL_PROGRAM' AND "internalReference" IS NOT NULL)
    OR ("originType" = 'MANUAL' AND "manualReference" IS NOT NULL)
  ),
  CONSTRAINT "ObligationExecution_completion_check" CHECK (
    ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "completedById" IS NOT NULL)
    OR ("status" <> 'COMPLETED')
  ),
  CONSTRAINT "ObligationExecution_review_check" CHECK (
    ("reviewDecision" IS NULL AND "reviewedAt" IS NULL AND "reviewedById" IS NULL)
    OR ("reviewDecision" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "reviewedById" IS NOT NULL)
  )
);

CREATE TABLE "ObligationExecutionEvidence" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "obligationExecutionId" UUID NOT NULL,
  "type" "ObligationExecutionEvidenceType" NOT NULL,
  "note" VARCHAR(2000),
  "externalUrl" VARCHAR(1000),
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ObligationExecutionEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ObligationExecutionEvidence_content_check" CHECK (
    ("type" = 'NOTE' AND "note" IS NOT NULL AND "externalUrl" IS NULL)
    OR ("type" = 'EXTERNAL_LINK' AND "externalUrl" IS NOT NULL AND "note" IS NULL)
  )
);

CREATE INDEX "ObligationExecution_organizationId_status_dueAt_idx"
  ON "ObligationExecution"("organizationId", "status", "dueAt");
CREATE INDEX "ObligationExecution_organizationId_assignedToUserId_status_idx"
  ON "ObligationExecution"("organizationId", "assignedToUserId", "status");
CREATE INDEX "ObligationExecution_organizationId_workCenterId_status_idx"
  ON "ObligationExecution"("organizationId", "workCenterId", "status");
CREATE INDEX "ObligationExecution_requirementId_idx" ON "ObligationExecution"("requirementId");
CREATE INDEX "ObligationExecution_regulatoryUnitId_idx" ON "ObligationExecution"("regulatoryUnitId");
CREATE INDEX "ObligationExecutionEvidence_organizationId_obligationExecutionId_createdAt_idx"
  ON "ObligationExecutionEvidence"("organizationId", "obligationExecutionId", "createdAt");

ALTER TABLE "ObligationExecution" ADD CONSTRAINT "ObligationExecution_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ObligationExecution" ADD CONSTRAINT "ObligationExecution_workCenterId_fkey"
  FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ObligationExecution" ADD CONSTRAINT "ObligationExecution_requirementId_fkey"
  FOREIGN KEY ("requirementId") REFERENCES "RegulatoryRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ObligationExecution" ADD CONSTRAINT "ObligationExecution_regulatoryUnitId_fkey"
  FOREIGN KEY ("regulatoryUnitId") REFERENCES "RegulatoryUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ObligationExecution" ADD CONSTRAINT "ObligationExecution_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ObligationExecution" ADD CONSTRAINT "ObligationExecution_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ObligationExecution" ADD CONSTRAINT "ObligationExecution_completedById_fkey"
  FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ObligationExecution" ADD CONSTRAINT "ObligationExecution_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ObligationExecutionEvidence" ADD CONSTRAINT "ObligationExecutionEvidence_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ObligationExecutionEvidence" ADD CONSTRAINT "ObligationExecutionEvidence_obligationExecutionId_fkey"
  FOREIGN KEY ("obligationExecutionId") REFERENCES "ObligationExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ObligationExecutionEvidence" ADD CONSTRAINT "ObligationExecutionEvidence_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "PermitTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');
CREATE TYPE "WorkPermitStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'AUTHORIZED',
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
  'CANCELLED'
);

CREATE TABLE "PermitTemplate" (
  "id" UUID NOT NULL,
  "templateKey" VARCHAR(160) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "description" VARCHAR(1000) NOT NULL,
  "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PermitTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PermitTemplateVersion" (
  "id" UUID NOT NULL,
  "permitTemplateId" UUID NOT NULL,
  "version" VARCHAR(32) NOT NULL,
  "status" "PermitTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "schema" JSONB NOT NULL,
  "contentHash" VARCHAR(71) NOT NULL,
  "disclaimer" VARCHAR(1000) NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PermitTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkPermit" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "workCenterId" UUID NOT NULL,
  "permitTemplateVersionId" UUID NOT NULL,
  "templateSnapshot" JSONB NOT NULL,
  "area" VARCHAR(240) NOT NULL,
  "activity" VARCHAR(1000) NOT NULL,
  "plannedStartAt" TIMESTAMP(3) NOT NULL,
  "plannedEndAt" TIMESTAMP(3) NOT NULL,
  "requesterUserId" UUID NOT NULL,
  "approverUserId" UUID,
  "approvedAt" TIMESTAMP(3),
  "approvalComment" VARCHAR(2000),
  "closedByUserId" UUID,
  "closedAt" TIMESTAMP(3),
  "closureNote" VARCHAR(2000),
  "hazards" JSONB NOT NULL,
  "linkedRiskReferences" JSONB NOT NULL,
  "controls" JSONB NOT NULL,
  "preconditions" JSONB NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "status" "WorkPermitStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkPermit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkPermit_dates_check" CHECK ("plannedEndAt" > "plannedStartAt"),
  CONSTRAINT "WorkPermit_no_self_approval_check" CHECK (
    "approverUserId" IS NULL OR "approverUserId" <> "requesterUserId"
  ),
  CONSTRAINT "WorkPermit_approval_check" CHECK (
    ("status" IN ('AUTHORIZED', 'ACTIVE', 'SUSPENDED', 'CLOSED') AND "approverUserId" IS NOT NULL AND "approvedAt" IS NOT NULL)
    OR ("status" NOT IN ('AUTHORIZED', 'ACTIVE', 'SUSPENDED', 'CLOSED'))
  ),
  CONSTRAINT "WorkPermit_closure_check" CHECK (
    ("status" = 'CLOSED' AND "closedByUserId" IS NOT NULL AND "closedAt" IS NOT NULL AND "closureNote" IS NOT NULL)
    OR ("status" <> 'CLOSED')
  )
);

CREATE UNIQUE INDEX "PermitTemplate_templateKey_key" ON "PermitTemplate"("templateKey");
CREATE UNIQUE INDEX "PermitTemplateVersion_permitTemplateId_version_key"
  ON "PermitTemplateVersion"("permitTemplateId", "version");
CREATE INDEX "PermitTemplateVersion_status_publishedAt_idx"
  ON "PermitTemplateVersion"("status", "publishedAt");
CREATE INDEX "WorkPermit_organizationId_status_plannedStartAt_idx"
  ON "WorkPermit"("organizationId", "status", "plannedStartAt");
CREATE INDEX "WorkPermit_organizationId_workCenterId_status_idx"
  ON "WorkPermit"("organizationId", "workCenterId", "status");
CREATE INDEX "WorkPermit_organizationId_requesterUserId_status_idx"
  ON "WorkPermit"("organizationId", "requesterUserId", "status");

ALTER TABLE "PermitTemplateVersion" ADD CONSTRAINT "PermitTemplateVersion_permitTemplateId_fkey"
  FOREIGN KEY ("permitTemplateId") REFERENCES "PermitTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkPermit" ADD CONSTRAINT "WorkPermit_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkPermit" ADD CONSTRAINT "WorkPermit_workCenterId_fkey"
  FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkPermit" ADD CONSTRAINT "WorkPermit_permitTemplateVersionId_fkey"
  FOREIGN KEY ("permitTemplateVersionId") REFERENCES "PermitTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkPermit" ADD CONSTRAINT "WorkPermit_requesterUserId_fkey"
  FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkPermit" ADD CONSTRAINT "WorkPermit_approverUserId_fkey"
  FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkPermit" ADD CONSTRAINT "WorkPermit_closedByUserId_fkey"
  FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "enforce_published_permit_template_immutability"()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'PUBLISHED' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'PUBLISHED_PERMIT_TEMPLATE_VERSION_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PermitTemplateVersion_published_immutable"
BEFORE UPDATE OR DELETE ON "PermitTemplateVersion"
FOR EACH ROW EXECUTE FUNCTION "enforce_published_permit_template_immutability"();

INSERT INTO "PermitTemplate" (
  "id", "templateKey", "name", "description", "isDemo", "createdAt"
) VALUES (
  '59000000-0000-4000-8000-000000000001',
  'GENERIC_INTERNAL_WORK_PERMIT',
  'Permiso interno genérico',
  'Plantilla demostrativa para documentar controles internos de una actividad planificada.',
  true,
  '2026-08-27T00:00:00Z'
);

INSERT INTO "PermitTemplateVersion" (
  "id", "permitTemplateId", "version", "status", "schema", "contentHash", "disclaimer", "publishedAt", "createdAt"
) VALUES (
  '59000000-0000-4000-8000-000000000002',
  '59000000-0000-4000-8000-000000000001',
  '1.0.0',
  'PUBLISHED',
  '{"schemaVersion":"1.0.0","sections":["hazards","controls","preconditions","evidence"]}'::jsonb,
  'sha256:9bce2fa0430ec58c18a5b97a95c40bf0c28e0cce05a9637bd4ea8c72b34984b4',
  'Plantilla interna demostrativa. No sustituye requisitos legales ni certifica que una actividad sea segura.',
  '2026-08-27T00:00:00Z',
  '2026-08-27T00:00:00Z'
);
