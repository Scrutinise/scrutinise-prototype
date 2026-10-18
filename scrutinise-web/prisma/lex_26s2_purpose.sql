-- LEX 26-S2 sec 11b (decision 176, 18 Oct 2026) - an ambient PURPOSE on the spend ledger: scripts and measurement runs say what they are (measurement | check) at the call site, so product spend and engineering spend can be told apart and an engineering row is not read as an attribution failure. Additive, nullable; no index. NULL = a product call (or history). Raw-SQL table: the DDL of record is this file and prisma/llm_spend.sql.
-- Apply with `npx tsx scripts/whichdb.ts` first (16); commit with schema.prisma in one commit.
ALTER TABLE "LlmSpend" ADD COLUMN IF NOT EXISTS "purpose" TEXT;
