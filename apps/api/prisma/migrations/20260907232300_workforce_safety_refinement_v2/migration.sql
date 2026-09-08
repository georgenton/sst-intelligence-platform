-- CreateEnum
CREATE TYPE "PositionRiskCategory" AS ENUM ('ELECTRICAL', 'ARC_FLASH', 'PROJECTION', 'MECHANICAL', 'ERGONOMIC', 'CHEMICAL', 'BIOLOGICAL', 'PHYSICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PpeRequirementDecision" AS ENUM ('SELECTED_BY_PROFESSIONAL', 'REQUIRED_INTERNALLY');

-- CreateEnum
CREATE TYPE "PpeReferenceReviewStatus" AS ENUM ('PENDING_PROFESSIONAL_REVIEW', 'REVIEWED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PpeReplacementReason" AS ENUM ('EXPIRY', 'WEAR', 'DAMAGE', 'LOSS', 'OTHER_JUSTIFIED');

-- CreateEnum
CREATE TYPE "IncidentEventLocation" AS ENUM ('OWN_FACILITY', 'CLIENT_OR_EXTERNAL_FACILITY', 'PUBLIC_ROAD', 'REMOTE_WORK', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentInvestigationMethod" AS ENUM ('STRUCTURED_FACTORS', 'ISHIKAWA', 'OTHER_PROFESSIONAL');

-- CreateEnum
CREATE TYPE "SafetyObservationCategory" AS ENUM ('UNSAFE_ACT', 'UNSAFE_CONDITION', 'GOOD_PRACTICE', 'HOUSEKEEPING', 'PPE', 'OTHER');

-- CreateEnum
CREATE TYPE "SafetyObservationStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED', 'CLOSED_NO_ACTION');

-- CreateEnum
CREATE TYPE "TrainingNeedSourceType" AS ENUM ('PLAN', 'RISK', 'POSITION', 'PPE_REQUIREMENT', 'INCIDENT', 'SAFETY_OBSERVATION', 'FINDING', 'APPROVED_REQUIREMENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "TrainingAudienceType" AS ENUM ('POSITION', 'WORKER', 'WORK_CENTER', 'WORK_AREA', 'EXPLICIT_GROUP');

-- CreateEnum
CREATE TYPE "TrainingDeliveryClassification" AS ENUM ('INTERNAL', 'EXTERNAL_PROVIDER', 'CERTIFICATION_REVIEW_REQUIRED', 'CERTIFICATION_CONFIRMED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "attentionPriority" "ActionPriority",
ADD COLUMN     "eventLocation" "IncidentEventLocation",
ADD COLUMN     "workAreaId" UUID;

-- AlterTable
ALTER TABLE "IncidentInvestigation" ADD COLUMN     "method" "IncidentInvestigationMethod";

-- AlterTable
ALTER TABLE "PpeCatalogItem" ADD COLUMN     "referenceJurisdiction" VARCHAR(120),
ADD COLUMN     "referenceProvenance" VARCHAR(1000),
ADD COLUMN     "referenceReviewStatus" "PpeReferenceReviewStatus";

-- AlterTable
ALTER TABLE "PpeIssue" ADD COLUMN     "replacementReason" "PpeReplacementReason",
ADD COLUMN     "replacementReasonNote" VARCHAR(1000);

-- AlterTable
ALTER TABLE "TrainingDefinition" ADD COLUMN     "classificationProvenance" VARCHAR(1000),
ADD COLUMN     "deliveryClassification" "TrainingDeliveryClassification";

-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "responsibleUserId" UUID,
ADD COLUMN     "trainingNeedId" UUID,
ADD COLUMN     "workAreaId" UUID;

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "positionId" UUID,
ADD COLUMN     "workAreaId" UUID;

-- AlterTable
ALTER TABLE "WorkerPpeRequirement" ADD COLUMN     "positionRequirementId" UUID;

-- CreateTable
CREATE TABLE "Position" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(80),
    "description" VARCHAR(2000),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionRiskContext" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "category" "PositionRiskCategory" NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "provenance" VARCHAR(1000),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionRiskContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionPpeRequirement" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "riskContextId" UUID,
    "ppeCatalogItemId" UUID NOT NULL,
    "workCenterId" UUID,
    "workAreaId" UUID,
    "reason" VARCHAR(2000) NOT NULL,
    "decision" "PpeRequirementDecision" NOT NULL,
    "selectedById" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionPpeRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentPpeIssue" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "ppeIssueId" UUID NOT NULL,
    "note" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentPpeIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyObservation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "category" "SafetyObservationCategory" NOT NULL,
    "workCenterId" UUID NOT NULL,
    "workAreaId" UUID,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "reportedById" UUID NOT NULL,
    "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "SafetyObservationStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToUserId" UUID,
    "linkedIncidentId" UUID,
    "linkedFindingId" UUID,
    "resolutionNote" VARCHAR(2000),
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyObservationEvidence" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "safetyObservationId" UUID NOT NULL,
    "type" "IncidentEvidenceType" NOT NULL,
    "note" VARCHAR(2000),
    "externalUrl" VARCHAR(1000),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyObservationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyObservationActionLink" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "safetyObservationId" UUID NOT NULL,
    "obligationExecutionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyObservationActionLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingNeed" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "trainingDefinitionId" UUID NOT NULL,
    "linkedPlanItemId" UUID,
    "sourceType" "TrainingNeedSourceType" NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "positionId" UUID,
    "workCenterId" UUID,
    "workAreaId" UUID,
    "linkedAssessmentId" UUID,
    "linkedPpeRequirementId" UUID,
    "linkedIncidentId" UUID,
    "linkedSafetyObservationId" UUID,
    "linkedFindingId" UUID,
    "linkedRegulatoryRequirementId" UUID,
    "requiredByDate" DATE,
    "renewalRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingNeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAudience" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "trainingNeedId" UUID NOT NULL,
    "type" "TrainingAudienceType" NOT NULL,
    "positionId" UUID,
    "workerId" UUID,
    "workCenterId" UUID,
    "workAreaId" UUID,
    "groupLabel" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingAudience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Position_organizationId_isActive_name_idx" ON "Position"("organizationId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Position_organizationId_name_key" ON "Position"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Position_organizationId_code_key" ON "Position"("organizationId", "code");

-- CreateIndex
CREATE INDEX "PositionRiskContext_organizationId_positionId_isActive_idx" ON "PositionRiskContext"("organizationId", "positionId", "isActive");

-- CreateIndex
CREATE INDEX "PositionRiskContext_organizationId_category_isActive_idx" ON "PositionRiskContext"("organizationId", "category", "isActive");

-- CreateIndex
CREATE INDEX "PositionPpeRequirement_organizationId_positionId_isActive_idx" ON "PositionPpeRequirement"("organizationId", "positionId", "isActive");

-- CreateIndex
CREATE INDEX "PositionPpeRequirement_organizationId_riskContextId_idx" ON "PositionPpeRequirement"("organizationId", "riskContextId");

-- CreateIndex
CREATE UNIQUE INDEX "PositionPpeRequirement_positionId_riskContextId_ppeCatalogI_key" ON "PositionPpeRequirement"("positionId", "riskContextId", "ppeCatalogItemId", "workCenterId", "workAreaId");

-- CreateIndex
CREATE INDEX "IncidentPpeIssue_organizationId_ppeIssueId_idx" ON "IncidentPpeIssue"("organizationId", "ppeIssueId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentPpeIssue_incidentId_ppeIssueId_key" ON "IncidentPpeIssue"("incidentId", "ppeIssueId");

-- CreateIndex
CREATE INDEX "SafetyObservation_organizationId_status_priority_observedAt_idx" ON "SafetyObservation"("organizationId", "status", "priority", "observedAt");

-- CreateIndex
CREATE INDEX "SafetyObservation_organizationId_workCenterId_status_idx" ON "SafetyObservation"("organizationId", "workCenterId", "status");

-- CreateIndex
CREATE INDEX "SafetyObservation_organizationId_workAreaId_status_idx" ON "SafetyObservation"("organizationId", "workAreaId", "status");

-- CreateIndex
CREATE INDEX "SafetyObservation_organizationId_assignedToUserId_status_idx" ON "SafetyObservation"("organizationId", "assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "SafetyObservationEvidence_organizationId_safetyObservationI_idx" ON "SafetyObservationEvidence"("organizationId", "safetyObservationId", "createdAt");

-- CreateIndex
CREATE INDEX "SafetyObservationActionLink_organizationId_obligationExecut_idx" ON "SafetyObservationActionLink"("organizationId", "obligationExecutionId");

-- CreateIndex
CREATE UNIQUE INDEX "SafetyObservationActionLink_safetyObservationId_obligationE_key" ON "SafetyObservationActionLink"("safetyObservationId", "obligationExecutionId");

-- CreateIndex
CREATE INDEX "TrainingNeed_organizationId_sourceType_requiredByDate_idx" ON "TrainingNeed"("organizationId", "sourceType", "requiredByDate");

-- CreateIndex
CREATE INDEX "TrainingNeed_organizationId_trainingDefinitionId_idx" ON "TrainingNeed"("organizationId", "trainingDefinitionId");

-- CreateIndex
CREATE INDEX "TrainingAudience_organizationId_trainingNeedId_type_idx" ON "TrainingAudience"("organizationId", "trainingNeedId", "type");

-- CreateIndex
CREATE INDEX "TrainingAudience_organizationId_workerId_idx" ON "TrainingAudience"("organizationId", "workerId");

-- CreateIndex
CREATE INDEX "Incident_organizationId_workAreaId_status_idx" ON "Incident"("organizationId", "workAreaId", "status");

-- CreateIndex
CREATE INDEX "TrainingSession_organizationId_workAreaId_status_idx" ON "TrainingSession"("organizationId", "workAreaId", "status");

-- CreateIndex
CREATE INDEX "TrainingSession_organizationId_trainingNeedId_idx" ON "TrainingSession"("organizationId", "trainingNeedId");

-- CreateIndex
CREATE INDEX "Worker_organizationId_workAreaId_status_idx" ON "Worker"("organizationId", "workAreaId", "status");

-- CreateIndex
CREATE INDEX "Worker_organizationId_positionId_status_idx" ON "Worker"("organizationId", "positionId", "status");

-- CreateIndex
CREATE INDEX "WorkerPpeRequirement_organizationId_positionRequirementId_idx" ON "WorkerPpeRequirement"("organizationId", "positionRequirementId");

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionRiskContext" ADD CONSTRAINT "PositionRiskContext_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionRiskContext" ADD CONSTRAINT "PositionRiskContext_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionRiskContext" ADD CONSTRAINT "PositionRiskContext_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionPpeRequirement" ADD CONSTRAINT "PositionPpeRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionPpeRequirement" ADD CONSTRAINT "PositionPpeRequirement_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionPpeRequirement" ADD CONSTRAINT "PositionPpeRequirement_riskContextId_fkey" FOREIGN KEY ("riskContextId") REFERENCES "PositionRiskContext"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionPpeRequirement" ADD CONSTRAINT "PositionPpeRequirement_ppeCatalogItemId_fkey" FOREIGN KEY ("ppeCatalogItemId") REFERENCES "PpeCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionPpeRequirement" ADD CONSTRAINT "PositionPpeRequirement_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionPpeRequirement" ADD CONSTRAINT "PositionPpeRequirement_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionPpeRequirement" ADD CONSTRAINT "PositionPpeRequirement_selectedById_fkey" FOREIGN KEY ("selectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentPpeIssue" ADD CONSTRAINT "IncidentPpeIssue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentPpeIssue" ADD CONSTRAINT "IncidentPpeIssue_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentPpeIssue" ADD CONSTRAINT "IncidentPpeIssue_ppeIssueId_fkey" FOREIGN KEY ("ppeIssueId") REFERENCES "PpeIssue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_linkedIncidentId_fkey" FOREIGN KEY ("linkedIncidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_linkedFindingId_fkey" FOREIGN KEY ("linkedFindingId") REFERENCES "InspectionFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservationEvidence" ADD CONSTRAINT "SafetyObservationEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservationEvidence" ADD CONSTRAINT "SafetyObservationEvidence_safetyObservationId_fkey" FOREIGN KEY ("safetyObservationId") REFERENCES "SafetyObservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservationEvidence" ADD CONSTRAINT "SafetyObservationEvidence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservationActionLink" ADD CONSTRAINT "SafetyObservationActionLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservationActionLink" ADD CONSTRAINT "SafetyObservationActionLink_safetyObservationId_fkey" FOREIGN KEY ("safetyObservationId") REFERENCES "SafetyObservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyObservationActionLink" ADD CONSTRAINT "SafetyObservationActionLink_obligationExecutionId_fkey" FOREIGN KEY ("obligationExecutionId") REFERENCES "ObligationExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerPpeRequirement" ADD CONSTRAINT "WorkerPpeRequirement_positionRequirementId_fkey" FOREIGN KEY ("positionRequirementId") REFERENCES "PositionPpeRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingNeed" ADD CONSTRAINT "TrainingNeed_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingNeed" ADD CONSTRAINT "TrainingNeed_trainingDefinitionId_fkey" FOREIGN KEY ("trainingDefinitionId") REFERENCES "TrainingDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingNeed" ADD CONSTRAINT "TrainingNeed_linkedPlanItemId_fkey" FOREIGN KEY ("linkedPlanItemId") REFERENCES "OperationalPlanItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingNeed" ADD CONSTRAINT "TrainingNeed_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingNeed" ADD CONSTRAINT "TrainingNeed_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingNeed" ADD CONSTRAINT "TrainingNeed_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingNeed" ADD CONSTRAINT "TrainingNeed_linkedAssessmentId_fkey" FOREIGN KEY ("linkedAssessmentId") REFERENCES "TechnicalAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingNeed" ADD CONSTRAINT "TrainingNeed_linkedPpeRequirementId_fkey" FOREIGN KEY ("linkedPpeRequirementId") REFERENCES "PositionPpeRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingNeed" ADD CONSTRAINT "TrainingNeed_linkedIncidentId_fkey" FOREIGN KEY ("linkedIncidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingNeed" ADD CONSTRAINT "TrainingNeed_linkedSafetyObservationId_fkey" FOREIGN KEY ("linkedSafetyObservationId") REFERENCES "SafetyObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingNeed" ADD CONSTRAINT "TrainingNeed_linkedFindingId_fkey" FOREIGN KEY ("linkedFindingId") REFERENCES "InspectionFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingNeed" ADD CONSTRAINT "TrainingNeed_linkedRegulatoryRequirementId_fkey" FOREIGN KEY ("linkedRegulatoryRequirementId") REFERENCES "RegulatoryRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingNeed" ADD CONSTRAINT "TrainingNeed_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAudience" ADD CONSTRAINT "TrainingAudience_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAudience" ADD CONSTRAINT "TrainingAudience_trainingNeedId_fkey" FOREIGN KEY ("trainingNeedId") REFERENCES "TrainingNeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAudience" ADD CONSTRAINT "TrainingAudience_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAudience" ADD CONSTRAINT "TrainingAudience_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAudience" ADD CONSTRAINT "TrainingAudience_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAudience" ADD CONSTRAINT "TrainingAudience_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_trainingNeedId_fkey" FOREIGN KEY ("trainingNeedId") REFERENCES "TrainingNeed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
