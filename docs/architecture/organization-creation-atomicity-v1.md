# Organization creation and production bootstrap

## Observed failure

On PR50 HEAD `c92eac634440dc984f39c8155d15bce2a0f11e63`, the staging service recorded three
`POST /api/v1/organizations` responses with status 500. A read-only staging probe found zero Plan
rows; CORE already existed. A disposable database provisioned by the compiled production release,
without development seed, reproduced HTTP 500 and Prisma `P2025` for Plan in
`OrganizationsService.create`. No organization was created. FREE was only materialized by the
development seed. A fresh release also lacked CORE, so both dependencies belong in the release.

## Canonical baseline

`reference:sync`, called by `production:release`, now creates missing FREE and CORE identities and
the nine existing FREE baseline feature definitions/assignments. Seed and release share that
baseline source. Synchronization remains inside the existing global advisory lock and serializable
transaction. Repeated release preserves existing UUIDs, timestamps, configurable metadata and
configured feature values. Incompatible feature value types fail closed. No paid catalog, customer
rows, demo activation, module recommendations, regulatory rules or operational data are created.

The fresh FREE defaults remain one work center, two members, demo eligibility, fourteen demo days,
zero monthly AI actions and the existing false module feature values. Eligibility is not activation.
The organization endpoint still provisions only CORE, an owner, a principal center and a FREE
subscription. The existing assessment setup topology exception and entitlements remain unchanged.
Production does not run the development seed. No schema or migration change is required.

## Atomic creation and bounded errors

Organization, owner membership, principal center, subscription, CORE module and both mandatory
creation audit events commit in the same Prisma transaction. `AuditService.record` accepts the
transaction client for this operation; other callers keep their existing behavior. If either audit
fails, all organization creation rows and both audit events roll back. No secondary audit occurs
after commit, and no compensation or weakened audit requirement is needed.

A missing bootstrap returns a bounded 503 with `ORGANIZATION_BOOTSTRAP_UNAVAILABLE`. Unexpected
creation persistence/audit failures return `ORGANIZATION_CREATE_UNAVAILABLE`, also 503. Logs contain
only the safe event/code, without raw Prisma messages, input values, tokens or credentials. The UI
explains that the diagnosis remains saved and permits retry without exposing internal errors.

## Retry protocol

`POST /organizations` accepts an optional UUID-v4 `Idempotency-Key` header. The existing body is
unchanged: name 2..120, country 2..80, optional sector 2..120. Calls without the header retain the
normal explicit-create behavior. No new onboarding field or endpoint is introduced.

The actor ID and key are hashed together. A PostgreSQL transaction-scoped advisory lock serializes
matching attempts. The mandatory ORGANIZATION_CREATED audit stores only that hash and a normalized
input fingerprint. A matching committed attempt returns the same organization after validating
active actor membership, without new rows or audit events. Different input with the same key returns
409; another actor cannot recover that organization. The audit history is durable idempotency
storage and must be retained for replay guarantees. No table/index/migration is added.

A failed transaction leaves no committed creation receipt and can be retried. If the server committed
but the network response was lost, a complete organization and both audits exist; retry recovers the
same organization. This response ambiguity is distinct from a partially created organization.

The claim UI uses the existing assessment UUID as its stable, actor-bound retry key, including
reloads and target selection changes. No recovery field or URL parameter is added. Public tokens
remain separate from this non-secret identifier and stay out of URLs. The public
recovery record is cleared only after a successful claim response or the existing authenticated
claim recovery. Creation failure never clears it. No assessment facts are manufactured.

## Regression evidence

- Isolated migrated database plus canonical sync, without seed: POST succeeds with the normal baseline.
- Concurrent and later replay: one organization and one pair of creation audit events.
- Second mandatory audit failure: complete rollback, bounded error, successful retry.
- Existing DTO boundaries and optional sector preserved; invalid header rejected.
- Configured global metadata, UUIDs and FREE values preserved by repeated bootstrap.
- Compiled production release gate and Docker runtime image gate exercise real signup and POST on fresh databases.
- Browser regression starts dedicated production web/API runtimes against a release-only database:
  finalized two-center assessment, signup UI, new company, lost successful response, reload/retry,
  center configuration, successful claim and authenticated diagnosis. It asserts exact-once creation,
  owner role, country/activity, frozen facts, topology, recovery timing, token-free URL and unchanged
  FREE plan features/CORE-only activation.
