-- ─────────────────────────────────────────────────────────────────────────────
-- corpus_acts — Act-level metadata over the legislation corpora (SPRINT §1).
--
-- WHY: everything in the search stack below this is SECTION-level. corpus_sections
-- holds 1,278,546 legislation sections but has no notion of the instrument they
-- belong to: no title, no year, no jurisdiction, no section count. Anything that
-- wants to talk about an Act rather than a provision — the browse page's filters, a
-- "which Act is this?" lookup, per-Act coverage reporting — has had to fall back to
-- the legacy `LegislationItem` table, which is a different and only partly
-- overlapping population (see the coverage note at the bottom).
--
-- WHAT IT IS: one row per instrument, keyed on the corpus `gid` (`ukpga/2011/20`)
-- or, for eur-lex, the CELEX id (`31973R1057`). It is a DERIVED table — a
-- materialised join of corpus_sections and LegislationItem, rebuilt by
-- `scripts/ingest/search/build-act-metadata.ts`. Nothing writes to it by hand and
-- nothing depends on it for correctness of the section data; dropping and rebuilding
-- it is always safe.
--
-- POPULATION: the UNION of (a) every gid appearing in the legislation corpora and
-- (b) every row in LegislationItem. Union, not intersection, deliberately — (a)
-- alone would drop the 40,169 LegislationItem entries the browse page shows today,
-- and (b) alone would drop the 21,753 corpus instruments that have never had a
-- LegislationItem row. `in_corpus` / `in_legislation_item` say which side each row
-- came from, so a caller can ask for "things that are actually searchable"
-- (in_corpus) without the table having silently made that choice for it.
--
-- TITLES ARE INCOMPLETE AND THE TABLE SAYS SO. Titles exist only where a
-- LegislationItem row exists: 95,362 of the 117,115 legislation.gov.uk instruments
-- in the corpus (81.4%), and 0 of the 90,260 eur-lex CELEX documents (a separate id
-- space that was never in LegislationItem). The untitled remainder is not random —
-- it is newer Acts (ukpga/2026/*), pre-1963 regnal-year Acts (ukpga/Edw7/1/5) and
-- older SIs. `title_source` records where each title came from, so the gap is
-- queryable rather than invisible, and a later title-fetch pass can fill it without
-- touching anything else.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS corpus_acts (
  -- `ukpga/2011/20`, `uksi/1999/1095`, `eur/2011/507`, or a CELEX id `31973R1057`.
  gid                  text PRIMARY KEY,

  -- Human-readable title. NULL where no LegislationItem row exists — see above.
  title                text,
  -- 'legislation-item' when titled, NULL when not. Never invented.
  title_source         text,

  -- First gid segment: ukpga | uksi | asp | ssi | nisr | eur | eudn | … ; 'celex'
  -- for eur-lex ids, which have no segments.
  leg_type             text,
  -- Calendar year. NULL for regnal-year gids (`ukpga/Edw7/1/5`) — there is no year
  -- in the identifier and guessing one from the monarch would be fabrication.
  year                 integer,
  -- Instrument number within the year, or the regnal remainder when year is NULL.
  number               text,

  -- Derived from the gid's type prefix, NOT from corpus_sections.jurisdiction —
  -- that column is the literal string 'uk' on all 1,278,546 legislation rows and so
  -- cannot distinguish an Act of the Scottish Parliament from a UK public general
  -- Act. LegislationItem.jurisdiction is preferred where present.
  jurisdiction         text,

  -- The legacy LegislationItem.id (uuid) where one exists, NULL otherwise.
  -- Carried because /legislation/[itemId] resolves ONLY by that uuid: the browse
  -- page's links, and the detail page behind them, are uuid-addressed. Without this
  -- column, serving browse from corpus_acts would either break every link or
  -- require a second lookup per row.
  legislation_item_id  text,

  -- Uppercase instrument type as the UI already renders it (UKPGA/UKSI/ASP/…).
  -- From LegislationItem where present, else the uppercased gid prefix.
  legislation_type     text,
  -- LegislationItem's own section counts, carried so the browse page's
  -- "N/M sections compiled" line keeps meaning exactly what it meant before.
  item_section_count   integer,
  item_compiled_count  integer,

  -- Which corpus holds the sections (NULL for LegislationItem-only rows).
  corpus               text,
  -- Compiled sections present in corpus_sections for this gid. 0 => not searchable.
  section_count        integer NOT NULL DEFAULT 0,
  -- Summed wordCount over those sections. NULL where unknown.
  word_count           bigint,

  -- Which source(s) this row was built from.
  in_corpus            boolean NOT NULL DEFAULT false,
  in_legislation_item  boolean NOT NULL DEFAULT false,

  -- Earliest/latest itemDate across the instrument's sections.
  first_date           date,
  last_date            date,

  refreshed_at         timestamptz NOT NULL DEFAULT now()
);

-- Columns added after the table first shipped. CREATE TABLE IF NOT EXISTS is a
-- no-op on an existing table and would silently skip them, so each is added
-- idempotently here. This file must stay re-runnable end to end.
ALTER TABLE corpus_acts ADD COLUMN IF NOT EXISTS legislation_item_id  text;
ALTER TABLE corpus_acts ADD COLUMN IF NOT EXISTS legislation_type     text;
ALTER TABLE corpus_acts ADD COLUMN IF NOT EXISTS item_section_count   integer;
ALTER TABLE corpus_acts ADD COLUMN IF NOT EXISTS item_compiled_count  integer;

-- Browse filters (type / year / jurisdiction) and the "only what we can serve" cut.
CREATE INDEX IF NOT EXISTS corpus_acts_year_idx         ON corpus_acts (year DESC);
CREATE INDEX IF NOT EXISTS corpus_acts_leg_type_idx     ON corpus_acts (leg_type);
CREATE INDEX IF NOT EXISTS corpus_acts_jurisdiction_idx ON corpus_acts (jurisdiction);
CREATE INDEX IF NOT EXISTS corpus_acts_in_corpus_idx    ON corpus_acts (in_corpus) WHERE in_corpus;
-- The browse page's ordering (year DESC, title ASC) over its own population.
CREATE INDEX IF NOT EXISTS corpus_acts_browse_idx
  ON corpus_acts (year DESC, title ASC) WHERE in_legislation_item;

-- The browse page matches titles with a substring `contains`, which no btree can
-- serve — it was a full scan of LegislationItem on every keystroke. A trigram GIN
-- index makes the same query index-served, so the semantics the page already has
-- get faster rather than changing under it.
CREATE INDEX IF NOT EXISTS corpus_acts_title_trgm_idx
  ON corpus_acts USING gin (title gin_trgm_ops);
