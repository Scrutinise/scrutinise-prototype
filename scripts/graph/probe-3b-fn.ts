/**
 * probe-3b-fn.ts — did the parameterised function actually help, and is it the same data?
 *
 * Two questions, and the second matters more than the first:
 *   1. Is `position_signal_for()` fast?
 *   2. Does it return EXACTLY what the `position_signal` view returns — and does the redefined
 *      `position_signal_vote` view still return exactly what it did before 3B touched it?
 *
 * A fast query that returns different rows is worse than a slow one that does not.
 *
 * Usage (from scripts/graph):  npx tsx probe-3b-fn.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

const PAIR = ['commons:2051', 'commons:2068']

async function time(pool: any, label: string, sql: string, params: any[]) {
  const t: number[] = []
  let rows = 0
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now()
    const r = await pool.query(sql, params)
    t.push(Date.now() - t0)
    rows = r.rows.length
  }
  console.log(`   ${label.padEnd(50)} ${t.map((x) => String(x).padStart(5)).join(' ')} ms  rows=${rows}`)
  return Math.min(...t)
}

async function main() {
  const pool = getNeonPool()
  try {
    const types = PAIR.map(() => 'division')

    console.log('\n──── 1 · SPEED (three runs, min is the number)\n')
    const viaView = await time(pool, 'view  — position_signal, hash-joined to unnest', `
      SELECT s.actor_id FROM unnest($1::text[], $2::text[]) AS want(target_type, target_id)
        JOIN position_signal s ON s.target_type = want.target_type AND s.target_id = want.target_id`,
      [types, PAIR])
    const viaFn = await time(pool, 'fn    — position_signal_for(types, ids)',
      `SELECT actor_id FROM position_signal_for($1::text[], $2::text[])`, [types, PAIR])
    console.log(`\n   ${(viaView / viaFn).toFixed(0)}× faster: ${viaView} ms → ${viaFn} ms`)

    console.log('\n──── 2 · EQUIVALENCE, per target type. Any non-zero number here is a bug.\n')
    // Sample real targets of each type from the stored layer, plus the division pair.
    const { rows: samples } = await pool.query<{ target_type: string; target_id: string }>(`
      (SELECT DISTINCT target_type, target_id FROM position_signal_stored
        WHERE target_type = 'edm' LIMIT 40)
      UNION ALL
      (SELECT DISTINCT target_type, target_id FROM position_signal_stored
        WHERE target_type = 'inquiry' LIMIT 40)
      UNION ALL
      (SELECT DISTINCT target_type, target_id FROM position_signal_stored
        WHERE target_type = 'organisation' LIMIT 40)`)
    const allTypes = [...types, ...samples.map((s) => s.target_type)]
    const allIds = [...PAIR, ...samples.map((s) => s.target_id)]
    console.log(`   sampled ${allIds.length} targets: ${[...new Set(allTypes)].join(', ')}`)

    const { rows: [diff] } = await pool.query<Record<string, string>>(`
      WITH v AS (
        SELECT s.signal_ref, s.actor_id, s.target_type, s.target_id, s.signal_type, s.direction,
               s.derivation, s.raw_weight, s.evidence_ids, s.observed_at, s.storage
          FROM unnest($1::text[], $2::text[]) AS want(target_type, target_id)
          JOIN position_signal s ON s.target_type = want.target_type AND s.target_id = want.target_id),
      f AS (
        SELECT signal_ref, actor_id, target_type, target_id, signal_type, direction,
               derivation, raw_weight, evidence_ids, observed_at, storage
          FROM position_signal_for($1::text[], $2::text[]))
      SELECT (SELECT COUNT(*) FROM v)::text AS view_rows,
             (SELECT COUNT(*) FROM f)::text AS fn_rows,
             (SELECT COUNT(*) FROM (SELECT * FROM v EXCEPT ALL SELECT * FROM f) x)::text AS in_view_not_fn,
             (SELECT COUNT(*) FROM (SELECT * FROM f EXCEPT ALL SELECT * FROM v) y)::text AS in_fn_not_view`,
      [allTypes, allIds])
    console.log(`   view rows         ${Number(diff.view_rows).toLocaleString()}`)
    console.log(`   function rows     ${Number(diff.fn_rows).toLocaleString()}`)
    console.log(`   in view, not fn   ${diff.in_view_not_fn}`)
    console.log(`   in fn, not view   ${diff.in_fn_not_view}`)
    console.log(`   ${diff.in_view_not_fn === '0' && diff.in_fn_not_view === '0' && diff.view_rows === diff.fn_rows
      ? '✓ identical row for row' : '❌ THEY DIFFER'}`)

    console.log('\n──── 3 · DID REDEFINING position_signal_vote CHANGE ANYTHING?\n')
    console.log('   3A measured, and the report records: 2,080,585 vote signals, 2,317,523 total,')
    console.log('   and this class breakdown. Re-read them through the redefined view:')
    const { rows: cls } = await pool.query<{ derivation: string; n: string }>(`
      SELECT derivation, COUNT(*)::text AS n FROM position_signal_vote GROUP BY 1 ORDER BY 2::bigint DESC`)
    const expected: Record<string, number> = {
      'whipped-with:v1': 1865002, 'unwhipped-group:v1': 127039,
      'small-party-unclassified:v1': 61919, 'rebellion:v1': 18493, 'free-vote-heuristic:v1': 8132,
    }
    let total = 0, bad = 0
    for (const r of cls) {
      const got = Number(r.n); total += got
      const want = expected[r.derivation]
      const ok = want === got
      if (!ok) bad++
      console.log(`   ${ok ? '✓' : '❌'} ${r.derivation.padEnd(30)} ${got.toLocaleString().padStart(11)}  (3A recorded ${want?.toLocaleString() ?? '—'})`)
    }
    console.log(`   ${total === 2080585 ? '✓' : '❌'} total vote signals ${total.toLocaleString()} (3A recorded 2,080,585)`)
    const { rows: [tot] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM position_signal`)
    console.log(`   ${tot.n === '2317523' ? '✓' : '❌'} total signals      ${Number(tot.n).toLocaleString()} (3A recorded 2,317,523)`)
    if (bad) console.log('\n   ❌ THE REDEFINITION CHANGED THE DATA. Revert it.')

    console.log('\n──── 4 · full-scan cost of the redefined view (the estimate builder\'s path)\n')
    await time(pool, 'count(*) over position_signal_vote', `SELECT COUNT(*) FROM position_signal_vote`, [])
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
