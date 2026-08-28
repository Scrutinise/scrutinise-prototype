/** probe-report-corpus.ts — can we reach source/target document TEXT for T2/T3? */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { corpusForGid } from './graph-common'

const GIDS = ['ukpga/2010/25','ukpga/1998/42','ukpga/2010/15','ukpga/2005/4',
              'ukpga/1998/46','ukpga/1998/47','ukpga/2006/32','anaw/2013/4','uksi/2010/1277']

async function main() {
  const pool = getNeonPool()
  const { rows: cols } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='corpus_sections' ORDER BY ordinal_position`)
  console.log('corpus_sections columns:', cols.map((c:any)=>c.column_name).join(', '))
  const { rows: idx } = await pool.query(
    `SELECT indexname, indexdef FROM pg_indexes WHERE tablename='corpus_sections'`)
  for (const i of idx) console.log('  idx', i.indexname, '=', i.indexdef.slice(0, 170))

  for (const gid of GIDS) {
    const corpus = corpusForGid(gid)
    const t0 = Date.now()
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int n FROM corpus_sections WHERE corpus = $1 AND id LIKE $2`,
      [corpus, `${corpus}:${gid}:%`])
    const { rows: act } = await pool.query(
      `SELECT id FROM corpus_sections WHERE corpus = $1 AND id = $2 LIMIT 1`, [corpus, `${corpus}:${gid}`])
    console.log(`  ${gid.padEnd(16)} corpus=${corpus.padEnd(24)} sections=${rows[0].n}  actRow=${act.length}  (${Date.now()-t0}ms)`)
  }

  const { rows: samp } = await pool.query(
    `SELECT * FROM corpus_sections WHERE corpus='primary-acts-2000plus' AND id LIKE 'primary-acts-2000plus:ukpga/2010/25:%' ORDER BY id LIMIT 3`)
  console.log('\nsample CRAG row keys:', samp.length ? Object.keys(samp[0]).join(', ') : 'NONE')
  for (const r of samp) console.log('  ', JSON.stringify(r).slice(0, 700))
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
