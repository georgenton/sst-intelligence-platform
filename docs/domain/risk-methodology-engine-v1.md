# Risk Methodology Engine V1

## Runtime scope

The inspection runtime supports three exact, versioned methods:

- `DEMO_5X5@1.0.0`, the unchanged historical calculation;
- `GUIDED_5X5@1.0.0`, candidate/demo with professional rationale;
- `GTC45_2010@1.0.0`, candidate/demo-review based on the supplied technical source.

The following identities remain separate:

```text
RegulatorySourceVersion (law/context)
        !=
MethodologySourceVersion (technical source)
        !=
RiskMethodVersion (deterministic provider contract)
        !=
RiskMethodExpertGuidanceVersion (non-scoring help)
        !=
InspectionFinding (tenant-private assessment instance)
```

No AI, database formula, renderer or regulatory context chooses or changes a score.

## Persistence and immutability

`MethodologySource`, `RiskMethodDefinition` and their versions are global reference records with no
`organizationId`. Source links, candidate expert guidance and jurisdiction context point to an
exact `RiskMethodVersion`. Published source, method and guidance versions are protected from
update/delete by PostgreSQL triggers. Corrections require a new version.

Seed uses stable UUIDs and compares complete manifests. A second seed creates no duplicates;
same-version content drift raises `RISK_METHOD_REFERENCE_DRIFT`.

## Assessment binding

A new inspection explicitly selects an available method version. The inspection stores its UUID
and manifest snapshot. Every new finding copies the exact UUID/snapshot and persists method-specific
input, deterministic output and explanation. Reads never resolve `latest`.

Historical inspections/findings are backfilled to `DEMO_5X5@1.0.0` without recalculating their
stored likelihood, consequence, score, level or residual values.

Residual valuation stores a second input/output and uses the initial exact method UUID. The API
rejects a different UUID and the database has a same-method check. Guided residual rationale is new;
the initial rationale is never silently reused.

## Tenant and analytics boundaries

Inputs, rationales, results, evidence and residual values remain tenant-private and all requests use
the authenticated organization context. Global catalog reads do not contain tenant data.

Recurrence remains organization + work center + category + 90 days. Systemic-review snapshots now
include method identity. Raw numeric results from different methods are never ranked or compared.

## Technical Risk compatibility

The finite provider-registry pattern is shared conceptually, but `TechnicalAssessment` and
`InspectionFinding` keep independent models, APIs, authorization and lifecycle. Existing Technical
Risk versions were not migrated or rewritten.

## Deferred

Organization defaults, allowed-method policies, program-level selection, mixed methods within an
inspection program and reviewed acceptability policies require separate increments and expert
decisions.
