CREATE TYPE "ConversationMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM_EVENT');
CREATE TYPE "ConversationActionStatus" AS ENUM ('AWAITING_CONFIRMATION', 'EXECUTING', 'SUCCEEDED', 'FAILED', 'REJECTED');
CREATE TYPE "ConversationConfirmationState" AS ENUM ('NOT_REQUIRED', 'PENDING', 'CONFIRMED', 'REJECTED');
CREATE TYPE "ConversationCitationType" AS ENUM ('INSPECTION_BASIS_VERSION', 'INSPECTION_STANDARD_VERSION', 'INSPECTION_STANDARD_CRITERION', 'REGULATORY_UNIT', 'ORGANIZATION_POLICY', 'FINDING', 'ACTION', 'WORK_ITEM');

CREATE TABLE "ConversationThread" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT,
    "contextType" TEXT,
    "contextId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConversationThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationMessage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "authorUserId" UUID,
    "role" "ConversationMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "structuredData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationActionRun" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "messageId" UUID,
    "actorUserId" UUID NOT NULL,
    "actionKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestDigest" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "status" "ConversationActionStatus" NOT NULL,
    "confirmationState" "ConversationConfirmationState" NOT NULL,
    "result" JSONB,
    "resultType" TEXT,
    "resultId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConversationActionRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationCitation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "type" "ConversationCitationType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "deepLink" TEXT,
    "sourceSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationCitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationAttachmentReference" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "actionRunId" UUID,
    "createdById" UUID NOT NULL,
    "destinationType" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationAttachmentReference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConversationThread_organizationId_userId_updatedAt_idx" ON "ConversationThread"("organizationId", "userId", "updatedAt");
CREATE INDEX "ConversationThread_organizationId_contextType_contextId_idx" ON "ConversationThread"("organizationId", "contextType", "contextId");
CREATE INDEX "ConversationMessage_organizationId_threadId_createdAt_idx" ON "ConversationMessage"("organizationId", "threadId", "createdAt");
CREATE UNIQUE INDEX "ConversationActionRun_organizationId_idempotencyKey_key" ON "ConversationActionRun"("organizationId", "idempotencyKey");
CREATE INDEX "ConversationActionRun_organizationId_threadId_createdAt_idx" ON "ConversationActionRun"("organizationId", "threadId", "createdAt");
CREATE INDEX "ConversationActionRun_organizationId_status_idx" ON "ConversationActionRun"("organizationId", "status");
CREATE INDEX "ConversationCitation_organizationId_messageId_idx" ON "ConversationCitation"("organizationId", "messageId");
CREATE INDEX "ConversationCitation_type_referenceId_idx" ON "ConversationCitation"("type", "referenceId");
CREATE INDEX "ConversationAttachmentReference_organizationId_destinationType_destinationId_idx" ON "ConversationAttachmentReference"("organizationId", "destinationType", "destinationId");
CREATE INDEX "ConversationAttachmentReference_messageId_idx" ON "ConversationAttachmentReference"("messageId");

ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ConversationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationActionRun" ADD CONSTRAINT "ConversationActionRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationActionRun" ADD CONSTRAINT "ConversationActionRun_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ConversationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationActionRun" ADD CONSTRAINT "ConversationActionRun_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ConversationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationActionRun" ADD CONSTRAINT "ConversationActionRun_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConversationCitation" ADD CONSTRAINT "ConversationCitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationCitation" ADD CONSTRAINT "ConversationCitation_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ConversationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationAttachmentReference" ADD CONSTRAINT "ConversationAttachmentReference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationAttachmentReference" ADD CONSTRAINT "ConversationAttachmentReference_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ConversationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationAttachmentReference" ADD CONSTRAINT "ConversationAttachmentReference_actionRunId_fkey" FOREIGN KEY ("actionRunId") REFERENCES "ConversationActionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationAttachmentReference" ADD CONSTRAINT "ConversationAttachmentReference_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
