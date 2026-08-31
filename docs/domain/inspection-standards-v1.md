# Inspection Standards V1

Status: implementation candidate.

## Purpose

Inspection Standards answers **what technical criteria are inspected**. It remains separate from
Risk Methodology (how a finding is valued) and Regulatory Evidence (which legal source may be
related). A selected technical standard is not law and a nonconforming criterion is not, by itself,
a legal violation or certification result.

## Direct V1 model

```text
InspectionDomain
→ InspectionStandardSource
→ InspectionStandardVersion
→ InspectionStandardSection / InspectionStandardCriterion
→ OrganizationInspectionStandardPolicyVersion / Binding
→ Inspection
→ InspectionCriterionResult
→ optional explicit Finding
```

There is no protocol/template/engine layer. A future protocol engine requires a new ADR and a
demonstrated need for multiple operational checklists derived from one exact standard version.

## Domains and catalog

V1 uses six finite domains: electrical installations, fire protection, machinery, chemical
storage, emergencies and infrastructure. Global demo reference data contains only original,
synthetic content: Demo Electrical Standard A, Demo Electrical Standard B and Demo Fire Standard
A. The two electrical versions intentionally differ so tenant-specific resolution is testable.

Every source declares a bounded rights classification. Global demo content is `DEMO_SYNTHETIC`.
Organization-owned sources may be `INTERNAL_ORGANIZATION_STANDARD`, `CUSTOMER_PROVIDED` or
`LICENSED`; the organization remains responsible for authorization. V1 stores authored metadata,
sections and criteria, never complete external standard PDFs or reconstructed copyrighted text.

## Versioning and policy

An available version and its sections/criteria are immutable. Content changes create another
standard version. Retirement prevents new selection but preserves reads for historical
inspections.

An organization policy is append-only. Each save creates the next policy version containing at
most one binding per domain. New inspections resolve the current policy and exact version on the
server. No per-inspection override exists. A missing binding fails with an explicit configuration
state; there is no demo fallback.

Policy writes are allowed to `ORG_OWNER`, `ORG_ADMIN` and `SST_MANAGER`. Technicians, Consultants
and Viewers may read available configuration subject to active membership, but cannot mutate it in
V1. API membership resolution is authoritative and immediately reflects role changes or
suspension.

## Inspection provenance and outcomes

New standard-aware inspections snapshot the domain, policy version, standard/source identity,
version label and content digest. Historical rendering reads that immutable provenance. Legacy
inspections remain valid with an explicit no-standard state and are never fake-backfilled.

Criterion outcomes are `CONFORME`, `NO_CONFORME`, `NO_APLICA` and `NO_VERIFICADO`. Results preserve
criterion identity, note, evidence references, actor and timestamp. `NO_CONFORME` only describes
the observed condition against the selected criterion. Creating a Finding is a separate, explicit
professional action, and the Finding retains trace to result, criterion and standard version.

## Boundaries

- Risk valuation continues through the configured exact Risk Method version.
- Regulatory foundation is displayed separately and only when an explicit link exists.
- No new commercial key, plan assignment or pricing decision is introduced.
- No real standard selection or Anita approval is inferred.
