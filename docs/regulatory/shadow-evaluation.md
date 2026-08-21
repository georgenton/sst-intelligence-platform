# Regulatory candidate shadow evaluation

`pnpm validate:regulatory-pilot` validates the committed manifest and constructs an in-memory,
non-DEMO regulatory candidate pack. It uses the same pure adaptive evaluator as published packs;
there is no second evaluator, runtime API, sealed RuleVersion or PackVersion.

Every human-facing result is wrapped by:

> Interpretación regulatoria candidata. Requiere revisión profesional y no constituye todavía una regla publicada del sistema.

The engine-owned `whyAsked` remains generic regulatory rationale and does not claim publication or
candidate approval. The validation matrix covers counts 1, 10, 11 and 80, invalid zero, missing
count, services (6), chemical/pharma (80) and construction (18). It also attacks the publication
gate while requirements remain unapproved.

The construction scenario receives only the general Article 19 candidate layer. Sector-specific
obligations are explicitly incomplete and require independent official sources.
