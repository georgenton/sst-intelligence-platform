# Unified SST Evaluation Engine V1

Status: implemented on top of the canonical SST assessment core and Guided SST Assessment UX. The
P1 incomplete/missing-information semantic finding is fixed and pending external re-audit.

## Product boundary

The existing guided interview remains the only capture experience. It asks one structured question
at a time, accepts explicit unknowns, saves server-confirmed facts and requires a human review before
finalization. This increment does not create a second setup flow or a chatbot-controlled assessment.

The unified result now contains three deliberately separate layers:

1. confirmed or explicitly unknown organization facts in the versioned assessment snapshot;
2. deterministic specialist findings and missing information;
3. proposed product-capability recommendations from `SST_CAPABILITY_ENGINE_VERSION=1.1.0`.

Effective entitlements are fetched separately for authenticated presentation. The UI labels current
availability separately and directs the user to review the capability or current access. A
recommendation records `recommendationState=PROPOSED`, the separate `humanDecision=PENDING` and
`activationEffect=NONE`; it never writes a `FeatureDefinition`, `PlanFeature`, `Subscription` or
`OrganizationModule`.

## Deterministic recommendation model

The pure contracts engine scores only normalized `KNOWN` facts. It emits ordered recommendations for
existing capabilities such as Workforce, Inspections, Technical Risk, Incidents, PPE, Training,
Governance and Work Permits. Each recommendation includes the rule keys, human reasons, exact matched
fact identities, provenance, scope-aware pending information, priority, input hash and output hash.

Information coverage has three independent states: `KNOWN`, `EXPLICIT_UNKNOWN` and
`UNANSWERED_APPLICABLE`. `EXPLICIT_UNKNOWN` and a currently applicable unanswered question never
contribute score, and absence is never interpreted as `false`. The canonical question planner is the
single source of applicability, including exact organization or work-center scope; non-applicable
facts and `COMMERCIAL_OPTIONAL` intake do not create capability uncertainty.

When relevant pending information exists and no confirmed indicator reaches the threshold, the
engine emits bounded, scope-aware missing information instead of inventing a recommendation. When
confirmed evidence already reaches the threshold, the proposal remains `PROPOSED` with
`humanDecision=PENDING` and carries any additional relevant pending information in its trace. When
all applicable indicators are explicitly known and negative, it emits neither a proposal nor a
missing-information warning. Equivalent snapshot and applicable-question plans produce identical
versioned input/output hashes.

This is product guidance, not a legal, compliance or technical-risk decision. The deterministic
engine cannot publish regulatory rules, approve Anita review items, calculate GTC45, activate a
module or change a plan. No external LLM participates in the decision. A future explanatory AI may
only restate an already-produced deterministic result under the existing provider boundaries.

## History and tenancy

No migration is required. `SstAssessmentSession.latestResult` already stores the versioned engine
output while `finalSnapshot` freezes the facts. A reassessment creates a child session and a new
result; the previous snapshot, recommendation set and hashes remain unchanged. Organization-scoped
API reads continue to require the validated organization context, and the capability engine receives
no arbitrary organization identifier.

The `1.1.0` output adds scoped pending-information states without rewriting prior `1.0.0` JSON.
Presentation remains read-compatible with historical unresolved fact-key lists while every new
evaluation persists the scoped representation.

The integration regression verifies that evaluation and reevaluation leave organization modules,
subscriptions, feature definitions and plan assignments byte-for-byte unchanged. Existing Adaptive
V1/V2 specialist pins, reference sync, runtime image, regulatory candidates and the zero real
published RuleVersion boundary remain unchanged.

## Validation scenarios

- new organizations generate explainable recommendations from confirmed progressive facts;
- unanswered applicable and explicitly unknown information remain distinct and scope-aware;
- non-applicable and commercial-optional questions cannot create false missing-information warnings;
- a proposed capability can retain additional pending information without changing its human gate;
- all-known-negative indicators produce neither a recommendation nor artificial uncertainty;
- a relevant answer change generates a distinct deterministic evaluation;
- recommendations do not alter effective access or activation state;
- cross-tenant session reads remain denied;
- human confirmation and finalized-history immutability are preserved;
- equivalent input order yields the same recommendation output;
- the UI presents recommendations and current access as distinct concepts.
