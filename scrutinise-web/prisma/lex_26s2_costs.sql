-- LEX 26-S2 sec 6 (18 Oct 2026) - STEP 3, COSTS: a cost line says whether it is ONE-OFF or PER YEAR, and an action can say "no cost, because ..." instead of leaving the question open. Both additive and nullable; no index (CLAUDE.md 21 register unchanged).
-- Apply with `npx tsx scripts/whichdb.ts` first (16); commit with schema.prisma in one commit.
ALTER TABLE "CostLine" ADD COLUMN IF NOT EXISTS "recurrence" TEXT;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "noCostReason" TEXT;
