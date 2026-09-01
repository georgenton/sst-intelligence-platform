# PPE / EPP V1

Status: authorized bounded operational workflow.

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

`referenceStandard` is organization metadata only. V1 contains no proprietary standard text and
makes no certification or legal-requirement claim.
