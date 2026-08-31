# Operational Execution Program V1

Status: production program complete; Team & Invitations operational-enablement candidate is in
external review from main baseline `74d7e0384cb8314dccfa48fd1a9a2f83fab58df7`.

## Outcome

Turn candidate/internal obligations and existing actionable domain state into tenant-safe,
auditable work. The program answers **“¿Qué necesita mi atención hoy?”** without inventing legal due
dates, collapsing specialized lifecycles or assigning opaque AI priority.

## Block A — Obligation Execution

Add a concrete tenant-private `ObligationExecution` domain. Origins are finite:
`APPROVED_REQUIREMENT`, `CANDIDATE_REQUIREMENT`, `INTERNAL_PROGRAM`, `MANUAL`. Candidate provenance
must remain visible and cannot be presented as final law.

Lifecycle: `OPEN`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_REVIEW`, `COMPLETED`, `CANCELLED`.
Completion respects evidence and professional-review requirements. Dates are manual or
program-driven in V1; no statutory date is inferred from MDT Art. 18/19. Organization evidence,
regulatory evidence and risk-verification evidence remain separate concepts. Material transitions
are transactional/concurrency-safe and tenant validated.

## Block B — Operational Work Queue

Build a read projection, not a replacement aggregate. V1 sources: inspection actions, overdue
actions, Technical Risk pending review/`NEEDS_REVISION`, pending Regulatory Expert Review,
Obligation Execution and actionable systemic-review follow-up.

Ordering is transparent: overdue high/safety-relevant actionable work, due soon, professional
review, blocked, then normal open work. Never rank different methods by raw score. Filters cover
status, work center, assignee, due state, source module and priority. Queries are indexed,
tenant-scoped and avoid N+1 behavior.

## Block C — Command Center V2

Refactor `/app` into Necesita atención, Estado operativo and Análisis. Attention uses compact direct
links, human empty states and no dead-end cards. The layout becomes denser without implementing an
arbitrary user density selector.

The production-closure root cause was a mutually exclusive render branch: the
`not-yet-configured` state was evaluated before queue error and queue item state, so setup guidance
replaced actionable work. The repaired precedence is deterministic: queue items first; setup only
as a secondary recommendation when those items coexist with incomplete configuration; setup as the
primary empty state only with zero actionable work. Configured organizations with zero work retain
the healthy operational empty state. The Command Center consumes the queue's existing order and
does not calculate another priority.

## Block D — Workspace UX V2

Implement shared workspace primitives and two bounded pilots: Inspection/Finding and Technical
Risk. Preserve deep links and progressively disclose secondary/context/technical information. See
[Workspace UX V2](../architecture/workspace-ux-v2.md).

## Block E — safe documentary expansion

Attempt verified, non-OCR documentary structure in this order: IESS C.D.513, MDT-2024-196 Annex 3,
Decreto Ejecutivo 255, MDT-2024-196 Annex 2, then another verified artifact. If trustworthy exact
text is unavailable, defer and continue. Do not add Requirements, RuleDrafts, RuleVersions or legal
interpretations. Runtime assets stay under `/app/regulatory` and pass deterministic source/image
parity.

## Block F — Critical Work Permits V1

Add bounded `PermitTemplate`, immutable `PermitTemplateVersion` and tenant-private `WorkPermit`.
Lifecycle: `DRAFT`, `PENDING_APPROVAL`, `AUTHORIZED`, `ACTIVE`, `SUSPENDED`, `CLOSED`, `CANCELLED`.
The first template is generic INTERNAL/DEMO and makes no Ecuador compliance claim. Approval roles
are conservative; VIEWER cannot authorize and self-approval is constrained. Pending approval,
suspended and due/expiry work joins the shared Work Queue and Command Center.

`module.work_permits` is the dedicated API-authoritative capability. V1 provides it only as a
bounded preview while an organization has an active demo window. Expiry removes access and Work
Queue permit projections without deleting or rewriting stored permit history. The global
`FeatureDefinition` is created by production-safe reference sync; no commercial `PlanFeature`
assignment is created. Future commercial packaging is **PENDING PRODUCT DECISION**.

## Block G — Organization Team & Invitations V1

Make the existing tenant membership model operational without adding an admin backdoor or email
provider. Owner/Admin can create a seven-day, hash-only, single-use invitation and manually copy its
link. The authenticated invitee must use the matching normalized email. Transaction locks and
uniqueness protect double accept and accept/revoke races. Members can read their team; Owner/Admin
can change or deactivate non-owner access while retaining history and audit.

Work Permit creation now selects a different eligible approver from active same-organization
members. The API validates tenant, current role and assignment, while the Work Queue projects
pending approval to that person. Team Management introduces no feature or pricing key; Work Permit
preview packaging remains unchanged. See
[Organization Team & Invitations V1](../domain/organization-team-invitations-v1.md).

## Cross-cutting gates

- Auth coordinator, AbortSignal/session generation and API authorization remain unchanged.
- Product capabilities may be defined independently of pricing. `module.work_permits` has one
  global definition and zero commercial plan assignments in V1.
- No historical finding, residual valuation, legacy Technical Risk or regulatory evaluation is
  recalculated.
- GTC45 is not Ecuadorian law; LOW is not zero; no full copyrighted text is stored.
- Candidate interpretation is not final law; no compliance/gap score or root-cause claim.
- Real published regulatory RuleVersions remain zero; Anita approval is never invented.
- Reference sync remains global, deterministic, idempotent, drift-protected and customer-data free.
- Fresh migrations, repeated sync, actual Railway Dockerfile, full integration and Playwright with
  one worker/zero retries are final gates.

## Stop conditions

Stop only for required new legal/professional decisions, rule publication, destructive migration,
historical recalculation, manual real-customer mutation, pricing/entitlement strategy, unsafe tenant
isolation, history collapse, unreviewed OCR reconstruction, copyrighted GTC45 storage or weakened
auth/security. Normal engineering tradeoffs are decided and documented.

## Implementation closure

Blocks A, B, C, D and the bounded Block F are in production. Block G is implemented as a candidate
pending external review. Block E is safely `DEFERRED` because the ordered artifacts require human
transcription/review before exact structure can be asserted; no regulatory corpus records changed.
No stop condition requiring a product, pricing, legal or Anita decision was triggered.
