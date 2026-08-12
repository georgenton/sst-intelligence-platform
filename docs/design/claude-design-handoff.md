# Claude Design Handoff

## PRODUCT

SST Intelligence Platform

## PLATFORM

B2B multi-tenant SaaS for occupational safety operations. Current product is a working Spanish-language web demo, not a static concept. Deterministic SST decisions and API authorization are already implemented; visual design must not invent or alter them.

## PRIMARY USERS

- SST Manager — vision, alerts, trends, assignment, professional review.
- SST Technician — fast field capture, findings, evidence, actions.
- Consultant — safe multi-organization work, assessments, follow-up.
- Owner/Admin — organization, access, modules, plan.

## DESIGN GOALS

- serious, trustworthy, operational, clear, field-friendly, and modern;
- not a generic corporate dashboard and not a playful consumer app;
- make “what needs attention” and “what happens next” obvious;
- reduce field friction without hiding technical context;
- make organization, location, workflow status, method/version, and demo state legible;
- support phone field work, tablet review, and desktop analysis as distinct compositions.

## NON-NEGOTIABLE CONSTRAINTS

- Spanish product copy; English code identifiers.
- Mobile-first field flows and desktop analytics.
- Risk is never communicated by color alone.
- Demo content and demo methods are clearly labeled.
- No medical/clinical appearance, diagnosis, guaranteed compliance, or legal-certification claims.
- “Aprobada” means reviewed by an authorized user, not regulatory certification.
- Preserve exact semantic differences: Save, Start, Complete, Verify, Request review, Approve review.
- **Professional Review V1:** `APPROVED` and `NEEDS_REVISION` are available only to `ORG_OWNER`, `ORG_ADMIN`, and `SST_MANAGER`.
- A Consultant must not be designed as an approving reviewer.
- UI visibility is not security; API guards remain authoritative for role and entitlement.
- Organization -> center -> area context must survive the journey and remain understandable.
- Do not change business logic, route behavior, API contracts, or deterministic calculations.

## DESIGN DIRECTION TO EXPLORE

Explore a calm industrial/operational system with high information confidence: strong hierarchy, restrained semantic color, generous readable density on desktop, and decisive action placement in the field. Use risk/state icon + label + color, compact but scannable metrics, and evidence/history patterns that feel auditable without resembling medical records or legal certificates.

Avoid decorative glassmorphism, gamification, oversized marketing typography inside the app, vague gradients, and dashboard widgets with no action. Branding is intentionally not final; propose a visual system without binding semantic tokens directly to a final palette.

## INFORMATION ARCHITECTURE PROPOSAL

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

The active organization is global context. Demo status is global. Public diagnosis sits outside the authenticated shell. Treat this as a design proposal, not an already-approved navigation change.

## CRITICAL FLOWS — EXACTLY FIVE

1. **Executive / SST dashboard:** answer “¿Qué necesita atención hoy?” and enter the most important risk, overdue action, recurrence, or pending review.
2. **Mobile field inspection:** confirm location, start work, capture a structured finding/evidence, understand the deterministic preview, save with minimal typing.
3. **Finding -> corrective action -> verification:** assign an action, complete it, then separately verify residual risk and preserve history.
4. **Technical assessment:** select one active method/version, location and context; answer; review; calculate; understand score/level/demo disclaimer.
5. **Recurrence / professional review:** move from signal to evidence, assess recurrence/risk, request changes or approve as an authorized reviewer.

For every flow show loading, empty, success, warning, error, disabled, permission denied, entitlement required, and demo states. Only acknowledge offline as a future field placeholder; do not design a fake working offline mode.

## REPRESENTATIVE SCREENS

Use the exact 12-item inventory in `screen-inventory.md` and the current-state PNGs in `screenshots/`. The captures contain only synthetic data. Study current hierarchy and friction; do not preserve weak layouts merely because they exist.

## COMPONENT ANATOMY TO DEFINE

Prioritize Page Header, Metric Card, Risk Badge, Status Badge, Demo Notice, Empty/Error/Loading State, Progress/Wizard Step, Data Row, Action/Finding/Method Card, Question Input, Review Panel, Alert Item, Organization Switcher, accessible Dialog, and responsive dense-list/table patterns. See `component-inventory.md` for current duplication and boundaries.

## RESPONSIVE EXPECTATIONS

- Mobile (~390): task-first single column, 44 px+ targets, reduced shell chrome, no horizontal table, clear sticky/near-thumb primary action when safe.
- Tablet: field capture plus contextual review/evidence.
- Desktop (~1440): grouped persistent navigation, dense triage/analysis, filters and optional side panels.

Maintain accessible DOM order across representations. Mobile cards and desktop table rows may share data/state but not necessarily markup.

## ACCESSIBILITY ACCEPTANCE

WCAG 2.2 AA target; keyboard and focus-visible operation; logical headings/landmarks; named progress and states; control/error association; screen-reader status announcements; 200% zoom and 320 px reflow; reduced motion; risk/state not color-only; dialog focus trap/restoration; errors preserve user input and explain recovery.

## TECHNICAL BOUNDARY

Next.js App Router remains routing/framework. TanStack Query remains server state. TanStack Table is reserved for dense operational lists with mobile card rendering. React Hook Form remains forms. Do not introduce TanStack Form/Router/Start/Store/Virtual. Future React Native + Expo can share contracts, validation, API client, query-key semantics, and semantic token source data—but not DOM components or CSS.

## EXPECTED DESIGN OUTPUT

1. A visual direction and semantic token proposal, showing light-theme states without finalizing brand.
2. Responsive shell/navigation concepts for mobile, tablet, and desktop.
3. High-fidelity treatments for the five flows and 12 representative screens.
4. Component variants and state matrices, including permission/entitlement/demo.
5. Explicit annotations where a proposal changes information architecture or component behavior; do not silently change product rules.

## INPUT PACK

- `README.md` — how to consume the pack and provenance.
- `ux-ui-foundation-v1.md` — product/architecture/UX decisions.
- `claude-design-handoff.md` — this contract.
- `screen-inventory.md` — exact screen list and capture mapping.
- `component-inventory.md` — current duplication and future component anatomy.
- `screenshots/` — 12 current-state PNGs.

Excluded intentionally: `.env`, tokens, customer data, database dumps, `node_modules`, backend internals, and credentials.
