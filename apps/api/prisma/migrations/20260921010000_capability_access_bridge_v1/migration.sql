-- Capability Access Bridge V1 only extends the existing module reference enum.
-- No customer data, entitlements, or domain tables are changed here.
ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'INCIDENTS';
ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'PPE';
ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'TRAINING';
