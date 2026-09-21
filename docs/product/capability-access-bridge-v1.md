# Capability Access Bridge V1

The Unified SST Assessment remains a historical, deterministic recommendation. It stores the
capability engine output (`engineVersion`, input/output hashes, reasons and matched facts) on the
finalized assessment. The bridge never recalculates that output and never rewrites it.

An authorized human may select a capability from the access center. Recommended capabilities are
marked `ASSESSMENT_RECOMMENDED`; a capability chosen from the progressive exploration list is
marked `EXPLORATION_SELECTED`. Both choices are explicit and are recorded as temporary demo access,
never as a professional decision, a plan, a subscription or permanent entitlement.

The server-side map is deliberately bounded:

| Capability     | Module                   | Feature                 | Route                 |
| -------------- | ------------------------ | ----------------------- | --------------------- |
| INSPECTIONS    | INSPECTIONS_INTELLIGENCE | `module.inspections`    | `/app/inspections`    |
| TECHNICAL_RISK | TECHNICAL_RISK           | `module.technical_risk` | `/app/technical-risk` |
| INCIDENTS      | INCIDENTS                | `module.incidents`      | `/app/incidents`      |
| PPE            | PPE                      | `module.ppe`            | `/app/ppe`            |
| TRAINING       | TRAINING                 | `module.training`       | `/app/training`       |
| WORK_PERMITS   | WORK_PERMITS             | `module.work_permits`   | `/app/work-permits`   |
| WORKFORCE      | CORE                     | —                       | `/app/workers`        |
| GOVERNANCE     | CORE                     | —                       | `/app/governance`     |

`GET /capability-access` is a tenant-scoped read model. It combines the latest finalized
assessment (or an explicitly requested finalized assessment), its frozen provenance, effective
access and the demo lifecycle. `POST /capability-access/demo` accepts an assessment id and an
explicit capability list. It requires an active `ORG_OWNER` or `ORG_ADMIN`, a finalized assessment
belonging to the organization, `demo.enabled`, and an `Idempotency-Key`.

Activation is one transaction: organization demo state, explicit `OrganizationModule` rows,
bounded synthetic inspection provisioning and the `CAPABILITY_DEMO_ACCESS_ACTIVATED` audit event
commit together. A later addition to an active demo reuses the existing expiry; it never extends
the trial. An expired demo returns `DEMO_EXPIRED` and is not restarted automatically.

Inspection demo fixtures remain synthetic and identifiable. PPE, incident and training activation
only opens the implemented modules; it does not create professional selections, incidents,
training needs, attendance or regulatory rules. Plan Operativo remains an independent flow.

Existing active demo organizations without bridge provenance retain the legacy workforce preview
fallback. A new bridge activation writes `accessType: DEMO` and the assessment id into each
selected module's metadata; those explicit rows are authoritative, so a partial human selection
stays partial.

Migration 35 only adds `INCIDENTS`, `PPE` and `TRAINING` to `ModuleKey`. Canonical reference sync
provisions their module definitions idempotently; development seed is not required. No real
regulatory rule, Anita decision, subscription or permanent entitlement is created by this bridge.
