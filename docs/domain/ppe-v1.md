# PPE / EPP V1

Status: implemented on the V1 feature branch; external review required before merge.

## Scope

Spanish product language uses EPP. The tenant-private catalog, professional requirement, issue,
recorded delivery acknowledgement, condition inspection and replacement history cover operational
traceability. V1 is not inventory, purchasing, warehouse, supplier or cost-accounting software.

## Invariants

- EPP catalog items and Worker references belong to the active Organization.
- New requirements/issues require an active Worker.
- A delivery acknowledgement records the authenticated actor and optional evidence; a Worker login
  is never required and a linked User is not assumed to have acknowledged it.
- Replacement creates a new issue and atomically marks the previous issue replaced; it never
  overwrites history. The replacement link prevents duplicate replacement.
- A risk/finding reference is trace metadata only and never changes a risk score.

## Operational state

Humanized categories and bounded statuses support issued/in-service, replacement due, replaced,
retired and lost/damaged equipment. Condition checks are Good, Needs review or Unfit. Replacement
due and condition review project into the shared Work Queue with exact Worker deep links.
The Worker Workspace shows required, in-service, replacement-due and historical issues without
changing their authoritative lifecycle.

`referenceStandard` is organization metadata only. V1 contains no proprietary standard text and
makes no certification or legal-requirement claim.

## EPP V2 candidate

Status: implemented on `feat/workforce-safety-product-refinement-v2`; external review required.

The professional flow is `Position → structured risk context → deterministic EPP candidates →
professional selection → internal Position requirement → Worker requirement → issue → condition →
replacement`. Candidate categories come from a small reviewed mapping in `packages/contracts`; no
external LLM, worker data, risk score or automatic final selection is involved. Product copy keeps
“Sugerido”, “Seleccionado por profesional” and “Requerido internamente” distinct.

Catalog references may retain standard, jurisdiction/context, provenance and review status. These
fields are metadata, not claims that a commercial product is certified or that a foreign technical
reference is Ecuadorian law. Full proprietary standard text and vendor catalogs remain excluded.

Replacement is additive: the old issue becomes historical and a new issue stores the bounded
reason (expiry, wear, damage, loss or another justified reason) and predecessor link. Damage may be
explicitly linked to an existing same-tenant Incident: the Incident references the damaged original
issue, while the new issue references that original through `replacesIssueId`. The Worker must first
be explicitly listed as involved in the Incident; no involvement or Incident is created
automatically.
V2 intentionally does not add stock tables: Requirement, Assignment, Issue, Condition, Replacement
and History solve the validated safety workflow without procurement, warehouses or accounting.

A Worker requirement that cites a Position requirement must match its Position and EPP item. Any
optional Work Center or Work Area scope must also match the Worker. Repeating the exact active
Position/risk/EPP/Center/Area selection is rejected under a Position-scoped transaction lock,
including combinations whose optional scopes are null.

An EPP reference marked `REVIEWED` requires both a non-empty technical reference and verifiable
provenance. This is evidence of professional/technical review only, never a legal or commercial
certification claim.

Certification vocabulary, candidate mappings and inventory depth are **PENDING ANITA**. Brand,
supplier, procurement and ERP behavior are **DEFERRED**.
