-- Lex rebuild — Sprint 2 (Page 2 Diagnosis + causes loop). Additive, idempotent.
-- Applied to Neon (production app DB after the V26 cutover). NOT applied to Railway.
-- See docs/LEX_REBUILD_DESIGN.md §7, and docs/LEX_DESIGN_ADDENDUM_14-15.md §15.

-- Cause provenance enum (§7.2)
DO $$ BEGIN
  CREATE TYPE "DiagnosisCauseSource" AS ENUM ('USER','LEX_CORPUS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- The current Lex page pointer (advanced explicitly via "Continue to Diagnosis").
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "lexPage" TEXT DEFAULT 'ORIENTATION';

-- Page 2 (Diagnosis) fields. rootCause + summaryDiagnosis already exist (legacy columns).
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "challenge" TEXT;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "whoAffectedImpactCost" JSONB;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "legalLandscape" JSONB;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "pivotalObstacle" TEXT;

-- Causes loop child table (§7.2) — mirrors the CoherentActions per-row pattern.
CREATE TABLE IF NOT EXISTS "DiagnosisCause" (
  "id" TEXT NOT NULL,
  "ideaId" TEXT NOT NULL,
  "cause" TEXT NOT NULL,
  "whyPersisted" TEXT,
  "evidence" TEXT,
  "isRootCause" BOOLEAN NOT NULL DEFAULT false,
  "source" "DiagnosisCauseSource" NOT NULL DEFAULT 'USER',
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiagnosisCause_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "DiagnosisCause" ADD CONSTRAINT "DiagnosisCause_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "DiagnosisCause_ideaId_idx" ON "DiagnosisCause"("ideaId");
