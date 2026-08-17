# Adaptive SST roadmap

## Purpose and boundary

Adaptive SST separates deterministic applicability from operational context, current state,
inspection depth, service delivery and commercial limits. The sequence intentionally validates the
existing synthetic engine with different company profiles before adding new production domains.

The current `DEMO_APPLICABILITY` pack is synthetic and non-regulatory. Its outputs do not represent
legal applicability in Ecuador. No real rule pack may be published without a located official source,
versioned extraction, technical review, legal review, rule tests and explicit approval.

## Delivery state

Completed:

- platform and multi-tenant foundation;
- Intelligent Inspections Engine and Experience;
- Technical Risk Engine and Experience;
- Applicability Engine and Experience.

Current:

- PR #20 — Multi-Company Applicability Validation Lab V1.

Planned sequence after expert scenario validation:

1. PR #21 — Current State & Evidence Baseline V1.
2. PR #22 — Gap Assessment Engine V1.
3. PR #23 — Depth Resolver + Inspection Configuration Proposal V1.
4. PR #24 — Configuration Activation + Management of Change V1.

The regulatory-source domain and real Ecuador content may proceed as a controlled parallel stream,
but discovery is not authorization for extraction and extraction is not authorization for rules.

## Validation-to-product decisions

The eight committed scenarios reveal profile gaps by frequency, not legal importance. Expert review
must decide which facts belong at organization or work-center scope, which require technical sources,
and which need a specialist. Only then may Profile V2 or the next domain increment be proposed.

The next production-domain increment is Current State & Evidence Baseline V1. PR #20 does not add
current-state tables, gaps, depth calculation, configuration activation or MOC workflows.

## Workstream separation

- Applicability remains independent from budget and purchased plan.
- Consultant access belongs to the service-model axis and API authorization remains authoritative.
- Pricing, partnership and ownership decisions are outside this technical roadmap.
- Expert observations are evidence for product discovery, not generated rules or legal approval.
