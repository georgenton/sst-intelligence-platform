-- Correct independently verified vigencia metadata without changing any official artifact or unit.
ALTER TABLE "RegulatorySourceVersion" DISABLE TRIGGER "RegulatorySourceVersion_immutable";

UPDATE "RegulatorySourceVersion" AS version
SET
  "vigenciaReviewStatus" = 'REPEALED'::"RegulatoryVigenciaReviewStatus",
  "reviewNotes" = CASE
    WHEN version."catalogVersion" = 2 THEN
      'La derogación por C.D. 677 está confirmada por el artefacto oficial IESS. C.D. 517 se conserva como identidad y versión histórica, no como texto vigente.'
    ELSE
      'Registro histórico: la Disposición Derogatoria Única de C.D. 677 derogó expresamente el Reglamento General de Responsabilidad Patronal contenido en C.D. 517.'
  END
FROM "RegulatorySource" AS source
WHERE version."sourceId" = source."id"
  AND source."sourceKey" = 'EC_IESS_CD_517';

ALTER TABLE "RegulatorySourceVersion" ENABLE TRIGGER "RegulatorySourceVersion_immutable";

UPDATE "RegulatorySourceRelationship"
SET
  "reviewStatus" = 'CONFIRMED'::"RegulatoryRelationshipReviewStatus",
  "notes" = 'La Disposición Derogatoria Única de la Resolución IESS C.D. 677 deroga expresamente el Reglamento General de Responsabilidad Patronal contenido en la Resolución C.D. 517. C.D. 677 entra en vigencia desde su aprobación el 2 de octubre de 2024, sin perjuicio de su publicación en el Registro Oficial.'
WHERE "id" = 'a3000000-0000-4000-8000-000000000001';
