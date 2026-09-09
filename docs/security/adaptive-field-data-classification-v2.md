# Adaptive Field Intelligence V2 — clasificación y privacidad

Estado: **DONE** para campos implementados.

| Superficie                            | Clasificación                               | Uso externo IA             |
| ------------------------------------- | ------------------------------------------- | -------------------------- |
| claves/guidance de profundidad        | global reference                            | no necesario               |
| profile facts y business priority     | tenant operational MEDIUM                   | prohibido en este programa |
| Gap snapshots y Plan provenance       | tenant operational MEDIUM                   | prohibido                  |
| Safety Observation free text/evidence | tenant operational HIGH                     | prohibido                  |
| Incident narrative/evidence           | tenant operational HIGH                     | prohibido                  |
| Worker operational identity           | tenant operational MEDIUM/HIGH por contexto | prohibido                  |
| Search result/snippet                 | hereda origen; incidente restringido        | prohibido                  |
| métricas agregadas                    | tenant operational MEDIUM                   | prohibido                  |
| review/history                        | professional decision                       | prohibido                  |

La API resuelve la organización desde membership vigente. Search filtra dentro de cada query; Analytics agrega solamente registros de esa organización. No se reduce clasificación para habilitar un LLM. Production External AI continúa deshabilitado y el boundary staging LOW-data no se amplía.

## Future verticals — DESIGN ONLY

Business Continuity/Insurance debe separar exposición, pérdida potencial y suficiencia de seguro de SST legal y riesgo ocupacional; no se implementa scoring ni underwriting. Ergonomics requiere decisión build/licencia, fuente metodológica revisada y especialista. Psychosocial requeriría clasificación HIGH/clinical, consentimiento, segregación y retención; no se implementan cuestionario, score, diagnóstico ni perfil individual.
