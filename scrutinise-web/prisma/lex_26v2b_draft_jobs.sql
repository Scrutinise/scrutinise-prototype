-- LEX 26-V2b (decision 243, BRIEF_26V §5) — "Draft what this heading needs" runs on the worker: one row per document to draft or generate.
--
-- A run is the rows sharing run_id. The worker claims the oldest QUEUED row (FOR UPDATE SKIP LOCKED), drafts it, saves the result as a
-- PROPOSAL on the action's document, and settles the row DONE / SKIPPED / FAILED with its outcome in words. A worker killed mid-row leaves
-- it RUNNING; the sweep puts it back to QUEUED (attempts counted; failed after two), so a run resumes at the next undone row.
-- price_pence is the MEASURED price the owner was shown and agreed to; pence is what the row actually spent.
-- ⚠ Ships in the SAME push as the code that reads it (lib/lex/document-drafting.ts), applied just before that push, never earlier.
-- ⚠ Run `npx tsx scripts/whichdb.ts` first (CLAUDE.md §16) and read the table back after.

CREATE TABLE IF NOT EXISTS document_draft_job (
  id           text PRIMARY KEY,
  run_id       text NOT NULL,
  idea_id      text NOT NULL REFERENCES "Idea"(id) ON DELETE CASCADE,
  action_id    text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('DRAFT_CLAUSE', 'COLLISION_REPORT', 'CONSEQUENTIAL_SCHEDULE', 'CODE_TEXT', 'SPECIFICATION', 'COSTING', 'OPERATING_TEXT', 'BACKGROUND_NOTE', 'EXPLANATORY_NOTE')),
  seq          integer NOT NULL,
  status       text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED', 'STOPPED')),
  price_pence  numeric,
  pence        numeric,
  outcome      text,
  d_number     text,
  attempts     integer NOT NULL DEFAULT 0,
  user_id      text,
  worker       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  claimed_at   timestamptz,
  finished_at  timestamptz
);
CREATE INDEX IF NOT EXISTS document_draft_job_queue_idx ON document_draft_job (status, created_at, seq);
CREATE INDEX IF NOT EXISTS document_draft_job_run_idx ON document_draft_job (idea_id, run_id);
-- One live row per action and kind: a second press while the first is waiting or running queues nothing twice.
CREATE UNIQUE INDEX IF NOT EXISTS document_draft_job_live_unique ON document_draft_job (action_id, kind) WHERE status IN ('QUEUED', 'RUNNING');
