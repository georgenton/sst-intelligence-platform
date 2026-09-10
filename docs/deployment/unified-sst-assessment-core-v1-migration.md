# Unified SST Assessment Core V1 — migration 34

Status: PR46 implementation; production deployment is not authorized.

Migration `20260909120000_unified_sst_assessment_core_v1` is additive. It creates three assessment
lifecycle enums and the thin `SstAssessmentSession` orchestration table with indexes and restrictive
foreign keys. It drops, renames, backfills or recalculates nothing.

Release validation requires both paths:

1. fresh PostgreSQL database: migrations 1 through 34, seed and zero pending migrations;
2. baseline database: migrations 1 through 33, then migration 34, with existing profile, adaptive,
   unified-evaluation, gap, inspection and risk history unchanged.

Normal production release remains `prisma migrate deploy` followed by the existing idempotent
reference sync. PR46 must not run this migration against Railway production before merge approval.
