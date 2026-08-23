/** c2-schema.ts — READ-ONLY. What columns exist on the tables C2 touches. */
import { pool } from './db'
;(async () => {
  const p = pool()
  for (const t of ['corpus_sections', 'corpus_targets', 'corpus_chunks']) {
    const r = await p.query(
      `select column_name, data_type from information_schema.columns where table_name=$1 order by ordinal_position`, [t])
    console.log(`\n=== ${t} (${r.rows.length} cols) ===`)
    console.log(r.rows.map((c: any) => `${c.column_name}:${c.data_type}`).join('  '))
  }
  const tbl = await p.query(
    `select table_name from information_schema.tables where table_schema='public' order by 1`)
  console.log('\n=== tables ===\n' + tbl.rows.map((x: any) => x.table_name).join(', '))
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
