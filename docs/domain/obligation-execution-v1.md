# Obligation Execution V1

Status: implemented in Operational Execution Program V1.

## Boundary

`ObligationExecution` is tenant-private operational work. It does not convert a regulatory source,
article, Requirement candidate or platform interpretation into law. Its organization is always the
validated authenticated context; request bodies cannot select tenant authority.

Origins are `APPROVED_REQUIREMENT`, `CANDIDATE_REQUIREMENT`, `INTERNAL_PROGRAM` and `MANUAL`.
Approved and candidate origins validate the referenced global editorial record. Candidate state is
preserved in the immutable provenance snapshot and in the primary UI. Internal/manual origins
require their own documented reference.

## Lifecycle and concurrency

The lifecycle is:

```text
OPEN → IN_PROGRESS ↔ BLOCKED
IN_PROGRESS → READY_FOR_REVIEW → COMPLETED
IN_PROGRESS → COMPLETED
OPEN | IN_PROGRESS | BLOCKED | READY_FOR_REVIEW → CANCELLED
```

Invalid transitions are rejected by the pure contract. Mutations carry `expectedVersion`; an
outdated writer receives `409 Conflict`. Completion requires recorded evidence when an evidence
expectation exists. A review-required item can finish only through professional review.

## Evidence and professional review

Organization evidence is stored separately from regulatory evidence and risk-verification
evidence. V1 accepts bounded notes and HTTPS references. Material mutations produce audit records.

Professional review targets are deterministic: `APPROVED` completes the activity and
`NEEDS_REVISION` returns it to `IN_PROGRESS`. Only `ORG_OWNER`, `ORG_ADMIN` and `SST_MANAGER` may
perform that transition. Review and completion do not certify legal compliance.

## Data and query safety

Every list, read and mutation includes the validated `organizationId`. Work-center and assignee
references are checked against that organization. Foreign-tenant identifiers return no usable
record. Indexes cover organization/status, work center/status, assignee/status and due-date access.

## Historical safety

The provenance snapshot captures the selected origin, editorial status, exact RegulatoryUnit hash
when present and reference identifiers at creation. Later editorial change does not rewrite that
snapshot. Existing inspections, risk results and regulatory evaluations are not recalculated.
