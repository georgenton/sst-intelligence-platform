# Adaptive Fact Catalog V1

`AdaptiveFactDefinition.factKey` is global, unique and immutable. A published Fact Version freezes
the value type, plain-Spanish question, help, unknown policy, choices, validation and collection
mode. Wording or contract changes create a new version; historical sessions retain the old version.

V1 types are Boolean, integer, decimal, bounded short text, single choice and multi-choice. Unknown
means absence, never false, zero, empty text or null. Collection modes distinguish derived-only,
user-askable, derived-or-user and context-only facts.

The DEMO catalog contains 17 facts across organization profile, workforce, work-center context,
infrastructure, operations, high-risk work, contractors, activity and strategic priority. It stores
no names, IDs, diagnoses, clinical histories, medical records or individual health data. Strategic
priorities are context-only and are rejected if referenced by applicability/depth rules.
