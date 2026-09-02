ALTER TABLE "GovernanceMember"
  ADD COLUMN "personKey" VARCHAR(80);

UPDATE "GovernanceMember" AS member
SET "personKey" = CASE
  WHEN member."workerId" IS NOT NULL AND (
    SELECT worker."linkedUserId"
    FROM "Worker" AS worker
    WHERE worker."id" = member."workerId"
  ) IS NOT NULL
    THEN 'USER:' || (
      SELECT worker."linkedUserId"::text
      FROM "Worker" AS worker
      WHERE worker."id" = member."workerId"
    )
  WHEN member."membershipId" IS NOT NULL
    THEN 'USER:' || (
      SELECT membership."userId"::text
      FROM "Membership" AS membership
      WHERE membership."id" = member."membershipId"
    )
  ELSE 'WORKER:' || member."workerId"::text
END;

ALTER TABLE "GovernanceMember"
  ALTER COLUMN "personKey" SET NOT NULL;

CREATE UNIQUE INDEX "GovernanceMember_bodyId_personKey_key"
  ON "GovernanceMember"("bodyId", "personKey");

ALTER TABLE "GovernanceMeetingParticipant"
  ADD COLUMN "personKeySnapshot" VARCHAR(80),
  ADD COLUMN "displayNameSnapshot" VARCHAR(200),
  ADD COLUMN "roleLabelSnapshot" VARCHAR(160);

UPDATE "GovernanceMeetingParticipant" AS participant
SET
  "personKeySnapshot" = member."personKey",
  "displayNameSnapshot" = COALESCE(
    (
      SELECT worker."displayName"
      FROM "Worker" AS worker
      WHERE worker."id" = member."workerId"
    ),
    (
      SELECT app_user."displayName"
      FROM "Membership" AS membership
      JOIN "User" AS app_user ON app_user."id" = membership."userId"
      WHERE membership."id" = member."membershipId"
    ),
    'Participante histórico'
  ),
  "roleLabelSnapshot" = member."roleLabel"
FROM "GovernanceMember" AS member
WHERE member."id" = participant."governanceMemberId";

ALTER TABLE "GovernanceMeetingParticipant"
  ALTER COLUMN "personKeySnapshot" SET NOT NULL,
  ALTER COLUMN "displayNameSnapshot" SET NOT NULL;

CREATE UNIQUE INDEX "GovernanceMeetingParticipant_meetingId_personKeySnapshot_key"
  ON "GovernanceMeetingParticipant"("meetingId", "personKeySnapshot");

CREATE OR REPLACE FUNCTION "protect_finalized_evidence_package"()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" IN ('FINALIZED', 'ARCHIVED') THEN
    IF NOT (
      OLD."status" = 'FINALIZED'
      AND NEW."status" = 'ARCHIVED'
      AND OLD."archivedAt" IS NULL
      AND NEW."archivedAt" IS NOT NULL
      AND NEW."id" = OLD."id"
      AND NEW."organizationId" = OLD."organizationId"
      AND NEW."title" = OLD."title"
      AND NEW."scope" = OLD."scope"
      AND NEW."version" = OLD."version"
      AND NEW."generatedAt" IS NOT DISTINCT FROM OLD."generatedAt"
      AND NEW."generatedById" IS NOT DISTINCT FROM OLD."generatedById"
      AND NEW."finalizedAt" IS NOT DISTINCT FROM OLD."finalizedAt"
      AND NEW."manifest" IS NOT DISTINCT FROM OLD."manifest"
      AND NEW."manifestDigest" IS NOT DISTINCT FROM OLD."manifestDigest"
      AND NEW."createdById" = OLD."createdById"
      AND NEW."createdAt" = OLD."createdAt"
    ) THEN
      RAISE EXCEPTION 'Finalized evidence package manifest is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
