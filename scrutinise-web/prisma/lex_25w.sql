-- ═══════════════════════════════════════════════════════════════════════════════════════
-- LEX 25-W — hand-written, additive, and reversible.
--
-- Applied with:  npx tsx --env-file=.env scripts/apply-sql.ts prisma/lex_25w.sql
--
-- ⚠ NEVER `prisma migrate diff` against this database (docs/CLAUDE.md §21). Nothing here is
-- a partial or expression index, so there is no register row to add.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ── §B — "Email me when it's done" returns to ticked by default ────────────────────────
--
-- The column default was `false` while a build was driven by the user's browser tab, because
-- the checkbox was read as permission to walk away and walking away stopped the build. The
-- build now runs on the Railway worker (25-T §1a) and one has completed with the tab closed
-- (25-V §1d), so the promise is keepable and the offer goes back to being made by default.
ALTER TABLE "User" ALTER COLUMN "emailOnBuildComplete" SET DEFAULT true;

-- ⚠⚠ THE BACKFILL IS GUARDED, AND THE GUARD IS THE POINT. Every existing `false` has one of
-- two completely different meanings and they must not be treated alike:
--
--   · a row that has never started a build carries `false` because that WAS the column
--     default. Nobody chose it. Those rows are corrected below.
--   · a row belonging to somebody who has started a build carries the choice they made at
--     that moment — `claimBuild` writes this column from the checkbox on every start. That
--     is a decision, and overwriting a decision with a default is the thing this guard
--     exists to prevent. Those rows are left exactly as they are.
--
-- The subquery is the test for "has ever expressed a preference", stated positively: an
-- IdeaBuild exists on an idea they created.
UPDATE "User" u
   SET "emailOnBuildComplete" = true
 WHERE u."emailOnBuildComplete" = false
   AND NOT EXISTS (
     SELECT 1
       FROM "IdeaBuild" b
       JOIN "Idea" i ON i.id = b."ideaId"
      WHERE i."creatorId" = u.id
   );
