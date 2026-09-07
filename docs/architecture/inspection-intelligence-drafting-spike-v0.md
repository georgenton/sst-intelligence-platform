# Inspection Intelligence Drafting Spike V0

Status: staging/control-only editorial experiment. Production remains deterministic local.

## Boundary

The server retrieves at most 12 currently verified Ecuadorian `RegulatoryUnit` records from stored
official artifacts using bounded resource/keyword matching. The allowlist sent to the provider
contains each selected unit's opaque ID, source/version IDs, identifier, locator, heading and exact
stored `officialText`, plus public global synthetic resource metadata. Drafting is unavailable for
organization-private resource taxonomy entries, so their free text cannot cross this boundary. It
sends no worker, incident, PPE, training, health or psychosocial data, evidence, credential,
customer document or arbitrary conversation text.

The context policy prefers fewer complete units to altered legal text. Each unit is limited to
16,000 characters and the total official-text budget is 32,000 characters in deterministic source
and ordinal order. Selection stops before exceeding the total; no unit is truncated. An individual
oversized unit rejects the request with `INSPECTION_DRAFTING_OFFICIAL_UNIT_TOO_LARGE`, and an empty
usable selection rejects it with `INSPECTION_DRAFTING_NO_USABLE_OFFICIAL_CONTEXT`.

The implementation reuses the existing OpenAI controlled-staging policy, exact cohort, organization
kill switch and injectable Responses transport. It requires staging, provider OPENAI, model
`gpt-5.6-terra`, explicit global enablement, configured server secret and exact organization/user
cohort. Production configuration cannot satisfy this boundary.

## Provider contract

The request uses strict JSON schema, `store=false`, no tools and `tool_choice=none`. Official text is
explicitly treated as untrusted data rather than instructions. Output may only contain
jurisdiction, exact resource ID, one to twelve candidate criteria, bounded rationale, allowlisted
RegulatoryUnit IDs/locators and action `CREATE_EDITORIAL_PROPOSAL`.

The server rejects invalid schema, resource mismatch, jurisdiction mismatch, invented/out-of-list
unit IDs, locator mismatch and unknown actions. Provider timeout/error and disabled policy create no
proposal. Source prompt injection cannot authorize a tool because the provider receives an empty
tool registry and the server validates the action literal.

## Persistence and publication

Validated output is tenant-private `InspectionDraftProposal`. It stores source unit IDs, citations,
proposed criteria and the validation/review state, never a second copy of `officialText`. Audit
metadata contains bounded identifiers/counts and never raw prompts, responses or official text.
Content is immutable; only the finite editorial transitions are permitted. Approval records review
metadata and explicitly leaves `activationAllowed=false`. It creates zero mappings, standards,
Requirements, Rules or legal/risk decisions.

CI uses fake transport and deterministic contract fixtures. A live call is optional and may run
only under separately authorized staging configuration with synthetic/public inputs.
