# SST Intelligence — master project context

Status: canonical continuity document. Runtime implementation baseline: PR #43 merge
`f834920664c7bcb3ade8ff07933e870e7809c13d`, verified in production on 2026-09-08. The subsequent
closure-documentation commit does not change runtime behavior.

This document is the authoritative entry point for future engineering sessions. Detailed domain,
architecture, security, deployment and source-review documents remain authoritative inside their
bounded areas. The [master roadmap](sst-intelligence-roadmap.md) is the sole cross-product priority
roadmap.

## Production baseline — Post-Anita convergence V1

PR #42 adds a bounded Plan Operativo V0, synthetic
electrical Resource Scope V0, human-readable GTC45 rendering and a controlled inspection editorial
drafting spike. These changes are production baseline and claim no Anita approval. The
controlling decisions are in
[ADR Post-Anita convergence V1](../architecture/adr-post-anita-convergence-v1.md).

Plan Operativo is a versioned source of planned work and is not Work Queue. Resource Scope is a
separate, versioned layer before exact criterion mapping and does not replace Basis or Standards.
Its V0 scoped flow blocks a multi-technical-source Basis rather than silently dropping supplemental
criteria; the explicit unscoped flow preserves the existing multi-source behavior.
AI may create a validated tenant-private editorial proposal in controlled staging, but cannot
publish runtime truth. The provider receives only bounded, complete, verified official unit text
and public synthetic resource metadata; it receives no tenant operational data. Production
external AI remains disabled.

## PR42 Post-Anita Product Convergence V1 production closure

PR #42 merged the externally audited HEAD `a788e219bf5dcc06d80e181bd0d06d9048528d71`
through merge commit `1bfb08132789b305bdac7013deaed1d43914699f` on 2026-09-07. The first
automatic Quality Gate of that runtime SHA passed without rerun: 29 integration suites / 68 tests,
18/18 E2E, workers=1, retries=0, plus migrations, reference seed/sync, lint, typecheck, unit,
validators, build and runtime-image verification. Railway production and Vercel production were
automatically deployed from that exact merge SHA; staging remained on its isolated project,
environment and database.

Production parity is 15 RegulatorySources, 25 SourceVersions, 1112 RegulatoryUnits including 893
ARTICLE units, 5 candidate Requirements, 5 candidate RuleDrafts and 0 real published RuleVersions.
No historical inspection or risk result was recalculated or backfilled. Existing RiskMethodVersion
identities remain intact; GTC45 calculation is unchanged; Plan Operativo remains distinct from Work
Queue; the legacy unscoped multi-source inspection path remains available; and approval of an
InspectionDraftProposal still cannot publish a runtime mapping. No pricing rule, commercial feature
key or PlanFeature assignment was added.

Production route-availability smoke returned no 5xx for Plan Operativo, Work Queue, Inspections,
Resource Scope, risk-method/GTC45 presentation and legacy inspection-basis paths. Authenticated
behavior is covered by the isolated 18/18 main E2E gate; the production smoke created no customer
or synthetic tenant data. The electrical taxonomy and mappings remain synthetic and pending Anita
review, multi-source scoped mapping remains deferred, and editorial AI remains staging-only.
Production uses `DETERMINISTIC_LOCAL_V1`, has no OpenAI key and recorded zero external-AI requests.
Workforce Safety Product Refinement V2 was subsequently merged and production-verified through
PR #43; its exact closure evidence is recorded below.

## Workforce Safety Product Refinement V2 — production closed

The production slice connects Position, Worker, structured risk context, EPP, Accident/Incident, Safety
Observation, Training and existing Work Queue while preserving their separate lifecycles. Existing
`WorkCenter` means physical site/plant/center and `WorkArea` means subdivision; no `Plant` entity is
needed. Worker remains independent from User/Membership and consumes no seat.

EPP candidate categories are deterministic local mappings followed by explicit professional
selection. Replacement preserves the old issue and may link explicitly to an existing Incident.
Accidentes e Incidentes gain nullable event-location, internal-priority and investigation-method
context without legal severity or automatic root cause. Safety Observation is a new bounded,
authenticated preventive aggregate that creates neither Finding nor Incident automatically and
links existing operational Actions rather than duplicating them. Training Needs retain provenance,
audiences remain Workers/Positions/locations rather than Memberships, and the printable plan uses
manual signature placeholders.

All new historical fields are nullable and the migration is additive. No commercial feature key,
PlanFeature assignment, external Workforce AI, stock/ERP, LMS, clinical data, public reporting,
notification provider or electronic signature is introduced. Mappings, classification language and
workflow refinements remain **PENDING ANITA**.

## PR43 Workforce Safety Product Refinement V2 production closure

PR #43 merged the externally audited HEAD `7f8f222e3da030fd0b0bea8cf7bad583d953a071`
through merge commit `f834920664c7bcb3ade8ff07933e870e7809c13d` on 2026-09-08. Main Quality
Gate [34259930387](https://github.com/georgenton/sst-intelligence-platform/actions/runs/34259930387)
passed in attempt 1: 23 contract files / 318 tests, 13 API suites / 48 tests, 103 web tests,
30 integration suites / 69 tests and 19/19 E2E in 15 serial batches with workers=1, retries=0 and
retried=0. Migrations, validators, regulatory corpus review, build, repeated reference sync and the
runtime image also passed.

Railway production deployment `d62d7682-9626-4e4d-9c4e-edbbfef4189a` applied migration
`20260907232300_workforce_safety_refinement_v2` as migration 32, started successfully and returned
health HTTP 200. Vercel deployment `dpl_4qAd4cMXZRMzu4yokeUyba4y9AFN` is READY on production with
the canonical demo aliases and the exact merge SHA. Staging production remains isolated on the
authorized PR41 track `5ed765d7387f51f53821296fbec8944b16e87a8b`.

Production retains 15 RegulatorySources, 25 RegulatorySourceVersions, 1112 RegulatoryUnits,
893 ARTICLE units, 5 candidate Requirements, 5 candidate RuleDrafts and zero real published
RuleVersions. Historical workforce, inspection, risk, resource-scope and plan records were not
recalculated or backfilled; GTC45 is unchanged. Production keeps
`CONVERSATIONAL_AI_PROVIDER=DETERMINISTIC_LOCAL_V1`, has no OpenAI key and recorded zero external
provider requests, including Workforce data.

The closed product scope comprises Organization/Worker Context V2, Position, EPP V2, Accidentes e
Incidentes V2, Safety Observation V1, Training Plan V2 and Work Queue convergence. Terminology,
Position/risk/EPP mappings, standards/certifications guidance, event-location categories, Ishikawa
professional refinement, certified/internal training guidance and Safety Observation field-intake
refinements remain **PENDING ANITA**. Public QR/anonymous intake, mobile/PWA field operations,
offline, notification providers, Psychosocial, clinical functions, ERP, full LMS, real e-sign and
Workforce external AI remain deferred. This closure does not attribute professional approval to
Anita.

## Product direction

SST Intelligence is becoming an **SST Operating System + Professional Intelligence Layer** for
organizations, SST teams and consultants. It should help a professional determine what needs
attention, understand the exact source and article, assess risk with deterministic versioned
methods, assign and execute work, collect organizational evidence, review outcomes and produce
auditable evidence packages.

The differentiator is operational SST intelligence combined with deterministic methodologies,
regulatory provenance, professional workflows and cross-module reasoning. It is not an LLM that
evaluates workers.

The intended operating surface covers inspections, Technical Risk, corrective actions, residual
risk, permits, incidents, PPE, training and competency, governance, recurrence, cross-module
patterns, reports and later an AI copilot within strict limits.

## Permanent concept boundaries

These concepts are related but never interchangeable:

```text
Regulation / legal source
!= Regulatory article or unit
!= Platform interpretation
!= Requirement
!= Rule
!= Technical methodology
!= Assessment
!= Organization evidence
!= Risk-verification evidence
!= Professional review
```

A regulatory link records provenance; it does not prove compliance or non-compliance. Official
text, platform interpretation and tenant-private evidence remain separate in storage and UX.

## Authority model

The server/domain is authoritative. Rule evaluation, GTC45, Guided 5×5, residual risk, recurrence
and domain lifecycles are deterministic. The frontend collects inputs and renders versioned results.

AI must not select scores, change deterministic results, declare legal compliance, publish rules,
diagnose occupational health, declare root cause or override professional decisions. Future AI may
search, explain, summarize, draft, group semantically, suggest patterns and prepare reports without
becoming the decision authority.

## Multi-tenancy and data ownership

The platform uses shared PostgreSQL with strict `organizationId` isolation. Organization context
comes from the authenticated user, selected active organization and verified membership; request
bodies never establish tenant authority.

Tenant-private data includes facts, current states, organization evidence, inspections, findings,
actions, assessments, work, permits, training, PPE, incidents and reviews tied to tenant work.
Global reference/editorial data includes regulatory sources and versions, regulatory units,
methodology sources, risk-method definitions and versions, and global reviewed interpretations or
rules where appropriate. Tenant data must never leak into global editorial artifacts.

## Production architecture

- TypeScript/pnpm/Turborepo monorepo on Node 24 LTS.
- NestJS REST modular monolith in `apps/api`.
- Next.js App Router client in `apps/web`.
- Pure contracts and deterministic business rules in `packages/contracts`.
- PostgreSQL + Prisma on Railway; backend on Railway; frontend on Vercel.
- Playwright policy: one worker, zero retries.
- E2E uses the production Next standalone artifact and built API, with fresh processes per test
  file, no route-specific warmup list and no authentication/throttling bypass.
- The current rate limiter keeps buckets in-memory per application process: default 120/60,000 ms,
  register/login 5/60,000 ms and refresh 30/60,000 ms. Distributed storage is deferred until
  horizontal scaling requires it; the current backend runs one replica.
- No microservices, queues, Redis, GraphQL, CQRS, vector database or speculative infrastructure.

## Current production capability baseline

### Platform, auth and tenancy

Own NestJS auth uses Argon2id, access JWTs, rotating hashed refresh tokens, Secure/HttpOnly cookies,
refresh-family reuse handling, proactive single-flight refresh, one retry after 401 and session
generation/abort protection. AUTH-001 is closed. Organization context, memberships, roles and Work
Centers are operational. Roles are `ORG_OWNER`, `ORG_ADMIN`, `SST_MANAGER`, `SST_TECHNICIAN`,
`CONSULTANT` and `VIEWER`; API guards remain authoritative. Team & Invitations V1 is production
closed: Owner/Admin manual-link invitations, current-membership authorization and bounded role
management now provide the operational separation-of-duties path.

### Inspections

Guided inspections support findings, risk valuation, actions, evidence, completion, verification,
residual risk, analytics, recurrence, alerts and systemic review. Verification basis is finite:
`RECORDED_EVIDENCE`, `FIELD_OBSERVATION` or `OTHER_JUSTIFIED`. Recurrence groups by organization,
work center, category and time window, and never asserts root cause automatically.

Inspection Standards V1 is production closed. Six finite inspection domains resolve an exact,
immutable technical standard version through append-only organization policy; the version's
criteria execute directly as the checklist, and findings retain criterion/source provenance.
Historical inspections preserve their original standard or explicit legacy no-standard state.
There is no per-inspection arbitrary override, silent fallback or Protocol Engine. The production
synthetic baseline remains exactly three demo sources/versions and ten original criteria. A
separate, visibly labeled reference pilot adds RETIE, REBT and RTQ candidates plus CLP/NFPA
metadata-only boundaries; professional selection and approval remain pending Anita review.

Inspection Basis V2 is production closed: an organization/domain may select an immutable
composition containing one primary technical version, supplemental/internal technical versions and
zero-to-many exact regulatory units. `Inspection Standard != Inspection Basis != Regulation != Risk
Method`. New basis-aware inspections retain the exact basis version; V1 direct-standard history is
never destructively backfilled. New inspections resolve the active Basis first and use the legacy
organization policy only when no active Basis exists. Inspection Basis is not a Protocol Engine.

Conversational Operations V1 is production closed as a controlled deterministic interface over
current services, never an alternate authority.
Allowlisted actions run with the current user, organization, role and entitlements; material writes
require confirmation and idempotency. Conversation messages are not canonical audit records. A
deterministic provider is sufficient until a production LLM/provider and privacy policy are
explicitly approved.

The V1 interaction model is documented in
[Conversational Operations V1](../domain/conversational-operations-v1.md). Its registry invokes
existing services and has no direct domain-table persistence. All material writes are proposed,
confirmed and idempotent; citations are exact stored references. The implementation adds no
commercial feature key or external AI secret.

### Risk methodology and Technical Risk

Production reference methods are `DEMO_5X5`, `GUIDED_5X5` and `GTC45_2010`. Exact immutable method
versions remain attached to historical assessments; initial and residual valuation use the same
version and history is not recalculated.

GTC45 uses ND values 10/6/2 plus non-numeric LOW handling, NE 4/3/2/1, derived NP, NC
100/60/25/10, derived NR and intervention levels I–IV. LOW is never zero. GTC45 is a Colombian
technical methodology candidate, not Ecuadorian law; its full copyrighted text/PDF does not belong
in the regulatory library.

Guided 5×5 uses human probability 1–5, human severity 1–5 and deterministic P×S. Decision cues help
professional judgment but do not select the score. The V1 severity dimension is HUMAN. Organization
guidance cannot silently change the ranges or formula.

Technical Risk preserves legacy history, deterministic results, professional review,
`NEEDS_REVISION`, correction chains and concurrency safeguards. New assessments may use Guided 5×5
or GTC45 while retaining the independent `TechnicalAssessment` lifecycle.

### Regulatory evidence and Unified SST Evaluation

Production contains 15 `RegulatorySource` records, 25 source versions, 1112 regulatory units, 893
ARTICLE units and 8 fully structured source versions. Latest-version classification is 13
`OFFICIAL_ARTIFACT_VERIFIED`, 1 `OFFICIAL_REFERENCE_ONLY`, 0 `ARTIFACT_PENDING` and 1
`REJECTED_UNVERIFIED`. Structural coverage is `STRUCTURED_DOCUMENTS_ONLY`; the whole corpus is not
structurally complete.

The library supports source/article browsing and search, exact text, table of contents, locator,
page, source version, artifact verification, vigencia and official links. Official text and platform
interpretation remain separate.

The controlled MDT-2024-196 Art. 18/19 pilot contains 5 candidate Requirements, 5 candidate
RuleDrafts and 0 real published RuleVersions. All interpretations remain pending professional
review; no Anita approval exists.

Unified SST Evaluation coordinates organization facts, candidate applicability, regulatory
provenance, current state, organization evidence and risk context without replacing specialized
engines. Expert Review exposes candidate decision, facts, Requirement, RuleDraft, article, source
version, source and trace; review does not publish a RuleVersion automatically.

## Regulatory truth and traceability

893 structured articles do not mean 893 interpreted obligations or executable rules. Do not turn
every article into a rule.

Required regulatory trace:

```text
Decision
→ RuleDraft or RuleVersion
→ Requirement
→ RegulatoryUnit
→ RegulatorySourceVersion
→ RegulatorySource
→ official artifact metadata, hash and locator
```

Required risk trace:

```text
Assessment → exact RiskMethodVersion → MethodologySource
```

## Historical immutability

Never silently recalculate historical findings, initial risk after residual valuation, historical
Technical Assessments, published RiskMethodVersions, verified RegulatoryUnits, approved regulatory
interpretations or published RuleVersions. A new official edition or professional decision creates
a new version; it does not overwrite history.

## Pending Professional Review — Anita

Engineering must not decide or fabricate:

1. approval of the 5 MDT Art. 18/19 Requirements or 5 RuleDrafts;
2. publication of real regulatory RuleVersions;
3. `ANITA_GUIDANCE_GTC45_V1`;
4. source, medium and person guidance questions;
5. required versus advisory Guided 5×5 cues or wording refinements;
6. evidence expectations for score selection;
7. preferred methodology by risk/context or mixed-method programs;
8. additional professional Technical Risk criteria;
9. priority of future legal interpretations.

Technical and product work may continue around these questions while candidate state remains
explicit.

## Current implementation program

The production implementation program is [Operational Execution Program V1](../product/operational-execution-program-v1.md):
Obligation Execution, an Operational Work Queue, Command Center V2, Workspace UX V2 pilots, safe
documentary expansion where possible and a bounded generic Critical Work Permit V1. Blocks A–D and
F are implemented and awaiting external review. Block E is safely deferred because exact verified
text is not extractable without human transcription; the regulatory corpus and publication state
remain unchanged. The program adds no new legal interpretation, pricing strategy or AI authority.

The final production-closure repair establishes two additional product invariants. Command Center
always renders actionable items from the shared Operational Work Queue before initial SST setup
guidance; an unconfigured organization may see setup as a secondary recommendation, never as a
replacement for real work. Work Permits uses the dedicated `module.work_permits` capability as a
bounded active-demo preview. Its `FeatureDefinition` is deterministic global reference data, but
it has no `PlanFeature` assignment. Future commercial packaging remains **PENDING PRODUCT
DECISION**.

Production includes [Organization Team & Invitations V1](../domain/organization-team-invitations-v1.md):
Owner/Admin manual-link invitations with hash-only single-use tokens, authenticated email binding,
transactional terminal outcomes, conservative non-owner role management and non-destructive member
deactivation. Work Permit drafts select a current same-tenant eligible approver; pending approval is
assigned to that member in the shared Work Queue. It adds no email provider, team pricing key,
commercial Work Permit assignment, incident, PPE, training or regulatory interpretation.

[Inspection Standards V1](../domain/inspection-standards-v1.md) is production closed. It provides
direct, versioned binding from an inspection domain to an exact technical standard version through
organization policy without implementing a Protocol Engine. The technical basis, risk method and
regulatory foundation remain separate, and only synthetic demo standard content is present in the
global reference catalog. Real-standard selection, rights validation and professional approval
remain **PENDING ANITA**.

[Workforce Safety Operations V1](../product/workforce-safety-operations-v1.md) is production closed.
Its controlling ADR states that User, Membership and Worker
are different concepts: Workers are tenant-private operational persons, may have no login, never
consume member-seat capacity and survive User unlink or Membership suspension. The program adds
bounded Incident, EPP and Training/Competency lifecycles plus tenant-scoped Worker 360 and shared
Work Queue/Command Center projections with exact source links. It adds no HRIS/payroll, clinical
data, automatic root cause, statutory reporting
decision, legal deadline, commercial plan assignment, AI decision or published regulatory Rule.

The PR #34 production closure also verifies Inspection Basis V2, the bounded official-source pilot
and Conversational Operations V1. The production smoke used RETIE as primary technical source, REBT
as supplemental technical source and no inferred legal context; all pilot criteria remain
**PENDING ANITA**. The deterministic conversational provider operated canonical Inspection,
Finding, Evidence and Action services with explicit confirmation, idempotency, current-membership
authorization and exact stored citations. No external LLM or new commercial feature was added.

[Governance, Evidence and Intelligence Foundation V1](../architecture/governance-evidence-intelligence-foundation-v1.md)
is production closed by PR #35. Governance keeps body-scoped person identity and meeting-time
display/role snapshots separate from current Worker or Membership activity. Decisions remain
distinct from GovernanceActions; only open actions project to the shared Work Queue, with no
duplicate stored queue aggregate or inferred committee obligation.

Evidence Packages V1 freezes a revalidated historical manifest rather than the current mutable
source. Generation records actor, time, scope, deterministic ordering and a SHA-256 manifest digest;
`certificationClaimed` is always false. Regeneration creates a new package and never rewrites the
older snapshot. Production proved one package retaining a meeting's `DRAFT` state while a second
package captured the later `HELD` state.

The bounded Cross-Module Intelligence foundation uses versioned operational defaults, not legal
rules: `REPEATED_FINDING_90D_V1@1.0.0` requires at least three same-category findings in one Work
Center within a rolling 90-day window, and `OVERDUE_ACTION_CLUSTER_90D_V1@1.0.0` requires at least
three open overdue actions in one Work Center, created within the rolling 90-day window and overdue
at evaluation time. Signals are idempotent derived state, preserve historical provenance when
closed and leave the Work Queue when no longer actionable. Work Center views are factual and Worker
views expose neither a safety score nor a Safe/Unsafe classification.

LLM Provider Preparation is also closed as an architectural boundary, not as an external AI
launch. Production remains `DETERMINISTIC_LOCAL_V1`; provider selection is
`PENDING_EXTERNAL_PRODUCT_DECISION`, no external secret is required, unknown citations/actions are
rejected, and AI cannot decide final risk, legal compliance or automatic root cause.

The production-closed program implements [Consultant Portfolio V1](../domain/consultant-portfolio-v1.md)
as a tenant-safe read aggregation over current active memberships. Roles and entitlements are
resolved independently for every organization, and each canonical link establishes the matching
organization context before navigation. It creates neither a super-tenant nor copied customer
records, safety scores, commercial assignments or new persistence.

[AI Copilot V1 productization](../domain/ai-copilot-v1.md) adds the distinct
`PORTFOLIO_READ_ONLY` context, finite read actions, source-aware citations, explicit “I don't know”
results and mandatory single-organization write anchoring. Production still uses
`DETERMINISTIC_LOCAL_V1`. The provider-neutral synthetic evaluation harness is complete, while
external provider selection, privacy terms, pricing and secrets remain pending external decisions.

## PR36/37/38 final production closure

Consultant Portfolio V1, AI Copilot Productization and the Provider Evaluation Harness are **DONE**.
PR38's main Quality Gate 33779146371 passed in attempt 1 without rerun: integration 27 suites /
65 tests, full E2E 18/18, workers=1, retries=0, retried=0, plus build, reference and Docker gates.
The [runtime evidence](../testing/e2e-runtime.md#cierre-productivo-pr363738--2026-09-03) records the
exact merge, automatic Railway/Vercel releases and bounded synthetic production smoke.

Production proved current per-organization roles and entitlements, no arbitrary organization
scope, live membership revocation, write-time denial after revocation, authenticated hard reload
with safe context fallback, canonical Portfolio links, Assistant anchoring and Workforce navigation.
Release logs contained no unexpected application/5xx errors or sensitive payloads.

Regulatory parity remains 15 sources, 25 versions, 1112 units/893 articles, 5 real candidate
Requirements, 5 real candidate RuleDrafts and zero real published Rules. The other 12 RuleDrafts
are demo references, not additional regulatory interpretations. RETIE/REBT/RTQ/CLP pilot criterion
counts remain 2/2/2/0, and the three risk methods and historical records are unchanged. No new
PlanFeature assignment or pricing decision was made.

The harness preserves 12 synthetic golden cases, 8 security cases and the validated adapter
contract. `READY_FOR_PROVIDER_SELECTION=YES` means readiness for a separate explicit external
product/privacy/security decision, not selection or integration. Current provider remains
`DETERMINISTIC_LOCAL_V1`, external AI processing is disabled and no external secret is required.
AI still cannot decide final risk, legal compliance or root cause, or produce worker/organization
safety scores.

## Adaptive SST + Field Operations + Intelligence V2

El programa V2 está **production closed** mediante PR #44: HEAD auditado
`894b12791f65f7ad42f57dc2ccb3183dc8889f62`, merge commit
`38a704dd757364bfed498b8c130eb6ded745e80c` y Quality Gate de `main` 34295675414 en intento 1.
Añade perfil SST V2 con triestado y procedencia, Gap Analysis descriptivo con conversión explícita
a Plan, Inspection Depth versionada, Field Hub/PWA acotada, evidencia opcional en Safety
Observation, PostgreSQL Search, Management Intelligence compatible por método e historial visible
de Expert Review.

Las decisiones están en [el ADR](../architecture/adr-adaptive-field-intelligence-v2.md) y la
arquitectura del perfil/gap en [Adaptive Profile V2](../architecture/adaptive-profile-gap-analysis-v2.md).
No crea Protocol Engine, Notification DB, offline sync, vector DB, Worker Safety Score, aplicación
legal automática, causa raíz, RuleVersion real ni expansión de IA externa. Work Queue y Operational
Signals cubren la atención in-app como proyecciones de registros canónicos.

La migración aditiva 33 `20260908120000_adaptive_field_intelligence_v2` está aplicada en Railway
producción sin pendientes ni backfill semántico. Railway desplegó
`45afbe4d-3090-4b5a-99ef-9af924ca83d6`; Vercel Demo desplegó
`dpl_AJZKyz5tHKET8RMVExqLGZa4ovzd`, fuente Git, target production y alias canónico. Staging
production continúa aislado en `dpl_V1gVcJhNx4JCLEFdg2uTvFeZ67qd` sobre
`codex/isolated-staging-environment-v1@5ed765d7387f51f53821296fbec8944b16e87a8b`.

Quedan **DONE** Organization Profile V2, procedencia de facts, Gap Analysis V1, límite de Business
Priority, conversión explícita Gap→Plan, Inspection Depth V1, Field/Mobile Web V1, PWA acotada,
recuperación de Evidence de Safety Observation, PostgreSQL Operational Search V1, Management
Intelligence V1, analítica residual separada por metodología y mejoras de usabilidad/procedencia
para Expert Review. `IN_APP_NOTIFICATION_V1=NOT_NEEDED`: Work Queue y Operational Signals siguen
siendo los mecanismos canónicos suficientes en esta versión.

Continúan **PENDING ANITA** los facts que cambien recomendaciones, requisitos de evidencia o
confirmación profesional, mapping profesional recurso↔profundidad, terminología de procesos/equipos,
criterios Gap→Plan, refinamientos finales de captura en campo y cualquier equivalencia entre
metodologías. Continúan diferidos QR/anonymous intake, app nativa, full offline sync, proveedores
externos de notificaciones, SMS/WhatsApp/push, vector search/embeddings, Business Continuity o
insurance scoring, ergonomía profunda sin fuente/licencia revisada, workflows psicosociales o
clínicos, expedientes médicos y Workforce AI externa. Business Continuity/Insurance permanece
design-only; Ergonomics pendiente de metodología revisada; Psychosocial limitado a arquitectura y
frontera de datos.
