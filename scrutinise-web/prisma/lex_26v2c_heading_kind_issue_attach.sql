-- LEX 26-V2c — a heading has a KIND (268), and an issue is attached to the action, document and part it concerns (BRIEF_26V §7, 239).
--
-- 1. "ActionHeading".kind: the type of instrument the heading's actions make (24 Oct (4, revised): Charlie's eight). PLATFORM derives a
--    specification for every action under it (lib/lex/action-documents-pure.ts `needsSpecification`). Set by the owner; NOTHING is seeded
--    here ("no name match"). Lex proposes a kind for existing headings into proposedKind, for the owner to accept.
-- 2. "DeepeningIssue": action / document / part, who attached it and why. All null = on the proposal as a whole (every row before this).
--    FKs ON DELETE SET NULL: an issue is never deleted because the thing it was attached to went. A document needs its action; a part needs
--    its document.
-- ⚠ Ships in the SAME push as the code that reads it, applied just before that push, never earlier.
-- ⚠ Run `npx tsx scripts/whichdb.ts` first (CLAUDE.md §16) and read the columns back after.

ALTER TABLE "ActionHeading" ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE "ActionHeading" ADD COLUMN IF NOT EXISTS "proposedKind" text;
ALTER TABLE "ActionHeading" ADD COLUMN IF NOT EXISTS "proposedKindReason" text;
ALTER TABLE "ActionHeading" DROP CONSTRAINT IF EXISTS "ActionHeading_kind_check";
ALTER TABLE "ActionHeading" ADD CONSTRAINT "ActionHeading_kind_check" CHECK (
  (kind IS NULL OR kind IN ('PRIMARY_LEGISLATION', 'CODE', 'MANAGEMENT_CODE', 'PLATFORM', 'BUDGET', 'TRANSPARENCY', 'GUIDANCE_PILOT', 'OTHER'))
  AND ("proposedKind" IS NULL OR "proposedKind" IN ('PRIMARY_LEGISLATION', 'CODE', 'MANAGEMENT_CODE', 'PLATFORM', 'BUDGET', 'TRANSPARENCY', 'GUIDANCE_PILOT', 'OTHER'))
);

ALTER TABLE "DeepeningIssue" ADD COLUMN IF NOT EXISTS "actionId" text REFERENCES "LexCoherentAction"(id) ON DELETE SET NULL;
ALTER TABLE "DeepeningIssue" ADD COLUMN IF NOT EXISTS "documentId" text REFERENCES action_document(id) ON DELETE SET NULL;
ALTER TABLE "DeepeningIssue" ADD COLUMN IF NOT EXISTS "partN" integer;
ALTER TABLE "DeepeningIssue" ADD COLUMN IF NOT EXISTS "attachedBy" text;
ALTER TABLE "DeepeningIssue" ADD COLUMN IF NOT EXISTS "attachReason" text;
ALTER TABLE "DeepeningIssue" ADD COLUMN IF NOT EXISTS "attachedAt" timestamp(3);
ALTER TABLE "DeepeningIssue" DROP CONSTRAINT IF EXISTS "DeepeningIssue_attach_check";
ALTER TABLE "DeepeningIssue" ADD CONSTRAINT "DeepeningIssue_attach_check" CHECK (
  ("documentId" IS NULL OR "actionId" IS NOT NULL)
  AND ("partN" IS NULL OR ("documentId" IS NOT NULL AND "partN" >= 1))
  AND ("attachedBy" IS NULL OR "attachedBy" IN ('LEX', 'OWNER'))
  AND (("actionId" IS NULL) = ("attachedBy" IS NULL))
);
CREATE INDEX IF NOT EXISTS "DeepeningIssue_actionId_idx" ON "DeepeningIssue" ("actionId");
CREATE INDEX IF NOT EXISTS "DeepeningIssue_documentId_idx" ON "DeepeningIssue" ("documentId");

-- 3. ⚠ ON DELETE SET NULL clears only the FK column, so a deleted document left "partN" behind and a deleted action left "attachedBy"
--    behind, and the check above refused the delete (found by check:lex-26v2c's cleanup, 24 Oct). Postgres cannot SET NULL a column
--    outside the key, so this trigger clears what hangs off a cleared key, before the check reads the row: no action → back on the
--    proposal, all placement fields cleared; no document → no part.
CREATE OR REPLACE FUNCTION deepening_issue_detach() RETURNS trigger AS $$
BEGIN
  IF NEW."actionId" IS NULL THEN
    NEW."documentId" := NULL; NEW."partN" := NULL; NEW."attachedBy" := NULL; NEW."attachReason" := NULL; NEW."attachedAt" := NULL;
  ELSIF NEW."documentId" IS NULL THEN
    NEW."partN" := NULL;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "DeepeningIssue_detach" ON "DeepeningIssue";
CREATE TRIGGER "DeepeningIssue_detach" BEFORE UPDATE OF "actionId", "documentId" ON "DeepeningIssue"
  FOR EACH ROW EXECUTE FUNCTION deepening_issue_detach();
