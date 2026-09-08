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

## Training Plan V2 candidate

Status: implemented on `feat/workforce-safety-product-refinement-v2`; external review required.

`TrainingNeed` records one explicit provenance type: Plan item, risk assessment, Position, EPP
requirement, Incident, Safety Observation, Finding, approved regulatory Requirement or manual
professional decision. Candidate Requirements are rejected from the approved-requirement path.
`TrainingAudience` targets a Position, Worker, Work Center, Work Area or named explicit group;
Workers remain independent from Memberships and do not need SaaS access.

Training definitions carry a bounded delivery classification: internal, external provider,
certification review required, certification confirmed or unknown. This is professional metadata,
not an automatic legal certification statement. Sessions may retain their Need, area and responsible
member while attendance, completion, evidence, validity and renewal continue using the V1 history.

The Training Plan surface assembles canonical sessions with provenance, audience context,
responsible/facilitator, date, modality, location, status and completion counts. Browser printing
adds manual signature placeholders; no electronic-signature or PDF engine was introduced. Plan
Operativo remains separate and may reference execution of a training program without owning the
specialized Training lifecycle.

Classification and certification guidance are **PENDING ANITA**. A complete LMS, exams, content
marketplace and electronic-signature provider are **DEFERRED**.
