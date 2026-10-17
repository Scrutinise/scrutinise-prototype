-- LEX 26-S2 decision 181 (17 Oct 2026) - the action's COMMENTARY: unlimited text beside the 1,000-character action statement. Additive, nullable; no index (CLAUDE.md 21 register unchanged).
-- Apply with `npx tsx scripts/whichdb.ts` first (16); commit with schema.prisma in one commit.
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "commentary" TEXT;
