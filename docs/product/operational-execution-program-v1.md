# Operational Execution Program V1

Status: implementation complete and awaiting external review on baseline
`861218c38e5d2bba1f2bd0d0623f104cda862bbf`.

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

## Cross-cutting gates

- Auth coordinator, AbortSignal/session generation and API authorization remain unchanged.
- No new commercial feature key unless an explicit product decision is made.
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

Blocks A, B, C, D and the bounded Block F are implemented. Block E is safely `DEFERRED` because the
ordered artifacts require human transcription/review before exact structure can be asserted; no
regulatory corpus records changed. No stop condition requiring a product, pricing, legal or Anita
decision was triggered.
