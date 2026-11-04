-- LEX 26-X (4 Nov 2026), decision 317 — the Deepening's lock and the owner's override. Additive only; nullable.
--   Idea.deepenOverride   [{ reason, by, at, toGo }] appended, never edited; the last is in force. NULL = never overridden.
-- "Needs no draft" (313) needs NO column: it is the existing "needs a document" override, mode 'nothing', with its reason,
-- already held on LexCoherentAction.record.documentNeeds (lib/lex/action-documents.ts setNeeds).
-- No partial or expression index (CLAUDE.md §21 register unchanged).
-- Apply with `npx tsx scripts/whichdb.ts` first (§16); commit with schema.prisma and the code that reads it, in one commit.
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "deepenOverride" JSONB;
