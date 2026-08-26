# Guided 5×5 V1 — candidate runtime

`GUIDED_5X5@1.0.0` is distinct from historical `DEMO_5X5@1.0.0`. It is a DEMO candidate with
technical and legal review pending.

The professional selects probability 1–5 and human severity 1–5 from labelled meanings. Optional
decision cues cover occurrence, exposure, controls, known failures, redundancy and human
dependency. Cues guide judgment; they do not select a value. A bounded professional rationale is
required and persisted, with an optional note.

The server calculates `P × S` and applies the reviewed candidate bands 1–4 LOW, 5–9 MODERATE,
10–16 HIGH and 17–25 CRITICAL. The result contains stable, deterministic criterion labels and cue
keys. React does not perform authoritative arithmetic and no LLM participates.

The SST primary runtime uses HUMAN severity. OPERATIONAL and FINANCIAL remain future contextual
candidates until tenant-scoped configuration exists; no corporate wording or USD threshold is a
default.

Residual valuation presents the same guided criteria, requires a new post-control rationale and is
bound to the same UUID. Initial rationale/output remain immutable history.
