# GTC45 2010 provider specification — candidate

## Status and source

- Method: `GTC45_2010@1.0.0`.
- Provider proposal: `GTC45_2010_CANONICAL@1.0.0`.
- State: CANDIDATE / DEMO-REVIEW.
- Regulatory: false.
- Technical review: PENDING.
- Legal review: PENDING.
- Source: user-provided GTC 45, 2010-12-15, Primera actualización.
- SHA-256: `99a387729fd3a73a93dbc06a44ac5be0a7eedd8999f26b709c0cbf794f823973`.

The source prohibits reproduction. The repository stores no PDF and no full source text. This
specification contains only numeric constants, short labels, paraphrased guidance and provenance.

## Canonical finite inputs

### Deficiency (ND)

| Selection |               ND | Handling                          |
| --------- | ---------------: | --------------------------------- |
| Very high |               10 | Normal calculation                |
| High      |                6 | Normal calculation                |
| Medium    |                2 | Normal calculation                |
| Low       | No numeric value | Direct risk/intervention level IV |

LOW must never be encoded as ND=0. It produces no numeric NP or NR in this specification.

### Exposure (NE)

- 4 Continuous: sustained or repeated exposure during the workday.
- 3 Frequent: exposure several times during the workday.
- 2 Occasional: exposure at some point for a short period.
- 1 Sporadic: eventual exposure.

### Probability

For numeric ND, `NP = ND × NE`.

- Very high: 24–40.
- High: 10–20.
- Medium: 6–8.
- Low: 2–4.

Values in gaps are invalid for the finite provider. Boundary tests cover both ends of every band.

### Consequence (NC)

- 100 Mortal/catastrophic.
- 60 Very serious, irreversible harm.
- 25 Serious, temporary incapacity.
- 10 Minor, without incapacity.

Human consequence is primary. The provider does not copy corporate operational or financial
thresholds.

### Risk and intervention

For numeric ND, `NR = NP × NC`.

- I: 600–4000.
- II: 150–500.
- III: 40–120.
- IV: 20.

The provider accepts only results reachable from finite ND, NE and NC options. It rejects values in
the numeric gaps rather than guessing a level.

## Acceptability remains separate

The guide shows an example framework, but the organization must establish acceptance criteria with
applicable context and interested-party input. Phase 1 therefore returns:

- `acceptability=null`;
- `acceptabilityPolicy=ORGANIZATION_CRITERIA_REQUIRED`.

No Ecuadorian acceptance rule is inferred.

## Context proposal

Future assessment input can retain process, place, activity, task, routine/non-routine, hazard,
possible effects, source/medium/individual controls, people exposed, worst consequence, optional
reviewed requirement reference and proposed controls. Only ND, NE and NC drive the canonical V1
calculation.

Existing controls by source, medium and individual remain control-location categories. They are not
root-cause findings.

## Control proposals

The future surface may structure human-selected proposals as elimination, substitution,
engineering, administrative/warning/signage and PPE. The provider never chooses a control.

## Residual

Residual revaluation uses the same exact method-version UUID. It preserves initial inputs/output,
control changes and residual inputs/output. No record is overwritten.

## Phase 1 implementation boundary

`calculateGtc45Specification` is a pure specification oracle used by fixtures and tests. It is not
registered in NestJS, seeded, exposed by API or selectable in production.
