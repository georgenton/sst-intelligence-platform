# Technical Risk Experience V1

## Scope and route map

This increment migrates the existing deterministic Technical Risk module in place. It adds no route, method engine, risk calculation, lifecycle transition, review semantic, entitlement rule, or browser persistence.

| Route | Responsibility | Query | Mutations | Focus scope |
| --- | --- | --- | --- | --- |
| `/app/technical-risk` | Method catalog, real analytics, assessment list and operational filters | active methods, organization assessments | none | `workspace` |
| `/app/technical-risk/new` | Select an active method and create a contextualized draft | active methods, work centers and areas | create `DRAFT` | `technical-assessment` |
| `/app/technical-risk/[id]` | Start, answer, save evidence, complete, and present the server result | organization-scoped assessment detail | start, response upserts, evidence, complete | `technical-assessment` |
| `/app/technical-risk/[id]/review` | Present the immutable evaluation context and register an authorized professional decision | organization-scoped assessment detail | professional review | `professional-review` |

Every query and invalidation reuses the organization-scoped factories. Entitlement and role checks remain API-authoritative; UI affordances only communicate the current capability.

## Screen responsibilities

- The workspace separates method provenance, lifecycle state, result risk and professional review state. Metrics come from the existing list response.
- Creation makes method/version, work context and demo status explicit. It creates a draft only; starting and completing remain separate actions.
- Execution renders the seven supported contract discriminants with native controls. React Hook Form holds transient input and existing API mutations persist answers and evidence; local and session storage are not used.
- Completion displays only server-derived score, level and result data. Questionnaire progress represents answered questions, never safety or compliance.
- Professional review preserves result context and requires an explicit decision plus confirmation. Risk result and review decision remain independent.

## Method and version provenance

Catalog screens display the current active versions returned by the API. Assessment, result and review screens instead use the assessment's stored `methodSnapshot` and `methodVersion`; they never substitute a newer catalog version. The method code and version may use the technical monospace style.

The reference `DEMO_TECHNICAL_RISK` method remains visibly identified as a demonstration, non-regulatory method. Copy never describes it as certified, official, legally compliant, or regulatory.

## Lifecycles

Assessment lifecycle remains:

`DRAFT → IN_PROGRESS → COMPLETED → REVIEWED`

`CANCELED` remains an API-supported state and receives truthful presentation, but this increment adds no cancellation mutation.

Professional review occurs only after completion:

- `APPROVED` moves the assessment from `COMPLETED` to `REVIEWED`.
- `NEEDS_REVISION` is recorded while the assessment remains `COMPLETED`; it never rewinds to draft or in progress.

The client contains no optimistic lifecycle machine. A conflict response produces precise stale-state feedback and refetches the current assessment.

## Permission presentation

Creation, execution and completion affordances are presented for `ORG_OWNER`, `ORG_ADMIN`, `SST_MANAGER`, `SST_TECHNICIAN`, and `CONSULTANT`. Active professional-review controls are presented only for `ORG_OWNER`, `ORG_ADMIN`, and `SST_MANAGER`. Other roles may read permitted context without seeing an approving control. API guards remain authoritative for organization membership, roles, entitlement and state.

## Responsive and accessible behavior

Desktop uses a dense readable list and split result/review layouts. At tablet and mobile widths these reflow into cards and a single column. At 320 px, question controls, progress and sticky actions remain reachable without horizontal scrolling; sticky actions stack rather than cover fields or errors.

Each field has a programmatic label or `fieldset`/`legend`, associated help and error text, keyboard-reachable native controls, visible focus and non-color status symbols. The confirmation dialog has an accessible name and description, modal semantics, focus containment, Escape handling and focus restoration. Risk and lifecycle meaning always use text and symbol in addition to semantic color.

## Focus and themes

The existing focus storage and route scopes are unchanged. Assessment Focus retains context, provenance, questions, progress, errors, save/complete actions and exit path. Professional Review Focus retains result, method/version, warnings and decision controls while reducing secondary decoration.

All module styling is scoped under `technical-*` ownership and consumes foundation semantic tokens. Operativo, Sereno, Noche and Alto contraste therefore inherit the established palette and focus contracts without global token changes.

## Handoff deviations and future boundaries

The Engineering Handoff is followed for hierarchy, responsive reflow, native inputs, explicit state and professional-review separation. Where historical material suggested that requesting changes might reopen execution, the current API and binding errata take precedence: `NEEDS_REVISION` remains `COMPLETED`.

Future increments may add regulatory method content, method administration, recommendation explanation, audit-event surfaces or Adaptive SST concepts only after corresponding domain and API contracts exist. This V1 does not add AI, a universal schema builder, a second scoring engine, persistent browser drafts, regulatory claims, signatures or uploads.
