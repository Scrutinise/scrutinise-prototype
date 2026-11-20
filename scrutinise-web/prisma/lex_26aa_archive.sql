-- LEX 26-AA item 1 (decisions 183/196; approved by Charlie, 20 Nov 2026) — the last hard deletes of user content become ARCHIVE WITH RESTORE.
-- ADDITIVE ONLY: nullable columns and one defaulted array. Nothing is dropped, renamed or rewritten; every existing row stays live (archivedAt NULL).
-- No partial or expression index, so the CLAUDE.md §21 hazard register is unchanged.
-- Read from information_schema on ep-old-dust-aboxi69a before this file was written: none of these columns existed.
-- Apply with `npm run whichdb -- DIRECT_URL` first (§16); committed with schema.prisma in one commit, before any code reads it.
--
-- On each table:
--   archivedAt     when it was removed. NULL = live. lib/prisma.ts hides archived rows from direct reads unless the query names archivedAt.
--   archivedById   the User.id who removed it. No foreign key, on purpose: a removal record outlives a deleted account.
--   archiveReason  why: REMOVED (the owner pressed "Remove (can be restored)", or asked Lex to) | SOURCE_ARCHIVED (EvidenceItem only: its
--                  filed source was archived, and restoring the source restores it) | UNGROUPED (IdeaGroup only).
-- Restore clears all three. A row's own status (an ACCEPTED finding, a CHOSEN policy) is never changed by archiving, so a restore returns it as it was.
-- Numbers are never reused: PolicyOption.number's writer (nextNumberFor) reads archived rows too.
--
-- PolicyOption — A1, a guiding-policy candidate (FieldsPanel "Delete").
ALTER TABLE "PolicyOption"          ADD COLUMN IF NOT EXISTS "archivedAt"    TIMESTAMP(3);
ALTER TABLE "PolicyOption"          ADD COLUMN IF NOT EXISTS "archivedById"  TEXT;
ALTER TABLE "PolicyOption"          ADD COLUMN IF NOT EXISTS "archiveReason" TEXT;
-- IdeaNote — A2, a private note (NotesPanel "Delete").
ALTER TABLE "IdeaNote"              ADD COLUMN IF NOT EXISTS "archivedAt"    TIMESTAMP(3);
ALTER TABLE "IdeaNote"              ADD COLUMN IF NOT EXISTS "archivedById"  TEXT;
ALTER TABLE "IdeaNote"              ADD COLUMN IF NOT EXISTS "archiveReason" TEXT;
-- CoherentActionSection — A3, a law section linked to an action, with the owner's proposed wording.
ALTER TABLE "CoherentActionSection" ADD COLUMN IF NOT EXISTS "archivedAt"    TIMESTAMP(3);
ALTER TABLE "CoherentActionSection" ADD COLUMN IF NOT EXISTS "archivedById"  TEXT;
ALTER TABLE "CoherentActionSection" ADD COLUMN IF NOT EXISTS "archiveReason" TEXT;
-- EvidenceItem — A4, the findings of a filed source the owner archives (ACCEPTED ones included).
ALTER TABLE "EvidenceItem"          ADD COLUMN IF NOT EXISTS "archivedAt"    TIMESTAMP(3);
ALTER TABLE "EvidenceItem"          ADD COLUMN IF NOT EXISTS "archivedById"  TEXT;
ALTER TABLE "EvidenceItem"          ADD COLUMN IF NOT EXISTS "archiveReason" TEXT;
-- IdeaGroup — My Ideas "Ungroup". The ideas still return to the ungrouped list; the group row is kept, with the ideas it held, so a restore can
-- put them back (an idea moved to another group since is left where it is).
ALTER TABLE "IdeaGroup"             ADD COLUMN IF NOT EXISTS "archivedAt"      TIMESTAMP(3);
ALTER TABLE "IdeaGroup"             ADD COLUMN IF NOT EXISTS "archivedById"    TEXT;
ALTER TABLE "IdeaGroup"             ADD COLUMN IF NOT EXISTS "archiveReason"   TEXT;
ALTER TABLE "IdeaGroup"             ADD COLUMN IF NOT EXISTS "archivedIdeaIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
