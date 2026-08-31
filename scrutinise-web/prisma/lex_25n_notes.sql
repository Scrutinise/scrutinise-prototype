-- ─────────────────────────────────────────────────────────────────────────────
-- SPRINT 25-N §3c — THE NOTES TAB: the user's own working notes on an idea.
--
-- ⚠ ADDITIVE ONLY. One new table, nothing dropped, nothing rewritten. Idempotent.
--
-- §3c: *"Notes — private to the user, saved with the idea, **never shared**. Notes can be
-- titled, dragged under headings and sorted, each with show/hide."* And: *"The user's original
-- idea moves here, under 'My original idea' — it should not be the first thing on the working
-- page."*
--
-- ⚠⚠ THERE IS NO `visibility` COLUMN AND THERE MUST NOT BE ONE. Privacy is enforced by the
-- key: every read is `WHERE "ideaId" = $1 AND "userId" = $2`, so a note is unreachable to
-- anyone but its author by construction. A boolean defaulting to private is a boolean somebody
-- will eventually set the other way, and every read is then one missing clause away from
-- publishing a user's working notes to their idea-team.
--
-- ⚠ CHARLIE'S OPEN QUESTION — whether notes should be visible to the idea-team — is RECORDED,
-- NOT RESOLVED (§3c). Adding the column now would be shipping the answer.
--
-- ⚠ THE UNIQUE ON (ideaId, userId, source) IS WHAT MAKES THE SEED IDEMPOTENT. "My original
-- idea" is written on first read of the Notes tab; two page loads racing a read-then-write
-- would otherwise give a user their own idea twice.
--
-- Apply against Neon (ep-old-dust-aboxi69a) — host checked with scripts/whichdb.ts first,
-- per docs/CLAUDE.md §16.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "IdeaNote" (
  "id"        TEXT NOT NULL,
  "ideaId"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "title"     TEXT NOT NULL DEFAULT '',
  "body"      TEXT NOT NULL,
  "heading"   TEXT NOT NULL DEFAULT '',
  "position"  INTEGER NOT NULL DEFAULT 0,
  "hidden"    BOOLEAN NOT NULL DEFAULT false,
  "source"    TEXT NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdeaNote_pkey" PRIMARY KEY ("id")
);

-- ⚠ CASCADE ON BOTH. A note is deleted with the idea (GDPR erasure) and with the user; a note
-- that outlives its author is a private document with nobody entitled to read it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IdeaNote_ideaId_fkey') THEN
    ALTER TABLE "IdeaNote"
      ADD CONSTRAINT "IdeaNote_ideaId_fkey" FOREIGN KEY ("ideaId")
      REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IdeaNote_userId_fkey') THEN
    ALTER TABLE "IdeaNote"
      ADD CONSTRAINT "IdeaNote_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- The only read pattern there is: one user's notes on one idea, in their order.
CREATE INDEX IF NOT EXISTS "IdeaNote_ideaId_userId_position_idx"
  ON "IdeaNote" ("ideaId", "userId", "position");

-- ⚠⚠ PARTIAL, AND THE PREDICATE IS THE WHOLE POINT. Without `WHERE "source" <> 'USER'` this
-- constraint would also apply to typed notes, so a user could have exactly ONE note — the
-- feature broken by the guard meant to protect one row of it. Seeded notes are unique per
-- source; notes the user writes are not.
--
-- ⚠ `schema.prisma` CANNOT DECLARE A PARTIAL INDEX, so this lives only here and is on the
-- CLAUDE.md §21 hazard register. `prisma migrate diff` will propose DROPPING it as drift.
CREATE UNIQUE INDEX IF NOT EXISTS "IdeaNote_seeded_source_key"
  ON "IdeaNote" ("ideaId", "userId", "source")
  WHERE "source" <> 'USER';
