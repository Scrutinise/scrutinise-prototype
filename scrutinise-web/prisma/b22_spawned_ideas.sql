-- ═══════════════════════════════════════════════════════════════════════════════════════
-- CCW-B22 §7 — a proposal can name the questions it cannot settle, and queue them as ideas.
--
-- Charlie: "Identifying things that need their own idea-project is a valid output from an
-- idea. It's not an ever-flowing hierarchy."
--
-- ⚠⚠ IT TERMINATES ON `spawnedFromIdeaId`. `refuseToSpawn()` refuses to spawn from a row that
-- has it set, so depth is capped at ONE BY THE ROW rather than by an instruction in a prompt.
--
-- ⚠ ON DELETE SET NULL, NOT CASCADE. A spawned idea is independent work, not a detail of its
-- parent. Deleting the parent must leave the question standing — orphaned and visible —
-- rather than silently deleting a work item somebody may already have picked up.
--
-- Additive and nullable throughout: no existing row changes, no existing query changes, and
-- the columns read as NULL on every idea that predates this.
-- ═══════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "spawnedFromIdeaId" TEXT;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "spawnedQuestion"   TEXT;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "spawnedWhyNotHere" TEXT;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "spawnedByPassKey"  TEXT;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "spawnedAt"         TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Idea_spawnedFromIdeaId_fkey'
  ) THEN
    ALTER TABLE "Idea"
      ADD CONSTRAINT "Idea_spawnedFromIdeaId_fkey"
      FOREIGN KEY ("spawnedFromIdeaId") REFERENCES "Idea"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- The only query this table gains: "what did this proposal spawn?". Partial, because the
-- column is NULL on every idea that was not spawned and an index over those is dead weight.
-- ⚠ A PARTIAL INDEX IS ONE OF THE THINGS `schema.prisma` CANNOT DECLARE (CLAUDE.md §21), so
-- it lives here and MUST NOT be dropped when `prisma migrate diff` proposes dropping it.
CREATE INDEX IF NOT EXISTS "Idea_spawnedFromIdeaId_idx"
  ON "Idea" ("spawnedFromIdeaId")
  WHERE "spawnedFromIdeaId" IS NOT NULL;
