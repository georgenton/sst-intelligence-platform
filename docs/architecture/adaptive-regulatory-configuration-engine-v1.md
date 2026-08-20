# Adaptive Regulatory Configuration Engine V1

## Decision

The adaptive layer is a separate deterministic vertical slice. It does not modify Profile V1,
`DEMO_APPLICABILITY`, `evaluateApplicability`, its precedence or its persisted assessments. A pure
engine in `@sst/contracts` receives an immutable pack snapshot, explicit scopes and typed facts; the
Nest service owns tenancy, persistence, revisions and audit records; the Next.js client renders API
results without calculating rules.

## Why deterministic

SST configuration must be reproducible, testable and explainable. Runtime execution therefore uses
a bounded AST, strict value types, tri-state truth tables, stable ordering and explicit precedence.
There is no `eval`, executable string, SQL fragment, probabilistic decision or LLM call.

## Data-driven extension

Stable Fact, Target, Rule, Group and Pack definitions have immutable published versions. Adding a
new fact definition, question, target or rule normally provisions reference rows rather than adding
a Prisma column. New value types or operators remain finite code changes.

## Scope and history

V1 evaluates an organization scope and independent work-center scopes. A work-center rule may read
its current scope and explicitly allowed organization facts, never a sibling center. Sessions
snapshot work-center identity and reference an exact profile and pack. Every reevaluation creates an
append-only run, question snapshot, proposal and configuration items.

## Publication boundary

Editable rule drafts move through technical and legal review before immutable publication. A real
regulatory rule requires at least one `APPROVED_FOR_RULE_DRAFTING` requirement and exact provenance.
The V1 pack is DEMO, non-regulatory and carries a mandatory disclaimer.

## Current state and activation

Declared current state and unverified evidence are attached to proposal items. They cannot change
applicability, depth, traces or provenance. V1 produces only a proposal: no modules, programs,
entitlements, obligations, scores, activation or MOC are created.

## Future optional AI pipeline

Official document → extracted provision draft → requirement draft → AI-assisted rule draft →
technical review → legal review → publication → deterministic runtime. AI may help draft; it may
not approve, publish, decide applicability or activate configuration.
