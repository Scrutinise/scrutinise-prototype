-- schema-3a.sql — GRAPH 3A §2. The position graph's factual layer.
--
-- DDL OF RECORD for sprint 3A. Applied by scripts/graph/setup-3a.ts, which prints the target host
-- first (docs/CLAUDE.md §16), refuses anything that is not Neon production, and refuses to run this
-- file at all if it contains a DROP. Additive and idempotent; re-applying changes nothing.
--
-- Spec: docs/POSITION_GRAPH_DESIGN.md §3.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- THE ONE STRUCTURAL DECISION, AND WHY IT IS NOT THE ONE §3 LITERALLY SPECIFIES
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- §3 says `position_signal` is a table with one row per observed event. For 2,080,585 of the
-- 2,304,748 P0 signals — the votes — the row ALREADY EXISTS, in `division_votes`, at 193 bytes.
-- Measured on this database before anything was written (probe-3a-cost.ts, 19 Aug 2026, 100,000
-- REAL rows through the exact column list §3 specifies):
--
--     position_signal, PK only                    190.1 bytes/row
--     position_signal, with the two §2 indexes    247.6 bytes/row
--     × 2,080,585 vote signals                 =  0.48 GiB
--     × the other 224,163 signals              =  53  MiB
--
-- Measured headroom at the time of writing: the database is 16.68 GiB against the 17.5 GiB ops
-- ALERT line, i.e. **0.82 GiB free before the observer starts warning** (the *enforced* ceiling is
-- `neon.max_cluster_size` = 16 TiB, so this is a warning line and not a wall — V38 established that
-- distinction after 17.5 had drifted into being quoted as a ceiling).
--
-- So 0.48 GiB would fit, and would still be spent holding a SECOND, STALER COPY of rows we already
-- have — the exact trade GRAPH 2D-2 declined when it was asked to copy the same votes into
-- `graph_edge`, and for the same three reasons, which have not changed:
--
--   1. two copies of one fact can disagree, and nothing would notice which was right;
--   2. `raw_weight` is CONFIG (design §5: "explicitly provisional until measured"), so every
--      tuning change would mean rewriting two million immutable rows — which is precisely what
--      design §2 says the two-layer split exists to avoid;
--   3. the classification that IS new — rebellion / free-vote-like / unwhipped — is 52,347 rows,
--      not two million.
--
-- **So: store the fact we do not already have, and derive the signal from it.**
--
--   · `position_signal_stored`   a real append-only table, design §3's column list exactly, for
--                                every signal type whose event is not already stored dated and
--                                queryable: EDM signatures, witness appearances, declared
--                                interests, and (when 3B lands them) amendment sponsorships.
--   · `position_division_party`  per division × party: the majority side and the cohesion. 46,702.
--   · `position_division_class`  per division: free-vote-like or not, and why. 5,645.
--   · `position_signal_vote`     a VIEW in design §3's shape over the four tables above.
--   · `position_signal`          a VIEW: stored ∪ vote. **This is what the estimate engine and the
--                                read API query.** Every consumer sees §3's shape and nothing else.
--
-- Nothing in §3 is given up. The losslessness invariant holds more strongly, not less: a view over
-- an immutable source cannot drift from it.
--
-- ⚠ TWO COLUMN DEVIATIONS FROM §3, BOTH FORCED BY THE DATA AND BOTH DELIBERATE:
--
--   · `evidence_ids` is **text[]**, not `bigint[]`. The evidence for a vote is a `corpus_sections`
--     row and `corpus_sections.id` is TEXT (`commons-divisions-votes:2071:1`). A bigint[] could not
--     hold it, and inventing a numeric surrogate would make the array undrillable, which is the one
--     thing §3 says evidence_ids must never be.
--   · the union view exposes **`signal_ref` (text)** as the identifier rather than `id`, because a
--     derived vote signal has no bigserial. `position_signal_stored.id` is a bigserial exactly as
--     §3 says, and `superseded_by` points into it. A vote signal cannot be superseded by a
--     correction row — it is corrected at source, in `division_votes`, which is the stronger
--     guarantee, and the view carries `supersedable` so a caller can tell the two apart.

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- THE STORED SIGNAL LAYER — design §3, append-only
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS position_signal_stored (
  id            BIGSERIAL PRIMARY KEY,
  -- FK to the entity layer built by the 2D-2 sweep. NEVER a raw name (design §3): an unresolved
  -- mention is EXCLUDED from signals and counted, it is not given a synthetic actor.
  actor_id      BIGINT      NOT NULL REFERENCES graph_entity(id) ON DELETE CASCADE,
  -- 'division' | 'edm' | 'bill' | 'instrument' | 'inquiry' | 'organisation' | 'submission_claim'
  -- ⚠ 'inquiry' and 'organisation' are not in §3's list and are required by §3 of the brief itself:
  -- a witness appearance's target IS an inquiry and a declared interest's target IS an organisation.
  target_type   TEXT        NOT NULL,
  target_id     TEXT        NOT NULL,
  signal_type   TEXT        NOT NULL,
  -- +1 / -1 / 0. 0 is an attention signal: it records that an actor engaged, not which side.
  direction     SMALLINT    NOT NULL,
  raw_weight    REAL        NOT NULL,
  -- NULL for a plain fact; else the versioned method name, so a method change produces NEW signals
  -- rather than silently re-meaning old ones (design §3).
  derivation    TEXT,
  -- Never empty — asserted by the CHECK below, not by intention. An edge that cannot point at its
  -- evidence does not exist.
  evidence_ids  TEXT[]      NOT NULL,
  -- When the EVENT happened. Never the ingest date.
  observed_at   DATE        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Corrections point forward; nothing is deleted.
  superseded_by BIGINT      REFERENCES position_signal_stored(id),
  CONSTRAINT position_signal_stored_direction_ck CHECK (direction IN (-1, 0, 1)),
  CONSTRAINT position_signal_stored_evidence_ck  CHECK (array_length(evidence_ids, 1) >= 1),
  CONSTRAINT position_signal_stored_weight_ck    CHECK (raw_weight >= 0 AND raw_weight <= 1)
);

-- One row per (actor, target, signal type, date). Makes the derivations re-runnable without
-- duplicating, which is what "standalone and re-runnable" in the brief's §3 means in practice.
CREATE UNIQUE INDEX IF NOT EXISTS position_signal_stored_uq
  ON position_signal_stored (actor_id, target_type, target_id, signal_type, observed_at);

-- The two real queries (brief §2).
CREATE INDEX IF NOT EXISTS position_signal_stored_actor_idx
  ON position_signal_stored (actor_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS position_signal_stored_target_idx
  ON position_signal_stored (target_type, target_id);

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- THE VOTE CLASSIFICATION — the only genuinely new fact in the vote half
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠ `division_votes.party` is the party AS AT THE DIVISION, not as at today. That was CHECKED
-- rather than taken from the 2D-2 view's comment (audit §A-3): members with more than one party
-- across their votes show clean, dated transitions — Jeremy Corbyn Labour → Independent (Nov 2020)
-- → Your Party (Jun 2026); Andrew Rosindell Conservative → Reform UK (Jan 2026). So the rebellion
-- derivation needs NO party inference and carries no inference caveat. The brief allowed for the
-- other case; the data did not need it.
CREATE TABLE IF NOT EXISTS position_division_party (
  house        TEXT    NOT NULL,
  division_id  INTEGER NOT NULL,
  party        TEXT    NOT NULL,
  ayes         INTEGER NOT NULL,
  noes         INTEGER NOT NULL,
  -- 'aye' | 'no' | NULL when the party split exactly evenly (there is no majority side to rebel
  -- against, and picking one would invent a rebellion for half the party).
  majority_side TEXT,
  -- larger side ÷ (ayes + noes). 1.0 = unanimous.
  cohesion     REAL    NOT NULL,
  -- FALSE for a group that carries no whip (Crossbench, Bishops, Independents, the Speakers) or
  -- that put too few members through the lobbies for a majority side to mean anything.
  is_whipped_party BOOLEAN NOT NULL,
  -- ⚠ NOT the negation of the column above, and conflating them was a real bug in the first run.
  -- `is_whipped_party` is FALSE for TWO different reasons — no whip exists, or too few voted — and
  -- the classifier needs to tell them apart: a crossbench peer is unwhipped however few
  -- crossbenchers turned out, while a party of three is merely unclassifiable. The first draft
  -- separated them by putting a ≥20 test on the unwhipped branch, which silently demoted
  -- crossbenchers in thin divisions into 'small-party-unclassified'. One column, one meaning.
  is_unwhipped_group BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (house, division_id, party)
);

-- Idempotent for a database that already has the table from the first application of this file.
-- `CREATE TABLE IF NOT EXISTS` does not add a column to an existing table, and the alternative —
-- dropping and recreating — is the one thing this file is not allowed to do.
ALTER TABLE position_division_party
  ADD COLUMN IF NOT EXISTS is_unwhipped_group BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS position_division_class (
  house           TEXT    NOT NULL,
  division_id     INTEGER NOT NULL,
  -- TRUE when no whipped party with enough voters reached the cohesion threshold. An INFERENCE,
  -- and it travels as one: `derivation` names the versioned method on every signal it produces.
  free_vote_like  BOOLEAN NOT NULL,
  -- the highest cohesion any whipped party reached — the number the flag was decided on, kept so
  -- a borderline division can be argued about rather than just re-run.
  best_cohesion   REAL,
  best_party      TEXT,
  n_whipped_parties INTEGER NOT NULL,
  threshold       REAL    NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (house, division_id)
);

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- THE VOTE SIGNAL — derived, in §3's shape
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠ 'absent' NEVER produces a signal. Design §5.4 and 2D-2 both: silence is silence, an absence is
-- not opposition, and in the Lords an absence is not even recorded (`divisions.absence_known`).
-- 398,919 absent rows are excluded here and the number is reported rather than dropped quietly.
--
-- ⚠ `raw_weight` comes from `position_raw_weight()`, which setup-3a.ts GENERATES from
-- lib/graph/position-config.ts. It is not typed twice: check-3a.ts asserts the function and the
-- TypeScript config agree class by class, and that check has been watched failing.
CREATE OR REPLACE VIEW position_signal_vote AS
SELECT
  ('v:' || v.house || ':' || v.division_id || ':' || v.member_id)::text AS signal_ref,
  e.id                                                    AS actor_id,
  'division'::text                                        AS target_type,
  (v.house || ':' || v.division_id)::text                 AS target_id,
  'vote'::text                                            AS signal_type,
  (CASE v.vote WHEN 'aye' THEN 1 ELSE -1 END)::smallint   AS direction,
  cls.derivation                                          AS derivation,
  position_raw_weight('vote', cls.derivation)             AS raw_weight,
  ARRAY[(v.house || '-divisions-votes:' || v.division_id || ':1')]::text[] AS evidence_ids,
  v.division_date                                         AS observed_at,
  FALSE                                                   AS supersedable,
  NULL::bigint                                            AS superseded_by
FROM division_votes v
JOIN graph_entity e
  ON e.parl_member_id = v.member_id AND e.kind = 'person'
JOIN position_division_class dc
  ON dc.house = v.house AND dc.division_id = v.division_id
LEFT JOIN position_division_party pp
  ON pp.house = v.house AND pp.division_id = v.division_id AND pp.party = v.party
-- ⚠ The LATERAL must come AFTER `dc` and `pp`: a lateral subquery may only reference FROM items to
-- its LEFT. Written the other way round first and Postgres refused it with "missing FROM-clause
-- entry for table pp" — a real error caught by applying the DDL rather than by reading it.
JOIN LATERAL (
  SELECT CASE
    -- 1. No whip applies to this group at all, so every vote it casts is the member's own view.
    --    Tested on the GROUP, never on turnout: a crossbench peer is unwhipped in a division where
    --    four crossbenchers voted just as much as in one where ninety did.
    WHEN COALESCE(pp.is_unwhipped_group, FALSE) THEN 'unwhipped-group:v1'
    -- 2. The division looks unwhipped for everyone.
    WHEN dc.free_vote_like THEN 'free-vote-heuristic:v1'
    -- 3. Their own party had a clear majority side and they were not on it.
    WHEN pp.is_whipped_party AND pp.majority_side IS NOT NULL AND pp.majority_side <> v.vote
      THEN 'rebellion:v1'
    -- 4. Their own party had a clear majority side and they were on it.
    WHEN pp.is_whipped_party AND pp.majority_side IS NOT NULL
      THEN 'whipped-with:v1'
    -- 5. Everything else: too few of their party voted for "their party's side" to mean anything.
    ELSE 'small-party-unclassified:v1'
  END AS derivation
) cls ON TRUE
WHERE v.vote IN ('aye', 'no');

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- THE ONE THING EVERY CONSUMER READS
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW position_signal AS
  SELECT ('s:' || id)::text AS signal_ref, actor_id, target_type, target_id, signal_type,
         direction, derivation, raw_weight, evidence_ids, observed_at,
         TRUE AS supersedable, superseded_by, 'stored'::text AS storage
    FROM position_signal_stored
   WHERE superseded_by IS NULL
UNION ALL
  SELECT signal_ref, actor_id, target_type, target_id, signal_type,
         direction, derivation, raw_weight, evidence_ids, observed_at,
         supersedable, superseded_by, 'derived'::text AS storage
    FROM position_signal_vote;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- THE ESTIMATE LAYER — derived, safe to truncate and rebuild (design §2)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS position_estimate (
  actor_id       BIGINT NOT NULL REFERENCES graph_entity(id) ON DELETE CASCADE,
  target_type    TEXT   NOT NULL,
  target_id      TEXT   NOT NULL,
  stance_score   REAL   NOT NULL,
  confidence     REAL   NOT NULL,
  -- per signal_type: { n, weight } — the "grounds" a display line is built from.
  signal_counts  JSONB  NOT NULL,
  config_version TEXT   NOT NULL,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, target_type, target_id),
  CONSTRAINT position_estimate_score_ck      CHECK (stance_score >= -1 AND stance_score <= 1),
  CONSTRAINT position_estimate_confidence_ck CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS position_estimate_target_idx
  ON position_estimate (target_type, target_id, confidence DESC);

-- ⚠ ADDITION TO §3, and the reason is reproducibility. Decay is measured against an AS-AT date, so
-- "which numbers produced this table" is (config_version, as_of) and not config_version alone. A
-- rebuild on a different day with identical config produces legitimately different estimates, and
-- without this row nothing on the page would say so.
CREATE TABLE IF NOT EXISTS position_estimate_meta (
  id             BIGSERIAL PRIMARY KEY,
  config_version TEXT NOT NULL,
  as_of          DATE NOT NULL,
  n_estimates    BIGINT NOT NULL,
  n_signals      BIGINT NOT NULL,
  elapsed_ms     INTEGER NOT NULL,
  built_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
