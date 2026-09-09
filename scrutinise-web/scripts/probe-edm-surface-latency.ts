/**
 * probe-edm-surface-latency.ts — does the positions surface still answer quickly once a motion has
 * 60 signatures instead of one?
 *
 * ⚠ WHY THIS IS NOT AN AFTERTHOUGHT. GRAPH 3B found the read path taking 9,048 ms because the
 * `position_signal` VIEW derived its `target_id` and the planner could not push the filter down; the
 * fix was `position_signal_for()`, a function, at 57 ms. This sprint multiplies the stored arm of
 * that function by roughly 35, and "it uses an index" is a claim about a plan, not a measurement.
 * One object, two readers: optimising for one access pattern has wrecked another in this project
 * before.
 *
 * ⚠ READ-ONLY.
 *
 * Usage (from scrutinise-web):
 *   tsx --env-file=.env scripts/probe-edm-surface-latency.ts
 */
import { positionsFor, type PositionTarget } from '@/lib/graph/positions'
import { getNeonPool } from '@/lib/pg-pool'

async function main() {
  const pool = getNeonPool()

  // The motions we hold the most signatures for, plus a division for contrast.
  const { rows: top } = await pool.query<{ target_id: string; n: string }>(`
    SELECT target_id, COUNT(*)::text AS n
      FROM position_signal_stored
     WHERE signal_type = 'edm_signature' AND superseded_by IS NULL
     GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 5`)

  console.log(`\n════ SURFACE LATENCY, PER TARGET ${'═'.repeat(46)}`)
  console.log(`   ${'target'.padEnd(26)}${'signals'.padStart(9)}${'actors'.padStart(9)}${'cold ms'.padStart(10)}${'warm ms'.padStart(10)}`)

  const timeIt = async (t: PositionTarget) => {
    const t0 = Date.now(); const a = await positionsFor([t], { limit: 5, actorKind: 'person' }); const cold = Date.now() - t0
    const t1 = Date.now(); await positionsFor([t], { limit: 5, actorKind: 'person' }); const warm = Date.now() - t1
    return { cold, warm, matched: a.ranking.ofMatched }
  }

  for (const r of top) {
    const t: PositionTarget = { type: 'edm', id: r.target_id }
    const m = await timeIt(t)
    console.log(`   ${`edm:${r.target_id}`.padEnd(26)}${Number(r.n).toLocaleString().padStart(9)}${String(m.matched).padStart(9)}${String(m.cold).padStart(10)}${String(m.warm).padStart(10)}`)
  }

  // ⚠ THE CONTROL. A division target must NOT have got slower: it reads the same function, whose
  // stored arm has just grown by two million rows. If only the EDM numbers are printed, a regression
  // on the vote path is invisible — which is the "one object, two readers" failure exactly.
  const { rows: [div] } = await pool.query<{ house: string; division_id: number; c: string }>(`
    SELECT v.house, v.division_id, COUNT(*)::text AS c FROM division_votes v
     GROUP BY 1,2 ORDER BY COUNT(*) DESC LIMIT 1`)
  const dm = await timeIt({ type: 'division', id: `${div.house}:${div.division_id}` })
  console.log(`   ${`division:${div.house}:${div.division_id}`.padEnd(26)}${Number(div.c).toLocaleString().padStart(9)}${String(dm.matched).padStart(9)}${String(dm.cold).padStart(10)}${String(dm.warm).padStart(10)}`)
  console.log(`\n   ⚠ the division row is the CONTROL: it shares position_signal_for() with the EDM rows`)
  console.log(`     and must not have got slower. A regression there would not show in the EDM numbers.`)

  await pool.end()
}
main().catch(async (e) => { console.error(e); try { await getNeonPool().end() } catch {} process.exit(1) })
