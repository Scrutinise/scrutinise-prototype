-- corpus_census — the table the daily email reads instead of corpus_targets.est_sections.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHY THIS TABLE EXISTS
--
-- `corpus_targets.est_sections` was, for 41 of 71 live collections as at 27 Aug 2026, a copy of the
-- collection's own row count — six separate scripts in this repository do a variant of
-- `UPDATE corpus_targets SET est_sections = <compiledCount>, est_is_confirmed = true`. A denominator
-- equal to its own numerator is not a denominator: `held / est` is 100% by construction, for any
-- corpus, including an empty one. The daily email printed `[100% complete]` for 62 of 77
-- collections on that arithmetic and Charlie reported "corpus complete" on the strength of it.
--
-- This table holds a number that came from SOMEWHERE ELSE — the publisher's own index, walked, with
-- the walk stored on disk and dated. `est_sections` counts SECTIONS (ours); this counts UNITS (the
-- publisher's): an Act, an SI, a sitting-day file, a judgment, a decision, a report, a petition.
--
-- ⚠ THE CONSTRAINTS BELOW ARE THE POINT. A table that lets a MEASURED row exist without a
-- denominator is the same tautology one layer along, so the schema refuses it rather than trusting
-- every future writer to remember. Watched failing before it was trusted:
-- `apply-schema.ts --self-test` inserts a MEASURED row with published_units NULL and requires the
-- INSERT to be rejected.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS corpus_census (
  -- The census key. Usually a corpus_targets.corpus_key, but NOT a foreign key on purpose: the
  -- census must be able to name a publisher collection we hold NOTHING of (apni, ukcm, ukci, ukla
  -- have published_units > 0 and held_units = 0 and no corpus_targets row at all), and it must be
  -- able to split one corpus key into several reportable rows.
  corpus_key          text PRIMARY KEY,

  -- MEASURED  — published_units came from a publisher walk stored on disk with a date.
  -- CLAIMED   — a target exists but its provenance is unproven.
  -- DECLARED  — no publisher index exists; we wrote the scope in docs/CORPUS_SCOPE.md.
  -- UNMEASURED / NOT_STARTED / BLOCKED / RETIRED — no percentage may be printed.
  state               text NOT NULL,

  unit                text NOT NULL,          -- what one unit IS, in the publisher's terms
  method              text NOT NULL,          -- 'entry walk of <url pattern>', in words
  walked_at           timestamptz,
  published_units     integer,
  held_units          integer,
  hollow_units        integer NOT NULL DEFAULT 0,

  -- Bounded on purpose: the full list lives in the artefact named by walk_artifact_path. A census
  -- row that carries 27,000 ids makes the table unreadable and the email slow, and the artefact is
  -- the thing with the date on it anyway.
  absent_ids          jsonb NOT NULL DEFAULT '[]'::jsonb,
  absent_total        integer NOT NULL DEFAULT 0,

  notes               text,
  walk_artifact_path  text,
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT corpus_census_state_known CHECK (
    state IN ('MEASURED','CLAIMED','DECLARED','UNMEASURED','NOT_STARTED','BLOCKED','RETIRED')),

  -- A MEASURED row without a denominator is the defect this table was built to end.
  CONSTRAINT corpus_census_measured_has_denominator CHECK (
    state <> 'MEASURED' OR (published_units IS NOT NULL AND held_units IS NOT NULL
                            AND walked_at IS NOT NULL AND walk_artifact_path IS NOT NULL)),

  -- DECLARED prints a percentage too, so it needs the same two numbers — it just does not claim
  -- the denominator came from a publisher.
  CONSTRAINT corpus_census_declared_has_denominator CHECK (
    state <> 'DECLARED' OR (published_units IS NOT NULL AND held_units IS NOT NULL)),

  -- ⚠ THE SELF-REFERENTIAL GUARD, IN THE SCHEMA. A MEASURED denominator that exactly equals the
  -- numerator is the signature of a target copied from a row count. It CAN be legitimate — a
  -- collection genuinely complete to the last unit — so this is not a bar; it is a requirement to
  -- say so, which is exactly what the old rebaseline scripts never did.
  --
  -- ⚠⚠ IT REQUIRES A SPECIFIC TOKEN, NOT MERELY A NON-NULL `notes`. The first version of this
  -- constraint accepted any non-null notes, and every walker writes notes — so on its first real
  -- run it waved through SIX exact matches without a murmur. A guard satisfied by something the
  -- writer was always going to do anyway is not a guard. `EXACT:` has to be typed deliberately,
  -- and the sentence after it is the evidence that the two numbers came from different places.
  CONSTRAINT corpus_census_exact_match_explained CHECK (
    state <> 'MEASURED' OR published_units IS DISTINCT FROM held_units
    -- ⚠ coalesce, NOT a bare LIKE. `NULL LIKE '%EXACT:%'` is NULL, and a CHECK constraint PASSES on
  -- NULL — so the bare form accepted the one row it most needed to refuse: exact match, notes
  -- empty. Caught by the self-test's own case, not by reading the SQL.
  OR coalesce(notes, '') LIKE '%EXACT:%'),

  CONSTRAINT corpus_census_hollow_within_held CHECK (
    hollow_units <= coalesce(held_units, 0))
);

-- ⚠ The CREATE above is IF NOT EXISTS, so on an existing table it changes nothing — including the
-- constraints. Anything TIGHTENED after first deployment has to be re-stated here, and ADD
-- CONSTRAINT validates the rows already in the table, so a tightening that the live data violates
-- fails loudly at apply time instead of silently not applying. That is the intended behaviour.
ALTER TABLE corpus_census DROP CONSTRAINT IF EXISTS corpus_census_exact_match_explained;
ALTER TABLE corpus_census ADD CONSTRAINT corpus_census_exact_match_explained CHECK (
  state <> 'MEASURED' OR published_units IS DISTINCT FROM held_units
  -- ⚠ coalesce, NOT a bare LIKE. `NULL LIKE '%EXACT:%'` is NULL, and a CHECK constraint PASSES on
  -- NULL — so the bare form accepted the one row it most needed to refuse: exact match, notes
  -- empty. Caught by the self-test's own case, not by reading the SQL.
  OR coalesce(notes, '') LIKE '%EXACT:%');

CREATE INDEX IF NOT EXISTS corpus_census_state_idx ON corpus_census (state);
CREATE INDEX IF NOT EXISTS corpus_census_walked_at_idx ON corpus_census (walked_at DESC NULLS LAST);

COMMENT ON TABLE corpus_census IS
  'Publisher-walked denominators, per collection, in UNITS. Read by the daily progress email. '
  'Never populated from corpus_sections'' own row count — see CLAUDE.md and BRIEF_INGEST_CENSUS_C1.md Part B.';
