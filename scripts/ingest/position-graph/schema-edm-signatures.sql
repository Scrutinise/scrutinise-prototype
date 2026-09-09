-- schema-edm-signatures.sql — BRIEF_INGEST_EDM_SIGNATURES §2: the 2.06 million signatures.
--
-- DDL OF RECORD for the EDM-signatures sprint. Applied by position-graph/setup-edm-signatures.ts,
-- which prints the target host first (docs/CLAUDE.md §16) and refuses anything that is not Neon
-- production. Additive and idempotent; there is no DROP in this file.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHAT §1's AUDIT SETTLED, BECAUSE THE SHAPE OF THIS FILE FOLLOWS FROM IT
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Measured live on 150 motions sampled by md5(motion_id) — NOT by id, because `edm_sponsor.motion_id`
-- ascends with the tabling date and an id-ordered sample would have been one session's worth of
-- motions (the trap `ORDER BY id` already set for the tna-caselaw pilot):
--
--   route                GET /EarlyDayMotion/{id}  → Response.Sponsors[]     (the list endpoint
--                        carries only PrimarySponsor, which is why we hold one name per motion)
--   date signed          `CreatedWhen`   5,739 of 5,739 rows = 100.00%
--   identity             `Member.MnisId` 5,739 of 5,739 rows = 100.00%, 0 name-only
--   sponsor vs signatory `SponsoringOrder = 1` on 150 of 150 motions, and equal to
--                        `PrimarySponsor.MnisId` on 150 of 150
--   withdrawals          `IsWithdrawn` / `WithdrawnDate` — 36 of 5,739 rows (0.63%), all dated
--   coverage in time     signatories returned for every tabling year from 1990 to 2026, dated 100%
--
-- ⚠ THE DATE IS NOT THE TABLING DATE, AND THAT IS THE WHOLE REASON THIS TABLE EXISTS RATHER THAN A
-- COUNT. 4,614 of 5,739 signatures (80.4%) were added AFTER the motion was tabled; 1,116 on the
-- day; 9 before it. The design's decay applies to when the act happened, so a signature added two
-- years after tabling is a materially different fact from one added on day one, and
-- `edm_sponsor.date_tabled` — the only date we held — is the wrong one for four signatures in five.
--
-- ⚠⚠ TWO FIELDS THE API OFFERS AND THIS TABLE REFUSES: `Member.Party` and `Member.Constituency`.
-- They are the member's party and seat **AS AT THE REQUEST**, not as at the signature — the detail
-- endpoint returns the same block for a 1993 signature as for yesterday's. `division_votes.party`
-- is the party at the division and is a fact about the act; this is not, and storing it in a column
-- called `party` beside a 1993 date would manufacture exactly the error SURFACE 4 §3 went and fixed
-- (a member printed under today's label beside an act taken under another). The party at signing is
-- recoverable from `graph_member_register` / `graph_member_name` by date if a later sprint needs it.
--
-- ⚠ AND `SponsorsCount` MUST BE READ OFF THE LIST ENDPOINT, NEVER THE DETAIL ONE. The detail
-- response returned `SponsorsCount = 0` on 150 of 150 motions whose `Sponsors` array was non-empty.
-- The LIST value reconciles exactly — list `SponsorsCount` == detail `Sponsors.length` on 150 of
-- 150 — so `edm_sponsor.sponsors_count` is a sound target to measure the load against, and it
-- INCLUDES the primary sponsor. 2,125,547 published − 60,995 primary sponsors already held
-- = 2,064,552 signatures to gain, which is the brief's "roughly 2.06 million".

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 1 · WHAT WAS ATTEMPTED — written BEFORE the rows it accounts for
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- One row per motion the sweep tried, with what the API said. This exists so that "how many
-- signatures did we store" can be reconciled against "how many did the source offer", per motion,
-- rather than compared against a total nobody can decompose.
--
-- The reason it is a table and not a log: a 60,995-request sweep will be interrupted, and a resume
-- that re-reads a motion it already has is waste while a resume that SKIPS one it never got is a
-- silent hole. `http_status` distinguishes them — a row with status 200 and sponsors_seen 0 is a
-- motion with no signatories, which is a different fact from a motion never fetched.
CREATE TABLE IF NOT EXISTS edm_signatory_fetch (
  motion_id      INTEGER PRIMARY KEY,
  -- 200, or the status the API actually returned. -1 for a network failure that never got one.
  http_status    INTEGER NOT NULL,
  -- length of Response.Sponsors. 0 with status 200 is a real answer, not a failure.
  sponsors_seen  INTEGER NOT NULL DEFAULT 0,
  -- `edm_sponsor.sponsors_count`, copied at fetch time so the comparison is against the figure the
  -- publisher gave for THIS motion and does not have to be re-joined later.
  count_expected INTEGER,
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS edm_signatory_fetch_status_idx ON edm_signatory_fetch (http_status);

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · THE SIGNATURE ITSELF — one row per person per motion, dated
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS edm_signatory (
  -- ⚠ THE PUBLISHER'S OWN KEY FOR THE SIGNATURE (`Sponsors[].Id`, e.g. 2299739), not a surrogate.
  -- Keying on (motion_id, mnis_id) would assume a member can sign a motion at most once, and that
  -- is an assumption rather than a measurement — a withdrawal followed by a re-signature is two
  -- acts on two dates. The publisher's id makes a re-sweep idempotent without needing the
  -- assumption, and how often the pair repeats is MEASURED and reported (verify-edm-signatures.ts).
  signature_id     BIGINT  PRIMARY KEY,
  motion_id        INTEGER NOT NULL,
  -- NULL where the API itself gave no id. A recorded fact, not a failure — the same convention as
  -- `edm_sponsor.mnis_id`. §1 measured 0 of 5,739, so a non-zero count here is a finding.
  -- ⚠ NEVER resolved from the name. §1.2 of the brief: an unresolved name stays unresolved and is
  -- counted; a wrongly merged one is a person who does not exist holding contradictory views.
  mnis_id          INTEGER,
  -- The name AS THE MOTION RECORD PRINTED IT (BRIEF_INGEST_CORPUS_FRESHNESS §2: record the surface
  -- at the point of the write, because it cannot be reconstructed afterwards).
  signatory_name   TEXT,
  -- 1 = the member who TABLED the motion. See the view below: order 1 is a sponsorship, not a
  -- signature, and the two are not flattened.
  --
  -- ⚠⚠ INTEGER, NOT SMALLINT, AND THE FIRST LOAD FOUND OUT WHY. The field is not 1..n: the API
  -- returns **99999** as a sentinel where no order was recorded (read live on motion 44477,
  -- signature 294739) and NULL on other rows. 99999 is outside SMALLINT and the pilot died on
  -- `value "99999" is out of range for type smallint` — loudly, which is the right failure, but the
  -- column was wrong. ⚠ 99999 is a SENTINEL AND NOT A POSITION: nothing may read this column as an
  -- ordinal without excluding it, and the only thing that reads it here is the `<> 1` test.
  sponsoring_order INTEGER,
  -- `CreatedWhen` at full precision. THE DATE THE ACT HAPPENED. Never the ingest date.
  signed_at        TIMESTAMP NOT NULL,
  -- ⚠ A WITHDRAWN SIGNATURE IS A CHANGED POSITION AND THE DESIGN TREATS A CHANGED POSITION AS A
  -- FINDING (schema-2d2.sql, on `role`). It is kept here, dated, and EXCLUDED from the signal view
  -- below — because a member who took their name off a motion does not hold the position the
  -- signature would assert, and inventing an opposing signal from a withdrawal would be worse.
  -- Excluded, counted, reported. Not deleted.
  is_withdrawn     BOOLEAN NOT NULL DEFAULT FALSE,
  withdrawn_on     DATE
);
-- ⚠ Idempotent migration for a database that already has this table with the SMALLINT column.
-- `CREATE TABLE IF NOT EXISTS` does not change the type of an existing column, and the alternative
-- — dropping and recreating — is the one thing this file is not allowed to do.
ALTER TABLE edm_signatory ALTER COLUMN sponsoring_order TYPE INTEGER;

-- The per-motion read: the positions surface asks for one motion at a time.
CREATE INDEX IF NOT EXISTS edm_signatory_motion_idx ON edm_signatory (motion_id);
-- The per-member read, and the one the estimate build's actor-range scan needs.
CREATE INDEX IF NOT EXISTS edm_signatory_mnis_idx ON edm_signatory (mnis_id) WHERE mnis_id IS NOT NULL;

COMMENT ON TABLE edm_signatory IS
  'One row per signature on an early day motion, from oralquestionsandmotions-api.parliament.uk '
  '/EarlyDayMotion/{id}. sponsoring_order = 1 is the member who TABLED the motion, not a '
  'signatory. Carries no party or constituency ON PURPOSE: the API returns the member''s CURRENT '
  'party for a signature of any age, so a party column here would be a fact about today wearing '
  'the date of the act.';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · THE EDGE — person → motion, for a SIGNATURE
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 2D-2 wrote `graph_signed_motion_edge` for the primary sponsor and said, in its own comment, that
-- the predicate's name was wider than its contents and that `role` "must stay explicit when the
-- full signatory scrape lands". This is that scrape, and `role` stays explicit: this view carries
-- 'signatory', that one carries 'primary-sponsor', and `graph_edm_signature_edge_all` unions them
-- WITHOUT merging the roles.
--
-- ⚠ A SEPARATE VIEW RATHER THAN A WIDENING OF `graph_signed_motion_edge`. That view is 2D-2's and
-- is read by `graph_edge_all`, `graph_mention` and `derive-signals.ts`; replacing it would change
-- what every one of those returns in the same commit that loads 2.3M rows, and a `CREATE OR REPLACE
-- VIEW` cannot reorder its columns anyway (schema-surface.sql's header, learned the hard way).
CREATE OR REPLACE VIEW graph_edm_signature_edge AS
SELECT
  e.id                              AS subject_id,
  e.canonical_name                  AS subject_name,
  s.mnis_id                         AS subject_mnis_id,
  'signed-motion'::text             AS predicate,
  'motion'::text                    AS object_kind,
  s.motion_id::text                 AS object_ref,
  m.uin                             AS object_label,
  'signatory'::text                 AS role,
  s.sponsoring_order                AS sponsoring_order,
  -- ⚠ THE DATE SIGNED, NOT THE DATE TABLED. 80.4% of these differ from `edm_sponsor.date_tabled`.
  s.signed_at::date                 AS observed_on,
  m.date_tabled                     AS motion_tabled_on,
  s.signature_id                    AS signature_id,
  'early-day-motions:' || s.motion_id || ':1' AS evidence_section_id,
  s.signatory_name                  AS subject_surface
FROM edm_signatory s
JOIN edm_sponsor m ON m.motion_id = s.motion_id
JOIN graph_entity e ON e.parl_member_id = s.mnis_id AND e.kind = 'person'
WHERE s.mnis_id IS NOT NULL
  -- ⚠ ORDER 1 IS THE SPONSOR AND IS ALREADY AN EDGE. Without this clause every primary sponsor
  -- would appear twice — once as the sponsorship 2D-2 recorded and once as a signature — and the
  -- estimate layer would count one act as two. The brief's own words: tabling a motion and signing
  -- it are different acts and should not be flattened. They are not merged; the sponsor is simply
  -- not counted here as well.
  --
  -- ⚠⚠ TWO TESTS, NOT ONE, AND THE SECOND IS NOT REDUNDANCY. `SponsoringOrder = 1` and "the member
  -- `edm_sponsor` names as the sponsor" agreed on 150 of 150 motions in §1's audit — but the field
  -- is not always 1..n at all (values of 99999 and NULL were both read live), so an ordering quirk
  -- on one motion would let that motion's sponsor through as a signature as well. `m.mnis_id` is
  -- the id 2D-2's sweep read from `PrimarySponsor.MnisId`, so the OR closes that by identity rather
  -- than by position. Where the two agree it costs nothing; verify-edm-signatures.ts reports how
  -- often they do NOT, because a disagreement is a finding about the source, not a nuisance.
  AND (s.sponsoring_order IS NULL OR s.sponsoring_order <> 1)
  AND (m.mnis_id IS NULL OR s.mnis_id <> m.mnis_id)
  -- ⚠ WITHDRAWN SIGNATURES ARE NOT EDGES. Kept in the table above, dated; not asserted here.
  AND s.is_withdrawn = FALSE
  -- ⚠ AN EDGE MAY ONLY EXIST FOR A MOTION WE CAN SHOW (design: "an edge with no evidence row is a
  -- claim we cannot show our working for"). 2D-2 failed verify-2d2.ts on exactly this and the rule
  -- is unchanged: the motions we hold no section for are a REPORTED gap, not a carried edge.
  AND EXISTS (SELECT 1 FROM corpus_sections c
               WHERE c.id = 'early-day-motions:' || s.motion_id || ':1');

-- Both roles in one shape, with the role never dropped. This is the view to count "how many people
-- put their name to this motion, and in what capacity".
CREATE OR REPLACE VIEW graph_edm_signature_edge_all AS
  SELECT subject_id, subject_name, subject_mnis_id, predicate, object_kind, object_ref,
         object_label, role, observed_on, evidence_section_id, subject_surface
    FROM graph_signed_motion_edge
UNION ALL
  SELECT subject_id, subject_name, subject_mnis_id, predicate, object_kind, object_ref,
         object_label, role, observed_on, evidence_section_id, subject_surface
    FROM graph_edm_signature_edge;

COMMENT ON VIEW graph_edm_signature_edge IS
  'Signatures on early day motions, EXCLUDING the primary sponsor (sponsoring_order = 1, which is '
  'graph_signed_motion_edge) and EXCLUDING withdrawn signatures. observed_on is the date the '
  'member signed, never the date the motion was tabled.';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 4 · RECONCILIATION — a view whose only job is to be able to disagree with us
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Attempted vs stored, per motion, from the two tables above and the publisher's own count. A load
-- that reports "2.3 million rows inserted" proves nothing; this says, motion by motion, where the
-- number we hold differs from the number the publisher advertised and which direction it differs in.
CREATE OR REPLACE VIEW edm_signature_reconciliation AS
SELECT
  f.motion_id,
  f.http_status,
  f.count_expected,                                   -- edm_sponsor.sponsors_count (list endpoint)
  f.sponsors_seen,                                    -- Response.Sponsors.length at fetch time
  COALESCE(st.stored, 0)          AS stored,           -- rows actually in edm_signatory
  COALESCE(st.withdrawn, 0)       AS withdrawn,
  COALESCE(st.order1, 0)          AS primary_sponsors,
  COALESCE(st.no_mnis, 0)         AS unidentified,
  f.sponsors_seen - COALESCE(st.stored, 0)             AS seen_minus_stored,
  COALESCE(f.count_expected, 0) - f.sponsors_seen      AS expected_minus_seen
FROM edm_signatory_fetch f
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS stored,
         COUNT(*) FILTER (WHERE s.is_withdrawn)            AS withdrawn,
         COUNT(*) FILTER (WHERE s.sponsoring_order = 1)    AS order1,
         COUNT(*) FILTER (WHERE s.mnis_id IS NULL)         AS no_mnis
    FROM edm_signatory s WHERE s.motion_id = f.motion_id
) st ON TRUE;
