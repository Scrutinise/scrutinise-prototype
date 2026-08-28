/** probe-report-state.ts — report run: what the graph actually holds today. */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { EDGE_TABLE } from './graph-common'

const TARGETS: Array<[string, string]> = [
  ['ukpga/2010/25', 'CRAG 2010 (WS-05)'],
  ['ukpga/1998/42', 'Human Rights Act 1998 (WS-01)'],
  ['ukpga/2010/15', 'Equality Act 2010 (WS-04)'],
  ['ukpga/2005/4', 'Constitutional Reform Act 2005 (WS-02/03)'],
]

async function main() {
  const pool = getNeonPool()
  const t0 = Date.now()
  const { rows: cnt } = await pool.query(`SELECT COUNT(*)::bigint n FROM ${CITATION_TABLE}`)
  console.log(`connected in ${Date.now() - t0}ms; ${CITATION_TABLE} = ${Number(cnt[0].n).toLocaleString()} rows`)

  const { rows: det } = await pool.query(
    `SELECT detection, COUNT(*)::bigint n FROM ${CITATION_TABLE} GROUP BY 1 ORDER BY 2 DESC`)
  console.log('detection values in citation_edge:', det.map((r:any)=>`${r.detection}=${Number(r.n).toLocaleString()}`).join(', '))

  const { rows: et } = await pool.query(
    `SELECT edge_type, COUNT(*)::bigint n FROM ${EDGE_TABLE} GROUP BY 1 ORDER BY 2 DESC`)
  console.log(`${EDGE_TABLE} edge types:`, et.map((r:any)=>`${r.edge_type}=${Number(r.n).toLocaleString()}`).join(', '))

  const { rows: src } = await pool.query(
    `SELECT source, COUNT(*)::bigint n FROM ${EDGE_TABLE} GROUP BY 1 ORDER BY 2 DESC`)
  console.log(`${EDGE_TABLE} sources:`, src.map((r:any)=>`${r.source}=${Number(r.n).toLocaleString()}`).join(', '))

  console.log('\n-- per target, raw counts (NOT merged) --')
  for (const [gid, label] of TARGETS) {
    const { rows: c } = await pool.query(
      `SELECT detection, COUNT(*)::bigint n, COUNT(DISTINCT source_gid)::bigint docs
       FROM ${CITATION_TABLE} WHERE target_act_id = $1 GROUP BY 1 ORDER BY 2 DESC`, [gid])
    const { rows: e } = await pool.query(
      `SELECT COUNT(*)::bigint n FROM ${EDGE_TABLE}
       WHERE edge_type = 'made-under' AND split_part(to_id, ':', 2) = $1`, [gid])
    const { rows: title } = await pool.query(
      `SELECT title FROM corpus_acts WHERE gid = $1 LIMIT 1`, [gid]).catch(() => ({ rows: [] as any[] }))
    console.log(`  ${gid.padEnd(16)} ${label}`)
    console.log(`      citation_edge: ${c.map((r:any)=>`${r.detection} ${Number(r.n)} (${Number(r.docs)} docs)`).join(' + ') || 'NONE'}`)
    console.log(`      made-under (enabling) edges to it: ${Number(e[0].n).toLocaleString()}`)
    if (title[0]) console.log(`      corpus_acts title: ${title[0].title}`)
  }
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
