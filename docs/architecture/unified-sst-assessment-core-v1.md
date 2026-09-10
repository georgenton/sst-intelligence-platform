# Unified SST Assessment Core V1

Status: implemented in PR46; external audit pending. This is a backend and contract foundation, not
the guided visual experience, module recommendation, activation or plan-generation increment.

## Baseline audit

The pre-PR46 baseline at `509f2db3a0987356923f6357b26157169e334e17` had three useful but
separate entry points:

- Solution Finder was a public six-step flow backed by one JSON answer blob. Several unanswered
  booleans started as `false`, so absence and a negative answer were not reliably distinct. Its
  output was the earlier commercial recommendation model with a 0–100 score.
- Adaptive Configuration already owned deterministic rules, session revisions, runs, generated
  questions, proposals and input/output hashes. Its legacy `createSession`, however, copied the
  organization-level `hasChemicalProcesses` and `hasHighEnergyOperations` profile flags to every
  selected Work Center. PR46 does not use that fan-out path.
- Unified SST Evaluation was a regulatory-candidate specialist rather than a complete
  orchestrator. Its create operation required a manually selected ProfileVersion and evaluated a
  minimal country/worker-count fact set against the candidate pilot corpus.
- The authenticated UI exposed manual ProfileVersion/pack execution and the complete AppShell.
  There was no canonical setup-state gate.

Legacy routes and stored history remain unchanged. Their replacement in the product UI is outside
PR46.

## Decision

`SstAssessmentModule` is the canonical facade. It owns intake facts and scopes, question planning,
session lifecycle, semantic normalization and orchestration. It calls, but does not copy, the
existing Adaptive Configuration evaluator and regulatory-candidate evaluator.

```text
Public or authenticated intake
             |
             v
  SstAssessmentService
      |             |
      v             v
Adaptive DEMO   Regulatory candidate
specialist      specialist
      \             /
       canonical result
```

There is no fourth rules engine and no super-score. The Adaptive engine remains authoritative for
its rule precedence and traces. The regulatory specialist remains candidate interpretation that
requires professional review. Guided 5×5, GTC45, inspections, recurrence, current-state evidence,
commercial recommendation and module activation retain their independent owners.

The regulatory candidate pack loader is shared by the legacy `UnifiedSstEvaluationService` and the
new facade so pilot loading and country normalization are not duplicated.

## Canonical semantics

The shared `@sst/contracts` snapshot has versioned scopes and facts. A missing fact object means
unanswered. `KNOWN` always has a typed value, including the valid value `false`.
`EXPLICIT_UNKNOWN` has no value. Empty strings, `null`, magic `UNKNOWN` boolean values and silent
coercion are rejected.

Facts are identified by `(scopeKey, factKey)`. `organization` is the only organization scope;
`center:1` through `center:100` are deterministic logical Work Center scopes. Authenticated scopes
may carry a server-owned WorkCenter UUID for persistence mapping, but semantic hashes exclude that
UUID and display label. Public and authenticated snapshots with equivalent facts therefore hash
identically.

The canonical catalog is the single source for question text, help, topic, type, choices, purpose,
order, unknown support and LOW/MEDIUM sensitivity. `activityCategories` and `facilityTypes` are
multi-choice facts. They are retained without compression; the V1 adapter deliberately omits them
from legacy singular fact keys instead of selecting one value or losing the remaining values.

An explicitly unknown fact is omitted from specialist inputs but remains in the canonical snapshot
and suppresses the same question for that session. Unanswered facts remain eligible for the finite,
deterministically ordered question planner. Progress counts answered facts and completed topics; it
is not a compliance percentage.

## Persistence and lifecycle

Migration 34 adds only `SstAssessmentSession` plus three lifecycle enums. The row stores:

- public or authenticated origin, initial/reassessment kind and status;
- monotonically increasing `sessionRevision`;
- versioned scope and fact snapshots;
- latest result and immutable final snapshot;
- semantic input/output hashes and specialist version traces;
- optional organization/user, profile, specialist and parent-assessment references;
- public-token hash, expiry and explicit claim-scope mappings.

Every mutation uses the expected revision. A conditional write has one winner; stale requests
receive `SST_ASSESSMENT_REVISION_CONFLICT` (HTTP 409). Finalized sessions reject fact mutations.
A reassessment is a new child row that copies still-applicable facts with explicit
`PREVIOUS_ASSESSMENT` provenance; it never edits its parent. Explicitly unknown facts are eligible
to be asked again in the new reassessment rather than silently becoming known.

Authenticated finalization automatically creates a new immutable OrganizationSstProfileVersion
only when the canonical profile differs from the latest version; otherwise it reuses the latest.
Work Center operational facts are stored with their exact server WorkCenter UUID in V2
`contextFacts`. The legacy organization-wide operations flags are left empty, preventing
organization-to-all-center fan-out.

## Public security and claim

A public session receives a 32-byte random bearer token once. PostgreSQL stores only its SHA-256
hash. Verification uses constant-time comparison, returns a generic invalid-session response and
enforces expiry. Tokens are carried in `x-assessment-token` for normal public operations and in the
authenticated claim request body; they are never query-string parameters.

Claim requires current authenticated organization context and a currently authorized write role.
Every public center must map exactly once to a distinct active WorkCenter in that organization.
Claim is idempotent only for the same organization and exact mapping; another organization cannot
steal it. Claim never starts a demo, enables a module, changes a plan, assigns an entitlement,
rewrites the final snapshot or recalculates a result.

## Authorization and setup state

Authenticated reads require `AccessTokenGuard` followed by `OrganizationGuard`. Writes and claim
then require `RolesGuard` for `ORG_OWNER`, `ORG_ADMIN` or `SST_MANAGER`; VIEWER remains read-only.
All persistence reads include the validated organization identifier.

The server derives exactly three setup states:

- `NEEDS_ASSESSMENT` when there is no assessment;
- `ASSESSMENT_IN_PROGRESS` while a mutable session exists;
- `DIAGNOSIS_READY` when only finalized history remains.

PR46 does not produce `SETUP_COMPLETED` and does not change AppShell navigation. PR47 may consume
this endpoint to build the guided UX.

## Authority, privacy and exclusions

Adaptive output is marked `DEMO`; regulatory pilot output is marked `CANDIDATE`. Authority is
derived on the server. Every result states that it is deterministic and orientative, does not
accredit legal compliance and does not replace professional review.

The intake accepts only LOW/MEDIUM organizational and operational context. It has no worker PII,
medical or individual psychosocial data, incident narratives, evidence binaries, credentials or
privileged investigations. It makes no external-AI request. It does not implement final module
recommendations, activation, plan/work-queue generation, a Protocol Engine, automatic root cause,
Worker Safety Score, embeddings or a vector database.
