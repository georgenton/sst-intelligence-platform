-- B3 adds organizational, non-clinical program coordination only.
CREATE TYPE "OccupationalHealthProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "OccupationalHealthActivityStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');
CREATE TYPE "PsychosocialProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "PsychosocialAssessmentCycleStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "PsychosocialInstrumentSourceType" AS ENUM ('MINISTRY_QUESTIONNAIRE', 'EXTERNAL_VALIDATED', 'OTHER_DECLARED');

CREATE TABLE "OccupationalHealthProgram" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "status" "OccupationalHealthProgramStatus" NOT NULL DEFAULT 'DRAFT',
  "title" VARCHAR(240) NOT NULL,
  "scopeSummary" VARCHAR(2000),
  "coordinatorName" VARCHAR(240),
  "notes" VARCHAR(2000),
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OccupationalHealthProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OccupationalHealthActivity" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "programId" UUID NOT NULL,
  "workCenterId" UUID,
  "componentKey" VARCHAR(120) NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "description" VARCHAR(2000),
  "plannedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "status" "OccupationalHealthActivityStatus" NOT NULL DEFAULT 'PLANNED',
  "responsibleUserId" UUID,
  "evidenceType" "ActionEvidenceType",
  "evidenceNote" VARCHAR(2000),
  "evidenceUrl" VARCHAR(1000),
  "linkedOperationalPlanItemId" UUID,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OccupationalHealthActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PsychosocialProgram" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "status" "PsychosocialProgramStatus" NOT NULL DEFAULT 'DRAFT',
  "title" VARCHAR(240) NOT NULL,
  "responsibleUserId" UUID,
  "legalSourceVersionId" UUID,
  "notes" VARCHAR(2000),
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PsychosocialProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PsychosocialAssessmentCycle" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "programId" UUID NOT NULL,
  "status" "PsychosocialAssessmentCycleStatus" NOT NULL DEFAULT 'PLANNED',
  "instrumentName" VARCHAR(240) NOT NULL,
  "instrumentVersion" VARCHAR(120),
  "instrumentProvider" VARCHAR(240),
  "instrumentSourceType" "PsychosocialInstrumentSourceType" NOT NULL,
  "validationReference" VARCHAR(1000),
  "plannedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "targetPopulationCount" INTEGER,
  "participantCount" INTEGER,
  "aggregateReportAvailable" BOOLEAN NOT NULL DEFAULT false,
  "aggregateReportUrl" VARCHAR(1000),
  "evidenceNote" VARCHAR(2000),
  "notes" VARCHAR(2000),
  "linkedOperationalPlanItemId" UUID,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PsychosocialAssessmentCycle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OccupationalHealthProgram_organizationId_status_periodStart_idx" ON "OccupationalHealthProgram"("organizationId", "status", "periodStart");
CREATE INDEX "OccupationalHealthActivity_organizationId_programId_status_idx" ON "OccupationalHealthActivity"("organizationId", "programId", "status");
CREATE INDEX "OccupationalHealthActivity_organizationId_workCenterId_idx" ON "OccupationalHealthActivity"("organizationId", "workCenterId");
CREATE INDEX "OccupationalHealthActivity_organizationId_linkedOperationalPlanItemId_idx" ON "OccupationalHealthActivity"("organizationId", "linkedOperationalPlanItemId");
CREATE INDEX "PsychosocialProgram_organizationId_status_periodStart_idx" ON "PsychosocialProgram"("organizationId", "status", "periodStart");
CREATE INDEX "PsychosocialAssessmentCycle_organizationId_programId_status_idx" ON "PsychosocialAssessmentCycle"("organizationId", "programId", "status");
CREATE INDEX "PsychosocialAssessmentCycle_organizationId_linkedOperationalPlanItemId_idx" ON "PsychosocialAssessmentCycle"("organizationId", "linkedOperationalPlanItemId");

ALTER TABLE "OccupationalHealthProgram" ADD CONSTRAINT "OccupationalHealthProgram_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OccupationalHealthProgram" ADD CONSTRAINT "OccupationalHealthProgram_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OccupationalHealthActivity" ADD CONSTRAINT "OccupationalHealthActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OccupationalHealthActivity" ADD CONSTRAINT "OccupationalHealthActivity_programId_fkey" FOREIGN KEY ("programId") REFERENCES "OccupationalHealthProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OccupationalHealthActivity" ADD CONSTRAINT "OccupationalHealthActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PsychosocialProgram" ADD CONSTRAINT "PsychosocialProgram_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PsychosocialProgram" ADD CONSTRAINT "PsychosocialProgram_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PsychosocialProgram" ADD CONSTRAINT "PsychosocialProgram_legalSourceVersionId_fkey" FOREIGN KEY ("legalSourceVersionId") REFERENCES "RegulatorySourceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PsychosocialProgram" ADD CONSTRAINT "PsychosocialProgram_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PsychosocialAssessmentCycle" ADD CONSTRAINT "PsychosocialAssessmentCycle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PsychosocialAssessmentCycle" ADD CONSTRAINT "PsychosocialAssessmentCycle_programId_fkey" FOREIGN KEY ("programId") REFERENCES "PsychosocialProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PsychosocialAssessmentCycle" ADD CONSTRAINT "PsychosocialAssessmentCycle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
