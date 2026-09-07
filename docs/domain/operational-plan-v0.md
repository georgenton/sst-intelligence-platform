# Plan Operativo Macro V0

Status: implementation candidate; pending external audit and merge.

## Purpose and boundary

The Plan Operativo is the organization-owned, versioned source of planned SST work. It answers
“what did we decide to do during this period?” The Operational Work Queue answers “what requires
attention now?” and remains a computed projection. The queue never stores or replaces a plan.

```text
OperationalPlan identity
→ immutable OperationalPlanVersion
→ immutable OperationalPlanItem + provenance
→ mutable OperationalPlanItemExecution
→ attention-only Work Queue projection
```

## Creation paths

- **Ya tengo un plan** records a structured manual draft. References are labels or HTTPS evidence
  references; uploaded documents never become structured truth automatically.
- **Ayúdame a crear uno** creates a deterministic draft only from current open corrective actions,
  obligation executions and open inspection recurrence alerts already known to the active
  organization. Each generated item retains its exact source type and source ID. Candidate
  regulatory material is never relabeled as law.

Both paths create `DRAFT` version 1. Owner/Admin/SST Manager may activate a draft. Activation is
serialized on the organization row, retires the previous active version and preserves history.
There is no generic workflow engine.

## Execution and attention

Item definition and provenance are immutable. Execution has an optimistic version and the finite
transitions `PLANNED → IN_PROGRESS → COMPLETED` or cancellation from an open state. Work Queue
projects only active-version items that are not terminal and are high/urgent or due within seven
days. Every projected item links to `/app/plans/{planId}#item-{itemId}`.

## Authorization and tenancy

All reads use the authenticated active organization. Write roles are Owner/Admin/SST Manager/SST
Technician/Consultant; activation is Owner/Admin/SST Manager. Responsible users and Work Centers
are checked against current active membership and the same tenant. Database triggers reject
cross-tenant plan, version, item and execution references.

## Deferred

File parsing/import, reminders, commercial packaging, professional plan templates and legal
interpretation are outside V0.
