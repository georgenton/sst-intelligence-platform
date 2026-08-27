# Command Center V2

Status: implemented at `/app`.

## Hierarchy

The authenticated landing surface follows three exact sections:

1. **Necesita atención** — deterministic Operational Work Queue items with compact direct actions.
2. **Estado operativo** — concise counts for active, review and blocked work.
3. **Análisis** — inspection findings, overdue actions and recurrence indicators linked to source
   modules.

It deliberately avoids a KPI wall, cross-method score comparisons and opaque AI ranking. Empty and
partial-error states explain what is known, preserve available information and give a useful next
action.

## Attention precedence

Actionable Operational Work Queue items always come first, regardless of whether initial SST
configuration is complete. When an unconfigured organization has work, the ordered work items are
rendered first and configuration appears as a secondary recommendation. An unconfigured
organization with zero work sees setup guidance; a configured organization with zero work sees the
healthy operational empty state. Queue failures are reported explicitly and cannot be hidden by
onboarding. No separate Command Center ordering rule exists.

## Data and authorization

Dashboard and queue requests use the authenticated request coordinator, AbortSignal propagation,
tenant query keys and the validated active organization. Role and entitlement checks remain on the
API. Gated navigation is hidden only after entitlement context is known; hidden UI is not security.
Work Permit attention items are projected only when the effective `module.work_permits`
entitlement is active, preventing private-data leakage and dead deep links after demo expiry.

## Density

V2 uses compact attention rows and linked metrics while retaining readable touch targets, semantic
headings and visible focus. It does not add a user density preference or arbitrary font selector.
