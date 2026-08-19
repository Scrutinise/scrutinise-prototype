/**
 * derive-vote-classes.ts — GRAPH 3A §3.1, first half: classify every division.
 *
 * Fills `position_division_party` (per division × party: majority side and cohesion) and
 * `position_division_class` (per division: free-vote-like or not). Those two small tables are what
 * turn 2,080,585 raw votes into weighted signals, through the `position_signal_vote` view.
 *
 * Re-runnable: truncate-and-rebuild, because both tables are pure functions of `division_votes`
 * plus the config. Nothing here is a signal; nothing here is append-only.
 *
 * PREDICT-MEASURE-COMPARE. The predictions below were written from probe reads BEFORE this script
 * was first run, and the script prints prediction against measurement for each one. A prediction
 * that is only recorded after the run is not a prediction.
 *
 * Usage (from scripts/graph):
 *   npx tsx derive-vote-classes.ts             # rebuild both tables, print the comparison
 *   npx tsx derive-vote-classes.ts --dry-run   # compute and compare, write nothing
 *   npx tsx derive-vote-classes.ts --free-votes # print the §3.1 audit list and exit
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { POSITION_CONFIG } from '../../scrutinise-web/lib/graph/position-config'

export {}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const FREE_VOTES_ONLY = argv.includes('--free-votes')

/** Written before the first run, from probe-3a-b/f reads. */
const PREDICTIONS = {
  division_party_rows: 46_702,   // party × division groups with at least one aye/no
  division_rows: 5_645,          // every division we hold
  // A guess with a stated basis, so it can be wrong on the record: most divisions are party-line,
  // and the free-vote-like set should be a small minority — call it 10% (≈560). If it comes back
  // near half, the threshold or the whipped-party list is wrong, not the politics.
  free_vote_like: 565,
}

function inList(xs: string[]): string {
  return xs.map((x) => `'${x.replace(/'/g, "''")}'`).join(', ')
}

async function main() {
  const pool = getNeonPool()
  const cfg = POSITION_CONFIG
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host}) — refusing`); process.exit(1) }
    console.log(`host ${host}`)
    console.log(`config: cohesion ≥ ${(cfg.cohesionThreshold * 100).toFixed(0)}% on ≥ ${cfg.minPartyVotersForCohesion} voters; ${cfg.unwhippedParties.length} unwhipped groups`)

    if (FREE_VOTES_ONLY) { await freeVoteAudit(pool); return }

    console.log(`\n════ PREDICTIONS (written before this run) ════`)
    for (const [k, v] of Object.entries(PREDICTIONS)) console.log(`  ${k.padEnd(22)} ${v.toLocaleString()}`)

    if (!DRY) {
      // Both tables are derived in full from `division_votes`; a partial rebuild would leave a
      // stale classification behind a fresh one and nothing would say which was which.
      await pool.query(`TRUNCATE position_division_party`)
      await pool.query(`TRUNCATE position_division_class`)
    }

    const t0 = Date.now()
    const partySql = `
      INSERT INTO position_division_party (house, division_id, party, ayes, noes, majority_side, cohesion, is_whipped_party, is_unwhipped_group)
      SELECT house, division_id, party, ayes, noes,
             CASE WHEN ayes > noes THEN 'aye' WHEN noes > ayes THEN 'no' ELSE NULL END,
             (GREATEST(ayes, noes)::real / NULLIF(ayes + noes, 0)::real),
             (party NOT IN (${inList(cfg.unwhippedParties)}) AND (ayes + noes) >= ${cfg.minPartyVotersForCohesion}),
             (party IN (${inList(cfg.unwhippedParties)}))
        FROM (
          SELECT house, division_id, party,
                 COUNT(*) FILTER (WHERE vote='aye')::int AS ayes,
                 COUNT(*) FILTER (WHERE vote='no')::int  AS noes
            FROM division_votes
           WHERE vote IN ('aye','no') AND party IS NOT NULL AND party <> ''
           GROUP BY 1,2,3
        ) g
       WHERE ayes + noes > 0`
    let partyRows = 0
    if (DRY) {
      const { rows: [c] } = await pool.query<{ n: string }>(`
        SELECT COUNT(*)::text AS n FROM (
          SELECT house, division_id, party FROM division_votes
           WHERE vote IN ('aye','no') AND party IS NOT NULL AND party <> ''
           GROUP BY 1,2,3) x`)
      partyRows = Number(c.n)
    } else {
      const r = await pool.query(partySql)
      partyRows = r.rowCount ?? 0
    }

    // A division is free-vote-like when NO whipped party reached the cohesion threshold. A
    // division with no whipped party at all (a Lords division carried by crossbenchers, say) also
    // falls here — correctly: there was no whip to be with or against.
    const classSql = `
      INSERT INTO position_division_class
        (house, division_id, free_vote_like, best_cohesion, best_party, n_whipped_parties, threshold)
      SELECT d.house, d.division_id,
             COALESCE(MAX(p.cohesion) FILTER (WHERE p.is_whipped_party), 0) < ${cfg.cohesionThreshold},
             MAX(p.cohesion) FILTER (WHERE p.is_whipped_party),
             (ARRAY_AGG(p.party ORDER BY p.cohesion DESC NULLS LAST)
                FILTER (WHERE p.is_whipped_party))[1],
             COUNT(*) FILTER (WHERE p.is_whipped_party)::int,
             ${cfg.cohesionThreshold}
        FROM divisions d
        LEFT JOIN position_division_party p ON p.house = d.house AND p.division_id = d.division_id
       GROUP BY d.house, d.division_id`
    let classRows = 0
    let freeVotes = 0
    if (DRY) {
      const { rows: [c] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM divisions`)
      classRows = Number(c.n)
    } else {
      const r = await pool.query(classSql)
      classRows = r.rowCount ?? 0
      const { rows: [f] } = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM position_division_class WHERE free_vote_like`)
      freeVotes = Number(f.n)
    }

    console.log(`\n════ MEASURED ${DRY ? '(dry run — counted, not written)' : ''} ════   ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    report('division_party_rows', PREDICTIONS.division_party_rows, partyRows)
    report('division_rows', PREDICTIONS.division_rows, classRows)
    if (!DRY) report('free_vote_like', PREDICTIONS.free_vote_like, freeVotes)

    if (DRY) { console.log('\n--dry-run: nothing written.'); return }

    // Read rows BACK. A rowCount from an INSERT says what the planner thought it did.
    console.log(`\n════ READ BACK ════`)
    const { rows: cls } = await pool.query<{ free_vote_like: boolean; n: string }>(
      `SELECT free_vote_like, COUNT(*)::text AS n FROM position_division_class GROUP BY 1 ORDER BY 1`)
    for (const r of cls) console.log(`  free_vote_like=${String(r.free_vote_like).padEnd(5)} ${String(r.n).padStart(6)}`)
    const { rows: whip } = await pool.query<{ is_whipped_party: boolean; n: string; mean: string }>(
      `SELECT is_whipped_party, COUNT(*)::text AS n, ROUND(AVG(cohesion)::numeric, 3)::text AS mean
         FROM position_division_party GROUP BY 1 ORDER BY 1`)
    for (const r of whip) console.log(`  is_whipped_party=${String(r.is_whipped_party).padEnd(5)} ${String(r.n).padStart(6)}  mean cohesion ${r.mean}`)

    const { rows: sig } = await pool.query<{ derivation: string; n: string }>(
      `SELECT derivation, COUNT(*)::text AS n FROM position_signal_vote GROUP BY 1 ORDER BY 2::bigint DESC`)
    console.log(`\n════ WHAT THE VIEW NOW PRODUCES (position_signal_vote) ════`)
    let total = 0
    for (const r of sig) { total += Number(r.n); console.log(`  ${r.derivation.padEnd(30)} ${Number(r.n).toLocaleString().padStart(11)}`) }
    console.log(`  ${'TOTAL'.padEnd(30)} ${total.toLocaleString().padStart(11)}`)

    const { rows: [nullw] } = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM position_signal_vote WHERE raw_weight IS NULL`)
    console.log(`\n  signals with NO weight (an unrecognised class would land here): ${nullw.n}`)
    if (Number(nullw.n) > 0) console.error(`  ❌ ${nullw.n} signals carry no weight — position_raw_weight() does not cover every class`)

    await freeVoteAudit(pool)
  } finally {
    await endNeonPool()
  }
}

function report(label: string, predicted: number, measured: number) {
  const delta = measured - predicted
  const pct = predicted ? ((100 * delta) / predicted).toFixed(1) : '—'
  const mark = predicted === measured ? '✓ exact' : `${delta > 0 ? '+' : ''}${delta.toLocaleString()} (${pct}%)`
  console.log(`  ${label.padEnd(22)} predicted ${predicted.toLocaleString().padStart(9)}   measured ${measured.toLocaleString().padStart(9)}   ${mark}`)
}

/**
 * §3.1's built-in sanity check on the sprint's biggest inference.
 *
 * The brief: *"the report lists the top 30 divisions the heuristic tags as free-vote-like, by
 * rebellion volume. The classic free votes — assisted dying, hunting, abortion-related divisions —
 * are the expected members of that list. If they are absent, the heuristic is wrong."*
 *
 * "Rebellion volume" is measured here as the number of members voting against their own party's
 * majority side — which is what makes a division look unwhipped in the first place. Note that a
 * free-vote-like division produces NO 'rebellion:v1' signals (nobody rebels against a whip that
 * was not applied), so the count has to be computed from the party splits rather than read off the
 * signal table; reading it off the signals would return zero for every row and look like a bug in
 * the politics rather than in the query.
 */
async function freeVoteAudit(pool: ReturnType<typeof getNeonPool>) {
  console.log(`\n════ §3.1 AUDIT — THE 30 MOST-SPLIT DIVISIONS THE HEURISTIC CALLS FREE-VOTE-LIKE ════`)
  const { rows } = await pool.query<{
    house: string; division_id: number; division_date: string; title: string
    minority: string; best_cohesion: string | null; best_party: string | null
  }>(`
    SELECT d.house, d.division_id, d.division_date::text AS division_date,
           left(d.title, 86) AS title,
           SUM(LEAST(p.ayes, p.noes))::text AS minority,
           ROUND(c.best_cohesion::numeric, 3)::text AS best_cohesion, c.best_party
      FROM position_division_class c
      JOIN divisions d ON d.house = c.house AND d.division_id = c.division_id
      JOIN position_division_party p ON p.house = c.house AND p.division_id = c.division_id
     WHERE c.free_vote_like
     GROUP BY d.house, d.division_id, d.division_date, d.title, c.best_cohesion, c.best_party
     ORDER BY SUM(LEAST(p.ayes, p.noes)) DESC
     LIMIT 30`)
  for (const r of rows) {
    console.log(`  ${String(r.minority).padStart(4)} split  ${r.division_date}  ${r.house.padEnd(7)} ${String(r.division_id).padStart(5)}  best ${String(r.best_cohesion ?? 'none').padStart(5)} ${(r.best_party ?? '—').padEnd(18)} ${r.title}`)
  }

  // The named expectations, checked explicitly rather than left to the eye.
  console.log(`\n  ── the classic free votes, checked by name ──`)
  const expectations: Array<[string, string]> = [
    ['assisted dying / Terminally Ill Adults', `(d.title ILIKE '%assisted dying%' OR d.title ILIKE '%terminally ill adults%')`],
    ['hunting', `(d.title ILIKE '%hunting%')`],
    ['abortion', `(d.title ILIKE '%abortion%')`],
  ]
  for (const [label, pred] of expectations) {
    const { rows: [r] } = await pool.query<{ total: string; free: string }>(`
      SELECT COUNT(*)::text AS total,
             COUNT(*) FILTER (WHERE c.free_vote_like)::text AS free
        FROM divisions d JOIN position_division_class c
          ON c.house = d.house AND c.division_id = d.division_id
       WHERE ${pred}`)
    const ok = Number(r.total) > 0 && Number(r.free) > 0
    console.log(`  ${ok ? '✓' : '⚠'} ${label.padEnd(40)} ${r.free} of ${r.total} divisions tagged free-vote-like`)
    // A miss must be diagnosable, not just counted: print the party that kept the division out.
    if (Number(r.free) < Number(r.total)) {
      const { rows: misses } = await pool.query<{
        division_date: string; house: string; division_id: number; title: string
        best_cohesion: string | null; best_party: string | null }>(`
        SELECT d.division_date::text AS division_date, d.house, d.division_id, left(d.title, 64) AS title,
               ROUND(c.best_cohesion::numeric, 3)::text AS best_cohesion, c.best_party
          FROM divisions d JOIN position_division_class c
            ON c.house = d.house AND c.division_id = d.division_id
         WHERE ${pred} AND NOT c.free_vote_like
         ORDER BY c.best_cohesion ASC LIMIT 6`)
      for (const m of misses) {
        console.log(`       missed: ${m.division_date} ${m.house.padEnd(7)} best ${String(m.best_cohesion).padStart(5)} ${(m.best_party ?? '—').padEnd(24)} ${m.title}`)
      }
    }
  }

  // ── how sensitive is the whole classification to the one number it turns on ──
  //
  // The threshold is config and provisional (design §5). Reporting the count at 85% alone would
  // make it look like a fact; reporting the curve shows what kind of number it is. Computed here
  // rather than by re-running the whole derivation five times.
  console.log(`\n  ── threshold sensitivity (divisions tagged free-vote-like, of 5,645) ──`)
  for (const t of [0.75, 0.80, 0.85, 0.90, 0.95]) {
    const { rows: [r] } = await pool.query<{ n: string; assisted: string }>(`
      WITH best AS (
        SELECT d.house, d.division_id, d.title,
               COALESCE(MAX(p.cohesion) FILTER (WHERE p.is_whipped_party), 0) AS best_cohesion
          FROM divisions d
          LEFT JOIN position_division_party p ON p.house=d.house AND p.division_id=d.division_id
         GROUP BY 1,2,3)
      SELECT COUNT(*) FILTER (WHERE best_cohesion < ${t})::text AS n,
             COUNT(*) FILTER (WHERE best_cohesion < ${t}
               AND (title ILIKE '%assisted dying%' OR title ILIKE '%terminally ill adults%'
                    OR title ILIKE '%hunting%' OR title ILIKE '%abortion%'))::text AS assisted
        FROM best`)
    const mark = t === POSITION_CONFIG.cohesionThreshold ? '  ← config' : ''
    console.log(`     ≥${(t * 100).toFixed(0)}% cohesion required   ${String(r.n).padStart(5)} divisions   ${String(r.assisted).padStart(3)} of the 52 named-classic divisions${mark}`)
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('[derive-vote-classes] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
}
