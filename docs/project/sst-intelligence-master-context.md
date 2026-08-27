# SST Intelligence — master project context

Status: canonical continuity document. Baseline: production `main` at
`861218c38e5d2bba1f2bd0d0623f104cda862bbf` on 2026-08-27.

This document is the authoritative entry point for future engineering sessions. Detailed domain,
architecture, security, deployment and source-review documents remain authoritative inside their
bounded areas. The [master roadmap](sst-intelligence-roadmap.md) is the sole cross-product priority
roadmap.

## Product direction

SST Intelligence is becoming an **SST Operating System + Professional Intelligence Layer** for
organizations, SST teams and consultants. It should help a professional determine what needs
attention, understand the exact source and article, assess risk with deterministic versioned
methods, assign and execute work, collect organizational evidence, review outcomes and produce
auditable evidence packages.

The differentiator is operational SST intelligence combined with deterministic methodologies,
regulatory provenance, professional workflows and cross-module reasoning. It is not an LLM that
evaluates workers.

The intended operating surface covers inspections, Technical Risk, corrective actions, residual
risk, permits, incidents, PPE, training and competency, governance, recurrence, cross-module
patterns, reports and later an AI copilot within strict limits.

## Permanent concept boundaries

These concepts are related but never interchangeable:

```text
Regulation / legal source
!= Regulatory article or unit
!= Platform interpretation
!= Requirement
!= Rule
!= Technical methodology
!= Assessment
!= Organization evidence
!= Risk-verification evidence
!= Professional review
```

A regulatory link records provenance; it does not prove compliance or non-compliance. Official
text, platform interpretation and tenant-private evidence remain separate in storage and UX.

## Authority model

The server/domain is authoritative. Rule evaluation, GTC45, Guided 5×5, residual risk, recurrence
and domain lifecycles are deterministic. The frontend collects inputs and renders versioned results.

AI must not select scores, change deterministic results, declare legal compliance, publish rules,
diagnose occupational health, declare root cause or override professional decisions. Future AI may
search, explain, summarize, draft, group semantically, suggest patterns and prepare reports without
becoming the decision authority.

## Multi-tenancy and data ownership

The platform uses shared PostgreSQL with strict `organizationId` isolation. Organization context
comes from the authenticated user, selected active organization and verified membership; request
bodies never establish tenant authority.

Tenant-private data includes facts, current states, organization evidence, inspections, findings,
actions, assessments, work, permits, training, PPE, incidents and reviews tied to tenant work.
Global reference/editorial data includes regulatory sources and versions, regulatory units,
methodology sources, risk-method definitions and versions, and global reviewed interpretations or
rules where appropriate. Tenant data must never leak into global editorial artifacts.

## Production architecture

- TypeScript/pnpm/Turborepo monorepo on Node 24 LTS.
- NestJS REST modular monolith in `apps/api`.
- Next.js App Router client in `apps/web`.
- Pure contracts and deterministic business rules in `packages/contracts`.
- PostgreSQL + Prisma on Railway; backend on Railway; frontend on Vercel.
- Playwright policy: one worker, zero retries.
- No microservices, queues, Redis, GraphQL, CQRS, vector database or speculative infrastructure.

## Current production capability baseline

### Platform, auth and tenancy

Own NestJS auth uses Argon2id, access JWTs, rotating hashed refresh tokens, Secure/HttpOnly cookies,
refresh-family reuse handling, proactive single-flight refresh, one retry after 401 and session
generation/abort protection. AUTH-001 is closed. Organization context, memberships, roles and Work
Centers are operational. Roles are `ORG_OWNER`, `ORG_ADMIN`, `SST_MANAGER`, `SST_TECHNICIAN`,
`CONSULTANT` and `VIEWER`; API guards remain authoritative.

### Inspections

Guided inspections support findings, risk valuation, actions, evidence, completion, verification,
residual risk, analytics, recurrence, alerts and systemic review. Verification basis is finite:
`RECORDED_EVIDENCE`, `FIELD_OBSERVATION` or `OTHER_JUSTIFIED`. Recurrence groups by organization,
work center, category and time window, and never asserts root cause automatically.

### Risk methodology and Technical Risk

Production reference methods are `DEMO_5X5`, `GUIDED_5X5` and `GTC45_2010`. Exact immutable method
versions remain attached to historical assessments; initial and residual valuation use the same
version and history is not recalculated.

GTC45 uses ND values 10/6/2 plus non-numeric LOW handling, NE 4/3/2/1, derived NP, NC
100/60/25/10, derived NR and intervention levels I–IV. LOW is never zero. GTC45 is a Colombian
technical methodology candidate, not Ecuadorian law; its full copyrighted text/PDF does not belong
in the regulatory library.

Guided 5×5 uses human probability 1–5, human severity 1–5 and deterministic P×S. Decision cues help
professional judgment but do not select the score. The V1 severity dimension is HUMAN. Organization
guidance cannot silently change the ranges or formula.

Technical Risk preserves legacy history, deterministic results, professional review,
`NEEDS_REVISION`, correction chains and concurrency safeguards. New assessments may use Guided 5×5
or GTC45 while retaining the independent `TechnicalAssessment` lifecycle.

### Regulatory evidence and Unified SST Evaluation

Production contains 15 `RegulatorySource` records, 25 source versions, 1112 regulatory units, 893
ARTICLE units and 8 fully structured source versions. Latest-version classification is 13
`OFFICIAL_ARTIFACT_VERIFIED`, 1 `OFFICIAL_REFERENCE_ONLY`, 0 `ARTIFACT_PENDING` and 1
`REJECTED_UNVERIFIED`. Structural coverage is `STRUCTURED_DOCUMENTS_ONLY`; the whole corpus is not
structurally complete.

The library supports source/article browsing and search, exact text, table of contents, locator,
page, source version, artifact verification, vigencia and official links. Official text and platform
interpretation remain separate.

The controlled MDT-2024-196 Art. 18/19 pilot contains 5 candidate Requirements, 5 candidate
RuleDrafts and 0 real published RuleVersions. All interpretations remain pending professional
review; no Anita approval exists.

Unified SST Evaluation coordinates organization facts, candidate applicability, regulatory
provenance, current state, organization evidence and risk context without replacing specialized
engines. Expert Review exposes candidate decision, facts, Requirement, RuleDraft, article, source
version, source and trace; review does not publish a RuleVersion automatically.

## Regulatory truth and traceability

893 structured articles do not mean 893 interpreted obligations or executable rules. Do not turn
every article into a rule.

Required regulatory trace:

```text
Decision
→ RuleDraft or RuleVersion
→ Requirement
→ RegulatoryUnit
→ RegulatorySourceVersion
→ RegulatorySource
→ official artifact metadata, hash and locator
```

Required risk trace:

```text
Assessment → exact RiskMethodVersion → MethodologySource
```

## Historical immutability

Never silently recalculate historical findings, initial risk after residual valuation, historical
Technical Assessments, published RiskMethodVersions, verified RegulatoryUnits, approved regulatory
interpretations or published RuleVersions. A new official edition or professional decision creates
a new version; it does not overwrite history.

## Pending Professional Review — Anita

Engineering must not decide or fabricate:

1. approval of the 5 MDT Art. 18/19 Requirements or 5 RuleDrafts;
2. publication of real regulatory RuleVersions;
3. `ANITA_GUIDANCE_GTC45_V1`;
4. source, medium and person guidance questions;
5. required versus advisory Guided 5×5 cues or wording refinements;
6. evidence expectations for score selection;
7. preferred methodology by risk/context or mixed-method programs;
8. additional professional Technical Risk criteria;
9. priority of future legal interpretations.

Technical and product work may continue around these questions while candidate state remains
explicit.

## Active program

The current implementation program is [Operational Execution Program V1](../product/operational-execution-program-v1.md):
Obligation Execution, an Operational Work Queue, Command Center V2, Workspace UX V2 pilots, safe
documentary expansion where possible and a bounded generic Critical Work Permit V1. It adds no new
legal interpretation, pricing strategy or AI authority.
