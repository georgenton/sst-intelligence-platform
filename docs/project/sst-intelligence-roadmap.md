# SST Intelligence — master roadmap

Status: canonical cross-product roadmap. Detailed track documents may elaborate implementation but
must link here and must not redefine overall priority.

## Product destination

Build an SST Operating System + Professional Intelligence Layer: deterministic operational
execution, exact regulatory and methodological provenance, professional workflows and auditable
cross-module intelligence.

## Priority tracks

### A — Anita professional review

Parallel professional track covering the pending decisions listed in the
[master context](sst-intelligence-master-context.md#pending-professional-review--anita). It blocks
only work that requires those decisions; Codex must not invent them.

### B — Regulatory documentary expansion

Safely structure verified official text without turning structure into legal interpretation.
Priority: IESS C.D.513, MDT-2024-196 Annex 3, Decreto Ejecutivo 255, MDT-2024-196 Annex 2 and then
remaining verified artifacts. Unreviewed OCR or LLM reconstruction is deferred.

### C — Operational execution core — implemented in production

Deliver Obligation Execution, the Operational Work Queue and Command Center V2 so the platform can
answer “¿Qué necesita mi atención hoy?”. See
[Operational Execution Program V1](../product/operational-execution-program-v1.md).

Actionable queue work has absolute presentation precedence over onboarding. Setup guidance remains
the primary empty state only when the organization is unconfigured and the queue has no actionable
items.

### D — Critical Work Permits — bounded V1 implemented in production preview

Start with a bounded generic internal/demo permit lifecycle. Sector-specific or legal templates wait
for approved professional/legal content. The dedicated `module.work_permits` capability is enabled
only for an active bounded demo in V1. No commercial plan assignment or pricing decision has been
made; future packaging is **PENDING PRODUCT DECISION**.

### D.1 — Organization Team & Invitations — production closed

Foundational B2B team management closes the operational separation-of-duties gap: Owner/Admin
manual-link invitations, authenticated matching-email acceptance, conservative role management,
non-destructive deactivation and audit. Work Permit requesters select a different active same-tenant
Owner/Admin/Responsible SST approver. No email provider, owner transfer, new paid feature or pricing
decision is introduced.

### D.2 — Inspection Standards — production closed

Organizations select an exact technical standard version per finite inspection domain. Criteria
attach directly to that version and become the inspection checklist; a versioned organization
policy resolves it automatically for new inspections. Historical inspections retain their original
basis. V1 has no Protocol Engine, no arbitrary per-inspection override, no copyrighted real
standard corpus and no new commercial capability. Production closure covers six finite domains,
three synthetic demo standard versions, ten synthetic criteria, append-only organization policy,
tenant isolation, explicit no-fallback behavior and preserved legacy inspection semantics. Real
standard selection and professional approval remain **PENDING ANITA**.

### D.3 — Inspection Basis V2 — production closed

Compose one primary technical version, optional supplemental/internal versions and zero-to-many
exact RegulatoryUnits for each organization and inspection domain. The immutable basis version is
snapshotted by new inspections; legacy direct-standard inspections remain valid. Foreign sources
remain technical/reference context in their own jurisdiction and never become Ecuadorian law.
This is not a Protocol Engine and introduces no pricing decision.

### M.1 — Conversational Operations V1 — production closed

Provide a tenant-private, context-aware conversation interface over existing domain APIs. The
assistant uses a server-side allowlisted action registry, current membership authorization,
explicit mutation confirmation, idempotency and structured citations. The deterministic demo
provider validates architecture without selecting a production LLM vendor.

### E — Incident management — implementation authorized

Operational incident lifecycle, investigation evidence and contributing factors without automatic
root-cause claims.

### F — PPE — implementation authorized

Worker/position → risk → PPE → delivery → inspection → expiry/renewal → evidence. Inventory and
stock follow later.

### G — Training and competency — implementation authorized

Role/activity → competency → training → attendance → assessment → evidence → expiry/renewal, linked
to Requirements, risks, findings and actions.

### H — SST governance — bounded V1 production closed

Organization-scoped bodies, participants, meetings, minutes, decisions, actions, follow-up and
evidence are operational. Person snapshots preserve historical identity while current activity is
shown separately. V1 infers no mandatory committee, composition, frequency or legal deadline.

### I — Psychosocial

Retained on the roadmap but deferred until methodology, licensing, privacy, sensitive-data handling
and professional interpretation are explicit.

### J — Cross-module intelligence — bounded deterministic foundation production closed

The first production slice deterministically surfaces same-center repeated findings and clusters of
open overdue actions through versioned 3-record/90-day platform defaults. Signals are explainable,
idempotent, lifecycle-aware and project into Work Queue only while actionable. Broader
incident/training/risk patterns, evidence gaps and semantic assistance remain later work and never
become the authority.

### K — Reports and evidence packages — Evidence Packages V1 production closed

Immutable versioned manifests now capture canonical references, generation metadata, deterministic
ordering and SHA-256 digests. Regeneration creates a new package; the product makes no automatic
compliance or audit-certification claim. Broader reports and exports remain future slices.

### L — Consultant portfolio — V1 production closed

Tenant-safe multi-company view of organizations, alerts, overdue work, pending reviews and upcoming
deadlines.

V1 is production closed through PR36/37/38 as a computed read layer over current memberships. It adds
factual organization cards, deterministic attention/work/signal/evidence summaries, bounded
filters and context-safe canonical deep links. It adds no organization score, super-tenant,
replication or commercial assignment.

### M — AI copilot

Only after sufficient operational data exists. Allowed: search, summarization, drafting, semantic
grouping, suggestions and report preparation. Forbidden: scoring, legal decisions, root cause,
medical diagnosis and rule publication.

The provider-security preparation boundary is production closed, but no external provider has been
selected or integrated. `DETERMINISTIC_LOCAL_V1` remains the production provider while the external
product/privacy decision is pending.

AI Copilot Productization V1 and the provider-neutral V1 evaluation harness are production closed
through PR36/37/38. The harness preserves 12 golden and 8 security cases with a validated adapter
contract. Provider selection remains a separate external product, privacy, legal, security
and commercial decision; completing the harness does not authorize integration.

## Sequencing guardrails

- Capability gates, not PR numbers, control sequencing.
- Documentary structuring does not authorize Requirements or Rules.
- New official or method editions create immutable versions.
- No new commercial entitlement key without an explicit product decision.
- Operational modules remain bounded domains; no universal workflow aggregate.
- PostgreSQL indexes and projections precede speculative caching/search infrastructure.

## Current state

Completed foundations include platform/auth/tenancy, intelligent inspections, Technical Risk,
Applicability and Adaptive Configuration foundations, regulatory source/provision/requirement
foundations, Risk Methodology runtime and Unified Regulatory Evidence Runtime V1.

Production implements Track C, the first bounded preview slice of Track D and Workspace UX V2.
Tracks D.1, D.2 and D.3 are production closed. Workforce Safety Operations V1 is production closed
for Worker Registry and bounded Tracks E–G, including deterministic Worker 360 projections.
Conversational Operations V1 and the PR #35 provider-security preparation are production closed
with `DETERMINISTIC_LOCAL_V1`; neither is an external or generative AI integration. Tracks H and K
have bounded production V1 slices, and Track J has its first deterministic operational-signal
foundation without worker scoring or predictive claims. Track B was
attempted and safely deferred because the ordered artifacts need verified human transcription before
structuring. Track A remains pending. No later track is represented as active.

Track L V1, the provider-neutral productization portion of Track M and the Provider Evaluation
Harness are **DONE**. PR36/37/38 final production closure is **DONE**, verified on PR38 merge
`c5bc3a2cc38db10e39e4e66117f7d18e296dd509` on 2026-09-03: first-attempt main CI,
27 integration suites/65 tests, 18/18 standalone E2E with no retries, automatic aligned
Railway/Vercel deployments, safe revocation/reload/write-denial smoke and unchanged reference data.
See [runtime evidence](../testing/e2e-runtime.md#cierre-productivo-pr363738--2026-09-03).

The next gate is **READY_FOR_PROVIDER_SELECTION=YES**, not permission to select or integrate a
provider. The production provider, regulatory publication counts, pilot review state, risk methods
and historical records remain unchanged. No new pricing or PlanFeature assignment is authorized.

E2E runs the built standalone artifact, without route-specific warmup lists or auth/throttling
bypass. Production rate-limit buckets remain in-memory per process; distributed storage is
deferred until horizontal scaling requires it, not part of the next provider decision.
