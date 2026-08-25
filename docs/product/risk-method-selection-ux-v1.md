# Risk method selection UX V1 — deferred runtime design

## Entry point

Future navigation:

`Configuración SST → Metodologías de evaluación`

The surface is read-only first. It lists historical 5×5, guided 5×5 and GTC45 candidate with
technical provenance and review state.

## Method cards

Each card shows:

- method name and version;
- what it evaluates;
- technical source;
- jurisdiction/context without legal endorsement;
- technical/legal review status;
- DEMO/candidate warning.

Primary action: `Usar metodología`.

Secondary action: `Ver metodología y fuentes`.

Provider keys are never product copy. The list is introduced as “Metodologías disponibles para
esta evaluación”, not “La ley exige GTC45”.

## Guided pattern

Each scored choice follows:

1. Criterion and short human explanation.
2. “¿Por qué elegir este nivel?” with finite optional cues.
3. “¿Qué observaste?” with required professional rationale where the method requires it.
4. Technical disclosure with exact method, version and source.

No screen shows unexplained bare numeric choices.

## GTC45 compact flow

Proposed mobile-capable steps:

1. Context.
2. Hazard.
3. Existing controls.
4. Deficiency.
5. Exposure.
6. Probability result.
7. Consequence.
8. Risk/intervention.
9. Acceptability/context.
10. Proposed controls.

The frontend may display a labeled preview later, but the server/domain provider remains
authoritative. No LLM selects ND, NE, NC, probability, consequence, acceptance or controls.

## Inspection integration boundary

Only new evaluations can select a method. Selection stores the exact version UUID before findings
are valued. Existing findings remain `DEMO_5X5@1.0.0`. Initial and residual use the same version.

Inspections and Technical Risk may share provider primitives, but do not share aggregate lifecycle.
The GTC45 context is richer than the current finding fields and may require a dedicated child
valuation snapshot rather than widening every Inspection column.

## Legal requirement link

The field supports `NO_LINK` or `CANDIDATE_REFERENCE` until a reviewed requirement exists.
Production currently has zero real reviewed requirements. The UI must not fabricate one.

## Current status

This is a design contract only. Product Walkthrough Hardening V1 must merge before production UI or
runtime changes begin.
