# Authenticated AppShell + Command Center V1

## Scope

This increment applies the approved visual foundation to authenticated `/app` surfaces. It changes
the shell and the `/app` Command Center only. Public pages and the internal Inspection and Technical
Risk workflows retain their existing behavior.

## Implemented route map

| IA group     | Product label             | Existing route               | Data / access dependency                      |
| ------------ | ------------------------- | ---------------------------- | --------------------------------------------- |
| Inicio       | Inicio                    | `/app`                       | Active organization and `/dashboard`          |
| Operación    | Inspecciones              | `/app/inspections`           | `module.inspections`                          |
| Operación    | Alertas                   | `/app/inspections/alerts`    | `module.inspections`                          |
| Evaluaciones | Riesgo técnico            | `/app/technical-risk`        | `module.technical_risk`                       |
| Análisis     | Tendencias y recurrencias | `/app/inspections/analytics` | `module.inspections`                          |
| Gestión      | Organización              | `/app/settings/organization` | Active membership / API authorization         |
| Gestión      | Equipo                    | `/app/settings/members`      | Active membership / API authorization         |
| Gestión      | Módulos                   | `/app/modules`               | Global catalog plus organization availability |
| Gestión      | Plan                      | `/app/billing`               | Organization subscription and entitlements    |

The shell also keeps the existing direct destinations `/app/organizations` and `/app/demo` in the
top bar and demo notice. No route was added for this increment. IA destinations without a real route
were omitted.

## AppShell architecture

- `AppShell` remains the sole owner of authenticated organization context, membership reconciliation,
  active-organization storage, transition state, and tenant cache isolation.
- `AppSidebar` owns grouped navigation presentation and the native mobile disclosure.
- `AppTopbar` presents the active organization selector, appearance controls, organization management,
  and logout; all state-changing callbacks remain in `AppShell`.
- `app-navigation.ts` is a small explicit route model with group, match strategy, and optional feature
  visibility. Nested matching selects the most specific implemented destination. AppShell does not
  issue another dashboard request just to hide links; real routes remain discoverable and API guards
  remain authoritative.
- The transition view removes tenant content and the demo notice until the validated target context is
  active.

## Command Center data sources

| Section                                     | Existing source                   | Representation                                                    |
| ------------------------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| Organization context, plan, modules, counts | `GET /dashboard`                  | Active organization, plan, work centers, members, enabled modules |
| Inspection attention                        | `GET /dashboard`                  | High/critical findings, overdue actions, recurrence count         |
| Detailed inspection alerts                  | `GET /inspections/alerts`         | Up to three links to existing finding records                     |
| Technical work                              | `GET /technical-risk/assessments` | Completed assessments and drafts/in-progress records              |

All new queries use existing tenant-scoped query-key factories and propagate `AbortSignal`. The UI
does not create a priority score, compliance percentage, trend, legal conclusion, or synthetic KPI.
Empty and error states state only what the available source can support and link only to implemented,
entitled actions.

## Responsive and accessibility behavior

Desktop uses a persistent grouped sidebar. At 900 px and below it becomes an in-flow disclosure
controlled by a native button with `aria-expanded` and `aria-controls`; it is not a modal and does not
need a focus trap. At 680 px the top bar and Command Center actions reflow into single-column controls.
The 320 px layout preserves usable organization, theme, focus, navigation, and logout controls without
horizontal page overflow.

The shell includes a skip link, labeled navigation and organization controls, visible focus, minimum
target sizes, one Command Center `h1`, ordered section headings, `aria-current="page"`, and a live
organization-transition status. Active navigation includes a marker and weight change in addition to
color.

## North Star deviations

- Regulatory/applicability summaries are omitted because no Applicability Engine exists.
- Compliance percentages, AI priorities, risk trends, and historical comparisons are omitted because
  no authoritative source exists.
- Standalone actions, findings, documents, and reports destinations are omitted because the repository
  has no corresponding production routes.
- Charts and decorative iconography are omitted; existing actionable counts and textual risk semantics
  provide the available information without adding a library.
- Inspection and Technical Risk detail/list layouts only inherit the shell and are intentionally not
  migrated in this increment.

## Components introduced

- `AppSidebar`
- `AppTopbar`
- explicit application navigation model
- local Command Center sections, metrics, attention items, and module cards

No dependency, API, contract, Prisma, role, entitlement, query-taxonomy, or CI configuration change is
part of this increment.
