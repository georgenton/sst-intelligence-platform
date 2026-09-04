# AI Copilot V1 productization

Status: provider-neutral productization and deterministic portfolio workflow **PRODUCTION CLOSED**
through PR36/37/38 on 2026-09-03. OpenAI/`gpt-5.6-terra` is now selected only for the controlled
LOW-data staging integration candidate; production remains deterministic. See the
[release evidence](../testing/e2e-runtime.md#cierre-productivo-pr363738--2026-09-03) and
[provider evaluation boundary](../architecture/llm-provider-evaluation-v1.md), plus the
[controlled staging boundary](../architecture/openai-controlled-staging-v1.md).

## Product capabilities

The supported capability vocabulary is `SEARCH`, `EXPLAIN`, `SUMMARIZE`,
`COMPARE_FACTUAL_STATE`, `DRAFT` and `SUGGEST_NEXT_QUESTION`. These describe bounded product
operations, not autonomous authority.

The prohibited authority vocabulary is `FINAL_RISK_DECISION`, `LEGAL_COMPLIANCE_DECISION`,
`AUTOMATIC_ROOT_CAUSE`, `WORKER_SAFETY_SCORE` and `AUTONOMOUS_MATERIAL_MUTATION`. Domain engines,
current authorization and professional review remain authoritative.

## Portfolio read context

Portfolio interaction uses the distinct `PORTFOLIO_READ_ONLY` context. Its finite actions are:

- `get_portfolio_summary`;
- `get_portfolio_attention`;
- `get_portfolio_overdue_work`;
- `get_portfolio_signals`;
- `get_portfolio_evidence_state`;
- `get_organization_summary`;
- `search_portfolio`.

Every request rebuilds the current authorized organization set and intersects requested scope with
it. Every organization-specific factual response has server-created citations with organization,
source identity and deep link; citations are rejected if their organization is outside that set.

## Explicit boundaries

The response contract can say `INSUFFICIENT_CONTEXT`, `SOURCE_NOT_AVAILABLE`, `NOT_AUTHORIZED` or
`PROFESSIONAL_REVIEW_REQUIRED`. A request to create one action produces only a required
organization anchor. The UI changes to that context before continuing in the existing canonical
Conversational Operations surface. Multi-organization material mutation is rejected.

`DraftResult` is explicitly non-canonical, unpersisted and review-required. Summarization accepts
authorized factual context and returns supporting citation IDs plus coverage/uncertainty metadata.
Search is provider-neutral, bounded and deterministic; no vector database is part of V1.

The portfolio response engine remains deterministic in production. The shared provider token can
route only explicitly selected, minimized requests from the controlled staging cohort to OpenAI;
the current authorized organization set remains server-created and cannot be expanded by a model.
