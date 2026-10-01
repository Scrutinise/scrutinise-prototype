-- 26-L addendum 5 — keep WHICH model failed to draft (and why), and mark a consolidation as in flight.
-- Additive, nullable, no default: existing rows read NULL (failedModels: "not recorded";
-- draftingStartedAt: "not in flight"). Not a partial or expression index; nothing for
-- docs/CLAUDE.md §21's register.
ALTER TABLE "GuidingPolicyConsolidation" ADD COLUMN IF NOT EXISTS "failedModels" JSONB;
ALTER TABLE "GuidingPolicyConsolidation" ADD COLUMN IF NOT EXISTS "draftingStartedAt" TIMESTAMP(3);
