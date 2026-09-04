# Conversational Operations V1

Status: controlled deterministic V1 closed in production on 2026-09-02. This capability is an
interface over existing domain services; it is not a second business engine, legal adviser or audit
authority.

## Domain boundary

Every thread is private to one authenticated user inside one active organization. The API resolves
the current membership on every request. A thread cannot change tenant, grant a role or make a
message authoritative. `ConversationThread`, `ConversationMessage`, `ConversationActionRun`,
`ConversationCitation` and `ConversationAttachmentReference` store interaction state only.

Domain mutations remain canonical in Inspections, Findings, Actions and Evidence. The action
registry does not import Prisma and cannot write domain tables. It calls the same application
services used by normal controllers, with the current organization, user, role, entitlements and
request metadata. Those services continue to create the canonical audit records.

## Allowlisted actions

Read actions are bounded to the current Work Queue, work item, inspection, Inspection Basis,
criterion and its stored provenance, RegulatoryUnit, evidence reference, worker, incident, EPP,
training, Work Permit and obligation context. `explain_work_item` explains only the stored queue
projection and its structured source links.

Initial writes are bounded to creating or starting an inspection, recording a criterion result,
linking evidence, explicitly creating a Finding, creating an Action and assigning an Action. All
writes require an `AWAITING_CONFIRMATION` action run followed by an authenticated confirmation.
There is no mutation inferred silently from message text.

Each action run has an organization-scoped idempotency key and request digest. Reusing the key for
a different actor, thread or request is rejected. A confirmed run is claimed atomically before its
domain service is called, so a repeated confirmation cannot invoke the service twice.

## Citations and evidence

Citations are structured references to exact stored entities: Inspection Basis version, technical
standard version, criterion, RegulatoryUnit, organization policy, Finding, Action or Work Queue
item. Source labels, jurisdiction, official locator and snapshots come from persisted relationships;
the provider cannot invent them. Foreign technical sources remain references in their own
jurisdiction and are not described as Ecuadorian law.

`get_criterion_provenance` returns an explicit stored-provenance projection: what the criterion
asks, exactly one `PRIMARY_TECHNICAL` source, zero-to-many `SUPPLEMENTAL_TECHNICAL` sources,
explicit `LEGAL_CONTEXT` RegulatoryUnits and zero-to-many `INTERNAL_ORGANIZATION` sources. The
same roles are retained in citation snapshots and rendered as separate human groups; they are not
collapsed into an untyped citation list.

Conversation attachments are reference-only. The existing domain receives the canonical criterion
reference or ActionEvidence; the conversation stores only the resulting destination type, ID and
human label. It is not a second evidence repository.

## Provider and untrusted-content boundary

Production uses `DETERMINISTIC_LOCAL_V1`. A separately configured controlled staging cohort may use
OpenAI/`gpt-5.6-terra` only through the existing provider token and the server-side LOW-data
minimizer. Free text, worker PII, sensitive contexts, local source labels and evidence binaries are
not transferred. See
[OpenAI Controlled Staging Integration V1](../architecture/openai-controlled-staging-v1.md).

Prompt or source content cannot select an arbitrary action, override membership, switch tenant,
skip confirmation or change deterministic risk results. Domain errors and authorization failures
are shown as failures; the assistant does not fabricate a fallback result.

## Retention and commercial boundary

V1 follows existing tenant-data deletion semantics. A special long-term legal retention period has
not been invented and remains a future privacy decision. The capability adds no FeatureDefinition,
PlanFeature assignment, tier or pricing rule.

## Production closure evidence

PR #34 merge `c90065822aee358a2716a1b2b6e7d93d7cbeb8a0` passed first-attempt main CI and
automatic production deployment. A synthetic production thread returned only authorized Work Queue
items, explained stored citations, resolved an active multi-source Inspection Basis, created and
started an Inspection, recorded a criterion result, linked an evidence reference, created one
Finding using the canonical risk service and created one assigned corrective Action. Every material
mutation first displayed an `AWAITING_CONFIRMATION` proposal; the resulting Action appeared once in
the canonical Work Queue after reload.

Switching the active organization hid the prior tenant's thread and domain records. Integration
remains authoritative for cross-tenant denial and same-key replay races. Production continues to
identify the provider as `DETERMINISTIC_LOCAL_V1` and requires no external AI secret. The staging
candidate does not change that production closure.
