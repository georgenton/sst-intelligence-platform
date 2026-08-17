# Expert Applicability Validation Protocol V1

## Purpose

This protocol prepares structured review with an SST specialist. It validates whether the synthetic
scenario set exposes the right questions and whether future profiles need more detail. It does not ask
the specialist to approve the `DEMO_APPLICABILITY` pack as Ecuador law.

Engine expectation and expert expectation are separate. A scenario can pass its deterministic engine
expectation and still disagree with professional judgment; that disagreement is product evidence.

## Before each review

1. Run `pnpm validate:sst-scenarios --scenario <SCENARIO_ID>`.
2. Confirm the report says `DEMO_APPLICABILITY@1.0.0`, `regulatory=false` and synthetic data.
3. Present `ENGINE_INPUT_V1` separately from `FUTURE_CONTEXT_NOT_EVALUATED`.
4. Do not reveal an expected expert answer or describe a DEMO outcome as legally correct.

## Expert record per scenario

Record all fields explicitly:

- expected applicability;
- missing information;
- variables that should be added;
- organization versus work-center scope;
- expected depth;
- questions about current state;
- recommended next step;
- confidence (`LOW`, `MEDIUM`, `HIGH`);
- comments;
- agreement with engine outcome (`AGREES`, `PARTIALLY_AGREES`, `DISAGREES`,
  `NEEDS_MORE_INFORMATION`).

Review status begins as `PENDING_EXPERT_REVIEW` and changes only from an actual recorded review.
Neither a transcript nor a generated summary constitutes approval.
Once a scenario expectation has been reviewed, later changes require an explicit `scenarioVersion`
update; historical reviewed expectations must never be silently rewritten.

## Discussion prompts

- Which missing fact could change professional judgment?
- Is the fact organization-wide or different by work center?
- Which economic activity, facility, hazard or contractor context is being collapsed by Profile V1?
- What source or competent participation is needed before a technical conclusion?
- Is Level 1, 2 or 3 the minimum defensible inspection depth, and why?
- What declared control and evidence should be requested without treating it as verified?

## Private and pseudonymized cases

Real cases are not committed by default. Store local input under the gitignored
`validation/private-scenarios/` directory and use JSON only. Remove real company name when
unnecessary, RUC, personal names, emails, phone numbers, exact addresses, customer documents,
credentials, medical information and employee-level data.

Use `scenarioKind=PSEUDONYMIZED_EXPERT_CASE`, `synthetic=false` and an `EC_EXPERT_*` identifier.
The runner applies the same strict schema, never evaluates JavaScript, never calls AI, never uploads
the case and writes pseudonymized-case reports only to the operating-system temporary directory.
Automated pattern checks are a guardrail, not a complete DLP system; a human privacy review remains
required. The scanner is deterministic and best-effort: successful validation does not guarantee
anonymization and is not a privacy certification. A human must review every expert case before use,
and unnecessary personal, customer or person-level medical information must never be included.

## Closure

Summarize disagreements and rank Profile V2 discoveries by number of scenarios requiring the field,
not by presumed legal importance. Legal source review is a separate approval gate.
