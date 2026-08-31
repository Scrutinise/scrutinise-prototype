-- ─────────────────────────────────────────────────────────────────────────────
-- SPRINT 25-N §3e — A TICK ON THE WORKLIST.
--
-- ⚠ ADDITIVE ONLY. One new table, nothing dropped, nothing rewritten. Idempotent.
--
-- §3e makes the worklist four parts, "each a checkbox list", with **Things to read** "each
-- tickable as read". A tick is a fact about ONE PERSON's progress through the work, not about
-- the idea — two collaborators reading the same evidence have read different halves of it —
-- so it is keyed on the user, exactly as `IdeaNote` is.
--
-- ⚠ `itemKey` IS THE THING'S OWN ID, NOT A ROW NUMBER. The worklist is assembled from the
-- agenda on every load and its ORDER changes as work is done; ticking "item 3" would move the
-- tick onto whatever landed third next time.
--
-- ⚠ AND AN UNTICKED ITEM IS AN ABSENT ROW, not a `false`. Nothing to migrate when a build adds
-- forty findings, and "not yet read" needs no write.
--
-- Apply against Neon (ep-old-dust-aboxi69a) — host checked with scripts/whichdb.ts first,
-- per docs/CLAUDE.md §16.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "IdeaWorklistTick" (
  "id"        TEXT NOT NULL,
  "ideaId"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "itemKey"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdeaWorklistTick_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IdeaWorklistTick_ideaId_fkey') THEN
    ALTER TABLE "IdeaWorklistTick"
      ADD CONSTRAINT "IdeaWorklistTick_ideaId_fkey" FOREIGN KEY ("ideaId")
      REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IdeaWorklistTick_userId_fkey') THEN
    ALTER TABLE "IdeaWorklistTick"
      ADD CONSTRAINT "IdeaWorklistTick_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ⚠ THE UNIQUE IS THE IDEMPOTENCE. Ticking is a toggle a user will double-press; without this
-- a double-press is two rows and an untick then leaves one behind, so the box comes back.
CREATE UNIQUE INDEX IF NOT EXISTS "IdeaWorklistTick_ideaId_userId_itemKey_key"
  ON "IdeaWorklistTick" ("ideaId", "userId", "itemKey");

CREATE INDEX IF NOT EXISTS "IdeaWorklistTick_ideaId_userId_idx"
  ON "IdeaWorklistTick" ("ideaId", "userId");
