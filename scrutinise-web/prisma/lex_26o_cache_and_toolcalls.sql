-- LEX 26-O §5a + 26-P addendum §8c (4 Oct 2026). Additive only: two defaulted columns, one new table.
--
-- 1. LlmSpend.tokensCached / tokensCacheWrite — cached input tokens, recorded per provider and priced at
--    their own rates. Both are SUBSETS of tokensIn (which keeps meaning "all input"). Rows written before
--    this are 0, which means "not recorded", NOT "none were cached".
-- 2. LexToolCall — one row per tool call Lex makes on an idea: time, the instruction it followed, the call
--    and its result, with a named actor. Shown to the owner beside the Privacy Log.
--
-- Plain btree index only — nothing for docs/CLAUDE.md §21's register of partial/expression indexes.
ALTER TABLE "LlmSpend" ADD COLUMN IF NOT EXISTS "tokensCached"     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LlmSpend" ADD COLUMN IF NOT EXISTS "tokensCacheWrite" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "LexToolCall" (
  "id"            TEXT PRIMARY KEY,
  "ideaId"        TEXT NOT NULL REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId"        TEXT NOT NULL,
  "actor"         TEXT NOT NULL DEFAULT 'Lex',
  "turnId"        TEXT,
  "tool"          TEXT NOT NULL,
  "tier"          TEXT,
  "instruction"   TEXT NOT NULL,
  "input"         JSONB NOT NULL,
  "result"        JSONB,
  "ok"            BOOLEAN NOT NULL,
  "failureReason" TEXT,
  "tainted"       BOOLEAN NOT NULL DEFAULT false,
  "confirmedVia"  TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LexToolCall_ideaId_createdAt_idx" ON "LexToolCall" ("ideaId", "createdAt");
