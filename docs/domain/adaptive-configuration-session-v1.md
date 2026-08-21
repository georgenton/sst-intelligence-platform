# Adaptive Configuration Session V1

A session is organization-private and references an exact Profile Version and Adaptive Rule Pack
Version. The Pack Version must already be sealed; this is enforced by both the application query and
a database trigger. At creation the server snapshots one organization scope and selected work-center
identities; the browser cannot assert organization ownership, country, sector, work-center count or
center IDs.

Answers are typed against exact Fact Versions. They may be corrected only while collecting
information. The API also requires the answer scope kind to match the Fact Version default scope; a
work-center rule can read its current center plus organization facts, never a sibling center. Every
mutation uses an atomic optimistic `sessionRevision` claim in a serializable transaction; concurrent
commands have exactly one winner and serialization conflicts become controlled 409 responses. Each
evaluation persists immutable input/output snapshots, SHA-256 hashes, questions, proposal and
configuration items. A session retains at most 100 append-only evaluation runs and refuses another
evaluation without deleting history.

Finalization freezes fact answers and reevaluation; later deterministic evaluation requires a new
session. Current State declarations and NOTE/HTTPS evidence remain operationally editable after
finalization because they are explicitly separate from evaluation. Those changes cannot alter an
existing run, proposal item state, minimum depth, professional-review flag, rule trace or hashes.

Proposal items preserve target version, scope, state, minimum depth, professional-review flag,
rule/requirement provenance, missing facts, evidence suggestions and traces. Session-scoped current
state supports six declared statuses. Evidence is limited to a bounded note or HTTPS external link,
is never fetched by the server and remains declared/unverified. No score is derived.
