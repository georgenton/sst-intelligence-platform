# Workforce Safety Product Refinement V2 — migration notes

Status: candidate migration; external review required before merge.

Migration: `20260907232300_workforce_safety_refinement_v2`.

## Safety properties

- Additive enums and tables introduce Position/risk/EPP requirements, Incident–EPP links, Safety
  Observations, Training Needs and Training Audiences.
- Existing Worker, Incident, Incident Investigation, EPP, Training Definition and Training Session
  tables receive nullable fields only.
- There is no destructive drop, rename, historical status rewrite or invented backfill.
- Historical Incident location/priority and investigation method remain null when unknown.
- Historical Workers keep their free-text job title; Position and Work Area remain optional.
- Historical EPP issues and Training completions are not recalculated.
- No Plant table, commercial feature key, PlanFeature assignment, stock/ERP table or external-AI
  configuration is introduced.
- The post-audit integrity repairs require no additional migration or backfill; they validate current
  references transactionally and preserve every existing nullable historical value.

## Required release gates

Run Prisma validate/generate, deploy against a fresh database, deploy as an upgrade from current
main, seed, repeated reference synchronization, complete integration, build, runtime-image test and
Playwright with one worker and zero retries. Regulatory corpus counts and GTC45/Inspection history
must remain unchanged.
