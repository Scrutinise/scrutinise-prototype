-- LEX 26-S (11 Oct 2026, built 15 Oct) — the action import pass (decision 140) and the heading's purpose paragraph (decision 141).
--
-- 1. ActionImportPass: the pass IS a row. Its `mapping` JSON is the table the user reviews and edits; nothing reaches the
--    Coherent Actions list until the confirm. Additive: a new table, and a nullable column.
-- 2. ActionHeading.purpose: what the instrument does and why it is needed (<= 120 words, enforced in code, not here).
--
-- ⚠ NO PARTIAL OR EXPRESSION INDEX here (CLAUDE.md §21 register unchanged): one plain index, which `prisma migrate diff` can see.
-- ⚠ Apply with `npx tsx scripts/whichdb.ts` FIRST (docs/CLAUDE.md §16) and push this file WITH schema.prisma in one commit.
CREATE TABLE IF NOT EXISTS "ActionImportPass" (
  "id"           TEXT PRIMARY KEY,
  "ideaId"       TEXT NOT NULL REFERENCES "Idea"("id") ON DELETE CASCADE,
  "sourceId"     TEXT NOT NULL,
  "sourceNumber" INTEGER NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'MAPPING',
  "mapping"      JSONB NOT NULL,
  "chunkCount"   INTEGER NOT NULL DEFAULT 0,
  "chunksDone"   INTEGER NOT NULL DEFAULT 0,
  "spentPence"   DOUBLE PRECISION,
  "failure"      TEXT,
  "result"       JSONB,
  "startedBy"    TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt"  TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "ActionImportPass_ideaId_status_idx" ON "ActionImportPass"("ideaId", "status");

ALTER TABLE "ActionHeading" ADD COLUMN IF NOT EXISTS "purpose" TEXT;
