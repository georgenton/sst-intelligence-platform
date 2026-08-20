# Adaptive Configuration Session V1

A session is organization-private and references an exact Profile Version and Adaptive Rule Pack
Version. At creation the server snapshots one organization scope and selected work-center identities;
the browser cannot assert organization ownership, country, sector, work-center count or center IDs.

Answers are typed against exact Fact Versions. They may be corrected only while collecting
information. Every mutation uses optimistic `sessionRevision`; stale commands fail. Each evaluation
persists immutable input/output snapshots, hashes, questions, proposal and configuration items.
Finalization freezes answers and later changes require a new session.

Proposal items preserve target version, scope, state, minimum depth, professional-review flag,
rule/requirement provenance, missing facts, evidence suggestions and traces. Session-scoped current
state supports six declared statuses. Evidence is limited to a bounded note or HTTPS external link,
is never fetched by the server and remains declared/unverified. No score is derived.
