# Production reference synchronization V1

## Defect and root cause

Railway builds `apps/api/Dockerfile`, runs the repository `preDeployCommand`, then starts the image's
Docker `CMD`. Before this repair those commands were:

```text
pre-deploy: pnpm --filter @sst/api prisma:deploy
start:      node apps/api/dist/main.js
```

`prisma:deploy` only applies migrations. The general Prisma seed first synchronized Risk
Methodology, then also upserted plan/catalog metadata and development/demo reference layers. CI ran
that seed, but Railway intentionally did not. Consequently a fresh production deploy contained only
the historical `DEMO_5X5` inserted by migration; `GUIDED_5X5`, `GTC45_2010`, their source,
provenance, guidance and contexts were absent.

There was no shared production reference synchronizer. Existing global Technical Risk and
Applicability records, and the approved Regulatory Source catalog, are already materialized by
their respective migrations. Adaptive demo/reference material remains part of the general seed.
This repair does not duplicate or expand those lifecycles.

## Release lifecycle

The version-controlled lifecycle is now:

```text
pre-deploy: pnpm --filter @sst/api production:release
             ├─ pnpm prisma:deploy
             └─ pnpm reference:sync
start:      node apps/api/dist/main.js
readiness:  GET /api/v1/health
```

`reference:sync` runs compiled release code. A non-zero migration or synchronization result aborts
pre-deploy, so Nest cannot start with a partially synchronized required catalog.

## Scope and exclusions

The synchronizer owns only these globally required Risk Methodology aggregates:

- `MethodologySource` and `MethodologySourceVersion`;
- `RiskMethodDefinition` and `RiskMethodVersion`;
- `RiskMethodSourceLink`;
- `RiskMethodExpertGuidanceVersion`;
- `RiskMethodRegulatoryContext`.

It materializes the approved `DEMO_5X5`, `GUIDED_5X5` and `GTC45_2010` identities. It does not
create or update users, memberships, organizations, work centers, demo activations, inspections,
findings, actions, assessments, Solution Finder sessions, real regulatory provisions,
requirements, rules or packs.

## Atomicity, idempotency and drift

The operation validates manifest schemas and hashes before writes, acquires a PostgreSQL
transaction-scoped advisory lock, and executes in one serializable transaction. Existing stable
UUID/version identities are compared with canonical content. A mismatch raises
`RISK_METHOD_REFERENCE_DRIFT` and rolls back instead of overwriting. Repeated successful execution
performs no update and produces no semantic or timestamp churn.

The general Prisma seed remains available for CI/development and calls this same production-safe
layer before its broader development reference setup. Production never calls the general seed.
