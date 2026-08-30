import * as fs from 'fs'
import * as path from 'path'
import { pool, banner } from './db'

async function main() {
  banner('apply schema.sql (CCW-B7 Phase 3)')
  const sql = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8')
  const p = pool()
  await p.query(sql)

  const t = await p.query(`
    select table_name, (select count(*) from information_schema.columns c
                        where c.table_schema='starkey' and c.table_name=t.table_name) cols
    from information_schema.tables t where table_schema='starkey' order by 1`)
  console.log('starkey tables now:')
  for (const r of t.rows) console.log(`  ${r.table_name} (${r.cols} columns)`)

  const i = await p.query(`select indexname from pg_indexes where schemaname='starkey' order by 1`)
  console.log('indexes:', i.rows.map(r => r.indexname).join(', '))
  await p.end()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
