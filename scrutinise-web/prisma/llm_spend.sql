-- llm_spend.sql — BRIEF_SEARCH_S6 §3. The append-only record of every model call.
--
-- DDL OF RECORD. Applied by `scripts/setup-llm-spend.ts`, which prints the target host first
-- (docs/CLAUDE.md §16 — two migrations were once applied to the wrong database and reported
-- success). Additive and idempotent; there is no DROP in this file.
--
-- The matching Prisma model exists in schema.prisma for ONE reason: without it
-- `prisma migrate diff` sees a table it does not know about and proposes DROPPING it. Nothing
-- reads this through the Prisma client's typed API — `spend-ledger.ts` uses $queryRaw, and the
-- ingest twin uses pg directly, because it cannot import anything under scrutinise-web/.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHY APPEND-ONLY, AND WHY ONE ROW PER CALL
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- CENTRAL Stage 2 learned this on points: every balance is computed and the ledger only appends,
-- which is what makes "editing a tariff changes only subsequent events" true by construction. The
-- same applies here. A stored per-user total would have to be corrected whenever a rate card
-- changed, and a correction to a stored total is indistinguishable from a mistake.
--
-- One row per CALL, not per build or per session, because the question that matters later is
-- "which pass is expensive" and a per-build total cannot answer it.

CREATE TABLE IF NOT EXISTS "LlmSpend" (
  id              BIGSERIAL PRIMARY KEY,

  -- WHO SPENT IT
  stream          TEXT NOT NULL CHECK (stream IN ('lex','build','deepening','orientation','graph','ingest','admin')),
  -- The pass name from lib/lex/model-registry.ts where there is one. This is the join between
  -- "what we configured" and "what it cost", and without it a rising bill cannot be attributed
  -- to the change that caused it.
  pass            TEXT NOT NULL,
  model           TEXT NOT NULL,

  -- WHAT IT USED. Thinking tokens are separate because they bill at the OUTPUT rate and a total
  -- that folds them into input understates the cost of exactly the models most likely to think.
  "tokensIn"      INTEGER NOT NULL DEFAULT 0,
  "tokensOut"     INTEGER NOT NULL DEFAULT 0,
  "tokensThinking" INTEGER NOT NULL DEFAULT 0,

  -- ⚠ NULL MEANS UNPRICED, NOT FREE, and `unpriced` states it explicitly so a reader never has
  -- to infer intent from a NULL. Zero is a claim, and it is the claim most likely to be believed:
  -- a build that ran four calls and reports £0.00 also tells the ceiling nothing.
  "estCostPence"  DECIMAL(12,4),
  unpriced        BOOLEAN NOT NULL DEFAULT FALSE,

  -- WHO IT IS FOR. Both nullable: ingest spend belongs to no user and no idea, and it is still
  -- Charlie's money, which is the whole argument for one table rather than four.
  "userId"        TEXT,
  "ideaId"        TEXT,
  ref             TEXT,

  -- ⚠ A FAILED CALL STILL COSTS MONEY. Recording only successes understates the bill by exactly
  -- the calls you most want to know about (the truncation class: retried, billed, discarded).
  failed          BOOLEAN NOT NULL DEFAULT FALSE,

  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The three questions this table exists to answer, each an index.
CREATE INDEX IF NOT EXISTS "LlmSpend_idea_idx"   ON "LlmSpend" ("ideaId") WHERE "ideaId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "LlmSpend_user_idx"   ON "LlmSpend" ("userId", "createdAt") WHERE "userId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "LlmSpend_pass_idx"   ON "LlmSpend" (pass, "createdAt");
CREATE INDEX IF NOT EXISTS "LlmSpend_stream_idx" ON "LlmSpend" (stream, "createdAt");

-- ⚠ NO FOREIGN KEY TO User OR Idea, DELIBERATELY. A deleted idea must not delete the record of
-- what it cost to produce — the platform's spend history is not the user's to erase, and
-- `Idea.deletedAt` is a soft delete anyway. The columns are plain text and a join that finds
-- nothing is the correct outcome for a row whose subject is gone.

-- One place to read the platform's spend, so nobody writes their own aggregate.
CREATE OR REPLACE VIEW "LlmSpendDaily" AS
SELECT date_trunc('day', "createdAt")::date        AS day,
       stream, pass, model,
       COUNT(*)                                    AS calls,
       COUNT(*) FILTER (WHERE failed)              AS failed_calls,
       COUNT(*) FILTER (WHERE unpriced)            AS unpriced_calls,
       SUM("tokensIn")                             AS tokens_in,
       SUM("tokensOut" + "tokensThinking")         AS tokens_out,
       -- ⚠ A DAY CONTAINING AN UNPRICED CALL REPORTS NULL rather than a partial sum, for the same
       -- reason spend-ledger.ts folds a total to NULL: a partial sum reads as a complete one.
       CASE WHEN COUNT(*) FILTER (WHERE unpriced) > 0 THEN NULL
            ELSE SUM("estCostPence") END           AS pence
FROM "LlmSpend"
GROUP BY 1, 2, 3, 4;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ADDENDUM (2026-08-17) — THE GROUP COLUMN, ADDED BEFORE THERE IS HISTORY TO REGRET
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Charlie: "every metered call must record an optional group as well as a user. Buying tokens for a
-- community group is a planned feature. Adding the column now costs nothing; adding it after there
-- is history means the history has no group on it."
--
-- That is exactly right and it is the whole reason this is applied today rather than when the
-- feature is built. A column added later is not the same column: every row written before it
-- existed carries NULL, and NULL is indistinguishable from "spent by an individual". The group
-- attribution of the platform's first months would be permanently unrecoverable.
--
-- ⚠ NULL MEANS "NOT ON BEHALF OF A GROUP", and that reading is only safe because the column exists
-- from the first row. Nothing else in this file depends on it yet; no query filters on it; no
-- allowance is computed from it. It is a column being kept warm.
ALTER TABLE "LlmSpend" ADD COLUMN IF NOT EXISTS "groupId" TEXT;

-- Deliberately partial, like the user index: most rows will never carry a group.
CREATE INDEX IF NOT EXISTS "LlmSpend_group_idx" ON "LlmSpend" ("groupId", "createdAt")
  WHERE "groupId" IS NOT NULL;

-- ⚠ NO FOREIGN KEY, for the same reason as userId and ideaId: a disbanded group must not delete
-- the record of what it spent.

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- THE ADMIN VIEW — what Charlie asked to SEE, not merely to have stored
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- "the metering must surface in the Admin tab, not only in the database."
--
-- ⚠ THE SEARCH / EVERYTHING-ELSE SPLIT IS BY PASS PREFIX, AND THE RULE IS HERE SO IT CAN BE
-- ARGUED WITH. `search.*` passes (query expansion, the router) are the search subsystem's own model
-- spend. Everything else is the conversation, the build, the deepening, orientation and the graph.
--
-- ⚠⚠ AND A PASS THAT MATCHES NEITHER RULE IS 'unclassified', NOT 'other'. When a new pass is added
-- and nobody updates this view, it must appear as something a reader can see is unaccounted for,
-- rather than being silently folded into "everything else" and quietly inflating it.
CREATE OR REPLACE VIEW "LlmSpendKind" AS
SELECT date_trunc('day', "createdAt")::date AS day,
       CASE
         WHEN pass LIKE 'search.%'                                              THEN 'search'
         WHEN pass LIKE 'lex.%'    OR pass LIKE 'build.%'
           OR pass LIKE 'deepening.%' OR pass LIKE 'orientation.%'
           OR pass LIKE 'graph.%'                                               THEN 'everything-else'
         ELSE 'unclassified'
       END                                        AS kind,
       COUNT(*)                                   AS calls,
       COUNT(*) FILTER (WHERE failed)             AS failed_calls,
       COUNT(*) FILTER (WHERE unpriced)           AS unpriced_calls,
       SUM("tokensIn")                            AS tokens_in,
       SUM("tokensOut" + "tokensThinking")        AS tokens_out,
       -- A day-kind containing an unpriced call reports NULL, not a partial sum.
       CASE WHEN COUNT(*) FILTER (WHERE unpriced) > 0 THEN NULL
            ELSE SUM("estCostPence") END          AS pence
FROM "LlmSpend"
GROUP BY 1, 2;
