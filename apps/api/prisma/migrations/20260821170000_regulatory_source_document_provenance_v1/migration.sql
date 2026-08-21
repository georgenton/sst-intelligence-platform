ALTER TABLE "RegulatorySourceVersion"
  ADD COLUMN "officialDocumentSha256" VARCHAR(71),
  ADD COLUMN "officialDocumentRetrievedAt" TIMESTAMP(3),
  ADD COLUMN "officialDocumentMediaType" VARCHAR(100),
  ADD COLUMN "officialPublicationReference" VARCHAR(500);

ALTER TABLE "RegulatorySourceVersion"
  ADD CONSTRAINT "RegulatorySourceVersion_officialDocumentSha256_check"
  CHECK (
    "officialDocumentSha256" IS NULL
    OR "officialDocumentSha256" ~ '^sha256:[0-9a-f]{64}$'
  );
