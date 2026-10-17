-- LEX 26-S2 §11a (decision 175, 17 Oct 2026) — a removed cause is ARCHIVED, not deleted, so its number is never reused.
-- Additive only: one nullable column. Existing rows are live (NULL). No partial or expression index (CLAUDE.md §21 register unchanged).
-- lex_cause_number_trg already takes max("number") + 1 over every row of the idea, so an archived cause keeps its number and the next cause is one past the highest EVER.
-- Apply with `npx tsx scripts/whichdb.ts` first (§16); commit with schema.prisma in one commit.
ALTER TABLE "DiagnosisCause" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
