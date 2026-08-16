CREATE TYPE "ApplicabilityState" AS ENUM (
  'MANDATORY',
  'RECOMMENDED',
  'OPTIONAL',
  'NOT_APPLICABLE',
  'NEEDS_INFORMATION',
  'NEEDS_EXPERT_REVIEW'
);
CREATE TYPE "ApplicabilityRulePackStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');
CREATE TYPE "ApplicabilitySourceType" AS ENUM ('DEMO', 'REGULATORY', 'STANDARD', 'INTERNAL');
CREATE TYPE "ApplicabilityRuleResult" AS ENUM ('TRUE', 'FALSE', 'MISSING');

CREATE TABLE "OrganizationSstProfileVersion" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationSstProfileVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationSstProfileVersion_version_check" CHECK ("version" > 0)
);

CREATE TABLE "ApplicabilityRulePackVersion" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "schema" JSONB NOT NULL,
  "status" "ApplicabilityRulePackStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceType" "ApplicabilitySourceType" NOT NULL,
  "sourceReference" TEXT,
  "regulatory" BOOLEAN NOT NULL DEFAULT false,
  "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "disclaimer" TEXT NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicabilityRulePackVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApplicabilityRulePackVersion_demo_check"
    CHECK (NOT ("sourceType" = 'DEMO' AND ("regulatory" OR NOT "isDemo")))
);

CREATE TABLE "ApplicabilityAssessment" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "profileVersionId" UUID NOT NULL,
  "rulePackVersionId" UUID NOT NULL,
  "profileSnapshot" JSONB NOT NULL,
  "rulePackSnapshot" JSONB NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "createdById" UUID NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicabilityAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicabilityDecision" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "assessmentId" UUID NOT NULL,
  "targetKey" TEXT NOT NULL,
  "state" "ApplicabilityState" NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "sourceType" "ApplicabilitySourceType" NOT NULL,
  "sourceReference" TEXT,
  "winningRuleId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicabilityDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicabilityEvaluationTrace" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "assessmentId" UUID NOT NULL,
  "decisionId" UUID NOT NULL,
  "ruleId" TEXT NOT NULL,
  "targetKey" TEXT NOT NULL,
  "composition" TEXT NOT NULL,
  "ruleResult" "ApplicabilityRuleResult" NOT NULL,
  "configuredState" "ApplicabilityState" NOT NULL,
  "contributedState" "ApplicabilityState",
  "reasonCode" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "predicates" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicabilityEvaluationTrace_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApplicabilityEvaluationTrace_composition_check" CHECK ("composition" IN ('ALL', 'ANY'))
);

CREATE UNIQUE INDEX "OrganizationSstProfileVersion_organizationId_version_key"
  ON "OrganizationSstProfileVersion"("organizationId", "version");
CREATE INDEX "OrganizationSstProfileVersion_organizationId_createdAt_idx"
  ON "OrganizationSstProfileVersion"("organizationId", "createdAt");
CREATE UNIQUE INDEX "ApplicabilityRulePackVersion_key_version_key"
  ON "ApplicabilityRulePackVersion"("key", "version");
CREATE INDEX "ApplicabilityRulePackVersion_status_key_idx"
  ON "ApplicabilityRulePackVersion"("status", "key");
CREATE INDEX "ApplicabilityAssessment_organizationId_createdAt_idx"
  ON "ApplicabilityAssessment"("organizationId", "createdAt");
CREATE INDEX "ApplicabilityAssessment_organizationId_profileVersionId_idx"
  ON "ApplicabilityAssessment"("organizationId", "profileVersionId");
CREATE INDEX "ApplicabilityAssessment_rulePackVersionId_idx"
  ON "ApplicabilityAssessment"("rulePackVersionId");
CREATE UNIQUE INDEX "ApplicabilityDecision_assessmentId_targetKey_key"
  ON "ApplicabilityDecision"("assessmentId", "targetKey");
CREATE INDEX "ApplicabilityDecision_organizationId_state_idx"
  ON "ApplicabilityDecision"("organizationId", "state");
CREATE UNIQUE INDEX "ApplicabilityEvaluationTrace_assessmentId_ruleId_key"
  ON "ApplicabilityEvaluationTrace"("assessmentId", "ruleId");
CREATE INDEX "ApplicabilityEvaluationTrace_organizationId_assessmentId_idx"
  ON "ApplicabilityEvaluationTrace"("organizationId", "assessmentId");
CREATE INDEX "ApplicabilityEvaluationTrace_decisionId_idx"
  ON "ApplicabilityEvaluationTrace"("decisionId");

ALTER TABLE "OrganizationSstProfileVersion"
  ADD CONSTRAINT "OrganizationSstProfileVersion_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationSstProfileVersion"
  ADD CONSTRAINT "OrganizationSstProfileVersion_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicabilityAssessment"
  ADD CONSTRAINT "ApplicabilityAssessment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicabilityAssessment"
  ADD CONSTRAINT "ApplicabilityAssessment_profileVersionId_fkey"
  FOREIGN KEY ("profileVersionId") REFERENCES "OrganizationSstProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicabilityAssessment"
  ADD CONSTRAINT "ApplicabilityAssessment_rulePackVersionId_fkey"
  FOREIGN KEY ("rulePackVersionId") REFERENCES "ApplicabilityRulePackVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicabilityAssessment"
  ADD CONSTRAINT "ApplicabilityAssessment_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicabilityDecision"
  ADD CONSTRAINT "ApplicabilityDecision_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicabilityDecision"
  ADD CONSTRAINT "ApplicabilityDecision_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "ApplicabilityAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicabilityEvaluationTrace"
  ADD CONSTRAINT "ApplicabilityEvaluationTrace_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicabilityEvaluationTrace"
  ADD CONSTRAINT "ApplicabilityEvaluationTrace_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "ApplicabilityAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicabilityEvaluationTrace"
  ADD CONSTRAINT "ApplicabilityEvaluationTrace_decisionId_fkey"
  FOREIGN KEY ("decisionId") REFERENCES "ApplicabilityDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Global synthetic reference data is provisioned by `prisma migrate deploy` so
-- production does not depend on the development seed lifecycle.
INSERT INTO "ApplicabilityRulePackVersion" (
  "id",
  "key",
  "name",
  "version",
  "schema",
  "status",
  "sourceType",
  "sourceReference",
  "regulatory",
  "isDemo",
  "disclaimer",
  "activatedAt",
  "createdAt"
)
VALUES (
  '4e32fe7a-492d-4247-9413-f12ccf36b117'::uuid,
  'DEMO_APPLICABILITY',
  'Configuración SST demostrativa',
  '1.0.0',
  '{
    "schemaVersion": "1.0.0",
    "key": "DEMO_APPLICABILITY",
    "name": "Configuración SST demostrativa",
    "version": "1.0.0",
    "source": {
      "type": "DEMO",
      "reference": "Contenido sintético SST Intelligence Platform"
    },
    "regulatory": false,
    "isDemo": true,
    "disclaimer": "Reglas sintéticas de demostración. No representan normativa ni acreditan cumplimiento legal.",
    "rules": [
      {
        "id": "DEMO_BASELINE_MANDATORY",
        "targetKey": "DEMO_BASELINE_MANAGEMENT",
        "condition": {"mode": "ALL", "predicates": [{"field": "organization.workCenterCount", "operator": "NUMBER_GTE", "value": 1}]},
        "state": "MANDATORY",
        "reasonCode": "DEMO_BASELINE_PRESENT",
        "explanation": "La demostración incluye una configuración base cuando existe un centro."
      },
      {
        "id": "DEMO_MULTI_SITE_RECOMMENDED",
        "targetKey": "DEMO_MULTI_SITE_COORDINATION",
        "condition": {"mode": "ALL", "predicates": [{"field": "organization.workCenterCount", "operator": "NUMBER_GTE", "value": 2}]},
        "state": "RECOMMENDED",
        "reasonCode": "DEMO_MULTIPLE_WORK_CENTERS",
        "explanation": "La demostración recomienda coordinación cuando hay varios centros."
      },
      {
        "id": "DEMO_SECTOR_OPTIONAL",
        "targetKey": "DEMO_SECTOR_GUIDANCE",
        "condition": {"mode": "ANY", "predicates": [{"field": "organization.sector", "operator": "IN", "values": ["Servicios", "Tecnología"]}]},
        "state": "OPTIONAL",
        "reasonCode": "DEMO_SECTOR_MATCH",
        "explanation": "La demostración ofrece una guía opcional para sectores de ejemplo."
      },
      {
        "id": "DEMO_CHEMICAL_MANDATORY",
        "targetKey": "DEMO_CHEMICAL_CONTROL",
        "condition": {"mode": "ALL", "predicates": [{"field": "operations.hasChemicalProcesses", "operator": "BOOLEAN_IS", "value": true}]},
        "state": "MANDATORY",
        "reasonCode": "DEMO_CHEMICAL_PROCESS_PRESENT",
        "explanation": "La regla sintética activa el control demostrativo para este escenario."
      },
      {
        "id": "DEMO_CHEMICAL_NOT_APPLICABLE",
        "targetKey": "DEMO_CHEMICAL_CONTROL",
        "condition": {"mode": "ALL", "predicates": [{"field": "operations.hasChemicalProcesses", "operator": "BOOLEAN_IS", "value": false}]},
        "state": "NOT_APPLICABLE",
        "reasonCode": "DEMO_NO_CHEMICAL_PROCESS",
        "explanation": "La regla sintética no aplica el control cuando el proceso no está presente."
      },
      {
        "id": "DEMO_HIGH_ENERGY_EXPERT",
        "targetKey": "DEMO_HIGH_ENERGY_REVIEW",
        "condition": {"mode": "ALL", "predicates": [{"field": "operations.hasHighEnergyOperations", "operator": "BOOLEAN_IS", "value": true}]},
        "state": "NEEDS_EXPERT_REVIEW",
        "reasonCode": "DEMO_HIGH_ENERGY_SCENARIO",
        "explanation": "El escenario sintético requiere revisión profesional antes de una conclusión."
      },
      {
        "id": "DEMO_HIGH_ENERGY_NOT_APPLICABLE",
        "targetKey": "DEMO_HIGH_ENERGY_REVIEW",
        "condition": {"mode": "ALL", "predicates": [{"field": "operations.hasHighEnergyOperations", "operator": "BOOLEAN_IS", "value": false}]},
        "state": "NOT_APPLICABLE",
        "reasonCode": "DEMO_NO_HIGH_ENERGY_OPERATION",
        "explanation": "El escenario sintético no solicita revisión cuando la operación no está presente."
      },
      {
        "id": "DEMO_WORKFORCE_RECOMMENDED",
        "targetKey": "DEMO_WORKFORCE_GUIDANCE",
        "condition": {"mode": "ALL", "predicates": [{"field": "organization.workerCount", "operator": "NUMBER_GTE", "value": 20}]},
        "state": "RECOMMENDED",
        "reasonCode": "DEMO_WORKFORCE_THRESHOLD",
        "explanation": "La demostración recomienda una guía al alcanzar su umbral puramente sintético."
      }
    ]
  }'::jsonb,
  'ACTIVE'::"ApplicabilityRulePackStatus",
  'DEMO'::"ApplicabilitySourceType",
  'Contenido sintético SST Intelligence Platform',
  false,
  true,
  'Reglas sintéticas de demostración. No representan normativa ni acreditan cumplimiento legal.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key", "version") DO NOTHING;
