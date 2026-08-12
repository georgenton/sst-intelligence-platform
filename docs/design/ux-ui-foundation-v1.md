# UX/UI Foundation V1

Status: proposed foundation; no production redesign is included in this increment.

## Product UX principles

1. **Operational clarity before decoration.** Every screen should answer what happened, what needs attention, and what action is available.
2. **Tenant context is always visible.** Organization, work center, and area stay explicit through operational flows. Switching organization must never preserve another tenant's server state.
3. **Risk is never color-only.** Level, score, iconography, and copy travel together; demo methods are never presented as validated regulation.
4. **Field work minimizes typing.** Use large targets, sensible defaults, structured choices, progressive disclosure, and immediate feedback.
5. **Workflow verbs are precise.** Save, start, complete, verify, request review, and approve review are distinct actions with distinct states.
6. **Demo is unmistakable.** Synthetic content, demo periods, method disclaimers, and non-certification language remain visible at decision points.
7. **Authorization belongs to the API.** UI visibility improves comprehension but never replaces role and entitlement guards.
8. **Accessibility is a release criterion.** Keyboard flow, focus, semantics, contrast, zoom, and error recovery are part of component acceptance.

## Current frontend findings

- Next.js 16 App Router, React 19, strict TypeScript, React Hook Form, Zod, and TanStack Query are already in use.
- `app/` routes are thin wrappers around client components. The direction is correct, but feature code is concentrated in the flat `components/` directory.
- `inspections-ui.tsx` (1,161 lines) and `technical-risk-ui.tsx` (943 lines) each contain multiple screens, local primitives, queries, mutations, and forms.
- `packages/ui` exposes only `Button`, `Card`, and `StatusBadge`; these rely on global CSS class names owned by the web app.
- `globals.css` is 521 lines and mixes tokens, public site, app shell, forms, feature components, risk states, and responsive rules.
- Duplicated concepts include `RiskBadge`, demo notices, page introductions, metrics, data rows, form actions, and empty/error/loading presentations.
- Most lists are adaptive cards. No current surface needs a forced table conversion.
- TanStack Query keys are inline arrays. Most tenant data includes `organizationId`, but `['module-catalog']` does not; broad invalidations and `invalidateQueries()` on organization switch obscure cache ownership.
- Logout clears authentication state but does not explicitly clear the query cache. This is a cross-session data exposure risk on a shared browser.
- Loading and errors exist but vary by screen; empty, permission-denied, entitlement-required, and disabled states are not modeled consistently.
- Mobile collapses the shell at 820 px, but the full navigation becomes a horizontal strip and topbar consumes substantial vertical space.
- Native `confirm()` is used for a terminal inspection transition; a future accessible confirmation dialog should make the consequence explicit.

## Architecture target

Keep Next.js App Router, React, and strict TypeScript. Evolve by vertical slice only when a feature is touched:

```text
apps/web/
  app/                         route files and layouts only
  features/
    auth/
    organizations/
    dashboard/
    solution-finder/
    inspections/
    technical-risk/
      api/                     feature requests; no auth/tenant invention
      components/              feature UI
      hooks/                   orchestration hooks when useful
      screens/                 route-level composition
      query-keys.ts            tenant-safe key factory
      types.ts                 presentation types only
  components/                  truly shared web components
```

The dependency direction is `Route -> Screen -> feature components -> shared web components`. Do not create empty folders, repositories, domain copies, or ceremonial layers. Move code opportunistically in later functional increments, not as a big-bang rewrite.

Keep `packages/ui` until a rename has concrete value. Evolve it into web-only primitives with explicit styles and accessibility contracts. React Native must not import DOM components.

Initial justified primitives are Button, Input, Textarea, Select, Checkbox, RadioGroup/Scale, Card, Badge, Alert, Dialog, Sheet, Tabs, Tooltip, Skeleton, Table shell, Pagination, and Toast. Add each only with a current use case; do not mass-install shadcn/ui.

## TanStack Query strategy

TanStack Query remains the standard for server state. Use factories rather than handwritten arrays:

```ts
const queryKeys = {
  organizations: {
    all: (userId: string) => ['organizations', userId] as const,
    detail: (organizationId: string) => ['organization', organizationId] as const,
  },
  inspections: {
    all: (organizationId: string) => ['inspections', organizationId] as const,
    detail: (organizationId: string, id: string) =>
      ['inspections', organizationId, 'detail', id] as const,
    findings: (organizationId: string, filters: unknown) =>
      ['inspections', organizationId, 'findings', filters] as const,
  },
  technicalRisk: {
    methods: (organizationId: string) => ['technical-risk', organizationId, 'methods'] as const,
    all: (organizationId: string) => ['technical-risk', organizationId, 'assessments'] as const,
    detail: (organizationId: string, id: string) =>
      ['technical-risk', organizationId, 'assessment', id] as const,
  },
};
```

Conventions:

- Every organization-scoped key includes the validated active `organizationId`, including entitlements and module catalog.
- A mutation invalidates the narrowest affected detail/list/analytics keys. Avoid unscoped prefixes and global invalidation.
- On organization switch, cancel outgoing tenant queries, update context, and render the next tenant from a new key. Do not show stale previous-tenant data as placeholder data.
- On logout or authenticated-user change, cancel and clear private query data before redirecting. Public solution-finder queries may be isolated in their own namespace.
- Default `staleTime: 20s` is reasonable for dashboards. Use shorter times for alerts and workflow detail; longer times for versioned method metadata. Record exceptions next to the query.
- Retry idempotent GETs once for transient network/5xx failures. Do not blindly retry 401/403/404 or mutations.
- Normalize an API error envelope into recoverable page/section/field states. Never expose raw server messages as product copy.
- Keep auth tokens outside query keys and persisted caches. Query Devtools are a local-development concern only.

### TanStack Table

Adopt TanStack Table only for genuinely dense operational datasets: findings search, corrective actions, inspection history, technical assessments, alerts, and a future audit timeline. Desktop may use sorting/filtering/pagination; mobile renders the same row model as cards or an action list. Do not force horizontal tables onto phones. TanStack Virtual remains out until measured volumes and rendering cost justify it.

### Forms

React Hook Form remains the form standard. Keep Zod/resolver validation at UI boundaries and shared contract validation in `packages/contracts`. Do not migrate to TanStack Form. Prefer one form per transactional intent, preserve in-progress wizard state, focus the first invalid field, and distinguish field errors from request failures.

Do not adopt TanStack Router, Start, Store, or Virtual in V1.

## Design tokens

Separate primitive values from semantic intent. The mapping below is a proposal, not final branding.

| Family | Primitive examples | Semantic aliases |
|---|---|---|
| Color | `green.50..900`, `slate.50..950`, `amber.*`, `red.*`, `violet.*` | `color.brand.*`, `surface.*`, `text.*`, `border.*`, `interactive.*` |
| Status | palette references | `status.success`, `status.warning`, `status.danger`, `status.info` |
| Risk | palette references | `risk.low`, `risk.moderate`, `risk.high`, `risk.critical` |
| Spacing | 4 px base scale | `space.1..12`, `layout.gutter`, `layout.section` |
| Radius | 6/10/14/20/full | `radius.control`, `radius.card`, `radius.pill` |
| Typography | font family, size, weight, line height | `text.body`, `text.label`, `text.metric`, `text.pageTitle` |
| Shadow | elevation values | `shadow.card`, `shadow.overlay`, `shadow.focus` |
| Motion | duration/easing | `motion.fast`, `motion.standard`, respecting reduced motion |

`risk.critical` maps to a palette value per theme; components consume `risk.critical`, never `red500`. Text/icon/border semantics accompany the color. Breakpoint behavior belongs to web layout tokens; platform-neutral sizes and semantic colors may later be shared with Native.

## Information architecture

Current navigation mixes tasks, product catalog, account context, and configuration. Proposed V1, pending design approval:

```text
Inicio
Operación
  Inspecciones
  Hallazgos y acciones
  Alertas
Evaluaciones
  Riesgo técnico
Análisis
  Tendencias y recurrencias
Gestión
  Organización
  Equipo
  Módulos y plan
```

The active organization remains a global context control, not a navigation destination. Demo status stays globally visible. Settings can be grouped under Gestión. The public diagnostic remains outside the authenticated shell. This increment does not implement the proposed navigation.

## Personas

| Persona | Primary need | High-value actions | Failure to avoid |
|---|---|---|---|
| SST Manager | See priorities, trends, reviews, and ownership | Triage alerts, review risk, assign/follow actions | A dashboard that reports counts without a next action |
| SST Technician | Capture reliable field evidence quickly | Start inspection, create finding, attach evidence, complete work | Desktop-compressed forms and excessive typing |
| Consultant | Work safely across organizations | Switch tenant, execute assessments, review follow-up | Tenant ambiguity or cached data crossing organizations |
| Owner/Admin | Configure access and product scope | Manage organization/team/modules/plan | Mistaking hidden UI for authorization or unclear entitlements |

## Five critical journeys

Exactly five journeys are in scope for the later design pass.

### 1. Executive / SST dashboard — “¿Qué necesita atención hoy?”

SST Manager lands in a clearly named organization, sees high/critical risk, overdue actions, recurrence, and pending professional review, then enters the highest-priority item. Loading uses metrics skeletons; empty distinguishes “no data” from “no attention”; warning explains stale/partial data; error offers retry; permission and entitlement states state why access is unavailable; demo is always labeled.

### 2. Mobile field inspection — “Registrar un hallazgo con mínima fricción”

SST Technician confirms organization/center/area, starts an inspection, records a structured finding with risk inputs and optional evidence, reviews a deterministic preview, and saves. Primary controls are thumb-sized; typing is limited; validation stays close to fields; offline is only a future placeholder, never simulated.

### 3. Finding -> corrective action -> verification — “Cerrar un problema de forma verificable”

Manager or technician opens a finding, creates an owned/due action, completes it, then verifies residual likelihood and consequence. The UI distinguishes action completion from technical verification and shows history. Terminal actions require explicit confirmation; disabled/permission states explain the missing prerequisite.

### 4. Technical assessment — “Ejecutar un método versionado sin perder contexto”

User selects exactly one active method/version, location, context, technical answers, and optional evidence; reviews the inputs; the server calculates; the result shows version, score, level, demo flags, and disclaimer. Errors never suggest a guessed result; entitlement and role guards are visible but remain server-authoritative.

### 5. Recurrence / professional review — “Entender recurrencia y decidir la siguiente acción”

SST Manager or Consultant moves from alert/recurrence evidence to the record, reviews method, response, evidence, author, and result, then requests changes or approves. Approval explicitly means reviewed by an authorized user and never legal certification. The audit-relevant actor/time/decision is visible after success.

## UX state model

Every journey and shared component designs for: `loading`, `empty`, `success`, `warning`, `error`, `disabled`, `permission denied`, `entitlement required`, and `demo`. An `offline future` placeholder is documented only for field capture and is not implemented.

State copy answers: what happened, whether data is safe/current, what the user can do, and whether their input was preserved. Avoid blank cards and endless spinners. A tenant switch is a context transition with fresh loading, never an optimistic content swap.

## Responsive strategy

- **Mobile field (~390 px):** compact context header, task-first navigation via future Sheet/bottom actions, single-column forms/cards, sticky primary action when safe, full-width controls, no horizontal data table.
- **Tablet:** field capture plus side-by-side review where space permits; evidence and context can remain visible while editing.
- **Desktop (~1440 px):** persistent grouped navigation, multi-column metrics, dense filters/list views, and side panels for analysis/review.

Responsive is not desktop compression. Content priority, action placement, and representation may change while business meaning and accessible reading order remain the same.

## Accessibility principles

- WCAG 2.2 AA target; keyboard access and visible focus for every action.
- One page `h1`/primary heading and logical heading order; landmarks and accessible names for navigation, metrics, progress, alerts, dialogs, and form groups.
- Minimum 44x44 CSS px touch targets for primary field controls.
- Text/icon/status labels accompany risk and state colors; target contrast applies in every theme/state.
- Associate errors and help with controls, announce request outcomes, focus the first error, and preserve entered values after recoverable failures.
- Dialog focus is trapped/restored; Escape/cancel semantics are predictable. Replace native confirms when the shared accessible Dialog exists.
- Zoom to 200%, 320 CSS px reflow, reduced motion, and screen-reader order are acceptance checks.
- Product copy avoids diagnosis, guaranteed compliance, and certification claims.

## React Native boundary

Future only: `apps/mobile` may use React Native + Expo. It can share platform-neutral contracts, API client, validation, business rules, query-key semantics, and semantic token source data. It must implement native UI components separately and must not import DOM React components, CSS, Next.js routing, or web layouts. No mobile app is created in this increment.

## Adoption sequence

1. Fix query key/cache-clearing conventions with tests before expanding tenant-heavy UI.
2. Extract shared accessible state and status components as features next change.
3. Split large feature files by screen/API/query keys during functional work.
4. Introduce table behavior only for a selected dense list, with card rendering on mobile.
5. Validate the proposed IA and visual direction in Claude Design before changing production navigation or branding.
