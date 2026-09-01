-- ─────────────────────────────────────────────────────────────────────────────
-- 25-Q §1d — FieldRevision: what was there before a chat rewrite replaced it.
--
-- ⚠ A TABLE, NOT A COLUMN. A `priorText` column holds one previous version and loses the one
-- before it, so "an accepted rewrite supersedes, it does not delete" would hold for exactly one
-- edit and then quietly stop.
--
-- Idempotent. Neon ep-old-dust-aboxi69a (checked with _whichdb25q before applying).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "FieldRevision" (
  "id"             TEXT PRIMARY KEY,
  "ideaId"         TEXT NOT NULL,
  "fieldKey"       TEXT NOT NULL,
  "targetId"       TEXT,
  "targetNumber"   INTEGER,
  "previousText"   TEXT NOT NULL,
  "previousSource" TEXT NOT NULL,
  "newText"        TEXT NOT NULL,
  "acceptedById"   TEXT NOT NULL,
  "origin"         TEXT NOT NULL DEFAULT 'CHAT_REWRITE',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "FieldRevision"
    ADD CONSTRAINT "FieldRevision_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FieldRevision"
    ADD CONSTRAINT "FieldRevision_acceptedById_fkey"
    FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "FieldRevision_ideaId_fieldKey_idx" ON "FieldRevision" ("ideaId", "fieldKey");
CREATE INDEX IF NOT EXISTS "FieldRevision_ideaId_targetId_idx" ON "FieldRevision" ("ideaId", "targetId");
