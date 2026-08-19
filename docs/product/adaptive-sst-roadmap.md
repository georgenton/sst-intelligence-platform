# Adaptive SST roadmap

## Purpose and boundary

Adaptive SST separates deterministic applicability, source provenance, operational context, current
state, inspection depth, configuration and activation. Capability gates—not pull-request numbers—set
the delivery sequence.

The current `DEMO_APPLICABILITY` pack remains synthetic and non-regulatory. No real rule pack may be
published without an identified source, immutable source version, provision extraction, requirement
definition, technical review, legal review, rule tests and explicit approval.

## Delivery state

### Completed

- Platform and multi-tenant foundation
- Intelligent Inspections Engine and Experience
- Technical Risk Engine and Experience
- Applicability Engine and Experience
- Multi-Company Applicability Validation Lab
- Regulatory Source Foundation V1

### Current parallel track

- Regulatory Provision & Requirement Foundation V1

### Pending expert validation

- Profile V2 decisions
- Current State & Evidence Baseline
- Inspection depth rules

### Future regulatory track

- Controlled provision extraction
- Requirement review
- Rule drafting
- Rule approval
- Real rule-pack publication

### Then

- Gap Assessment
- Depth Resolver and Configuration Proposal
- Configuration Activation and Management of Change

Current State was not cancelled. It waits for expert evidence about scope, taxonomy and proof.

## Regulatory pipeline

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

The source foundation stops at `RegulatorySourceVersion`. The current parallel foundation adds
empty, immutable structures for reviewed provisions and requirements, without real Ecuador content.
Discovery is not extraction; extraction is not approval; a requirement candidate is not a rule;
and an approved source is not an applicability result.

## Validation-to-product decisions

The eight synthetic scenarios reveal profile gaps by frequency, not legal importance. Expert review
must decide which facts belong at organization or work-center scope, which sources deserve priority,
which current-state questions are meaningful and which decisions require professional judgment.

Regulatory Source Foundation remains independent from those decisions: it stores stable source
identity and editorial provenance without changing Profile V1, the demo evaluator, current state,
evidence, depth or prioritization.

## Workstream separation

- Source, applicability, obligation, rule and compliance remain separate concepts.
- Consultant access belongs to the service-model axis; API authorization remains authoritative.
- Pricing, partnership and ownership decisions are outside this technical roadmap.
- Expert observations are product-discovery evidence, not generated rules or legal approval.
