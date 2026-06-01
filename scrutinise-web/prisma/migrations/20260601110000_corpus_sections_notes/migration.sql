-- Migration: corpus_sections_notes
-- Adds notes column to corpus_sections for act-level flags.
-- Primary use: notes = 'enacted-only' where TNA has no consolidated version.

ALTER TABLE "corpus_sections" ADD COLUMN "notes" TEXT;

CREATE INDEX "corpus_sections_notes_idx" ON "corpus_sections"("notes");
