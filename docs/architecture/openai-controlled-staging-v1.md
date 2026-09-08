# OpenAI Controlled Staging Integration V1

Status: implementation candidate for external audit. Baseline:
`main@3caea9b95e50dbdde7f5b083a718102acf8900e7`.

OpenAI with `gpt-5.6-terra` and `reasoning.effort=medium` is the authorized provider/model pair for
an explicit, LOW-data staging cohort. Production remains `DETERMINISTIC_LOCAL_V1`. This increment
does not authorize unrestricted production AI, HIGH-sensitivity data, Anthropic, Google, a new
commercial entitlement or pricing.

## Runtime topology

`ControlledConversationalAssistantProvider` is the sole implementation bound to the existing
`ConversationalAssistantProvider` token. It routes an explicitly selected guided request to
`OpenAiConversationalAssistantProvider` only when all controls are true:

- `SST_DEPLOYMENT_ENVIRONMENT=staging`;
- `CONVERSATIONAL_AI_PROVIDER=OPENAI`;
- `CONVERSATIONAL_AI_EXTERNAL_ENABLED=true`;
- model exactly `gpt-5.6-terra` and an API key are configured;
- both the current organization and current user appear in their explicit cohort lists;
- the per-organization audited kill switch is enabled;
- the request declares one supported guided use case and its thread context is LOW-eligible.

Missing, malformed or production configuration resolves to local. Application startup rejects an
attempt to enable external AI in production. The legacy recommendation explanation path also
requires the explicit staging environment, preventing an old `AI_ENABLED=true` value from enabling
production transfer.

## Provider request

The adapter calls only `POST /v1/responses` with:

- `store=false`;
- `model=gpt-5.6-terra`;
- `reasoning.effort=medium`;
- `max_output_tokens=2048`;
- `parallel_tool_calls=false`;
- either strict JSON Schema output or one strict custom function from the existing SST Action
  Registry.

No web search, file search, computer use, shell, code interpreter, background response,
conversation, uploaded file or provider-hosted retrieval is configured. There is no second external
provider and no retry/failover chain.

## LOW-data minimization

The server never sends the free-text conversation message, user ID, organization ID, local citation
label, evidence content or action narrative. The external payload contains a server-authored
canonical task, context type/availability, allowed action keys and opaque citation IDs/types.
Allowed guided use cases are Work Queue lookup, current LOW context lookup, citation summary,
non-canonical operational draft and a server-anchored generic Action proposal.

`WORKER`, `INCIDENT`, `PPE`, `TRAINING` and `WORK_PERMIT` thread contexts are not external-eligible.
Worker identity, health/medical/psychosocial information, incident narratives, evidence binaries,
credentials, privileged investigations and HIGH data therefore remain local. A UI label is not the
control; the API constructs the minimized payload.

## Authorization and tools

`AccessTokenGuard` and `OrganizationGuard` run first. Immediately before constructing a provider
request, the service reloads the ACTIVE membership and effective entitlements. The provider never
receives or selects tenant scope, role or entitlements. Tool availability is derived by the server
from current role, current entitlements, thread anchor and use case.

Every exposed tool is an existing `ConversationActionKey`. Its input is fixed by a server-created
exact-value JSON Schema. The response guard rejects an unknown action, modified tool input,
unsupported capability or citation outside the supplied opaque allowlist. A material call creates
only an `AWAITING_CONFIRMATION` `ConversationActionRun`; confirmation re-enters the authenticated
route and canonical domain service. Revocation, role downgrade or entitlement removal therefore
applies before execution.

The model output is interaction content, never the final legal conclusion, deterministic risk
score, root cause, worker/organization safety score or regulatory applicability decision. The UI
states that generative staging output requires human review.

## Failure and fallback

There are no provider retries. Timeout, 429/5xx, invalid JSON/schema, unsupported action, altered
tool input and invented citation downgrade to `DETERMINISTIC_LOCAL_V1` where its bounded behavior is
available. Malformed model output never creates or executes an action.

The audited per-organization switch is changed through `POST /conversations/provider-control` by a
current `ORG_OWNER` or `ORG_ADMIN`. Disabling is immediate and requires neither deployment nor a
schema change. Re-enabling still requires the immutable staging/cohort configuration, so the switch
cannot expand the pilot.

## Observability and feedback

Every provider attempt records safe metadata in `AuditLog`: actual provider/config, requested and
returned model, policy version, latency, token usage, estimated cost, requested tools, citation
validation, error class and fallback. Organization and user dimensions are canonical audit columns.
Raw prompts, raw responses, chain of thought, API keys and SST payloads are not recorded.

External assistant messages accept useful/not-useful feedback plus one bounded reason:
`INCORRECT`, `UNCLEAR`, `MISSING_CONTEXT`, `CITATION_ISSUE`, `TOO_VERBOSE` or
`ACTION_SUGGESTION_ISSUE`. There is no free-text feedback field. Feedback is tenant/user scoped and
stored as an audit event, so this increment needs no migration.

## Staging configuration

Set secrets only on the staging API service:

```text
SST_DEPLOYMENT_ENVIRONMENT=staging
CONVERSATIONAL_AI_PROVIDER=OPENAI
CONVERSATIONAL_AI_EXTERNAL_ENABLED=true
CONVERSATIONAL_AI_OPENAI_MODEL=gpt-5.6-terra
CONVERSATIONAL_AI_STAGING_ORGANIZATION_IDS=<comma-separated UUIDs>
CONVERSATIONAL_AI_STAGING_USER_IDS=<comma-separated UUIDs>
OPENAI_API_KEY=<staging secret>
```

Production must use:

```text
SST_DEPLOYMENT_ENVIRONMENT=production
CONVERSATIONAL_AI_PROVIDER=DETERMINISTIC_LOCAL_V1
CONVERSATIONAL_AI_EXTERNAL_ENABLED=false
AI_ENABLED=false
```

Do not configure `OPENAI_API_KEY` in production. The startup guard rejects external activation even
if a stale key exists.

## Controlled smoke

Use only synthetic LOW records and an explicitly listed user/organization. Verify provider status,
Work Queue lookup, opaque citation summary, operational draft, generic single-organization action
proposal, visible confirmation boundary, invented-citation downgrade, unknown-tool downgrade,
revocation between proposal/confirmation and kill-switch fallback. Inspect audit metadata without
printing raw secrets or prompts. Production is checked separately for provider
`DETERMINISTIC_LOCAL_V1` and zero OpenAI requests.

## Gates before production expansion

The following remain `PENDING` and block production/high-sensitivity expansion: DPA applicability,
retention configuration, Ecuador transfer assessment, subprocessor review and OpenAI account/project
security controls. A successful LOW staging pilot does not close these gates.

The concrete isolated resource topology, synthetic bootstrap and credential-owner handoff are
defined in [Isolated Staging Environment V1](../deployment/isolated-staging-v1.md).
