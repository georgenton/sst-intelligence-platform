# Inspection Intelligence Drafting Spike V0

Status: staging/control-only editorial experiment. Production remains deterministic local.

## Boundary

The server retrieves at most 12 currently verified Ecuadorian `RegulatoryUnit` records from stored
official artifacts using bounded resource/keyword matching. It sends only public structured
metadata: opaque unit ID, identifier, locator and heading, plus the synthetic resource identity.
It sends no worker data, incident narrative, health or psychosocial data, evidence binary,
credential, customer document or arbitrary conversation text.

The implementation reuses the existing OpenAI controlled-staging policy, exact cohort, organization
kill switch and injectable Responses transport. It requires staging, provider OPENAI, model
`gpt-5.6-terra`, explicit global enablement, configured server secret and exact organization/user
cohort. Production configuration cannot satisfy this boundary.

## Provider contract

The request uses strict JSON schema, `store=false`, no tools and `tool_choice=none`. Output may only
contain jurisdiction, exact resource ID, one to twelve candidate criteria, bounded rationale,
allowlisted RegulatoryUnit IDs/locators and action `CREATE_EDITORIAL_PROPOSAL`.

The server rejects invalid schema, resource mismatch, jurisdiction mismatch, invented/out-of-list
unit IDs, locator mismatch and unknown actions. Provider timeout/error and disabled policy create no
proposal. Source prompt injection cannot authorize a tool because the provider receives an empty
tool registry and the server validates the action literal.

## Persistence and publication

Validated output is tenant-private `InspectionDraftProposal`. Content is immutable; only the finite
editorial transitions are permitted. Approval records review metadata and explicitly leaves
`activationAllowed=false`. It creates zero mappings, standards, Requirements, Rules or legal/risk
decisions.

CI uses fake transport and deterministic contract fixtures. A live call is optional and may run
only under separately authorized staging configuration with synthetic/public inputs.
