# Consultant Portfolio V1

Status: **PRODUCTION CLOSED** through PR36/37/38 on 2026-09-03. Runtime merge:
`c5bc3a2cc38db10e39e4e66117f7d18e296dd509`. See
[production authorization evidence](../architecture/consultant-portfolio-authorization.md#production-verification--pr363738)
and [release/E2E gate](../testing/e2e-runtime.md#cierre-productivo-pr363738--2026-09-03).

## Purpose and language

The portfolio is a read-only aggregation over the current active memberships of the authenticated
user. It answers which authorized organizations need attention and links every item back to its
canonical organization workspace. It is not an organization, super-tenant, data warehouse or
replacement lifecycle. It never describes an organization as safe, unsafe, compliant or
non-compliant and exposes no organization safety score.

The factual labels are “Necesita atención”, “Sin pendientes críticos registrados”, “Acciones
vencidas”, “Señales operativas” and “Paquetes pendientes”.

## Computed model

`ConsultantOrganizationSummary` is computed per request from:

- organization identity, current membership role and active Work Center count;
- open Work Queue source records, with overdue state calculated from their stored due dates;
- existing canonical `OperationalSignal` records;
- draft, finalized and archived Evidence Package counts;
- recent incident count only when that organization has `module.incidents`.

The portfolio-wide summary adds those factual counts. Ordering reuses Work Queue priority,
overdue, due-soon and source-status semantics, followed by due date, organization name and source
identity. There is no opaque or AI priority score.

## Sources and filters

Supported bounded filters are organization, normalized organization-metadata search, attention
state, work type, due state and signal type. Results are paginated and source reads are bounded.
The V1 read model issues bulk queries and groupings across the authorized IDs; it does not query
each organization in a loop or replicate operational records.

Work results retain the source type and ID, organization ID/name, priority, due date, assignee when
present and an exact canonical deep link. Signals retain their canonical rule key/version, window,
threshold and observed count. Evidence exposes package metadata and status, not manifest contents.

## Operational handoff

Opening a card, work item, signal, Evidence Package or Copilot citation first awaits the standard
`AppShell` organization transition. That transition cancels and removes the former organization's
queries, commits the new active organization only when it remains in the user's current list and
then navigates to the canonical route. Material work therefore remains single-organization.

## Deferred choices

Portfolio preferences are not persisted in V1. No plan assignment, member limit, pricing rule,
external search index, cache service or external AI provider is introduced.
