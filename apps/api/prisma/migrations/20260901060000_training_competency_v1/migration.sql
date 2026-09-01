CREATE TYPE "TrainingRequirementStatus" AS ENUM ('REQUIRED', 'FULFILLED', 'CANCELLED');
CREATE TYPE "TrainingSessionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TrainingMode" AS ENUM ('IN_PERSON', 'VIRTUAL', 'HYBRID');
CREATE TYPE "TrainingAttendance" AS ENUM ('PRESENT', 'ABSENT', 'PARTIAL');

CREATE TABLE "TrainingDefinition" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "description" VARCHAR(2000),
    "category" VARCHAR(120) NOT NULL,
    "validityDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkerCompetencyRequirement" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "trainingDefinitionId" UUID NOT NULL,
    "linkedAssessmentId" UUID,
    "linkedRegulatoryRequirementId" UUID,
    "reason" VARCHAR(2000) NOT NULL,
    "requiredByDate" DATE,
    "renewalRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" "TrainingRequirementStatus" NOT NULL DEFAULT 'REQUIRED',
    "assignedById" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkerCompetencyRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingSession" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "trainingDefinitionId" UUID NOT NULL,
    "workCenterId" UUID,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "status" "TrainingSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "instructorName" VARCHAR(200),
    "location" VARCHAR(300),
    "mode" "TrainingMode" NOT NULL,
    "createdById" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingParticipant" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attendance" "TrainingAttendance",
    "attendanceRecordedAt" TIMESTAMP(3),
    "attendanceRecordedById" UUID,
    "attendanceEvidenceNote" VARCHAR(2000),
    "attendanceEvidenceUrl" VARCHAR(2000),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "TrainingParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkerTrainingCompletion" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "trainingDefinitionId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "requirementId" UUID,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "completionNote" VARCHAR(2000),
    "certificateReference" VARCHAR(300),
    "evidenceUrl" VARCHAR(2000),
    "validUntil" DATE,
    "recordedById" UUID NOT NULL,
    "renewsCompletionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkerTrainingCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingDefinition_organizationId_title_key" ON "TrainingDefinition"("organizationId", "title");
CREATE INDEX "TrainingDefinition_organizationId_isActive_category_idx" ON "TrainingDefinition"("organizationId", "isActive", "category");
CREATE INDEX "WorkerCompetencyRequirement_organizationId_workerId_status_requiredByDate_idx" ON "WorkerCompetencyRequirement"("organizationId", "workerId", "status", "requiredByDate");
CREATE INDEX "WorkerCompetencyRequirement_organizationId_trainingDefinitionId_status_idx" ON "WorkerCompetencyRequirement"("organizationId", "trainingDefinitionId", "status");
CREATE INDEX "WorkerCompetencyRequirement_organizationId_linkedAssessmentId_idx" ON "WorkerCompetencyRequirement"("organizationId", "linkedAssessmentId");
CREATE INDEX "WorkerCompetencyRequirement_organizationId_linkedRegulatoryRequirementId_idx" ON "WorkerCompetencyRequirement"("organizationId", "linkedRegulatoryRequirementId");
CREATE INDEX "TrainingSession_organizationId_status_scheduledStart_idx" ON "TrainingSession"("organizationId", "status", "scheduledStart");
CREATE INDEX "TrainingSession_organizationId_workCenterId_status_idx" ON "TrainingSession"("organizationId", "workCenterId", "status");
CREATE UNIQUE INDEX "TrainingParticipant_sessionId_workerId_key" ON "TrainingParticipant"("sessionId", "workerId");
CREATE INDEX "TrainingParticipant_organizationId_workerId_attendance_idx" ON "TrainingParticipant"("organizationId", "workerId", "attendance");
CREATE INDEX "TrainingParticipant_organizationId_sessionId_attendance_idx" ON "TrainingParticipant"("organizationId", "sessionId", "attendance");
CREATE UNIQUE INDEX "WorkerTrainingCompletion_participantId_key" ON "WorkerTrainingCompletion"("participantId");
CREATE UNIQUE INDEX "WorkerTrainingCompletion_renewsCompletionId_key" ON "WorkerTrainingCompletion"("renewsCompletionId");
CREATE INDEX "WorkerTrainingCompletion_organizationId_workerId_validUntil_idx" ON "WorkerTrainingCompletion"("organizationId", "workerId", "validUntil");
CREATE INDEX "WorkerTrainingCompletion_organizationId_sessionId_completedAt_idx" ON "WorkerTrainingCompletion"("organizationId", "sessionId", "completedAt");
CREATE INDEX "WorkerTrainingCompletion_organizationId_trainingDefinitionId_validUntil_idx" ON "WorkerTrainingCompletion"("organizationId", "trainingDefinitionId", "validUntil");

ALTER TABLE "TrainingDefinition" ADD CONSTRAINT "TrainingDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingDefinition" ADD CONSTRAINT "TrainingDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerCompetencyRequirement" ADD CONSTRAINT "WorkerCompetencyRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerCompetencyRequirement" ADD CONSTRAINT "WorkerCompetencyRequirement_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerCompetencyRequirement" ADD CONSTRAINT "WorkerCompetencyRequirement_trainingDefinitionId_fkey" FOREIGN KEY ("trainingDefinitionId") REFERENCES "TrainingDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerCompetencyRequirement" ADD CONSTRAINT "WorkerCompetencyRequirement_linkedAssessmentId_fkey" FOREIGN KEY ("linkedAssessmentId") REFERENCES "TechnicalAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerCompetencyRequirement" ADD CONSTRAINT "WorkerCompetencyRequirement_linkedRegulatoryRequirementId_fkey" FOREIGN KEY ("linkedRegulatoryRequirementId") REFERENCES "RegulatoryRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerCompetencyRequirement" ADD CONSTRAINT "WorkerCompetencyRequirement_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_trainingDefinitionId_fkey" FOREIGN KEY ("trainingDefinitionId") REFERENCES "TrainingDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingParticipant" ADD CONSTRAINT "TrainingParticipant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingParticipant" ADD CONSTRAINT "TrainingParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingParticipant" ADD CONSTRAINT "TrainingParticipant_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingParticipant" ADD CONSTRAINT "TrainingParticipant_attendanceRecordedById_fkey" FOREIGN KEY ("attendanceRecordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerTrainingCompletion" ADD CONSTRAINT "WorkerTrainingCompletion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerTrainingCompletion" ADD CONSTRAINT "WorkerTrainingCompletion_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerTrainingCompletion" ADD CONSTRAINT "WorkerTrainingCompletion_trainingDefinitionId_fkey" FOREIGN KEY ("trainingDefinitionId") REFERENCES "TrainingDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerTrainingCompletion" ADD CONSTRAINT "WorkerTrainingCompletion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerTrainingCompletion" ADD CONSTRAINT "WorkerTrainingCompletion_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "TrainingParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerTrainingCompletion" ADD CONSTRAINT "WorkerTrainingCompletion_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "WorkerCompetencyRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerTrainingCompletion" ADD CONSTRAINT "WorkerTrainingCompletion_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerTrainingCompletion" ADD CONSTRAINT "WorkerTrainingCompletion_renewsCompletionId_fkey" FOREIGN KEY ("renewsCompletionId") REFERENCES "WorkerTrainingCompletion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
