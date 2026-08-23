/** l2-repeals.ts — READ-ONLY. Is Lane 2 item 4 (dot leaders) already built as section_repeals? */
import { pool } from './db'
;(async () => {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows
  console.log('=== section_repeals columns ===')
  console.log(await q(`select column_name, data_type from information_schema.columns
    where table_name='section_repeals' order by ordinal_position`))
  console.log('\n=== row count ===')
  console.log(await q(`select count(*)::int n from section_repeals`))
  console.log('\n=== sample ===')
  console.log(await q(`select * from section_repeals limit 3`))
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
