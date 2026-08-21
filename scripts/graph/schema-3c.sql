-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- schema-3c.sql — GRAPH 3C. ADDITIVE ONLY. Applied by setup-3c.ts, which refuses anything this
-- file does not own and refuses any DROP.
--
-- Four things:
--
--   1. `position_division_party.is_cohesive_party` — did this party actually hold together in this
--      division? Additive column, filled by derive-vote-classes.ts from `cohesion` and the config
--      threshold. It is the fact the whole of §2 turns on.
--   2. `position_division_class.free_vote_source` — WHY a division is tagged free-vote-like, so the
--      widened rule is auditable rather than merely wider.
--   3. `position_vote_class_v2()` — the classification ladder with the §2 fix in it.
--   4. `position_estimate.consistency` — §1's second axis, stored beside the score it was split out
--      of, so the distribution can be audited from SQL rather than recomputed in TypeScript.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHY (3) IS A NEW NAME AND NOT `CREATE OR REPLACE` ON THE OLD ONE
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- The ladder needs one more input (`is_cohesive_party`), and in PostgreSQL a `CREATE OR REPLACE
-- FUNCTION` with a different argument list does not replace anything — it creates an OVERLOAD.
-- Both would then exist under one name, the callers would bind by arity, and the two ladders would
-- be free to disagree with nothing visible to say so. That is exactly the "two sources of truth
-- wearing one name" failure 3B found in `position_raw_weight()`. So the new ladder gets a new name,
-- `check-3c.ts` asserts the view and the read function both call **v2**, and the 5-argument
-- original is left in place unreferenced (setup-3c refuses DROPs, by design).
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHAT §2 ACTUALLY CHANGES, IN ONE SENTENCE AND THEN IN NUMBERS
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- A member can only rebel against a whip that held. Measured on the case that prompted the sprint:
--
--     commons:2051  Terminally Ill Adults Bill, Amendment (b) to New Clause 14, 13 Jun 2025
--       Labour        aye 126   no 181   cohesion 0.5896
--       Conservative  aye  71   no  12   cohesion 0.8554   <- the ONLY party over the 0.85 line
--
-- One party of 83 holding together at 0.855 was enough to make the division "whipped" for everyone,
-- so 126 Labour members who voted with a party that had split almost down the middle were recorded
-- as `rebellion:v1` at 0.9 — the highest weight in the config — and the 181 on the other side as
-- `whipped-with:v1` at 0.2. Neither describes what happened.
--
-- Across the whole graph: **8,773 of the 18,999 minority-side votes currently classed
-- `rebellion:v1` (46.2%) come from a party whose cohesion was below 0.85.**
-- ════════════════════════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 1 · DID THIS PARTY HOLD TOGETHER?
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Nullable with no default on purpose. A NULL here means "derive-vote-classes.ts has not run since
-- 3C landed", which the ladder must treat as NOT cohesive (COALESCE below) — the safe direction,
-- because it withholds the 0.9 rather than granting it on missing information.
ALTER TABLE position_division_party
  ADD COLUMN IF NOT EXISTS is_cohesive_party BOOLEAN;


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · WHY A DIVISION IS TAGGED FREE-VOTE-LIKE
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
--   'no-party-cohesive'  no whipped party reached `cohesionThreshold` — 3A's original rule, kept.
--   'bill-propagated'    a strict majority of THIS BILL's divisions are free-vote-like on that
--                        rule, and this division's own most-cohesive party was itself a near miss.
--
-- The second condition is what stops propagation being a licence. Brief §2 requires the classic
-- free votes in the tagged list and the whipped Northern Ireland abortion regulations out of it;
-- `probe-3c-rules.ts` scores four candidate rules against six named cases decided from the public
-- record, and this is the only one that gets all the negative controls right.
ALTER TABLE position_division_class
  ADD COLUMN IF NOT EXISTS free_vote_source TEXT;


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · THE LADDER, v2
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION position_vote_class_v2(
  p_is_unwhipped_group BOOLEAN,
  p_free_vote_like     BOOLEAN,
  p_is_whipped_party   BOOLEAN,   -- classifiable: a whipped group with enough voters to judge
  p_is_cohesive_party  BOOLEAN,   -- AND it actually held together, at cohesionThreshold
  p_majority_side      TEXT,
  p_vote               TEXT
) RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    -- 1. No whip applies to this group at all, so every vote it casts is the member's own view.
    --    Tested on the GROUP, never on turnout: a crossbench peer is unwhipped in a division where
    --    four crossbenchers voted just as much as in one where ninety did.
    WHEN COALESCE(p_is_unwhipped_group, FALSE) THEN 'unwhipped-group:v1'
    -- 2. The division looks unwhipped for everyone.
    WHEN p_free_vote_like THEN 'free-vote-heuristic:v1'
    -- 3. ⚠⚠ GRAPH 3C §2 — THE NEW RUNG, AND THE REASON THE OTHERS CAN BE TRUSTED.
    --    Their party voted both ways, below the cohesion threshold. There is no majority side to
    --    be with or against in any meaningful sense, so neither `rebellion:v1` nor `whipped-with:v1`
    --    is a true description — and BOTH of the old descriptions were wrong, in opposite
    --    directions, on the same division.
    WHEN COALESCE(p_is_whipped_party, FALSE) AND NOT COALESCE(p_is_cohesive_party, FALSE)
      THEN 'party-split:v1'
    -- 4. Their own party held together and they were not on its side. THIS is a rebellion.
    WHEN COALESCE(p_is_cohesive_party, FALSE) AND p_majority_side IS NOT NULL AND p_majority_side <> p_vote
      THEN 'rebellion:v1'
    -- 5. Their own party held together and they were on its side.
    WHEN COALESCE(p_is_cohesive_party, FALSE) AND p_majority_side IS NOT NULL
      THEN 'whipped-with:v1'
    -- 6. Everything else: too few of their party voted for "their party's side" to mean anything.
    ELSE 'small-party-unclassified:v1'
  END
$$;


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 4 · THE TWO CALLERS, REPOINTED AT v2
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠ Both keep their own FROM clause exactly as 3B left them. That duplication is deliberate and its
-- reason is in schema-3b.sql: the view's shape is what lets `build-position-estimates.ts` push
-- `actor_id BETWEEN` into the `graph_entity` scan, and routing it through the set-returning
-- function once truncated `position_estimate` and left it half-rebuilt. `check-3c.ts` asserts the
-- two return identical rows, over a sample it separately asserts is non-empty.
CREATE OR REPLACE FUNCTION position_signal_vote_for(p_targets TEXT[] DEFAULT NULL)
RETURNS TABLE (
  signal_ref    TEXT,
  actor_id      BIGINT,
  target_type   TEXT,
  target_id     TEXT,
  signal_type   TEXT,
  direction     SMALLINT,
  derivation    TEXT,
  raw_weight    REAL,
  evidence_ids  TEXT[],
  observed_at   DATE,
  supersedable  BOOLEAN,
  superseded_by BIGINT
)
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  WITH want AS (
    SELECT split_part(t, ':', 1) AS house,
           split_part(t, ':', 2)::int AS division_id
      FROM unnest(COALESCE(p_targets, ARRAY[]::text[])) AS t
     WHERE split_part(t, ':', 2) ~ '^[0-9]+$'
  ),
  src AS (
    SELECT v.*
      FROM division_votes v
     WHERE p_targets IS NULL
    UNION ALL
    SELECT v.*
      FROM want
      JOIN division_votes v
        ON v.house = want.house AND v.division_id = want.division_id
     WHERE p_targets IS NOT NULL
  )
  SELECT
    ('v:' || v.house || ':' || v.division_id || ':' || v.member_id)::text,
    e.id,
    'division'::text,
    (v.house || ':' || v.division_id)::text,
    'vote'::text,
    (CASE v.vote WHEN 'aye' THEN 1 ELSE -1 END)::smallint,
    cls.derivation,
    position_raw_weight('vote', cls.derivation),
    ARRAY[(v.house || '-divisions-votes:' || v.division_id || ':1')]::text[],
    v.division_date,
    FALSE,
    NULL::bigint
  FROM src v
  JOIN graph_entity e
    ON e.parl_member_id = v.member_id AND e.kind = 'person'
  JOIN position_division_class dc
    ON dc.house = v.house AND dc.division_id = v.division_id
  LEFT JOIN position_division_party pp
    ON pp.house = v.house AND pp.division_id = v.division_id AND pp.party = v.party
  JOIN LATERAL (
    SELECT position_vote_class_v2(pp.is_unwhipped_group, dc.free_vote_like,
                                  pp.is_whipped_party, pp.is_cohesive_party,
                                  pp.majority_side, v.vote) AS derivation
  ) cls ON TRUE
  WHERE v.vote IN ('aye', 'no')
$$;

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
JOIN LATERAL (
  SELECT position_vote_class_v2(pp.is_unwhipped_group, dc.free_vote_like,
                                pp.is_whipped_party, pp.is_cohesive_party,
                                pp.majority_side, v.vote) AS derivation
) cls ON TRUE
WHERE v.vote IN ('aye', 'no');


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 5 · §1 — THE SECOND AXIS, STORED
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- `stance_score` used to BE this number (`signed / mass`, a normalised mean direction). 3C splits
-- the two apart: `stance_score` becomes direction × evidence strength, and `consistency` keeps the
-- old ratio under the name that describes it. Both are stored because the report has to show the
-- distribution of each, and because every form of words is derived from `consistency` — a wording
-- regression is then a query, not an argument.
--
-- Nullable, no default: NULL means "written by a build that predates 3C", which is a fact worth
-- being able to see rather than a zero worth mistaking for a split record.
ALTER TABLE position_estimate
  ADD COLUMN IF NOT EXISTS consistency REAL;
