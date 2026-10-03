# Hoja de revisión de Anita

Esta hoja separa los hechos técnicos comprobados de las decisiones humanas. Un
resultado técnico PASS no significa aprobación profesional ni publicación normativa.

## Evidencia técnica de la entrega

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Verificador de staging | PASS | `demo:anita:verify` → `FINAL=PASS`, lectura autenticada, datos sintéticos |
| Organización | PASS | SST Intelligence — Revisión Anita; Ecuador; perfil completo |
| Topología | PASS | 453 total; 267 Quito; 85 Guayaquil; 101 sin centro inventado |
| Evaluación | PASS | Sesión finalizada, hechos conservados, `UNKNOWN` separado de `NO` |
| Plan y Cola | PASS | Plan activo con seis actividades y deep links canónicos |
| Inspecciones | PASS | Tres registros eléctricos demostrativos con hallazgo, acción y evidencia |
| EPP | PASS | Selección humana, requisito, entrega, acuse, condición y reemplazo histórico |
| Capacitación | PASS | Necesidad, sesión, asistencia PRESENT y completitud |
| Incidente | PASS | NEAR_MISS, persona involucrada, investigación, factor, acción y evidencia |
| Observación | PASS | Registro independiente del incidente y del finding |
| Salud / Psicosocial | PASS | Programa, actividad y ciclo agregado vinculados al plan; sin datos individuales |
| Capturas | PASS | 30 imágenes: 26 desktop y 4 mobile; HTTP 200 y assertions de contenido |
| Producción | NO TOCADA | Sin escrituras, deploy ni credenciales productivas |

## Cómo usar la hoja

Para cada fila, abre la pantalla indicada, responde la pregunta con criterio
profesional y escribe una nota breve. No es necesario aprobar una regla ni conocer
la implementación técnica.

**Decisión / feedback:** `Accept / Adjust / Need more evidence` + comentario.

## PA-01 a PA-11

| ID | Pregunta profesional | Pantalla | Qué inspeccionar | Decisión / feedback |
|---|---|---|---|---|
| PA-01 | ¿Es comprensible la diferencia entre 453 personas, 267 en Quito, 85 en Guayaquil y 101 sin centro? | Evaluación SST | Denominador, centros activos, personas sin asignación y lenguaje `UNKNOWN` / `NO`. | ______________________________ |
| PA-02 | ¿La actividad principal y la complementaria orientan preguntas sin inferir una obligación? | Evaluación SST / Organización | Actividad, sector, centros y explicación del contexto. | ______________________________ |
| PA-03 | ¿El método y la profundidad son adecuados para cada familia de peligro? | Inspecciones / Riesgo técnico / Métodos | Método, versión, inputs, resultado y diferencia entre método y ley. | ______________________________ |
| PA-04 | ¿El mapping de recurso, estándar, base y criterio es defendible antes de publicarlo? | Inspecciones / Configuración | Recurso inspeccionado, versión, provenance, resultado, finding y evidencia. | ______________________________ |
| PA-05 | ¿El flujo de EPP comunica que la selección es humana y conserva entrega, condición y reemplazo? | Protección personal | Cargo, riesgo, candidato, `ERGONOMIC` / `OTHER`, entrega, acuse e histórico. | ______________________________ |
| PA-06 | ¿Factores, ubicación y orden de investigación están expresados sin convertir un factor en causa raíz? | Incidentes | Casi incidente, trabajador involucrado, factores, acción y evidencia. | ______________________________ |
| PA-07 | ¿La prioridad entre necesidad, origen, plan, incidente y observación refleja el trabajo de capacitación? | Capacitación / Plan | Necesidad por cargo, audiencia, sesión, asistencia, completitud y renovación. | ______________________________ |
| PA-08 | ¿La Observación de seguridad se distingue de un Incidente y de un Hallazgo? | Observaciones / Cola | Umbral, prioridad, evidencia, siguiente paso y deep link a la fuente. | ______________________________ |
| PA-09 | ¿El alcance de Salud y Psicosocial es preventivo y agregado, sin respuestas o resultados individuales? | Salud en el trabajo / Psicosocial | Programa, instrumento, participación agregada, informe y vínculo al plan. | ______________________________ |
| PA-10 | ¿Qué evidencia falta para decidir cada borrador normativo por separado? | Biblioteca normativa | Fuente, versión, unidad, condición, `RuleDraft` y ausencia de `RuleVersion`. | ______________________________ |
| PA-11 | ¿La explicación de SISAT comunica con claridad que el artefacto oficial exacto aún no está estructurado? | Biblioteca normativa / explicación de SISAT | Referencia identificada, fuente faltante y límite de lo ejecutable. | ______________________________ |

### PA-R01…PA-R05: cinco decisiones concretas

Estas fichas son independientes. Anita no está aprobando “la regulación en general”.
La decisión se registra por unidad y no publica una versión normativa automáticamente.

| ID de revisión | Título humano | Pregunta concreta | Evidencia o decisión que falta | Feedback |
|---|---|---|---|---|
| PA-R01 | Responsible SST registration | ¿El alcance, perfil y evidencia propuestos representan al responsable SST para una organización con al menos una persona trabajadora? | Verificar Decreto 255 y definir alcance, perfil y evidencia; conservar `NO_EXACT_SOURCE_MAPPING` si no hay mapeo exacto. | ______________________________ |
| PA-R02 | Prevention Plan 1–10 | ¿Qué procedimiento, contenido y evidencia hacen defendible el plan para la banda de 1 a 10 personas? | Verificar Decreto 255 y procedimiento SUT; decidir condición y evidencia. | ______________________________ |
| PA-R03 | Hygiene and Safety Regulation >10 | ¿La relación entre Decreto 255, Anexo 3 y SUT sustenta el alcance para más de 10 personas? | Verificar unidad exacta y relación documental; no convertir una referencia técnica en ley. | ______________________________ |
| PA-R04 | Psychosocial Program >10 | ¿Qué alcance agregado, evidencia y límites profesionales debe tener el programa para este umbral? | Confirmar interpretación; mantener frontera aggregate-only y `NO_EXACT_SOURCE_MAPPING` cuando corresponda. | ______________________________ |
| PA-R05 | Annual Training Plan >10 | ¿Qué contenido, frecuencia y evidencia deben respaldar el plan anual en este contexto? | Verificar una fuente oficial para contenido, frecuencia y evidencia. | ______________________________ |

**Anita's observation:** ______________________

**Accept / Adjust / Need more evidence:** ______________________

**Suggested wording or criterion:** ______________________

## Revisión de acceso y experiencia

| Punto | Pregunta | Resultado / nota |
|---|---|---|
| Organización | ¿La sesión abre en SST Intelligence — Revisión Anita? | ______________________________ |
| Datos | ¿El banner identifica datos sintéticos? | ______________________________ |
| Navegación | ¿El menú permite volver a la fuente de cada tarjeta? | ______________________________ |
| Móvil | ¿Inicio, Evaluación, EPP y Cola se leen a 390 px sin overflow horizontal? | ______________________________ |
| Roles | ¿VIEWER basta para observar y SST_MANAGER queda reservado al taller interactivo? | ______________________________ |

## Estados que usa esta entrega

- ✅ **Listo para revisar**
- 🟡 **Necesita criterio profesional**
- ⛔ **Bloqueado por fuente**
- ⚪ **Fuera de esta revisión**

No usar “compliant”, “certified”, “legal OK” o “aprobado por Anita” sin una decisión real.

## Anexo técnico para Jorge

La pantalla y la hoja anterior mantienen cinco borradores y cero versiones publicadas.
Los identificadores internos se conservan aquí para que el seguimiento no se mezcle con
el lenguaje de Anita:

- PA-R01 — `MDT_2024_196_SST_RESPONSIBLE_REGISTRATION_RULE` — Arts. 18–19; condición draft `totalWorkerCount >= 1`.
- PA-R02 — `MDT_2024_196_PREVENTION_PLAN_1_TO_10_RULE` — Art. 18; condición draft `1 <= totalWorkerCount <= 10`.
- PA-R03 — `MDT_2024_196_HYGIENE_SAFETY_REGULATION_GT_10_RULE` — Art. 19; condición draft `totalWorkerCount >= 11`.
- PA-R04 — `MDT_2024_196_PSYCHOSOCIAL_PROGRAM_GT_10_RULE` — Art. 19; condición draft `totalWorkerCount >= 11`.
- PA-R05 — `MDT_2024_196_ANNUAL_TRAINING_PLAN_GT_10_RULE` — Art. 19 y contexto CAN cuando corresponda; condición draft `totalWorkerCount >= 11`.

Todos mantienen `TECHNICAL_REVIEW_PENDING`. No se fabrican aprobaciones y no se
crea una `RuleVersion` mientras no exista provenance exacta y una decisión registrada.
