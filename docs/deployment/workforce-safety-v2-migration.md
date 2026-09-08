# Workforce Safety Product Refinement V2 — migration notes

Status: production closed through PR #43 on 2026-09-08.

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

## Production closure

The audited PR HEAD `7f8f222e3da030fd0b0bea8cf7bad583d953a071` was integrated by merge commit
`f834920664c7bcb3ade8ff07933e870e7809c13d`. Main Quality Gate 34259930387 passed in attempt 1.
Railway deployment `d62d7682-9626-4e4d-9c4e-edbbfef4189a` ran the production release command,
found 32 migrations, applied `20260907232300_workforce_safety_refinement_v2`, completed reference
sync, started Nest and returned `/api/v1/health` HTTP 200.

The migration contains additive tables, nullable columns, indexes and referential constraints. It
contains no data update, delete, invented backfill, destructive drop or historical conversion.
Production regulatory parity after release is 15 sources, 25 source versions, 1112 units,
893 ARTICLE units, 5 candidate Requirements, 5 candidate RuleDrafts and zero real published
RuleVersions.
