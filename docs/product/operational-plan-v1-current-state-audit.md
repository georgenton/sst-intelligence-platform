# Plan Operativo V1 — auditoría del estado actual

Fecha: 2026-09-17. Estado: inventario y recomendación de alcance; **sin implementación ni commit**.

Árbol auditado: merge/main `fde2fd2b3c4074f918c879062019daccbd2b39fa`, correspondiente al HEAD de PR50 `1bb08a75c64b3b348cc2f3ef592fddb1141c3f9e`. Se comprobó que ambos árboles son idénticos. La revisión comenzó después de verificar el cierre de PR50 en producción.

## Resultado

Ya existe un Plan Operativo persistido y versionado, con borrador manual o determinista, activación humana, actividades, responsables, fechas, procedencia y ejecución independiente. También existe conversión explícita de brechas a este mismo agregado. **V1 debe extender estas piezas, no crear otra tabla de planes, tareas o cola.**

La conexión que falta es desde el diagnóstico de PR50 (`SstAssessmentSession.latestResult.capabilityEvaluation`) hacia una decisión humana persistida y un borrador revisable. El convertidor actual consume `AdaptiveConfigurationProposal` o el dominio anterior `UnifiedSstEvaluation`; no consume esas recomendaciones de capacidades. Una capacidad recomendada tampoco equivale por sí sola a una actividad ni a una obligación legal.

Esta auditoría describe código disponible en el artefacto de producción y cobertura existente. No demuestra adopción por clientes ni vuelve a ejecutar recorridos de escritura en producción. No se consultaron registros privados de clientes. La documentación histórica se usó como contexto, no como autorización para implementar sus propuestas ni como sustituto del código.

## A. Qué existe

### Datos y límites del agregado

Fuente: [schema.prisma](../../apps/api/prisma/schema.prisma), modelos desde las líneas 2160, 2248, 2704, 3765 y 4380; migración [post_anita_product_convergence_v1](../../apps/api/prisma/migrations/20260907010000_post_anita_product_convergence_v1/migration.sql).

| Modelo                                                           | Responsabilidad y campos existentes                                                                                                                                                                       |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OperationalPlan`                                                | Identidad por organización, autor y fecha; contiene versiones.                                                                                                                                            |
| `OperationalPlanVersion`                                         | Número único por plan; `DRAFT / ACTIVE / RETIRED`; origen `MANUAL / DETERMINISTIC_DRAFT`; nombre, descripción, período, responsable general, `provenance`, digest, creador y fechas de activación/retiro. |
| `OperationalPlanItem`                                            | Definición inmutable: título, descripción, `startsAt`, `dueAt`, frecuencia libre, prioridad, centro, responsable, orden, `evidenceReferences`, tipo/referencia/snapshot de procedencia.                   |
| `OperationalPlanItemExecution`                                   | Estado mutable `PLANNED / IN_PROGRESS / COMPLETED / CANCELED`, versión optimista, actor y fechas de inicio/completado; una ejecución por ítem.                                                            |
| `OrganizationGapAnalysis`                                        | Snapshot versionado de brechas, perfil/fuente, hashes de entrada/salida, ítems JSON y autor. No es otro plan.                                                                                             |
| `SstAssessmentSession`                                           | Diagnóstico actual público/autenticado: scopes, facts, resultado, snapshot final, hashes, versiones del evaluador, perfil y relaciones históricas opcionales. No es un plan.                              |
| `ObligationExecution` + `ObligationExecutionEvidence`            | Trabajo especializado con origen aprobado/candidato/interno/manual, responsable, plazo, expectativa de evidencia y revisión profesional. Evidencia de nota o enlace y ciclo propio.                       |
| `CorrectiveAction` + `ActionEvidence`                            | Acción de hallazgo de inspección, responsable/plazo/estado y evidencia especializada.                                                                                                                     |
| `GovernanceDecision` + `GovernanceAction` + `GovernanceEvidence` | Decisiones de reuniones y seguimiento asociado, con responsables de membresía y evidencia. No son decisiones genéricas sobre recomendaciones del diagnóstico.                                             |
| `EvidencePackage` + `EvidencePackageItem`                        | Paquete documental con referencias canónicas, manifiesto histórico, digest y finalización inmutable.                                                                                                      |
| `OperationalSignal`                                              | Señal operativa explicable, fuentes, fingerprint/digest, regla/ventana/umbral y revisión humana.                                                                                                          |
| `TrainingNeed`                                                   | Ya tiene FK `linkedPlanItemId` a `OperationalPlanItem`; conserva fuente `PLAN` y su ciclo de capacitación.                                                                                                |

Los triggers comprueban organización entre plan, versión, ítem y ejecución. El servicio valida responsables contra membresías activas y centros contra el mismo tenant. El contenido de versiones no se edita: los triggers admiten únicamente activación/retiro; los ítems rechazan UPDATE/DELETE. Un índice parcial permite **una versión activa en toda la organización**, incluso entre planes distintos. Esto es una decisión vigente que V1 debe conservar o someter a decisión explícita, no cambiar incidentalmente.

### API y autorización

Todas las rutas siguientes llevan el prefijo `/api/v1`. Organización resuelta mediante `AccessTokenGuard` y `OrganizationGuard`, no mediante un `organizationId` arbitrario en el body.

| Ruta                                                                             | Comportamiento actual                                                                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET /operational-plans`                                                         | Listado paginado; filtro por estado de ejecución de ítem.                                                                      |
| `GET /operational-plans/:planId`                                                 | Plan con todas sus versiones, ítems, responsables, centros y ejecución.                                                        |
| `POST /operational-plans`                                                        | Crea identidad + versión 1 manual en borrador.                                                                                 |
| `POST /operational-plans/generate-draft`                                         | Crea borrador determinista desde señales operativas conocidas.                                                                 |
| `POST /operational-plans/:planId/versions`                                       | Nueva versión manual, serializada con lock del plan; conserva anteriores.                                                      |
| `POST /operational-plans/:planId/versions/:versionId/activate`                   | Solo borrador; lock de organización; retira la versión activa anterior.                                                        |
| `POST /operational-plans/items/:itemId/transition`                               | Solo ítems de versión activa; transición finita y `expectedVersion`; conflicto 409 si cambió.                                  |
| `GET/POST /adaptive-intelligence/gap-analyses`                                   | Lista o captura análisis desde Adaptive o `UnifiedSstEvaluation`.                                                              |
| `GET /adaptive-intelligence/gap-analyses/:id`                                    | Snapshot del tenant.                                                                                                           |
| `POST /adaptive-intelligence/gap-analyses/:id/plan-draft`                        | Convierte 1..50 claves seleccionadas explícitamente al Plan existente; rechaza ítems informativos implementados con evidencia. |
| `GET/POST/PATCH /operational-execution/obligations…`                             | Crear/listar/detallar/editar; transicionar, revisar y agregar evidencia. Ciclo especializado, no CRUD de ítems del plan.       |
| `GET /operational-intelligence/signals`                                          | Señales persistidas.                                                                                                           |
| `POST /operational-intelligence/signals/evaluate`                                | Evalúa y persiste señales; no es un GET ni una operación de solo lectura.                                                      |
| `POST /operational-intelligence/signals/:signalId/review`                        | Revisión con versión esperada.                                                                                                 |
| `GET /operational-intelligence/work-centers/:id/overview` y `/workers/:id/facts` | Conteos/hechos; sin predicción, causa raíz ni calificación personal.                                                           |
| `GET /work-queue`                                                                | Proyección de atención con filtros de estado, módulo, centro, responsable, prioridad y fechas. No muta dominios fuente.        |

Fuentes: [controller de planes](../../apps/api/src/operational-plans/operational-plans.controller.ts), [política](../../apps/api/src/operational-plans/operational-plan.policy.ts), [Adaptive Intelligence](../../apps/api/src/adaptive-intelligence/adaptive-intelligence.controller.ts), [ejecución](../../apps/api/src/operational-execution/operational-execution.controller.ts), [inteligencia](../../apps/api/src/operational-intelligence/operational-intelligence.controller.ts), [cola](../../apps/api/src/work-queue/work-queue.controller.ts).

Escritura de planes: Owner/Admin/SST Manager/SST Technician/Consultant. Activación: Owner/Admin/SST Manager. VIEWER puede leer, no escribir. La API de planes no exige una feature de inspecciones ni una feature comercial nueva.

### Servicios y reglas puras

- [OperationalPlansService](../../apps/api/src/operational-plans/operational-plans.service.ts), líneas 47, 95, 166, 264, 307 y 355: persistencia, validación de referencias, generación, activación y ejecución. Generador `KNOWN_OPERATIONAL_SIGNALS_V1`: acciones correctivas abiertas, ejecuciones de obligaciones abiertas y alertas abiertas de recurrencia de inspección; hasta 50 de cada fuente. Cero señales produce `PLAN_DRAFT_NO_KNOWN_SIGNALS`, no actividades ficticias. El total puede superar los 100 ítems admitidos por contrato: falta definir selección/límite global antes de generar.
- [operational-plan.ts](../../packages/contracts/src/operational-plan.ts): Zod limita 1..100 ítems, valida períodos y fechas relativas, calcula digest y orden determinista por prioridad/fecha/tipo/ID. Procedencia admite `MANUAL`, `APPLICABILITY_DECISION`, `UNIFIED_SST_EVALUATION`, `FINDING`, `CORRECTIVE_ACTION`, `OBLIGATION_EXECUTION`, `GAP_ANALYSIS`. Tener un enum no demuestra una integración implementada para cada origen.
- [AdaptiveIntelligenceService](../../apps/api/src/adaptive-intelligence/adaptive-intelligence.service.ts), líneas 94 y 195: selección explícita, snapshot/hash del análisis y `createGapDraft` del mismo servicio de planes. La conversión asigna prioridad MEDIUM y conserva centro/referencias; no pide responsable ni fecha por actividad. Los tipos de fuente admitidos son solo Adaptive y evaluación anterior.
- [adaptive-field-intelligence.ts](../../packages/contracts/src/adaptive-field-intelligence.ts): brechas descriptivas, desconocidos y revisión profesional; `IMPLEMENTED_EVIDENCE_AVAILABLE` es informativo. No calcula cumplimiento.
- [OperationalExecutionService](../../apps/api/src/operational-execution/operational-execution.service.ts), líneas 210, 256, 309 y 362: transición/revisión optimista, evidencia esperada y validación de origen. `APPROVED_REQUIREMENT` exige aprobación editorial para redactar reglas; eso **no equivale** a ley aplicable ni regla publicada.
- [OperationalIntelligenceService](../../apps/api/src/operational-intelligence/operational-intelligence.service.ts) y [contrato](../../packages/contracts/src/operational-intelligence.ts): hallazgos repetidos y concentración de acciones vencidas, ventana 90 días/umbral 3; persistencia por fingerprint, revisión y conteos. No consume directamente recomendaciones de capacidades ni crea planes.

Estos módulos están registrados en [AppModule](../../apps/api/src/app.module.ts); no son controladores huérfanos ni mocks.

### UI y enlaces

[Lista](../../apps/web/app/app/plans/page.tsx) y [detalle](../../apps/web/app/app/plans/[id]/page.tsx) montan [OperationalPlans](../../apps/web/components/operational-plans-ui.tsx). La navegación ya contiene «Plan operativo» en [app-navigation.ts](../../apps/web/lib/app-navigation.ts), línea 66.

La UI ofrece formulario manual con período, responsable general y actividades con plazo, frecuencia, prioridad, centro, responsable y referencias de evidencia; agregar/quitar actividades; «Ayúdame a crear uno»; activación; inicio/completado e historial resumido. Usa API real, queries por organización, invalidación y estados de carga/error/vacío.

Limitaciones verificadas en ese componente:

- Pide su contexto a `/inspections/context` (línea 115), que exige `module.inspections` en [InspectionsController](../../apps/api/src/inspections/inspections.controller.ts), líneas 39..46. Si ese contexto falla, se reemplaza toda la página por error. Por tanto, una organización sin ese permiso puede acceder a la API de planes pero no usar esta UI. Es un acoplamiento de autorización existente, identificado estáticamente; no se ejecutó un smoke autenticado de producción.
- No implementa el editor para `POST :planId/versions`. La revisión de un borrador generado para completar responsables/plazos carece de recorrido UI. API/modelo permiten una versión revisada sin mutar la anterior.
- El detalle muestra título, descripción, prioridad, estado y procedencia, pero no presenta responsable/centro/plazo/frecuencia ni referencias de evidencia; `PlanItem` local ni siquiera incluye `evidenceReferences`.
- Solo expone Iniciar/Completar, no Cancelar. Estos botones no se condicionan al rol, al estado ACTIVE de la versión ni a `isPending`, y faltan mensajes para errores de activación/transición. Las guardas API siguen siendo autoritativas.
- Usa siempre `versions[0]` para el cuerpo principal: un borrador nuevo desplaza visualmente la versión activa anterior al resumen histórico. No hay selección completa de versión activa/histórica.
- `startsAt` existe en contrato/API, pero no tiene campo en el formulario actual. Frecuencia es texto, no programación de recurrencias.

La [UI de brechas](../../apps/web/components/adaptive-field-intelligence-ui.tsx), líneas 177 y 340, permite checkboxes y conversión explícita; propone período de 90 días. No hace de esa fecha un plazo legal. No navega al plan creado ni completa responsables/plazos de cada actividad.

### Cola, evidencia y módulos

- [WorkQueueService](../../apps/api/src/work-queue/work-queue.service.ts), líneas 567 y 1018: proyecta únicamente ítems ACTIVE no terminales con prioridad HIGH/URGENT o vencimiento dentro de siete días, incluidos vencidos. Deep link exacto `/app/plans/{planId}#item-{itemId}`; `regulatoryContext` y `riskContext` son null para esta fuente. La cola no es el inventario completo del plan.
- La copia de una acción/obligación al plan conserva su referencia, pero no crea FK a la acción ni sincroniza estados. Completar el ítem del plan no completa la acción fuente y viceversa. Ambos pueden aparecer separadamente en la cola; no asumir sincronización ni deduplicación entre dominios.
- Evidencia del plan: strings JSON inmutables dentro del contenido versionado. Se validan tamaño/cantidad, **no existencia, tenant, tipo ni protocolo HTTPS**. No hay endpoint de evidencia de ejecución ni condición de evidencia para completar un ítem.
- [EvidencePackagesService](../../apps/api/src/evidence-packages/evidence-packages.service.ts), líneas 437, 481 y 613, resuelve referencias canónicas, exige permisos por fuente y captura manifiesto inmutable con `certificationClaimed:false`. [EvidencePackageItemType](../../packages/contracts/src/evidence-package.ts) admite obligaciones, acciones, hallazgos, reuniones, etc.; **no** planes, versiones, ítems del plan ni diagnóstico `SstAssessmentSession`. No se puede afirmar que los strings de un plan ya sean un paquete documental verificable.
- Capacitación tiene integración real: [TrainingService](../../apps/api/src/training/training.service.ts), líneas 224 y 871, persiste/valida `linkedPlanItemId`; [training-ui.tsx](../../apps/web/components/training-ui.tsx), línea 377, consulta planes para selección.
- [OperationalSearchService](../../apps/api/src/operational-search/operational-search.service.ts), líneas 82 y 126, busca `PLAN_ITEM` por tenant, pero su link vuelve al listado `/app/plans`, no al ítem.
- [ManagementIntelligenceService](../../apps/api/src/management-intelligence/management-intelligence.service.ts), línea 92, cuenta ítems/estados por centro. Incluye todas las versiones; no es un indicador de avance exclusivo del plan activo y no debe presentarse como cumplimiento.
- Conversational Operations puede explicar la cola y proponer acciones especializadas. No se encontró un creador conversacional de Plan ni aprobación automática; no se requiere añadir AI al siguiente alcance.

### Pruebas existentes y alcance de su evidencia

| Archivo                                                                                                                                                                                                                                                                           | Cobertura observada                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [operational-plan.test.ts](../../packages/contracts/src/operational-plan.test.ts)                                                                                                                                                                                                 | Determinismo, digest y transiciones finitas.                                                                                                                                                                                        |
| [post-anita-convergence.integration-spec.ts](../../apps/api/test/post-anita-convergence.integration-spec.ts), línea 78                                                                                                                                                            | Borrador manual, tenancy/roles, activación, cola de atención, inmutabilidad del ítem, nueva versión/retiro, ítem histórico no ejecutable y borrador desde obligación conocida.                                                      |
| [adaptive-field-intelligence.integration-spec.ts](../../apps/api/test/adaptive-field-intelligence.integration-spec.ts), líneas 69 y 365                                                                                                                                           | Análisis desde evaluación anterior, aislamiento, selección explícita GAP_ANALYSIS y rechazo de ítem informativo. La conversión usa un análisis sintético insertado como fixture; no prueba todo el diagnóstico PR50→selección→plan. |
| [workforce-safety-refinement.integration-spec.ts](../../apps/api/test/workforce-safety-refinement.integration-spec.ts), línea 591                                                                                                                                                 | Plan→necesidad de capacitación; procedencia y referencias contradictorias rechazadas.                                                                                                                                               |
| [operational-execution.integration-spec.ts](../../apps/api/test/operational-execution.integration-spec.ts), línea 57                                                                                                                                                              | Tenant, ciclo, origen, evidencia, revisión y concurrencia de obligación especializada.                                                                                                                                              |
| [evidence-packages.integration-spec.ts](../../apps/api/test/evidence-packages.integration-spec.ts)                                                                                                                                                                                | Manifiesto canónico inmutable, permisos y referencias paginadas. No evidencia de ítem de plan.                                                                                                                                      |
| [operational-intelligence.integration-spec.ts](../../apps/api/test/operational-intelligence.integration-spec.ts)                                                                                                                                                                  | Señales explicables, identidad/concurrencia, cierre/revisión y ausencia de puntaje personal.                                                                                                                                        |
| [inspections-flow.spec.ts](../../apps/web/e2e/inspections-flow.spec.ts), línea 88                                                                                                                                                                                                 | Genera plan desde señales de inspección demo, activa, abre detalle y comprueba procedencia FINDING.                                                                                                                                 |
| [app-shell-command-center.spec.ts](../../apps/web/e2e/app-shell-command-center.spec.ts), línea 75                                                                                                                                                                                 | Navegación hacia planes.                                                                                                                                                                                                            |
| [operational-execution-flow.spec.ts](../../apps/web/e2e/operational-execution-flow.spec.ts), [evidence-package-flow.spec.ts](../../apps/web/e2e/evidence-package-flow.spec.ts), [operational-intelligence-flow.spec.ts](../../apps/web/e2e/operational-intelligence-flow.spec.ts) | Recorridos de dominios vecinos; no sustituyen el E2E V1 de diagnóstico→plan.                                                                                                                                                        |

También se inspeccionaron contratos/pruebas de ejecución, inteligencia, evidencia y brechas. El Quality gate de main `35175516850`, intento 1, pasó tests, integración, build, reference sync, runtime image y E2E. No se repitió una ejecución verde durante esta auditoría documental.

## B. Capacidad real frente a demo/placeholder

**Real y disponible en código desplegado:** modelos/migraciones, guardas, servicios, API, UI, creación manual y determinista, versiones inmutables, activación, ejecución optimista, proyección de cola, enlace a capacitación y paquetes documentales especializados. El nombre «Macro V0» en la UI y los fixtures demo no convierten esa persistencia en una simulación.

**Sintético o limitado:** contenido demo de inspecciones, ejemplos de pruebas y algunos insumos Adaptive; reglas regulatorias candidatas pendientes de revisión. Una versión/source enum opcional o un campo de procedencia no prueba que exista un recorrido integrado para ella. Los campos opcionales `adaptiveSessionId`/`unifiedEvaluationId` del diagnóstico no son un puente implementado por el servicio de PR50: finalizar conserva perfil/snapshot/resultado, sin crear esas entidades anteriores.

**No implementado para V1:** decisión persistida sobre recomendaciones de capacidades del diagnóstico nuevo; conversión directa al plan; editor/revisión UI de versión generada; evidencia verificable de ejecución del ítem; cierre unificado diagnóstico→seguimiento. No se verificó uso real por clientes ni se infiere cumplimiento a partir de esta disponibilidad técnica.

## C. Qué reutilizar en el recorrido esperado

| Etapa           | Reutilización y condición                                                                                                                                                                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diagnóstico     | `SstAssessmentSession` autenticado FINALIZED, `finalSnapshot`, `latestResult`, hashes y versiones. Resolverlo por tenant como [getAuthenticated](../../apps/api/src/sst-assessment/sst-assessment.service.ts), línea 531. No reevaluar ni modificar el resultado histórico para generar trabajo.                                             |
| Decisión humana | Patrón existente de selección explícita de brechas + autoría/procedencia/audit del borrador. `humanDecision:PENDING` en la recomendación es resultado del motor, no un registro editable de decisión. La selección aceptada puede quedar en la procedencia de la versión existente; definir trazabilidad sin otro agregado de planificación. |
| Borrador        | `OperationalPlan` + `OperationalPlanVersion` DRAFT y `OperationalPlansService`; adaptar el origen del diagnóstico con snapshots acotados, sin autoactivar la versión.                                                                                                                                                                        |
| Acciones        | `OperationalPlanItem` para actividad planeada; conservar `CorrectiveAction`, `ObligationExecution`, `GovernanceAction`, capacitación, etc., como ejecuciones especializadas donde correspondan. No crear una Action universal.                                                                                                               |
| Responsables    | `Membership`/`User` y validación existente de membresía activa; responsable general y por ítem. No crear catálogo paralelo de personas.                                                                                                                                                                                                      |
| Fechas          | Período, `startsAt`, `dueAt`, frecuencia; completar y confirmar durante revisión. Nunca derivar una fecha estatutaria desde una recomendación candidata.                                                                                                                                                                                     |
| Evidencia       | Mantener referencias históricas del contenido; reutilizar evidencia canónica del dominio fuente cuando exista. Paquetes y evidencia especializada no cubren todavía evidencia de ejecución del ítem.                                                                                                                                         |
| Seguimiento     | Activación humana, `OperationalPlanItemExecution`, conflictos de versión y Work Queue de atención. No usar la cola como almacenamiento ni declarar completa la fuente por completar una copia en el plan.                                                                                                                                    |

## D. Brechas para V1 y riesgos estáticos

1. **Puente de diagnóstico actual:** autorización del tenant, estado FINALIZED, snapshot/hashes/versiones del origen y claves seleccionadas validadas contra el resultado guardado. Hoy ninguna API de planes/brechas lee `capabilityEvaluation`. No convertir indiscriminadamente una capacidad recomendada en obligaciones o respuestas inventadas.
2. **Revisión humana utilizable:** seleccionar qué trabajo aceptar y describir la actividad concreta; revisar responsable, centro, fechas y referencias antes de activar. Reutilizar nueva versión, no editar filas inmutables. Mostrar por separado versión activa, borrador e historial.
3. **Contexto sin permiso ajeno:** desacoplar carga de miembros/centros de `/inspections/context`, reutilizando endpoints de organización/equipo con sus permisos actuales. No conceder `module.inspections` para abrir planes.
4. **Procedencia y revisión profesional:** el convertidor de brechas conserva tipo/estado pero omite `professionalReviewRequired` y la fuente detallada del ítem en el snapshot del plan. El generador de obligaciones leyó `originType`/requirement/unit, pero su snapshot final solo guarda sourceId/sourceType. Preservar y mostrar esas advertencias; completar actividad no aprueba interpretación candidata.
5. **Evidencia de ejecución:** strings declarados no prueban existencia ni pertenencia y completar ítem no exige evidencia. Definir un alcance posterior acotado de evidencia canónica/validación, reutilizando dominios existentes; no publicar como resuelta esta etapa. No añadir catálogo genérico ni uploads/importadores en el próximo PR mínimo.
6. **Reintento y atomicidad:** en `OperationalPlansService` create/createVersion/activate/transition el audit se espera después de la transacción o UPDATE, sin receipt/idempotencia de creación. Un fallo secundario puede dejar cambio persistido aunque la petición falle; un reintento de creación puede duplicar planes. Es riesgo estático del flujo futuro, no un incidente observado de producción ni una regresión de POST organizations. `AuditService.record(event, transaction)` ya permite atomicidad sin debilitar auditoría. Cubrir el recorrido nuevo con rollback, respuesta perdida y reintento.
7. **Límites/detalle UI:** selección global de señales dentro de 100 ítems, recuperación de errores y doble click, controles por rol/ACTIVE y estado pending, presentación de responsables/plazos/evidencia. Filtrar métricas por versión activa si se presentan como avance actual; conservar métricas históricas cuando se etiqueten como tal.
8. **Cobertura del recorrido nuevo:** falta E2E diagnóstico PR50 autenticado→selección humana→borrador→revisión de actividad/responsable/fecha→activación→cola/seguimiento. Las pruebas existentes de plan desde señales demo y conversión desde brecha sintética no lo prueban.

Estos hallazgos delimitan trabajo futuro. No se aplicó ninguna corrección ni se abrió un PR adicional durante el cierre de PR50.

## E. Modelos que no deben duplicarse

Conservar `OperationalPlan`, `OperationalPlanVersion`, `OperationalPlanItem`, `OperationalPlanItemExecution`; `OrganizationGapAnalysis` para brechas descriptivas existentes; `SstAssessmentSession` para diagnóstico; `Membership`/`User`/`WorkCenter`; `AuditLog`; acciones, obligaciones, decisiones y evidencias de sus dominios; `EvidencePackage`/`EvidencePackageItem`; `TrainingNeed`; `OperationalSignal`.

No crear `DraftOperationalPlan`, `PlanTask`, otra `Action` genérica, otra lista de responsables, otro motor de prioridades, una tabla Work Queue o una copia mutable del diagnóstico. DRAFT ya es estado de `OperationalPlanVersion`; la cola ya es una proyección.

## F. Acoplamiento regulatorio y separación requerida

El agregado Plan no publica RuleVersion, no recalcula evaluación ni escribe estados de Anita. Su ejecución no representa conclusión de cumplimiento. La cola de ítems de plan mantiene `regulatoryContext:null` y `riskContext:null`.

Sí hay **acoplamiento de procedencia**: el generador incluye `ObligationExecution`, y brechas pueden venir de `UnifiedSstEvaluationItem` basado en requirements/rule drafts/unidades candidatas. Eso es reutilizable si conserva autoridad, fuente, revisión pendiente y límites. Actualmente la copia al plan pierde parte de esas marcas; UI solo muestra enum/ID. `APPROVED_REQUIREMENT` significa editorialmente aprobado para rule drafting, no aplicabilidad legal definitiva.

V1 debe distinguir explícitamente: recomendación de capacidad ≠ decisión humana; decisión de planificar ≠ aprobación profesional; actividad completada ≠ cumplimiento; referencia documental ≠ ley aplicable. La aprobación regulatoria y sus conclusiones permanecen en el dominio especializado. Los datos globales de producción siguen con cero reglas reales publicadas y revisión Anita pendiente; este inventario no autoriza cambiarlos.

## G. Frontera mínima recomendada para el siguiente PR

**«Diagnóstico autenticado finalizado → selección humana → borrador revisable en Plan Operativo existente».**

Un solo recorrido, sobre los modelos y servicios presentes:

- Leer el diagnóstico guardado del tenant, validar FINALIZED y selección explícita. Conservar assessmentId, hashes, versión del motor y claves/facts/procedencia relevantes del snapshot, sin reevaluar ni modificar el diagnóstico.
- Convertir selección a actividades concretas revisadas por la persona, con responsable/centro/plazo/referencias confirmados; persistir versión DRAFT del Plan existente. No activar por generación.
- Permitir revisar mediante nueva versión y activar usando permisos/locks existentes. Mostrar alcance, advertencias candidatas/revisión pendiente y recuperar errores; cargar miembros/centros mediante contexto organizacional independiente de inspecciones.
- Hacer atómica la auditoría del recorrido y seguro su reintento; no duplicar plan/versión por respuesta perdida. Mantener seguimiento mediante ejecución y proyección existentes. No afirmar una integración completa de evidencia canónica de ejecución hasta implementarla en un alcance explícito.
- Añadir contratos/integración/E2E que prueben tenant/rol, selección válida, no activación automática, rollback/reintento, preservación del diagnóstico, responsables/fechas y proyección solo tras activación. Afirmar que no cambian respuestas, puntajes, módulos, entitlements, publicación regulatoria ni review statuses.

Fuera: cambios al motor de capacidades/Adaptive/catalog/regulatory corpus, rediseño Cloud Design/Guided Setup, importación/parsing, AI generadora, recordatorios, comercial/pricing, arquitectura paralela y sincronización automática de ciclos especializados. No hay justificación demostrada para otra fundación ni migración en este inventario; cualquier necesidad de esquema futura debe probarse durante el diseño del alcance autorizado.

## Método y límites

Se revisaron directorios de planes/ejecución/inteligencia/cola, UI de lista y detalle, contratos/pruebas, Prisma y triggers, conversión de brechas, evidencia, capacitación, búsqueda, métricas, resultado del diagnóstico y registro de módulos. Búsqueda repo-wide de `OperationalPlan`, `operational plan`, `plan operativo`, `work plan`, `PlanItem`, `action`, `owner`, `dueDate`, `evidence`, `assessment`, `capabilityEvaluation`; 333 archivos coincidentes después de excluir lockfile y assets JSON/SVG/HTML. Es un inventario de código y riesgos, no una auditoría de contenido privado ni aceptación visual de una nueva funcionalidad.

Durante el cierre se verificaron PR/main/CI y metadatos de despliegue, GET públicos permitidos, SELECT de referencias globales en transacción PostgreSQL READ ONLY y paquete compilado del motor. No hubo creación de usuarios/organizaciones/sesiones/diagnósticos ni ningún POST de smoke en producción. El proyecto Vercel accidental permaneció intacto.

## PR51 implementation

Esta sección describe el alcance posterior autorizado para PR51. Las secciones anteriores conservan el inventario y los límites observados durante el cierre de PR50; sus referencias a funcionalidades ausentes corresponden a ese estado previo.

Se implementó el handoff de diagnóstico autenticado FINALIZED a selección humana, borrador DRAFT y revisión versionada en el dominio existente. El builder consume las recomendaciones guardadas y sólo convierte el subconjunto elegido; conserva fuente, versión, hash disponible y capacidades excluidas sin recalcular ni escribir el diagnóstico. No se inventan plazos, responsables por actividad, centro, frecuencia ni requerimientos de evidencia.

La UI permite iniciar desde el resultado, elegir sin selección inicial, confirmar metadatos, crear un borrador, revisar como N+1 y activar explícitamente con los permisos existentes. El acceso a planes durante setup se habilita únicamente cuando existe un diagnóstico finalizado. El contexto propio de planes evita el acoplamiento al permiso de inspecciones; FREE no recibe módulos adicionales.

La procedencia de ítems del handoff usa `UNIFIED_SST_EVALUATION` con una referencia compacta y snapshot inmutable; el producto muestra «Diagnóstico SST». La decisión humana queda en procedencia y audit de la versión, manteniendo intacto `humanDecision:PENDING` del resultado fuente.

La creación del handoff serializa claves UUID v4 por actor/organización mediante bloqueo transaccional y receipt en AuditLog, almacenando hash y fingerprint. Una respuesta perdida se recupera con el mismo plan; cambios de payload con la misma clave producen 409. Todas las filas nuevas y la auditoría se confirman o revierten juntas. También se incorporó audit dentro de las transacciones existentes de creación manual/generada, versionado, activación y transición. No se debilita la auditoría ni se necesita compensación.

La cobertura nueva incluye builder determinista/subconjunto, fuentes históricas, tenant/roles, contexto FREE, idempotencia concurrente y rollback obligatorio. Los E2E cubren el caso administrativo de dos centros a través del diagnóstico real, selección, revisión, activación/ejecución y reintento tras respuesta perdida. El generador desde señales existentes conserva su recorrido y regresiones independientes.

No se añadieron modelos ni migraciones; el motor permanece en 1.2.0 sin cambios de scoring. No hay autoactivación comercial, mutación de entitlements, creación de requisitos ni publicación regulatoria. Permanecen pendientes la evidencia canónica de ejecución, sincronización de ciclos especializados y selector completo de versiones; el alcance no declara cumplimiento legal. La especificación vigente está en [operational-plan-v1.md](./operational-plan-v1.md).

El smoke real de Staging detectó que un diagnóstico público reclamado conserva `channel:PUBLIC` como origen histórico. La elegibilidad se corrigió para usar acceso autenticado y tenant con claim confirmado, sin reescribir ese origen; una sesión pública sin claim continúa excluida. La regresión cubre evaluación pública finalizada → registro → empresa con dos centros → claim → selección → borrador, incluso con el snapshot PUBLIC en caché.

La inspección de capturas del smoke también mostró el período un día antes en America/Guayaquil: timestamps de medianoche UTC se convertían a fecha local. El detalle usa ahora días calendario UTC para el período, sin cambiar las fechas persistidas ni su semántica. E2E fija esa zona horaria y comprueba el período confirmado.

## PR51 — convergencia Cloud Design v1.1 y plan vigente

La pasada posterior a 18caa97 incorpora la decisión explícita sobre un plan vigente y el endpoint de incorporación server-side. El override de la solicitud prevalece sobre la propuesta del ZIP de reconstruir herencia en cliente: sólo se envían claves y metadata opcional, y la fuente, actividades, ejecuciones y provenance se cargan y copian en una transacción del servidor.

Se conserva el caso sin plan y se añade ACTIVE v2 con COMPLETED, IN_PROGRESS, PLANNED y CANCELED → nuevo DRAFT v3 con las cuatro heredadas + subconjunto diagnóstico PLANNED. La fuente permanece intacta; al activar se retira la anterior sin reiniciar estados. También se valida el linaje de origen durante la revisión ordinaria para no perder estados ni admitir snapshots operativos del navegador. Reintentos con receipt auditado, conflictos de payload/destino y rollback obligatorio se verifican con integración.

El detalle y listado presentan contexto, períodos, responsables, conteos reales y procedencia humana; la revisión crea N+1 con banda explícita, actividades compactas y editor a demanda. La activación requiere confirmación. Se corrige URGENT → Urgente usando el helper canónico. CSS local consume tokens existentes; no se copian prototipos ni se introduce un sistema visual paralelo.

Las superficies de importación del ZIP son documentación futura para PR52 o posterior. PR51 no implementa upload, almacenamiento, parser, candidato, matching ni llamadas LLM. Excel/CSV, original preservado, incertidumbre revisable y columnas no descartadas son principios futuros; Word/PDF permanecen diferidos. Continúan los límites de evidencia canónica, sincronización especializada y selector avanzado. Ninguna de estas decisiones muta motor 1.2.0, corpus, revisiones, módulos o suscripción, ni añade migraciones.
