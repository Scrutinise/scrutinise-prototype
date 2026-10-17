-- LEX 26-S2 (17 Oct 2026) — the Coherent Actions screen in steps. Additive only; both columns are nullable or defaulted.
--   Idea.actionsStep                 the step the user was on (1..4), so the idea opens where they left it (§3a, decision 166)
--   LexCoherentAction.conflictNote   "kept with a note" for an action the policy test says CONFLICTS (§3c)
-- No partial or expression index (CLAUDE.md §21 register unchanged).
-- Apply with `npx tsx scripts/whichdb.ts` first (§16); commit with schema.prisma in one commit.
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "actionsStep" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "LexCoherentAction" ADD COLUMN IF NOT EXISTS "conflictNote" TEXT;
