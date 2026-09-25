# B2 — recepción y estado de implementación

Este documento registra el avance de B2 sobre el baseline B0. No modifica ni
reinterpreta los documentos históricos de `anita-baseline-b0/`.

## Identidad de la entrega

- Rama: `codex/anita-b2-reception`
- HEAD de partida: `88632905ea0feae3dbd06a1f5f07296aecfcda2b`
- B0 documental: `1a3788001949068545bc26074ca9041b143f5827`
- Base de comparación: `main@d20d2ff7f10871271587571b1825f409b7b534e0`
- Runtime local y CI: Node 24; el entorno local probado fue Node `24.19.0`.
- Package manager: pnpm `10.33.2`.

## Matriz B2

| Requisito                                                     | Estado                                     | Evidencia implementada o verificada                                                                                                                        | Prueba focal                                                                         |
| ------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Perfil `PILOT` reversible por organización                    | PASS                                       | `Organization.navigationProfile`, PATCH protegido por organización y rol, valor por defecto `FULL`; la interfaz deriva el perfil de la organización activa | `organization-creation.integration-spec.ts`; `app-navigation.test.mjs`               |
| Perfil `FULL` y cambio entre organizaciones                   | PASS                                       | La lista de organizaciones devuelve el perfil de cada organización; cambiar de organización cambia solo la presentación y conserva guards/entitlements     | `navigation-profile-per-organization.spec.ts` prueba PILOT/FULL en la misma sesión   |
| E-01: opción radio accesible                                  | PASS                                       | Radio nativo cubre la tarjeta; marcador decorativo no intercepta puntero; `label`, `checked`, foco y teclado siguen siendo nativos                         | `guided-sst-assessment-flow.spec.ts`, marcador/texto/tarjeta/Space y altura >= 44 px |
| E-02: magnitudes compatibles                                  | PASS                                       | Comparador exige significado, periodo, cobertura y solapamiento explícitos; no compara nómina con presencia habitual                                       | contratos `sst-headcount`; pruebas web de razones                                    |
| E-02: captura, persistencia y aclaración                      | PASS                                       | Los metadatos permanecen como hechos de evaluación; la revisión muestra la razón y el botón `Aclarar datos de personas`                                    | E2E guiado y pruebas de presentación                                                 |
| Actividad principal/complementaria                            | PASS                                       | Se conserva `organization.activityDescription` y se añade `organization.complementaryActivityDescription` como contexto independiente                      | catálogo y pruebas de contrato                                                       |
| Instalación, modalidad y exposición                           | PASS                                       | `facilityTypes`, `workArrangement` y exposiciones permanecen en unidades distintas; se añade contexto químico limpieza/proceso industrial                  | catálogo; reglas de relevancia existentes                                            |
| Centro actual y selección humana                              | PASS                                       | Los nombres de centro y el mapeo de claim siguen siendo explícitos y reversibles                                                                           | E2E guiado multicentro                                                               |
| Fatiga y aviso de mínimo                                      | PARTIAL                                    | Se eliminó la repetición del aviso de mínimo entre progreso y revisión; no existe todavía un hecho específico de fatiga en el alcance B2                   | revisión visual/E2E; decisión de producto pendiente                                  |
| Corpus real trazable                                          | PASS en mecanismo / PENDING en publicación | Unidades, requisitos y borradores conservan fuente, versión, identificador, locator, texto oficial y hash; el flujo unificado los muestra                  | `unified-regulatory.integration-spec.ts`; `reference:sync`                           |
| Publicación regulatoria                                       | PENDING                                    | Cinco borradores siguen en revisión técnica; no se fabrican aprobaciones ni reglas reales                                                                  | `publishedRules=0`, decisión profesional por unidad pendiente                        |
| Agregado EPP                                                  | PASS                                       | Agregado server-side con cantidades, identidad, filtros y datos no modelados como `NOT_REGISTERED`                                                         | integraciones EPP y pruebas de paginación                                            |
| Continuidad Plan → Inspección → Hallazgo → Acción → Evidencia | PASS en rutas existentes                   | Se conserva el recorrido y el aislamiento por tenant                                                                                                       | `inspection-continuity.integration-spec.ts`, E2E de continuidad                      |

### A19 por unidad de aceptación

| ID     | Unidad                                            | Estado B2                                     | Evidencia                                                                                                                   | Pendiente explícito                                                   |
| ------ | ------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| A19-01 | Centro, zonas y actividad                         | PASS parcial                                  | `workCenter.activityDescription`, `activityCategories`, `hasDistinctOperationalZones` y captura por centro en el E2E guiado | falta una validación de producto con datos reales de zonas            |
| A19-02 | Limpieza química separada de proceso industrial   | PASS                                          | `workCenter.chemicalUseContexts` conserva `CLEANING`, `INDUSTRIAL_PROCESS` y desconocido; no se infiere una obligación      | revisión profesional de asociaciones normativas sigue pendiente       |
| A19-03 | Actividad principal y complementaria              | PASS                                          | `organization.activityDescription` y `organization.complementaryActivityDescription` son hechos independientes y opcionales | copy y aceptación de negocio por actividad complementaria             |
| A19-04 | Asignación, presencia y población móvil           | PASS en captura / PARTIAL en aceptación       | comparación E-02 exige significado, periodo, cobertura y solapamiento; no inventa faltantes                                 | fixture `267 + 85 vs 453` aún requiere aceptación de producto         |
| A19-05 | Denominadores explicables                         | PASS                                          | razones de no comparabilidad y botón `Aclarar datos de personas` muestran qué metadato falta                                | ampliar validación a más de un tipo de partición                      |
| A19-06 | Aviso mínimo y fatiga                             | PARTIAL                                       | se eliminó la repetición en revisión y se mantiene un aviso contextual                                                      | no existe aún un hecho específico de fatiga ni medición de repetición |
| A19-07 | Fundamento fuente → requisito → criterio → acción | PASS en trazabilidad / PENDING en publicación | unidades, requisitos, vínculos y APIs devuelven fuente, versión, locator y estado                                           | revisión profesional por unidad antes de publicar                     |

### Verificación focal B2

El caso de radio `Presencial` reprodujo en el HEAD inicial la intercepción del
marcador (`assessment-option__marker intercepts pointer events`). El control se
corrigió conservando un `<input type="radio">` nativo que cubre la tarjeta, con
el marcador decorativo en `pointer-events: none`; la prueba comprueba marcador,
texto, tarjeta, `checked`, foco, Space y una altura mínima de 44 px. El E2E
completo final se ejecutó con `workers=1` y `retries=0`: 41/41 pruebas, 22
bloques, sin reintentos, sobre un schema sintético con fixtures. El test de
perfil añade la paridad PILOT/FULL en una sesión autenticada; el runtime sin
seed de desarrollo se validó por separado con `reference:sync`, migraciones y
creación de organización. La integración API final pasó 40/40 suites y
161/161 tests; `reference-sync` y `runtime-image` también pasaron en schemas
desechables.

## Entorno y base aislada

Se creó el schema descartable `b2_c0d7c2b8f0df4ac294b1b1081dd93c62` sobre el
PostgreSQL local de pruebas. Se aplicaron las 36 migraciones canónicas y se
ejecutó `reference:sync` sin `prisma seed`. La base local existente no se
reseteó ni se modificó. El P2022 original correspondía a una base/schema
desalineado respecto de la migración canónica que crea
`SstAssessmentSession.baseProfileVersionId`; el checkout actual reproduce esa
columna en una instalación nueva.

La migración 36 agrega únicamente la configuración funcional persistente
`Organization.navigationProfile`. No es una migración de reparación de drift.

## Referencias normativas

La provisión canónica quedó comprobada con 15 fuentes, 15 versiones, 13
artefactos verificados, 1 referencia oficial sin artefacto copiado, 1 referencia
rechazada por no verificada, 1.112 unidades, 893 artículos, 5 requisitos y 5
borradores de regla. La cobertura estructural de documentos estructurados es
100%; el corpus completo no se declara estructuralmente completo. El runtime
mantiene `publishedRules=0`. La ratificación comunicada por Jorge sobre Anita
se conserva como comunicación, no como firma ni publicación automática.

## Límites conservados

No se implementa B3/SISAT/Psicosocial. No se publican reglas reales, no se
alteran suscripciones o entitlements, no se recalculan históricos y no se
escriben organizaciones reales. El documento local
`docs/product/inspection-intelligence-deep-audit-2026-09.md` permanece fuera de
este cambio.
