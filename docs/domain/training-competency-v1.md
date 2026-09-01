# Training & Competency V1

Status: implemented on the V1 feature branch; external review required before merge.

## Scope

Tenant-private Training Definitions, Worker competency requirements, sessions, participants,
attendance and immutable completions support scheduling and renewal. V1 is not an LMS, content or
video platform, exam engine, certification authority or regulatory compliance score.

## Deterministic state

Session status is Draft, Scheduled, Completed or Cancelled. Attendance is Pending, Present, Absent
or Partial. Competency presentation derives `Current`, `Due soon`, `Expired` or `Not completed`
from the active requirement, latest completion and validity dates. It does not infer legal
compliance.

## Invariants

- Participants are Workers, not Memberships; they do not need a SaaS account.
- Definition, Worker, Work Center, Requirement and session references are tenant-safe.
- A session/Worker completion is unique and concurrency-safe.
- Renewal creates a new completion and preserves prior evidence/certificate references.
- Regulatory requirement links retain candidate/approved editorial state; completion never
  publishes or approves a Rule.

Active requirements without completion, due-soon/expired completion and session follow-up project
into the shared Work Queue only when an actionable basis exists. Exact deep links return to the
Worker requirement/completion or source Training Session, while the Worker Workspace preserves all
completion and renewal history.
