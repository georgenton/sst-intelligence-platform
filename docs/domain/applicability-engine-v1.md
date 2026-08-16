# Applicability & SST Configuration Engine V1

## Purpose and boundary

This increment introduces a deterministic, versioned engine that converts an organization SST
profile and an exact rule-pack version into auditable applicability decisions. It is a backend and
domain foundation only. It does not add product navigation, Command Center widgets, AI decisions,
plan entitlements, payments, or a claim of legal compliance.

V1 ships one synthetic demo pack. Its thresholds and examples are intentionally fictional. The pack
is marked `sourceType=DEMO`, `regulatory=false`, and `isDemo=true`, and carries this disclaimer:

> Reglas sintéticas de demostración. No representan normativa ni acreditan cumplimiento legal.

No Ecuadorian regulation, regulatory threshold, or official catalog is encoded in V1.

## Conceptual model

### Organization SST Profile Version

`OrganizationSstProfileVersion` is an append-only, organization-scoped snapshot. The service derives
`country`, `sector`, and `workCenterCount` from the authenticated organization context. An authorized
administrator may supply the remaining explicit V1 facts:

- `organization.workerCount`
- `operations.hasChemicalProcesses`
- `operations.hasHighEnergyOperations`

Every profile creation allocates the next integer version for that organization. Existing versions
are never updated by the API.

### Applicability Rule Pack Version

`ApplicabilityRulePackVersion` is global reference data with a semantic version, lifecycle status,
schema snapshot, provenance, and demo/regulatory metadata. An assessment always selects an exact,
active version by ID. Activating or creating another version does not rewrite prior assessments.

The V1 demo pack is provisioned in the migration lifecycle for deployed environments and by the seed
for development. Both paths are idempotent for `(key, version)`.

### Applicability Assessment

`ApplicabilityAssessment` is an immutable completed evaluation. It stores all of the following:

- organization ID;
- exact profile-version ID and copied profile snapshot;
- exact rule-pack-version ID and copied rule-pack snapshot;
- deterministic engine version;
- actor and completion timestamp.

There are no update or delete assessment routes. A later profile or pack version creates a new
assessment rather than modifying an old one.

### Decision and evaluation trace

One `ApplicabilityDecision` is persisted per target key. Each decision includes state, reason code,
Spanish explanation, winning rule ID, and source provenance. `ApplicabilityEvaluationTrace` stores
every considered rule, its `ALL`/`ANY` result, configured and contributed state, and a JSON array of
typed predicate facts (`field`, `operator`, `expected`, `actual`, `result`). A missing value is stored
as `actual=null` and `result=MISSING`.

## Decision states

The decision state is exactly one of:

- `MANDATORY`
- `RECOMMENDED`
- `OPTIONAL`
- `NOT_APPLICABLE`
- `NEEDS_INFORMATION`
- `NEEDS_EXPERT_REVIEW`

Provenance is orthogonal. A state does not imply that its source is regulatory. Consumers must render
the separate `sourceType`, `sourceReference`, `regulatory`, `isDemo`, and disclaimer metadata.

## Finite predicate language

The evaluator accepts only a closed set of leaf fields:

- `organization.country` (string)
- `organization.sector` (optional string)
- `organization.workCenterCount` (integer)
- `organization.workerCount` (optional integer)
- `operations.hasChemicalProcesses` (optional boolean)
- `operations.hasHighEnergyOperations` (optional boolean)

Operators are typed by field kind:

- strings: `EQUALS`, `IN`;
- numbers: `EQUALS`, `IN`, `NUMBER_GTE`, `NUMBER_LTE`;
- booleans: `BOOLEAN_IS`.

A rule has one flat group of 1–12 predicates and a composition of `ALL` or `ANY`. A pack is limited to
100 rules. Schemas reject extra properties, unknown paths, duplicate rule IDs, and incompatible value
types. The implementation uses an exhaustive `switch` to resolve fields; it never traverses arbitrary
object paths and cannot execute expressions, scripts, templates, or `eval`.

## Tri-state evaluation and missing information

Every predicate returns `TRUE`, `FALSE`, or `MISSING`.

- `ALL`: any false gives `FALSE`; otherwise any missing gives `MISSING`; otherwise `TRUE`.
- `ANY`: any true gives `TRUE`; otherwise any missing gives `MISSING`; otherwise `FALSE`.

A true rule contributes its configured state. A missing rule contributes `NEEDS_INFORMATION` with
reason `MISSING_PROFILE_INFORMATION` and the exact missing fields in the trace. Missing is never
silently treated as false or `NOT_APPLICABLE`.

If every rule for a target is false, the engine emits `NOT_APPLICABLE` with
`NO_APPLICABLE_RULE`. This is distinct from a rule explicitly contributing `NOT_APPLICABLE`.

## Deterministic conflict resolution

When several rules contribute to the same target, the engine selects the highest precedence:

1. `NEEDS_EXPERT_REVIEW`
2. `MANDATORY`
3. `NEEDS_INFORMATION`
4. `RECOMMENDED`
5. `OPTIONAL`
6. `NOT_APPLICABLE`

Rules with the same state are resolved by ascending rule ID. Targets, rules, and persisted reads are
also sorted by stable keys. JSON array order therefore has no business meaning and repeated
evaluation of the same snapshots yields the same result and trace.

## API V1

All routes require an access token plus the validated `x-organization-id` membership context:

- `GET /api/v1/applicability/profile-versions`
- `POST /api/v1/applicability/profile-versions`
- `GET /api/v1/applicability/profile-versions/:profileVersionId`
- `GET /api/v1/applicability/rule-packs`
- `GET /api/v1/applicability/assessments`
- `POST /api/v1/applicability/assessments`
- `GET /api/v1/applicability/assessments/:assessmentId`

`ORG_OWNER`, `ORG_ADMIN`, and `SST_MANAGER` may create profile versions and assessments. Every active
membership role may read them in V1. Reads and writes for profiles, assessments, decisions, and traces
are scoped by the organization resolved by `OrganizationGuard`; request bodies cannot choose an
organization. Cross-tenant IDs return not found. API guards remain authoritative.

This engine deliberately has no entitlement guard in V1. Persisted applicability results do not
activate modules or change commercial availability.

## Audit events

The service records:

- `SST_PROFILE_VERSION_CREATED`
- `APPLICABILITY_ASSESSMENT_COMPLETED`

Events contain identifiers and version metadata only; they do not contain credentials or sensitive
individual health data.

## Failure behavior

- Invalid DTO or unknown rule-schema fields: `400`.
- Inactive/unknown rule-pack version: `404`.
- Profile or assessment outside the active organization: `404`.
- Active user without an administrative write role: `403`.
- Inconsistent persisted pack metadata and schema: server error; evaluation does not persist.
- Concurrent profile-version allocation retries serializable conflicts and never rewrites history.

The assessment, its decisions, and its traces are created in one database transaction. A failed
evaluation leaves no partial assessment.

## Future preparation without fabricated rules

The model can later support controlled regulatory or standards-based packs by adding reviewed source
data as new immutable versions. That work must define provenance, validity dates, jurisdiction,
approval workflow, legal review, change management, and regression fixtures before activation. V1
does not infer those rules, create placeholder legal thresholds, or let AI alter deterministic
decisions.
