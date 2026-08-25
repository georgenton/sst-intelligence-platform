# Risk Methodology hardening compatibility V1

PR #25 Phase 1 was inspected read-only at
`376bc86fd5e5e071c6db7078aeea65e12f7bf906`. No contracts, manifests, providers, persistence or
runtime code were copied.

## Integration seams

- `RiskMethodPresentation` exposes human name, version, demo/review label, optional context and
  technical identity without persistence.
- `inspectionRiskMethodInputRenderers` is a finite registry. Only the existing DEMO_5X5 renderer is
  registered. No dynamic schema evaluation, GTC45 or GUIDED_5X5 renderer exists here.
- “Detalles técnicos” can later display methodology, exact version, technical source, expert
  guidance, regulatory context and review status without changing primary product copy.
- Technical Risk correction provenance already binds the exact generic method-version reference
  used by the source assessment.
- Inspection systemic review snapshots method identity/version per finding and perform no
  cross-method arithmetic.

## Invariants

Initial valuation and residual revaluation use the same exact method version. A residual flow must
never resolve “latest” or switch methods silently. Regulation/source says why/what context applies;
methodology says how risk is evaluated; expert guidance helps the professional apply the method and
does not change canonical scoring.

The current historical DEMO_5X5 and Technical Risk calculations are unchanged. RiskMethod schema,
method-source persistence, expert-guidance runtime and all Phase 1 candidate methods remain deferred
until PR #25 is rebased over this hardening baseline.
