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
their respective migrations. Canonical Adaptive assessment V1/V2 is production-required reference
data and is synchronized here rather than relying on the general seed.

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

The synchronizer owns these globally required Risk Methodology aggregates:

- `MethodologySource` and `MethodologySourceVersion`;
- `RiskMethodDefinition` and `RiskMethodVersion`;
- `RiskMethodSourceLink`;
- `RiskMethodExpertGuidanceVersion`;
- `RiskMethodRegulatoryContext`.

It also owns the reviewed global regulatory reference layer: 15 source identities, immutable latest
source versions, verified `RegulatoryUnit` records, the MDT-2024-196 provision/requirement
candidates and five unpublished rule drafts. Pending/rejected artifacts never become verified
units.

It materializes the approved `DEMO_5X5`, `GUIDED_5X5` and `GTC45_2010` identities. It does not
create or update users, memberships, organizations, work centers, demo activations, inspections,
findings, actions, assessments or Solution Finder sessions. Regulatory sync does not publish a
rule/pack and creates no customer operational data.

The global synchronization additionally owns sealed Adaptive assessment V1 and the additive plural
fact V2. It validates definitions, drafts, immutable versions, relationships and pack content hashes
and fails closed on drift. It does not create Adaptive sessions or any organization/user/customer
rows. The production-like gate runs migrate deploy plus reference sync without seed, starts Nest,
creates a canonical public assessment and proves the specialist selects V2 with plural overlap
semantics.

Published Adaptive reference versions are immutable. Historical V1 preserves
`organization.totalWorkerCount@1.0.0` as `DERIVED_ONLY`, matching the originally sealed production
row and pack hash. Modern V2 defines `organization.totalWorkerCount@2.0.0` independently as
`DERIVED_OR_USER`, so the canonical guided assessment can ask when the value cannot be derived.
Future semantic changes require a new fact and pack version; they must never redefine a published
version in place.

The production-like release regression starts from the verified persisted V1 identities, content,
hash and relationships, then runs the current release twice without the general seed. This protects
real upgrade compatibility and idempotency in addition to the fresh-database path. A deliberate
semantic mutation of that historical fixture must still fail with `PUBLISHED_VERSION_DRIFT`.

## Atomicity, idempotency and drift

The operation validates manifest schemas and hashes before writes, acquires a PostgreSQL
transaction-scoped advisory lock, and executes in one serializable transaction. Existing stable
UUID/version identities are compared with canonical content. A mismatch raises a Risk Methodology
or Regulatory Evidence drift error and rolls back instead of overwriting. Repeated successful
execution performs no update and produces no semantic or timestamp churn. Verified article
identity/text/hash drift always fails; a changed instrument requires a new version.

The general Prisma seed remains available for CI/development and calls this same production-safe
layer before its broader development reference setup. Production never calls the general seed.
