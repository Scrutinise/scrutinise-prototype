-- schema-2d2.sql — BRIEF_GRAPH_2D2 §1 `voted`, §2 the person sweep, §3 `signed-motion`.
--
-- DDL OF RECORD for sprint 2D-2. Applied by position-graph/setup-2d2.ts, which prints the target
-- host first (docs/CLAUDE.md §16). Additive and idempotent; there is no DROP in this file.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- THE LOAD-BEARING DECISION, AND WHY IT IS NOT THE ONE THE BRIEF ASSUMED
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- §1 asks for 2,528,032 `voted` edges. Writing them into `graph_edge` was PRICED BEFORE ANYTHING WAS
-- WRITTEN, from this database's own measured per-row cost (probe-2d2-cost.ts, 16 Aug 2026):
--
--     graph_edge      584.5 bytes/row  ×  2,528,032  =  1.376 GiB
--     graph_evidence  355.8 bytes/row  ×  2,528,032  =  0.838 GiB
--                                                       ─────────
--                                                       2.21  GiB
--
-- Measured headroom at the time of writing: **16.57 GiB of the 17.5 GiB Neon line — 94.7%**, i.e.
-- ~0.93 GiB free. The ask is 2.4× the space that exists. This is not a close call, and it is
-- already above the 90% CRITICAL threshold the ops observer alerts on.
--
-- ⚠ The answer is NOT to shrink the work until it fits (root CLAUDE.md §17 names that as the wrong
-- move) and NOT to write a summary (§1 forbids it: "store the vote itself, not a summary").
--
-- The answer is that **the edge table already exists and is called `division_votes`.** It holds one
-- row per member per division at 193.2 bytes/row — a THIRD of what the generic edge table costs for
-- the same fact — with the member id, the vote, the teller flag, the party as at the division date
-- and the date itself. Copying it into `graph_edge` would spend 2.21 GiB to hold a second, staler
-- copy of 450 MB of data we already have, and would introduce the possibility of the two disagreeing.
--
-- So `voted` is expressed as a VIEW over the tables that already hold it. This is not a reduction in
-- scope: every requirement of §1 survives intact and is checked by verify-2d2.ts —
--
--   · the vote itself, not a summary   → `qualifier` is aye | no | absent, plus `teller`, per row
--   · absent ≠ against (§5.4)          → 'absent' is its own value and `absence_known` rides beside
--                                        it, because a Lords absent_count of 0 means NOT PUBLISHED
--   · every edge dated                 → `observed_on` = the division date, never today's date
--   · parent Bill and stage carried    → bill_title / stage / amendment, WITH their provenance
--   · evidence coverage 100%           → `evidence_section_id` is derived, and verify-2d2.ts proves
--                                        every derived id exists in corpus_sections
--   · "passed without a division"       → still expressible, and still NOT inferred: stage_outcomes
--                                        stays empty, and the absence of a `voted` edge means we
--                                        have no division record, not that there was no division
--
-- The same reasoning applies to §3. What we do NOT hold for EDMs is the sponsor's Parliament member
-- id — the brief is right that `PrimarySponsor.MnisId` is on the wire and our ingest drops it. So
-- the id is what gets STORED (`edm_sponsor`, ~7 MB), and the edge is again a view over it.
--
-- The rule this generalises to, and the reason it is written here rather than in a commit message:
-- **store the fact we do not already have; derive the edge from it.** A graph whose edges are views
-- over their sources cannot drift from those sources, which is worth more than the row count.

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §2 — THE IDENTITY REGISTER
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- The sweep's source is **members-api.parliament.uk**, Parliament's own register, OPL v3.0 — the
-- same API family already mapped OPL3 in shared/licence-map.ts (bills-api, committees-api,
-- erskine-may, division-votes, treaties).
--
-- ⚠ IT IS NOT mySociety's `parlparse/members/people.json`, and that was a deliberate refusal.
-- people.json is one 27.7 MB file carrying 14,796 persons and — the tempting part — a
-- `datadotparl_id` crosswalk on 2,952 of them, which would have joined the TheyWorkForYou person id
-- space to the MNIS id space in a single fetch. Its licence was CHECKED RATHER THAN ASSUMED
-- (16 Aug 2026): the repo's LICENSE.txt covers "the software in this directory" under AGPL-3.0 and
-- says nothing about the data; GitHub reports the repo licence as NOASSERTION. An unstated data
-- licence on a derived database is the Public Whip question again (see licence-map.ts's
-- 'publicwhip-divisions' block, ODbL share-alike, flagged and not ingested), and it is Charlie's
-- call rather than an ingest decision. Parliament's own API answers the same question under a
-- licence we have already accepted, so nothing is lost by declining it.

-- One row per Parliament member (MNIS). Current AND former, both houses.
CREATE TABLE IF NOT EXISTS graph_member_register (
  mnis_id            INTEGER PRIMARY KEY,
  name_display       TEXT,
  name_list          TEXT,
  name_full_title    TEXT,
  name_address       TEXT,
  gender             TEXT,
  -- 1 = Commons, 2 = Lords. This is the LATEST house, not the only one: 105 of the members who
  -- appear in division_votes sat in both, which is the whole argument for keying on the id.
  latest_house       SMALLINT,
  latest_party       TEXT,
  latest_party_abbrev TEXT,
  membership_from    TEXT,        -- constituency, or 'Life peer' etc. in the Lords
  membership_start   DATE,
  membership_end     DATE,
  is_current         BOOLEAN,
  fetched_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every name form the register has ever carried for a member, DATED.
--
-- ⚠ THIS TABLE IS THE POINT OF §2. `Mrs Theresa May` and `Baroness May of Maidenhead` are one
-- person and a name match cannot know it; MNIS id 8 says so, with the date the name changed
-- (2024-08-21). Conversely two members really called `John Smith` are two people, and a name match
-- cannot know that either. Both directions are decided here, from the register, and both are
-- reported — because §2's rule is that a SPLIT matters more than a merge and is harder to notice.
CREATE TABLE IF NOT EXISTS graph_member_name (
  mnis_id      INTEGER NOT NULL REFERENCES graph_member_register(mnis_id) ON DELETE CASCADE,
  surface      TEXT NOT NULL,     -- exactly as the source gave it
  surface_norm TEXT NOT NULL,     -- normalisePersonName(), the SAME function that built
                                  -- graph_entity.name_norm — a different normaliser here would
                                  -- silently fail to match and look like poor source coverage
  start_date   DATE,
  end_date     DATE,              -- NULL = still current
  -- where the surface came from, so a match can be attributed:
  -- 'name-history' | 'display' | 'list' | 'full-title' | 'address' | 'division-votes'
  source       TEXT NOT NULL,
  PRIMARY KEY (mnis_id, surface, source)
);
CREATE INDEX IF NOT EXISTS graph_member_name_norm_idx ON graph_member_name (surface_norm);
CREATE INDEX IF NOT EXISTS graph_member_name_mnis_idx ON graph_member_name (mnis_id);

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §3 — THE EDM SPONSOR ID WE WERE THROWING AWAY
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- `corpus_sections.speaker` holds the sponsor's DISPLAY NAME on all 60,737 EDM rows. The API's list
-- item also carries `PrimarySponsor.MnisId` (verified live, 16 Aug 2026: motion → MnisId 4394,
-- "Imran Hussain") and a top-level `MemberId`, and processEarlyDayMotions keeps neither. Recovering
-- them makes these edges KEYED rather than name-matched, which is the difference between "an MP
-- called Andrew Smith sponsored this" and "this MP sponsored this".
CREATE TABLE IF NOT EXISTS edm_sponsor (
  motion_id      INTEGER PRIMARY KEY,
  -- NULL where the API itself gave no id. NULL is a recorded fact here, not a failure: it is how
  -- many motions cannot be keyed, and it is reported rather than quietly dropped.
  mnis_id        INTEGER,
  sponsor_name   TEXT NOT NULL,
  party          TEXT,
  constituency   TEXT,
  date_tabled    DATE,
  sponsors_count INTEGER,           -- signature count. ⚠ NOT the signatories: see the view comment.
  uin            TEXT,
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS edm_sponsor_mnis_idx ON edm_sponsor (mnis_id) WHERE mnis_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- THE EDGES
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- `voted` — MP or peer → division. One row per member per division, never a summary.
CREATE OR REPLACE VIEW graph_voted_edge AS
SELECT
  e.id                                              AS subject_id,
  e.canonical_name                                  AS subject_name,
  v.member_id                                       AS subject_mnis_id,
  'voted'::text                                     AS predicate,
  'division'::text                                  AS object_kind,
  v.house || ':' || v.division_id                   AS object_ref,
  d.title                                           AS object_label,
  -- THE VOTE ITSELF. 'absent' is a first-class value and is NOT opposition (design §5.4).
  v.vote                                            AS qualifier,
  v.teller                                          AS teller,
  -- ⚠ FALSE means the absent count was never published (the Lords publishes no equivalent of the
  -- Commons NoVoteRecorded), so the ABSENCE of an 'absent' row in the Lords is silence, not
  -- attendance. Reading a vote row without this flag is the error the flag exists to prevent.
  d.absence_known                                   AS absence_known,
  v.division_date                                   AS observed_on,
  -- What the provision was carried inside, never collapsed into one field — and with the
  -- provenance, because a parsed Bill title must not read as though the API stated it.
  d.bill_title, d.stage, d.amendment, d.context_provenance,
  -- Party and seat AS AT THE DIVISION, not as at today.
  v.party, v.party_abbrev, v.constituency,
  d.house                                           AS house,
  d.source_url                                      AS source_url,
  -- Derived, not stored. verify-2d2.ts proves every one of these exists in corpus_sections; that
  -- proof is what "100% evidence coverage" means here, and it is a check that can fail.
  v.house || '-divisions-votes:' || v.division_id || ':1' AS evidence_section_id
FROM division_votes v
JOIN divisions   d ON d.house = v.house AND d.division_id = v.division_id
JOIN graph_entity e ON e.parl_member_id = v.member_id AND e.kind = 'person';

-- `signed-motion` — person → motion, PRIMARY SPONSOR ONLY.
--
-- ⚠ The name of the predicate is wider than what this view contains, and that gap is the thing most
-- likely to be misread later. Amendment 1 §1 defines `signed-motion` as person → motion for a
-- SIGNATURE. A primary sponsor is one signatory — the first — and the other `sponsors_count - 1`
-- signatories are NOT here. `role` is therefore explicit on every row, and it must stay explicit
-- when the full signatory scrape lands, because a withdrawn signature is a changed position and the
-- design treats a changed position as a finding.
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
  'early-day-motions:' || s.motion_id || ':1' AS evidence_section_id
FROM edm_sponsor s
JOIN graph_entity e ON e.parl_member_id = s.mnis_id AND e.kind = 'person'
WHERE s.mnis_id IS NOT NULL
  -- ⚠ AN EDGE MAY ONLY EXIST FOR A MOTION WE CAN SHOW. `edm_sponsor` deliberately holds all 60,995
  -- motions the API lists, including the 258 tabled since the last ingest; we hold 60,737 sections.
  -- Without this clause the view emitted 258 edges whose evidence id resolves to nothing, and
  -- verify-2d2.ts failed on exactly that count. The design's rule is not negotiable here: "an edge
  -- with no evidence row is a claim we cannot show our working for". The 258 are a REPORTED gap in
  -- the ingest, not a silently-carried edge.
  AND EXISTS (SELECT 1 FROM corpus_sections c
               WHERE c.id = 'early-day-motions:' || s.motion_id || ':1');

-- One place to count edges, whatever their storage. The stored predicates and the derived ones in
-- a single shape, so "how many edges does this actor hold" is one query rather than three.
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
    FROM graph_signed_motion_edge;
