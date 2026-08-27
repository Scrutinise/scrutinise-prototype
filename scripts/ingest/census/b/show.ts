/**
 * show.ts — print `corpus_census` as it stands. A census nobody can read at a glance is a census
 * nobody checks, and every number here is meant to be arguable.
 *
 * Usage: tsx census/b/show.ts [--state=MEASURED]
 */
import { pool } from '../../c2/db'

const arg = (n: string) => (process.argv.find(a => a.startsWith(`--${n}=`)) ?? '').split('=')[1] || null

;(async () => {
  const p = pool()
  const state = arg('state')
  const rows = (await p.query(
    `SELECT corpus_key, state, unit, published_units, held_units, hollow_units, absent_total, walked_at
       FROM corpus_census ${state ? 'WHERE state = $1' : ''}
      ORDER BY CASE state WHEN 'MEASURED' THEN 0 WHEN 'DECLARED' THEN 1 WHEN 'CLAIMED' THEN 2
                          WHEN 'UNMEASURED' THEN 3 WHEN 'NOT_STARTED' THEN 4 WHEN 'BLOCKED' THEN 5
                          ELSE 6 END, coalesce(held_units,0) DESC`,
    state ? [state] : [])).rows

  let last = ''
  for (const r of rows) {
    if (r.state !== last) { console.log(`\n── ${r.state} ──`); last = r.state }
    const pub = r.published_units
    const held = r.held_units ?? 0
    const pct = pub ? `${((100 * held) / pub).toFixed(1)}%` : '—'
    const flag = pub && held > pub * 1.02 ? ' ⚠ denominator suspect' : ''
    const hollow = r.hollow_units ? `  hollow ${Number(r.hollow_units).toLocaleString()}` : ''
    console.log(`  ${r.corpus_key.padEnd(28)} ${String(held.toLocaleString()).padStart(9)} / ` +
      `${String(pub == null ? '—' : pub.toLocaleString()).padStart(9)}  ${pct.padStart(7)}${flag}${hollow}`)
  }

  const s = (await p.query(
    `SELECT state, count(*)::int n, sum(coalesce(held_units,0))::bigint held,
            sum(coalesce(published_units,0))::bigint pub, sum(absent_total)::bigint absent
       FROM corpus_census GROUP BY 1 ORDER BY 2 DESC`)).rows
  console.log('\n── totals ──')
  for (const x of s) {
    console.log(`  ${String(x.state).padEnd(12)} ${String(x.n).padStart(3)} collections   ` +
      `${Number(x.held).toLocaleString().padStart(11)} held / ${Number(x.pub).toLocaleString().padStart(11)} published   ` +
      `${Number(x.absent).toLocaleString().padStart(9)} absent`)
  }
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
