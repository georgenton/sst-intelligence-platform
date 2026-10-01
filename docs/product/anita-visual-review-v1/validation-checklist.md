# Checklist de validación profesional y técnica

Esta checklist separa hechos técnicos comprobados de decisiones humanas pendientes. “PASS técnico” no significa “aprobado por Anita”.

## Evidencia técnica de esta entrega

| Comprobación                                             | Resultado                     | Evidencia                                                                                                                         |
| -------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Rama parte de `81e6daa9fb803f4691703cbc1eed76042cbc4402` | PASS                          | `git rev-parse HEAD` antes de cambios                                                                                             |
| Fixture staging-only                                     | PASS                          | `tools/anita-review/provision-staging.mjs`; guarda explícita y bloqueo de señales productivas                                     |
| Organización sintética                                   | PASS                          | Nombre, Ecuador, sector, perfil FULL; lectura autenticada de staging                                                              |
| Topología                                                | PASS                           | 453 total; 267 Quito; 85 Guayaquil; 101 sin centro. El contador del inicio filtra los dos centros activos; los históricos permanecen recuperables. |
| Evaluación SST                                           | PASS                          | Sesión pública finalizada por el flujo canónico; hechos preservados; no respuestas clínicas                                       |
| Plan                                                     | PASS                          | Seis ítems, versión activa, provenance manual y ejecuciones de dominio                                                            |
| Inspecciones                                             | PASS parcial                  | Tres inspecciones eléctricas demo, findings y recurrencia; la topología auxiliar queda inactiva                                   |
| EPP                                                      | PASS                          | Selección humana → requisito → issue → acuse → condición → reemplazo histórico                                                    |
| Capacitación                                             | PASS                          | Necesidad → sesión → asistencia PRESENT → completitud                                                                             |
| Incidente                                                | PASS                          | NEAR_MISS → involucrado → investigación → factor → acción → evidencia                                                             |
| Observación                                              | PASS                          | Registro independiente de incidente y finding                                                                                     |
| B3A                                                      | PASS TÉCNICO / VALIDAR CON ANITA | Backend staging alineado; programas de salud y psicosocial, ciclo agregado y vínculos al plan verificados read-only. PA-09 sigue aceptación humana. |
| `solution-finder` legado                                 | STALE_STAGING_RUNTIME         | Con backend alineado, la entrada pública y `complete` responden 201 con el contrato vigente; no se cambió la lógica de producción. |
| Capturas                                                 | PASS                          | 26 desktop + 4 mobile en `design-handoff/anita-visual-review-v1/`; 30/30 HTTP 200 y assertions de contenido.                     |
| Producción                                               | NO TOCADA                     | No hubo escrituras, deploy ni credenciales productivas                                                                            |

## PA-01…PA-11

| ID    | Tema                          | Aceptación humana concreta                                                                                        | Estado técnico                  | Evidencia para la sesión                                                    |
| ----- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| PA-01 | Denominador y población móvil | Confirmar cómo explicar 453 frente a 267 + 85 y qué representa una persona sin centro.                            | LISTO TÉCNICAMENTE              | Evaluación y fixture; las 101 permanecen sin asignación.                    |
| PA-02 | Actividad complementaria      | Elegir etiquetas y ejemplos para que una actividad complementaria cambie preguntas sin inferir regulación.        | LISTO TÉCNICAMENTE              | Actividad principal y complementaria separadas.                             |
| PA-03 | Método de riesgo              | Elegir método y profundidad por familia de peligro cuando haya más de una referencia técnica.                     | VALIDAR CON ANITA               | Inspección eléctrica y riesgo técnico; el método no se presenta como ley.   |
| PA-04 | Mappings de inspección        | Confirmar criterio y mapping profesional por dominio antes de publicarlo.                                         | VALIDAR CON ANITA               | Basis → resource → criterio; no hay publicación automática.                 |
| PA-05 | EPP                           | Confirmar vocabulario de posición, riesgo y certificación; decidir si el flujo comunica bien la selección humana. | VALIDAR CON ANITA               | Flujo completo sintético; `ERGONOMIC` y `OTHER` sin candidatos automáticos. |
| PA-06 | Incidentes                    | Confirmar factores, ubicación y orden de revisión; no convertir factor en causa raíz.                             | VALIDAR CON ANITA               | Casi incidente con factor EQUIPMENT y acción abierta.                       |
| PA-07 | Capacitación                  | Confirmar prioridad entre necesidad interna, regulación candidata, plan, incidente y observación.                 | VALIDAR CON ANITA               | Need por POSITION, sesión y completitud; no es LMS.                         |
| PA-08 | Observaciones                 | Confirmar umbrales, términos, evidencia y escalamiento.                                                           | VALIDAR CON ANITA               | Buena práctica separada de incidente y finding.                             |
| PA-09 | Psicosocial                   | Confirmar instrumento, alcance e interpretación aggregate-only.                                                   | VALIDAR CON ANITA               | Programa y ciclo sintético con fuente identificada; respuestas, scores y vínculos de worker no se almacenan. |
| PA-10 | Cinco RuleDrafts              | Resolver PA-R01, PA-R02, PA-R03, PA-R04 y PA-R05 uno por uno con fuente, condición y evidencia faltante.          | BLOQUEADO POR FUENTE            | `RuleVersions=0`; ninguna aprobación inventada.                             |
| PA-11 | SISAT                         | Entregar el artefacto oficial completo y verificable con hash, bytes, páginas y unidades.                         | BLOQUEADO POR FUENTE            | `BLOCKED_EXTERNAL_SOURCE`, unidades 0.                                      |

## Aceptaciones no sustituibles

- Anita debe distinguir consulta documental de regla ejecutable.
- Anita debe decidir si el lenguaje del denominador y de población móvil es comprensible.
- Anita debe validar mappings de inspección, selección EPP, factores de incidente y el ciclo psicosocial agregado.
- La revisión legal debe decidir cada RuleDraft; una captura o un status HTTP no publica una `RuleVersion`.

## Resultado de la revisión

Estado de la entrega: **READY FOR VISUAL REVIEW**. Las aceptaciones humanas permanecen separadas de la evidencia técnica; PA-10 y PA-11 siguen bloqueados por fuente y no se presentan como cumplimiento.
