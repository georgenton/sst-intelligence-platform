# Adaptive Rule Authoring and Publication V1

Rule identity and editable content are separated. `AdaptiveRuleDraft` supports DRAFT, technical
review, legal review, ready-to-publish and rejected states. Publication creates an immutable
`AdaptiveRuleVersion`; later change creates another draft/version and may explicitly supersede the
old version.

For `regulatory=true`, publication requires schema validation, completed reviews, published fact and
target versions and one or more exact Regulatory Requirements whose status is
`APPROVED_FOR_RULE_DRAFTING`. Relationship types are primary, supporting or related; no legal
precedence is inferred. V1 publishes no real rule.

A DEMO rule may be unlinked only with `isDemo=true`, `regulatory=false` and a clear disclaimer. Rule
authoring/publication has no public runtime API; DEMO references are provisioned idempotently.
