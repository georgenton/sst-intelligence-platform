# Workspace UX V2

Status: canonical architecture direction; shared primitives and two bounded pilots implemented.

## Problem

As modules grow, repeated page → detail → back → other page navigation fragments professional
attention and hides provenance. High-information workflows should become **workspaces, not pages**
while preserving addressable routes.

## Information hierarchy

- Primary work is immediately visible.
- Secondary context is collapsible.
- Contextual provenance belongs in a side inspector, drawer or panel.
- Technical internals belong in an explicit Technical Details disclosure.
- A workspace is not one giant screen of accordions.

## Reusable composition

The V2 foundation uses repository-consistent equivalents of:

- `WorkspaceShell`
- `WorkspaceHeader`
- `WorkspaceMain`
- `WorkspaceInspector`
- `WorkspaceSection`
- `ContextSummary`
- `TechnicalDetailsDisclosure`

The contextual inspector may show regulatory foundation, methodology, organization evidence,
history, risk or action context without displacing the current task. It requires an accessible
title, keyboard operation, focus management for modal/narrow variants, focus restoration and a
narrow-screen fallback.

## Routing contract

Next.js App Router remains authoritative. Deep links, refresh, browser Back/Forward and shareable
URLs must continue working. Important content cannot exist only in ephemeral component state. A
drawer may enhance a route but cannot replace its canonical detail URL.

## Component direction

Use accessible shadcn-compatible primitives only when justified: Accordion, Collapsible, Sheet,
Drawer, Tabs, Popover, resizable panels, command/search and master/detail. Do not mass-install a
component system or mechanically use every primitive.

## Initial pilots

1. Inspection/Finding detail: keep action work visible while inspecting methodology, regulatory
   basis, evidence and history.
2. Technical Risk: reuse the same inspector for exact method version, regulatory links and review
   history. Technical Risk maximizes reuse because it already separates method provenance,
   regulatory provenance and professional review.

Both pilots now use the shared `WorkspaceHeader`/`WorkspaceInspector` composition while preserving
their existing routes and domain actions. Obligation Execution and Work Permits also consume the
primitives, validating reuse without turning the workspace into a universal domain component.

## Command Center V2

The primary hierarchy is:

1. **Necesita atención** — deterministic Operational Work Queue with direct actions.
2. **Estado operativo** — concise current state from authoritative modules.
3. **Análisis** — trends and analytics.

Do not lead with a wall of KPI cards or an opaque AI priority score.

## Progressive disclosure and language

Primary UI must not leak `providerKey`, `methodKey`, hashes, raw fact keys, UUIDs, predicate
operators, Prisma/Zod errors or internal role enums. Justified diagnostics may appear under
Technical Details. Product copy remains Spanish and avoids compliance certification, root-cause
claims and diagnosis.

## Responsive and accessibility contract

Validate at 320px, 640px, desktop and 200% zoom across Operativo, Sereno, Noche and Alto Contraste.
Meaning is never color-only. Keyboard access, visible focus, semantic headings/landmarks, focus trap
and restoration where modal, and non-destructive narrow-screen behavior are release gates.

## Future user preferences

Future controlled density modes are `COMFORTABLE`, `COMPACT` and `FIELD`; future text sizes are
`NORMAL` and `LARGE`. Keep IBM Plex Sans and controlled typography—no arbitrary font selector.
Potential user settings include theme, density, text size, sidebar state, landing page, columns,
filters, sorting, saved views and preferred panels. This program creates compatible seams but does
not implement the full preference system.

## Role-aware presentation direction

- Technician: Today, inspections, actions, permits and assessments.
- SST Manager: pending work, deadlines, risks, programs and evidence.
- Management: critical exposure, overdue actions and trends.
- Consultant: organizations, alerts, pending reviews and upcoming deadlines.

The backend and authorization remain the same; role influences presentation priority, not access
authority.
