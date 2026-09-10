# SST Assessment canonical intake V1

Status: PR46 implementation; external audit pending.

## Identity and answer states

Every fact has the stable identity `(scopeKey, factKey)`. `organization` is global to the assessed
organization. Each `center:n` is a logical center scope; authenticated sessions bind it to an exact
tenant WorkCenter UUID, while public sessions defer that binding until claim.

The only persisted answer states are:

- no fact row: unanswered;
- `KNOWN` plus a typed boolean, integer, text, choice or choices value;
- `EXPLICIT_UNKNOWN` with no value.

`KNOWN false` is a complete negative answer. It must never be treated as missing or unknown.

## Catalog

`SST_ASSESSMENT_FACT_CATALOG` in `packages/contracts/src/sst-assessment.ts` is canonical for both
channels and the future PR47 UI. It supplies Spanish question/help text, topic, value type, finite
choice labels, purpose, order, numeric/text bounds, sensitivity, unknown policy and finite
collection policy.

Organization topics cover organization profile, people and operations, centers, priorities,
management, inspections, permits, evidence, follow-up, planning, preventive organizational
context, objectives and rollout context. Work Center topics cover worker count, activity,
arrangement, multiple activity categories, multiple facility types, operational zones, chemical
and high-energy activity, critical work, contractors, machinery, transport and fire/explosion
exposure.

The catalog intentionally models:

- `workCenter.activityCategories` as `MULTI_CHOICE`;
- `workCenter.facilityTypes` as `MULTI_CHOICE`.

Existing Adaptive fact versions `workCenter.activityCategory@1.0.0` and
`workCenter.facilityType@1.0.0` are not modified. V1 preserves the canonical arrays and does not
guess a single legacy value. Additive fact, rule, group, target and pack versions at `2.0.0`
evaluate the plural facts directly while keeping sealed V1 sessions reproducible.

## Collection and planning

Creation establishes all valid scopes first. Answers for absent scopes, wrong scope kinds, unknown
fact keys, invalid choices/types, duplicate identities and attempts to overwrite server-derived
authenticated facts are rejected.

Questions are generated from a bounded policy: foundation facts, applicable conditional facts and
missing facts promoted by a specialist. Context recommendations and commercial options remain
available catalog facts but do not block diagnosis. Questions are sorted by catalog order, logical
scope order and key. A `(scopeKey, factKey)` appears at most once even when several rules require it;
their rule/target metadata is combined. An explicit “No lo sé” answer remains in the snapshot and
is not asked again in the same session.

Authenticated server-derived facts are excluded from the answerable list. If the optional
organization sector is absent, the response includes `ORGANIZATION_SECTOR_REQUIRED` as a canonical
profile action rather than returning an impossible question.

The pure readiness resolver returns `COLLECTING_INFORMATION` while required questions remain and
`DIAGNOSIS_READY` only after the V1 diagnosis boundary is complete. Public and authenticated
finalization accept only `DIAGNOSIS_READY`; premature attempts fail with
`SST_ASSESSMENT_NOT_READY`.

Progress is factual topic completion. It is not legal compliance, operational criticality,
management priority, commercial priority or a module-activation signal.

## Snapshot, hash and provenance

Normalization sorts scopes, facts and multi-choice values and rejects duplicate identities.
Semantic input hashing excludes database IDs, WorkCenter UUIDs, display names, timestamps and
channel-specific provenance. Equivalent public and authenticated facts therefore produce the same
semantic hash independent of row order.

Provenance remains in the stored snapshot as one of public declaration, organization declaration,
organization record or previous assessment. Specialist traces preserve pack identity, version and
content hash; engine input/output hashes; predicate-level fact traces; rule and target keys; missing
facts; authority; and the professional-review boundary.

All reads use the row's persisted schema and catalog versions. The finite V1 resolver fails closed
for unsupported versions rather than reinterpreting a historical snapshot with current metadata.

## API shape

Public:

- `POST /api/v1/sst-assessment/public/sessions`
- `GET /api/v1/sst-assessment/public/sessions/:sessionId`
- `POST /api/v1/sst-assessment/public/sessions/:sessionId/answers`
- `POST /api/v1/sst-assessment/public/sessions/:sessionId/evaluate`
- `POST /api/v1/sst-assessment/public/sessions/:sessionId/complete`
- `POST /api/v1/sst-assessment/public/sessions/:sessionId/claim` (authenticated)

Authenticated:

- `GET /api/v1/sst-assessment/setup-state`
- `GET|POST /api/v1/sst-assessment/sessions`
- `GET /api/v1/sst-assessment/sessions/:sessionId`
- `POST /api/v1/sst-assessment/sessions/:sessionId/answers`
- `POST /api/v1/sst-assessment/sessions/:sessionId/evaluate`
- `POST /api/v1/sst-assessment/sessions/:sessionId/finalize`

Create operations never accept ProfileVersion IDs, rule-pack IDs, evaluator hashes, authority,
organization IDs, module IDs or plan IDs from the request body.
