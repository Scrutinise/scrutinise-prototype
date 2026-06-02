-- Migration: ingest_queue_fts
-- Adds central ingest work queue, compiledText column, and FTS vector column.

-- ── 1. ingest_queue ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ingest_queue" (
  "id"               TEXT        PRIMARY KEY,
  "corpus"           TEXT        NOT NULL,
  "docId"            TEXT        NOT NULL,
  "sourceType"       TEXT        NOT NULL,
  "priority"         INTEGER     NOT NULL DEFAULT 5,
  "status"           TEXT        NOT NULL DEFAULT 'pending',
  "claimedBy"        INTEGER,
  "claimedAt"        TIMESTAMPTZ,
  "completedAt"      TIMESTAMPTZ,
  "attempts"         INTEGER     NOT NULL DEFAULT 0,
  "lastError"        TEXT,
  "formatsAvailable" TEXT,
  "formatFound"      TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ingest_queue_status_priority"
  ON "ingest_queue" ("status", "priority", "id");

CREATE INDEX IF NOT EXISTS "ingest_queue_corpus"
  ON "ingest_queue" ("corpus");

CREATE INDEX IF NOT EXISTS "ingest_queue_claimed_by"
  ON "ingest_queue" ("claimedBy");

-- ── 2. corpus_sections — compiledText column (10 000 char cap for FTS) ────────

ALTER TABLE "corpus_sections"
  ADD COLUMN IF NOT EXISTS "compiledText" TEXT;

-- ── 3. corpus_sections — fts_vector column ────────────────────────────────────

ALTER TABLE "corpus_sections"
  ADD COLUMN IF NOT EXISTS "ftsVector" TSVECTOR;

-- GIN index for full-text search across the corpus
CREATE INDEX IF NOT EXISTS "corpus_sections_fts"
  ON "corpus_sections" USING GIN ("ftsVector");

-- ── 4. Trigger: keep fts_vector up to date on INSERT / UPDATE ─────────────────

CREATE OR REPLACE FUNCTION corpus_sections_fts_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."compiledText" IS NOT NULL THEN
    NEW."ftsVector" := to_tsvector('english', NEW."compiledText");
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS corpus_sections_fts_trigger ON "corpus_sections";
CREATE TRIGGER corpus_sections_fts_trigger
  BEFORE INSERT OR UPDATE OF "compiledText"
  ON "corpus_sections"
  FOR EACH ROW EXECUTE FUNCTION corpus_sections_fts_update();
