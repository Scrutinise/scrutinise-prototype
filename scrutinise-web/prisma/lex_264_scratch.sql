-- LEX decision 264 (24 Oct 2026): a scratch copy made to measure a price carries a flag, and LIVE_IDEA hides it from every list and count.
--
-- Adds "Idea"."isScratch" (default false) and flags the copies scripts/lib/scratch-copy.ts has already made (title "ZZ-scratch …").
-- ⚠ Ships in the SAME push as the code that reads it (lib/lex/idea-visibility.ts LIVE_IDEA), applied just before that push, never
--   earlier: every list of ideas spreads LIVE_IDEA, so code without the column fails, and a column without the code does nothing.
-- ⚠ Run `npx tsx scripts/whichdb.ts` first (CLAUDE.md §16) and read the column back after.

ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "isScratch" boolean NOT NULL DEFAULT false;
UPDATE "Idea" SET "isScratch" = true WHERE title LIKE 'ZZ-scratch %' AND "isScratch" = false;
