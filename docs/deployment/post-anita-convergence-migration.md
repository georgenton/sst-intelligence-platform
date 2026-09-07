# Post-Anita Product Convergence V1 migration notes

The two migrations are forward-only and non-destructive:

1. `20260907010000_post_anita_product_convergence_v1` adds Plan Operativo, Resource Scope,
   editorial proposal state and nullable inspection snapshot columns.
2. `20260907011000_post_anita_immutability_hardening` protects resource/mapping content and finite
   editorial transitions at the database boundary.

No existing row is rewritten and no backfill runs. Existing inspection snapshot columns remain
null. The reference sync adds one global synthetic taxonomy, 21 resources and deterministic
mappings to existing eligible demo/pilot StandardVersions; it creates no tenant data. Repeated sync
must return identical counts and drift detection must remain fail-closed.

Release sequence remains `prisma migrate deploy` followed by the existing reference sync. Never use
`prisma db push` in deployment.
