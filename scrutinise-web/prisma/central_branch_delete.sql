-- CENTRAL item 11 — delete and restore a branch (2026-08-27)
-- Additive. Idempotent. Safe to re-run. HAND-WRITTEN (docs/CLAUDE.md §16, §21).
--
-- Target: the app database (Neon ep-old-dust-aboxi69a / neondb).
--
-- ⚠ THE SAME THREE COLUMNS AS THE CONTENT PATTERN, deliberately. A branch and a
--   question are deleted by the same shape so the deleted-items view can list
--   them together and a reader learns one idea rather than two.
--
-- ⚠ NO `deletedWithParent` ON Community, and that is not an oversight. A branch
--   is never collateral: deleting a parent that still has children is REFUSED
--   (delete bottom-up), so no Community row is ever taken down by another's
--   deletion. Adding the column would imply a cascade that cannot happen.

ALTER TABLE "Community" ADD COLUMN IF NOT EXISTS "deletedAt"       TIMESTAMP(3);
ALTER TABLE "Community" ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;
ALTER TABLE "Community" ADD COLUMN IF NOT EXISTS "deletionReason"  TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Community_deletedByUserId_fkey') THEN
    ALTER TABLE "Community"
      ADD CONSTRAINT "Community_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ⚠ PARTIAL INDEX — schema.prisma cannot declare it; registered in §21.
--   Every tree walk asks for live children, so the index is over those.
CREATE INDEX IF NOT EXISTS "Community_live_children_idx"
  ON "Community" ("parentCommunityId") WHERE "deletedAt" IS NULL;

DO $$
DECLARE gone INTEGER; roots INTEGER;
BEGIN
  SELECT COUNT(*) INTO gone FROM "Community" WHERE "deletedAt" IS NOT NULL;
  SELECT COUNT(*) INTO roots FROM "Community" WHERE "parentCommunityId" IS NULL AND "deletedAt" IS NOT NULL;
  RAISE NOTICE 'deleted Communities (expect 0 on first run): % — of which roots: % (must always be 0)', gone, roots;
END $$;
