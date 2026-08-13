# Engineering Handoff V1.1 — Binding Errata

This file records the current domain decisions that override conflicting handoff assumptions.

## 1. Professional Review

The current API/domain remains authoritative.

- `NEEDS_REVISION`: the assessment remains `COMPLETED`; it does not become `REVIEWED`.
- `APPROVED`: an authorized successful approval moves the assessment to `REVIEWED`.
- This increment does not modify that behavior.

## 2. Regulatory Source

Source type/provenance is orthogonal to applicability/obligation. `LAW` does not automatically mean
`MANDATORY`.

No Adaptive SST models are implemented in this increment.

## 3. Module Catalog

`ModuleDefinition` and `module-catalog` are global. Tenant availability, activation, entitlements and
subscription are organization-scoped.

## 4. Finding Closure

Finding closure is an open product decision. The current API runtime remains authoritative until a
future explicitly approved domain change.

This increment does not alter finding transitions.
