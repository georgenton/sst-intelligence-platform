# Paquete de decisiones para Anita

Este documento está escrito para una profesional SST. Cada punto se puede discutir en 2–5 minutos. Las prioridades `P0`, `P1` y `P2` son prioridades de revisión profesional, no severidad de software.

## Cómo leerlo

El sistema ya registra hechos, conserva históricos y muestra la fuente disponible. Las opciones siguientes son alternativas de criterio; no hay una respuesta recomendada por ingeniería. Elegir una opción puede cambiar etiquetas, orden de revisión, mappings o el texto de una explicación. No cambia el aislamiento por organización ni permite publicar una regla sin revisión.

## Decisiones profesionales

### PA-01 · A19: denominador y población móvil — P0

- **Estado actual:** el perfil conserva total organizacional, población asignada por centro, significado, periodo, cobertura y solapamiento. E-02 evita comparar nómina, presencia y asignación como si fueran la misma magnitud.
- **Qué hace hoy:** explica que `453` no es necesariamente la suma de `267 + 85` y permite aclarar datos; no inventa las 101 personas restantes ni transforma presencia en asignación.
- **Evidencia:** `docs/product/anita-baseline-b0/b2-reception-status.md`, fixture A19 y pruebas de `sst-assessment-presentation`.
- **Pregunta exacta:** ¿Qué denominador debe guiar la revisión inicial cuando total, asignación y presencia tienen periodos o coberturas diferentes?
- **Opciones:** (A) nómina activa; (B) asignación al centro; (C) presencia habitual; (D) pedir aclaración antes de cualquier conclusión.
- **Impacto:** cambia el texto de aclaración y la priorización de preguntas; no rellena datos faltantes.
- **¿Bloquea producción?:** NO. **¿Bloquea la revisión?:** SÍ.

### PA-02 · Actividad complementaria — P1

- **Estado actual:** actividad principal y complementaria son hechos independientes y opcionales.
- **Qué hace hoy:** puede usar la complementaria para contextualizar preguntas, pero no cambia regulación sin un mapping exacto aprobado.
- **Evidencia:** contratos del perfil B2 y captura de contexto A19.
- **Pregunta exacta:** ¿Qué formulación y ejemplos describen una actividad complementaria sin presentarla como una nueva obligación normativa?
- **Opciones:** (A) contexto operativo; (B) actividad secundaria con igual nivel; (C) solo texto libre; (D) pedir confirmación cuando pueda cambiar el peligro.
- **Impacto:** copy y orden de preguntas.
- **¿Bloquea producción?:** NO.

### PA-03 · Método de riesgo — P1

- **Estado actual:** los métodos muestran propósito, versión y fuente técnica; el método no se presenta como ley.
- **Qué hace hoy:** permite usar métodos disponibles y deja la interpretación profesional separada.
- **Pregunta exacta:** ¿Qué método y profundidad deben priorizarse por familia de peligro en el recorrido de inspección?
- **Opciones:** aprobar catálogo actual; escoger una referencia por familia; exigir revisión caso a caso.
- **Impacto:** selección de método y orden de inspección, sin convertir referencias en normativa.
- **¿Bloquea producción?:** NO.

### PA-04 · Mappings de inspección — P1

- **Estado actual:** Inspection Basis → recurso → mapping → criterio; los estándares sintéticos/extranjeros se distinguen de ley ecuatoriana.
- **Pregunta exacta:** ¿Qué mapping profesional debe usarse para cada dominio y qué evidencia mínima lo justifica?
- **Opciones:** aceptar mapping actual; corregir por dominio; dejar dominio sin mapping hasta disponer de criterio.
- **Impacto:** contenido del checklist y enlaces de fundamento.
- **¿Bloquea producción?:** NO para la infraestructura; SÍ para publicar mappings profesionales.

### PA-05 · EPP posición/riesgo/certificación — P1

- **Estado actual:** selección humana exacta, agregados, entrega, condición, reemplazo y Work Queue funcionan; `ERGONOMIC` y `OTHER` no producen candidatos automáticos.
- **Pregunta exacta:** ¿Qué términos y evidencia deben considerarse suficientes para asignar protección a cada posición y riesgo?
- **Opciones:** aprobar vocabulario actual; ampliar mappings explícitos; mantener selección manual sin candidato.
- **Impacto:** labels y mappings; no crea recomendaciones automáticas nuevas.
- **¿Bloquea producción?:** NO para el registro; SÍ para automatizar mappings nuevos.

### PA-06 · Incidentes/Ishikawa — P1

- **Estado actual:** factores, investigación, evidencia y categorías se registran; Ishikawa se presenta como estructura de análisis, no como causa raíz inferida.
- **Pregunta exacta:** ¿Qué factores y orden de revisión deben considerarse profesionales para una investigación?
- **Opciones:** aprobar categorías actuales; ajustar catálogo; exigir revisión manual antes de acción.
- **Impacto:** copy, orden y campos de investigación.
- **¿Bloquea producción?:** NO.

### PA-07 · Capacitación — P2

- **Estado actual:** la pantalla distingue necesidad interna, referencia regulatoria candidata, plan, incidente y observación; la regla de competencia/renovación permanece intacta.
- **Pregunta exacta:** ¿Qué procedencia debe aparecer primero cuando varias necesidades de capacitación coinciden?
- **Opciones:** riesgo/inspección; incidente/observación; requisito candidato; prioridad definida por responsable SST.
- **Impacto:** orden y labels, no el motor de competencia.
- **¿Bloquea producción?:** NO.

### PA-08 · Observaciones de seguridad — P2

- **Estado actual:** ubicación, responsable, evidencia y siguiente paso tienen campos separados; no existe QR público ni reporte anónimo.
- **Pregunta exacta:** ¿Qué lenguaje y umbral indican que una observación requiere acción inmediata o seguimiento?
- **Opciones:** aprobar copy; ajustar términos; siempre exigir revisión del responsable SST.
- **Impacto:** copy y estado de la cola.
- **¿Bloquea producción?:** NO.

### PA-09 · Psicosocial agregado — P1

- **Estado actual:** Programa → instrumento → ciclo agregado → informe → plan/follow-up. No se almacenan respuestas, puntajes ni enlaces psicosociales por trabajador.
- **Pregunta exacta:** ¿Qué alcance, instrumento y evidencia deben acompañar la interpretación del informe agregado?
- **Opciones:** aprobar ciclo actual; restringir dominios; exigir evidencia profesional antes del plan.
- **Impacto:** labels, evidencia y seguimiento; nunca datos individuales.
- **¿Bloquea producción?:** NO para el flujo técnico; SÍ para una interpretación profesional publicada.

## RuleDrafts sin publicar

Estas cinco fichas corresponden exactamente a los RuleDrafts de `regulatory/pilots/ec-mdt-2024-196-v1/rule-drafts.json` y a `docs/product/regulatory-foundation-r1/five-rule-decisions.md`. Todas conservan `TECHNICAL_REVIEW_PENDING`; ninguna opción publica una `RuleVersion`.

### PA-R01 · `MDT_2024_196_SST_RESPONSIBLE_REGISTRATION_RULE`

- **Source / unidad:** MDT-2024-196, Arts. 18–19.
- **Condition draft:** `totalWorkerCount >= 1`.
- **Estado:** `TECHNICAL_REVIEW_PENDING`; no existe `RuleVersion` publicada.
- **Qué produce actualmente:** un candidato explicable de `SST_RESPONSIBLE_REGISTRATION`, con el artículo localizado y revisión profesional requerida.
- **Qué no produce:** no afirma que la obligación esté publicada, no decide quién es el responsable ni certifica su registro.
- **Evidencia faltante:** Decreto 255 vigente y definición verificable del alcance, perfil y evidencia del responsable.
- **Pregunta exacta para Anita:** ¿El alcance, perfil y evidencia propuestos representan correctamente al responsable SST para organizaciones con al menos una persona trabajadora?
- **Opciones:** (A) mantener el alcance actual; (B) restringirlo por actividad o tamaño; (C) exigir evidencia adicional antes de mostrar el candidato; (D) conservar `NO_EXACT_SOURCE_MAPPING` hasta disponer de la fuente faltante.
- **Impacto:** cambia el alcance del candidato y la evidencia solicitada; no activa una obligación por sí solo.

### PA-R02 · `MDT_2024_196_PREVENTION_PLAN_1_TO_10_RULE`

- **Source / unidad:** MDT-2024-196, Art. 18.
- **Condition draft:** `1 <= totalWorkerCount <= 10`.
- **Estado:** `TECHNICAL_REVIEW_PENDING`; no existe `RuleVersion` publicada.
- **Qué produce actualmente:** un candidato explicable de `PREVENTION_PLAN_REGISTRATION` para la banda de 1 a 10 personas.
- **Qué no produce:** no calcula cumplimiento, no genera el procedimiento ni afirma que el contenido haya sido aprobado.
- **Evidencia faltante:** Decreto 255 y fuente/procedimiento SUT que permitan representar contenido, responsable y evidencia de registro.
- **Pregunta exacta para Anita:** ¿Qué procedimiento, contenido y evidencia hacen defendible este candidato para la banda de 1 a 10?
- **Opciones:** (A) mantener la condición y pedir evidencia documental; (B) ajustar el alcance del plan; (C) dejarlo como candidato informativo; (D) conservar `NO_EXACT_SOURCE_MAPPING` hasta verificar Decreto 255/SUT.
- **Impacto:** define la evidencia y el texto operativo del candidato; no publica una obligación automáticamente.

### PA-R03 · `MDT_2024_196_HYGIENE_SAFETY_REGULATION_GT_10_RULE`

- **Source / unidad:** MDT-2024-196, Art. 19.
- **Condition draft:** `totalWorkerCount >= 11`.
- **Estado:** `TECHNICAL_REVIEW_PENDING`; no existe `RuleVersion` publicada.
- **Qué produce actualmente:** un candidato explicable de `HYGIENE_SAFETY_REGULATION_REGISTRATION` para organizaciones de más de 10 personas.
- **Qué no produce:** no declara que exista una relación normativa completa ni convierte una referencia técnica en ley.
- **Evidencia faltante:** relación exacta Decreto 255 / Anexo 3 / SUT, incluida la unidad aplicable y su evidencia.
- **Pregunta exacta para Anita:** ¿La relación entre Decreto 255, Anexo 3 y SUT sustenta este alcance y qué evidencia debe solicitarse?
- **Opciones:** (A) aceptar la relación propuesta; (B) corregir la unidad o el alcance; (C) mostrar solo la fuente localizada; (D) conservar `NO_EXACT_SOURCE_MAPPING` hasta verificar la relación completa.
- **Impacto:** cambia el vínculo documental y el checklist asociado; no publica la regla.

### PA-R04 · `MDT_2024_196_PSYCHOSOCIAL_PROGRAM_GT_10_RULE`

- **Source / unidad:** MDT-2024-196, Art. 19.
- **Condition draft:** `totalWorkerCount >= 11`.
- **Estado:** `TECHNICAL_REVIEW_PENDING`; no existe `RuleVersion` publicada.
- **Qué produce actualmente:** un candidato explicable de `PSYCHOSOCIAL_PROGRAM_REGISTRATION` para organizaciones de más de 10 personas.
- **Qué no produce:** no interpreta resultados psicosociales, no crea datos individuales y no publica la regla automáticamente.
- **Evidencia faltante:** confirmación del alcance técnico/profesional del programa y la evidencia requerida; las fuentes B3A pueden informarlo, pero no sustituyen la revisión del RuleDraft.
- **Pregunta exacta para Anita:** ¿Qué alcance técnico, evidencia y límites profesionales debe tener este programa agregado para este umbral?
- **Opciones:** (A) mantener el alcance agregado; (B) restringir dominios o ciclo; (C) exigir evidencia profesional antes del plan; (D) conservar `NO_EXACT_SOURCE_MAPPING` hasta cerrar la interpretación.
- **Impacto:** afecta alcance, evidencia y explicación del programa; mantiene la frontera aggregate-only.

### PA-R05 · `MDT_2024_196_ANNUAL_TRAINING_PLAN_GT_10_RULE`

- **Source / unidad:** MDT-2024-196, Art. 19, más contexto CAN cuando corresponda.
- **Condition draft:** `totalWorkerCount >= 11`.
- **Estado:** `TECHNICAL_REVIEW_PENDING`; no existe `RuleVersion` publicada.
- **Qué produce actualmente:** un candidato explicable de `ANNUAL_TRAINING_PLAN_REGISTRATION` para organizaciones de más de 10 personas.
- **Qué no produce:** no decide competencia profesional, frecuencia válida ni cumplimiento del plan.
- **Evidencia faltante:** fuente oficial que sustente contenido, frecuencia y evidencia del plan.
- **Pregunta exacta para Anita:** ¿Qué contenido, frecuencia y evidencia deben respaldar el plan anual de capacitación en este contexto?
- **Opciones:** (A) aceptar el alcance actual y pedir evidencia; (B) ajustar contenido o frecuencia; (C) mantenerlo como necesidad candidata; (D) conservar `NO_EXACT_SOURCE_MAPPING` hasta verificar la fuente oficial.
- **Impacto:** cambia la prioridad y evidencia de capacitación; no publica una obligación.

En cada ficha se registrará después la unidad exacta, texto permitido, ambigüedad, decisión, fecha y profesional que la tomó. Hasta entonces `RuleVersions publicadas=0`.

## SISAT: bloqueo externo, no decisión inventada

`B3.1_STATUS=BLOCKED_EXTERNAL_SOURCE`. Falta el artefacto oficial completo del Segundo Suplemento No. 304 o MSP 00004-2026. Cuando llegue, se registrarán hash, bytes, páginas, unidades y provenance antes de discutir interpretación. No se usa un mirror ni una conversación como fuente jurídica.
