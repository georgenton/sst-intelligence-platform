# ADR — Conversational Operations as a bounded interface layer

Status: accepted and controlled deterministic V1 closed in production on 2026-09-02.

## Decision

Conversational Operations is a tenant-private interface within the NestJS modular monolith. It has
its own interaction persistence, a server-side allowlisted action registry and a provider
abstraction. It does not own inspection, Finding, Action, Evidence, Work Queue, regulatory or risk
state.

```text
authenticated request + current membership
  → private ConversationThread
  → structured allowlisted ActionRun
  → explicit confirmation for writes
  → existing application service
  → canonical domain record + domain audit
  → structured result references and citations
```

## Consequences

- OrganizationGuard resolves current membership and role on every request; stale token role claims
  are not action authority.
- Entitlements are checked again inside the registry before module actions.
- All initial write actions use the same role set as the existing Inspection UI/API.
- An organization-scoped unique idempotency key and atomic action-run claim prevent duplicate tool
  execution.
- Only conversation tables are written by conversational orchestration. Domain writes happen
  through existing services; the registry itself has no Prisma dependency.
- Conversation messages and provider output are not canonical audit evidence.
- Citations are created only from stored entity relationships returned by services.
- Evidence data is not duplicated; only a canonical destination reference is retained.
- The deterministic provider is the V1 default. No external LLM dependency, secret or vendor choice
  is required.
- A future generative provider receives a privacy-minimized envelope, server-supplied citation IDs
  and the finite Action Registry. Unknown citations, capabilities and actions are rejected before
  domain execution; provider telemetry excludes prompt content and unnecessary personal data.

## Rejected alternatives

- Direct model-to-database writes: violates authorization, validation and audit boundaries.
- Arbitrary model-selected tools: expands privilege and prompt-injection exposure.
- A new generic workflow/CQRS engine: unnecessary infrastructure for this bounded slice.
- Silent writes inferred from prose: removes informed confirmation and makes replay unsafe.
- Storing uploaded files in chat: duplicates the Evidence domain and its lifecycle.
- Treating messages as legal records or compliance decisions: exceeds product and professional
  authority.

## Deferred

Production LLM/provider choice, external data-processing terms, retention policy, semantic search,
cross-company assistant views and further write actions require separate product/security review.

Production closure did not change these deferred decisions. The verified provider remains
`DETERMINISTIC_LOCAL_V1`; canonical writes occurred only through existing domain services after an
explicit confirmation, and the resulting corrective Action projected exactly once into the shared
Work Queue.

The provider evaluation gate and unresolved vendor decision are documented in
`docs/architecture/llm-provider-evaluation-v1.md`.
