# Current State & Evidence Baseline proposal

## Status

Architecture proposal only. It is not implemented in PR #20 and does not define a compliance score,
automatic evidence verification, API, table or UI.

## Candidate model

`OrganizationControlBaselineVersion` would identify an immutable completed snapshot for one
organization. A draft could evolve, but completion would make the version append-only; later facts
would create a new version.

`ControlImplementationRecord` would record a target, scope and provisional implementation state:

- `UNKNOWN`
- `NOT_IMPLEMENTED`
- `PLANNED`
- `IN_PROGRESS`
- `PARTIALLY_IMPLEMENTED`
- `IMPLEMENTED`

Initial candidate scopes are `ORGANIZATION` and `WORK_CENTER`. Scope resolution must use a validated
organization context and must not accept an arbitrary organization identifier from a domain body.

`ControlEvidence` would initially support `NOTE` and `EXTERNAL_LINK`. Presence means only that
evidence was provided. It does not mean the control exists, is adequate, is effective or complies with
a source.

## Invariants for the future increment

- No current-state claim may alter a historical Applicability Assessment.
- Completed baselines are versioned and append-only.
- Implementation state and evidence verification remain distinct.
- API guards are authoritative for organization, role and entitlement.
- Employee-level, medical and psychosocial data are out of scope.
- No single overall compliance percentage is inferred.

## Questions before implementation

- Which targets allow organization scope and which require work-center scope?
- What is the review transition for a declared implementation state?
- Is evidence verification a separate role and event?
- Which changes require a new baseline version rather than an appended note?
