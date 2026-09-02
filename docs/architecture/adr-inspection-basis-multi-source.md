# ADR — Multi-source Inspection Basis

Status: accepted for implementation.

## Decision

Introduce versioned, organization-scoped Inspection Basis composition beside Inspection Standards
V1. Technical versions and exact RegulatoryUnits remain independent source records joined through
typed links. Inspections store the exact immutable basis version and snapshot.

## Invariants

- `Inspection Standard != Inspection Basis != Regulation != Risk Method`.
- Exactly one primary technical source is required for an active V1 basis.
- Supplemental/internal sources and legal-context units are optional and ordered.
- One active default exists per organization and inspection domain.
- Activated or used versions are immutable; retirement never deletes history.
- Tenant-owned sources must belong to the active organization; global references remain global.
- Foreign jurisdiction never implies Ecuadorian applicability.
- Existing direct-standard inspections remain readable without migration.
- No `InspectionProtocol`, `InspectionProtocolVersion` or Protocol Engine is introduced.

## Consequences

Configuration becomes a master-detail workspace and inspection explanations can cite each source
separately. The additional joins are explicit and indexed in PostgreSQL; no new service, queue,
cache or generic repository is required.
