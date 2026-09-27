-- ─────────────────────────────────────────────────────────────────────────────
-- LEX 26-K — the update pass: new material as a proposed amendment, never an overwrite.
--
-- ⚠ ADDITIVE ONLY. New columns default to values that leave every existing row reading
-- exactly as it did before this ran. New enum values only add to EvidenceKind. Idempotent.
--
-- §4b — "accepting a change re-runs nothing; it marks what depends on it as stale." `stale`/
-- `staleReason` land on IdeaFieldState, PolicyOption and DiagnosisCause — the three places a
-- kernel value lives. Deliberately NOT a new FieldStatus value: whether a field is ANSWERED
-- and whether its answer might need a second look are orthogonal facts.
--
-- Apply against Neon (neondb) — host checked with scripts/whichdb.ts first,
-- per docs/CLAUDE.md §16.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "lastUpdatePassAt" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TYPE "EvidenceKind" ADD VALUE IF NOT EXISTS 'NEW_CAUSE';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TYPE "EvidenceKind" ADD VALUE IF NOT EXISTS 'NEW_POLICY_OPTION';
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "IdeaFieldState" ADD COLUMN IF NOT EXISTS "stale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "IdeaFieldState" ADD COLUMN IF NOT EXISTS "staleReason" TEXT;

ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "stale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PolicyOption" ADD COLUMN IF NOT EXISTS "staleReason" TEXT;

ALTER TABLE "DiagnosisCause" ADD COLUMN IF NOT EXISTS "stale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DiagnosisCause" ADD COLUMN IF NOT EXISTS "staleReason" TEXT;
