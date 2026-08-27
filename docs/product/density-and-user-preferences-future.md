# Density and user preferences — future direction

Status: documented seam; not implemented in Operational Execution Program V1.

Future controlled density values are `COMFORTABLE`, `COMPACT` and `FIELD`. Future text-size values
are `NORMAL` and `LARGE`. These are bounded product settings, not arbitrary CSS controls.

Potential preferences include theme, density, text size, sidebar state, landing page, table columns,
filters, sorting, saved views and preferred inspector panels. Values must be versioned, accessible,
tenant/user-safe and validated at 320px, 640px, desktop and 200% zoom across all four themes.

IBM Plex Sans and the controlled typography scale remain the product type system. An arbitrary font
selector is intentionally out of scope. The current workspace primitives and compact queue rows are
compatible with future density tokens but do not claim the full preference system exists.
