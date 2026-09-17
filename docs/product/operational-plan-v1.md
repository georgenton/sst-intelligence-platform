# Plan Operativo V1

Existe un solo dominio de planificación: `OperationalPlan`, sus versiones inmutables, sus ítems y sus ejecuciones. V1 reutiliza esas entidades y las 34 migraciones existentes.

## Fuentes y decisión humana

Se mantienen la creación manual, el generador determinista desde señales existentes y la conversión explícita desde brechas. El nuevo handoff usa exclusivamente `latestResult.capabilityEvaluation` de un `SstAssessmentSession` accesible mediante la API autenticada, FINALIZED y perteneciente a la organización activa. Una evaluación pública reclamada conserva `channel:PUBLIC` como origen histórico; su vínculo de tenant y claim confirmado permiten el handoff autenticado. Una sesión pública sin claim no es elegible. No vuelve a ejecutar el motor ni modifica el diagnóstico histórico. Un diagnóstico sin ese resultado conservado requiere una nueva evaluación para utilizar el handoff.

La pantalla de selección empieza sin capacidades marcadas. La persona elige un subconjunto y confirma nombre, descripción opcional, período y responsable general opcional. Cada capacidad elegida produce un frente de trabajo inicial con su título, descripción y prioridad guardados. No se inventan responsable por actividad, centro, fechas, frecuencia ni evidencia exigida. Esos datos se completan durante la revisión.

La decisión se conserva en la procedencia de la versión y su auditoría: diagnóstico fuente, versión del motor, hash de salida si existe, capacidades seleccionadas y excluidas y `createdFrom:SST_ASSESSMENT`. El `humanDecision:PENDING` del resultado original permanece intacto. Decidir planificar no equivale a aprobar una interpretación regulatoria.

## Borrador, revisión y activación

La creación siempre produce una versión DRAFT. Revisar el borrador utiliza `POST /operational-plans/:planId/versions` y crea N+1; no modifica el contenido de una versión anterior. La revisión conserva la procedencia y permite cambiar actividades, responsables, centro, fechas, prioridad, frecuencia y referencias de evidencia.

La activación es una acción explícita permitida a ORG_OWNER, ORG_ADMIN y SST_MANAGER. Conserva la exclusión de versiones activas por organización mediante el bloqueo existente. La ejecución utiliza los estados y conflictos optimistas existentes. Work Queue sigue siendo una proyección de atención de ítems activos, no el inventario completo del plan.

## API, contexto y seguridad de reintento

`GET /operational-plans/context` devuelve centros activos y miembros activos de la organización autenticada, con ID, nombre visible y rol. No depende del permiso de inspecciones ni concede entitlements; funciona con FREE y `module.inspections=false`.

`POST /operational-plans/from-assessment/:assessmentId` acepta únicamente metadatos del plan y claves seleccionadas. Autoriza los roles de escritura existentes, valida fuente, selección y responsable dentro del tenant y deriva los ítems del resultado persistido.

El `Idempotency-Key` opcional debe ser UUID v4. La UI lo conserva en sessionStorage por usuario, organización y diagnóstico hasta una respuesta exitosa. El backend almacena sólo su hash con namespace de actor y organización, más el fingerprint normalizado de la solicitud. Un bloqueo transaccional serializa reintentos concurrentes: el mismo payload devuelve el mismo plan; otro payload con la misma clave responde 409. Actores diferentes tienen namespaces independientes. Si no hay clave, una nueva solicitud es una nueva creación explícita.

Plan, versión, ítems, ejecuciones y auditoría obligatoria se escriben en una sola transacción. Un fallo de auditoría revierte todas esas filas; no se requiere compensación. La misma atomicidad se aplica a creación manual/generada, nueva versión, activación y transición de ejecución. Los errores del handoff son acotados y no exponen detalles de Prisma. Una respuesta de red perdida puede recuperarse repitiendo la misma solicitud y clave.

Cada ítem usa el tipo existente `UNIFIED_SST_EVALUATION` con referencia estable `assessmentId:capabilityKey` y un snapshot compacto de título, descripción, motivos, prioridad, versión y hash disponible. La UI presenta «Diagnóstico SST» y la versión del motor; no muestra claves internas, scores, hashes ni DSL.

## Límites y pendientes

Crear, revisar, activar o ejecutar este plan no activa módulos, cambia suscripciones o entitlements, publica reglas, crea requisitos legales, recalcula recomendaciones ni cambia las revisiones de Anita. Una actividad completada no representa cumplimiento legal.

Quedan fuera de V1: evidencia canónica de ejecución del ítem, sincronización de ciclos de acciones u obligaciones fuente, programación de recurrencias, calendario, notificaciones, Gantt, dependencias, presupuesto, AI generadora y aprobación regulatoria. Las referencias de evidencia siguen siendo strings del contenido versionado, con las validaciones existentes. El historial resumido no ofrece todavía un selector completo de todas las versiones activas e históricas.

La auditoría previa y el alcance implementado se conservan en [operational-plan-v1-current-state-audit.md](./operational-plan-v1-current-state-audit.md).
