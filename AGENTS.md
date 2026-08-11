# Coding agent guide

## Architecture

Work in vertical slices inside a TypeScript monorepo. `apps/api` is a NestJS modular monolith,
`apps/web` is a Next.js App Router client, and `packages/contracts` owns pure schemas and business
rules. Do not introduce microservices, queues, Redis, GraphQL, CQRS, or speculative infrastructure.

## Commands

Use pnpm through Corepack. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`; run
`pnpm check` before declaring work complete. PostgreSQL is provided by `docker compose up -d`.

## Boundaries and conventions

- Keep controllers thin; Prisma belongs in application services, never controllers.
- Do not create a universal generic repository.
- Domain logic and external providers must remain separated.
- Every business rule needs tests and architecture changes require documentation updates.
- Code identifiers are English. Product copy is Spanish.
- Brand, plans, feature limits, provider names, models, URLs, and demo duration are configurable.

## Multitenancy and security

- Never trust an arbitrary `organizationId` from a domain request body.
- Resolve the active organization through an authenticated context validated against membership.
- Every organization-domain query must include the validated organization identifier.
- API guards are authoritative for roles and entitlements; hidden UI is not authorization.
- Never log or commit passwords, access tokens, refresh tokens, secrets, medical information, or
  individual psychosocial information.
- Do not simulate guaranteed legal compliance or personal diagnosis.
- AI can explain a deterministic result; it cannot make or change that decision.

## Testing and commits

Prefer unit tests for pure rules, integration tests for persistence/security boundaries, and
accessible Playwright selectors for critical journeys. Use small Conventional Commits only after
the relevant checks pass. Never force push or rewrite user history.

## Prohibited agent actions

Do not use `prisma db push` as deployment, hardcode deployment URLs, invent completed provider
calls, add real payment/email behavior, or expand the deep SST modules in this increment.
