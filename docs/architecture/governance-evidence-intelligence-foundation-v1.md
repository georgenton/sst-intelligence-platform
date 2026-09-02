# Governance, Evidence and Intelligence Foundation V1

Status: implementation candidate in Draft PR #35.

## Governance

Governance is organization-scoped and records bodies, members, meetings, agenda, decisions,
actions and evidence. `Worker` and `User/Membership` remain distinct: a worker may participate
without a SaaS account, while chair/secretary system actors use an active membership. A decision is
not an action; actionable commitments project into the shared Work Queue.

Regulatory references preserve source review/editorial status. A committee name, reference or
meeting never causes the platform to infer mandatory composition, frequency, member count or legal
deadline.

## Evidence packages

An evidence package stores canonical object references and minimal provenance rather than copying
domain records. Finalization creates a versioned manifest, generation metadata and SHA-256 digest.
The service and database both prevent mutation after finalization; regeneration means creating a
new package. V1 provides print-friendly rendering and does not introduce a PDF service.

The representation is a “Paquete de evidencia” / “Resumen documental” of state registered in the
platform. It is not a certification, guaranteed legal-compliance statement or approved audit.

## Operational intelligence

Operational signals are deterministic derivatives, never canonical source decisions. V1 has two
documented platform-default rules:

- `REPEATED_FINDING_90D_V1`: at least 3 findings with the same normalized category at one work
  center in 90 days.
- `OVERDUE_ACTION_CLUSTER_90D_V1`: at least 3 open overdue actions at one work center whose records
  are within the same 90-day operational window.

The values 3 and 90 are operational defaults without legal meaning. Each signal stores its rule
version, window, source IDs, observed count and source digest. A repeated pattern does not establish
root cause. Only active signals requiring professional review enter the shared Work Queue.

Work-center views aggregate factual module counts. Worker views expose factual records and work
center context, with `workerSafetyScore` and `workerRating` explicitly null.

## Commercial and reference-data boundaries

This foundation creates no pricing decision, PlanFeature or paid-tier assignment. Governance
bodies, evidence packages and operational signals are customer records and are never created by
global reference synchronization.
