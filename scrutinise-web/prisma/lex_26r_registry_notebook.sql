-- LEX 26-R — THE SOURCE REGISTRY (26-E §3, never built until now) AND THE RESEARCH NOTEBOOK. Additive only.
--
-- IdeaSource: ONE numbered registry per idea. A note cites an entry; a document cites the same entry; NOTHING IS NUMBERED TWICE.
--   · The number is assigned by the DATABASE (trigger below), one past the highest ever used in the idea — archived rows keep theirs, so a
--     number is never reused: a "[Ref: 7]" that silently becomes another document is worse than a gap (26-E §3e, as the policy numbers).
--   · A source is never deleted; "delete" archives it (archivedAt), as uploads do (26-J).
--   · It points AT the three places a source already lived, and replaces none of them:
--       corpusKey  → IdeaSourceDecision.sourceKey / EvidenceItem.sourceId   (a corpus source)
--       materialId → IdeaUserMaterial.id                                    (an upload or a fetched link)
--     Each is unique per idea, so syncing the registry from those tables is idempotent. NULLs do not collide.
-- ResearchNote: a quote, a source and a comment (BRIEF_26R §1) — author, status and a private layer from day one (§8).
-- ResearchNoteReply: others reply beneath a note; nobody edits another person's comment.
--
-- ⚠ No partial or expression index here, so nothing for CLAUDE.md §21's register.

CREATE TABLE IF NOT EXISTS "IdeaSource" (
  "id"          TEXT PRIMARY KEY,
  "ideaId"      TEXT NOT NULL REFERENCES "Idea"("id") ON DELETE CASCADE,
  "number"      INTEGER,
  "kind"        TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "url"         TEXT,
  "citation"    TEXT,
  "sourceType"  TEXT,
  "author"      TEXT,
  "publishedAt" TEXT,
  "snippet"     TEXT,
  "readStatus"  TEXT NOT NULL DEFAULT 'NOT_READ',
  "readNote"    TEXT,
  "corpusKey"   TEXT,
  "materialId"  TEXT,
  "addedBy"     TEXT,
  "archivedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "IdeaSource_ideaId_number_key"     ON "IdeaSource"("ideaId", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "IdeaSource_ideaId_corpusKey_key"  ON "IdeaSource"("ideaId", "corpusKey");
CREATE UNIQUE INDEX IF NOT EXISTS "IdeaSource_ideaId_materialId_key" ON "IdeaSource"("ideaId", "materialId");
CREATE INDEX        IF NOT EXISTS "IdeaSource_ideaId_idx"            ON "IdeaSource"("ideaId");

CREATE OR REPLACE FUNCTION lex_source_number() RETURNS trigger AS $$
BEGIN
  IF NEW."number" IS NULL THEN
    SELECT COALESCE(MAX("number"), 0) + 1 INTO NEW."number" FROM "IdeaSource" WHERE "ideaId" = NEW."ideaId";
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS lex_source_number_trg ON "IdeaSource";
CREATE TRIGGER lex_source_number_trg BEFORE INSERT ON "IdeaSource" FOR EACH ROW EXECUTE FUNCTION lex_source_number();

CREATE TABLE IF NOT EXISTS "ResearchNote" (
  "id"             TEXT PRIMARY KEY,
  "ideaId"         TEXT NOT NULL REFERENCES "Idea"("id") ON DELETE CASCADE,
  "sourceId"       TEXT NOT NULL REFERENCES "IdeaSource"("id") ON DELETE RESTRICT,
  "quote"          TEXT,
  "quoteLocation"  TEXT,
  "comment"        TEXT,
  "stance"         TEXT NOT NULL DEFAULT 'UNDECIDED',
  "bearsOn"        JSONB NOT NULL DEFAULT '[]',
  "tags"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "heading"        TEXT,
  "importance"     INTEGER,
  "authorId"       TEXT NOT NULL,
  "authorKind"     TEXT NOT NULL DEFAULT 'USER',
  "status"         TEXT NOT NULL DEFAULT 'IN_RECORD',
  "setAsideReason" TEXT,
  "setAsideBy"     TEXT,
  "setAsideAt"     TIMESTAMP(3),
  "mineOnly"       BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ResearchNote_ideaId_idx"         ON "ResearchNote"("ideaId");
CREATE INDEX IF NOT EXISTS "ResearchNote_ideaId_source_idx"  ON "ResearchNote"("ideaId", "sourceId");
CREATE INDEX IF NOT EXISTS "ResearchNote_ideaId_author_idx"  ON "ResearchNote"("ideaId", "authorId");

CREATE TABLE IF NOT EXISTS "ResearchNoteReply" (
  "id"        TEXT PRIMARY KEY,
  "noteId"    TEXT NOT NULL REFERENCES "ResearchNote"("id") ON DELETE CASCADE,
  "authorId"  TEXT NOT NULL,
  "text"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ResearchNoteReply_noteId_idx" ON "ResearchNoteReply"("noteId");
