-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- schema-3b.sql — GRAPH 3B. ADDITIVE ONLY. Applied by setup-3b.ts, which refuses anything this
-- file does not own and refuses any DROP.
--
-- Three things, and only three:
--
--   1. `position_vote_class()` — the derivation CASE ladder, lifted OUT of the
--      `position_signal_vote` view body so there is exactly one copy of it. The view is redefined
--      to call it. Nothing about the classification changes; `check-3b.ts` asserts the redefined
--      view returns the same 2,080,585 rows with the same derivations as before, and that check
--      has been watched failing against a planted change.
--
--   2. `position_signal_for(types[], ids[])` — the SAME query as the `position_signal` view, with
--      the target filter PUSHED IN so it can reach an index.
--
--   3. `position_donation` — §2.2, the Electoral Commission register. See its own header below.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHY (2) EXISTS AT ALL, MEASURED RATHER THAN ASSERTED — brief §1's 9,048 ms
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- `probe-3b-perf.ts`, three runs each, min reported:
--
--     A · through the `position_signal` view, as positions.ts did          1,710 ms
--     B · the same rows, division predicate decomposed to (house, id)         40 ms   43× faster
--     C · concatenated predicate, no expression index (control)              716 ms
--
-- The plan says why. The view derives `target_id` as `house || ':' || division_id` — a COMPUTED
-- expression — and the wanted targets arrive as a two-row function scan. Postgres cannot push a
-- hash-join condition into a computed column, so it materialises **all 2,317,523 signals** and then
-- discards 2,316,542 of them:
--
--     Hash Join  (rows=981)
--       ->  Append  (rows=2317523)                     <- the whole graph, every time
--             ->  Seq Scan on division_votes  (rows=2129113)
--
-- ⚠ **IT IS NOT A MISSING INDEX, AND THAT MATTERS FOR THE FIX.** `idx_dv_div (house, division_id)`
-- already exists and is exactly right — B's plan uses it and finishes the index scan in 1.95 ms.
-- The index was unreachable because a VIEW CANNOT TAKE A PARAMETER, so the predicate had nowhere
-- to go. Control C shows an expression index on `(house || ':' || division_id)` would have helped
-- (716 ms vs 1,710 ms) and would still have been 18× slower than simply decomposing the predicate,
-- while costing a new index on a 2.1M-row table. A set-returning function is Postgres's own answer
-- to a parameterised view, and it needs no new storage at all.
--
-- ⚠ The function does NOT reimplement the view. It selects from `position_signal_vote_for()`, which
-- shares `position_vote_class()` with the view. `check-3b.ts` additionally asserts, target type by
-- target type, that the function and the view return identical rows — because "one definition" is
-- a claim, and a claim about two code paths agreeing needs something that would notice if they did
-- not.
-- ════════════════════════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 1 · THE CLASSIFICATION LADDER, NOW NAMED
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Byte-for-byte the ladder that was inline in schema-3a.sql's `position_signal_vote`, with the
-- comments that justify each branch. IMMUTABLE: it reads nothing, so the planner may fold it.
CREATE OR REPLACE FUNCTION position_vote_class(
  p_is_unwhipped_group BOOLEAN,
  p_free_vote_like     BOOLEAN,
  p_is_whipped_party   BOOLEAN,
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
    -- 3. Their own party had a clear majority side and they were not on it.
    WHEN p_is_whipped_party AND p_majority_side IS NOT NULL AND p_majority_side <> p_vote
      THEN 'rebellion:v1'
    -- 4. Their own party had a clear majority side and they were on it.
    WHEN p_is_whipped_party AND p_majority_side IS NOT NULL
      THEN 'whipped-with:v1'
    -- 5. Everything else: too few of their party voted for "their party's side" to mean anything.
    ELSE 'small-party-unclassified:v1'
  END
$$;


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · THE VOTE SIGNALS, OPTIONALLY RESTRICTED TO A SET OF DIVISIONS
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- `p_targets` is an array of `house:division_id` strings, or NULL for all of them.
--
-- ⚠ The decomposition happens in a CTE and the predicate is a plain JOIN, not an `OR p_targets IS
-- NULL` disjunction in the WHERE clause. A disjunction there would be correct and would ALSO make
-- the index unreachable again — the planner cannot use an index for a condition that might not
-- apply — which would have reproduced the exact bug this function exists to fix, silently. Two
-- branches, chosen by a UNION ALL whose arms are each individually indexable, is the shape that
-- keeps the fast path fast.
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
     -- A malformed id must not blow the query up on the cast. Design §6: an unparseable target is
     -- an absence of record, and absence is the caller's to render.
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
    SELECT position_vote_class(pp.is_unwhipped_group, dc.free_vote_like,
                               pp.is_whipped_party, pp.majority_side, v.vote) AS derivation
  ) cls ON TRUE
  WHERE v.vote IN ('aye', 'no')
$$;


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- THE 3A VIEW, WITH THE LADDER REPLACED BY THE FUNCTION CALL — AND NOT BY THE FUNCTION
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠⚠ THIS WAS `SELECT * FROM position_signal_vote_for(NULL)` FOR ONE RUN, AND IT BROKE THE ESTIMATE
-- BUILD. Measured, not suspected:
--
--   · 3A's build: 2,304,748 estimates in 225 seconds.
--   · through the function: 1,357,000 rows and then a client-side read timeout past 600 seconds,
--     leaving `position_estimate` TRUNCATED AND HALF-REBUILT.
--
-- The reason is in the plan. `build-position-estimates.ts` walks actors in batches with
-- `WHERE actor_id BETWEEN $1 AND $2`. Against the view as 3A wrote it the planner pushes that into
-- the `graph_entity` scan and nested-loops into `division_votes`. Against a set-returning function
-- `actor_id` is an OUTPUT COLUMN, so the filter can only be applied afterwards:
--
--     ->  Subquery Scan on position_signal_vote_for  (rows=3894)
--           ->  Hash Join  (rows=709704 loops=3)        <- the whole vote arm, on every batch
--
-- So the view keeps its own FROM clause, exactly as 3A wrote it, and ONLY the CASE ladder is
-- replaced by `position_vote_class(...)` — an IMMUTABLE scalar function the planner folds. The
-- classification still has one home, which was the point; the bulk path keeps its plan.
--
-- ⚠ The FROM clause is now written twice — here and in `position_signal_vote_for()`. That is a real
-- duplication, accepted deliberately: the two shapes serve two access patterns and neither can
-- serve the other. It is made safe the only way a duplication can be — `check-3b.ts` asserts the
-- two return identical rows, target type by target type, over a sample it also asserts is
-- non-empty.
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
  SELECT position_vote_class(pp.is_unwhipped_group, dc.free_vote_like,
                             pp.is_whipped_party, pp.majority_side, v.vote) AS derivation
) cls ON TRUE
WHERE v.vote IN ('aye', 'no');


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · THE READ PATH — `position_signal`, restricted to the targets a caller actually asked for
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Same shape as the `position_signal` view, same union, same `storage` column. The stored arm gets
-- its own indexed predicate (`position_signal_stored_target_idx` already covers it); the vote arm
-- is only consulted at all when a 'division' target was asked for.
CREATE OR REPLACE FUNCTION position_signal_for(p_types TEXT[], p_ids TEXT[])
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
  superseded_by BIGINT,
  storage       TEXT
)
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT ('s:' || s.id)::text, s.actor_id, s.target_type, s.target_id, s.signal_type,
         s.direction, s.derivation, s.raw_weight, s.evidence_ids, s.observed_at,
         TRUE, s.superseded_by, 'stored'::text
    FROM unnest(p_types, p_ids) AS want(target_type, target_id)
    JOIN position_signal_stored s
      ON s.target_type = want.target_type AND s.target_id = want.target_id
   WHERE s.superseded_by IS NULL
  UNION ALL
  SELECT v.signal_ref, v.actor_id, v.target_type, v.target_id, v.signal_type, v.direction,
         v.derivation, v.raw_weight, v.evidence_ids, v.observed_at, v.supersedable,
         v.superseded_by, 'derived'::text
    FROM position_signal_vote_for(
      -- Only the division targets reach the vote arm. Passing the EDM and inquiry ids too would be
      -- harmless (they fail the numeric guard) but would make the array longer for no reason.
      (SELECT COALESCE(array_agg(want.target_id), ARRAY[]::text[])
         FROM unnest(p_types, p_ids) AS want(target_type, target_id)
        WHERE want.target_type = 'division')
    ) v
$$;


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 4 · §2.2 — THE ELECTORAL COMMISSION DONATIONS REGISTER
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Bulk public data, fetched from the Commission's own CSV export. One row per published donation
-- record, keyed on the Commission's own reference so a re-ingest updates rather than duplicates.
--
-- ⚠⚠ WHY THE RESOLUTION COLUMNS ARE NULLABLE AND WHY THAT IS THE POINT
-- Brief §2: *"Never merge two identities on similarity (standing rule). Register data is full of
-- near-matches and this is exactly where a wrongly merged identity gets created — a person who does
-- not exist, holding contradictory views, with nothing visibly wrong. An unresolved name stays
-- unresolved and is counted in the report."*
--
-- So both ends resolve by an EXACT KEY or not at all:
--   · the DONOR resolves only on `company_registration_number` → `graph_entity.companies_house_no`.
--     Never on the donor's name. 16,355 rows carry a number; 1,489 of those match an organisation
--     we already hold (9.1%).
--   · the DONEE resolves only where the normalised name matches EXACTLY ONE MNIS-identified person
--     in `graph_entity`, and the row's donee type is one this graph is willing to name. A colliding
--     name yields two candidates and is left unresolved BY CONSTRUCTION, not by intention.
--
-- `donee_resolution` records WHICH of those happened, on every row, so the exclusion rate in the
-- report is a query rather than a recollection.
--
-- ⚠ Direction 0, always. §2: *"A donation is not a position."* The estimate engine caps every
-- direction-0 signal type at `attentionConfidenceCeiling`, and check-3b asserts that the cap holds
-- after this register lands — the check exists because the temptation to turn a funding path into a
-- stance is exactly what this design was built to resist.
CREATE TABLE IF NOT EXISTS position_donation (
  ec_ref            TEXT PRIMARY KEY,          -- the Commission's own reference; the natural key
  regulated_entity_name TEXT NOT NULL,          -- who received it, as published
  regulated_entity_type TEXT NOT NULL,          -- 'Political Party' | 'Regulated Donee'
  regulated_donee_type  TEXT,                   -- 'MP - Member of Parliament', 'Mayor', …
  donor_name        TEXT,
  donor_status      TEXT,                       -- 'Company' | 'Individual' | 'Trade Union' | …
  company_registration_number TEXT,             -- the ONLY key a donor is ever resolved on
  value_pence       BIGINT,
  accepted_date     DATE,                       -- the date of the EVENT, never the ingest date
  donation_type     TEXT,
  nature_of_donation TEXT,
  is_sponsorship    BOOLEAN,
  -- resolution, by exact key only
  donee_entity_id   BIGINT REFERENCES graph_entity(id) ON DELETE SET NULL,
  donor_entity_id   BIGINT REFERENCES graph_entity(id) ON DELETE SET NULL,
  -- 'resolved:unique-mnis-name' | 'unresolved:no-entity' | 'unresolved:ambiguous-name'
  -- | 'unresolved:not-an-individual' | 'unresolved:donee-type-excluded'
  donee_resolution  TEXT NOT NULL,
  -- 'resolved:companies-house-no' | 'unresolved:no-number' | 'unresolved:number-not-held'
  donor_resolution  TEXT NOT NULL,
  source_url        TEXT,
  ingested_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS position_donation_donee_idx ON position_donation (donee_entity_id)
  WHERE donee_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS position_donation_donor_idx ON position_donation (donor_entity_id)
  WHERE donor_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS position_donation_date_idx ON position_donation (accepted_date DESC);
