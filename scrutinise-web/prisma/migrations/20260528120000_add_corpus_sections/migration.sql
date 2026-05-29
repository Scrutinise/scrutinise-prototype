-- Migration: add_corpus_sections
-- Tracks every section ingested by the 10-worker corpus pipeline.
-- Compiled text and raw content live in R2 (r2Key / r2RawKey point there).
-- Never store compiled text in this table.

CREATE TABLE "corpus_sections" (
    "id"          TEXT NOT NULL,
    "corpus"      TEXT NOT NULL,
    "sourceUrl"   TEXT,
    "r2Key"       TEXT,
    "r2RawKey"    TEXT,
    "compiledAt"  TIMESTAMP(3),
    "wordCount"   INTEGER,
    "status"      TEXT NOT NULL DEFAULT 'pending',
    "errorMsg"    TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corpus_sections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "corpus_sections_corpus_idx" ON "corpus_sections"("corpus");
CREATE INDEX "corpus_sections_status_idx" ON "corpus_sections"("status");
