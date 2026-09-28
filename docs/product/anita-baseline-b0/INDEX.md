# Índice B0

| Pregunta                               | Archivo                                                                        | Resultado verificable                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| ¿Cuál es el baseline?                  | [README](./README.md)                                                          | Main `d20d2ff7f10871271587571b1825f409b7b534e0`; QG `35785935020` exitoso. |
| ¿Qué puede entrar al piloto?           | [module-readiness.csv](./module-readiness.csv)                                 | Estado por superficie, contrato, guardas y dependencia.                    |
| ¿Qué corpus existe?                    | [regulatory-publication-manifest.json](./regulatory-publication-manifest.json) | 15 fuentes, estados por fuente, huellas y 0 reglas reales publicadas.      |
| ¿Qué pidió Anita y qué observamos?     | [anita-2026-09-19-requirements.md](./anita-2026-09-19-requirements.md)         | Requisitos operables, A19, fixture sintético y aceptación.                 |
| ¿Qué significa SISAT/Psicosocial?      | [sisat-psychosocial-scope.md](./sisat-psychosocial-scope.md)                   | Alcance no clínico, artículos y ambigüedades preservadas.                  |
| ¿Cómo se conecta la UI con el backend? | [component-contract-map.md](./component-contract-map.md)                       | Componentes, rutas API, modelos, roles y entitlements.                     |
| ¿Qué falta para declarar piloto?       | [pending-items.md](./pending-items.md)                                         | Dueño, efecto y evidencia faltante.                                        |
| ¿Dónde está la convergencia enlazable? | [convergencia-anita-baseline.md](../convergencia-anita-baseline.md)            | Resumen canónico de estados y límites.                                     |

## Estados que este índice distingue

- **Implementado:** existe código/ruta/contrato en el commit auditado.
- **Verificado:** un test, gate o inventario aporta evidencia reproducible.
- **Desplegado:** GitHub registra un deployment `success` para el SHA exacto.
- **Operable para piloto:** hay superficie, contrato y guardas suficientes para el alcance inmediato.
- **Ratificado por comunicación:** Jorge comunicó que Anita aprobó las leyes el 2026-09-24; no equivale a firma de Anita ni a publicación jurídica.
- **Publicado:** solo para reglas runtime activas. El valor actual es `0`.
