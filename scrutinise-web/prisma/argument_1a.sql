-- argument_1a.sql — ARGUMENT 1A §2. WHERE A PROPAGATED TAG IS STORED.
--
-- ⚠ ADDITIVE AND HAND-WRITTEN. Nothing here alters an existing table, and this file is NOT
-- generated from schema.prisma. `prisma migrate diff` must never be run against this database
-- (docs/CLAUDE.md §21) — it cannot see raw tables and proposes dropping what it cannot see.
--
-- ⚠ NO PARTIAL OR EXPRESSION INDEX, DELIBERATELY. §21's hazard register exists because Prisma
-- cannot declare either and proposes dropping them as drift. The natural unique key here would be
-- (chunk_id, tag, method, COALESCE(evidence,'')) — so `evidence` is NOT NULL DEFAULT '' instead,
-- which makes the index four plain columns and keeps this table off the register entirely.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHAT A ROW MEANS, AND WHAT IT DOES NOT
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- A row says: *this passage was RETRIEVED as a candidate for this move, by this method, at this
-- score.* It does not say the passage makes the argument. The brief's reframing is the whole
-- design: **an argument tag is a retrieval filter, not a published claim** — it narrows 13.7
-- million passages to a few dozen worth reading, and the model writing the answer then reads the
-- actual words. Nothing in this table may be shown to a user as a property of a document.
--
-- ⚠ THEREFORE `method` AND `evidence` ARE NOT OPTIONAL. The position graph's rebuild established
-- that an estimate stored without its provenance becomes a fact the next time somebody reads it.
--   method   'seed:v1'      a human read this passage and confirmed the move
--            'prototype:v1' nearest-neighbour of a seed in the meaning index
--            'pattern:v1'   a deterministic phrase matched the stored body
--   evidence the probe text, or the pattern that fired. Never blank for a machine method.
--
-- ⚠ DATABASE HEADROOM, MEASURED BEFORE WRITING ANYTHING: 18.85 GiB on 2026-08-27, which is ABOVE
-- the 17.5 GiB ops alert line GRAPH 3A recorded at 99.2%. This table is a pilot and holds
-- thousands of rows (~1 MB). A corpus-wide propagation would not be, and is a decision rather than
-- a next step.

CREATE TABLE IF NOT EXISTS argument_tag (
  id          bigserial PRIMARY KEY,
  -- The PASSAGE, which is the unit the design fixes: '<sectionId>#<k>'. For a section under 4,096
  -- characters the chunker emits one chunk and this is '<sectionId>#0'.
  chunk_id    text NOT NULL,
  -- The parent section, so a tag joins to corpus_sections without parsing the chunk id.
  section_id  text NOT NULL,
  corpus      text NOT NULL,
  tag         text NOT NULL,
  method      text NOT NULL,
  -- Similarity for 'prototype:v1'. NULL for a pattern or a human seed, because those have no score
  -- and a zero would read as "scored, and badly".
  score       double precision,
  evidence    text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS argument_tag_unique
  ON argument_tag (chunk_id, tag, method, evidence);
CREATE INDEX IF NOT EXISTS argument_tag_tag_score_idx
  ON argument_tag (tag, score DESC);
CREATE INDEX IF NOT EXISTS argument_tag_section_idx
  ON argument_tag (section_id);
