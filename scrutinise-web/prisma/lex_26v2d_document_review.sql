-- LEX 26-V2d — the five review passes read DOCUMENTS and their parts (BRIEF_26V §7, decision 239). Additive only.
--
-- 1. document_review: one row per pass that read one version of one document. It is the record that a review RAN — including a review
--    that raised nothing (status RUN, issues 0, held_up says why) and one that failed (status FAILED, failure_reason in words) — so "never
--    reviewed" and "reviewed, nothing raised" cannot look the same (CLAUDE.md §23.2). Never updated after it is written; never deleted by the
--    product (CASCADE only so a scratch copy's documents can be removed by deleteScratch).
-- 2. "DeepeningIssue"."reviewId": the review an issue came from. With it the issue carries action, document and part (26-V2c's columns) AND
--    the version read. ON DELETE SET NULL: an issue is never deleted because the record of its review went.
-- ⚠ Run `npx tsx scripts/whichdb.ts` first (CLAUDE.md §16) and read the table and column back after. Apply with or after the code (CCh 24 Oct (6)).

CREATE TABLE IF NOT EXISTS document_review (
  id             text PRIMARY KEY,
  idea_id        text NOT NULL REFERENCES "Idea"(id) ON DELETE CASCADE,
  document_id    text NOT NULL REFERENCES action_document(id) ON DELETE CASCADE,
  v              integer NOT NULL CHECK (v >= 1),
  pass_key       text NOT NULL CHECK (pass_key IN ('EVIDENCE_PRECEDENT', 'LEGAL', 'FINANCIAL', 'POLITICAL_RISK', 'STATUTORY_CONSEQUENCES')),
  status         text NOT NULL CHECK (status IN ('RUN', 'FAILED')),
  issues         integer NOT NULL DEFAULT 0 CHECK (issues >= 0),
  held_up        text,
  falls          text,
  failure_reason text,
  pence          numeric,
  seconds        numeric,
  by_user_id     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_review_failed_check CHECK ((status = 'FAILED') = (failure_reason IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS document_review_document_idx ON document_review (document_id, pass_key, v);
CREATE INDEX IF NOT EXISTS document_review_idea_idx ON document_review (idea_id);

ALTER TABLE "DeepeningIssue" ADD COLUMN IF NOT EXISTS "reviewId" text REFERENCES document_review(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "DeepeningIssue_reviewId_idx" ON "DeepeningIssue" ("reviewId");
