/**
 * cleanup-v18-carryover.ts — V18 §1 carry-over cleanups (one-off, idempotent).
 *
 * 1. Delete the 8 echr-hudoc V17-verification test rows and clear the echr
 *    breaker — the trip was a deliberate verification artifact; the genuine
 *    blockage (HUDOC endpoint gone) stays recorded in corpus_targets.blocked.
 * 2. Reset tna-legislation zero_output_streak (10) — inflated by V17
 *    verification re-processing done SI-refresh rows, not by real ingest.
 * 3. Seed the tna-caselaw tail: pages 1495–1501 (true last page 1501 per
 *    getTotalJudgments binary search 10 Jun 2026; 74,730 ingested of ~75,050).
 *    Discovery was retired in V17 and the hourly cleanup has since deleted all
 *    done caselaw rows (with them the old page:7489 overhang AND the discovery
 *    cursor), so a direct tail seed is the mechanism now. Overlap pages are
 *    safe — sections upsert idempotently.
 *
 * Run:
 *   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
 *     --tsconfig scripts/tsconfig.json scripts/ingest/cleanup-v18-carryover.ts
 */
import { getNeonPool, endNeonPool } from '../../ingest/shared/neon-pool'

// CORRECTION (V18, after first run): the TNA Atom feed paginates NEWEST-first
// (page 1 = newest judgments) — the first tail seed (pages 1495–1501) re-fetched
// already-ingested OLD judgments and wrote 0 new sections. The ~320 missing
// judgments are on pages 1–7. Refresh rule: seed pages 1..ceil(missing/50)+1.
const CASELAW_TAIL_FIRST = 1
const CASELAW_TAIL_LAST = 7

async function main() {
  const pool = getNeonPool()

  // 1a. echr test rows
  const del = await pool.query(`DELETE FROM ingest_queue WHERE corpus = 'echr-hudoc'`)
  console.log(`echr-hudoc rows deleted: ${del.rowCount}`)

  // 1b. echr breaker clear (verification artifact; corpus_targets.blocked still ⛔s it)
  const breaker = await pool.query(`
    UPDATE source_status
    SET state = 'ok', trip_reason = NULL, tripped_at = NULL, zero_output_streak = 0
    WHERE source_key = 'echr' AND state = 'tripped'
  `)
  console.log(`echr breaker cleared: ${breaker.rowCount} row(s)`)

  // 2. tna-legislation streak reset (verification artifact — done-row re-processing)
  const streak = await pool.query(`
    UPDATE source_status SET zero_output_streak = 0, updated_at = NOW()
    WHERE source_key = 'tna-legislation' AND zero_output_streak > 0
  `)
  console.log(`tna-legislation zero_output_streak reset: ${streak.rowCount} row(s)`)

  // 3. caselaw tail seed
  let inserted = 0
  for (let p = CASELAW_TAIL_FIRST; p <= CASELAW_TAIL_LAST; p++) {
    const res = await pool.query(`
      INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority)
      VALUES ($1, 'tna-caselaw', $2, 'tna-caselaw', 1)
      ON CONFLICT (id) DO NOTHING
    `, [`tna-caselaw:page:${p}`, `page:${p}`])
    inserted += res.rowCount ?? 0
  }
  console.log(`tna-caselaw tail rows inserted: ${inserted} (pages ${CASELAW_TAIL_FIRST}–${CASELAW_TAIL_LAST})`)

  // Verify end state
  const check = await pool.query<{ status: string; n: string }>(
    `SELECT status, COUNT(*)::text AS n FROM ingest_queue GROUP BY status ORDER BY status`
  )
  console.log('queue now:', check.rows.map(r => `${r.status}=${r.n}`).join('  '))

  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
