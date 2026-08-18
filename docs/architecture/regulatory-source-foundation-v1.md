# Regulatory Source Foundation V1

## Purpose and boundary

This increment creates a production catalog for the identity, provenance and editorial review of
Ecuador SST source candidates. It stops at source metadata. A catalog record is not an applicability
decision, an obligation, an executable rule or proof of compliance.

The invariant is explicit:

```text
SOURCE != APPLICABILITY != OBLIGATION != RULE != COMPLIANCE
```

No provision, article, clause, requirement, obligation or regulatory rule is extracted or stored in
V1. The catalog contains no PDF, OCR result, full legal text or large legal excerpt.

## Source identity

`RegulatorySource` is global reference data. It stores the stable `sourceKey`, country, issuer,
document type, reference number and canonical candidate title. `sourceKey` is unique and protected
against updates by a database trigger. It is an internal identity, not a legal interpretation.

Sources do not contain `organizationId` and are not duplicated per tenant.

## Source versioning

`RegulatorySourceVersion` is an immutable platform snapshot of catalog metadata. `catalogVersion=1`
means the first platform snapshot; it does not mean legal revision 1. The pair
`(sourceId, catalogVersion)` is unique. Database triggers reject update and delete operations, so a
metadata change must create the next version and history remains queryable.

Dates and URLs remain null when the committed candidate catalog has not established them. Readiness
flags are explicit stored metadata. The application does not derive readiness from document
location, publication date, reference number or editorial status.

## Relationship review

`RegulatorySourceRelationship` records neutral relationships that still require review. Duplicate
direction/type tuples are prevented and self-relations are rejected. Both foreign keys use
`RESTRICT` deletion semantics.

C.D. 517 and C.D. 677 remain distinct source identities. Their V1 relationship is
`POSSIBLE_SUPERSESSION / PENDING_REVIEW`; neither becomes ready for rules. C.D. 527 remains a
separate rejected, unverified interview reference and is never silently mapped to either source.

## Editorial status is not legal status

`candidateStatus`, `supersessionStatus` and relationship `reviewStatus` describe platform editorial
workflow. They do not assert current legal effect, applicability, obligation or compliance. V1
initial data contains no `APPROVED_FOR_RULES` source and every initial version has
`readyForRules=false`.

## Global data with tenant access gates

The catalog is global, but every runtime request passes through the authenticated organization
context. `AccessTokenGuard` authenticates the user and `OrganizationGuard` validates active
membership, mirroring the existing read policy of the Applicability experience. All six existing
organization roles may read. Organization owners are not platform editors.

Commercial packaging for regulatory-source access is not decided in this increment. A future
plan-specific entitlement requires a separate product and commercial decision; V1 introduces no
feature definition or plan grant.

The runtime API exposes only:

- list sources;
- get source metadata;
- get immutable version history;
- get source relationships.

There are no create, update or delete endpoints. Reference data is provisioned through the migration
and idempotent seed paths.

## Frontend and cache ownership

The read-only experience lives under Configuración SST at `/app/applicability/sources`. Although the
payload is global, query keys are rooted at `private/org/{organizationId}` because authorization is
evaluated per active organization. Query functions propagate `AbortSignal`. Existing organization
transition logic cancels and removes the prior organization subtree before the next context can
render an authorized result.

Loading, error, empty and success are distinct states. A failed or denied request is never rendered
as an empty catalog. Cards and stacked version history avoid wide tables and reflow at 320px.

## Controlled future pipeline

The future pipeline is gated and sequential:

```text
RegulatorySource
→ RegulatorySourceVersion
→ Provision Extraction
→ Requirement Definition
→ Technical Review
→ Legal Review
→ Rule Drafting
→ Rule Tests
→ Rule Approval
→ RulePack Publication
```

No stage after `RegulatorySourceVersion` is implemented here. AI does not extract, summarize,
interpret or publish legal content in V1.

## Independence from expert validation

Anita's expert session may later change source priority, organization-versus-center scope, profile
fields, depth, current-state semantics and the questions affected by each source. This foundation
does not encode those decisions. Stable source identities, immutable snapshots and neutral
relationships can support later reviewed conclusions without redesigning this schema.
