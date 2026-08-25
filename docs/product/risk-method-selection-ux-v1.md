# Risk method selection UX V1

## Library

`Configuración SST → Metodologías` is an authenticated read-only catalog. Cards show human name,
exact version, candidate/demo state, purpose, technical source metadata and a separate regulatory
context. Internal provider keys and hashes appear only in technical disclosure.

## New inspection

A normal new-inspection form requires an explicit radio-card selection. There is no Ecuador-based
GTC45 default. The selected method is fixed for that inspection's findings and their residual
valuation. The UI links to method/source details before creation.

## Method renderers

The finite renderer registry contains only DEMO 5×5, guided 5×5 and GTC45. It executes no database
React, `eval` or generic formula engine.

- DEMO preserves the current 1–5 scales.
- Guided 5×5 shows human labels, meanings, accessible “¿Por qué?” cues and required rationale.
- GTC45 collects existing-control locations, ND, NE, NC, candidate guidance and rationale. The
  server returns NP/NR/intervention trace; LOW is disclosed as a special IV path.

Results always show method and version. GTC45 shows intervention level rather than coercing its raw
number into a 5×5 severity category. Residual forms reuse the same renderer identity and version.

Cards and fieldsets use native controls, labelled groups, keyboard operation, semantic status text
and a one-column layout below 760px. Theme styles use semantic tokens for Operativo, Sereno, Noche
and Alto Contraste.

## Deferred

Organization default, allow-list policy, program-level methodology and mixed-method program rules
remain future work pending expert decisions.
