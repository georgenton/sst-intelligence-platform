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

Los cinco borradores siguen en revisión técnica/profesional. Para cada ficha, la pregunta es si el criterio propuesto representa fielmente la unidad oficial y su contexto; ninguna opción publica automáticamente.

| ID     | Tema y fuente                                     | Condition propuesta / inputs                                     | Produce hoy                               | No produce                              | Pregunta exacta                                                | Impacto                   |
| ------ | ------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------- | --------------------------------------- | -------------------------------------------------------------- | ------------------------- |
| PA-R01 | Organización y centro · Anexo 3 MDT-2024-196      | Hechos declarados de organización/centro y contexto de actividad | Candidato explicable y artículo vinculado | No afirma obligación legal              | ¿El alcance y la población son suficientes para este criterio? | Publicar o mantener draft |
| PA-R02 | Gestión de riesgos · unidad oficial verificada    | Existencia de riesgo y evidencia de organización                 | Requisito candidato con revisión          | No calcula cumplimiento                 | ¿Qué evidencia mínima hace defendible la interpretación?       | Criterio y evidencia      |
| PA-R03 | Inspección · unidad oficial/mapping técnico       | Dominio, recurso y profundidad seleccionados                     | Criterio de inspección trazable           | No convierte estándar extranjero en ley | ¿El mapping aplica al dominio y jurisdicción?                  | Mapping operativo         |
| PA-R04 | Capacitación · unidad oficial verificada          | Necesidad/rol/actividad registrada                               | Necesidad de capacitación candidata       | No decide competencia profesional       | ¿Qué orden y alcance debe tener la capacitación?               | Prioridad y copy          |
| PA-R05 | Seguimiento/evidencia · unidad oficial verificada | Estado declarado, evidencia y acción                             | Requisito candidato y deep link           | No certifica cierre                     | ¿Qué evidencia permite considerar el seguimiento suficiente?   | Workflow y evidencia      |

En cada ficha se debe registrar: artículo/unidad exacta, texto oficial permitido, ambigüedad, decisión, fecha y profesional que la tomó. Hasta entonces `RuleVersions publicadas=0`.

## SISAT: bloqueo externo, no decisión inventada

`B3.1_STATUS=BLOCKED_EXTERNAL_SOURCE`. Falta el artefacto oficial completo del Segundo Suplemento No. 304 o MSP 00004-2026. Cuando llegue, se registrarán hash, bytes, páginas, unidades y provenance antes de discutir interpretación. No se usa un mirror ni una conversación como fuente jurídica.
