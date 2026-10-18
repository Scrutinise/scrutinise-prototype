-- LEX 26-S2 decision 193 (18 Oct 2026) - purposeInferred: TRUE where the purpose was inferred after the fact (the owning idea no longer exists), not stated at the call site. Additive, NOT NULL DEFAULT false (a stated purpose, or none, is not inferred).
-- Apply with `npx tsx scripts/whichdb.ts` first (16); commit with schema.prisma in one commit.
ALTER TABLE "LlmSpend" ADD COLUMN IF NOT EXISTS "purposeInferred" BOOLEAN NOT NULL DEFAULT false;
