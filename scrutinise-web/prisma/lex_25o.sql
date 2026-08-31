-- ─────────────────────────────────────────────────────────────────────────────
-- SPRINT 25-O §4 — ARCHIVING AN IDEA, WHICH IS NOT DELETING IT.
--
-- ⚠ ADDITIVE ONLY. Two columns on "Idea", nothing dropped, nothing rewritten. Idempotent.
--
-- §4b: *"Archive, never hard-delete. Mark archived; hide from every list, every count and every
-- search; keep the rows."*
--
-- ⚠⚠ A SEPARATE COLUMN FROM `deletedAt`, AND THE SEPARATION IS THE DESIGN. `deletedAt` records
-- that the OWNER deleted their own idea — their act, undoable by them. This records that an
-- ADMIN hid somebody else's work. Reusing one column would make the two indistinguishable
-- afterwards, so nobody could answer "did the user delete this, or did we hide it?" — and the
-- second is the one that has to be answerable.
--
-- ⚠ AND 25-H IS WHY §4c EXISTS: three copies reported deleted were still in the database five
-- days later, two carrying real titles and indistinguishable from Charlie's own ideas on any
-- list. The archive script re-reads every row it touched and prints the re-read, never the
-- intent.
--
-- Apply against Neon (ep-old-dust-aboxi69a) — host checked with scripts/whichdb.ts first,
-- per docs/CLAUDE.md §16.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "archivedReason" TEXT;

-- ⚠⚠ A PARTIAL INDEX, AND IT IS ON THE CLAUDE.md §21 HAZARD REGISTER.
--
-- Every list of ideas now filters `deletedAt IS NULL AND "archivedAt" IS NULL`, and the owner's
-- dashboard and the public list both sort by `updatedAt`. Without this the filter is applied
-- after a scan; with it the live set stays small as hidden rows accumulate — the same reasoning
-- as `Idea_creatorId_live_idx`, which this sits beside and does not replace.
--
-- ⚠ `schema.prisma` CANNOT DECLARE A PARTIAL INDEX. `prisma migrate diff` will propose DROPPING
-- this as drift; accept that diff and nothing breaks visibly.
CREATE INDEX IF NOT EXISTS "Idea_visible_idx"
  ON "Idea" ("creatorId", "updatedAt" DESC)
  WHERE "deletedAt" IS NULL AND "archivedAt" IS NULL;

-- ══ 25-O §5 — THE OPENING COMMENTARY ON THE CAUSES ═════════════════════════════
--
-- The `CausesCommentary` shape from `lib/lex/build-commentary.ts`, as JSON: what the evidence
-- says, how complex the problem is, how the pieces relate, and where the sources CONFLICT.
--
-- ⚠ ON THE BUILD, NOT ON THE IDEA. It describes the terrain AS OF THIS RUN, and the causes are
-- exactly what a re-run changes — on the idea it would be one paragraph silently outliving the
-- evidence it was written about.
ALTER TABLE "IdeaBuild" ADD COLUMN IF NOT EXISTS "causesCommentary" JSONB;
