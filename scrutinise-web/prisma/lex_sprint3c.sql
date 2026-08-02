-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 3-C (§19-C) — additive schema deltas. Idempotent; safe to re-run.
--
-- Apply to Neon (NEVER `prisma db push` — see docs/CLAUDE.md §16 and the playbook):
--   cd scrutinise-web
--   npx tsx ../scripts/whichdb.ts          # confirm the host first, every time
--   DIRECT_URL="<neon direct url>" npx prisma db execute --file prisma/lex_sprint3c.sql --schema prisma/schema.prisma
--   npx prisma generate
--
-- 1. Idea.stageSearches — the stage-aware search record (Task 2) and ad-hoc research
--    results (Task 1c). REFERENCES ONLY (id/citation/url/snippet), never full text:
--    the corpus stays in the corpus. Shape:
--      { version: 2,
--        byStage: { DIAGNOSIS: { intent, ranAt, ok, failureReason?, query[], results[] }, … },
--        research: [ { query, ranAt, ok, results[] } ] }
--
-- 2. CostLine — cost engine v0 (Task 6). One line at a time under a Coherent Action;
--    lines roll up per action → the three §18.2 categories → costSummary.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "stageSearches" JSONB;

DO $$ BEGIN
  CREATE TYPE "CostLineType" AS ENUM ('STAFF', 'CAPITAL', 'PROPERTY', 'RESEARCH', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CostLineCategory" AS ENUM ('IMPLEMENTATION', 'ENFORCEMENT', 'FRICTION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StaffLevel" AS ENUM ('JUNIOR', 'MID', 'SENIOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CostLine" (
  "id"             TEXT PRIMARY KEY,
  "actionId"       TEXT NOT NULL,
  "label"          TEXT NOT NULL,
  "costType"       "CostLineType"     NOT NULL DEFAULT 'OTHER',
  "category"       "CostLineCategory" NOT NULL DEFAULT 'IMPLEMENTATION',
  "staffLevel"     "StaffLevel",
  "fteCount"       DOUBLE PRECISION,
  "durationMonths" DOUBLE PRECISION,
  "low"            DOUBLE PRECISION,
  "high"           DOUBLE PRECISION,
  "unit"           TEXT,
  "basis"          TEXT,
  "benchmarkId"    TEXT,
  "priceYear"      INTEGER,
  "orderIndex"     INTEGER      NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CostLine_actionId_fkey" FOREIGN KEY ("actionId")
    REFERENCES "LexCoherentAction"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CostLine_actionId_idx" ON "CostLine"("actionId");
