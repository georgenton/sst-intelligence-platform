# Gap Engine proposal

## Status

Provisional design documentation for PR #22. PR #20 does not implement a Gap Assessment, persistence,
API, rule engine or UI.

## Future composition

```text
Applicability Assessment
+ Current-State Baseline
= Gap Assessment
```

The inputs must be identified immutable versions. Re-running against a newer baseline creates a new
gap result and never rewrites the applicability or earlier result.

Candidate categorical outcomes:

- `REQUIRED_MISSING`
- `PARTIAL_GAP`
- `PRESENT_UNVERIFIED`
- `EVIDENCE_PROVIDED`
- `EVIDENCE_VERIFIED`
- `INFORMATION_REQUIRED`
- `EXPERT_REVIEW_REQUIRED`

These names are hypotheses for expert validation, not production contracts. The mapping must remain
deterministic and explainable. `NEEDS_INFORMATION` and `NEEDS_EXPERT_REVIEW` must not be disguised as
non-compliance.

## Invariants

- Do not define one overall compliance percentage.
- Evidence presence and evidence verification are different.
- Current implementation cannot retroactively change applicability.
- No gap is closed solely by a self-declaration.
- Organization and work-center scope must not be collapsed silently.
- Legal and technical review remain human-controlled boundaries.
