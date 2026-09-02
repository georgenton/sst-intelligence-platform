# Governance, Evidence and Intelligence Foundation V1

Status: production closed. Runtime baseline: PR #35 merge
`c1f0eb18f133c325d373708e02d823e27717567f`, verified on 2026-09-02.

## Governance

Governance is organization-scoped and records bodies, members, meetings, agenda, decisions,
actions and evidence. `Worker` and `User/Membership` remain distinct: a worker may participate
without a SaaS account, while chair/secretary system actors use an active membership. A decision is
not an action; actionable commitments project into the shared Work Queue.

One physical person has one body-scoped identity key. A worker linked to a user and that user's
membership both resolve to `USER:<userId>`; a worker without an account resolves to
`WORKER:<workerId>`. A database uniqueness constraint prevents either representation from adding
the same person twice. Meeting participants preserve the identity key, display name and governance
role captured when the meeting is created. Current worker/membership activity is returned
separately, so later deactivation does not erase or reinterpret the historical participant.

Regulatory references preserve source review/editorial status. A committee name, reference or
meeting never causes the platform to infer mandatory composition, frequency, member count or legal
deadline.

## Evidence packages

An evidence package stores canonical object references and minimal snapshot provenance rather than
copying full domain records. Draft item metadata is provisional. Finalization revalidates tenant
ownership and re-resolves every source inside one serializable transaction, then freezes the
captured label, state, relevant dates, version identifier, provenance and content digest where one
exists. It creates a versioned manifest, generation metadata and SHA-256 digest. Finalized and
archived rows, items, metadata and ordering are immutable in both service and database;
regeneration means creating a new package. Source references are intentionally not cascading
foreign keys, so later source deactivation does not make the historical package unreadable. V1
provides print-friendly rendering and does not introduce a PDF service.

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

The logical fingerprint includes the rule key and exact rule version plus its organization,
work-center and grouping inputs. Re-evaluating identical inputs updates one signal behind a unique
database key and the Work Queue remains a derived projection, not another stored item. When a rule
no longer produces a candidate, an active signal becomes `CLOSED` and immediately leaves the Work
Queue while its last historical explanation and provenance remain available. A future rule version
therefore produces a new identity instead of rewriting the historical reason of an older signal.

Work-center views aggregate factual module counts. Worker views expose factual records and work
center context, with `workerSafetyScore` and `workerRating` explicitly null.

## Commercial and reference-data boundaries

This foundation creates no pricing decision, PlanFeature or paid-tier assignment. Governance
bodies, evidence packages and operational signals are customer records and are never created by
global reference synchronization.

## Production closure

The production smoke used only the existing synthetic `Demo Operativa Integral` organization. It
created `PRUEBA SISTEMA — COMITÉ SST V1`, added one active organization member without duplicating
that person as a Worker, and moved `PRUEBA SISTEMA — REUNIÓN GOVERNANCE V1` through `DRAFT`,
`SCHEDULED` and `HELD`. The meeting retained an agenda item, participant identity snapshots and a
note. Its synthetic decision had no RegulatoryUnit or Requirement association and produced one
GovernanceAction with exactly one Work Queue projection after reload. Integration coverage remains
authoritative for the proof that `personKeySnapshot`, `displayNameSnapshot` and
`roleLabelSnapshot` remain interpretable after the current Worker or Membership becomes inactive;
the authenticated User remains the audit actor.

Evidence Package A finalized the meeting while its current state was `DRAFT`. It stored
`EVIDENCE_PACKAGE_MANIFEST_V1`, generation actor/time, scope, deterministic item ordering, a
64-character SHA-256 manifest digest and `certificationClaimed=false`. After the meeting reached
`HELD`, Package A still rendered the captured `DRAFT` state. A new Package B captured `HELD`
without replacing Package A. Database triggers and integration tests remain authoritative for the
negative mutation proof on finalized and archived manifests and items.

Production evaluation of existing synthetic findings created one active
`REPEATED_FINDING_90D_V1@1.0.0` signal for four normalized `electrical` findings in the same Work
Center. Re-evaluation updated the same identity and preserved exactly one Work Queue projection.
Integration coverage remains authoritative for concurrent uniqueness and for closure: when the
condition becomes false the historical signal becomes `CLOSED` and its actionable projection
disappears.

The conversational provider remains `DETERMINISTIC_LOCAL_V1`, with local controlled processing and
no external provider or secret. Provider selection remains `PENDING_EXTERNAL_PRODUCT_DECISION`.
Unknown citation IDs and Action Registry actions are rejected, material writes still require
explicit confirmation, and provider capabilities exclude final risk decisions, legal-compliance
decisions and automatic root-cause decisions.
