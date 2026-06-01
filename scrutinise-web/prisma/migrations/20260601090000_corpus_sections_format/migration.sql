-- Migration: corpus_sections_format
-- Adds format and xmlPreview columns to corpus_sections.
-- format: 'clml' | 'clml-unparsed' | 'html' | 'pdf' | 'unavailable'
-- xmlPreview: first 200 chars of raw XML for clml-unparsed rows (used in scheduler email)

ALTER TABLE "corpus_sections" ADD COLUMN "format" TEXT;
ALTER TABLE "corpus_sections" ADD COLUMN "xmlPreview" TEXT;

CREATE INDEX "corpus_sections_format_idx" ON "corpus_sections"("format");
