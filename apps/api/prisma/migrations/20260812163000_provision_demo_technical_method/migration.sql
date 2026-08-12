-- Global demo methods are reference data required by every deployed environment.
-- Keep this provisioning under `prisma migrate deploy`; the general development
-- seed is intentionally not part of the Railway production lifecycle.
INSERT INTO "TechnicalMethodDefinition" (
  "id",
  "organizationId",
  "key",
  "name",
  "description",
  "category",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  '22956729-30c7-48b0-9422-7312911c5a74'::uuid,
  NULL,
  'DEMO_TECHNICAL_RISK',
  'Evaluación técnica demostrativa',
  'Método sintético para demostrar evaluaciones técnicas determinísticas y versionadas.',
  'GENERAL_RISK',
  'ACTIVE'::"TechnicalMethodStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "TechnicalMethodDefinition"
  WHERE "organizationId" IS NULL
    AND "key" = 'DEMO_TECHNICAL_RISK'
);

UPDATE "TechnicalMethodDefinition"
SET
  "name" = 'Evaluación técnica demostrativa',
  "description" = 'Método sintético para demostrar evaluaciones técnicas determinísticas y versionadas.',
  "category" = 'GENERAL_RISK',
  "status" = 'ACTIVE'::"TechnicalMethodStatus",
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "organizationId" IS NULL
  AND "key" = 'DEMO_TECHNICAL_RISK';

INSERT INTO "TechnicalMethodVersion" (
  "id",
  "organizationId",
  "methodDefinitionId",
  "version",
  "schema",
  "calculationKey",
  "regulatory",
  "isDemo",
  "disclaimer",
  "country",
  "validFrom",
  "validTo",
  "status",
  "createdAt"
)
SELECT
  '29a41255-f372-4769-b4c6-49b37830e65d'::uuid,
  NULL,
  definition."id",
  '1.0.0',
  '{
    "sections": [
      {
        "key": "context",
        "title": "Contexto",
        "questions": [
          {
            "key": "activityDescription",
            "label": "Descripción de la actividad",
            "type": "TEXT",
            "required": true,
            "maxLength": 2000
          },
          {
            "key": "existingControls",
            "label": "Controles existentes",
            "type": "TEXT",
            "required": false,
            "maxLength": 2000
          }
        ]
      },
      {
        "key": "evaluation",
        "title": "Evaluación",
        "questions": [
          {
            "key": "likelihood",
            "label": "Probabilidad",
            "type": "LIKELIHOOD",
            "required": true,
            "min": 1,
            "max": 5
          },
          {
            "key": "consequence",
            "label": "Consecuencia",
            "type": "CONSEQUENCE",
            "required": true,
            "min": 1,
            "max": 5
          }
        ]
      }
    ]
  }'::jsonb,
  'DEMO_TECHNICAL_RISK_5X5',
  false,
  true,
  'Metodología demostrativa. No constituye una evaluación regulatoria validada.',
  NULL,
  NULL,
  NULL,
  'ACTIVE'::"TechnicalMethodStatus",
  CURRENT_TIMESTAMP
FROM "TechnicalMethodDefinition" AS definition
WHERE definition."organizationId" IS NULL
  AND definition."key" = 'DEMO_TECHNICAL_RISK'
  AND NOT EXISTS (
    SELECT 1
    FROM "TechnicalMethodVersion" AS version
    WHERE version."methodDefinitionId" = definition."id"
      AND version."version" = '1.0.0'
  );

UPDATE "TechnicalMethodVersion" AS version
SET
  "isDemo" = true,
  "disclaimer" = 'Metodología demostrativa. No constituye una evaluación regulatoria validada.',
  "status" = 'ACTIVE'::"TechnicalMethodStatus"
FROM "TechnicalMethodDefinition" AS definition
WHERE version."methodDefinitionId" = definition."id"
  AND definition."organizationId" IS NULL
  AND definition."key" = 'DEMO_TECHNICAL_RISK'
  AND version."version" = '1.0.0';
