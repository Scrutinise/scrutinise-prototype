-- schema-amd2.sql — POSITION_GRAPH_DESIGN_AMENDMENT_2, §1 (the mention is the unit of display),
-- §2 (behaviour is identity evidence) and §3 (confidence is shown to the user, not just stored).
--
-- DDL OF RECORD. Applied by position-graph/setup-amd2.ts, which prints the target host first
-- (docs/CLAUDE.md §16). Additive and idempotent; there is no DROP of a table in this file.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHAT THE AMENDMENT CHANGED, AND WHAT IT DELIBERATELY DID NOT
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- The design gated MP-facing output behind entity RESOLUTION. 2D-2 then measured resolution at
-- 2,603 keyed people out of 48,409, and the gate would have hidden almost everything. Amendment 2
-- moves the gate: **a mention can always be displayed; an entity is a claim that several mentions
-- are the same actor, and that still needs evidence.**
--
-- Measured here before anything was written (probe-amd2.ts, 16 Aug 2026):
--
--     person        48,409 entities   2,603 keyed (5.4%)   46,245 carry at least one edge (95.5%)
--     organisation  40,518 entities  26,111 keyed (64.4%)  39,490 carry at least one edge (97.5%)
--
-- So the display gate was costing ~95% of the material, and the two halves differ by twelve times —
-- which is §6's point and the reason nothing in this file averages them.
--
-- ⚠ THE MERGE RULE IS NOT RELAXED AND THIS FILE MUST NOT BE READ AS RELAXING IT. Three unresolved
-- Andrew Robertses are three thin records. Three merged into one is a composite actor who does not
-- exist. Unresolved is visible; wrongly merged is not. Everything below loosens DISPLAY and tightens
-- what may be called a resolution.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- A LIMIT FOUND BY PROBING, RECORDED HERE BECAUSE THE VIEW BELOW WOULD OTHERWISE IMPLY OTHERWISE
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- §1 asks for "name as it appeared" ON the mention. **We cannot supply it per mention.** `graph_edge`
-- has no surface column, and `corpus_sections.speaker` — the obvious recovery route — is NULL on
-- 5,000 of 5,000 sampled `committees-evidence` sections that `graph_evidence` actually points at.
-- The surfaces we hold live in `graph_alias`, keyed on (entity, source), not on the appearance.
--
-- So `graph_mention` shows the entity's canonical name as `display_name` and the full surface set
-- beside it, and says so in `surface_is_per_entity`. It does NOT pick a surface per appearance and
-- present it as the one used, which would be an invented fact of exactly the kind §5.1 forbids.
-- The fix belongs in the sweeps: record the surface on the edge when the edge is written.

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §3 — THE THREE TIERS, DEFINED ONCE
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- The schema already carried `key_source` and `confidence` and 2D-2 was disciplined about them.
-- What was missing is that nothing turned them into something a reader is told. These two functions
-- are that translation, and they exist in ONE place so a screen cannot invent its own wording.
--
-- ⚠ The unknown branch returns 'unclassified' rather than falling back to the safest-looking tier.
-- A new key_source arriving without a tier decision must be VISIBLE, not silently rendered as
-- "mention only" — verify-amd2.ts fails on a single unclassified row, and its negative control
-- feeds the function a fabricated key_source to prove that check can fire.

CREATE OR REPLACE FUNCTION graph_identity_tier(p_key_source TEXT, p_confidence REAL)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    -- Tier 1 — a stable external key. Companies House and the Charity Commission are listed
    -- because Amendment 2 §4 puts them next and the tier decision is taken here, once, rather
    -- than by whoever writes that sweep. No row carries them yet.
    WHEN p_key_source IN ('parl-member-id', 'parl-cis-id', 'parl-idms-id',
                          'companies-house-no', 'charity-no') THEN 'identified'
    -- Tier 2 — matched by name AGAINST A REGISTER. 2D-2's 788, deliberately recorded at 0.9 and
    -- never as a keyed identity, which is the discipline this tier exists to carry to the screen.
    WHEN p_key_source = 'name-match' THEN 'probable'
    -- Tier 3 — a name in a document and nothing more. 45,018 people and 14,407 organisations.
    WHEN p_key_source = 'singleton' THEN 'mention-only'
    ELSE 'unclassified'
  END
$$;

COMMENT ON FUNCTION graph_identity_tier(TEXT, REAL) IS
  'Amendment 2 §3. The single definition of the three identity tiers shown to a user. '
  'Unknown key_source returns ''unclassified'' on purpose — see verify-amd2.ts.';

-- The words a reader is shown. Amendment 2 §3's own phrasing, kind-aware where "person or body"
-- would read as a hedge we do not actually have.
CREATE OR REPLACE FUNCTION graph_identity_statement(p_kind TEXT, p_tier TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_tier
    WHEN 'identified'   THEN CASE p_kind
                               WHEN 'organisation' THEN 'This body, identified'
                               WHEN 'publication'  THEN 'This publication, identified'
                               ELSE 'This person, identified' END
    WHEN 'probable'     THEN CASE p_kind
                               WHEN 'organisation' THEN 'Probably this body'
                               WHEN 'publication'  THEN 'Probably this publication'
                               ELSE 'Probably this person' END
    WHEN 'mention-only' THEN 'The name as it appeared, and nothing more'
    ELSE 'Identity basis not classified — do not display'
  END
$$;

-- The caveat that travels with the tier. §3's rule is that the user must be able to tell an
-- identified actor from an inferred one; a label alone does not do that, so the basis rides with it.
CREATE OR REPLACE FUNCTION graph_identity_caveat(p_tier TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_tier
    WHEN 'identified'   THEN 'Matched to a stable public identifier.'
    WHEN 'probable'     THEN 'Matched by name against a public register, not by a stable identifier. A name match against a curated register is still a name match.'
    WHEN 'mention-only' THEN 'We hold no further information about who this is. The record shows the name and what it did; it does not identify the actor.'
    ELSE 'The basis for this identity has no tier decision recorded against it.'
  END
$$;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §3 — ONE ROW PER ENTITY, CARRYING WHAT A SCREEN IS ALLOWED TO SAY ABOUT IT
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW graph_entity_identity AS
SELECT
  e.id                                                   AS entity_id,
  e.kind,
  e.canonical_name,
  e.key_source,
  e.confidence,
  graph_identity_tier(e.key_source, e.confidence)        AS identity_tier,
  graph_identity_statement(e.kind, graph_identity_tier(e.key_source, e.confidence))
                                                         AS identity_statement,
  graph_identity_caveat(graph_identity_tier(e.key_source, e.confidence))
                                                         AS identity_caveat,
  -- The stable keys themselves, so "identified" can be checked by the reader rather than believed.
  e.parl_member_id, e.parl_cis_id, e.parl_idms_id, e.companies_house_no, e.charity_no,
  e.first_seen, e.last_seen,
  -- Every surface ever seen. §1's "name as it appeared" survives at ENTITY level even though it
  -- cannot be pinned per appearance — see the header note.
  (SELECT COUNT(DISTINCT a.surface)::int FROM graph_alias a WHERE a.entity_id = e.id) AS n_surfaces,
  (SELECT ARRAY_AGG(DISTINCT a.surface) FROM graph_alias a WHERE a.entity_id = e.id) AS surfaces
FROM graph_entity e;

COMMENT ON VIEW graph_entity_identity IS
  'Amendment 2 §3. What a screen may say about an actor''s identity, with the basis attached. '
  'Read identity_tier/identity_statement from here; never re-derive them from key_source.';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §1 — THE MENTION, WHICH IS THE UNIT OF DISPLAY
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- One row per thing an actor is recorded as having done, whatever tier its identity sits at, and
-- WITHOUT a resolution filter of any kind. That absence is the point of the view, so it is asserted
-- rather than trusted: verify-amd2.ts proves the mention count for tier-3 entities equals their
-- edge count, against a control that filters and must come back short.
--
-- Built over `graph_edge_all` so the 2.5M derived `voted` and `signed-motion` edges are mentions
-- too — a vote is the most concrete position record we hold, and gating it behind resolution was
-- the specific loss the amendment is correcting.
CREATE OR REPLACE VIEW graph_mention AS
SELECT
  g.subject_id                       AS entity_id,
  i.kind,
  -- ⚠ The FIRST surface seen for this entity, not the surface used on this occasion. We do not
  -- hold the latter (see header). `surface_is_per_entity` is TRUE so no consumer can mistake it.
  i.canonical_name                   AS display_name,
  TRUE                               AS surface_is_per_entity,
  i.n_surfaces,
  i.identity_tier,
  i.identity_statement,
  i.identity_caveat,
  g.predicate,                       -- what the record shows they did
  g.qualifier,                       -- aye | no | absent | primary-sponsor | NULL
  g.object_kind,
  g.object_ref,
  g.object_label,                    -- the inquiry, debate, division or motion, for reading
  g.observed_on,                     -- every mention is dated (design §5.2)
  g.storage                          -- 'stored' | 'derived', so a reader can find the row behind it
FROM graph_edge_all g
JOIN graph_entity_identity i ON i.entity_id = g.subject_id;

COMMENT ON VIEW graph_mention IS
  'Amendment 2 §1. Every recorded act by every actor, unfiltered by identity tier. '
  'A mention may always be displayed; withholding one because the entity is unresolved is the '
  'behaviour this view exists to make impossible.';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §2 — BEHAVIOUR IS IDENTITY EVIDENCE, AND IS RECORDED AS A SIGNAL, NEVER AS A RESOLUTION
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Populated by signal-behaviour.ts. One row per pair of register members who share a normalised
-- name surface and can therefore be confused by any name match — with what their voting records
-- actually show about each other.
--
-- ⚠⚠ THE CONSTRAINT BELOW IS THE AMENDMENT'S RULE MADE MECHANICAL. §2 permits behavioural evidence
-- to FLAG a split for review and forbids it as grounds for a MERGE — "two different people who
-- agree about everything are still two people, and this is exactly how a composite actor gets
-- built". So `finding` cannot take a merging value at all, and the table has no column in which a
-- resolution could be stored. A future merge written on this evidence would have to alter the DDL,
-- which is a decision someone has to make on purpose.
CREATE TABLE IF NOT EXISTS graph_identity_signal (
  id             BIGSERIAL PRIMARY KEY,
  signal         TEXT NOT NULL DEFAULT 'behavioural-divergence',
  -- the shared normalised surface — the thing that makes these two confusable in the first place
  surface_norm   TEXT NOT NULL,
  member_a       INTEGER NOT NULL REFERENCES graph_member_register(mnis_id) ON DELETE CASCADE,
  member_b       INTEGER NOT NULL REFERENCES graph_member_register(mnis_id) ON DELETE CASCADE,
  name_a         TEXT,
  name_b         TEXT,
  party_a        TEXT,
  party_b        TEXT,

  -- ── the measurement, which is the part that is a fact ──────────────────────────────────────
  shared_divisions   INTEGER NOT NULL,   -- divisions where BOTH cast aye or no
  agreed             INTEGER NOT NULL,   -- ...and voted the same way
  agreement_rate     REAL,               -- NULL when shared_divisions = 0; never 0 by default
  service_overlap_days INTEGER,          -- register service overlap; negative is impossible, NULL unknown
  a_first DATE, a_last DATE, b_first DATE, b_last DATE,

  -- ── what that measurement supports, stated as an observation and never as a verdict ────────
  -- 'disjoint-service'      the two never sat at the same time. Succession, not disagreement.
  -- 'divergent'             they voted together often enough to compare, and disagreed.
  -- 'concordant'            they agreed — which is NOT evidence they are the same person, and the
  --                         calibration in signal-behaviour.ts is what proves that.
  -- 'mixed'                 between the bands.
  -- 'insufficient-evidence' overlapping service, too few shared divisions to say anything.
  finding        TEXT NOT NULL CHECK (finding IN
                   ('disjoint-service', 'divergent', 'concordant', 'mixed', 'insufficient-evidence')),
  -- the sentence a human reads, containing the numbers and no inference
  observation    TEXT NOT NULL,
  -- ⚠ what this does NOT license. Written into the row so it travels with it.
  not_evidence_of TEXT NOT NULL DEFAULT
    'Behavioural similarity is not grounds for a merge. Two different people who agree about everything are still two people.',
  -- how the name cluster arises, from probe-amd2c: episcopal see | peerage title | plain name
  cluster_class  TEXT,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (signal, surface_norm, member_a, member_b),
  -- ordered pair, so a pair cannot be stored twice in the two orders
  CONSTRAINT graph_identity_signal_order_ck CHECK (member_a < member_b)
);
CREATE INDEX IF NOT EXISTS graph_identity_signal_surface_idx ON graph_identity_signal (surface_norm);
CREATE INDEX IF NOT EXISTS graph_identity_signal_finding_idx ON graph_identity_signal (finding);

COMMENT ON TABLE graph_identity_signal IS
  'Amendment 2 §2. Behavioural evidence about pairs of members a name match could confuse. '
  'A signal with its evidence, never a resolution — the table has no column a merge could be '
  'written into, and `finding` has no merging value.';

-- The specific divisions behind a `divergent` finding. §5.1: no summary claim without a visible
-- basis, so the row above can always be opened.
CREATE TABLE IF NOT EXISTS graph_identity_signal_evidence (
  id           BIGSERIAL PRIMARY KEY,
  signal_id    BIGINT NOT NULL REFERENCES graph_identity_signal(id) ON DELETE CASCADE,
  house        TEXT NOT NULL,
  division_id  INTEGER NOT NULL,
  division_title TEXT,
  division_date  DATE,
  vote_a       TEXT NOT NULL,
  vote_b       TEXT NOT NULL,
  UNIQUE (signal_id, house, division_id)
);
CREATE INDEX IF NOT EXISTS graph_identity_signal_evidence_sig_idx
  ON graph_identity_signal_evidence (signal_id);

-- ── the calibration, which is what stops `concordant` being read as identity ────────────────────
-- signal-behaviour.ts measures the agreement rate between RANDOM pairs of members who are known to
-- be different people, same-party and cross-party. Without it, "these two agree 96% of the time"
-- reads as suggestive. With it, "and so do 96% of same-party pairs of definitely different people"
-- is the whole answer.
CREATE TABLE IF NOT EXISTS graph_identity_baseline (
  id              BIGSERIAL PRIMARY KEY,
  cohort          TEXT NOT NULL,      -- 'same-party' | 'cross-party'
  pairs_sampled   INTEGER NOT NULL,
  pairs_scored    INTEGER NOT NULL,   -- those clearing the shared-division floor
  min_shared      INTEGER NOT NULL,
  mean_agreement  REAL,
  p10_agreement   REAL,
  median_agreement REAL,
  p90_agreement   REAL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
