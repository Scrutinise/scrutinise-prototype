/** c3-e1-audit.ts — Lane E1 audit: is corpus_sections.ftsVector read by anything, and what does it cost? */
import { pool } from './db'
async function main() {
  const p = pool(); const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows
  console.log('── triggers on corpus_sections')
  console.log(JSON.stringify(await q(`SELECT tgname, pg_get_triggerdef(t.oid) def FROM pg_trigger t
     WHERE t.tgrelid='corpus_sections'::regclass AND NOT tgisinternal`), null, 1))
  console.log('\n── indexes on corpus_sections')
  for (const r of await q(`SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) sz, indexdef
      FROM pg_indexes WHERE tablename='corpus_sections' ORDER BY pg_relation_size(indexname::regclass) DESC`))
    console.log(`  ${String(r.indexname).padEnd(34)} ${String(r.sz).padStart(10)}  ${r.indexdef}`)
  console.log('\n── index usage (pg_stat_user_indexes)')
  for (const r of await q(`SELECT indexrelname, idx_scan, idx_tup_read FROM pg_stat_user_indexes
      WHERE relname='corpus_sections' ORDER BY idx_scan DESC`))
    console.log(`  ${String(r.indexrelname).padEnd(34)} scans=${r.idx_scan}  tup_read=${r.idx_tup_read}`)
  console.log('\n── ftsVector storage')
  const s = (await q(`SELECT
      count(*) FILTER (WHERE "ftsVector" IS NOT NULL)::bigint nonnull,
      count(*)::bigint total,
      pg_size_pretty(sum(pg_column_size("ftsVector"))) bytes_pretty,
      sum(pg_column_size("ftsVector"))::bigint bytes
    FROM corpus_sections`))[0]
  console.log(JSON.stringify(s))
  console.log('\n── table + toast size')
  console.log(JSON.stringify((await q(`SELECT pg_size_pretty(pg_table_size('corpus_sections')) tbl,
      pg_size_pretty(pg_indexes_size('corpus_sections')) idx,
      pg_size_pretty(pg_total_relation_size('corpus_sections')) total,
      pg_size_pretty(pg_total_relation_size(reltoastrelid)) toast
    FROM pg_class WHERE oid='corpus_sections'::regclass`))[0]))
  console.log('\n── database size')
  console.log(JSON.stringify((await q(`SELECT pg_size_pretty(pg_database_size(current_database())) sz`))[0]))
  await p.end()
}
main().catch(e => { console.error('FAIL', e.message); process.exit(1) })
