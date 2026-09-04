# External LLM Provider Selection V1

Status: **HISTORICAL EVALUATION COMPLETE; OPENAI/`gpt-5.6-terra` SELECTED FOR CONTROLLED LOW-DATA
STAGING ONLY**. Production remains `DETERMINISTIC_LOCAL_V1`; see
[OpenAI Controlled Staging Integration V1](openai-controlled-staging-v1.md).

Research date: 2026-09-03. Baseline: `de2bb061ab8347a3c2aa396f456c8e59c8b179e5`
on `main`, synchronized with `origin/main` and clean before this documentation update.

This record evaluates OpenAI, Anthropic and Google for a possible future generative assistant. It
does not configure, integrate or activate a vendor. Production remains
`DETERMINISTIC_LOCAL_V1`; `AI_ENABLED=false`, the optional legacy explanation provider remains
`template`, and no external secret or customer data was used.

## Executive comparison

The documentary shortlist for a controlled synthetic bake-off is:

1. **OpenAI / `gpt-5.6-terra`**, with `gpt-5.6-luna` as the lower-cost model candidate.
2. **Anthropic / `claude-sonnet-5`**, with `claude-haiku-4-5-20251001` as the lower-cost model
   candidate.
3. **Google Gemini on Vertex AI / `gemini-3.8-flash`**, with `gemini-3.5-flash-lite` retained only
   as a later lower-cost candidate.

This ordering is not a production selection and is not an empirical quality ranking. OpenAI is
first for the bake-off because its documented strict tool and structured-output controls fit the
existing provider boundary and the repository already contains a server-side OpenAI SDK precedent.
Anthropic is a close second with equivalent documented strict-schema primitives, a clear commercial
DPA path and slightly lower representative primary-model token cost. Google 3.8 Flash is GA and
supports function calling and structured output, but `VALIDATED` optional tool mode is documented
as Preview, current promotional pricing expires, and its quality/citation fit still requires the
same live evidence.

No provider passes the production security, tool-calling, structured-output or citation gates yet.
Those gates require an approved non-production account, verified contractual settings and the
unchanged synthetic harness. Provider and model are separate decisions: a vendor approval must not
silently approve every model or a moving alias.

## Official-source matrix

All sources below are vendor-primary sources retrieved on **2026-09-03**.

| Provider  | Privacy, retention and residency                                                                                                                                                                                                                                                                                                                                                                                | Contract and subprocessors                                                                                                                                                                                            | Tool/schema                                                                                                                                                                                                                                  | Models, limits and pricing                                                                                                                                                                                                                                                                                                     | Reliability                                                                                                                                                                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI    | [Data controls](https://developers.openai.com/api/docs/guides/your-data)                                                                                                                                                                                                                                                                                                                                        | Contractual DPA/subprocessor acceptance must be verified during procurement; it was not inferred from marketing material                                                                                              | [Function calling](https://developers.openai.com/api/docs/guides/function-calling), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)                                                                   | [`gpt-5.6-terra`](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [`gpt-5.6-luna`](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [model guidance](https://developers.openai.com/api/docs/guides/latest-model)                                                                                     | [Rate limits and retry guidance](https://developers.openai.com/api/docs/guides/rate-limits)                                                                                                                                                                       |
| Anthropic | [Default retention](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data), [ZDR scope](https://privacy.claude.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to), [processing locations](https://privacy.claude.com/en/articles/7996890-where-are-your-servers-located-do-you-host-your-models-on-eu-servers) | [DPA and SCC incorporation](https://privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa); subprocessor list linked by the location notice must be reviewed at contracting | [Strict tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use), [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)                                             | [Models](https://platform.claude.com/docs/en/models/overview), [pricing](https://platform.claude.com/docs/en/about-claude/pricing)                                                                                                                                                                                             | [Rate limits](https://platform.claude.com/docs/en/api/rate-limits), [errors](https://platform.claude.com/docs/en/api/errors)                                                                                                                                      |
| Google    | [Vertex/Agent Platform ZDR](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention), [locations](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/locations); [Gemini API terms](https://ai.google.dev/gemini-api/terms) distinguish paid and unpaid use                                                                                          | [Cloud DPA](https://cloud.google.com/terms/data-processing-addendum), [subprocessors](https://cloud.google.com/terms/subprocessors)                                                                                   | [Function calling](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling), [structured output](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/control-generated-output) | [`gemini-3.8-flash`](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-flash), [3.8 developer guide](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-flash), [pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing) | [Throughput](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/resources/throughput-quota), [API errors/retries](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/api-errors), [Vertex SLA](https://cloud.google.com/vertex-ai/sla) |

## OpenAI

### Privacy

- API data is not used to train OpenAI models unless the customer explicitly opts in.
- Default abuse-monitoring logs can contain prompts/responses and are retained for up to 30 days.
- Responses API application state is retained for at least 30 days when `store=true` or the default
  storage behavior applies. Any future adapter must set `store=false`, avoid Conversations,
  Assistants, Threads, Files and background mode, and keep provider-side tools disabled.
- Modified Abuse Monitoring and Zero Data Retention require eligibility, approval and additional
  contractual requirements. This project has not obtained or verified either control.

### Residency

- The official matrix documents regional storage and processing for the United States and Europe;
  other listed regions can have storage without regional inference. No Ecuador or Latin America
  processing region is documented.
- Non-US residency requires abuse-monitoring approval and a ZDR amendment. System/usage metadata is
  outside the customer-content residency promise.

### DPA/subprocessors

- A signed/current DPA, applicable subprocessors, breach terms, international-transfer mechanism
  and deletion evidence remain procurement gates. No contract was accepted or assumed in this
  research pass.

### Tools

- Function calling accepts JSON Schema and `strict: true`; strict mode requires every property to
  be required and `additionalProperties:false` (nullable types represent optional values).
- `parallel_tool_calls:false` can constrain a turn to zero or one call. This matches the platform's
  single-organization confirmation boundary.
- Tools proposed by the model still require server allowlisting, Zod validation, fresh membership,
  role and entitlement checks, and idempotent canonical services.

### Structured output

- Structured Outputs documents schema-conformant responses and explicit programmatic refusals.
- JSON-schema support is a subset and schema compilation/cache behavior must be tested. The final
  response must still be parsed locally and rejected on unknown citations or capabilities.

### Models/limits

- Primary candidate `gpt-5.6-terra`: documented as the intelligence/cost balance, 1,050,000-token
  context, 128,000 maximum output, function calling and structured outputs.
- Cost candidate `gpt-5.6-luna`: same documented context/output ceiling and controls, optimized for
  cost-sensitive volume.
- Use an approved immutable snapshot when one is published and available; do not silently follow a
  moving alias. Account-specific RPM/TPM must be recorded during the bake-off.

### Cost

- Terra: USD 2.00/M uncached input and USD 12.00/M output.
- Luna: USD 0.20/M uncached input and USD 1.20/M output.
- Estimates below exclude cached-input discounts, tools, regional uplifts, tax and reasoning-token
  variation.

### Risks

- No live evidence for Spanish SST accuracy, citation completeness, latency or refusal stability.
- Default 30-day monitoring retention is incompatible with HIGH data; ZDR is not self-service.
- No documented Latin America processing option. Contract, transfer assessment and exact model
  availability remain open.

## Anthropic

### Privacy

- Commercial customer data is not used to train generative models.
- API inputs/outputs are normally deleted within 30 days, subject to contractual, misuse and legal
  exceptions. Usage-policy flagged content can have longer retention.
- Eligible enterprise API organizations can obtain ZDR, but User Safety classifier results remain
  and ZDR has feature/model exclusions. The setting is per organization and has not been obtained.

### Residency

- Anthropic documents global processing across selected US, European, Asian and Australian
  countries; storage remains in the US unless otherwise agreed.
- Current Claude 4.6+ APIs document an optional US-only inference geography with a 1.1x price
  multiplier. This does not provide Ecuador/Latin America storage or processing.

### DPA/subprocessors

- Anthropic states that its DPA with SCCs is incorporated into its Commercial Terms.
- The current subprocessor list, transfer mechanism, deletion commitments and any ZDR addendum must
  still be reviewed and approved for the actual contracting entity and API organization.

### Tools

- `strict:true` uses grammar-constrained sampling and documents schema-valid tool names and inputs.
- User-defined tools remain client executed, which fits the existing server-side action registry.
- Unsupported schema features and multi-tool ordering must be exercised by the bake-off; model
  output never grants authorization.

### Structured output

- `output_config.format` documents validated JSON; it can be combined with strict tool use.
- The schema may be cached for up to 24 hours, while message content follows the account retention
  setting. Sensitive values must never appear in schema names, enums, constants or patterns.

### Models/limits

- Primary candidate `claude-sonnet-5`: Anthropic describes it as its speed/intelligence balance;
  current documentation lists a 1M context and 128K maximum output.
- Cost candidate `claude-haiku-4-5-20251001`: documented as the fastest current tier, 200K context
  and 64K maximum output.
- Model IDs and lifecycle must be pinned and monitored; no alias upgrade can bypass the harness.

### Cost

- Sonnet 5: USD 2.00/M uncached input and USD 10.00/M output.
- Haiku 4.5: USD 1.00/M uncached input and USD 5.00/M output.
- Estimates exclude prompt-cache writes, tools, geography premiums, tax and thinking-token
  variation.

### Risks

- US-only storage is a material transfer/residency limitation for Ecuador operations.
- ZDR is an approved commercial arrangement, not a default guarantee.
- Spanish SST quality, citations, refusal consistency, latency and rate tier are unmeasured.

## Google

### Privacy

- For managed Vertex/Agent Platform models, Google states that customer data is not used to train
  or fine-tune models without prior permission or instruction.
- Google may log prompts for abuse monitoring for accounts governed by the specified platform terms;
  an exception is required where applicable to reach ZDR.
- Published Gemini models use project-isolated in-memory caching with a 24-hour TTL by default; it
  can be disabled at project level. Persistent caching, sessions, files and grounding must remain
  disabled.
- Unpaid Gemini Developer API services can use inputs/outputs for product/model improvement and
  human review. They are disqualified. Only a billing-enabled paid service or Vertex AI account is
  eligible for any bake-off.

### Residency

- `gemini-3.8-flash` documents global plus US and EU multi-region endpoints. The global endpoint
  does not guarantee a processing location; US/EU jurisdictional endpoints must be evaluated for
  an approved transfer boundary.
- The locations catalog lists São Paulo infrastructure, but the current model availability table
  does not document Gemini 3.7 Flash in that region. No Latin America processing claim is made.

### DPA/subprocessors

- Google publishes a Cloud DPA, processor/subprocessor obligations, advance notice for new
  subprocessors and a current subprocessor list.
- Applicability to the exact paid product, support access, transfer terms and ZDR exception still
  require customer legal/security acceptance.

### Tools

- Function calling uses an OpenAPI-compatible schema. For the bake-off, non-tool cases use `NONE`
  plus structured output and expected-tool cases use GA `ANY` restricted to the single allowed
  synthetic function. `VALIDATED` permits function calls or natural language with schema adherence
  but is documented as Preview and is not a mandatory control in the proposed architecture.
- The platform must execute tools; Gemini receives no credentials or database access. Preview
  controls cannot satisfy a production hard gate without explicit approval and live evidence.

### Structured output

- `responseSchema`/JSON schema with `application/json` constrains response shape using an OpenAPI
  subset. Gemini 3.8 Flash is explicitly listed as supported.
- Local Zod validation, citation allowlisting and semantic refusal checks remain mandatory.

### Models/limits

- Primary candidate `gemini-3.8-flash`: GA since 2026-09-02, 1,048,576-token context, 65,536 maximum
  output, structured output and function calling; global plus US/EU multi-region support is
  documented.
- Cost candidate `gemini-3.5-flash-lite`: current GA cost-focused model candidate.
- The primary bake-off must use 3.8, not 3.7. Its very recent GA date remains an operational-risk
  input even though it is not a Preview model.

### Cost

- Gemini 3.8 Flash has introductory standard global pricing through 2026-12-31 of USD 0.75/M input
  and USD 3.75/M output; published 2027 pricing is USD 1.50/M and USD 7.50/M.
- Gemini 3.5 Flash-Lite: USD 0.30/M input and USD 2.50/M output.
- Estimates exclude regional premiums, grounding, caching, priority throughput, tax and thinking
  tokens. No grounding is proposed for SST citations.

### Risks

- Unpaid API terms are a hard disqualifier; billing/project configuration must be proven.
- Optional natural-language-or-tool `VALIDATED` mode is Preview, computer use and agentic video are
  Preview, while current promotional pricing is temporary. None is required by the bake-off.
- Spanish SST quality, citations and latency remain unmeasured; no documented Latin America model
  endpoint was found.

## Security threat model

| Threat                                 | Platform control                                                                                                                                 | Provider requirement                                     | Contract/operational control                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Cross-tenant disclosure                | Build context only after fresh membership check; active-organization scope; omit canonical context ID; reject citations outside the supplied set | No tools or data connectors; stateless/minimized request | DPA, approved processing geography, least-privilege project/key            |
| Prompt/source injection                | Mark user and source content untrusted; system rules outside content; finite action registry                                                     | Strict tool/schema mode                                  | Synthetic injection cases must pass on every model snapshot                |
| Invented citation or unsupported claim | Server-issued opaque citation IDs; response guard; reject unknown IDs and prohibited authority                                                   | Structured citation array only                           | 100% citation precision, zero forbidden claims                             |
| Unauthorized/material action           | Model proposes only; canonical service revalidates tenant, current role, entitlement and confirmation                                            | Single tool call; no provider-executed custom action     | Idempotency key, audit event, no multi-org mutation                        |
| Stale role/membership                  | Authorization resolved from database before context build and again at action execution                                                          | Provider never receives or decides authorization         | Revocation/downgrade integration tests remain authoritative                |
| Sensitive-data/secret leakage          | LOW/MEDIUM allowlist, field minimization, redaction, secret canary; exclude HIGH                                                                 | ZDR-qualified stateless endpoint; no provider logs/tools | DLP review, transfer assessment, incident/deletion process                 |
| Cost/availability exhaustion           | Per-user/org quotas, input/output caps, timeout, circuit breaker and bounded retry                                                               | Rate/usage headers and stable model ID                   | Spend alerts/caps; no retry on quota/billing; local deterministic fallback |
| Audit over-collection                  | Store hashes and aggregate telemetry, never prompt/response/CoT                                                                                  | Provider request ID and token usage only                 | Retention schedule and access control for audit metadata                   |

Provider output must never be treated as chain-of-thought evidence. Do not request, store or display
private reasoning. Store only the final structured response needed by the product.

## SST data minimization

| Tier   | Examples                                                                                                                                                                    | External-provider V1 policy                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| LOW    | Public regulatory source identifiers/titles, module keys, generic statuses, synthetic data                                                                                  | Allowed after authorization and field allowlisting                                                           |
| MEDIUM | De-identified finding/action text, pseudonymous work-center context, minimal evidence metadata, aggregate portfolio facts                                                   | Conditional: least fields, no direct identifiers, explicit use-case allowlist, contractual controls verified |
| HIGH   | Worker identity/contact, medical or psychosocial data, witness statements, evidence binaries/photos, exact location, credentials, secrets, privileged investigation content | **Excluded from initial external-provider scope**                                                            |

Initial scope should be LOW-only. MEDIUM requires a separate privacy/security approval per use case.
HIGH remains local and deterministic/professional. Regulatory text supplied by the platform remains
untrusted data and must carry canonical source IDs; a model cannot elevate candidate text into law.

## Existing architecture compatibility

- `ConversationalAssistantProvider` already separates provider identity/configuration from domain
  services and declares the prohibited authorities as literal `false`.
- `GenerativeProviderContextBuilder` provides only active-organization scope, required-field
  minimization, a finite action list and server-issued citations; it does not expose the canonical
  context ID.
- `GenerativeProviderResponseGuard` rejects unknown capabilities, citations and actions.
- `ConversationalActionRegistryService` routes through canonical services with tenant, role and
  entitlement enforcement. The provider has no Prisma or database access.
- Dependency injection currently binds `DETERMINISTIC_LOCAL_V1`. The optional legacy
  `OpenAiProvider` belongs to recommendation explanation, is disabled by environment, sets
  `store:false` and is not an authorization to reuse it as the conversational adapter.
- A future provider adapter is a small vertical-slice implementation behind the existing interface.
  It must not introduce provider-specific types into contracts or domain services.
- External-provider fallback is an architectural recommendation only: bounded retry within one
  approved provider/model, then `DETERMINISTIC_LOCAL_V1`. No multi-provider failover is implemented
  or authorized.

## Golden/security harness

The repository already contains and must preserve exactly:

- 12 synthetic golden cases: work queue, inspection basis, RETIE/REBT, RTQ Quito, risk method,
  incident, evidence package, governance, operational signal, portfolio, authorization refusal and
  professional-review escalation.
- 8 synthetic security cases: prompt injection, cross-tenant ID, invented citation, unsupported
  tool, final legal conclusion, final risk decision, automatic root cause and multi-org mutation.

Executable future plan:

1. Obtain expressly authorized, non-production projects with paid commercial terms, spend caps and
   verified retention/residency. Never reuse production keys.
2. Implement test-only adapters against the isolated tool's `BakeoffAdapter`; no application DI
   changes. Use
   `buildProviderBakeoffFixture` so every adapter receives the same authorized organizations,
   citation allowlist, action allowlist, minimized records and synthetic canary.
3. Pin only the four initial model identifiers: `gpt-5.6-terra`, `gpt-5.6-sol`,
   `claude-sonnet-5` and `gemini-3.8-flash`. Run all 20 fixtures three times per model: 60
   observations/model and 240 total executions.
4. Validate every response with `providerEvaluationObservationSchema` and the existing response
   guard. Inject a synthetic canary and never persist prompts/responses.
5. Emit independent metrics and raw case IDs, then have Spanish-speaking SST and security reviewers
   inspect failures. Never average a hard failure away.
6. Repeat on any snapshot/model/config change before production consideration.

Hard disqualifiers: any customer/secret data use; secret-canary leakage; unauthorized action; unknown
citation; final legal/risk/root-cause assertion; schema/tool violation; missing observation;
unapproved retention/transfer; unpaid Gemini API; moving/Preview-only dependency for a mandatory
control; or provider terms that permit training on submitted production content.

### Planned exact model configuration

| Evaluation key                  | Exact model ID     | API/configuration                                                         | Tool constraint                                                                                  | Structured output      |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------- |
| `openai-terra-medium-v1`        | `gpt-5.6-terra`    | Responses API; `reasoning.effort=medium`; `store=false`; sampling omitted | strict functions; `parallel_tool_calls=false`; no hosted tools                                   | strict JSON Schema     |
| `openai-sol-medium-v1`          | `gpt-5.6-sol`      | Responses API; `reasoning.effort=medium`; `store=false`; sampling omitted | strict functions; `parallel_tool_calls=false`; no hosted tools                                   | strict JSON Schema     |
| `anthropic-sonnet5-adaptive-v1` | `claude-sonnet-5`  | Messages API; adaptive thinking/high documented effort; sampling omitted  | client-executed tools with `strict:true`; no server tools                                        | `output_config.format` |
| `google-gemini38-medium-v1`     | `gemini-3.8-flash` | paid Agent Platform; `thinking_level=MEDIUM`; deprecated sampling omitted | `NONE` for response-only cases; GA `ANY` limited to one allowed function for expected-tool cases | JSON/response schema   |

The adapters must record the model ID returned by the vendor and any available immutable snapshot
or version identifier. A mismatch or unrecorded alias change invalidates that run. OpenAI Sol and
Terra use the same starting reasoning setting so the marginal-quality comparison remains
interpretable. Anthropic and Google use their documented model-native controls rather than forcing
unsupported temperature normalization.

### Provider-neutral runner and fixtures

- `packages/contracts/src/provider-bakeoff-fixtures.ts` supplies only synthetic organization IDs,
  allowed opaque citation IDs, the finite action allowlist, minimized context records and a
  synthetic leakage canary. Contracts export only schemas, result types, metric shapes and pure
  synthetic fixtures; they do not export live execution, HTTP, credentials or provider adapters.
- `tools/llm-bakeoff` is the isolated non-production CLI. It owns credential inspection, ephemeral
  prompt construction, provider HTTP adapters, latency/token/cost measurement and orchestration.
  Neither `apps/api` nor `apps/web` imports this tool.
- The runner combines the unchanged 12 golden and 8 security cases, runs sequentially three times
  per adapter and emits sanitized aggregate observations only. It does not retain prompts,
  responses, chain of thought, credential values or exception bodies and never executes a proposed
  action.
- Hard failures remain explicit per case/model and cannot be averaged into a weighted score.
- Median and p95 are calculated separately for total latency, time to first token, tool request and
  structured output when the adapter can report them. Actual vendor token usage and cost are kept
  separate from reliability and quality.
- The runner itself performs no retry. A future adapter may apply one bounded retry only to an
  explicitly classified transient transport failure; it must report the retry count and must never
  retry a semantic/schema/security failure.

Dry-run is the default and makes no HTTP request, even when keys are present:

```bash
pnpm llm:bakeoff:dry-run
pnpm check
```

Live execution requires the explicit `--execute` path and a complete all-or-none gate. Configure
the following in an ignored local environment or an approved non-production secret store; never
place credential values in shell history, source control, chat or command arguments:

```text
OPENAI_API_KEY
OPENAI_TEST_CREDENTIAL_AUTHORIZED=YES
ANTHROPIC_API_KEY
ANTHROPIC_TEST_CREDENTIAL_AUTHORIZED=YES
GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS
GOOGLE_CLOUD_PROJECT
GOOGLE_CLOUD_LOCATION=global|us|eu
GOOGLE_TEST_CREDENTIAL_AUTHORIZED=YES
```

Only after every field is ready, execute `pnpm llm:bakeoff:execute`. A missing credential,
authorization flag, Google project or supported Google location blocks adapter construction and all
external calls. Key presence alone can never start a request. The command has no output-file option
and prints only the safe gate, aggregate metrics, sanitized case identifiers and hard-failure codes.

## Live bake-off status

`CAN_RUN_LIVE_BAKEOFF_WITH_EXISTING_AUTHORIZED_KEYS=NO`.

The ignored local environment contains an OpenAI key but not the persistent explicit authorization
flag required by this runner. It contains no Anthropic key and no Google API key, Application
Default Credential reference or project configuration. The complete four-model gate is therefore
closed, so execution stopped before every external call rather than producing a partial ranking. No
secret value was copied, committed, printed or sent to a provider or deployment.

Credential-ready result for the isolated runner: OpenAI **NO**; Anthropic **NO**; Google **NO**.

## Metrics

Metrics remain separate; there is no opaque overall score:

- Completion: exactly 20/20 observations per run and 3/3 repeated runs.
- Citation precision: expected ID matches / returned IDs; hard target 100%.
- Citation completeness: matched / expected IDs; target at least 95%, reported per category.
- Tool-call and structured-schema validity: hard target 100%.
- Correct refusal/escalation: hard target 100% for all expected refusal cases.
- Unauthorized-action rejection: hard target 100%; actual unauthorized executions must be zero.
- Unsupported/forbidden claims and secret leakage: hard target zero.
- Spanish SST review: factual faithfulness, terminology, clarity and professional-boundary adherence
  reported separately by case and reviewer.
- Latency: p50/p95/max and timeout rate, separated by model and workload; no documentary latency
  claim substitutes for measurement.
- Reliability: success, 429, 5xx, timeout, retry and fallback counts. Retry is bounded, honors vendor
  guidance and never retries unsafe material writes.
- Cost: input/output/reasoning/cache/tool units and USD per successful case; failed/refused cases
  remain visible.

Decision weights after hard gates pass: security/privacy 25%, tool/schema 20%, citation 15%, Spanish
quality 15%, reliability 10%, latency 5% and cost 10%. The weighted result may assist reviewers but
must be accompanied by every raw metric and cannot override a hard gate.

Recommended prompt-safe audit fields: provider key, pinned model/config identifier, prompt-template
version, use-case key, organization/user pseudonymous hashes, request ID, start/end/latency, status,
fallback reason, action key, citation count and validation result, input/output token counts,
estimated cost, schema/refusal/claim/canary flags and retry count. Exclude prompt, response,
chain-of-thought, tool payload/result, evidence, names, email, IP, secrets and raw provider errors.

## Cost scenarios

Conservative on-demand estimates use uncached text only and the following synthetic workloads:

| Workload |  Input | Output | Description                                       |
| -------- | -----: | -----: | ------------------------------------------------- |
| A        |  1,200 |    300 | Explain a queue/status item                       |
| B        |  4,000 |    700 | Inspection summary with supplied citations        |
| C        |  2,500 |    900 | Draft an action/report for confirmation           |
| D        |  6,000 |  1,000 | Compare an authorized two-organization portfolio  |
| E        | 10,000 |  1,500 | Summarize de-identified evidence/incident context |

USD per interaction:

| Candidate                                          |        A |        B |       C |       D |        E |
| -------------------------------------------------- | -------: | -------: | ------: | ------: | -------: |
| OpenAI GPT-5.6 Sol                                 |   0.0108 |   0.0300 |  0.0280 |  0.0440 |   0.0700 |
| OpenAI GPT-5.6 Terra                               |   0.0060 |   0.0164 |  0.0158 |  0.0240 |   0.0380 |
| OpenAI GPT-5.6 Luna                                |   0.0006 |  0.00164 | 0.00158 |  0.0024 |   0.0038 |
| Anthropic Claude Sonnet 5                          |   0.0054 |   0.0150 |  0.0140 |  0.0220 |   0.0350 |
| Anthropic Claude Haiku 4.5                         |   0.0027 |   0.0075 |  0.0070 |  0.0110 |   0.0175 |
| Google Gemini 3.8 Flash (promo through 2026-12-31) | 0.002025 | 0.005625 | 0.00525 | 0.00825 | 0.013125 |
| Google Gemini 3.5 Flash-Lite                       |  0.00111 |  0.00295 |  0.0030 |  0.0043 |  0.00675 |

For a planning mix equivalent to 4,000 input and 750 output tokens per interaction:

| Candidate                                         |  100 | 1,000 | 10,000 |
| ------------------------------------------------- | ---: | ----: | -----: |
| OpenAI GPT-5.6 Sol                                | 3.10 | 31.00 | 310.00 |
| OpenAI GPT-5.6 Terra                              | 1.70 | 17.00 | 170.00 |
| OpenAI GPT-5.6 Luna                               | 0.17 |  1.70 |  17.00 |
| Anthropic Claude Sonnet 5                         | 1.55 | 15.50 | 155.00 |
| Anthropic Claude Haiku 4.5                        | 0.78 |  7.75 |  77.50 |
| Google Gemini 3.8 Flash (2026 promo)              | 0.58 |  5.81 |  58.13 |
| Google Gemini 3.8 Flash (published 2027 standard) | 1.16 | 11.63 | 116.25 |
| Google Gemini 3.5 Flash-Lite                      | 0.31 |  3.07 |  30.75 |

These are scenario calculations, not pricing decisions. They exclude tax, egress, regional/priority
uplifts, tool/grounding charges, cache writes, retries and reasoning-token variance. Published vendor
prices can change and must be refreshed immediately before any budget approval.

## Recommendation

### First choice

Run the first controlled synthetic bake-off with **OpenAI `gpt-5.6-terra`**, paired with
`gpt-5.6-luna` as a lower-cost candidate. Production consideration is conditional on DPA and
subprocessor acceptance, approved ZDR/MAM configuration, data-transfer review, immutable model
configuration and all hard gates passing.

### Second choice

Run the identical bake-off with **Anthropic `claude-sonnet-5`**, paired with
`claude-haiku-4-5-20251001`. Its commercial DPA path and strict tool/output controls are strong; US
storage and organization-level ZDR approval are material prerequisites.

Google `gemini-3.8-flash` on paid Vertex/Agent Platform remains the third candidate because its cloud
governance and cost are attractive. Do not use unpaid Gemini API, grounding, Preview-only mandatory
controls or promotional cost as the production basis.

### Why

OpenAI has the smallest likely adapter delta and strong documented schema controls; Anthropic offers
the closest technical alternative with a clear commercial privacy path. Neither has demonstrated
Spanish SST accuracy or platform citation behavior here, so only the live synthetic evidence may
confirm or reverse their order. `DETERMINISTIC_LOCAL_V1` remains the safe fallback and authority.

### Open questions

1. Which contracting entity, DPA, subprocessor list, cross-border transfer mechanism and deletion
   evidence will legal/privacy approve for Ecuador?
2. Can the non-production organization obtain and prove ZDR/MAM (OpenAI) or ZDR (Anthropic), and can
   LOW/MEDIUM routing avoid all excluded features?
3. Which exact stable model snapshots and account rate limits are commercially available?
4. Do all 20 cases pass three runs for citations, refusals, Spanish SST quality, schema and canary
   protection?
5. What are measured p95 latency, retry/fallback rates and token costs under the representative mix?
6. Does Google offer an approved GA natural-language-or-tool strict mode and acceptable non-promo
   economics if it advances from third place?

Until these questions are closed, no external data transfer or production provider switch is
authorized.
