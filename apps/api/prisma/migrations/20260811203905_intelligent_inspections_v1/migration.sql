-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'ACTION_IN_PROGRESS', 'PENDING_VERIFICATION', 'CLOSED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RecurrenceStatus" AS ENUM ('NONE', 'REPEATED', 'SYSTEMIC_REVIEW_RECOMMENDED');

-- CreateEnum
CREATE TYPE "CorrectiveActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ActionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ActionEvidenceType" AS ENUM ('NOTE', 'EXTERNAL_LINK');

-- CreateEnum
CREATE TYPE "InspectionAlertType" AS ENUM ('RECURRENCE', 'OVERDUE_ACTION', 'HIGH_RESIDUAL_RISK');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "WorkArea" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "workCenterId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "workCenterId" UUID NOT NULL,
    "workAreaId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "inspectorUserId" UUID NOT NULL,
    "status" "InspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionFinding" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "inspectionId" UUID NOT NULL,
    "workCenterId" UUID NOT NULL,
    "workAreaId" UUID,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "riskMethodKey" TEXT NOT NULL,
    "riskMethodVersion" TEXT NOT NULL,
    "initialLikelihood" INTEGER NOT NULL,
    "initialConsequence" INTEGER NOT NULL,
    "initialScore" INTEGER NOT NULL,
    "initialRiskLevel" "RiskLevel" NOT NULL,
    "residualLikelihood" INTEGER,
    "residualConsequence" INTEGER,
    "residualScore" INTEGER,
    "residualRiskLevel" "RiskLevel",
    "recurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "recurrenceStatus" "RecurrenceStatus" NOT NULL DEFAULT 'NONE',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "InspectionFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectiveAction" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedToUserId" UUID,
    "status" "CorrectiveActionStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectiveAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionEvidence" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "correctiveActionId" UUID NOT NULL,
    "type" "ActionEvidenceType" NOT NULL,
    "note" TEXT,
    "externalUrl" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionAlert" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "type" "InspectionAlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" UUID,

    CONSTRAINT "InspectionAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkArea_organizationId_isActive_idx" ON "WorkArea"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "WorkArea_organizationId_workCenterId_idx" ON "WorkArea"("organizationId", "workCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkArea_organizationId_workCenterId_name_key" ON "WorkArea"("organizationId", "workCenterId", "name");

-- CreateIndex
CREATE INDEX "Inspection_organizationId_status_createdAt_idx" ON "Inspection"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Inspection_organizationId_workCenterId_idx" ON "Inspection"("organizationId", "workCenterId");

-- CreateIndex
CREATE INDEX "Inspection_organizationId_inspectorUserId_idx" ON "Inspection"("organizationId", "inspectorUserId");

-- CreateIndex
CREATE INDEX "InspectionFinding_organizationId_inspectionId_idx" ON "InspectionFinding"("organizationId", "inspectionId");

-- CreateIndex
CREATE INDEX "InspectionFinding_organizationId_workCenterId_category_crea_idx" ON "InspectionFinding"("organizationId", "workCenterId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "InspectionFinding_organizationId_status_initialRiskLevel_idx" ON "InspectionFinding"("organizationId", "status", "initialRiskLevel");

-- CreateIndex
CREATE INDEX "InspectionFinding_organizationId_recurrenceStatus_idx" ON "InspectionFinding"("organizationId", "recurrenceStatus");

-- CreateIndex
CREATE INDEX "CorrectiveAction_organizationId_findingId_idx" ON "CorrectiveAction"("organizationId", "findingId");

-- CreateIndex
CREATE INDEX "CorrectiveAction_organizationId_status_dueAt_idx" ON "CorrectiveAction"("organizationId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "CorrectiveAction_organizationId_assignedToUserId_idx" ON "CorrectiveAction"("organizationId", "assignedToUserId");

-- CreateIndex
CREATE INDEX "ActionEvidence_organizationId_correctiveActionId_idx" ON "ActionEvidence"("organizationId", "correctiveActionId");

-- CreateIndex
CREATE INDEX "InspectionAlert_organizationId_status_createdAt_idx" ON "InspectionAlert"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "InspectionAlert_organizationId_type_idx" ON "InspectionAlert"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionAlert_findingId_type_key" ON "InspectionAlert"("findingId", "type");

-- AddForeignKey
ALTER TABLE "WorkArea" ADD CONSTRAINT "WorkArea_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkArea" ADD CONSTRAINT "WorkArea_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inspectorUserId_fkey" FOREIGN KEY ("inspectorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "InspectionFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEvidence" ADD CONSTRAINT "ActionEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEvidence" ADD CONSTRAINT "ActionEvidence_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEvidence" ADD CONSTRAINT "ActionEvidence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionAlert" ADD CONSTRAINT "InspectionAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionAlert" ADD CONSTRAINT "InspectionAlert_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "InspectionFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionAlert" ADD CONSTRAINT "InspectionAlert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
