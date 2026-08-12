ALTER TABLE "TechnicalMethodVersion"
ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "disclaimer" TEXT;

UPDATE "TechnicalMethodVersion" AS version
SET
  "isDemo" = true,
  "disclaimer" = 'Metodología demostrativa. No constituye una evaluación regulatoria validada.'
FROM "TechnicalMethodDefinition" AS definition
WHERE version."methodDefinitionId" = definition."id"
  AND definition."key" = 'DEMO_TECHNICAL_RISK'
  AND version."version" = '1.0.0';
