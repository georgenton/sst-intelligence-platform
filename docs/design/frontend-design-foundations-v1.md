# Frontend Design Foundations V1

## Runtime contract

The root document owns two independent attributes:

- `data-theme="operativo|sereno|noche|contraste"`
- `data-focus="on|off"`

The visible label for `contraste` is **Alto contraste**. The engineering handoff defines
`contraste` as the authoritative runtime value, so it intentionally replaces the preliminary
prompt example `alto-contraste` without changing the product label.

Public routes always render `operativo` with focus off. Authenticated routes restore a user-scoped
theme and a user-and-task-scoped focus preference. Organization identifiers are never part of the
appearance keys. Logout clears only the active session marker; saved preferences remain isolated
under their user identifier.

An inline, fixed bootstrap in the document head applies the stored attributes before hydration.
It contains no user content and falls back to Operativo when storage is absent, blocked, or invalid.
The client provider then reconciles the marker with the authenticated user.

## CSS layers

1. `styles/tokens.css`: primitives, semantic roles, typography, spacing, elevation and compatibility
   aliases.
2. `styles/themes.css`: the four curated semantic-role mappings from the V1.1 handoff.
3. `app/globals.css`: existing product layouts, incrementally migrated through semantic aliases.
4. `styles/foundations.css`: IBM Plex, focus visibility, controls and cross-surface primitives.
5. `styles/focus.css`: attention-only presentation; it does not hide tenant, risk, flow, demo,
   permission, method, evidence or validation context.

IBM Plex Sans and IBM Plex Mono are self-hosted at build time through `next/font`; no font binary is
committed and the browser performs no runtime font-CDN request. Mono is reserved for technical
identifiers while ordinary numerical values use tabular Sans.

## Scope and accessibility

Existing `Button`, `Card` and `StatusBadge` APIs remain unchanged and now inherit semantic roles.
Risk badges include label plus a level-specific geometric marker, so color is not the only signal.
Interactive borders use `border-interactive`; visible focus is at least 3 px and increases to 4 px
in Alto contraste. Motion collapses for focus mode and for the operating-system reduced-motion
preference.

This increment adds no backend, Prisma, API, entitlement, organization-cache or domain changes.
Remote preference synchronization remains a future increment with an explicit API contract; local
storage is only the V1 startup and offline layer.

## Handoff sources

Implementation was checked against `README.md`, `HANDOFF_MANIFEST.md`, `SOURCE_OF_TRUTH.md`,
`system/tokens-reference.md`, `system/themes-focus.md`, `system/typography-icons.md`,
`system/component-contract.md`, `system/component-ownership.md`, the accessibility, shadcn,
responsive, copy and domain/UI engineering mappings, the three North Stars, and the repository
`engineering-handoff-v1.1-errata.md`. External reference stylesheets were inspected but were not
imported or copied as production stylesheets.
