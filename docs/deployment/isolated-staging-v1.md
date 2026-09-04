# Isolated Staging Environment V1

Status: provisioned foundation, external provider credential pending. Baseline:
`main@f97fd0c08b0c9bf281fd3be862e99cbb0b10faa1`.

## Isolated topology

```text
Vercel project: sst-intelligence-staging
  -> API_ORIGIN=https://sst-api-staging-staging.up.railway.app
  -> Railway environment: staging
     -> service: sst-api-staging
     -> DATABASE_URL=${{Postgres-s8Po.DATABASE_URL}}
     -> service: Postgres-s8Po
```

The production topology remains the separate Vercel project `sst-intelligence-demo`, Railway
environment `production`, API service `sst-api` and database service `Postgres`. Staging was created
empty; it was not duplicated from production and it has its own volume, variables, API deployment,
database state and hostname.

Safe resource inventory:

- Railway project: `sst-intelligence-demo` (`1c334601-ad80-4045-8be0-f9ea080867b8`);
- Railway environment: `staging` (`93ce2cca-1c62-45fc-a627-cd3489324000`);
- staging API service: `sst-api-staging` (`1c031317-f375-42d7-b81d-6baf392d7fa2`);
- staging PostgreSQL service: `Postgres-s8Po`
  (`3e61f403-06f2-4f1a-be45-8f0e9b9255d0`);
- Vercel staging project: `sst-intelligence-staging`
  (`prj_QfqyZqDbU2itKOgpf537zv9fZGlK`), root `apps/web`, framework Next.js;
- Vercel production project remains `sst-intelligence-demo`
  (`prj_dIjkrSN11MJb7qgz7pfOptGWANUa`).

The dedicated Vercel project's Preview and Production scopes both contain only safe staging
configuration and point to the staging API. No browser or Vercel variable contains the OpenAI key.
The project tracks `codex/isolated-staging-environment-v1` as its production branch once that branch
exists remotely. The previous PR40 Preview is not staging and is not part of this topology.

## Release initialization and synthetic bootstrap

Every API release runs the canonical `production:release` command: `prisma migrate deploy` followed
by `reference:sync`. It never runs `prisma db seed`. After the first healthy API release, run the
compiled, staging-only command twice:

```text
pnpm --filter @sst/api staging:bootstrap
pnpm --filter @sst/api staging:bootstrap
```

`staging:bootstrap` requires both `APP_ENV=staging` and the resolved deployment environment to be
staging. Railway or Vercel production identity is authoritative and blocks execution. It also
requires a staging-only password supplied as a secret. The command upserts one organization and a
non-routable synthetic owner plus two centers, two areas, a position/activity context, hazards,
demonstrative risks and controls, three findings/actions, two operational signals, an inspection,
and synthetic worker, EPP, training and near-miss records. IDs are reserved synthetic UUIDs and no
customer, production user, production Worker or production evidence is copied.

The bootstrap adds staging organization-module activations only. It creates no `PlanFeature`, price,
plan assignment or commercial policy.

## Authentication isolation

The staging API uses a generated `JWT_ACCESS_SECRET`, a separate empty session table in staging
PostgreSQL, and `AUTH_REFRESH_COOKIE_NAME=sst_staging_refresh`. Production continues using its own
secret, database session families and `sst_refresh` namespace. Both cookies are HttpOnly, Secure in
deployed environments, SameSite=Lax and scoped to `/api/v1/auth`.

Validate both directions with an already authenticated session and without printing either token:

- a production access token sent to staging must return 401;
- a staging access token sent to production must return 401;
- refresh cookies are host-only and have different names, so neither refresh endpoint receives the
  other environment's cookie.

Membership, role and entitlement checks remain current-database checks. Revocation, downgrade and
entitlement removal therefore apply to existing access sessions at the organization boundary.

## External provider credential gate

The API is initially configured with the provider target `OPENAI`, model `gpt-5.6-terra`, explicit
synthetic organization/user cohort and `CONVERSATIONAL_AI_EXTERNAL_ENABLED=false`. This fail-closed
state permits deployment, database/auth validation and deterministic fallback without an external
request.

An OpenAI organization owner must complete this manual step; the secret must never be pasted into a
ticket, PR, terminal transcript, browser environment or chat:

1. In OpenAI Platform create a dedicated project named `SST Intelligence Staging`.
2. Restrict the project/service account to the Responses API and `gpt-5.6-terra` where project model
   controls are available.
3. Configure a conservative project budget/alert and rate limits for the 2–5-user pilot.
4. Create one staging-only project key and store it directly as sealed `OPENAI_API_KEY` on Railway
   environment `staging`, service `sst-api-staging` only.
5. Confirm production service `sst-api` has no `OPENAI_API_KEY`.
6. Set `CONVERSATIONAL_AI_EXTERNAL_ENABLED=true` on the staging API only, deploy, run the controlled
   smoke, then set Vercel staging `STAGING_PROVIDER_MODE=OPENAI` so the visible identity matches the
   live API.

Application controls remain bounded output, 30-second timeout, minimized context, `store=false`,
no provider retry, safe usage metadata, organization/user cohort and an audited per-organization
kill switch. `OPENAI_API_KEY` is server-only in Railway.

## Data and authorization boundary

External processing is LOW-only: synthetic Work Queue, Operational Signals and inspection context;
public/reference regulatory metadata; synthetic governance/evidence metadata; drafts, summaries and
explanations. Worker identity, health, medical/psychosocial content, real incident narratives,
production evidence, binaries, credentials, privileged investigations and HIGH data remain local.

The API remains authoritative for the active organization, ACTIVE membership, current role,
entitlements, citation allowlist and finite Action Registry. The provider receives no tenant/user
identifier and cannot select scope or authorization. A write first creates an ActionRun, requires
explicit confirmation, and revalidates authorization immediately before mutation.

## Outbound side effects

There is no email sender, notification provider, webhook dispatcher or production third-party
mutation in this runtime. Organization invitations persist a hashed token for an operator-controlled
delivery path; staging does not send it. `STAGING_OUTBOUND_MODE=disabled` documents the environment
posture. Introducing an outbound integration requires a separate sandbox/sink implementation and
review before it can be enabled in staging.

## Gates

Before inviting real testers, require:

- staging health reports `environment=staging`, the exact Git SHA and expected provider;
- frontend shows “Entorno de prueba” and, only after activation, “IA generativa en entorno de
  prueba” with the same SHA/provider identity;
- staging API target and database service IDs differ from production;
- authentication isolation passes in both directions;
- cross-tenant, revocation, role, entitlement, unknown citation/action, confirmation,
  write-after-revocation, legal/risk/root-cause boundary, kill-switch and local-fallback tests pass;
- the synthetic bootstrap is idempotent and production-blocked;
- logs contain no raw prompt, raw response, chain of thought, token, key or SST payload;
- production main SHA/health/provider/database wiring remain unchanged with zero OpenAI requests.

Initial scope is one synthetic organization and at most 2–5 explicitly allowlisted real staging
accounts created through normal staging flows. Real organization AI data remains blocked pending
DPA, retention, Ecuador transfer and privacy/data-processing decisions.

## Cost and rollback

Discovery found both vendors on existing Hobby plans. The isolated Railway API/PostgreSQL and Vercel
project use normal current metered allowances/usage; no plan upgrade, paid add-on, purchase
confirmation or new fixed monthly commitment was accepted. Monitor actual usage before admitting the
pilot. To stop cost immediately, disable the provider switch and pause/scale down the staging API and
database through their existing vendor controls; do not alter production.
