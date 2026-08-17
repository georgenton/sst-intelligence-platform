# Depth Resolver proposal

## Status

Design hypothesis for PR #23 only. PR #20 does not implement this formula, a resolver, persistence,
configuration proposals or activation.

## Future hypothesis

```text
requiredDepth = max(
  applicabilityMinimum,
  operationalCriticality,
  selectedStandard,
  systemicSignals
)
```

The comparison requires an explicitly reviewed ordering and source for every input. `max` expresses a
safety floor, not current production behavior.

Candidate levels:

1. `LEVEL_1_VISIBLE_OPERATIONAL`: order and cleaning, access, signage, evident conditions, simple
   controls and immediate correction.
2. `LEVEL_2_TECHNICAL_SOURCE_BASED`: technical criteria, recognized source or method, measurements
   where applicable, structured evidence and competent technical participation.
3. `LEVEL_3_SYSTEMIC_CHANGE_MANAGEMENT`: recurrence, maintenance, competence and training,
   contractors, equipment/process changes, systemic analysis, Management of Change and effectiveness
   follow-up.

## Invariants

- Current state cannot lower required depth.
- Desired depth cannot lower the calculated minimum.
- Commercial plan and budget cannot lower required depth.
- Missing facts remain missing and may require information or expert review.
- A proposal is not active configuration; activation and MOC belong to PR #24.
