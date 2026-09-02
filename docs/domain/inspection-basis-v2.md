# Inspection Basis V2

Status: production closed on 2026-09-02. Professional source and criterion approval remains
**PENDING ANITA**.

## Purpose and boundary

A Base de inspección answers: “¿En qué conjunto exacto de fuentes se basa esta inspección?”. It is
an immutable organization configuration, not a law, synthetic regulation, risk method or protocol.

```text
Organization + InspectionDomain
→ InspectionBasisDefinition
→ immutable InspectionBasisVersion
  → exactly one PRIMARY_TECHNICAL version
  → zero-to-many SUPPLEMENTAL_TECHNICAL versions
  → zero-to-many INTERNAL_ORGANIZATION versions
  → zero-to-many exact RegulatoryUnits as LEGAL_CONTEXT
→ Inspection snapshot
```

Only one basis version is active by organization and domain. Drafts may be edited before
activation; activation retires the previous default without deleting it. A version referenced by
an inspection is immutable and remains readable.

## Provenance

Every executable criterion belongs to an exact selected `InspectionStandardVersion` and carries
its source locator. Optional criterion-to-RegulatoryUnit links explain stored context without
claiming that every criterion is law. Multiple articles remain separate records and are never
concatenated into reconstructed text.

Jurisdiction is always visible. RETIE and REBT remain foreign technical-regulation references; CLP
remains an EU regulation reference; RTQ remains local to the Distrito Metropolitano de Quito.
Selection is explicit configuration, not automatic legal applicability.

## Compatibility and authority

New inspections prefer the active basis and store `inspectionBasisVersionId` plus a digest-bearing
snapshot. The primary standard is also retained in the legacy fields for bounded compatibility.
Existing V1 inspections keep their direct policy/version binding and are not recalculated or
backfilled. API membership and tenant checks are authoritative.

No Protocol Engine, commercial plan assignment, pricing rule or professional approval is created.

## Production closure evidence

PR #34 merge `c90065822aee358a2716a1b2b6e7d93d7cbeb8a0` passed the first main Quality
Gate attempt and automatic Railway/Vercel deployment. The production smoke activated
`PRUEBA SISTEMA — BASE ELÉCTRICA MULTIFUENTE V2` with RETIE as primary, REBT as supplemental and
zero legal-context units. The created inspection resolved that exact Basis, retained its immutable
version and rendered the source roles separately. A pre-Basis inspection and a direct-standard
inspection retained their original criteria, results and StandardVersion without backfill.

The partial database unique index and serialized activation path remain authoritative for the
one-active-Basis-per-organization/domain invariant. The integration suite proves concurrent
activation, immutable history, tenant isolation and the Basis-then-legacy resolution rule.
