# LLM Provider Evaluation V1

Status: **PENDING EXTERNAL PRODUCT DECISION**.

This document defines the evaluation gate for a possible future generative assistant provider. It
does not select, configure or activate OpenAI, Anthropic, Google or another vendor. Production
continues to use `DETERMINISTIC_LOCAL_V1`; no external provider secret is required by this change.

## Non-negotiable product boundary

An assistant may support natural-language interaction, summarization, drafting and classification
suggestions. It may not make a final risk decision, determine legal compliance or automatically
declare a root cause. Deterministic domain engines and authorized professionals remain
authoritative.

The provider has no database access. It receives a privacy-minimized envelope assembled by the
server, a finite Action Registry and structured citation identifiers supplied by authorized
context. Returned citation identifiers and requested actions are validated server-side. A model
cannot create tools, expand permissions, bypass organization/role/entitlement checks or remove the
confirmation requirement for material writes.

User text, official-source text, notes, incident descriptions, evidence metadata and uploaded
content are untrusted data. Instructions found in that content cannot alter system rules or action
permissions.

## Evaluation criteria

Any selection proposal must document and receive explicit product/security approval for:

1. Security and privacy controls, including tenant separation and least-data context.
2. Structured tool calling with strict schema enforcement and server-side allowlisting.
3. Citation behavior, including stable structured IDs and rejection of unknown citations.
4. Latency objectives for interactive and background-safe operations.
5. Cost model, quotas, observability and controls against unbounded consumption.
6. Regional processing, subprocessors, data residency and data-processing terms.
7. Logging and retention controls that can exclude prompts, secrets, evidence and personal data.
8. Model quality in Spanish SST workflows without overstating professional or legal authority.
9. Failure handling and deterministic/local fallbacks.
10. Configuration/version traceability and safe model upgrade procedures.

## Audit metadata

Provider telemetry may retain provider key, server-controlled configuration identifier,
request/result status, requested action key, citation-validation result and aggregate citation
count. It must not retain secrets, full prompts, evidence binaries or unnecessary personal data.

## Decision record

- External provider selected: **NO**
- External provider integrated: **NO**
- External secret required: **NO**
- Current provider: `DETERMINISTIC_LOCAL_V1`
- Next decision owner: external product and security review
