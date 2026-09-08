# Incident Management V1

Status: implemented on the V1 feature branch; external review required before merge.

## Scope

An Incident records a factual event or near miss in an authenticated Organization and optional Work
Center. It may reference Workers, an Inspection, Finding or Technical Assessment when the reference
belongs to the same tenant. It does not store diagnoses or decide statutory reportability.

## Lifecycle

The deterministic lifecycle is `DRAFT → REPORTED → UNDER_INVESTIGATION → ACTIONS_IN_PROGRESS →
CLOSED`, with bounded cancellation paths. Closing requires a completed professional investigation
and every non-cancelled Incident Action to be completed. Optimistic version checks prevent a stale
close/action race.

## Investigation and factors

An `IncidentInvestigation` records the professional summary, actor and timestamps.
`IncidentContributingFactor` records observed or suspected factors under neutral categories:
Task, Equipment, Environment, Organization, Procedure, Training or Other. The system never names an
automatic root cause or implies blame.

## Actions, evidence and projections

Incident Actions retain their own lifecycle, owner, due date, priority, evidence and verification.
Pending investigation and open/overdue actions project into the existing Operational Work Queue and
Command Center with canonical Incident deep links; the queue never mutates the source lifecycle.
The Worker Workspace queries incidents through a tenant-scoped Worker filter and retains closed and
inactive-Worker history.

SUT/IESS filing, statutory deadlines and legal reportability are deferred reviewed regulatory
workflows.

## Accidentes e Incidentes V2 candidate

Status: implemented on `feat/workforce-safety-product-refinement-v2`; external review required.

Spanish product navigation now says **Accidentes e Incidentes**. New records select a bounded event
location (`OWN_FACILITY`, external/client facility, public road, remote work or other) and an
internal attention priority. These fields guide Work Queue presentation only; neither determines
legal responsibility, reportability, severity, causality or compliance. Both are nullable for
truthful legacy history.

Investigations may declare a structured-factors, Ishikawa or other professional method. The
Ishikawa surface groups bounded contributing factors and evidence. The final investigation summary
is written by an authorized professional; no automatic root cause exists. Same-tenant EPP issues
can be linked explicitly and remain separately historical. Worker, Position (through Worker), Work
Center, Work Area, Evidence, factors and actions remain traceable through their canonical records.

Location wording, factor categories and professional investigation refinements are **PENDING
ANITA**. Legal filing and automatic submissions remain **DEFERRED**.
