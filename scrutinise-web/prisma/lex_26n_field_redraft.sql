-- ─────────────────────────────────────────────────────────────────────────────
-- LEX 26-N — a redraft offered BESIDE a field's current text, never over it.
--
-- ⚠ ADDITIVE ONLY. One new nullable column; every existing row reads exactly as it did. Idempotent.
-- Apply with scripts/apply-sql.ts (after scripts/whichdb.ts). No partial or expression index, so
-- docs/CLAUDE.md §21's register is unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "IdeaFieldState" ADD COLUMN IF NOT EXISTS "redraft" JSONB;
