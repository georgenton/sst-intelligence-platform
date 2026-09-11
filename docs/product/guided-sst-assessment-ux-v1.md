# Guided SST Assessment UX V1

Status: implemented in PR47; external UX and architecture audit pending. PR48 configuration
completion remains pending.

## Experience model

The primary product surface is **Evaluación SST**. It is a guided hybrid interview, not a chatbot
and not a fixed multi-page form. It presents one structured decision at a time, saves it on the
server, requests deterministic reevaluation and advances only after confirmation. The server owns
question relevance and readiness.

The public and authenticated channels render the same `GuidedSstAssessmentExperience`. Explicit
transport adapters contain the endpoint, token and organization-context differences. Boolean
answers are always explicit Sí / No / No lo sé decisions; an unchecked control never means false.
Choice labels, question text, help, bounds, topics and fact presentation come from the canonical
assessment catalog.

## Progress and review

Progress groups canonical topics into human areas such as Empresa, Centros, Operación, Gestión,
Personas, Prioridades and Implementación. It describes collected information and never claims a
compliance percentage. A responsive “Lo que ya sabemos” panel displays only confirmed or explicitly
unknown facts. It allows corrections through the canonical answer/evaluate cycle before finalization;
finalized snapshots are read-only and expose **Reevaluar empresa** instead.

Topic boundaries provide review checkpoints. Once required information is complete, the user sees
“Esto es lo que entendimos” and explicitly confirms finalization. No assessment is finalized merely
because its last blocking answer was saved.

## Public continuity and claim

`/evaluacion-sst` is the only public entry exposed by the home and header. `/diagnostico` and its
dynamic Solution Finder routes remain available solely for compatibility with existing sessions
and automated operational fixtures. The prior unified applicability workspace remains available at
`/app/applicability/unified`, outside primary navigation. Work Center count is an explicit
pre-session choice. The
public bearer token is stored only in a versioned, bounded browser recovery record and sent in the
`x-assessment-token` header. It is never placed in a URL, query string, analytics or logs.

Authentication return paths carry only the public assessment ID. The claim screen recovers the
token locally and requires an explicit destination choice, even when an organization is already
active. The user can choose another existing company or create a new one and return to the chooser.
A recoverable failure keeps the record. Successful claim or a terminal expired session clears it.

For a new company, claim configures the exact center topology and requires visible one-to-one
mapping. Activity is required when the assessment did not already establish it. For an existing
company, active Work Centers are authoritative: claim is mapping-only and never renames or creates
centers. A topology mismatch presents bounded reconciliation actions without attempting the claim.

Company creation follows the existing organization API. Its automatically created “Centro
principal” becomes center 1; only the remaining centers are created. A stored target organization
ID lets the user resume after partial creation without creating a duplicate company. Names are not
used as idempotency keys.

Existing commercial capacity remains authoritative. A newly created FREE organization can map its
single allowed center. A multi-center public diagnosis can be claimed to an existing organization
whose current plan already permits that topology; PR47 does not select, upgrade or invent a plan.
Completing commercial configuration for a new multi-center organization is an explicit PR48 gap.

## Setup shell and authoritative gate

AppShell resolves organization-scoped `setup-state` before mounting private navigation or page
children. For a new empty organization, `NEEDS_ASSESSMENT`, `ASSESSMENT_IN_PROGRESS` and
`DIAGNOSIS_READY` are hard gates during PR47. The setup shell contains only assessment, the real
company route, help, organization switch and logout controls. A user with no organization runs the
same public/unbound assessment before creating a company.

Legacy compatibility is conservative. An organization without a canonical assessment is
`LEGACY_CONFIGURED` when it has substantive SST history in at least one of these existing models:
Profile Version, Adaptive Configuration Session, Unified SST Evaluation, Applicability Assessment,
Operational Plan, Inspection or Technical Assessment. Membership, the CORE subscription/module and
the automatic main Work Center are not sufficient. Organizations already activated through the
historical demo onboarding (`status=DEMO`) are also preserved as legacy configured. This explicit
compatibility signal avoids blocking prior demo work; it does not configure a new organization.
`LEGACY_CONFIGURED` is not hard gated and keeps the current application available with a human CTA
for the new evaluation. That compatibility remains in force while a voluntary canonical assessment
is in progress and after its diagnosis is finalized. The canonical assessment state and ID remain
visible; hard-gate eligibility is derived independently from the substantive pre-existing baseline.

For an authenticated assessment, organization sector and active Work Center topology are resolved
before session creation. Once created, topology is not silently edited. A backend context-change
conflict asks the user to create an updated assessment rather than merging state in React.

## Results and authority

The diagnosis groups items by attention instead of producing a score. Each item has a human
summary, semantic next-step copy, a collapsed professional basis and, only for authenticated users,
collapsed technical details. The professional layer translates trace facts and observed values into
human labels, criterion, result, scope, authority, review and missing information without exposing
raw operators or rule identifiers. `NEEDS_INFORMATION` language names missing information without
asserting it as true.

DEMO output is labeled as demonstration priority, never legal obligation. CANDIDATE output is a
regulatory criterion under review, never a legal fact or non-compliance claim. Sources are shown
only when the backend supplies them. The UI does not calculate risk, applicability, legal authority
or module selection.

## Accessibility, motion and async behavior

Question controls use fieldset/legend semantics, keyboard-operable buttons, visible focus, Spanish
validation, `aria-live` save state and comfortable touch targets. Desktop uses a wide interview
column with sticky context. Mobile keeps the focal question first and exposes context through a
closed-by-default accessible dialog with Escape handling and focus return. Motion is limited to
150–250 ms state transitions and is removed under
`prefers-reduced-motion: reduce`.

Skeletons cover session/setup/result loading. Saving and evaluating keep confirmed context visible.
Stale revisions refetch rather than overwrite; context/profile reconciliation and expired sessions
use bounded Spanish explanations without raw error payloads.

## Reassessment and PR48 handoff

Finalized organizations expose **Reevaluar empresa**. It creates a new `REASSESSMENT` with the last
finalized assessment as parent; previous known facts are reused by the core and prior snapshots are
never edited. The created assessment owns `/app/evaluation/{id}`, so reload resumes that same
in-progress reassessment. Switching organizations first replaces an assessment-specific route with
`/app/evaluation`, preventing a session from the previous tenant from being requested in the new
context.

PR47 intentionally ends at `DIAGNOSIS_READY`. It does not create `SETUP_COMPLETED`, recommend or
activate modules, change entitlements/subscriptions, generate Operational Plans or call an external
LLM. PR48 must consume the canonical diagnosis to complete configuration and any explicitly
authorized plan workflow.
