-- LEX 26-Q (4 Oct 2026) — making a long list of coherent actions workable. Additive only.
--
-- LexCoherentAction gains: a stable `number` (so Lex and the user can say "put 7 and 12 under Transparency"), a `title`
-- and a `titleProposal` (Lex's draft, awaiting accept/edit), one `headingId`, a `status` (LIVE | RULED_OUT | ARCHIVED —
-- ARCHIVED is "absorbed into a merge"), `parked` (Later phase), merge columns (`mergedFrom`, `mergedIntoId`), and the
-- facets: `targetCauseIds` (the RECORDED cause link the brief assumed existed and did not), `avenue`, `link`, `sequence`,
-- `beforeIds`, plus `facetProposal` (Lex's proposals, held until the user accepts or corrects them).
-- ActionHeading is the user's own headings, per idea, with a colour key, order and hide/show.
--
-- Nothing is deleted by any of this: rule-out and merge keep the row, and every existing row becomes LIVE with a number.
-- Plain btree indexes only — nothing for docs/CLAUDE.md §21's register of partial/expression indexes.

ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "number"         INTEGER;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "title"          TEXT;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "titleProposal"  TEXT;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "headingId"      TEXT;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "status"         TEXT NOT NULL DEFAULT 'LIVE';
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "ruleOutReason"  TEXT;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "parked"         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "parkedReason"   TEXT;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "mergedFrom"     INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "mergedIntoId"   TEXT;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "targetCauseIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "avenue"         TEXT;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "link"           TEXT;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "sequence"       TEXT;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "beforeIds"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "facetProposal"  JSONB;

-- Every existing action gets a stable number, in the order the user sees them (orderIndex, then createdAt). Idempotent:
-- only rows with no number yet are numbered, continuing after the highest already used in that idea.
WITH ranked AS (
  SELECT "id",
         COALESCE((SELECT MAX(b."number") FROM "LexCoherentAction" b WHERE b."ideaId" = a."ideaId"), 0)
           + ROW_NUMBER() OVER (PARTITION BY a."ideaId" ORDER BY a."orderIndex", a."createdAt", a."id") AS n
  FROM "LexCoherentAction" a
  WHERE a."number" IS NULL
)
UPDATE "LexCoherentAction" t SET "number" = ranked.n FROM ranked WHERE t."id" = ranked."id";

CREATE INDEX IF NOT EXISTS "LexCoherentAction_ideaId_status_idx" ON "LexCoherentAction" ("ideaId", "status");

CREATE TABLE IF NOT EXISTS "ActionHeading" (
  "id"         TEXT PRIMARY KEY,
  "ideaId"     TEXT NOT NULL REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name"       TEXT NOT NULL,
  "colourKey"  TEXT NOT NULL,
  "hidden"     BOOLEAN NOT NULL DEFAULT false,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ActionHeading_ideaId_idx" ON "ActionHeading" ("ideaId");

-- A heading that is deleted must not orphan its actions: they simply lose the heading (code does this; the FK is the backstop).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LexCoherentAction_headingId_fkey') THEN
    ALTER TABLE "LexCoherentAction"
      ADD CONSTRAINT "LexCoherentAction_headingId_fkey" FOREIGN KEY ("headingId") REFERENCES "ActionHeading"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
