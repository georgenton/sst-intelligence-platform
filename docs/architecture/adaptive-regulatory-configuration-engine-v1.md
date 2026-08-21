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

Publication follows `BUILD → VALIDATE → SEAL`. Rule, Group and Pack versions are assembled while
unsealed; the internal publication service validates their complete membership and boundary before
setting `publishedAt` and `sealedAt`. A sealed aggregate consists of the parent version plus every
provenance/membership join. Database triggers reject parent updates/deletes and join
inserts/updates/deletes, including direct Prisma or SQL attempts. New sessions accept only sealed
Pack Versions.

Editable rule drafts move through technical and legal review before immutable publication. A real
regulatory rule requires at least one exact requirement and every linked requirement must be
`APPROVED_FOR_RULE_DRAFTING` at seal time. A successful publication records `sourceDraftId` and
moves the draft to terminal `PUBLISHED`; a later rule version starts from a new draft and never
rewrites its predecessor. Group publication accepts only sealed Rule Version IDs. Pack publication
validates all Fact, Target, Rule and Group memberships, group-to-rule closure, and a uniform DEMO or
regulatory boundary. The V1 pack is DEMO, non-regulatory and carries a mandatory disclaimer.

## Canonical audit hashes

Pack content, evaluation input and evaluation output use `sha256:<64 lowercase hex>`. Their
normalizers are schema-aware: Fact/Target/Rule/Group membership, related keys, traces and other
semantic sets are sorted; `ALL` and `ANY` clauses are recursively sorted because those operators are
commutative. Intentionally ordered values remain ordered, including question display order, choice
display order, explicit priorities and scope order. Pack hashes include exact version identities and
complete executable content. Input hashes include the exact Pack Version/content hash, scope
snapshots, Fact Version IDs, sources and typed values. Output hashes normalize semantic result sets
without erasing product ordering.

## Finite runtime envelope

V1 caps AST depth at 5, clauses per expression at 20, predicates per pack at 500, rules at 200,
groups at 30, fact versions at 100, target versions at 100, scopes per evaluation at 101, facts per
evaluation at 2,000, generated questions at 100, answers per request at 100, selected work centers at
100 and evaluation runs per session at 100. Crossing an engine capacity boundary returns
`ADAPTIVE_LIMIT_EXCEEDED`; questions and runs are never silently truncated or deleted.

## Current state and activation

Declared current state and unverified evidence are attached to proposal items. They cannot change
applicability, depth, traces or provenance. V1 produces only a proposal: no modules, programs,
entitlements, obligations, scores, activation or MOC are created.

## Future optional AI pipeline

Official document → extracted provision draft → requirement draft → AI-assisted rule draft →
technical review → legal review → publication → deterministic runtime. AI may help draft; it may
not approve, publish, decide applicability or activate configuration.
