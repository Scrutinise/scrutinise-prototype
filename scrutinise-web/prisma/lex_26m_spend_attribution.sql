-- COST DASHBOARD (29 Sep 2026) — every ledger row carries idea, user, BUILD and STEP.
--
-- Additive and nullable. `buildId`/`step` join a row to the build (IdeaBuild.id) and the pass within it.
-- `attrSource` says HOW the attribution was learned, so an inference can never pass for a fact:
--   'explicit'         the caller named the user/idea
--   'ambient'          taken from the request/build context (lib/lex/build-context.ts)
--   'owner-of-idea'    the idea was known, the user was derived as the idea's creator at write time
--   'inferred-idea'    BACKFILL: idea was on the row, user filled from the idea's creator
--   'inferred-window'  BACKFILL: idea/build filled because exactly one build was running at that instant
--   NULL               no attribution — shown on the dashboard as its own line, never hidden
-- Plain (non-partial, non-expression) indexes only — nothing for docs/CLAUDE.md §21's register.
ALTER TABLE "LlmSpend" ADD COLUMN IF NOT EXISTS "buildId" TEXT;
ALTER TABLE "LlmSpend" ADD COLUMN IF NOT EXISTS "step" TEXT;
ALTER TABLE "LlmSpend" ADD COLUMN IF NOT EXISTS "attrSource" TEXT;
CREATE INDEX IF NOT EXISTS "LlmSpend_buildId_idx" ON "LlmSpend" ("buildId");
CREATE INDEX IF NOT EXISTS "LlmSpend_createdAt_idx" ON "LlmSpend" ("createdAt");

-- Reconciliation results, written by the reconciliation job (the ONLY place the provider admin keys
-- live) and read by the admin dashboard, which therefore never holds them.
CREATE TABLE IF NOT EXISTS "SpendReconciliation" (
  "id"          BIGSERIAL PRIMARY KEY,
  "provider"    TEXT NOT NULL,
  "day"         DATE NOT NULL,
  "ledgerPence" DECIMAL(14,4) NOT NULL,
  "ledgerRows"  INTEGER NOT NULL DEFAULT 0,
  "providerUsd" DECIMAL(14,6),
  "gapPence"    DECIMAL(14,4),
  -- RECONCILED | NOT_READ | NOT_RECONCILABLE
  "status"      TEXT NOT NULL,
  "reason"      TEXT,
  "checkedAt"   TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "SpendReconciliation_provider_day_key" UNIQUE ("provider", "day")
);
