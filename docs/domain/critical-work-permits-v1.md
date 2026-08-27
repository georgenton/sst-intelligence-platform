# Critical Work Permits V1

Status: implemented bounded internal/demo slice.

## Boundary and template

V1 is an internal operational permit, not an Ecuador regulatory template or compliance
certificate. A global `PermitTemplate` owns immutable published `PermitTemplateVersion` records.
The seeded first version is generic, deterministic and explicitly demonstrative. Published content
is drift-protected and cannot be edited or deleted in place.

Tenant-private `WorkPermit` records capture work center, area, activity, planned interval, hazards,
controls, preconditions, organization evidence references and snapshots of linked Technical Risk
assessments. References are validated against the active organization.

## Lifecycle

```text
DRAFT → PENDING_APPROVAL → AUTHORIZED → ACTIVE → CLOSED
                            ↘ SUSPENDED ↔ ACTIVE
```

Bounded cancellation and return-to-draft paths are defined by the domain contract. Invalid paths
are rejected. Closure from active/suspended requires a closure note. Optimistic `expectedVersion`
protects concurrent transitions and approvals.

## Authorization and approval

The dedicated `module.work_permits` entitlement is authoritative. Its single global
`FeatureDefinition` is deterministic, idempotent, drift-protected reference data. V1 grants the
capability only while an authorized demo organization has an active bounded demo window. It creates
zero commercial `PlanFeature` assignments; future packaging and pricing remain **PENDING PRODUCT
DECISION**. Expiry restores ordinary entitlement behavior without removing permit history.

Writers use the existing operational roles. Approval is limited to `ORG_OWNER`, `ORG_ADMIN` and
`SST_MANAGER`; `VIEWER` is read-only and the requester cannot approve their own permit. UI
visibility is convenience only—the API enforces entitlement, role, tenant, self-approval and
version checks. Material actions are audited.

## Shared operational surfaces

Pending approvals, suspended permits and actionable planned permits appear in the Operational Work
Queue and therefore in Command Center “Necesita atención”. The module keeps its own canonical list
and detail routes; it does not create a separate pending-work dashboard. When preview access is not
effective, permit records are excluded from the shared Work Queue so private data and unusable deep
links are not exposed.
