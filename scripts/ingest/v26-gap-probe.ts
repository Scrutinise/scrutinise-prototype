/** v26-gap-probe.ts — live TNA fetchability check for a sample of the genuine
 * gap set (v26_nonmatch category='gap'). Confirms legislation.gov.uk still serves
 * these via the per-act feed before seeding ~24k rows. READ-ONLY. */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { discoverFormats } from './sources/tna-legislation'

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2,
    statement_timeout: 60_000, query_timeout: 60_000, idleTimeoutMillis: 8_000, connectionTimeoutMillis: 15_000 })
  // stratified sample across types + year buckets
  const sample = await pool.query(`
    (SELECT gid,t,year FROM v26_nonmatch WHERE category='gap' AND t='UKSI' AND year<1980 ORDER BY random() LIMIT 4)
    UNION ALL (SELECT gid,t,year FROM v26_nonmatch WHERE category='gap' AND t='UKSI' AND year BETWEEN 1980 AND 1999 ORDER BY random() LIMIT 6)
    UNION ALL (SELECT gid,t,year FROM v26_nonmatch WHERE category='gap' AND t='UKSI' AND year BETWEEN 2000 AND 2009 ORDER BY random() LIMIT 5)
    UNION ALL (SELECT gid,t,year FROM v26_nonmatch WHERE category='gap' AND t='UKSI' AND year>=2010 ORDER BY random() LIMIT 2)
    UNION ALL (SELECT gid,t,year FROM v26_nonmatch WHERE category='gap' AND t='UKPGA' ORDER BY random() LIMIT 4)
    UNION ALL (SELECT gid,t,year FROM v26_nonmatch WHERE category='gap' AND t='EUR' ORDER BY random() LIMIT 4)`)
  await pool.end()

  let ok = 0, absent = 0
  for (const r of sample.rows) {
    const fmts = await discoverFormats(r.gid)
    const hit = fmts.length > 0
    if (hit) ok++; else absent++
    console.log(`  ${r.gid} [${r.t} ${r.year}] → ${hit ? fmts.join(',') : '(no feed / absent)'}`)
  }
  console.log(`\nfetchable: ${ok}/${sample.rows.length}  absent: ${absent}`)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
