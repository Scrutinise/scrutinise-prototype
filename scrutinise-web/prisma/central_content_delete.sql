-- CENTRAL — the content soft-delete pattern (2026-08-27)
-- Additive. Idempotent. Safe to re-run. HAND-WRITTEN, not from
-- `prisma migrate diff` (docs/CLAUDE.md §16 and §21).
--
-- Target: the app database (Neon ep-old-dust-aboxi69a / neondb).
--
-- ⚠ THIS IS THE PATTERN THE REST OF THE SPRINT MATCHES. Branch delete/restore
--   (item 11) layers on top of it, so the shape here is the shape there.
--
-- FOUR COLUMNS, and why each one rather than fewer:
--
--   deletedAt          SOFT, because the brief asks for the cheapest thing to
--                      reverse. A hard delete across votes, favourites, flags,
--                      suggestions and the ledger is not reversible at all.
--                      A timestamp also records WHEN, which a boolean would not.
--   deletedByUserId    WHO. A member deleting their own answer and a manager
--                      removing it are different acts with the same effect, and
--                      the deleted-items view has to tell them apart.
--   deletionReason     WHY, in words. Optional for your own content, REQUIRED in
--                      code when a manager deletes someone else's — the same
--                      rule as reversing an activity claim (Stage 2e): an
--                      unaccountable removal is what this must not become.
--   deletedWithParent  WHETHER IT WAS COLLATERAL. This is the one that is easy
--                      to leave out and impossible to reconstruct afterwards.
--                      Restoring a question must bring back the answers that
--                      went down WITH it and must NOT resurrect an answer its
--                      own author had already deleted a week earlier. Without
--                      this flag those two are the same row.
--
-- ⚠ `Answer.hidden` IS NOT THIS AND STAYS. Hidden is a Stage 2b moderation
--   state: the answer exists, its author still sees it, and a manager has said
--   "not this one" with a reason. Deleted means gone. Overloading `hidden`
--   would make every later query about hidden answers silently include deleted
--   ones — the same trap `idea_soft_delete.sql` recorded for status='ARCHIVED'.

-- 1 ── the columns ───────────────────────────────────────────────────────────
ALTER TABLE "Question"     ADD COLUMN IF NOT EXISTS "deletedAt"         TIMESTAMP(3);
ALTER TABLE "Question"     ADD COLUMN IF NOT EXISTS "deletedByUserId"   TEXT;
ALTER TABLE "Question"     ADD COLUMN IF NOT EXISTS "deletionReason"    TEXT;
ALTER TABLE "Question"     ADD COLUMN IF NOT EXISTS "deletedWithParent" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Answer"       ADD COLUMN IF NOT EXISTS "deletedAt"         TIMESTAMP(3);
ALTER TABLE "Answer"       ADD COLUMN IF NOT EXISTS "deletedByUserId"   TEXT;
ALTER TABLE "Answer"       ADD COLUMN IF NOT EXISTS "deletionReason"    TEXT;
ALTER TABLE "Answer"       ADD COLUMN IF NOT EXISTS "deletedWithParent" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "BulletinPost" ADD COLUMN IF NOT EXISTS "deletedAt"         TIMESTAMP(3);
ALTER TABLE "BulletinPost" ADD COLUMN IF NOT EXISTS "deletedByUserId"   TEXT;
ALTER TABLE "BulletinPost" ADD COLUMN IF NOT EXISTS "deletionReason"    TEXT;
ALTER TABLE "BulletinPost" ADD COLUMN IF NOT EXISTS "deletedWithParent" BOOLEAN NOT NULL DEFAULT false;

-- 2 ── foreign keys ──────────────────────────────────────────────────────────
-- SET NULL: deleting the account of whoever removed a post must not take the
-- post with it, and "removed by somebody who no longer has an account" is a
-- truthful thing for the view to say.
DO $$
DECLARE fk RECORD;
BEGIN
  FOR fk IN
    SELECT * FROM (VALUES
      ('Question_deletedByUserId_fkey',     'Question',     'deletedByUserId'),
      ('Answer_deletedByUserId_fkey',       'Answer',       'deletedByUserId'),
      ('BulletinPost_deletedByUserId_fkey', 'BulletinPost', 'deletedByUserId')
    ) AS t(name, tbl, col)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = fk.name) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE',
        fk.tbl, fk.name, fk.col
      );
    END IF;
  END LOOP;
END $$;

-- 3 ── partial indexes over the LIVE rows ────────────────────────────────────
-- ⚠ PARTIAL INDEXES — schema.prisma cannot declare them and `prisma migrate
--   diff` will propose dropping them. Registered in docs/CLAUDE.md §21.
--
-- The overwhelmingly common query is "the live ones", and a partial index stays
-- small as deleted rows accumulate — the same reasoning as
-- `Idea_creatorId_live_idx` in idea_soft_delete.sql.
CREATE INDEX IF NOT EXISTS "Question_live_idx"
  ON "Question" ("communityId", "createdAt") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "Answer_live_idx"
  ON "Answer" ("questionId") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "BulletinPost_live_idx"
  ON "BulletinPost" ("communityId", "parentId") WHERE "deletedAt" IS NULL;

-- 4 ── what the result should be ─────────────────────────────────────────────
DO $$
DECLARE q INTEGER; a INTEGER; b INTEGER;
BEGIN
  SELECT COUNT(*) INTO q FROM "Question" WHERE "deletedAt" IS NOT NULL;
  SELECT COUNT(*) INTO a FROM "Answer" WHERE "deletedAt" IS NOT NULL;
  SELECT COUNT(*) INTO b FROM "BulletinPost" WHERE "deletedAt" IS NOT NULL;
  RAISE NOTICE 'already-deleted rows (expect 0 on first run): questions=% answers=% posts=%', q, a, b;
END $$;
