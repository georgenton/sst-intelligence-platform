CREATE TYPE "WorkerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "Worker" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "displayName" VARCHAR(200) NOT NULL,
    "internalCode" VARCHAR(80),
    "status" "WorkerStatus" NOT NULL DEFAULT 'ACTIVE',
    "workCenterId" UUID,
    "jobTitle" VARCHAR(200),
    "linkedUserId" UUID,
    "startDate" DATE,
    "endDate" DATE,
    "notes" VARCHAR(2000),
    "createdById" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Worker_organizationId_internalCode_key" ON "Worker"("organizationId", "internalCode");
CREATE UNIQUE INDEX "Worker_organizationId_linkedUserId_key" ON "Worker"("organizationId", "linkedUserId");
CREATE INDEX "Worker_organizationId_status_displayName_idx" ON "Worker"("organizationId", "status", "displayName");
CREATE INDEX "Worker_organizationId_workCenterId_status_idx" ON "Worker"("organizationId", "workCenterId", "status");
CREATE INDEX "Worker_organizationId_linkedUserId_idx" ON "Worker"("organizationId", "linkedUserId");

ALTER TABLE "Worker" ADD CONSTRAINT "Worker_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
