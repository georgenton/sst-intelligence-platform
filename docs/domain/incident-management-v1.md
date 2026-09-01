# Incident Management V1

Status: authorized bounded operational workflow.

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

SUT/IESS filing, statutory deadlines and legal reportability are deferred reviewed regulatory
workflows.
