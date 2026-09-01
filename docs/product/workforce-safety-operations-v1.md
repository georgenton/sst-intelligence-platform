# Workforce Safety Operations Program V1

Status: implementation authorized; external review required before merge.

## Goal

Deliver one operational workforce surface that links Worker Registry, Incident Management, EPP and
Training/Competency without turning Workers into SaaS Users. The Worker Workspace is the stable
human context; each source domain retains its own lifecycle and the Operational Work Queue projects
only actionable source state.

## Program blocks

1. Worker Registry and Worker Workspace foundation.
2. Incident lifecycle, investigation, contributing factors and actions.
3. EPP catalog, requirements, issue, acknowledgement, condition and replacement.
4. Training definitions, competency requirements, sessions, attendance, completion and renewal.
5. Worker 360 summaries, shared Work Queue and Command Center integration.

## Commercial policy

Worker Registry is core and Workers do not consume member seats. `module.incidents`, `module.ppe`
and `module.training` may exist as deterministic global FeatureDefinitions for bounded Demo/Preview
access. They receive zero `PlanFeature` assignments; packaging and pricing remain pending product
decisions.

## Safety boundary

V1 adds no medical/clinical records, national ID, salary, automatic root cause, incident legal
classification, statutory deadline, mandatory PPE standard, mandatory training certification,
worker safety score, AI decision or new published regulatory Rule. Regulatory, risk, Inspection
Standard and Work Permit history remain immutable.

## Release contract

Non-destructive migrations, current-membership authorization, tenant isolation, optimistic or
transactional concurrency, audit actor/timestamp, fresh/upgrade migration coverage, repeated
reference sync, full integration/build/Docker runtime and Playwright with one worker/zero retries are
required. The feature branch backend is not deployed to production; the automatic Vercel Preview
is the frontend review surface.
