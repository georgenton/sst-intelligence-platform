# Intelligent Inspections Experience V1

Status: implementation candidate for PR #15. This document records the frontend migration only; it does not redefine the Inspection domain.

## Scope and sources

The experience migrates the seven existing inspection routes in place using the approved engineering handoff, the current NestJS controllers/services and the existing contracts as sources of truth. No route, backend endpoint, Prisma model, entitlement, tenant transition, risk threshold, recurrence rule or workflow transition was added or changed.

The visual implementation follows the field-inspection, field-review and finding-detail references while using the repository's existing semantic tokens, four themes and Focus Mode runtime. Product copy is Spanish; code identifiers remain English.

## Route and data matrix

| Route                                        | Purpose                                                                                    | Reads                                                                                                  | Mutations                                                   | Query ownership                                                                                        | Role and entitlement                                                                                                                       | Focus      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `/app/inspections`                           | Operational overview, indicators, URL filters and recent inspections                       | `GET /dashboard`, `GET /inspections/context`, `GET /inspections`, `GET /inspections/analytics/summary` | None                                                        | Organization-scoped list/analytics/context keys include active `organizationId` and serialized filters | `module.inspections`; all entitled roles read; write roles see creation                                                                    | Workspace  |
| `/app/inspections/new`                       | Create a draft inspection                                                                  | `GET /dashboard`, `GET /inspections/context`                                                           | `POST /inspections`                                         | Organization-scoped context; list invalidated after create                                             | Write: `ORG_OWNER`, `ORG_ADMIN`, `SST_MANAGER`, `SST_TECHNICIAN`, `CONSULTANT`                                                             | Inspection |
| `/app/inspections/[id]`                      | Inspection state and finding list                                                          | `GET /dashboard`, `GET /inspections/:id`                                                               | `POST .../start`, `POST .../complete`                       | Organization + inspection detail; list/analytics invalidated narrowly                                  | Same write roles; API remains authoritative                                                                                                | Inspection |
| `/app/inspections/[id]/findings/new`         | Five-step field capture and server-calculated result                                       | `GET /dashboard`, `GET /inspections/:id`                                                               | `POST .../findings`                                         | Organization + inspection detail; detail/list/analytics/alerts invalidated                             | Same write roles                                                                                                                           | Finding    |
| `/app/inspections/[id]/findings/[findingId]` | Initial/residual risk, recurrence, corrective actions, supported evidence and verification | `GET /dashboard`, `GET /inspections/context`, `GET .../findings/:findingId`                            | Create/update/complete action, add evidence, verify finding | Organization + finding detail; related detail/list/analytics/alerts invalidated                        | Write roles above. Verify: `ORG_OWNER`, `ORG_ADMIN`, `SST_MANAGER`. `SST_TECHNICIAN` completes only an action assigned to the current user | Finding    |
| `/app/inspections/alerts`                    | Triage recurrence and high residual risk alerts                                            | `GET /dashboard`, `GET /inspections/alerts`                                                            | `POST .../alerts/:id/acknowledge`                           | Organization + serialized status filter                                                                | Acknowledge: `ORG_OWNER`, `ORG_ADMIN`, `SST_MANAGER`                                                                                       | Workspace  |
| `/app/inspections/analytics`                 | Stored operational metrics by centre, area and category                                    | `GET /dashboard`, `GET /inspections/context`, `GET /inspections/analytics/summary`                     | None                                                        | Organization + serialized filters                                                                      | All entitled roles read                                                                                                                    | Workspace  |

All query functions propagate TanStack Query's `AbortSignal` through the existing authenticated API client. Tenant switching, logout cleanup and active-organization storage remain owned by the existing AppShell and cache lifecycle.

## Domain boundaries made visible

- The server remains the only source of the `DEMO_5X5` score and risk level. Field capture collects probability and consequence, then renders the returned score, formula, method and version. No frontend risk calculator was added.
- Inspection, finding, corrective-action and alert statuses use separate presentation vocabularies. Completing an action produces `PENDING_VERIFICATION`; it never renders as finding resolution.
- Corrective actions advance in the UI as `OPEN → IN_PROGRESS → PENDING_VERIFICATION → COMPLETED`. No backward transition was added.
- V1 evidence exposes only `NOTE` and `EXTERNAL_LINK`. There is no file, photo or upload affordance.
- Every recurrence surface carries: “Este aviso indica recurrencia, no confirma una causa raíz.” The existing same-organization, same-centre, same-category, 90-day policy is unchanged.
- Residual verification is a separate accessible dialog, available only to the current verification roles. High/critical residual alerts continue to be created by the backend.
- Permission and entitlement explanations aid comprehension; they are not security controls. The API guard remains authoritative.

## Backend/source-of-truth exception

The design reference anticipates a separate explicit finding-close control. The current V1 API has no close endpoint: `verifyFinding` closes the finding automatically when its existing prerequisites are satisfied. The UI explains that behavior and does not invent a dead control, client-only transition or unsupported endpoint.

The handoff also depicts a global Hallazgos/Acciones workspace. The current API does not expose an organization-wide corrective-action list and the route does not exist. V1 therefore improves the existing route surface without creating a route, fake list or backend dependency.

## State, accessibility and responsive behavior

- Structural skeletons, scoped retry states, true empty states, permission states and entitlement states are distinct.
- Page headings use one `h1`; filtered result counts are live; active filters are visible, removable and reflected in the URL.
- The five-step finding flow preserves React Hook Form state, validates before advancement and moves focus to the next step heading.
- Risk carries label, geometric shape, colour and score when available. Status carries a glyph and label.
- Verification and terminal inspection completion use a labelled `aria-modal` dialog with focus trap, Escape handling and focus restoration. Native `confirm()` is removed.
- Controls retain a 44 px minimum target. At 320 CSS px, lists become cards, scales become vertical controls and dialogs become bottom sheets without horizontal page scrolling.
- The same anatomy is used by Operativo, Sereno, Noche and Alto contraste. Components do not read the active theme. Focus Mode never hides organization context, demo notices, risk, recurrence, permission constraints or the primary task action.

## Test contract

- Pure presentation tests cover independent status vocabularies, role policies, technician assignment, URL filters and the forward-only action presentation.
- Query-cache regression tests cover the new filtered factories under the organization namespace.
- The existing Inspection E2E now covers draft creation, start, five-step finding capture, server result, action start, supported note evidence, action completion, residual verification and resulting closure.
- The same E2E performs the 320 px reflow check, mobile verification dialog, four-theme pass and inspection/finding Focus Mode isolation without adding another registration journey.
- No `waitForTimeout`, force click, committed screenshot or synthetic frontend-only record is introduced.
