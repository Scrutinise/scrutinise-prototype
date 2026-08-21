/**
 * probe-3c-pre.ts — GRAPH 3C. Read the state 3C's checks must be able to FAIL against.
 *
 * Brief §0/§6: *"Every check in this sprint must be shown failing against the real broken state,
 * not a synthetic one."* Run this BEFORE setup-3c.ts and derive-vote-classes.ts. It reports the
 * three facts that 3C's guards turn on, as they are in production right now.
 *
 * Usage (from scripts/graph):  npx tsx probe-3c-pre.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { POSITION_CONFIG } from '../../scrutinise-web/lib/graph/position-config'

export {}

async function main() {
  const pool = getNeonPool()
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host})`); process.exit(1) }
    console.log(`host ${host}`)
    console.log(`\n════ THE STATE 3C'S GUARDS MUST BE ABLE TO FAIL AGAINST ════`)

    // 1 · the generator gap — the config knows a class the SQL does not
    let missing = 0
    for (const k of Object.keys(POSITION_CONFIG.weights).filter((k) => k.includes(':'))) {
      const { rows: [r] } = await pool.query<{ w: string | null }>(
        `SELECT position_raw_weight('vote', $1)::text AS w`, [k])
      if (r.w === null) missing++
      console.log(`  position_raw_weight('vote','${k}')`.padEnd(58) +
        (r.w === null ? '❌ NULL — the SQL does not know this class' : `= ${r.w}`))
    }
    console.log(`  → ${missing} class(es) the config knows and the SQL does not.` +
      (missing > 0 ? '  This is the 3B defect, half-fixed: the SIGNAL-TYPE half was derived from the config, the VOTE-CLASS half was still a literal.' : ''))

    // 2 · the columns
    const { rows: cols } = await pool.query<{ t: string; c: string }>(`
      SELECT table_name AS t, column_name AS c FROM information_schema.columns
       WHERE column_name IN ('is_cohesive_party','free_vote_source','consistency')
         AND table_name LIKE 'position%'`)
    console.log(`\n  additive columns present: ${cols.length === 0 ? 'NONE — none of the three exists yet' : cols.map((c) => `${c.t}.${c.c}`).join(', ')}`)

    // 3 · the ladder the view calls today
    const { rows: [v] } = await pool.query<{ def: string }>(
      `SELECT pg_get_viewdef('position_signal_vote'::regclass, true) AS def`)
    console.log(`  position_signal_vote calls: ` +
      (/position_vote_class_v2/.test(v.def) ? 'position_vote_class_v2' :
        /position_vote_class/.test(v.def) ? 'position_vote_class (the 5-argument original — no cohesion input)' : '(an inline ladder)'))

    // 4 · the misclassification itself, on the case that prompted the sprint
    const { rows: cls } = await pool.query<{ derivation: string; n: string }>(`
      SELECT derivation, COUNT(*)::text AS n
        FROM position_signal_vote
       WHERE target_id IN ('commons:2051', 'commons:2053')
       GROUP BY 1 ORDER BY 2::bigint DESC`)
    console.log(`\n  ── the two divisions 3B named, as classified TODAY ──`)
    for (const r of cls) {
      console.log(`     ${r.derivation.padEnd(30)} ${String(r.n).padStart(5)}  @ ${POSITION_CONFIG.weights[r.derivation as keyof typeof POSITION_CONFIG.weights] ?? '?'}`)
    }
    const { rows: [reb] } = await pool.query<{ n: string }>(`
      SELECT COUNT(*)::text AS n FROM position_signal_vote
       WHERE target_id IN ('commons:2051','commons:2053') AND derivation = 'rebellion:v1'`)
    console.log(`     → ${reb.n} signals asserting a costly act of defiance, at the highest weight in the config,`)
    console.log(`       on two divisions of a Bill that was a free vote throughout.`)

    // 5 · ⚠ THE SCORING INVERSION IS NOT MEASURABLE FROM THIS TABLE, AND THAT IS WORTH SAYING.
    //
    // My first version of this probe averaged `position_estimate.confidence` over each member's
    // rows and reported "✓ consistent scores higher" — which contradicted 3B and was wrong.
    // `position_estimate` is keyed (actor, target), so on a division every row summarises exactly
    // ONE vote and no row can exhibit an aggregation defect that only appears across targets.
    // 3B's 0.748-vs-0.881 is a ROLLED-UP number, the thing `positionsFor()` computes.
    //
    // Measured properly, with the 3B formula and the 3C formula side by side over the same real
    // signals, in `audit-3c-scoring.ts`. Left here as a named absence rather than deleted, because
    // a plausible query over the wrong grain is exactly how a false reassurance gets published.
    console.log(`\n  ── the scoring inversion ──`)
    console.log(`     NOT measurable from position_estimate: every division row summarises one vote,`)
    console.log(`     and the defect only exists in the cross-target rollup. See audit-3c-scoring.ts.`)
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[probe-3c-pre] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
