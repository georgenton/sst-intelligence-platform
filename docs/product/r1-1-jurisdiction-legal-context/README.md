# R1.1 · Contexto jurídico seguro por jurisdicción

R1.1 añade contexto jurídico trazable a la Evaluación SST sin convertir una
respuesta de contexto en una conclusión de cumplimiento. El runtime solo
resuelve fuentes verificadas cuando el país confirmado es Ecuador (`EC`).

## Comportamiento

- Ecuador muestra el fundamento oficial solo para los mapeos documentados en
  [legal-basis-matrix.md](./legal-basis-matrix.md).
- Colombia y cualquier otra jurisdicción mantienen la evaluación operativa,
  pero muestran que todavía no existe cobertura normativa verificada. No se
  consulta ni se muestra una norma de otro país.
- Si el país aún no está confirmado, la interfaz pide ese contexto y no
  emite una fuente.
- Una base jurídica aparece en un `<details>` cerrado y conserva título,
  emisor, referencia, unidades, localizador y enlace oficial.
- Al cambiar el país, la base se recalcula desde los hechos actuales para no
  conservar por error una fuente de Ecuador en otra jurisdicción. Los hechos
  de la evaluación no se eliminan.

## Estado de la fundación regulatoria

R1.1 no publica reglas nuevas. Las cinco `RuleDraft` siguen pendientes y el
runtime mantiene cero `RuleVersion` reales publicadas. El texto de la interfaz
es orientación trazable; no acredita cumplimiento legal ni sustituye la
revisión profesional.

## Validación y límites

La implementación reutiliza el corpus oficial versionado y sus unidades
existentes. No añade migraciones, no usa una semilla de desarrollo para
resolver el contexto y no cambia el catálogo de reglas. Las comprobaciones
de base de datos y previews se reportan con el SHA exacto de la Draft PR.
