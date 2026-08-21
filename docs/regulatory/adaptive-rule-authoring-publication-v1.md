# Adaptive Rule Authoring and Publication V1

Rule identity and editable content are separated. `AdaptiveRuleDraft` supports DRAFT, technical
review, legal review, ready-to-publish, published and rejected states. Publication uses the internal
`AdaptivePublicationService`; there is no public authoring endpoint. It validates a
`READY_TO_PUBLISH` draft, its schema/version, boundary and provenance, builds the version and exact
requirement joins, seals the aggregate, records `sourceDraftId` and moves the draft to terminal
`PUBLISHED`. Later change creates another draft/version and may explicitly supersede the old
version. Published drafts and both old and new versions remain independently immutable and
queryable.

For `regulatory=true`, publication requires schema validation, completed reviews and one or more
exact Regulatory Requirements whose status is `APPROVED_FOR_RULE_DRAFTING` at publication time.
Zero requirements and DRAFT, technical-review, legal-review, rejected or superseded requirements
cannot seal a new rule. Relationship types are primary, supporting or related; no legal precedence
is inferred. A later requirement supersession does not rewrite a previously sealed historical rule.
The database repeats this gate at the sealing transition, so direct creation can at most leave an
unsealed, unusable build row. V1 publishes no real regulatory rule.

A DEMO rule may be unlinked only with `isDemo=true`, `regulatory=false` and a clear disclaimer. Rule
authoring/publication has no public runtime API. DEMO references are provisioned idempotently: an
exact existing version is a no-op, while same-version semantic drift in question, target, rule,
group or pack content fails with `PUBLISHED_VERSION_DRIFT` rather than overwriting history.

Group publication builds exact memberships from sealed Rule Versions and then seals the Group
aggregate. Pack publication validates complete Fact, Target, Rule and Group memberships, transitive
Group membership and a uniform DEMO/regulatory boundary before sealing. Database triggers freeze
each sealed parent and all of its joins.
