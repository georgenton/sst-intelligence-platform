# ADR — Límites de Adaptive SST, Field y Management Intelligence V2

Estado: **ACCEPTED**. Fecha: 2026-09-08.

## Decisión

Se mantienen dimensiones independientes:

`Legal Applicability != Operational Risk != Inspection Depth != Business Priority != Risk Appetite != Work Queue Priority`.

Inspection Depth se limita a `BASIC`, `TECHNICAL` y `SYSTEMIC`, se exige explícitamente para toda inspección nueva, se guarda con versión y guidance, y no reemplaza Resource Scope, Basis ni RiskMethodVersion. Las inspecciones históricas quedan con profundidad nula, se presentan como `No registrada (inspección histórica)` y no reciben backfill semántico.

La búsqueda operacional usa PostgreSQL Full Text Search con índices GIN, filtro tenant en cada rama SQL, paginación acotada y orden estable. No se añade Elasticsearch, embeddings ni vector DB.

Management Intelligence calcula desde registros canónicos. Las series de riesgo se agrupan por RiskMethodVersion exacta; métodos distintos nunca comparten promedio o score agregado. Un residual nulo se excluye y no se convierte en LOW. No existe Worker Safety Score, ranking o predicción.

Field V1 es una experiencia web/PWA instalable. No incluye service worker, persistencia offline, cola de mutaciones, CRDT ni backend móvil separado.

No se crea un aggregate Notification. Work Queue y Operational Signals ya representan atención con deep links al origen. Duplicarlos produciría una segunda verdad. Escalación se limita a reglas existentes de vencimiento, prioridad explícita y revisión pendiente; no infiere emergencias legales.

## Consecuencias

- Search indexa una proyección técnica, nunca estado canónico.
- Analytics es factual y tenant-scoped desde la consulta.
- PWA necesita red para escribir y presenta ese límite de forma explícita.
- Cualquier futura notificación externa referenciará un aggregate real y requerirá otro gate.

## Cierre de producción

PR #44 quedó production closed el 2026-09-08 desde el HEAD auditado
`894b12791f65f7ad42f57dc2ccb3183dc8889f62`, merge
`38a704dd757364bfed498b8c130eb6ded745e80c`. El Quality Gate de `main` 34295675414 pasó en intento
1; la migración aditiva 33 quedó aplicada sin pendientes, backfill ni cambio de históricos. Railway
y Vercel Demo desplegaron automáticamente el merge exacto y staging production permaneció aislado.

Este cierre no cambia las decisiones del ADR. Business Continuity/Insurance continúa design-only,
Ergonomics requiere una metodología revisada antes de integración y Psychosocial permanece limitado
a arquitectura y frontera de datos.
