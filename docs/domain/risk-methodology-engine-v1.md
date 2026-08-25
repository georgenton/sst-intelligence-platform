# Risk Methodology Engine V1 — Phase 1 foundation

## Baseline gate

`origin/main` is `4be72e28a37cb78da0743d98a3e4c3fc7c5fc2a2` and does not contain Product
Walkthrough Hardening V1. This increment therefore stops before production persistence, API, seed,
Inspections runtime, Technical Risk runtime and UI integration. The contracts and manifests in this
phase are non-runtime review material.

## Separation of layers

> LAW/REGULATION tells us what obligations and context to consider. METHODOLOGY tells us how a risk
> is evaluated. EXPERT GUIDANCE helps a professional apply the methodology.

These layers are not interchangeable:

```text
RegulatorySourceVersion
        │ context only
        ▼
RiskMethodRegulatoryContext ──► RiskMethodVersion ◄── MethodologySourceVersion
                                      │
                                      ├── deterministic provider
                                      └── optional ExpertGuidanceVersion (non-scoring)
                                                        │
                                                        ▼
                                             Assessment instance/snapshot
```

GTC45 is a Colombian technical methodology source. It is not Ecuadorian law. A corporate 5×5
workbook is neither an official Ecuador method nor a generic product default.

## Bounded domains proposed

### Methodology source

Global `MethodologySource` identity and immutable `MethodologySourceVersion` metadata:

- stable source key and version;
- title, issuer, origin country and document type;
- edition and publication date;
- source fingerprint;
- source/review/publication status;
- licensing or reproduction note;
- verified official URL when one exists.

It has no `organizationId` and is separate from `RegulatorySource`.

### Risk method

Global or future tenant-scoped `RiskMethodDefinition` with immutable versions:

- method identity and semantic version;
- one finite method kind;
- provider key plus provider version;
- input/result schema versions;
- DEMO and regulatory flags;
- independent publication, technical-review and legal-review states;
- methodology-source and regulatory-context references;
- disclaimer and content hash.

V1 method kinds remain finite:

- `INSPECTION_FINDING_RISK`;
- `HAZARD_RISK_ASSESSMENT`.

There is no no-code formula builder, dynamic evaluation or arbitrary database formula.

### Expert guidance

`RiskMethodExpertGuidanceVersion` is versioned separately. Its questions and help text may capture
professional observations, but every help definition declares `affectsCanonicalScore=false`.

### Assessment

An assessment must store the exact method-version UUID and an immutable snapshot. Initial and
residual valuations keep distinct inputs/outputs but must reference the same exact version. Method
selection never resolves “latest” after creation.

## Provider boundary

The proposed pure interface exposes:

- `validateInput()`;
- `calculate()`;
- `explainResult()`;
- `validateResidualInput()`;
- `calculateResidual()`.

Registry identity is `providerKey + providerVersion`. Providers are compiled and explicitly
registered. JSON can describe finite inputs and explanations, but cannot execute formulas.

The existing Technical Risk registry is a useful primitive. A later runtime increment can share its
registry mechanics, while keeping `TechnicalAssessment` and `InspectionFinding` as separate
aggregates and lifecycles.

## Historical preservation

`DEMO_5X5@1.0.0` remains unchanged. The existing `calculateDemoRisk` output, thresholds, stored
finding fields and historical residual values are not migrated or recalculated. Its Phase 1 manifest
only records identity and the future wrapper boundary.

## Tenant boundary

Global:

- methodology-source definitions and versions;
- approved method definitions and versions;
- provider registry;
- candidate expert-guidance definitions;
- jurisdiction context metadata.

Tenant-specific in a future runtime increment:

- enabled methods and preferences;
- organization-defined criteria/threshold versions;
- assessments, rationales, controls and evidence;
- initial/residual snapshots.

Every tenant query must continue using the authenticated organization context. No organization
criteria may fall back to another tenant.

## Phase 1 deliverables and deferred runtime

Delivered here:

- Zod contracts and provider interface proposal;
- finite GTC45 and guided-5×5 specification oracles for boundary fixtures;
- hashed candidate manifests;
- exact-version residual contract;
- synthetic comparison fixture;
- review documentation and ignored expert pack.

Deferred until Product Walkthrough Hardening V1 is merged:

- Prisma models/migrations and seed;
- provider registration in NestJS;
- method enablement/preferences;
- Inspection and Technical Risk API integration;
- method-selection and guided valuation UI;
- technical-source library routes;
- production deployment and preview.
