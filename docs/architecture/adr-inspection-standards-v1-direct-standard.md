# ADR — Inspection Standards V1 direct standard binding

Status: accepted and production closed for V1 on 2026-08-31.

## Context

Organizations need a stable technical basis per inspection domain. The same domain may use a
different standard in another tenant, while every historical inspection must retain its exact
technical basis.

## Decision

Bind organization policy directly to an immutable `InspectionStandardVersion`; its ordered
criteria are the checklist. Inspection creation resolves the exact version from the current
versioned organization policy and snapshots provenance.

`InspectionProtocol`, `InspectionProtocolVersion`, `ProtocolTemplate`, `ProtocolEngine` and
equivalent abstractions are not implemented in V1. Criteria attach directly to a standard version.

## Consequences

- One primary standard version per inspection domain and policy version.
- Policy changes append a new version and never rewrite historical inspections.
- No per-inspection arbitrary standard selector.
- Missing policy is an explicit product state, not a silent fallback.
- Standard, risk method and regulation remain three independent concepts in data and UX.
- A future Protocol Engine requires a new ADR supported by an actual need for multiple operational
  protocols from one exact standard version.

Production closure confirmed this direct topology without adding any protocol model or engine.
Professional selection of real standards and validation of their rights/content remain **PENDING
ANITA** and do not alter this V1 architecture decision.
