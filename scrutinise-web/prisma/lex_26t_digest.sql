-- LEX 26-T1 (18 Oct 2026) — the digest (decisions 146, 200, 201): four models and a judge answer Charlie's six questions about one heading,
-- or about the whole set. The digest is a ROW: its model outputs, the judge's output, the cost, and the ids of the live actions it read
-- (so a stale digest can say "written when this heading had 5 actions; it now has 7").
--
-- Additive: one new table, one plain index. Nothing deletes - a newer digest of the same scope sits beside the older one.
--
-- ⚠ NO PARTIAL OR EXPRESSION INDEX here (CLAUDE.md §21 register unchanged): the one index is plain, so `prisma migrate diff` can see it.
-- ⚠ Apply with `npx tsx scripts/whichdb.ts` FIRST (docs/CLAUDE.md §16) and push this file WITH schema.prisma in one commit.
CREATE TABLE IF NOT EXISTS "ActionDigest" (
  "id"           TEXT PRIMARY KEY,
  "ideaId"       TEXT NOT NULL REFERENCES "Idea"("id") ON DELETE CASCADE,
  "scope"        TEXT NOT NULL,
  "headingId"    TEXT,
  "headingName"  TEXT,
  "status"       TEXT NOT NULL DEFAULT 'RUNNING',
  "actionIds"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "modelOutputs" JSONB NOT NULL DEFAULT '[]'::JSONB,
  "judgeOutput"  JSONB,
  "spentPence"   DOUBLE PRECISION,
  "unpriced"     BOOLEAN NOT NULL DEFAULT false,
  "failure"      TEXT,
  "startedBy"    TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ActionDigest_ideaId_scope_headingId_idx" ON "ActionDigest"("ideaId", "scope", "headingId");
