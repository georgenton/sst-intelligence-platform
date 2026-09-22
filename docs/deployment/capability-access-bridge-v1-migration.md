# Capability Access Bridge V1 — migration 35

Migration `20260921010000_capability_access_bridge_v1` only extends the existing PostgreSQL
`ModuleKey` enum with `INCIDENTS`, `PPE` and `TRAINING`. It creates no tables and changes no
customer rows.

Release order:

1. Run `pnpm prisma:deploy`.
2. Run the canonical `reference:sync` command.
3. Verify the three `ModuleDefinition` rows and idempotently repeat the sync.

Production and staging must use the release/reference sync path. A development seed is not a
runtime prerequisite.
