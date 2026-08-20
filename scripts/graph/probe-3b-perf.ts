/**
 * probe-3b-perf.ts — GRAPH 3B §1, the 9,048 ms. Read-only; creates nothing.
 *
 * Brief §1: "Report where it goes and fix it if the cause is an index that is missing rather than a
 * query that is inherently heavy." So measure which of those it is BEFORE reaching for either.
 *
 * The hypothesis from the plan in audit-3b-distribution.ts --explain: the `position_signal` view's
 * vote arm derives `target_id` as `house || ':' || division_id`, a COMPUTED expression. The target
 * filter arrives as a hash join against a two-row function scan, and Postgres cannot push a hash
 * condition into a computed column, so it materialises all 2,317,523 signals and then throws away
 * 2,316,542 of them. The existing `idx_dv_div (house, division_id)` is unusable in that shape.
 *
 * Three candidate shapes are timed against each other. Nothing is created.
 *
 * Usage (from scripts/graph):  npx tsx probe-3b-perf.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

const PAIR = ['commons:2051', 'commons:2068']

async function time(pool: any, label: string, sql: string, params: any[]) {
  // Two runs: the first pays for any cold buffers, the second is the number that matters. One
  // sample is not a measurement (3A's own lesson from the cache-header claim).
  const t: number[] = []
  let rows = 0
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now()
    const r = await pool.query(sql, params)
    t.push(Date.now() - t0)
    rows = r.rows.length
  }
  console.log(`   ${label.padEnd(52)} ${t.map((x) => String(x).padStart(5)).join(' ')} ms   rows=${rows}`)
  return Math.min(...t)
}

async function main() {
  const pool = getNeonPool()
  try {
    const types = PAIR.map(() => 'division')

    console.log('\n──── the three shapes, three runs each (min is the number that matters)\n')

    const viaView = await time(pool, 'A · through the view, as positions.ts does today', `
      SELECT s.actor_id FROM unnest($1::text[], $2::text[]) AS want(target_type, target_id)
        JOIN position_signal s ON s.target_type = want.target_type AND s.target_id = want.target_id`,
      [types, PAIR])

    // Same rows, but the division predicate decomposed so `idx_dv_div` is reachable. This is what
    // the view CANNOT express, because a view has no parameters.
    const decomposed = await time(pool, 'B · decomposed predicate, reaching idx_dv_div', `
      WITH want AS (
        SELECT split_part(t, ':', 1) AS house, split_part(t, ':', 2)::int AS division_id
          FROM unnest($1::text[]) AS t)
      SELECT e.id AS actor_id
        FROM want
        JOIN division_votes v ON v.house = want.house AND v.division_id = want.division_id
        JOIN graph_entity e ON e.parl_member_id = v.member_id AND e.kind = 'person'
       WHERE v.vote IN ('aye','no')`, [PAIR])

    // What an expression index would have to serve, tested by writing the join the way the planner
    // would have to use it. If this is fast WITHOUT the index it means the concatenation is not the
    // cost; if it is slow, the index is the missing thing.
    const exprForm = await time(pool, 'C · concatenated predicate, no expression index (control)', `
      SELECT e.id AS actor_id
        FROM division_votes v
        JOIN graph_entity e ON e.parl_member_id = v.member_id AND e.kind = 'person'
       WHERE (v.house || ':' || v.division_id) = ANY($1::text[]) AND v.vote IN ('aye','no')`, [PAIR])

    console.log(`\n   A (view)        ${viaView} ms`)
    console.log(`   B (decomposed)  ${decomposed} ms      ${(viaView / decomposed).toFixed(0)}× faster than A`)
    console.log(`   C (concat, no expression index) ${exprForm} ms`)
    console.log(`\n   VERDICT: ${decomposed * 20 < viaView
      ? 'the rows are cheap to reach — the view SHAPE is the cost, not the volume of data.'
      : 'the work is inherent; an index will not save it.'}`)
    console.log(`   C vs B tells which fix: ${exprForm > decomposed * 5
      ? 'the concatenation blocks the index, so an EXPRESSION INDEX on (house || \':\' || division_id) is the missing index.'
      : 'the concatenation is NOT the blocker; the view\'s inability to take a parameter is.'}`)

    console.log('\n──── plan for B, to confirm it reaches the index rather than getting lucky')
    const { rows: plan } = await pool.query(`
      EXPLAIN (ANALYZE, COSTS OFF)
      WITH want AS (
        SELECT split_part(t, ':', 1) AS house, split_part(t, ':', 2)::int AS division_id
          FROM unnest($1::text[]) AS t)
      SELECT e.id FROM want
        JOIN division_votes v ON v.house = want.house AND v.division_id = want.division_id
        JOIN graph_entity e ON e.parl_member_id = v.member_id AND e.kind = 'person'
       WHERE v.vote IN ('aye','no')`, [PAIR])
    for (const p of plan) console.log('   ' + p['QUERY PLAN'])

    console.log('\n──── and the label joins the page also pays for')
    await time(pool, 'D · full page query as positions.ts issues it', `
      SELECT s.actor_id::text, i.canonical_name, s.target_type, s.target_id, s.signal_ref,
             COALESCE(d.title, cs."sectionTitle") AS target_label
        FROM unnest($1::text[], $2::text[]) AS want(target_type, target_id)
        JOIN position_signal s ON s.target_type = want.target_type AND s.target_id = want.target_id
        JOIN graph_entity_identity i ON i.entity_id = s.actor_id
        LEFT JOIN divisions d
          ON d.house = (CASE WHEN s.target_type = 'division' THEN split_part(s.target_id, ':', 1) END)
         AND d.division_id = (CASE WHEN s.target_type = 'division'
                                    AND split_part(s.target_id, ':', 2) ~ '^[0-9]+$'
                                   THEN split_part(s.target_id, ':', 2)::int END)
        LEFT JOIN corpus_sections cs
          ON s.target_type = 'edm' AND cs.id = 'early-day-motions:' || s.target_id || ':1'`,
      [types, PAIR])
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
