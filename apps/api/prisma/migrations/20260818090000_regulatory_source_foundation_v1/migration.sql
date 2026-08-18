CREATE TYPE "RegulatoryDocumentType" AS ENUM (
  'MINISTERIAL_AGREEMENT',
  'ANNEX',
  'EXECUTIVE_DECREE',
  'CODE',
  'RESOLUTION',
  'REGULATION',
  'OTHER'
);

CREATE TYPE "RegulatoryCandidateStatus" AS ENUM (
  'DISCOVERED',
  'OFFICIAL_DOCUMENT_LOCATED',
  'SUPERSESSION_REVIEW_REQUIRED',
  'TECHNICAL_REVIEW_PENDING',
  'LEGAL_REVIEW_PENDING',
  'APPROVED_FOR_EXTRACTION',
  'APPROVED_FOR_RULES',
  'SUPERSEDED',
  'REJECTED_REFERENCE'
);

CREATE TYPE "RegulatorySupersessionStatus" AS ENUM (
  'UNKNOWN_REVIEW_REQUIRED',
  'CURRENT_VERSION_NOT_ESTABLISHED',
  'UNVERIFIED_REFERENCE',
  'RELATION_REVIEW_REQUIRED',
  'NO_KNOWN_RELATION_RECORDED'
);

CREATE TYPE "RegulatoryRelationshipType" AS ENUM (
  'POSSIBLE_SUPERSESSION',
  'POSSIBLE_AMENDMENT',
  'POSSIBLE_REPLACEMENT',
  'RELATED_REFERENCE'
);

CREATE TYPE "RegulatoryRelationshipReviewStatus" AS ENUM (
  'PENDING_REVIEW',
  'CONFIRMED',
  'REJECTED'
);

CREATE TABLE "RegulatorySource" (
  "id" UUID NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "countryCode" CHAR(2) NOT NULL,
  "issuer" TEXT NOT NULL,
  "documentType" "RegulatoryDocumentType" NOT NULL,
  "referenceNumber" TEXT NOT NULL,
  "canonicalTitle" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatorySource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatorySourceVersion" (
  "id" UUID NOT NULL,
  "sourceId" UUID NOT NULL,
  "catalogVersion" INTEGER NOT NULL,
  "candidateStatus" "RegulatoryCandidateStatus" NOT NULL,
  "officialDocumentLocated" BOOLEAN NOT NULL DEFAULT false,
  "officialUrl" TEXT,
  "publicationDate" DATE,
  "effectiveFrom" DATE,
  "effectiveTo" DATE,
  "supersessionStatus" "RegulatorySupersessionStatus" NOT NULL,
  "readyForExtraction" BOOLEAN NOT NULL DEFAULT false,
  "readyForRules" BOOLEAN NOT NULL DEFAULT false,
  "reviewNotes" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatorySourceVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RegulatorySourceVersion_catalogVersion_check" CHECK ("catalogVersion" > 0)
);

CREATE TABLE "RegulatorySourceRelationship" (
  "id" UUID NOT NULL,
  "fromSourceId" UUID NOT NULL,
  "toSourceId" UUID NOT NULL,
  "relationshipType" "RegulatoryRelationshipType" NOT NULL,
  "reviewStatus" "RegulatoryRelationshipReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatorySourceRelationship_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RegulatorySourceRelationship_distinct_sources_check" CHECK ("fromSourceId" <> "toSourceId")
);

CREATE UNIQUE INDEX "RegulatorySource_sourceKey_key" ON "RegulatorySource"("sourceKey");
CREATE INDEX "RegulatorySource_countryCode_issuer_idx" ON "RegulatorySource"("countryCode", "issuer");
CREATE INDEX "RegulatorySource_documentType_idx" ON "RegulatorySource"("documentType");
CREATE UNIQUE INDEX "RegulatorySourceVersion_sourceId_catalogVersion_key" ON "RegulatorySourceVersion"("sourceId", "catalogVersion");
CREATE INDEX "RegulatorySourceVersion_candidateStatus_recordedAt_idx" ON "RegulatorySourceVersion"("candidateStatus", "recordedAt");
CREATE INDEX "RegulatorySourceVersion_sourceId_recordedAt_idx" ON "RegulatorySourceVersion"("sourceId", "recordedAt");
CREATE UNIQUE INDEX "RegulatorySourceRelationship_fromSourceId_toSourceId_relationshipType_key"
  ON "RegulatorySourceRelationship"("fromSourceId", "toSourceId", "relationshipType");
CREATE INDEX "RegulatorySourceRelationship_fromSourceId_reviewStatus_idx"
  ON "RegulatorySourceRelationship"("fromSourceId", "reviewStatus");
CREATE INDEX "RegulatorySourceRelationship_toSourceId_reviewStatus_idx"
  ON "RegulatorySourceRelationship"("toSourceId", "reviewStatus");

ALTER TABLE "RegulatorySourceVersion"
  ADD CONSTRAINT "RegulatorySourceVersion_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "RegulatorySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RegulatorySourceRelationship"
  ADD CONSTRAINT "RegulatorySourceRelationship_fromSourceId_fkey"
  FOREIGN KEY ("fromSourceId") REFERENCES "RegulatorySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RegulatorySourceRelationship"
  ADD CONSTRAINT "RegulatorySourceRelationship_toSourceId_fkey"
  FOREIGN KEY ("toSourceId") REFERENCES "RegulatorySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "prevent_regulatory_source_version_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'RegulatorySourceVersion rows are immutable; create the next catalogVersion';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RegulatorySourceVersion_immutable"
BEFORE UPDATE OR DELETE ON "RegulatorySourceVersion"
FOR EACH ROW EXECUTE FUNCTION "prevent_regulatory_source_version_mutation"();

CREATE FUNCTION "prevent_regulatory_source_key_change"()
RETURNS trigger AS $$
BEGIN
  IF NEW."sourceKey" <> OLD."sourceKey" THEN
    RAISE EXCEPTION 'RegulatorySource.sourceKey is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RegulatorySource_sourceKey_immutable"
BEFORE UPDATE OF "sourceKey" ON "RegulatorySource"
FOR EACH ROW EXECUTE FUNCTION "prevent_regulatory_source_key_change"();

INSERT INTO "RegulatorySource" (
  "id", "sourceKey", "countryCode", "issuer", "documentType", "referenceNumber",
  "canonicalTitle", "createdAt", "updatedAt"
)
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'EC_MDT_2024_196', 'EC', 'Ministerio del Trabajo', 'MINISTERIAL_AGREEMENT', 'MDT-2024-196', 'Acuerdo Ministerial Nro. MDT-2024-196', '2026-08-18T00:00:00Z', '2026-08-18T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000002', 'EC_MDT_2024_196_ANNEX_1', 'EC', 'Ministerio del Trabajo', 'ANNEX', 'MDT-2024-196-ANEXO-1', 'Anexo 1 — Lista de Verificación SST', '2026-08-18T00:00:00Z', '2026-08-18T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000003', 'EC_MDT_2024_196_ANNEX_2', 'EC', 'Ministerio del Trabajo', 'ANNEX', 'MDT-2024-196-ANEXO-2', 'Anexo 2 — Nivel de Riesgo', '2026-08-18T00:00:00Z', '2026-08-18T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000004', 'EC_MDT_2024_196_ANNEX_3', 'EC', 'Ministerio del Trabajo', 'ANNEX', 'MDT-2024-196-ANEXO-3', 'Anexo 3 — Norma Técnica de Seguridad e Higiene en el Trabajo', '2026-08-18T00:00:00Z', '2026-08-18T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000005', 'EC_EXECUTIVE_DECREE_255', 'EC', 'Presidencia de la República del Ecuador', 'EXECUTIVE_DECREE', '255', 'Reglamento de Seguridad y Salud en el Trabajo', '2026-08-18T00:00:00Z', '2026-08-18T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000006', 'EC_MSP_00004_2026_SISAT', 'EC', 'Ministerio de Salud Pública', 'MINISTERIAL_AGREEMENT', '00004-2026', 'Acuerdo MSP 00004-2026 — SISAT', '2026-08-18T00:00:00Z', '2026-08-18T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000007', 'EC_LABOR_CODE', 'EC', 'Estado ecuatoriano / Ministerio del Trabajo como repositorio oficial', 'CODE', 'CODIGO_DEL_TRABAJO', 'Código del Trabajo', '2026-08-18T00:00:00Z', '2026-08-18T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000008', 'EC_IESS_CD_513', 'EC', 'Instituto Ecuatoriano de Seguridad Social', 'RESOLUTION', 'C.D. 513', 'Reglamento del Seguro General de Riesgos del Trabajo', '2026-08-18T00:00:00Z', '2026-08-18T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000009', 'EC_IESS_CD_517', 'EC', 'Instituto Ecuatoriano de Seguridad Social', 'RESOLUTION', 'C.D. 517', 'Reglamento General de Responsabilidad Patronal', '2026-08-18T00:00:00Z', '2026-08-18T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000010', 'EC_IESS_CD_527_INTERVIEW_REFERENCE', 'EC', 'Desconocido — referencia de entrevista', 'OTHER', 'C.D. 527', 'C.D. 527 — título no verificado', '2026-08-18T00:00:00Z', '2026-08-18T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000011', 'EC_IESS_CD_677', 'EC', 'Instituto Ecuatoriano de Seguridad Social', 'RESOLUTION', 'C.D. 677', 'Reglamento General de Responsabilidad Patronal', '2026-08-18T00:00:00Z', '2026-08-18T00:00:00Z');

INSERT INTO "RegulatorySourceVersion" (
  "id", "sourceId", "catalogVersion", "candidateStatus", "officialDocumentLocated",
  "officialUrl", "publicationDate", "effectiveFrom", "effectiveTo", "supersessionStatus",
  "readyForExtraction", "readyForRules", "reviewNotes", "recordedAt"
)
VALUES
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 1, 'TECHNICAL_REVIEW_PENDING', true, 'https://www.trabajo.gob.ec/wp-content/uploads/2024/10/ACUERDO-MINISTERIAL-NRO.-MDT-2024-196-signed.pdf', NULL, NULL, NULL, 'UNKNOWN_REVIEW_REQUIRED', false, false, 'Documento firmado localizado; requiere revisión técnica y jurídica.', '2026-08-18T00:00:00Z'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 1, 'TECHNICAL_REVIEW_PENDING', true, 'https://www.trabajo.gob.ec/wp-content/uploads/2025/04/Anexo-1_Lista-de-Verificacion-SST-signed-signed_08042025.pdf', NULL, NULL, NULL, 'UNKNOWN_REVIEW_REQUIRED', false, false, 'Documento oficial localizado; no se extrajeron preguntas ni obligaciones.', '2026-08-18T00:00:00Z'),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', 1, 'OFFICIAL_DOCUMENT_LOCATED', true, 'https://www.trabajo.gob.ec/normativa-legal-programas-formatos-y-guias/', NULL, NULL, NULL, 'UNKNOWN_REVIEW_REQUIRED', false, false, 'El índice oficial enumera el anexo; falta fijar archivo y versión.', '2026-08-18T00:00:00Z'),
  ('a2000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000004', 1, 'OFFICIAL_DOCUMENT_LOCATED', true, 'https://www.trabajo.gob.ec/normativa-legal-programas-formatos-y-guias/', NULL, NULL, NULL, 'UNKNOWN_REVIEW_REQUIRED', false, false, 'El índice oficial enumera el anexo; falta fijar documento, versión y alcance.', '2026-08-18T00:00:00Z'),
  ('a2000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000005', 1, 'TECHNICAL_REVIEW_PENDING', true, 'https://www.trabajo.gob.ec/reglamento-de-seguridad-y-salud-en-el-trabajo/', NULL, NULL, NULL, 'UNKNOWN_REVIEW_REQUIRED', false, false, 'Documento candidato localizado; publicación y efecto requieren revisión formal.', '2026-08-18T00:00:00Z'),
  ('a2000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000006', 1, 'DISCOVERED', false, NULL, NULL, NULL, NULL, 'UNKNOWN_REVIEW_REQUIRED', false, false, 'Referencia candidata para investigación; no usar para extracción ni reglas.', '2026-08-18T00:00:00Z'),
  ('a2000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000007', 1, 'LEGAL_REVIEW_PENDING', true, 'https://www.trabajo.gob.ec/wp-content/uploads/downloads/2024/01/CODIGO_DEL_TRABAJO.pdf', NULL, NULL, NULL, 'CURRENT_VERSION_NOT_ESTABLISHED', false, false, 'Copia localizada; consolidación y reformas aplicables requieren revisión jurídica.', '2026-08-18T00:00:00Z'),
  ('a2000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000008', 1, 'DISCOVERED', false, NULL, NULL, NULL, NULL, 'UNKNOWN_REVIEW_REQUIRED', false, false, 'Debe localizarse y fijarse el documento fuente exacto.', '2026-08-18T00:00:00Z'),
  ('a2000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-000000000009', 1, 'SUPERSESSION_REVIEW_REQUIRED', true, 'https://www.iess.gob.ec/es/resoluciones?_110_INSTANCE_Pl7m_fileEntryId=6949406', NULL, NULL, NULL, 'RELATION_REVIEW_REQUIRED', false, false, 'Documento histórico localizado; su relación con C.D. 677 requiere revisión formal.', '2026-08-18T00:00:00Z'),
  ('a2000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000010', 1, 'REJECTED_REFERENCE', false, NULL, NULL, NULL, NULL, 'UNVERIFIED_REFERENCE', false, false, 'Referencia no verificada; no renombrar ni utilizar para reglas.', '2026-08-18T00:00:00Z'),
  ('a2000000-0000-4000-8000-000000000011', 'a1000000-0000-4000-8000-000000000011', 1, 'SUPERSESSION_REVIEW_REQUIRED', true, 'https://www.iess.gob.ec/documents/10162/33703/C.D.%2B677', NULL, NULL, NULL, 'RELATION_REVIEW_REQUIRED', false, false, 'Documento localizado; su relación con C.D. 517 requiere revisión formal.', '2026-08-18T00:00:00Z');

INSERT INTO "RegulatorySourceRelationship" (
  "id", "fromSourceId", "toSourceId", "relationshipType", "reviewStatus", "notes", "createdAt"
)
VALUES (
  'a3000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000009',
  'a1000000-0000-4000-8000-000000000011',
  'POSSIBLE_SUPERSESSION',
  'PENDING_REVIEW',
  'Relación pendiente de revisión formal; no establece cuál documento controla.',
  '2026-08-18T00:00:00Z'
);
