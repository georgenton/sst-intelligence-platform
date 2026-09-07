# ADR — Post-Anita product convergence V1

Status: accepted for this implementation candidate; pending external audit.

## 1. Plan Operativo is not Work Queue

Decision: persist versioned plans and immutable items, while Work Queue remains an attention-only
read projection. This avoids two sources of truth and keeps plan history independent from daily
prioritization.

## 2. Resource Scope precedes deterministic mapping

Decision: keep `Inspection Domain`, `Resource Scope`, `Inspection Basis`, `StandardVersion`,
`Criterion Mapping` and `Criterion` as separate concepts. A V0 inspection selects one primary
resource and resolves one exact active mapping against the already resolved technical version.
Criteria are referenced, never duplicated.

## 3. Historical snapshots and versions

Decision: taxonomy and mapping content is append-only. New scoped inspections store exact IDs,
versions, digests and ordered criterion IDs. Existing inspections receive no backfill. A database
trigger prevents resource-snapshot rewriting.

## 4. AI proposal, professional review and runtime publication

Decision: the drafting spike ends at an editorial state. `AI_PROPOSED → PENDING_EXPERT_REVIEW →
APPROVED | REJECTED`; APPROVED means favorably reviewed, not published. No endpoint turns the
proposal into a RuleVersion, StandardVersion or active mapping. Runtime publication remains a
future, explicit and independently authorized operation.

## Consequences

The implementation stays inside the NestJS modular monolith, PostgreSQL/Prisma, Next.js and pure
contracts. It introduces no queue, cache, vector database, generic protocol engine, new permission
system, entitlement, pricing rule or external production AI.
