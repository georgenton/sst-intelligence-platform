CREATE TYPE "OperationalSignalType" AS ENUM ('REPEATED_FINDING', 'OVERDUE_ACTION_CLUSTER');
CREATE TYPE "OperationalSignalStatus" AS ENUM ('ACTIVE', 'REVIEWED', 'CLOSED');
CREATE TYPE "OperationalSignalAttention" AS ENUM ('REVIEW', 'PRIORITY_REVIEW');

CREATE TABLE "OperationalSignal" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "workCenterId" UUID NOT NULL,
  "type" "OperationalSignalType" NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "explanation" VARCHAR(1000) NOT NULL,
  "attention" "OperationalSignalAttention" NOT NULL DEFAULT 'REVIEW',
  "status" "OperationalSignalStatus" NOT NULL DEFAULT 'ACTIVE',
  "ruleKey" VARCHAR(100) NOT NULL,
  "ruleVersion" VARCHAR(32) NOT NULL,
  "threshold" INTEGER NOT NULL,
  "observedCount" INTEGER NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "windowEnd" TIMESTAMP(3) NOT NULL,
  "sourceRecords" JSONB NOT NULL,
  "sourceDigest" VARCHAR(64) NOT NULL,
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById" UUID,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" VARCHAR(2000),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalSignal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OperationalSignal_threshold_check" CHECK ("threshold" > 0),
  CONSTRAINT "OperationalSignal_observed_count_check" CHECK ("observedCount" >= "threshold"),
  CONSTRAINT "OperationalSignal_window_check" CHECK ("windowStart" <= "windowEnd")
);

CREATE UNIQUE INDEX "OperationalSignal_organizationId_type_fingerprint_key"
  ON "OperationalSignal"("organizationId", "type", "fingerprint");
CREATE INDEX "OperationalSignal_organizationId_status_attention_lastDetectedAt_idx"
  ON "OperationalSignal"("organizationId", "status", "attention", "lastDetectedAt");
CREATE INDEX "OperationalSignal_organizationId_workCenterId_status_idx"
  ON "OperationalSignal"("organizationId", "workCenterId", "status");

ALTER TABLE "OperationalSignal"
  ADD CONSTRAINT "OperationalSignal_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalSignal"
  ADD CONSTRAINT "OperationalSignal_workCenterId_fkey"
  FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalSignal"
  ADD CONSTRAINT "OperationalSignal_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
