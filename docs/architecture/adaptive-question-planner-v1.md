# Adaptive Question Planner V1

The planner derives questions from missing facts that can still affect an unresolved group or rule.
It is not a fixed questionnaire.

## Relevance

- `ALL(FALSE, MISSING)` is already false, so the missing fact is not asked.
- `ALL(TRUE, MISSING)` is unresolved, so it is asked.
- `ANY(TRUE, MISSING)` is already true, so it is not asked.
- `ANY(FALSE, MISSING)` is unresolved, so it is asked.

Missing is never converted to false. Derived-only and context-only facts are not emitted as runtime
business questions. Multiple unresolved rules needing the same fact in the same scope produce one
question with every related rule/target reference.

Ordering is stable: group priority, scope order, fact priority and fact key. Limits cap expression
depth, predicates, rules, groups, scopes, facts and generated questions. Historical question text,
choices and rationale live on each immutable evaluation run.
