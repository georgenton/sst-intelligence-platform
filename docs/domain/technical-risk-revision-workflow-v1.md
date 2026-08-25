# Technical Risk revision workflow V1

Assessment A is completed and calculated once. Its first professional review is terminal for that
record. NEEDS_REVISION keeps A as COMPLETED, records reviewer/time/comment and rejects any later
approval of unchanged A.

“Atender ajustes” creates assessment B. The database uniqueness constraint permits one correction
per source, so concurrent attempts have one winner. B stores `revisedFromAssessmentId`, the same
organization/location, exact `methodVersionId`, method identity, calculation key and immutable
method snapshot. Answers are copied as editable starting values; evidence is not copied. The prior
review comment is presented as “Cambios solicitados”. B follows the normal start, edit, complete and
review lifecycle and may itself receive NEEDS_REVISION.

Self-review is audited. HIGH/CRITICAL self-approval requires an explicit acknowledgement and a
bounded explanatory comment. The deterministic result never changes during review.

The generic exact-version foreign key is the future migration seam: a later Risk Methodology
runtime can map it to a generalized method version without redesigning revision provenance.
