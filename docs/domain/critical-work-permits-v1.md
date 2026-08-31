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

Writers use the existing operational roles. At draft creation the requester selects a different,
active approver from the current organization's `ORG_OWNER`, `ORG_ADMIN` or `SST_MANAGER` members.
The API rejects free-form/cross-tenant, inactive, ineligible and self approvers. Only the assigned
approver may authorize the pending permit while their current membership and role remain valid;
`VIEWER` is read-only. UI visibility is convenience only—the API enforces entitlement, role,
tenant, assignment, self-approval and version checks. Material actions are audited. See
[Organization Team & Invitations V1](organization-team-invitations-v1.md).

## Shared operational surfaces

Pending approvals, suspended permits and actionable planned permits appear in the Operational Work
Queue with the selected approver as the pending item assignee and therefore in Command Center
“Necesita atención”. The module keeps its own canonical list
and detail routes; it does not create a separate pending-work dashboard. When preview access is not
effective, permit records are excluded from the shared Work Queue so private data and unusable deep
links are not exposed.
