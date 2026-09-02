CREATE TYPE "GovernanceBodyCategory" AS ENUM ('COMMITTEE', 'WORK_GROUP', 'SAFETY_MEETING', 'OTHER');
CREATE TYPE "GovernanceBodyStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "GovernanceMeetingStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'HELD', 'CANCELLED');
CREATE TYPE "GovernanceMeetingMode" AS ENUM ('IN_PERSON', 'VIRTUAL', 'HYBRID');
CREATE TYPE "GovernanceActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "GovernanceEvidenceType" AS ENUM ('NOTE', 'EXTERNAL_LINK');

CREATE TABLE "GovernanceBody" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "workCenterId" UUID,
    "name" VARCHAR(200) NOT NULL,
    "category" "GovernanceBodyCategory" NOT NULL,
    "status" "GovernanceBodyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GovernanceBody_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GovernanceMember" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "bodyId" UUID NOT NULL,
    "workerId" UUID,
    "membershipId" UUID,
    "roleLabel" VARCHAR(160),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GovernanceMember_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GovernanceMember_reference_check" CHECK ("workerId" IS NOT NULL OR "membershipId" IS NOT NULL)
);

CREATE TABLE "GovernanceMeeting" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "bodyId" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "status" "GovernanceMeetingStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "heldAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "mode" "GovernanceMeetingMode" NOT NULL,
    "location" VARCHAR(300),
    "notes" VARCHAR(4000),
    "chairMembershipId" UUID,
    "secretaryMembershipId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GovernanceMeeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GovernanceMeetingParticipant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "meetingId" UUID NOT NULL,
    "governanceMemberId" UUID NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GovernanceMeetingParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GovernanceAgendaItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "meetingId" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "notes" VARCHAR(2000),
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GovernanceAgendaItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GovernanceDecision" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "meetingId" UUID NOT NULL,
    "agendaItemId" UUID,
    "summary" VARCHAR(2000) NOT NULL,
    "rationale" VARCHAR(2000),
    "regulatoryUnitId" UUID,
    "requirementId" UUID,
    "regulatorySnapshot" JSONB NOT NULL DEFAULT '{}',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GovernanceDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GovernanceAction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "decisionId" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "description" VARCHAR(2000),
    "status" "GovernanceActionStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedToMembershipId" UUID,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GovernanceAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GovernanceEvidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "meetingId" UUID,
    "decisionId" UUID,
    "actionId" UUID,
    "type" "GovernanceEvidenceType" NOT NULL,
    "note" VARCHAR(2000),
    "externalUrl" VARCHAR(1000),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GovernanceEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GovernanceEvidence_target_check" CHECK (num_nonnulls("meetingId", "decisionId", "actionId") = 1),
    CONSTRAINT "GovernanceEvidence_content_check" CHECK (
      ("type" = 'NOTE' AND "note" IS NOT NULL AND "externalUrl" IS NULL) OR
      ("type" = 'EXTERNAL_LINK' AND "externalUrl" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "GovernanceBody_organizationId_name_key" ON "GovernanceBody"("organizationId", "name");
CREATE INDEX "GovernanceBody_organizationId_status_createdAt_idx" ON "GovernanceBody"("organizationId", "status", "createdAt");
CREATE INDEX "GovernanceBody_organizationId_workCenterId_status_idx" ON "GovernanceBody"("organizationId", "workCenterId", "status");
CREATE UNIQUE INDEX "GovernanceMember_bodyId_workerId_key" ON "GovernanceMember"("bodyId", "workerId");
CREATE UNIQUE INDEX "GovernanceMember_bodyId_membershipId_key" ON "GovernanceMember"("bodyId", "membershipId");
CREATE INDEX "GovernanceMember_organizationId_bodyId_isActive_idx" ON "GovernanceMember"("organizationId", "bodyId", "isActive");
CREATE INDEX "GovernanceMember_organizationId_workerId_idx" ON "GovernanceMember"("organizationId", "workerId");
CREATE INDEX "GovernanceMember_organizationId_membershipId_idx" ON "GovernanceMember"("organizationId", "membershipId");
CREATE INDEX "GovernanceMeeting_organizationId_status_scheduledAt_idx" ON "GovernanceMeeting"("organizationId", "status", "scheduledAt");
CREATE INDEX "GovernanceMeeting_organizationId_bodyId_scheduledAt_idx" ON "GovernanceMeeting"("organizationId", "bodyId", "scheduledAt");
CREATE UNIQUE INDEX "GovernanceMeetingParticipant_meetingId_governanceMemberId_key" ON "GovernanceMeetingParticipant"("meetingId", "governanceMemberId");
CREATE INDEX "GovernanceMeetingParticipant_organizationId_meetingId_idx" ON "GovernanceMeetingParticipant"("organizationId", "meetingId");
CREATE UNIQUE INDEX "GovernanceAgendaItem_meetingId_sortOrder_key" ON "GovernanceAgendaItem"("meetingId", "sortOrder");
CREATE INDEX "GovernanceAgendaItem_organizationId_meetingId_idx" ON "GovernanceAgendaItem"("organizationId", "meetingId");
CREATE INDEX "GovernanceDecision_organizationId_meetingId_createdAt_idx" ON "GovernanceDecision"("organizationId", "meetingId", "createdAt");
CREATE INDEX "GovernanceDecision_regulatoryUnitId_idx" ON "GovernanceDecision"("regulatoryUnitId");
CREATE INDEX "GovernanceDecision_requirementId_idx" ON "GovernanceDecision"("requirementId");
CREATE INDEX "GovernanceAction_organizationId_status_dueAt_idx" ON "GovernanceAction"("organizationId", "status", "dueAt");
CREATE INDEX "GovernanceAction_organizationId_assignedToMembershipId_status_idx" ON "GovernanceAction"("organizationId", "assignedToMembershipId", "status");
CREATE INDEX "GovernanceAction_organizationId_decisionId_idx" ON "GovernanceAction"("organizationId", "decisionId");
CREATE INDEX "GovernanceEvidence_organizationId_meetingId_createdAt_idx" ON "GovernanceEvidence"("organizationId", "meetingId", "createdAt");
CREATE INDEX "GovernanceEvidence_organizationId_decisionId_createdAt_idx" ON "GovernanceEvidence"("organizationId", "decisionId", "createdAt");
CREATE INDEX "GovernanceEvidence_organizationId_actionId_createdAt_idx" ON "GovernanceEvidence"("organizationId", "actionId", "createdAt");

ALTER TABLE "GovernanceBody" ADD CONSTRAINT "GovernanceBody_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceBody" ADD CONSTRAINT "GovernanceBody_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceBody" ADD CONSTRAINT "GovernanceBody_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceMember" ADD CONSTRAINT "GovernanceMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceMember" ADD CONSTRAINT "GovernanceMember_bodyId_fkey" FOREIGN KEY ("bodyId") REFERENCES "GovernanceBody"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceMember" ADD CONSTRAINT "GovernanceMember_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceMember" ADD CONSTRAINT "GovernanceMember_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceMeeting" ADD CONSTRAINT "GovernanceMeeting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceMeeting" ADD CONSTRAINT "GovernanceMeeting_bodyId_fkey" FOREIGN KEY ("bodyId") REFERENCES "GovernanceBody"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceMeeting" ADD CONSTRAINT "GovernanceMeeting_chairMembershipId_fkey" FOREIGN KEY ("chairMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceMeeting" ADD CONSTRAINT "GovernanceMeeting_secretaryMembershipId_fkey" FOREIGN KEY ("secretaryMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceMeeting" ADD CONSTRAINT "GovernanceMeeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceMeetingParticipant" ADD CONSTRAINT "GovernanceMeetingParticipant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceMeetingParticipant" ADD CONSTRAINT "GovernanceMeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "GovernanceMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceMeetingParticipant" ADD CONSTRAINT "GovernanceMeetingParticipant_governanceMemberId_fkey" FOREIGN KEY ("governanceMemberId") REFERENCES "GovernanceMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceAgendaItem" ADD CONSTRAINT "GovernanceAgendaItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceAgendaItem" ADD CONSTRAINT "GovernanceAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "GovernanceMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceDecision" ADD CONSTRAINT "GovernanceDecision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceDecision" ADD CONSTRAINT "GovernanceDecision_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "GovernanceMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceDecision" ADD CONSTRAINT "GovernanceDecision_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "GovernanceAgendaItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceDecision" ADD CONSTRAINT "GovernanceDecision_regulatoryUnitId_fkey" FOREIGN KEY ("regulatoryUnitId") REFERENCES "RegulatoryUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceDecision" ADD CONSTRAINT "GovernanceDecision_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "RegulatoryRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceDecision" ADD CONSTRAINT "GovernanceDecision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceAction" ADD CONSTRAINT "GovernanceAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceAction" ADD CONSTRAINT "GovernanceAction_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "GovernanceDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceAction" ADD CONSTRAINT "GovernanceAction_assignedToMembershipId_fkey" FOREIGN KEY ("assignedToMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceAction" ADD CONSTRAINT "GovernanceAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceEvidence" ADD CONSTRAINT "GovernanceEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceEvidence" ADD CONSTRAINT "GovernanceEvidence_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "GovernanceMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceEvidence" ADD CONSTRAINT "GovernanceEvidence_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "GovernanceDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceEvidence" ADD CONSTRAINT "GovernanceEvidence_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "GovernanceAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceEvidence" ADD CONSTRAINT "GovernanceEvidence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
