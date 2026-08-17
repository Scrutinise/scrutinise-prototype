-- schema-2d3.sql — BRIEF_GRAPH_2D3 §1 (propositions and positions) and §2 (register keys).
--
-- DDL OF RECORD for sprint 2D-3. Applied by position-graph/setup-2d3.ts, which prints the target
-- host first (docs/CLAUDE.md §16). Additive and idempotent; there is no DROP in this file.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- SCOPE — §3 AND §4 ARE NOT HERE, AND THAT IS DELIBERATE
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- A concurrent session is building POSITION_GRAPH_DESIGN_AMENDMENT_2 — the mention layer (§1), the
-- behavioural identity signal (§2) and the three confidence tiers (§3) — in this same directory
-- (schema-amd2.sql, setup-amd2.ts, signal-behaviour.ts). Those are 2D-3's §3 and §4. On Charlie's
-- instruction this sprint takes §1 and §2 ONLY and leaves both alone, so:
--
--   · `graph_mention` and `graph_entity_identity` belong to that session. Nothing here creates,
--     replaces or writes to them.
--   · a position's subject here is the ENTITY the 2D-1 spine already resolved for the submission,
--     plus the section it was read from. Their `graph_mention` view is built over `graph_edge_all`,
--     so once the arm at the bottom of this file lands, every position becomes a mention on their
--     side with no work on either.
--   · split detection from contradictory POSITIONS is a later sprint. It cannot run before the
--     positions exist, which is today, and Amendment 2 §2 covers it.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHAT IS DIFFERENT ABOUT THIS SPRINT'S DATA, AND WHY THE SCHEMA SAYS SO IN THREE PLACES
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 2D-1 and 2D-2 stored facts that were already structured somewhere: an organisation submitted to
-- an inquiry, a member voted in a division. Joining is not interpreting, and both sprints could
-- prove every edge by pointing at a record.
--
-- A `holds-position` edge is an INFERENCE. A model read a document and decided what its author
-- argued. That is a different KIND of row and it must not be able to travel as the other kind, so
-- three things are structural rather than conventional:
--
--   1. `graph_position.extract` is NOT NULL for every polarity except 'no-position' (CHECK
--      position_extract_ck). Design §5.1: "a position without its passage is a claim we cannot show
--      working for". A schema that permits an unevidenced position will eventually hold one.
--   2. `extract_found_in_source` records whether the quoted passage was located VERBATIM in the
--      document we hold. It is computed mechanically after the call, not asserted by the model —
--      a model that invents a quotation cannot also certify it.
--   3. `no-position` is a stored value, not an absent row (design §5.4). An organisation that
--      submitted and did not address a proposition has not tacitly agreed with it, and the only way
--      to tell "asked and silent" from "never asked" is to write the silence down.
--
-- Storage is not a constraint (V38: the enforced Neon ceiling is 16 TiB against 0.10% used), so
-- nothing here is shaped around space. It is shaped around what a reader must be able to check.

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §1a — THE PROPOSITION VOCABULARY
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- Candidate claims exactly as the derivation produced them, BEFORE clustering. Kept because the
-- brief requires the vocabulary to be inspectable before it is used, and because a canonical
-- proposition that turns out to be badly worded should be traceable to what produced it.
CREATE TABLE IF NOT EXISTS graph_proposition_candidate (
  id             BIGSERIAL PRIMARY KEY,
  area           TEXT NOT NULL,          -- the committee, per area-2d3.ts
  inquiry_ref    TEXT,                   -- graph_edge.object_ref of the inquiry it was derived from
  inquiry_label  TEXT,
  text           TEXT NOT NULL,          -- the candidate proposition, as generated
  rationale      TEXT,                   -- why the model says it is contested
  source_kind    TEXT NOT NULL CHECK (source_kind IN ('committee-evidence', 'early-day-motion')),
  source_refs    JSONB NOT NULL DEFAULT '[]'::jsonb,   -- section ids the claim was read out of
  proposition_id BIGINT,                 -- set by the clustering step; NULL = not adopted
  run_id         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS graph_prop_cand_area_idx ON graph_proposition_candidate (area, inquiry_ref);
CREATE INDEX IF NOT EXISTS graph_prop_cand_prop_idx ON graph_proposition_candidate (proposition_id);

-- The canonical propositions. Design §2: the atom is a specific contestable CLAIM, never a topic.
-- "Dentistry" is not a proposition; "NHS dental contracts should be renegotiated" is.
CREATE TABLE IF NOT EXISTS graph_proposition (
  id            BIGSERIAL PRIMARY KEY,
  area          TEXT NOT NULL,
  text          TEXT NOT NULL,
  -- Which inquiries the claim was derived from. A proposition present in more than one is
  -- CROSS-CUTTING and is put to every submission in the run; a single-inquiry one is put only to
  -- that inquiry's submissions. That is the whole cost-control mechanism and it is data, not code.
  inquiry_refs  JSONB NOT NULL DEFAULT '[]'::jsonb,
  n_candidates  INTEGER NOT NULL DEFAULT 1,
  derived_from  TEXT NOT NULL CHECK (derived_from IN ('committee-evidence', 'early-day-motion', 'mixed')),
  run_id        TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (area, text)
);
CREATE INDEX IF NOT EXISTS graph_proposition_area_idx ON graph_proposition (area);

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §1b — THE POSITIONS. THE FIRST INFERRED ROWS IN THE GRAPH.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS graph_position (
  id             BIGSERIAL PRIMARY KEY,
  -- The subject is the entity 2D-1 resolved for this submission. A submission with two submitters
  -- (an organisation and its named witness) produces two rows carrying the same extract: both made
  -- the submission, and choosing one would be inventing a distinction the record does not draw.
  entity_id      BIGINT NOT NULL REFERENCES graph_entity(id) ON DELETE CASCADE,
  proposition_id BIGINT NOT NULL REFERENCES graph_proposition(id) ON DELETE CASCADE,
  polarity       TEXT NOT NULL CHECK (polarity IN ('for', 'against', 'balanced', 'no-position')),
  -- ⚠ NOT NULL wherever a position was actually taken. This CHECK is the design's §5.1 rule made
  -- unbreakable: the schema cannot hold a position whose passage is missing.
  extract        TEXT,
  CONSTRAINT position_extract_ck CHECK (polarity = 'no-position' OR (extract IS NOT NULL AND length(btrim(extract)) >= 20)),
  -- Computed by us, AFTER the call, by looking for the quotation in the document we hold. FALSE is
  -- a finding — it is the fabricated-quotation rate, and it is the number nobody can argue with.
  extract_found_in_source BOOLEAN,
  extract_offset INTEGER,               -- character offset where it was found; NULL when it was not
  section_id     TEXT NOT NULL REFERENCES corpus_sections(id) ON DELETE CASCADE,
  inquiry_ref    TEXT,                  -- graph_edge.object_ref, so the area can be sliced by inquiry
  source_url     TEXT,
  -- Design §5.2: a changed position is a FINDING, so the date is not optional.
  observed_on    DATE NOT NULL,
  -- Design §5.3: the modes that mislead. The model is asked to name the capacity it read, and
  -- 'unclear' is a permitted answer rather than a forced guess.
  capacity       TEXT CHECK (capacity IN ('own-view', 'representative', 'government-line', 'commissioned', 'unclear')),
  confidence     REAL,
  model          TEXT NOT NULL,
  run_id         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_id, proposition_id, section_id)
);
CREATE INDEX IF NOT EXISTS graph_position_prop_idx    ON graph_position (proposition_id, polarity);
CREATE INDEX IF NOT EXISTS graph_position_entity_idx  ON graph_position (entity_id);
CREATE INDEX IF NOT EXISTS graph_position_section_idx ON graph_position (section_id);
CREATE INDEX IF NOT EXISTS graph_position_run_idx     ON graph_position (run_id);

-- The hand-scoring of §1's acceptance test. Stored rather than kept in a spreadsheet, because the
-- error rate is the sprint's headline number and it should be re-derivable from the database.
CREATE TABLE IF NOT EXISTS graph_position_review (
  position_id  BIGINT PRIMARY KEY REFERENCES graph_position(id) ON DELETE CASCADE,
  verdict      TEXT NOT NULL CHECK (verdict IN ('correct', 'wrong', 'partly')),
  -- The failure SHAPES the brief asks for. Which one it is decides whether this generalises.
  failure_type TEXT CHECK (failure_type IN ('polarity-flipped', 'position-invented', 'nuance-flattened',
                                            'capacity-misread', 'proposition-mismatch', 'extract-not-in-source')),
  note         TEXT,
  reviewer     TEXT NOT NULL,
  reviewed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §2 — COMPANIES HOUSE AND THE CHARITY COMMISSION
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- A stable key where we currently have a name. ⚠ "When in doubt, do not merge": this table records
-- a CANDIDATE match per (entity, register, register id) and never itself merges two entities. A
-- match is only promoted onto graph_entity.companies_house_no / charity_no when it is unambiguous
-- in BOTH directions, and match-registers.ts is the only writer of that promotion.
CREATE TABLE IF NOT EXISTS graph_org_register (
  id            BIGSERIAL PRIMARY KEY,
  entity_id     BIGINT NOT NULL REFERENCES graph_entity(id) ON DELETE CASCADE,
  register      TEXT NOT NULL CHECK (register IN ('companies-house', 'charity-commission')),
  register_id   TEXT NOT NULL,        -- company number, or charity registered number
  register_name TEXT NOT NULL,        -- the name as the REGISTER spells it
  match_method  TEXT NOT NULL CHECK (match_method IN ('exact-name-norm', 'exact-name-norm-alias')),
  -- Which of our surfaces matched: the canonical name, or one of the aliases 2D-1 preserved.
  matched_surface TEXT NOT NULL,
  status        TEXT,                 -- CH company status / CC registration status, verbatim
  -- TRUE only when this entity matched exactly one register row AND that row matched exactly one
  -- entity. Everything else is ambiguous and is reported, never silently resolved.
  unambiguous   BOOLEAN NOT NULL,
  promoted      BOOLEAN NOT NULL DEFAULT FALSE,
  run_id        TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_id, register, register_id)
);
CREATE INDEX IF NOT EXISTS graph_org_register_reg_idx ON graph_org_register (register, register_id);
CREATE INDEX IF NOT EXISTS graph_org_register_ent_idx ON graph_org_register (entity_id);

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- THE EDGE VIEW
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- `holds-position` in the same shape as every other edge, so "what has this actor said" is one
-- query rather than three.
CREATE OR REPLACE VIEW graph_holds_position_edge AS
SELECT
  p.entity_id                        AS subject_id,
  e.canonical_name                   AS subject_name,
  'holds-position'::text             AS predicate,
  'proposition'::text                AS object_kind,
  p.proposition_id::text             AS object_ref,
  pr.text                            AS object_label,
  p.polarity                         AS qualifier,
  p.capacity                         AS capacity,
  p.extract                          AS extract,
  p.extract_found_in_source          AS extract_found_in_source,
  p.observed_on                      AS observed_on,
  p.section_id                       AS evidence_section_id,
  p.inquiry_ref                      AS inquiry_ref,
  p.source_url                       AS source_url,
  p.confidence                       AS confidence,
  p.model                            AS model
FROM graph_position p
JOIN graph_entity e ON e.id = p.entity_id
JOIN graph_proposition pr ON pr.id = p.proposition_id;

-- One place to count edges, whatever their storage — 2D-2's view, with this sprint's arm added.
--
-- ⚠ COLUMN LIST UNCHANGED, ON PURPOSE. The concurrent Amendment 2 session's `graph_mention` view is
-- built over this one; a CREATE OR REPLACE that altered the columns would break it. Adding a UNION
-- arm does not, and it means every position becomes a mention on their side for free.
--
-- ⚠ 'no-position' rows are DELIBERATELY EXCLUDED from the edge count: a recorded silence is a fact
-- we hold, but it is not an edge, and folding it into an edge total would inflate the graph with
-- statements nobody made. They remain queryable in graph_position.
CREATE OR REPLACE VIEW graph_edge_all AS
  SELECT subject_id, predicate, object_kind, object_ref, object_label,
         NULL::text AS qualifier, last_seen AS observed_on, 'stored'::text AS storage
    FROM graph_edge
UNION ALL
  SELECT subject_id, predicate, object_kind, object_ref, object_label,
         qualifier, observed_on, 'derived'::text AS storage
    FROM graph_voted_edge
UNION ALL
  SELECT subject_id, predicate, object_kind, object_ref, object_label,
         role AS qualifier, observed_on, 'derived'::text AS storage
    FROM graph_signed_motion_edge
UNION ALL
  SELECT subject_id, predicate, object_kind, object_ref, object_label,
         qualifier, observed_on, 'inferred'::text AS storage
    FROM graph_holds_position_edge
   WHERE qualifier <> 'no-position';
