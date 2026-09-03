# Consultant Portfolio authorization

## Decision

Portfolio authorization is a per-request, per-organization intersection. The server obtains
`AuthorizedOrganizationSet(userId)` only from current `ACTIVE` memberships whose organization is
`ACTIVE` or `DEMO`. A client organization filter can reduce this set but cannot expand it.

```text
authenticated user
  → current active memberships
  → current active/demo organizations
  → per-organization role + effective entitlements
  → bounded aggregate queries restricted by authorized organization IDs
  → source-aware response and citations
```

No strongest global role is derived. A consultant in Organization A and viewer in Organization B
keeps those exact roles; an organization without membership is indistinguishable from an absent
portfolio result. A suspended membership disappears on the next request even when the existing
access token remains valid. Refresh cannot recreate that membership.

## Entitlements and source visibility

Effective entitlements are fetched in bulk for the entire authorized set. Inspection actions,
incident actions/recent incident counts and Work Permits are included only for the organizations
where the corresponding feature is currently active. Other organizations' source rows are never
used as a fallback. API checks remain authoritative; navigation visibility is not security.

## Read and write boundaries

The portfolio controller accepts no tenant header and no arbitrary organization context. All
queries begin from the user ID in the verified access token. Direct organization reads return a
generic unavailable response when the intersection is empty.

Portfolio conversations are read-only. Any proposed material write must name one currently
authorized organization, return an unexecuted anchor and use the established organization switch,
role/entitlement checks, confirmation and idempotency in the canonical single-tenant service.

## Storage and performance

Operational facts are never copied into consultant-owned tables. Bulk `findMany` and `groupBy`
queries replace per-organization loops; each detailed collection has a fixed upper bound. No
Redis, search service, vector store or migration is introduced.

## Production verification — PR36/37/38

Production closure was verified on 2026-09-03 at merge
`c5bc3a2cc38db10e39e4e66117f7d18e296dd509`. A synthetic user held CONSULTANT in A and VIEWER in B;
C was outside the authorized set. Live promotion/demotion in A affected the existing access
session immediately, without changing B's role. A demo and B FREE retained independent effective
entitlements. An arbitrary C filter returned no data and direct C access was denied.

After preparing an unexecuted single-organization action, the Owner suspended membership A. The
same access session's next Portfolio response contained only B; direct A access and confirmation
returned 403. Hard reload restored the authenticated session, removed A and selected B. A selected
valid B also survived hard reload unchanged. Canonical citation navigation established A before
opening its signal, and Portfolio write anchoring established A before Assistant navigation.

See [E2E runtime and release evidence](../testing/e2e-runtime.md). E2E uses the production standalone
artifact, with no route-specific warmup or auth/throttling bypass. Production throttling keeps
normal 120/60,000 ms defaults and auth overrides in memory per process. Distributed bucket storage
is deferred until horizontal scaling requires it; no authorization state is delegated to that cache.
