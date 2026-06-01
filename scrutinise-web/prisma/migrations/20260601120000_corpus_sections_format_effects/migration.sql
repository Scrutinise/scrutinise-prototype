-- Migration: corpus_sections_format_effects
-- Documents addition of 'effects' as a valid value for the format column.
-- format is TEXT (not a PostgreSQL ENUM) so no structural change is required.
-- Valid format values: 'clml' | 'clml-unparsed' | 'html' | 'pdf' | 'unavailable' | 'effects'

COMMENT ON COLUMN "corpus_sections"."format" IS 'clml | clml-unparsed | html | pdf | unavailable | effects';
