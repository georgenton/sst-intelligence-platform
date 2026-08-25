# Guided 5×5 V1 — candidate specification

## Identity

`GUIDED_5X5@1.0.0` is a new candidate. It is not an alias or migration of historical
`DEMO_5X5@1.0.0`.

- isDemo: true;
- regulatory: false;
- technical review: PENDING;
- legal review: PENDING;
- method kind: `INSPECTION_FINDING_RISK`.

## Human-guided selection

Probability and severity remain finite 1–5 values, but every value has a human label, short meaning
and optional decision cues. A professional must enter `selectionRationale`; a separate additional
note is optional. No LLM selects or changes the score.

Probability guidance considers, without making every cue mandatory:

- occurrence history;
- exposure/frequency;
- control coverage and independence;
- known failures;
- reliance on human behavior.

The cues help explain a selection. They do not calculate the selected value.

## Severity dimensions

The future domain can support HUMAN, OPERATIONAL and FINANCIAL dimensions. The SST primary V1
contract evaluates HUMAN impact only. It contains no company name or USD threshold from the
corporate reference workbook. Organization-defined financial thresholds require a future,
tenant-scoped version.

## Candidate scoring

The Phase 1 specification oracle uses the existing DEMO score bands for review only:

- 1–4 LOW;
- 5–9 MODERATE;
- 10–16 HIGH;
- 17–25 CRITICAL.

Sharing candidate bands does not make GUIDED_5X5 the same method. It has a different identity,
input contract, rationale requirement, criteria metadata and review lifecycle.

Tests cover 1×1, 1×5, 5×1, 5×5 and every band edge. Empty/oversized rationales and unknown cue keys
are rejected.

## Generated explanation

The future UI can generate deterministic text from the selected level and checked cue labels, for
example “Seleccionaste Probable porque…”. This text is structured from finite definitions; it is
not AI output and never overrides the professional rationale.

## Runtime boundary

No provider is registered, no database version is seeded and no production UI is changed in Phase
1 because Product Walkthrough Hardening V1 is absent from `origin/main`.
