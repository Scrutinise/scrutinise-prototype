-- ─────────────────────────────────────────────────────────────────────────────
-- LEX 26-X X2 (decision 309, BRIEF_26X §5d) — A BRIEF ON EVERY DRAFT. No new table and no new column: the Brief is stored as versions
-- of the action's draft document, beside its VERSION and PROPOSAL rows (CCh-Lex 5 Nov (1): "your three calls stand", call 2).
--
--   role BRIEF           one saved Brief, numbered 1, 2, … in its own series. Appended, never edited ("every save is a version").
--   role BRIEF_PROPOSAL  Lex's prefill (or a proposed split of the Action details, §5e) BESIDE the Brief; answered ACCEPTED / DISMISSED, kept.
--   status BRIEFED       a document that has a Brief and no draft yet (a Brief exists before any draft, §0 call 2).
--
-- A draft clause's per-kind fields are the 26-U drafting instruction, READ IN PLACE on its VERSION rows (Charlie, 7 Nov: "read in place"),
-- so no instruction is copied and no existing row is rewritten. Every widening below is additive: code that predates it still passes.
-- Applied to Neon ep-old-dust-aboxi69a after whichdb, before the code that writes these values is pushed (with it, in one commit).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE action_document_version DROP CONSTRAINT action_document_version_role_check;
ALTER TABLE action_document_version ADD CONSTRAINT action_document_version_role_check
  CHECK (role IN ('VERSION', 'PROPOSAL', 'BRIEF', 'BRIEF_PROPOSAL'));

-- an answer belongs to a proposal of either kind, never to a version or a saved Brief
ALTER TABLE action_document_version DROP CONSTRAINT action_document_version_answer_role_check;
ALTER TABLE action_document_version ADD CONSTRAINT action_document_version_answer_role_check
  CHECK (answer IS NULL OR role IN ('PROPOSAL', 'BRIEF_PROPOSAL'));

ALTER TABLE action_document DROP CONSTRAINT action_document_status_check;
ALTER TABLE action_document ADD CONSTRAINT action_document_status_check
  CHECK (status IN ('BRIEFED', 'DRAFTED', 'ACCEPTED', 'SUPERSEDED'));

COMMIT;
