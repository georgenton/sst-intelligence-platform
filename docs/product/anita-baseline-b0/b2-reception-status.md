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

| Requisito                                                     | Estado                                     | Evidencia implementada o verificada                                                                                                                                                                   | Prueba focal                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Perfil `PILOT` reversible por organización                    | PASS                                       | `Organization.navigationProfile`, PATCH protegido por organización y rol, valor por defecto `FULL`; la interfaz deriva el perfil de la organización activa                                            | `organization-creation.integration-spec.ts`; `app-navigation.test.mjs`                                               |
| Perfil `FULL` y cambio entre organizaciones                   | PASS                                       | La lista de organizaciones devuelve el perfil de cada organización; cambiar de organización cambia solo la presentación y conserva guards/entitlements                                                | `navigation-profile-per-organization.spec.ts` prueba PILOT/FULL en la misma sesión                                   |
| E-01: opción radio accesible                                  | PASS                                       | Radio nativo cubre la tarjeta; marcador decorativo no intercepta puntero; `label`, `checked`, foco y teclado siguen siendo nativos                                                                    | `guided-sst-assessment-flow.spec.ts`, marcador/texto/tarjeta/Space y altura >= 44 px                                 |
| E-02: magnitudes compatibles                                  | PASS                                       | Comparador exige significado, periodo, cobertura y solapamiento explícitos; no compara nómina con presencia habitual                                                                                  | contratos `sst-headcount`; pruebas web de razones                                                                    |
| E-02: captura, persistencia y aclaración                      | PASS                                       | Los metadatos permanecen como hechos de evaluación; la revisión muestra la razón y el botón `Aclarar datos de personas`                                                                               | E2E guiado y pruebas de presentación                                                                                 |
| Actividad principal/complementaria                            | PASS                                       | Se conserva `organization.activityDescription` y se añade `organization.complementaryActivityDescription` como contexto independiente                                                                 | catálogo y pruebas de contrato                                                                                       |
| Instalación, modalidad y exposición                           | PASS                                       | `facilityTypes`, `workArrangement` y exposiciones permanecen en unidades distintas; se añade contexto químico limpieza/proceso industrial                                                             | catálogo; reglas de relevancia existentes                                                                            |
| Centro actual y selección humana                              | PASS                                       | Los nombres de centro y el mapeo de claim siguen siendo explícitos y reversibles                                                                                                                      | E2E guiado multicentro                                                                                               |
| Fatiga y aviso de mínimo                                      | PASS técnico / aceptación humana pendiente | La experiencia trata la fatiga como repetición y esfuerzo de entrevista: una explicación accesible por sesión, estado discreto persistente y contexto opcional; no se crea un hecho de fatiga laboral | `guided-sst-assessment-flow.spec.ts` y `sst-assessment-visual-feedback.test.mjs`; `USER_FATIGUE_EFFECT=NOT_MEASURED` |
| Corpus real trazable                                          | PASS en mecanismo / PENDING en publicación | Unidades, requisitos y borradores conservan fuente, versión, identificador, locator, texto oficial y hash; el flujo unificado los muestra                                                             | `unified-regulatory.integration-spec.ts`; `reference:sync`                                                           |
| Publicación regulatoria                                       | PENDING                                    | Cinco borradores siguen en revisión técnica; no se fabrican aprobaciones ni reglas reales                                                                                                             | `publishedRules=0`, decisión profesional por unidad pendiente                                                        |
| Agregado EPP                                                  | PASS                                       | Agregado server-side con cantidades, identidad, filtros y datos no modelados como `NOT_REGISTERED`                                                                                                    | integraciones EPP y pruebas de paginación                                                                            |
| Continuidad Plan → Inspección → Hallazgo → Acción → Evidencia | PASS en rutas existentes                   | Se conserva el recorrido y el aislamiento por tenant                                                                                                                                                  | `inspection-continuity.integration-spec.ts`, E2E de continuidad                                                      |

### A19 por unidad de aceptación

| ID     | Unidad                                            | Estado B2                                     | Evidencia                                                                                                                                                                    | Pendiente explícito                                                                                                   |
| ------ | ------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A19-01 | Centro, zonas y actividad                         | PASS parcial                                  | `workCenter.activityDescription`, `activityCategories`, `hasDistinctOperationalZones` y captura por centro en el E2E guiado                                                  | falta una validación de producto con datos reales de zonas                                                            |
| A19-02 | Limpieza química separada de proceso industrial   | PASS                                          | `workCenter.chemicalUseContexts` conserva `CLEANING`, `INDUSTRIAL_PROCESS` y desconocido; no se infiere una obligación                                                       | revisión profesional de asociaciones normativas sigue pendiente                                                       |
| A19-03 | Actividad principal y complementaria              | PASS                                          | `organization.activityDescription` y `organization.complementaryActivityDescription` son hechos independientes y opcionales                                                  | copy y aceptación de negocio por actividad complementaria                                                             |
| A19-04 | Asignación, presencia y población móvil           | PASS en captura / PARTIAL en aceptación       | comparación E-02 exige significado, periodo, cobertura y solapamiento; no inventa faltantes                                                                                  | fixture `267 + 85 vs 453` aún requiere aceptación de producto                                                         |
| A19-05 | Denominadores explicables                         | PASS                                          | razones de no comparabilidad y botón `Aclarar datos de personas` muestran qué metadato falta                                                                                 | ampliar validación a más de un tipo de partición                                                                      |
| A19-06 | Aviso mínimo y fatiga                             | PASS técnico / aceptación humana pendiente    | la transición a información suficiente anuncia una vez por sesión; el estado queda visible sin repetir la novedad, y la corrección vuelve a usar el estado real del servidor | prueba de DOM/`role=status`, recarga y retorno; `USER_FATIGUE_EFFECT=NOT_MEASURED`; Jorge/Anita deben aceptar el copy |
| A19-07 | Fundamento fuente → requisito → criterio → acción | PASS en trazabilidad / PENDING en publicación | unidades, requisitos, vínculos y APIs devuelven fuente, versión, locator y estado                                                                                            | revisión profesional por unidad antes de publicar                                                                     |

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

## Cierre focal de recepción y preview

Este corte se hizo sobre el HEAD recibido y conserva los estados históricos de B0/B1.
La aclaración de A19-06 es de experiencia de entrevista: el aviso de mínimo se anuncia una
vez por sesión mediante un estado accesible y se recuerda en `sessionStorage`; una recarga o
un retorno no lo presenta como novedad. La revisión sigue mostrando que la información mínima
está disponible y que el contexto adicional es opcional. Si una corrección invalida un dato
esencial, la API vuelve a `IN_PROGRESS` y desaparece la afirmación de suficiencia. No se
añade un hecho, umbral, diagnóstico o regla de fatiga laboral. El efecto subjetivo en personas
usuarias no se midió: `USER_FATIGUE_EFFECT=NOT_MEASURED`.

La matriz A19 se conserva por ID y se separan las capas de evidencia:

| ID     | Comportamiento pedido                                                                         | Observado/prueba                                                                                                                                    | Tipo de pendiente                                   | Decisión exacta y responsable                                                                                                             |
| ------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A19-01 | Centro, zona y actividad no se infieren como una sola oficina                                 | Captura por centro, actividad y zonas distintas en el E2E guiado                                                                                    | aceptación de producto con muestra                  | Confirmar que el copy permite describir una oficina con zonas distintas; responsable: producto (Jorge/Anita)                              |
| A19-02 | Limpieza química separada de proceso industrial/alta energía                                  | `chemicalUseContexts` conserva limpieza, proceso y desconocido sin inferir obligación                                                               | decisión profesional localizada                     | Determinar qué asociación normativa, si alguna, se habilita para cada contexto; responsable: revisión técnica y jurídica por unidad       |
| A19-03 | Actividad principal y complementaria son hechos independientes                                | Ambos hechos se capturan y persisten como contexto opcional                                                                                         | aceptación de negocio                               | Confirmar el copy y el uso de la actividad complementaria; responsable: producto                                                          |
| A19-04 | Distinguir asignación, presencia y población móvil                                            | E-02 bloquea comparación entre significados/periodos/coberturas incompatibles; fixture `267 + 85 vs 453` no inventa las 101 personas                | aceptación de producto + interpretación profesional | Aceptar el fixture y decidir cómo se presenta una diferencia compatible; responsable: producto, luego profesional si cambia la conclusión |
| A19-05 | Denominador explicable y corregible                                                           | Se guardan significado, periodo, cobertura y solapamiento; se ofrece `Aclarar datos de personas`                                                    | ampliar cobertura de pruebas                        | Añadir la partición adicional que producto quiera observar; responsable: producto                                                         |
| A19-06 | Una explicación breve de mínimo, sin fatiga por repetición; guardar/retomar y salida opcional | `role=status` y `aria-live=polite` solo en la transición; recarga no repite; estado real del servidor gobierna correcciones; no hay hecho de fatiga | aceptación humana, no defecto técnico               | Aceptar el copy y la ausencia de una métrica subjetiva; responsable: Jorge/Anita                                                          |
| A19-07 | Fundamento fuente → requisito → criterio → acción                                             | Unidades, versión, locator, texto y hash se conservan y el workspace enlaza al artículo                                                             | decisión profesional por unidad                     | Validar las cinco fichas de decisión de abajo antes de publicar reglas; responsable: experto técnico y revisor jurídico                   |

### Fichas de decisión de los cinco borradores

La consulta documental es utilizable: cada fila se puede abrir desde el workspace con fuente,
versión, locator, texto oficial y hash. Eso no equivale a una decisión ejecutable. Los cinco
borradores siguen `TECHNICAL_REVIEW_PENDING`; la ratificación comunicada por Jorge el
2026-09-24 sobre Anita se conserva como comunicación y alcance de trabajo, no como firma,
aprobación individual ni publicación automática.

Fuente común de las cinco filas: `EC_MDT_2024_196`, **Acuerdo Ministerial Nro. MDT-2024-196**,
catálogo v2, URL oficial `https://www.trabajo.gob.ec/wp-content/uploads/2024/10/ACUERDO-MINISTERIAL-NRO.-MDT-2024-196-signed.pdf`,
hash `sha256:4fe2da2ddf2b730c0c9e56e321d5a817f94b98d6d9f9e02bb97c18f2cc47473d`.

| Draft ID / requisito                                                                                                     | Regla y condición propuesta                                                                                                 | Unidad exacta y evidencia disponible                                                                                                                                                                                                                                                                                                                 | Vínculo documental frente a interpretación                                                                                                                                                      | Qué falta para validar/publicar y quién decide                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `b4000000-0000-4000-8000-000000000001` · `MDT_2024_196_SST_RESPONSIBLE_REGISTRATION` · Registro del responsable de SST   | `MDT_2024_196_SST_RESPONSIBLE_REGISTRATION_RULE` v1; organización con `totalWorkerCount >= 1`; estado candidato `MANDATORY` | Art. 18, unidad `cf6e2ac7-9468-4961-871e-00df51c091a8`, locator “Artículo 18 · página 16”, hash normalizado `sha256:705e19bb526601ad14b90e018769f4a3ff0519fc62270b080d35275e3c06723e`; también Art. 19, unidad `a94e7382-be6f-4773-82fa-4c080ace38ed`, páginas 16–17, hash `sha256:7a73870dcabba4ce845c50027eb7ab959c182c27f6a1fa517120cfa6a3fdd6f9` | Los artículos enumeran registro/notificación/reporte. No resuelven por sí solos designación, perfil ni condiciones del responsable; el vínculo adicional declarado es `EC_EXECUTIVE_DECREE_255` | Localizar y revisar Decreto 255 y decidir el alcance exacto del target y su evidencia. Deciden experto técnico y revisor jurídico; después el mecanismo canónico de publicación |
| `b4000000-0000-4000-8000-000000000002` · `MDT_2024_196_PREVENTION_PLAN_REGISTRATION` · Plan 1–10                         | `MDT_2024_196_PREVENTION_PLAN_1_TO_10_RULE` v1; `1 <= totalWorkerCount <= 10`; `MANDATORY` candidato                        | Art. 18, unidad `cf6e2ac7-9468-4961-871e-00df51c091a8`, locator página 16, hash `sha256:705e19bb526601ad14b90e018769f4a3ff0519fc62270b080d35275e3c06723e`                                                                                                                                                                                            | El texto sustenta elaborar, solicitar aprobación y registrar; el contenido, trámite y condiciones adicionales dependen de `EC_EXECUTIVE_DECREE_255`                                             | Confirmar procedimiento, alcance de aprobación/registro y evidencia mínima con la fuente adicional. Deciden experto técnico y revisor jurídico                                  |
| `b4000000-0000-4000-8000-000000000003` · `MDT_2024_196_HYGIENE_SAFETY_REGULATION_REGISTRATION` · Reglamento >10          | `MDT_2024_196_HYGIENE_SAFETY_REGULATION_GT_10_RULE` v1; `totalWorkerCount >= 11`; `MANDATORY` candidato                     | Art. 19, unidad `a94e7382-be6f-4773-82fa-4c080ace38ed`, locator páginas 16–17, hash `sha256:7a73870dcabba4ce845c50027eb7ab959c182c27f6a1fa517120cfa6a3fdd6f9`                                                                                                                                                                                        | El artículo sustenta el registro y describe aprobación, respaldo y renovación; la estructura/contenido técnico requiere `EC_EXECUTIVE_DECREE_255` y `EC_MDT_2024_196_ANNEX_3`                   | Confirmar el alcance del umbral, renovación y evidencia, y que el Anexo 3 aplica a esta conclusión. Deciden experto técnico y revisor jurídico                                  |
| `b4000000-0000-4000-8000-000000000004` · `MDT_2024_196_PSYCHOSOCIAL_PROGRAM_REGISTRATION` · Programa psicosocial         | `MDT_2024_196_PSYCHOSOCIAL_PROGRAM_GT_10_RULE` v1; `totalWorkerCount >= 11`; `MANDATORY` candidato                          | Art. 19, unidad `a94e7382-be6f-4773-82fa-4c080ace38ed`, locator páginas 16–17, hash `sha256:7a73870dcabba4ce845c50027eb7ab959c182c27f6a1fa517120cfa6a3fdd6f9`                                                                                                                                                                                        | El literal e) enumera el programa y su registro, pero no aporta el diseño, contenido ni fuente técnica específica                                                                               | Identificar y verificar `EC_MDT_PSYCHOSOCIAL_PROGRAM_REFERENCE_PENDING`; decidir aplicabilidad, contenido y evidencia. Deciden experto técnico y revisor jurídico               |
| `b4000000-0000-4000-8000-000000000005` · `MDT_2024_196_ANNUAL_TRAINING_PLAN_REGISTRATION` · Plan anual de capacitaciones | `MDT_2024_196_ANNUAL_TRAINING_PLAN_GT_10_RULE` v1; `totalWorkerCount >= 11`; `MANDATORY` candidato                          | Art. 19, unidad `a94e7382-be6f-4773-82fa-4c080ace38ed`, locator páginas 16–17, hash `sha256:7a73870dcabba4ce845c50027eb7ab959c182c27f6a1fa517120cfa6a3fdd6f9`                                                                                                                                                                                        | El literal f) enumera el plan anual y su registro, pero no determina contenido, periodicidad material ni evidencia                                                                              | Identificar y verificar `ADDITIONAL_TRAINING_REQUIREMENTS_SOURCE_PENDING`; decidir contenido, periodicidad y evidencia. Deciden experto técnico y revisor jurídico              |

Estado resultante: `REGULATORY_DOCUMENTARY_USABILITY=PASS`, `REGULATORY_EXECUTABLE_RULES=0`
publicadas, `REGULATORY_SOURCE_DENOMINATOR=15`, `REGULATORY_UNITS_AND_DRAFTS_DELTA=5 drafts
sin cambio`, `UNIT_DECISION_SHEETS=5 fichas concretas`. Las unidades independientes ya
sustentadas no se bloquean por estas cinco interpretaciones; ninguna aprobación se simula.
