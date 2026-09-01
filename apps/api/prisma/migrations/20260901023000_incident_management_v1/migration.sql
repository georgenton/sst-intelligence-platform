CREATE TYPE "IncidentEventType" AS ENUM ('INCIDENT', 'NEAR_MISS');
CREATE TYPE "IncidentStatus" AS ENUM ('DRAFT', 'REPORTED', 'UNDER_INVESTIGATION', 'ACTIONS_IN_PROGRESS', 'CLOSED', 'CANCELLED');
CREATE TYPE "IncidentInvestigationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');
CREATE TYPE "IncidentFactorCategory" AS ENUM ('TASK', 'EQUIPMENT', 'ENVIRONMENT', 'ORGANIZATION', 'PROCEDURE', 'TRAINING', 'OTHER');
CREATE TYPE "IncidentActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'COMPLETED', 'CANCELLED');
CREATE TYPE "IncidentEvidenceType" AS ENUM ('NOTE', 'EXTERNAL_LINK');
CREATE TYPE "IncidentEvidenceScope" AS ENUM ('INVESTIGATION', 'ACTION');

CREATE TABLE "Incident" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "workCenterId" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3),
    "reportedByUserId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "eventType" "IncidentEventType" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'DRAFT',
    "activityContext" VARCHAR(1000),
    "linkedInspectionId" UUID,
    "linkedFindingId" UUID,
    "linkedAssessmentId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentWorker" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "involvement" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncidentWorker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentInvestigation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "status" "IncidentInvestigationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "summary" VARCHAR(4000),
    "startedById" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedById" UUID,
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "IncidentInvestigation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentContributingFactor" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "category" "IncidentFactorCategory" NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "rationale" VARCHAR(2000),
    "recordedById" UUID NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncidentContributingFactor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentAction" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "status" "IncidentActionStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "ownerUserId" UUID,
    "dueAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMP(3),
    "verificationNote" VARCHAR(2000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IncidentAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentEvidence" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "incidentActionId" UUID,
    "scope" "IncidentEvidenceScope" NOT NULL,
    "type" "IncidentEvidenceType" NOT NULL,
    "note" VARCHAR(2000),
    "externalUrl" VARCHAR(1000),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncidentEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Incident_organizationId_status_occurredAt_idx" ON "Incident"("organizationId", "status", "occurredAt");
CREATE INDEX "Incident_organizationId_workCenterId_status_idx" ON "Incident"("organizationId", "workCenterId", "status");
CREATE INDEX "Incident_organizationId_eventType_occurredAt_idx" ON "Incident"("organizationId", "eventType", "occurredAt");
CREATE INDEX "Incident_linkedInspectionId_idx" ON "Incident"("linkedInspectionId");
CREATE INDEX "Incident_linkedFindingId_idx" ON "Incident"("linkedFindingId");
CREATE INDEX "Incident_linkedAssessmentId_idx" ON "Incident"("linkedAssessmentId");
CREATE UNIQUE INDEX "IncidentWorker_incidentId_workerId_key" ON "IncidentWorker"("incidentId", "workerId");
CREATE INDEX "IncidentWorker_organizationId_workerId_createdAt_idx" ON "IncidentWorker"("organizationId", "workerId", "createdAt");
CREATE UNIQUE INDEX "IncidentInvestigation_incidentId_key" ON "IncidentInvestigation"("incidentId");
CREATE INDEX "IncidentInvestigation_organizationId_status_startedAt_idx" ON "IncidentInvestigation"("organizationId", "status", "startedAt");
CREATE INDEX "IncidentContributingFactor_organizationId_incidentId_recordedAt_idx" ON "IncidentContributingFactor"("organizationId", "incidentId", "recordedAt");
CREATE INDEX "IncidentAction_organizationId_status_dueAt_idx" ON "IncidentAction"("organizationId", "status", "dueAt");
CREATE INDEX "IncidentAction_organizationId_ownerUserId_status_idx" ON "IncidentAction"("organizationId", "ownerUserId", "status");
CREATE INDEX "IncidentAction_organizationId_incidentId_status_idx" ON "IncidentAction"("organizationId", "incidentId", "status");
CREATE INDEX "IncidentEvidence_organizationId_incidentId_createdAt_idx" ON "IncidentEvidence"("organizationId", "incidentId", "createdAt");
CREATE INDEX "IncidentEvidence_organizationId_incidentActionId_createdAt_idx" ON "IncidentEvidence"("organizationId", "incidentActionId", "createdAt");

ALTER TABLE "Incident" ADD CONSTRAINT "Incident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_linkedInspectionId_fkey" FOREIGN KEY ("linkedInspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_linkedFindingId_fkey" FOREIGN KEY ("linkedFindingId") REFERENCES "InspectionFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_linkedAssessmentId_fkey" FOREIGN KEY ("linkedAssessmentId") REFERENCES "TechnicalAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentWorker" ADD CONSTRAINT "IncidentWorker_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentWorker" ADD CONSTRAINT "IncidentWorker_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentWorker" ADD CONSTRAINT "IncidentWorker_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentInvestigation" ADD CONSTRAINT "IncidentInvestigation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentInvestigation" ADD CONSTRAINT "IncidentInvestigation_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentInvestigation" ADD CONSTRAINT "IncidentInvestigation_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentInvestigation" ADD CONSTRAINT "IncidentInvestigation_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentContributingFactor" ADD CONSTRAINT "IncidentContributingFactor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentContributingFactor" ADD CONSTRAINT "IncidentContributingFactor_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentContributingFactor" ADD CONSTRAINT "IncidentContributingFactor_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentAction" ADD CONSTRAINT "IncidentAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentAction" ADD CONSTRAINT "IncidentAction_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentAction" ADD CONSTRAINT "IncidentAction_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentAction" ADD CONSTRAINT "IncidentAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentAction" ADD CONSTRAINT "IncidentAction_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentEvidence" ADD CONSTRAINT "IncidentEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentEvidence" ADD CONSTRAINT "IncidentEvidence_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentEvidence" ADD CONSTRAINT "IncidentEvidence_incidentActionId_fkey" FOREIGN KEY ("incidentActionId") REFERENCES "IncidentAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentEvidence" ADD CONSTRAINT "IncidentEvidence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
