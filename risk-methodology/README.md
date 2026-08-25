# Risk methodology manifests — Phase 1

Estos manifiestos son propuestas de contrato y fixtures de revisión. No están sembrados, no están
registrados en la API y no habilitan métodos en la UI.

- `DEMO_5X5@1.0.0` documenta la identidad histórica sin cambiar cálculo ni registros.
- `GUIDED_5X5@1.0.0` es candidato DEMO pendiente de revisión técnica y legal.
- `GTC45_2010@1.0.0` es candidato DEMO-REVIEW, no una regla ni metodología legal ecuatoriana.
- Los contextos ecuatorianos expresan uso/contexto, nunca adopción legal del método.
- La guía de Anita es `EXPERT_OBSERVATION` y nunca participa en la fórmula.

Los `contentHash` cubren el objeto JSON completo excepto el propio campo `contentHash`, usando
claves ordenadas recursivamente y SHA-256. Una futura publicación debe crear una versión nueva; no
debe sobrescribir un manifiesto publicado usado por evaluaciones.
