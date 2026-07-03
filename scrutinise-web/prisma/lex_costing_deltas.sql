-- Lex rebuild — COSTING_SCOPE §9 deltas (Sprint 3 Task 5 extension). Additive, idempotent.
-- Applied to Neon. NOT applied to Railway. See docs/COSTING_SCOPE.md §3/§9, LEX_REBUILD_DESIGN §18.

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "BenchmarkCategory" AS ENUM
    ('HEALTH','LIFE_SAFETY','WELLBEING','TIME','CRIME','ADMIN_BURDEN','EMPLOYMENT_ECONOMY','HOUSING','EDUCATION','ENVIRONMENT','SERVICE_UNIT_COST');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "UprateMethod" AS ENUM ('GDP_DEFLATOR','GDP_PER_HEAD','NONE');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "BenchmarkConfidence" AS ENUM ('OFFICIAL_CURRENT','OFFICIAL_DATED','ACADEMIC','SECTOR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── CostBenchmark deltas (§3) ─────────────────────────────────────────────────
ALTER TABLE "CostBenchmark" ADD COLUMN IF NOT EXISTS "priceYear" INTEGER;
ALTER TABLE "CostBenchmark" ADD COLUMN IF NOT EXISTS "category" "BenchmarkCategory";
ALTER TABLE "CostBenchmark" ADD COLUMN IF NOT EXISTS "region" TEXT DEFAULT 'UK';
ALTER TABLE "CostBenchmark" ADD COLUMN IF NOT EXISTS "uprateMethod" "UprateMethod" DEFAULT 'GDP_DEFLATOR';
ALTER TABLE "CostBenchmark" ADD COLUMN IF NOT EXISTS "confidence" "BenchmarkConfidence";
CREATE INDEX IF NOT EXISTS "CostBenchmark_category_idx" ON "CostBenchmark"("category");

-- Backfill the hand-seeded placeholder rows (idempotent: only where still NULL).
UPDATE "CostBenchmark" SET "priceYear" = COALESCE("priceYear", v.py),
                            "category" = COALESCE("category", v.cat::"BenchmarkCategory"),
                            "uprateMethod" = COALESCE("uprateMethod", v.um::"UprateMethod"),
                            "confidence" = COALESCE("confidence", v.conf::"BenchmarkConfidence")
FROM (VALUES
  ('seed-qaly',          2020, 'HEALTH',             'GDP_DEFLATOR', 'OFFICIAL_CURRENT'),
  ('seed-vpf',           2016, 'LIFE_SAFETY',        'GDP_PER_HEAD', 'OFFICIAL_CURRENT'),
  ('seed-vot',           2023, 'TIME',               'GDP_DEFLATOR', 'OFFICIAL_CURRENT'),
  ('seed-admin-burden',  2020, 'ADMIN_BURDEN',       'GDP_DEFLATOR', 'OFFICIAL_DATED'),
  ('seed-reg-officer',   2024, 'SERVICE_UNIT_COST',  'GDP_DEFLATOR', 'SECTOR'),
  ('seed-it-system',     2024, 'SERVICE_UNIT_COST',  'GDP_DEFLATOR', 'SECTOR'),
  ('seed-guidance',      2024, 'SERVICE_UNIT_COST',  'GDP_DEFLATOR', 'SECTOR'),
  ('seed-inspection',    2024, 'SERVICE_UNIT_COST',  'GDP_DEFLATOR', 'SECTOR'),
  ('seed-compliance-sme',2024, 'ADMIN_BURDEN',       'GDP_DEFLATOR', 'SECTOR'),
  ('seed-carbon',        2023, 'ENVIRONMENT',        'GDP_DEFLATOR', 'OFFICIAL_CURRENT')
) AS v(id, py, cat, um, conf)
WHERE "CostBenchmark"."id" = v.id;

-- The ADD COLUMN default ('GDP_DEFLATOR') pre-filled uprateMethod, so the COALESCE above
-- couldn't set VPF to GDP_PER_HEAD (COSTING_SCOPE §2). Fix the one exception explicitly.
UPDATE "CostBenchmark" SET "uprateMethod" = 'GDP_PER_HEAD' WHERE "id" = 'seed-vpf';

-- ── DeflatorSeries (§3/§7d) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "DeflatorSeries" (
  "year" INTEGER NOT NULL,
  "index" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeflatorSeries_pkey" PRIMARY KEY ("year")
);

-- ILLUSTRATIVE PLACEHOLDER series (2015=100, ~2%/yr) so uprating is testable before the
-- Phase-2 ingest of the real ONS GDP-deflator series. Only ratios matter. Idempotent.
INSERT INTO "DeflatorSeries" ("year","index") VALUES
  (2015,100.0),(2016,102.0),(2017,104.0),(2018,106.5),(2019,108.5),(2020,112.0),
  (2021,113.0),(2022,118.0),(2023,125.0),(2024,130.0),(2025,133.0),(2026,136.0)
ON CONFLICT ("year") DO NOTHING;
