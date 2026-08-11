/**
 * create-division-votes.ts — §A of BRIEF_INGEST_POLITICAL_SOURCES.
 *
 * Three tables on the ingest Neon DB (NOT the app Prisma schema — these are
 * ingest-side tables alongside ingest_queue / corpus_targets / corpus_sections,
 * same as corpus_snapshots). Additive and idempotent.
 *
 * WHY THREE TABLES AND NOT ONE
 *
 * `corpus_sections` already gets one searchable section per division. That is
 * the retrieval unit and it stays. But the brief asks for something search text
 * cannot answer: "your MP voted against; 78% of their party voted for" is an
 * aggregate over one row per member per division, and no amount of BM25 over a
 * roll-call produces a percentage. So:
 *
 *   divisions        — one row per division. The question, and what it was
 *                      carried inside.
 *   division_votes   — one row per member per division. The countable fact.
 *   stage_outcomes   — one row per Bill stage, INCLUDING the stages nobody
 *                      divided on.
 *
 * THE THIRD TABLE IS THE POINT, so it is worth being explicit about. The brief:
 * "'Passed without a division' must be a first-class output, not a null. It is
 * often the more useful finding: it tells the user the provision went through
 * unexamined." If we stored only divisions, "no division" would be the absence
 * of a row — indistinguishable from "we have not ingested that stage yet", from
 * "the API was down", and from "our title parse failed to match". Those are
 * four different things and a user is entitled to know which one they are
 * looking at. `stage_outcomes.outcome` is therefore an ENUM-ish CHECK with an
 * explicit `unknown`, and `method` records how the row was decided.
 *
 * ON `absence_known`
 *
 * Commons publishes NoVoteRecorded; Lords publishes nothing equivalent. A
 * `absent_count = 0` on a Lords division means "not published", so the boolean
 * sits beside it. Reading the count without the flag is the failure this column
 * exists to prevent.
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

async function main() {
  const pool = getNeonPool()

  // ── divisions ──────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS divisions (
      house              TEXT    NOT NULL CHECK (house IN ('commons','lords')),
      division_id        INTEGER NOT NULL,
      division_number    INTEGER,
      division_date      DATE,
      title              TEXT    NOT NULL,

      -- What the provision was carried inside. Kept as three separate columns,
      -- never collapsed: the parent Bill title can be actively misleading about
      -- what was voted on, so the amendment and the stage must survive beside it.
      bill_title         TEXT,
      stage              TEXT,
      amendment          TEXT,
      -- 'commons-title-parse' | 'lords-motion-notes' | 'none'. A parsed field
      -- must never be readable as though the API had stated it.
      context_provenance TEXT    NOT NULL DEFAULT 'none',
      motion_notes       TEXT,

      aye_count          INTEGER NOT NULL DEFAULT 0,
      no_count           INTEGER NOT NULL DEFAULT 0,
      absent_count       INTEGER NOT NULL DEFAULT 0,
      -- FALSE ⇒ absent_count is NOT KNOWN, not measured as zero (Lords).
      absence_known      BOOLEAN NOT NULL DEFAULT false,

      source_url         TEXT,
      licence            TEXT    NOT NULL DEFAULT 'opl-3.0',
      ingested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (house, division_id)
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_divisions_date  ON divisions (division_date DESC)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_divisions_bill  ON divisions (bill_title) WHERE bill_title IS NOT NULL`)
  console.log('divisions ready')

  // ── division_votes ─────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS division_votes (
      house         TEXT    NOT NULL CHECK (house IN ('commons','lords')),
      division_id   INTEGER NOT NULL,
      member_id     INTEGER NOT NULL,
      member_name   TEXT    NOT NULL,

      -- AT THE DATE OF THE DIVISION, not as at today. The votes APIs snapshot
      -- both per division; verified against Members API partyHistory for a
      -- member who changed party twice. Storing "current party" here would
      -- silently rewrite history every time somebody crosses the floor.
      party         TEXT,
      party_abbrev  TEXT,
      constituency  TEXT,

      -- 'aye' | 'no' | 'absent'. There is deliberately no 'not a member' value:
      -- that state is the ABSENCE of a row, and conflating it with 'absent'
      -- would make every MP look like they skipped every vote before election.
      vote          TEXT    NOT NULL CHECK (vote IN ('aye','no','absent')),
      teller        BOOLEAN NOT NULL DEFAULT false,

      -- denormalised from divisions so "how did X vote in 2023" is one scan
      division_date DATE,
      PRIMARY KEY (house, division_id, member_id)
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dv_member ON division_votes (member_id, division_date DESC)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dv_party  ON division_votes (party, vote)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dv_div    ON division_votes (house, division_id)`)
  console.log('division_votes ready')

  // ── stage_outcomes ─────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stage_outcomes (
      bill_id         INTEGER NOT NULL,
      bill_stage_id   INTEGER NOT NULL,
      bill_title      TEXT    NOT NULL,
      house           TEXT,
      stage           TEXT    NOT NULL,
      stage_date      DATE,

      division_count  INTEGER NOT NULL DEFAULT 0,
      -- The first-class fact. 'without-division' is a FINDING, not a null:
      -- it says the provision went through unexamined. 'unknown' says we could
      -- not establish it, which is a different and equally reportable thing.
      outcome         TEXT    NOT NULL CHECK (outcome IN ('divided','without-division','unknown')),
      -- How the outcome was decided, so a fuzzy match never reads as a fact:
      -- 'title-match' | 'no-divisions-in-window' | 'not-established'
      method          TEXT    NOT NULL DEFAULT 'not-established',
      matched_division_ids INTEGER[],

      ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (bill_id, bill_stage_id)
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_so_outcome ON stage_outcomes (outcome)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_so_bill    ON stage_outcomes (bill_title)`)
  console.log('stage_outcomes ready')

  for (const t of ['divisions', 'division_votes', 'stage_outcomes']) {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${t}`)
    console.log(`  ${t}: ${rows[0].n} rows`)
  }
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
