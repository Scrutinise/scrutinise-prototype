-- ═══════════════════════════════════════════════════════════════════════════════════════
-- LEX 25-X — hand-written, additive, and reversible.
--
-- Applied with:  npx tsx --env-file=.env scripts/apply-sql.ts prisma/lex_25x.sql
--
-- ⚠ NEVER `prisma migrate diff` against this database (docs/CLAUDE.md §21). Nothing here is
-- a partial or expression index, so there is no register row to add.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ── §3 — the challenge cleanup needs three facts a DeepeningIssue cannot currently hold ──
--
-- ⚠⚠ `runVersion` IS NOT REWRITTEN AND MUST NOT BE. It records the draft a criticism was
-- raised against, and the brief asks for promotions to be shown "marked with the draft each
-- was raised against" — so the provenance is the thing being displayed, and overwriting it to
-- move a criticism into the current set would destroy exactly what is being shown.

-- §3 promotion: an earlier criticism that still bites, shown in this build's set.
-- NULL = not promoted. The document filter is `runVersion = current OR promotedToVersion = current`.
ALTER TABLE "DeepeningIssue" ADD COLUMN IF NOT EXISTS "promotedToVersion" INTEGER;

-- §3b POSSIBLY DUPLICATE, and §3d the merge groups, both need to name ANOTHER challenge.
-- One nullable self-reference serves both; `relationKind` says which it is.
--
-- ⚠ ON DELETE SET NULL, not CASCADE. If the challenge on the other end is ever deleted, this
-- one must survive with its relation cleared — cascading would delete a criticism because a
-- DIFFERENT criticism was removed, which is the opposite of "archive, never delete".
ALTER TABLE "DeepeningIssue" ADD COLUMN IF NOT EXISTS "relatedIssueId" TEXT;
ALTER TABLE "DeepeningIssue" ADD COLUMN IF NOT EXISTS "relationKind" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeepeningIssue_relatedIssueId_fkey'
  ) THEN
    ALTER TABLE "DeepeningIssue"
      ADD CONSTRAINT "DeepeningIssue_relatedIssueId_fkey"
      FOREIGN KEY ("relatedIssueId") REFERENCES "DeepeningIssue"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- The document reads the current set on every render, so the filter needs an index.
CREATE INDEX IF NOT EXISTS "DeepeningIssue_idea_version_idx"
  ON "DeepeningIssue" ("ideaId", "runVersion");
CREATE INDEX IF NOT EXISTS "DeepeningIssue_idea_promoted_idx"
  ON "DeepeningIssue" ("ideaId", "promotedToVersion");
CREATE INDEX IF NOT EXISTS "DeepeningIssue_related_idx"
  ON "DeepeningIssue" ("relatedIssueId");
