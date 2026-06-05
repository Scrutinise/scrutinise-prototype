-- Migration: source_rate_limits_max_workers
-- Adds maxConcurrentWorkers column to source_rate_limits.
-- Controls how many workers can claim rows from the same source simultaneously.
-- Default 20 = no limit (preserves existing behaviour on non-seeded sources).

ALTER TABLE source_rate_limits
  ADD COLUMN IF NOT EXISTS "maxConcurrentWorkers" INTEGER NOT NULL DEFAULT 20;
