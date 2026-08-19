# Regulatory Provision & Requirement Foundation V1

## Purpose and boundary

This increment extends the global regulatory catalog with reviewed editorial structure, frozen
approved records and exact provenance:

```text
RegulatorySource
→ RegulatorySourceVersion
→ RegulatoryProvision
→ RegulatoryRequirement
→ future reviewed Rule
```

It does not create applicability rules, legal thresholds, organization obligations or compliance
decisions. Production starts with zero provisions, zero requirements and zero requirement-source
links. All examples used by tests are clearly synthetic and are not part of the seed.

## Exact source-version provenance

Every `RegulatoryProvision` references one exact `RegulatorySourceVersion`, never only the mutable
source identity. `provisionKey` is stable and unique within that source version. A later source
snapshot does not move, rewrite or relink existing provisions. Requirements keep their original
provision links, so provenance continues to resolve the exact source identity and catalog version
from which a reviewed candidate was derived.

`RegulatoryRequirementSource` is an explicit many-to-many join. Its relationship type can be
`PRIMARY_SOURCE`, `SUPPORTING_SOURCE` or `RELATED_SOURCE`; those values do not express legal
precedence or weight.

## Reviewed editorial lifecycle

V1 uses mutable pre-approval records with deterministic database-enforced transitions. A provision
starts in `DRAFT` and may move through extraction, technical review and legal review before
approval. A requirement starts in `DRAFT` and moves through technical and legal review before
`APPROVED_FOR_RULE_DRAFTING`. Review-back transitions are explicit; direct jumps are rejected.
Pre-approval provision content and requirement content, including the non-authoritative
`scopeHint`, may be refined. Stable keys, source-version binding, row identity, timestamps and
replacement provenance remain immutable from insertion.

`APPROVED` provisions and `APPROVED_FOR_RULE_DRAFTING` requirements have frozen content. Their only
later transition is status-only to `SUPERSEDED`, and the database permits that transition only
after a distinct replacement row points to the approved record through `supersedesProvisionId` or
`supersedesRequirementId`. This is platform editorial replacement, not legal supersession. The new
record starts in `DRAFT`; no status, date, key or source version silently infers replacement.
Rejected and superseded records are terminal.

Self-replacement is prohibited. Replacement links are immutable, one-to-one and can only target an
already approved record. Because a new link can only point to an existing approved predecessor and
cannot later be rewritten, direct two-node cycles are rejected and deeper cycles cannot be formed
through supported writes. A future editorial service may add richer chain diagnostics, but V1 does
not claim a generalized document-revision framework.

Requirement-source links may be inserted, corrected or removed while their requirement is in an
editable pre-approval state. The requirement row is locked while changing provenance or approving,
so approval cannot race a link deletion. Approval requires at least one link. Once approved,
provenance is frozen: links cannot be added, updated or removed. Corrected provenance therefore
belongs to a distinct replacement requirement.

Foreign keys use `RESTRICT`. A source version cannot be deleted while a provision references it,
and approved, rejected or superseded content cannot be deleted. There is no runtime create, update
or delete API; lifecycle writes remain an internal editorial/storage capability for future tooling.

## Bounded metadata, not a legal corpus

A provision stores a structural locator, optional heading and an optional human-reviewed summary
of at most 1,000 characters. A requirement stores a short title and an editorial description of at
most 2,000 characters. The schema has no full text, raw text, OCR text, PDF body, HTML body or
document-body field. These summaries are not authoritative legal text.

Provision statuses describe editorial workflow only: draft, extracted, technical review, legal
review, approved, rejected or superseded. Requirement status
`APPROVED_FOR_RULE_DRAFTING` means only that a human-reviewed candidate may enter a separate future
rule-drafting process; it is not an approved executable rule.

## Requirement semantics and scope hint

`RegulatoryRequirement` is global reference data with no organization, work center, subscription or
plan identity. It means the platform has identified a structured requirement candidate from
reviewed source material. It does not mean the requirement applies to a tenant, is mandatory, or
has been satisfied or violated.

`scopeHint` is explicitly non-authoritative. It can record an editorial hypothesis such as
organization, work center, activity or asset, but no Applicability code imports or consumes it.
Expert validation may change scoping without a schema redesign because requirements remain global
and their source provenance is independent from an organization profile.

## Read-only access and tenant cache

Runtime reads reuse `AccessTokenGuard` and `OrganizationGuard`. All six current organization roles
may read after membership validation. The data is global, but frontend query keys remain under the
active organization subtree and every query propagates `AbortSignal`; an A→B transition cancels and
removes A's private results before B renders.

The GET-only API provides source provisions, provision detail, requirement catalog and requirement
detail with provenance. There is no new entitlement or plan assignment. The secondary UI remains
under Configuración SST and adds no top-level navigation item or editor.

## Empty-state semantics

An empty list means only that content has not yet been structured and reviewed inside the platform.
It must never be rendered or interpreted as `NOT_APPLICABLE`, no obligation or no legal requirement.

## No automated extraction or rule generation

V1 contains no LLM, OCR, PDF parsing, automatic summary, legal interpretation, predicates,
operators, thresholds, applicability states, rule JSON or rule pack. No real Ecuador article,
section, requirement or legal quotation is seeded.

## Expert-dependent future

Anita's validation may determine which sources deserve priority, which provisions matter, how
requirements should be scoped and which profile facts drive applicability. The version-bound
provenance and non-authoritative scope hint accommodate those answers without coupling this schema
to Profile V2, Current State & Evidence, Gap Assessment, Depth Resolver, Configuration Activation
or Management of Change.
