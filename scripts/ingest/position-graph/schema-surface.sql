-- schema-surface.sql — BRIEF_INGEST_CORPUS_FRESHNESS §2: record the surface a sweep matched on,
-- at the point it writes the edge, because it cannot be reconstructed afterwards.
--
-- DDL OF RECORD. Applied by position-graph/setup-surface.ts, which prints the target host first
-- (docs/CLAUDE.md §16). Additive and idempotent; nothing is dropped and no row is rewritten.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHAT THIS CLOSES
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- `graph_mention` is meant to show "the name as it appeared". schema-amd2.sql records, honestly,
-- that it cannot: `graph_edge` has no surface column, `corpus_sections.speaker` is NULL on 5,000 of
-- 5,000 sampled committees-evidence rows, and `graph_alias` is keyed on (entity, source) rather
-- than on the appearance. So every mention carried the entity's CANONICAL name with
-- `surface_is_per_entity = TRUE` beside it — right, and not what §26.3 needs.
--
-- ⚠⚠ AND THE FIRST THING MEASURING FOUND IS THAT MOST OF IT WAS NEVER MISSING, ONLY UNPLUMBED.
-- The 2.5M derived mentions already hold the printed name at the appearance:
--
--     division_votes.member_name   2,528,032 rows   the name as the division record printed it
--     edm_sponsor.sponsor_name        60,995 rows   the name as the motion record printed it
--
-- Those needed no sweep, no backfill and no new column — only a view that stops discarding them.
-- The 164,131 STORED edges (committees evidence, declared interests) are the half that genuinely
-- needs a column and a re-run of the sweep that wrote them.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- THE GRAIN, WHICH IS THE ONE DESIGN DECISION HERE
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- The brief says "one column on the edge". An EDGE is (subject, predicate, object) aggregated over
-- every appearance behind it, so one surface on an edge is only truthful when every appearance used
-- the same one. So the surface is recorded in BOTH places, and they say different things:
--
--   graph_evidence.subject_surface   THE FACT. One appearance, one surface, exactly as matched.
--   graph_edge.subject_surface       THE FIRST surface seen for this edge, for display…
--   graph_edge.subject_surface_varies …with a flag that is TRUE when a later appearance used a
--                                     DIFFERENT one, so a consumer showing the first can tell that
--                                     it is showing one of several rather than the only one.
--
-- Without the flag, an edge over "Rt Hon Sir Keir Starmer MP" and "Keir Starmer" would display one
-- of them as though it were the name in the record, which is the invented fact schema-amd2.sql
-- refused to commit. With it, the display is "this is one of the forms used" and can be checked.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE graph_edge     ADD COLUMN IF NOT EXISTS subject_surface        TEXT;
ALTER TABLE graph_edge     ADD COLUMN IF NOT EXISTS subject_surface_varies BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE graph_evidence ADD COLUMN IF NOT EXISTS subject_surface        TEXT;

COMMENT ON COLUMN graph_edge.subject_surface IS
  'The FIRST surface a sweep matched on for this edge, written at write time. NULL means the edge '
  'predates the column or the sweep had no surface — it must NOT be read as "the canonical name '
  'was used".';
COMMENT ON COLUMN graph_edge.subject_surface_varies IS
  'TRUE when appearances behind this edge used more than one surface. A consumer showing '
  'subject_surface must say it is one of several when this is TRUE.';
COMMENT ON COLUMN graph_evidence.subject_surface IS
  'The surface matched on THIS appearance. The fact; graph_edge.subject_surface is a denormalised '
  'first-seen copy for display.';

-- ── the derived halves, which only needed plumbing ───────────────────────────────────────────────
-- Recreated in full rather than patched: a view cannot have a column added in place, and a
-- CREATE OR REPLACE must repeat every existing column in the same order.

-- ⚠⚠ EVERY NEW VIEW COLUMN IS APPENDED AT THE END, AND THAT IS A POSTGRES CONSTRAINT, NOT A STYLE.
-- `CREATE OR REPLACE VIEW` may only ADD columns to the END of the list: it cannot rename or reorder
-- an existing one, and every view here has a dependent (graph_edge_all reads the two derived views,
-- graph_mention reads graph_edge_all). My first draft inserted `subject_surface` after
-- `subject_name`, which renames every column after it and fails with "cannot change name of view
-- column". The alternative — DROP … CASCADE and rebuild — would take the dependents with it, so
-- appending is both the safe route and the only one that keeps this file idempotent.
-- The column ORDER in each view below is therefore the LIVE order, read from
-- information_schema.columns rather than from the schema files, which is the authoritative source
-- when the two could have drifted.

CREATE OR REPLACE VIEW graph_voted_edge AS
SELECT
  e.id                                              AS subject_id,
  e.canonical_name                                  AS subject_name,
  v.member_id                                       AS subject_mnis_id,
  'voted'::text                                     AS predicate,
  'division'::text                                  AS object_kind,
  v.house || ':' || v.division_id                   AS object_ref,
  d.title                                           AS object_label,
  v.vote                                            AS qualifier,
  v.teller                                          AS teller,
  d.absence_known                                   AS absence_known,
  v.division_date                                   AS observed_on,
  d.bill_title, d.stage, d.amendment, d.context_provenance,
  v.party, v.party_abbrev, v.constituency,
  d.house                                           AS house,
  d.source_url                                      AS source_url,
  'commons-divisions-votes:' || v.division_id || ':1' AS evidence_section_id,
  -- ⚠ THE NAME AS THE DIVISION RECORD PRINTED IT, not our canonical form. This is the whole of
  -- §2's ask for 2.5M mentions and it was already stored — only never plumbed through.
  v.member_name                                     AS subject_surface
FROM division_votes v
JOIN divisions   d ON d.house = v.house AND d.division_id = v.division_id
JOIN graph_entity e ON e.parl_member_id = v.member_id AND e.kind = 'person';

CREATE OR REPLACE VIEW graph_signed_motion_edge AS
SELECT
  e.id                              AS subject_id,
  e.canonical_name                  AS subject_name,
  s.mnis_id                         AS subject_mnis_id,
  'signed-motion'::text             AS predicate,
  'motion'::text                    AS object_kind,
  s.motion_id::text                 AS object_ref,
  s.uin                             AS object_label,
  'primary-sponsor'::text           AS role,
  s.date_tabled                     AS observed_on,
  s.sponsors_count                  AS sponsors_count,
  s.party, s.constituency,
  'early-day-motions:' || s.motion_id || ':1' AS evidence_section_id,
  -- The name as the motion record printed it. Same argument as the division above.
  s.sponsor_name                    AS subject_surface
FROM edm_sponsor s
JOIN graph_entity e ON e.parl_member_id = s.mnis_id AND e.kind = 'person'
WHERE s.mnis_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM corpus_sections c
               WHERE c.id = 'early-day-motions:' || s.motion_id || ':1');

-- ── the union, now carrying the surface and whether it varies ────────────────────────────────────
-- ⚠ `surface_varies` is FALSE for the derived halves and that is a FACT about their grain, not an
-- assumption: a derived edge is one appearance (one division, one motion), so there is nothing for
-- a second surface to disagree with. The stored half is the only one where an edge spans several.
CREATE OR REPLACE VIEW graph_edge_all AS
  SELECT subject_id, predicate, object_kind, object_ref, object_label,
         NULL::text AS qualifier, last_seen AS observed_on, 'stored'::text AS storage,
         subject_surface, subject_surface_varies AS surface_varies
    FROM graph_edge
UNION ALL
  SELECT subject_id, predicate, object_kind, object_ref, object_label,
         qualifier, observed_on, 'derived'::text AS storage,
         subject_surface, FALSE AS surface_varies
    FROM graph_voted_edge
UNION ALL
  SELECT subject_id, predicate, object_kind, object_ref, object_label,
         role AS qualifier, observed_on, 'derived'::text AS storage,
         subject_surface, FALSE AS surface_varies
    FROM graph_signed_motion_edge
UNION ALL
  SELECT subject_id, predicate, object_kind, object_ref, object_label,
         qualifier, observed_on, 'inferred'::text AS storage,
         -- ⚠ AN INFERRED EDGE HAS NO APPEARANCE AND THEREFORE NO SURFACE. NULL here is the honest
         -- value: `holds-position` is derived from other edges, so "the name as it appeared" has no
         -- referent. Filling it from the canonical name would manufacture exactly the claim §1 of
         -- Amendment 2 refused to make.
         NULL::text AS subject_surface, FALSE AS surface_varies
    FROM graph_holds_position_edge
   WHERE qualifier <> 'no-position';

-- ── the mention, which can finally show the name as it appeared where we hold it ─────────────────
-- ⚠ display_name FALLS BACK to the canonical name and says so in `surface_is_per_entity`. The flag
-- is now COMPUTED from whether we actually hold a surface, rather than being the constant TRUE it
-- had to be before. `canonical_name` is exposed alongside so a consumer that wants the entity's
-- name does not have to re-derive it — and so the two can be shown together, which is what
-- "Sir Lindsay Hoyle (recorded as: Hoyle, rh Sir Lindsay)" needs.
CREATE OR REPLACE VIEW graph_mention AS
SELECT
  g.subject_id                       AS entity_id,
  i.kind,
  -- ⚠ THE ONE EXPRESSION THAT CHANGES MEANING. It was `i.canonical_name` unconditionally; it is now
  -- the recorded surface WHERE ONE EXISTS, falling back to the canonical name where none does.
  -- Replacing an expression is allowed; the column keeps its name, type and position.
  COALESCE(g.subject_surface, i.canonical_name) AS display_name,
  -- ⚠ AND THIS STOPS BEING THE CONSTANT `TRUE` IT HAD TO BE. It is now COMPUTED from whether we
  -- actually hold a surface for this appearance, which is the whole point of the change: a reader
  -- can tell "the name in the record" from "the entity's name, standing in".
  (g.subject_surface IS NULL)        AS surface_is_per_entity,
  i.n_surfaces,
  i.identity_tier,
  i.identity_statement,
  i.identity_caveat,
  g.predicate,
  g.qualifier,
  g.object_kind,
  g.object_ref,
  g.object_label,
  g.observed_on,
  g.storage,
  -- appended, per the note at the top of the view section
  g.subject_surface                  AS recorded_surface,
  g.surface_varies                   AS surface_varies,
  i.canonical_name                   AS canonical_name
FROM graph_edge_all g
JOIN graph_entity_identity i ON i.entity_id = g.subject_id;

COMMENT ON VIEW graph_mention IS
  'Amendment 2 §1 + FRESHNESS §2. Every recorded act by every actor, unfiltered by identity tier. '
  'display_name is the name AS IT APPEARED where recorded_surface is non-null; where it is null the '
  'entity''s canonical name stands in and surface_is_per_entity says so. Never show '
  'recorded_surface as the only form used when surface_varies is TRUE.';
