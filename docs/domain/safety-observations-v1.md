# Safety Observations V1

Status: implemented on `feat/workforce-safety-product-refinement-v2`; external review required.

## Boundary

`SafetyObservation` is an authenticated, tenant-private report of an unsafe act, unsafe condition,
preventive observation, good practice, housekeeping issue, EPP issue or other observed risk outside
a planned Inspection. It is not an Inspection, Finding or Incident and creates none of those
records automatically.

V1 records title, bounded description/category, Work Center, optional compatible Work Area,
observation time, reporter, internal priority, status and optional active-member assignee. Notes and
HTTPS references use the same bounded evidence semantics as Incident evidence; V1 adds no upload
pipeline. An existing same-tenant `ObligationExecution` can be linked explicitly as follow-up,
preserving Action as the canonical execution lifecycle.

## Lifecycle and authority

The finite lifecycle is `OPEN → UNDER_REVIEW → ACTION_REQUIRED → RESOLVED`, with explicit
professional resolution and a bounded `CLOSED_NO_ACTION` path. Terminal transitions require a
human-authored resolution note. Optimistic version checks prevent stale concurrent transitions.

Owner, Admin and SST Manager may perform professional transitions. Existing Incident write roles
may create observations, evidence and action links; Viewer is read-only. API role, entitlement and
organization guards are authoritative.

Open, under-review and action-required observations project into Work Queue with the canonical
observation ID, priority, assignee, Work Center and deep link. Work Queue has no independent copy of
the lifecycle, and resolved/closed observations disappear from attention.

## Safety and deferred scope

All references are validated against the active organization, including Center/Area compatibility,
assignee Membership, Incident, Finding and Action. No external LLM receives observation free text.
Anonymous/QR reporting, public intake, mobile/offline capture, notifications and automatic
conversion are **DEFERRED**. Intake terminology and alert criteria are **PENDING ANITA**.
