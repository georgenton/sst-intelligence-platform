# Conversational Operations V1

Status: implementation in review. This capability is an interface over existing domain services;
it is not a second business engine, legal adviser or audit authority.

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

V1 uses `DETERMINISTIC_LOCAL_V1`. It recognizes a very small exact read intent and requires
structured UI actions for everything else. It needs no external secret, sends no worker PII or
evidence binary to a vendor and never treats source/evidence text as instructions. Production
natural-language provider selection, external processing terms and privacy review are **PENDING
PRODUCT/INFRA DECISION**.

Prompt or source content cannot select an arbitrary action, override membership, switch tenant,
skip confirmation or change deterministic risk results. Domain errors and authorization failures
are shown as failures; the assistant does not fabricate a fallback result.

## Retention and commercial boundary

V1 follows existing tenant-data deletion semantics. A special long-term legal retention period has
not been invented and remains a future privacy decision. The capability adds no FeatureDefinition,
PlanFeature assignment, tier or pricing rule.
