# Anita validation round 2 — regulatory pilot

Generate the ignored review bundle with `pnpm regulatory:review-bundle`. It contains eleven files
under `.artifacts/regulatory-pilot/mdt-2024-196-v1/`.

The review is blind-first. Phase A shows the official source, article locator and simple factual
scenario, then leaves a blank professional response. Only after an explicit separator does Phase B
show the system's candidate interpretation. Primary pages avoid internal keys, UUIDs, hashes,
database vocabulary and engine truth values; technical identifiers live only in the appendix.

For each candidate Anita is asked whether the interpretation matches, lacks a condition, depends
on another norm, uses an organization-level worker count, can vary by work center, needs particular
evidence or could cause a dangerous error. Evidence answers remain discovery inputs and are not
automated in this increment. Technical expert and legal review decisions remain independently
`PENDING`; every candidate is non-publishable.
