/**
 * derive-edm-signature-signals.ts — BRIEF_INGEST_EDM_SIGNATURES §2: wire the signal.
 *
 * `scripts/graph/derive-signals.ts` is CC-Graph's and this file deliberately does not edit it. It
 * does the same job for the same table in the same shape, for the one signal family this sprint
 * loads, and it reads its weight from the SAME `position-config.ts` so there is no second number.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IS DISTINCT, WHAT IS NOT, AND WHERE THE ONE THING THIS CANNOT DO LIVES
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Brief §2: *"Keep sponsorship and signature as distinct signal types. They carry different weights
 * — the member who tabled a motion did more than the member who signed it — and merging them would
 * lose that permanently."*
 *
 * They are kept distinct **by `derivation`**, which is a stored, versioned, per-row column that the
 * read API already surfaces (`Ground.derivation`):
 *
 *     primary-sponsor:v1 / :v2   the member who TABLED the motion      60,995 rows
 *     signatory:v1               a member who SIGNED it            ~2,050,000 rows
 *
 * ⚠ THEY ARE **NOT** KEPT DISTINCT BY WEIGHT, AND THAT IS A REPORTED GAP RATHER THAN A DECISION
 * TAKEN QUIETLY. A distinct weight needs a distinct `SignalType`, and the type union, the weight
 * table and the half-life table all live in `scrutinise-web/lib/graph/position-config.ts` — which
 * is CC-Graph's, and which brief §5 forbids this sprint from editing ("report the change needed
 * instead"). The exact patch is a numbered decision in `docs/INGEST_EDM_SIGNATURES_REPORT.md`.
 *
 * Nothing is lost permanently, which is the part of §2 that matters: `derivation` is stored per row,
 * so applying a different weight later is
 *     UPDATE position_signal_stored SET raw_weight = <w> WHERE derivation = 'signatory:v1';
 * — one statement over rows that already know which act they are. It is not a re-derivation, and it
 * is not the "rewriting two million immutable rows" that schema-3a.sql warns about, because the
 * classification that decides the weight is already in the row.
 *
 * ⚠ AND THE DATE IS THE DATE OF THE ACT. `observed_at` is `edm_signatory.signed_at::date`, never
 * `edm_sponsor.date_tabled`: §1 measured 80.4% of signatures added after the motion was tabled.
 * `--fix-sponsor-dates` applies the same correction to the 60,995 sponsorship rows already stored,
 * which were written with the tabling date because it was the only date we held.
 *
 * Idempotent. `ON CONFLICT DO NOTHING` against the natural key, so a re-run adds only what is new.
 * Append-only: nothing is updated or deleted, and the sponsor-date fix is a NEW row with
 * `superseded_by` set on the old one, in one statement so it cannot half-apply.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/derive-edm-signature-signals.ts --dry-run
 *   npx tsx position-graph/derive-edm-signature-signals.ts --apply
 *   npx tsx position-graph/derive-edm-signature-signals.ts --apply --fix-sponsor-dates
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { POSITION_CONFIG } from '../../../scrutinise-web/lib/graph/position-config'

export {}

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const FIX_SPONSOR_DATES = argv.includes('--fix-sponsor-dates')
/** Cap the sponsorship-date correction, so the one atomic statement can be watched on a slice. */
const FIX_LIMIT = (() => { const i = argv.indexOf('--fix-limit'); return i >= 0 ? parseInt(argv[i + 1], 10) || 0 : 0 })()

const W = POSITION_CONFIG.weights.edm_signature
const DERIVATION = 'signatory:v1'
/** The corrected sponsorship rows. v2 because the DATE changed, not the method's meaning. */
const SPONSOR_V2 = 'primary-sponsor:v2'
const SPONSOR_V1 = 'primary-sponsor:v1'

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)
const n = (x: any) => Number(x).toLocaleString()

async function one<T extends Record<string, any>>(sql: string, params: any[] = []): Promise<T> {
  const { rows } = await pool.query<T>(sql, params)
  return rows[0]
}

async function main() {
  const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
  if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host}) — refusing`); process.exit(1) }
  head('WHERE, AND WITH WHAT NUMBER')
  console.log(`   host ${host}`)
  console.log(`   raw_weight ${W}  (POSITION_CONFIG.weights.edm_signature — read, not restated)`)
  console.log(`   derivation ${DERIVATION}`)
  console.log(`   ${APPLY ? 'APPLY' : 'DRY RUN — nothing written'}`)

  // ⚠ THE WEIGHT THE DATABASE WOULD GIVE THIS SIGNAL, CHECKED AGAINST THE ONE TYPESCRIPT GIVES IT,
  // BEFORE ANY ROW IS WRITTEN. `position_raw_weight()` is generated from the same config by
  // setup-3a.ts, and check-3b.ts asserts they agree — but this sprint introduces a NEW derivation
  // string, and a derivation the SQL does not recognise returns NULL, which the table's NOT NULL
  // would refuse mid-load. So it is asked here, of the live function, with the actual argument.
  const w = await one<{ w: number | null }>(
    `SELECT position_raw_weight('edm_signature', $1)::real AS w`, [DERIVATION])
  const agree = w.w != null && Math.abs(w.w - W) < 1e-6
  console.log(`   position_raw_weight('edm_signature','${DERIVATION}') = ${w.w}  ${agree ? '✓ agrees with the config' : '❌ DISAGREES — refusing'}`)
  if (!agree) { await endNeonPool(); process.exit(1) }

  // ── what is on the table before anything is written ─────────────────────────────────────────
  head('BEFORE')
  const before = await one<Record<string, string>>(`
    SELECT (SELECT COUNT(*) FROM edm_signatory)::text                                        AS sigs,
           (SELECT COUNT(*) FROM graph_edm_signature_edge)::text                              AS edges,
           (SELECT COUNT(*) FROM position_signal_stored
             WHERE signal_type='edm_signature' AND superseded_by IS NULL)::text               AS live,
           (SELECT COUNT(*) FROM position_signal_stored
             WHERE derivation=$1 AND superseded_by IS NULL)::text                             AS sponsor_v1,
           (SELECT COUNT(*) FROM position_signal_stored
             WHERE derivation=$2 AND superseded_by IS NULL)::text                             AS signatory`,
    [SPONSOR_V1, DERIVATION])
  console.log(`   edm_signatory rows                       ${n(before.sigs)}`)
  console.log(`   graph_edm_signature_edge (signal-ready)  ${n(before.edges)}`)
  console.log(`   live edm_signature signals               ${n(before.live)}`)
  console.log(`     of which ${SPONSOR_V1}          ${n(before.sponsor_v1)}`)
  console.log(`     of which ${DERIVATION}                ${n(before.signatory)}`)

  // ── WHERE THE ROWS THE EDGE VIEW DROPS ACTUALLY WENT. Counted before the write, because a load
  // that only prints what it inserted cannot tell "excluded on purpose" from "lost".
  head('WHAT THE EDGE VIEW EXCLUDES, AND WHY')
  const ex = await one<Record<string, string>>(`
    SELECT COUNT(*)::text                                                          AS total,
           COUNT(*) FILTER (WHERE s.is_withdrawn)::text                            AS withdrawn,
           COUNT(*) FILTER (WHERE NOT s.is_withdrawn AND (s.sponsoring_order = 1 OR s.mnis_id = m.mnis_id))::text AS sponsor,
           COUNT(*) FILTER (WHERE NOT s.is_withdrawn AND s.mnis_id IS NULL)::text   AS no_mnis,
           COUNT(*) FILTER (WHERE NOT s.is_withdrawn AND s.mnis_id IS NOT NULL
                              AND s.sponsoring_order <> 1 AND (m.mnis_id IS NULL OR s.mnis_id <> m.mnis_id)
                              AND NOT EXISTS (SELECT 1 FROM graph_entity e
                                               WHERE e.parl_member_id = s.mnis_id AND e.kind='person'))::text AS no_entity,
           COUNT(*) FILTER (WHERE NOT s.is_withdrawn AND s.mnis_id IS NOT NULL
                              AND s.sponsoring_order <> 1 AND (m.mnis_id IS NULL OR s.mnis_id <> m.mnis_id)
                              AND NOT EXISTS (SELECT 1 FROM corpus_sections c
                                               WHERE c.id = 'early-day-motions:' || s.motion_id || ':1'))::text AS no_section
      FROM edm_signatory s JOIN edm_sponsor m ON m.motion_id = s.motion_id`)
  console.log(`   sponsor rows held                        ${n(ex.total)}`)
  console.log(`   − withdrawn (a changed position)         ${n(ex.withdrawn)}`)
  console.log(`   − the primary sponsor (already an edge)  ${n(ex.sponsor)}`)
  console.log(`   − no MNIS id (never name-matched)        ${n(ex.no_mnis)}`)
  console.log(`   − no graph_entity for that member        ${n(ex.no_entity)}`)
  console.log(`   − no corpus_sections row to evidence it  ${n(ex.no_section)}`)
  console.log(`   ⚠ the last two OVERLAP with each other; the edge view applies both, so the`)
  console.log(`     arithmetic below is the check, not this subtraction.`)

  // ── the insert, in signature_id ranges ──────────────────────────────────────────────────────
  // ⚠ CHUNKED ON `signature_id`, WHICH IS THE VIEW'S OWN COLUMN AND `edm_signatory`'s PRIMARY KEY.
  // The alternative — restating the view's joins in this file with a motion_id predicate — is the
  // re-implemented-predicate trap: two copies of `admits()` that agree until one is edited.
  const b = await one<{ lo: string; hi: string; n: string }>(
    `SELECT MIN(signature_id)::text AS lo, MAX(signature_id)::text AS hi, COUNT(*)::text AS n FROM edm_signatory`)
  if (!Number(b.n)) { console.log('\n   edm_signatory is empty — nothing to derive.'); await endNeonPool(); return }
  const lo = Number(b.lo), hi = Number(b.hi)
  // ~40k rows a chunk on average. Chunks are id RANGES, so density varies and an empty one is free.
  const chunks = Math.max(1, Math.ceil(Number(b.n) / 40_000))
  const step = Math.ceil((hi - lo + 1) / chunks)
  console.log(`\n   signature_id ${n(lo)}…${n(hi)} in ${chunks} ranges of ${n(step)}`)

  head(APPLY ? 'INSERTING' : 'COUNTING (nothing written)')
  const t0 = Date.now()
  let wrote = 0, seen = 0
  for (let a = lo; a <= hi; a += step) {
    const z = Math.min(a + step - 1, hi)
    if (APPLY) {
      const res = await pool.query(`
        INSERT INTO position_signal_stored
          (actor_id, target_type, target_id, signal_type, direction, raw_weight, derivation, evidence_ids, observed_at)
        SELECT g.subject_id, 'edm', g.object_ref, 'edm_signature', 1, $1::real, $2,
               ARRAY[g.evidence_section_id]::text[], g.observed_on
          FROM graph_edm_signature_edge g
         WHERE g.signature_id BETWEEN $3 AND $4
        ON CONFLICT (actor_id, target_type, target_id, signal_type, observed_at) DO NOTHING`,
        [W, DERIVATION, a, z])
      wrote += res.rowCount ?? 0
    } else {
      const c = await one<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM graph_edm_signature_edge WHERE signature_id BETWEEN $1 AND $2`, [a, z])
      seen += Number(c.n)
    }
    const done = Math.min(1, (z - lo + 1) / (hi - lo + 1))
    if (Math.floor(done * 10) > Math.floor(((a - lo) / (hi - lo + 1)) * 10)) {
      console.log(`   ${(done * 100).toFixed(0)}%   ${APPLY ? n(wrote) + ' inserted' : n(seen) + ' would insert'}   ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    }
  }
  console.log(`\n   ${APPLY ? `INSERT reported ${n(wrote)} rows` : `${n(seen)} rows would be written`} in ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`)

  if (APPLY && FIX_SPONSOR_DATES) {
    // ════════════════════════════════════════════════════════════════════════════════════════════
    // THE 60,995 SPONSORSHIP ROWS THAT CARRY THE WRONG DATE
    // ════════════════════════════════════════════════════════════════════════════════════════════
    // They were written with `edm_sponsor.date_tabled` because it was the only date we held. We now
    // hold the sponsor's own `CreatedWhen`. Corrected the way design §2 says a correction happens:
    // a NEW row, with `superseded_by` set on the old one — never an UPDATE of the fact.
    //
    // ⚠ ONE STATEMENT, so it cannot half-apply and leave a sponsor with two live signals. The CTE
    // inserts and the UPDATE reads the CTE's RETURNING, so both halves commit together or neither.
    //
    // ⚠ WHERE THE NEW DATE EQUALS THE OLD ONE the ON CONFLICT fires, RETURNING yields nothing, and
    // the existing row is left alone — correctly, because it was already dated right. That is why
    // the count below is expected to be BELOW 60,995 rather than equal to it.
    head('CORRECTING THE SPONSORSHIP DATES')
    const t1 = Date.now()
    const res = await pool.query<{ n: string }>(`
      WITH src AS (
        SELECT g.subject_id AS actor_id, g.object_ref AS target_id, s.signed_at::date AS observed_at,
               'early-day-motions:' || s.motion_id || ':1' AS ev
          FROM graph_signed_motion_edge g
          JOIN edm_sponsor  m ON m.motion_id = g.object_ref::int
          JOIN edm_signatory s ON s.motion_id = m.motion_id AND s.mnis_id = m.mnis_id
         WHERE s.is_withdrawn = FALSE
           AND s.signed_at::date <> g.observed_on
         -- ⚠ --fix-limit EXISTS SO THIS STATEMENT CAN BE WATCHED WORKING ON A SLICE FIRST. It is one
         -- atomic statement over 60,995 rows that inserts a replacement and retires the original; if
         -- the retire half matched nothing, every corrected sponsor would carry TWO live signals and
         -- the total would merely look a little high. The insert/supersede difference printed below
         -- is the check, and it should be read on a small slice before it is trusted on all of them.
         ${FIX_LIMIT ? `ORDER BY g.subject_id, g.object_ref LIMIT ${FIX_LIMIT}` : ''}
      ), ins AS (
        INSERT INTO position_signal_stored
          (actor_id, target_type, target_id, signal_type, direction, raw_weight, derivation, evidence_ids, observed_at)
        SELECT DISTINCT ON (actor_id, target_id) actor_id, 'edm', target_id, 'edm_signature', 1,
               $1::real, $2, ARRAY[ev]::text[], observed_at
          FROM src ORDER BY actor_id, target_id, observed_at
        ON CONFLICT (actor_id, target_type, target_id, signal_type, observed_at) DO NOTHING
        RETURNING id, actor_id, target_id
      ), sup AS (
        UPDATE position_signal_stored o
           SET superseded_by = ins.id
          FROM ins
         WHERE o.actor_id = ins.actor_id AND o.target_type = 'edm' AND o.target_id = ins.target_id
           AND o.signal_type = 'edm_signature' AND o.derivation = $3 AND o.superseded_by IS NULL
        RETURNING o.id
      )
      SELECT (SELECT COUNT(*) FROM ins)::text || '/' || (SELECT COUNT(*) FROM sup)::text AS n`,
      [W, SPONSOR_V2, SPONSOR_V1])
    const [insN, supN] = String(res.rows[0].n).split('/')
    console.log(`   corrected rows inserted   ${n(insN)}`)
    console.log(`   old rows superseded       ${n(supN)}`)
    console.log(`   ⚠ inserted − superseded   ${Number(insN) - Number(supN)}   ${Number(insN) === Number(supN) ? '✓ one new row per retired row' : '← every difference must be explained'}`)
    console.log(`   ${((Date.now() - t1) / 1000).toFixed(0)}s`)
  }

  if (!APPLY) { console.log('\n   DRY — nothing written.'); await endNeonPool(); return }

  // ── read back. A rowCount says what the driver thought it sent. ──────────────────────────────
  head('READ BACK')
  const after = await one<Record<string, string>>(`
    SELECT (SELECT COUNT(*) FROM position_signal_stored
             WHERE signal_type='edm_signature' AND superseded_by IS NULL)::text        AS live,
           (SELECT COUNT(*) FROM position_signal_stored
             WHERE derivation=$1 AND superseded_by IS NULL)::text                      AS signatory,
           (SELECT COUNT(*) FROM position_signal_stored
             WHERE derivation=$2 AND superseded_by IS NULL)::text                      AS sponsor_v1,
           (SELECT COUNT(*) FROM position_signal_stored
             WHERE derivation=$3 AND superseded_by IS NULL)::text                      AS sponsor_v2,
           (SELECT COUNT(*) FROM position_signal_stored
             WHERE signal_type='edm_signature' AND superseded_by IS NOT NULL)::text    AS retired,
           (SELECT COUNT(DISTINCT actor_id) FROM position_signal_stored
             WHERE derivation=$1 AND superseded_by IS NULL)::text                      AS people,
           (SELECT COUNT(DISTINCT target_id) FROM position_signal_stored
             WHERE derivation=$1 AND superseded_by IS NULL)::text                      AS motions,
           (SELECT MIN(observed_at)::text FROM position_signal_stored WHERE derivation=$1) AS earliest,
           (SELECT MAX(observed_at)::text FROM position_signal_stored WHERE derivation=$1) AS latest`,
    [DERIVATION, SPONSOR_V1, SPONSOR_V2])
  console.log(`   live edm_signature signals   ${n(after.live)}`)
  console.log(`     ${DERIVATION}                    ${n(after.signatory)} over ${n(after.people)} people and ${n(after.motions)} motions`)
  console.log(`     ${SPONSOR_V1}          ${n(after.sponsor_v1)}`)
  console.log(`     ${SPONSOR_V2}          ${n(after.sponsor_v2)}`)
  console.log(`   retired (superseded)         ${n(after.retired)}`)
  console.log(`   observed_at range            ${after.earliest} → ${after.latest}`)

  // ⚠ THE ONE ASSERTION THAT WOULD CATCH A DOUBLE COUNT. One actor, one motion, one live signal.
  // If the sponsor leaked into the signature set, or a repeated (motion, member) pair landed on two
  // dates, this is where it shows — as a number, not as a slightly high total nobody can question.
  const dbl = await one<{ n: string; ex: string | null }>(`
    SELECT COUNT(*)::text AS n,
           (SELECT actor_id || ' / ' || target_id FROM (
              SELECT actor_id, target_id FROM position_signal_stored
               WHERE signal_type='edm_signature' AND superseded_by IS NULL
               GROUP BY 1,2 HAVING COUNT(*) > 1 LIMIT 1) q) AS ex
      FROM (SELECT actor_id, target_id FROM position_signal_stored
             WHERE signal_type='edm_signature' AND superseded_by IS NULL
             GROUP BY 1,2 HAVING COUNT(*) > 1) d`)
  console.log(`\n   ⚠ (actor, motion) pairs with MORE THAN ONE live signal: ${n(dbl.n)}${dbl.ex ? `  e.g. ${dbl.ex}` : ''}`)
  console.log(`     ${Number(dbl.n) === 0 ? '✓ no act is counted twice' : '← each is one member with two dated signatures on one motion; see the report'}`)

  const sz = await one<{ s: string; db: string }>(`
    SELECT pg_size_pretty(pg_total_relation_size('position_signal_stored')) AS s,
           pg_size_pretty(pg_database_size(current_database())) AS db`)
  console.log(`\n   position_signal_stored ${sz.s}   database ${sz.db}`)
  console.log(`\n   ⚠ position_estimate is NOT rebuilt here. Brief §2: recompute AFTER loading, not`)
  console.log(`     during. Run scripts/graph/build-position-estimates.ts next.`)
  await endNeonPool()
}
main().catch(async (e) => {
  console.error('[derive-edm-signature-signals] FATAL', e instanceof Error ? e.stack : e)
  await endNeonPool().catch(() => {})
  process.exit(1)
})
