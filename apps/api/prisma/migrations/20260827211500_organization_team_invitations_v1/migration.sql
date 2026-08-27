CREATE TYPE "OrganizationInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

DROP INDEX "OrganizationInvitation_organizationId_email_key";
DROP INDEX "OrganizationInvitation_organizationId_expiresAt_idx";

ALTER TABLE "OrganizationInvitation"
  RENAME COLUMN "email" TO "emailNormalized";

ALTER TABLE "OrganizationInvitation"
  ADD COLUMN "status" "OrganizationInvitationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "pendingKey" VARCHAR(400),
  ADD COLUMN "invitedByUserId" UUID,
  ADD COLUMN "acceptedByUserId" UUID,
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "OrganizationInvitation"
SET "emailNormalized" = LOWER(TRIM("emailNormalized"));

UPDATE "OrganizationInvitation"
SET "status" = CASE
  WHEN "acceptedAt" IS NOT NULL THEN 'ACCEPTED'::"OrganizationInvitationStatus"
  WHEN "expiresAt" <= CURRENT_TIMESTAMP THEN 'EXPIRED'::"OrganizationInvitationStatus"
  ELSE 'PENDING'::"OrganizationInvitationStatus"
END;

UPDATE "OrganizationInvitation" AS invitation
SET "invitedByUserId" = (
  SELECT membership."userId"
  FROM "Membership" AS membership
  WHERE membership."organizationId" = invitation."organizationId"
    AND membership."role" = 'ORG_OWNER'
    AND membership."status" = 'ACTIVE'
  ORDER BY membership."createdAt" ASC
  LIMIT 1
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "OrganizationInvitation"
    WHERE "invitedByUserId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot migrate OrganizationInvitation without an active organization owner';
  END IF;
END $$;

UPDATE "OrganizationInvitation" AS invitation
SET "acceptedByUserId" = matching_user."id"
FROM "User" AS matching_user
WHERE invitation."status" = 'ACCEPTED'
  AND LOWER(matching_user."email") = invitation."emailNormalized";

UPDATE "OrganizationInvitation"
SET "pendingKey" = "organizationId"::text || ':' || "emailNormalized"
WHERE "status" = 'PENDING';

ALTER TABLE "OrganizationInvitation"
  ALTER COLUMN "emailNormalized" TYPE VARCHAR(320),
  ALTER COLUMN "tokenHash" TYPE VARCHAR(64),
  ALTER COLUMN "invitedByUserId" SET NOT NULL;

CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key"
  ON "OrganizationInvitation"("tokenHash");
CREATE UNIQUE INDEX "OrganizationInvitation_pendingKey_key"
  ON "OrganizationInvitation"("pendingKey");
CREATE INDEX "OrganizationInvitation_organizationId_status_expiresAt_idx"
  ON "OrganizationInvitation"("organizationId", "status", "expiresAt");
CREATE INDEX "OrganizationInvitation_organizationId_emailNormalized_createdAt_idx"
  ON "OrganizationInvitation"("organizationId", "emailNormalized", "createdAt");

ALTER TABLE "OrganizationInvitation"
  ADD CONSTRAINT "OrganizationInvitation_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvitation"
  ADD CONSTRAINT "OrganizationInvitation_acceptedByUserId_fkey"
  FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
