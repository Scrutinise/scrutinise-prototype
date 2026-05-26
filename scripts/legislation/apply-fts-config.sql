-- apply-fts-config.sql
-- Scrutinise — PostgreSQL thesaurus dictionary setup for legislation search.
--
-- WHEN TO RUN:
--   After deploying to a NEW self-hosted PostgreSQL instance where the thesaurus
--   file has been placed in the server's tsearch_data directory.
--
-- PREREQUISITES:
--   1. Copy scrutinise-web/prisma/pg_thesaurus/legislation_synonyms.ths
--      to $PGDATA/../share/tsearch_data/legislation_synonyms.ths on the server.
--   2. Connect to the target database (neondb or scrutinise DB) as a superuser.
--
-- MANAGED POSTGRESQL (Neon, RDS, Supabase):
--   The thesaurus template requires placing .ths files on the server filesystem.
--   This is NOT possible on managed PG services. On Neon, the legislation_english
--   configuration is created as a plain copy of 'english' (no thesaurus).
--   Synonym expansion is handled at the application layer in lib/search.ts instead.
--   This script is for self-hosted PostgreSQL deployments only.
--
-- RE-RUNNABLE: All statements use CREATE OR REPLACE / IF NOT EXISTS / DROP IF EXISTS.
--
-- Run: psql -d $DATABASE_URL -f scripts/legislation/apply-fts-config.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Create the thesaurus dictionary
-- ─────────────────────────────────────────────────────────────────────────────

-- The 'thesaurus' template requires the .ths file to be in $PGDATA/../share/tsearch_data/
-- The 'english_stem' dictionary is used to normalise words within the thesaurus.

DROP TEXT SEARCH DICTIONARY IF EXISTS legislation_thesaurus CASCADE;

CREATE TEXT SEARCH DICTIONARY legislation_thesaurus (
  TEMPLATE  = thesaurus,
  DictFile  = legislation_synonyms,  -- reads legislation_synonyms.ths from tsearch_data/
  Dictionary = english_stem          -- normalise via English stemming after thesaurus lookup
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Create or update the legislation_english FTS configuration
-- ─────────────────────────────────────────────────────────────────────────────

-- Create a fresh configuration if it doesn't exist (neon-fts-setup.ts may
-- have already created it as a plain copy of 'english').
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_ts_config WHERE cfgname = 'legislation_english'
  ) THEN
    CREATE TEXT SEARCH CONFIGURATION legislation_english ( COPY = english );
  END IF;
END;
$$;

-- Wire the thesaurus dictionary for the asciiword and word token types.
-- This means ordinary words in queries and documents are first checked against
-- the thesaurus, then passed through English stemming.
ALTER TEXT SEARCH CONFIGURATION legislation_english
  ALTER MAPPING FOR asciiword, hword, hword_part, word
  WITH legislation_thesaurus, english_stem;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Refresh FTS triggers to use legislation_english
-- ─────────────────────────────────────────────────────────────────────────────
-- These functions are also installed by neon-fts-setup.ts. Re-running here
-- ensures they use the correct configuration after the thesaurus is applied.

CREATE OR REPLACE FUNCTION update_legislation_section_fts()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."ftsVector" :=
    setweight(to_tsvector('legislation_english', coalesce(NEW."sectionTitle", '')), 'A') ||
    setweight(to_tsvector('legislation_english', coalesce(NEW."originalText",  '')), 'B');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_legislation_section_fts ON "LegislationSection";
CREATE TRIGGER trg_legislation_section_fts
  BEFORE INSERT OR UPDATE OF "sectionTitle", "originalText"
  ON "LegislationSection"
  FOR EACH ROW EXECUTE FUNCTION update_legislation_section_fts();

CREATE OR REPLACE FUNCTION update_operational_section_fts()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."ftsVector" :=
    setweight(to_tsvector('legislation_english', coalesce(NEW."pageTitle",     '')), 'A') ||
    setweight(to_tsvector('legislation_english', coalesce(NEW."extractedText", '')), 'B');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operational_section_fts ON "OperationalSection";
CREATE TRIGGER trg_operational_section_fts
  BEFORE INSERT OR UPDATE OF "pageTitle", "extractedText"
  ON "OperationalSection"
  FOR EACH ROW EXECUTE FUNCTION update_operational_section_fts();

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Rebuild ftsVector on all existing rows
-- ─────────────────────────────────────────────────────────────────────────────
-- After applying the thesaurus, existing ftsVector values must be recomputed
-- so synonym relationships are included in the GIN index.

-- LegislationSection (run in batches for large tables)
UPDATE "LegislationSection"
SET "ftsVector" =
  setweight(to_tsvector('legislation_english', coalesce("sectionTitle", '')), 'A') ||
  setweight(to_tsvector('legislation_english', coalesce("originalText",  '')), 'B');

-- OperationalSection
UPDATE "OperationalSection"
SET "ftsVector" =
  setweight(to_tsvector('legislation_english', coalesce("pageTitle",     '')), 'A') ||
  setweight(to_tsvector('legislation_english', coalesce("extractedText", '')), 'B');

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5: Rebuild GIN indexes
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS "LegislationSection_ftsVector_idx";
CREATE INDEX "LegislationSection_ftsVector_idx"
  ON "LegislationSection" USING GIN ("ftsVector");

DROP INDEX IF EXISTS "OperationalSection_ftsVector_idx";
CREATE INDEX "OperationalSection_ftsVector_idx"
  ON "OperationalSection" USING GIN ("ftsVector");

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 'legislation_thesaurus'   AS object, 'TEXT SEARCH DICTIONARY' AS type;
SELECT 'legislation_english'     AS object, 'TEXT SEARCH CONFIGURATION' AS type;

-- Test: 'gdpr' should return same results as 'data protection'
-- SELECT to_tsquery('legislation_english', 'gdpr');
-- Expected: returns 'data' & 'protect' (synonym expanded)
