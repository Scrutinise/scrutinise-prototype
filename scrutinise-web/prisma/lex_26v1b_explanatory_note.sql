-- LEX 26-V1b §5 (decision 259) — the explanatory note as a document kind: one plain-English paragraph per subsection of a clause.
--
-- Widens action_document_kind_check by one value, EXPLANATORY_NOTE. Nothing else changes; no row is touched.
-- ⚠ Ships in the SAME push as the code that writes and reads the kind (lib/lex/action-documents-pure.ts DOCUMENT_KINDS), never before:
--   BRIEF_26V1b §0 and Charlie's instruction of 24 Oct ("schema or data moves ship with or after the code that reads them").
-- ⚠ Run `npx tsx scripts/whichdb.ts` first (CLAUDE.md §16) and read the constraint back after.

ALTER TABLE action_document DROP CONSTRAINT action_document_kind_check;
ALTER TABLE action_document ADD CONSTRAINT action_document_kind_check
  CHECK (kind IN ('DRAFT_CLAUSE', 'COLLISION_REPORT', 'CONSEQUENTIAL_SCHEDULE', 'CODE_TEXT', 'SPECIFICATION', 'COSTING', 'OPERATING_TEXT', 'BACKGROUND_NOTE', 'EXPLANATORY_NOTE'));
