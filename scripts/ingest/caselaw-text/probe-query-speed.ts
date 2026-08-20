/**
 * probe-query-speed.ts — the other half of the 6/s mystery. R2 was measured at 85 reads/s, so the
 * date sweep's missing 330 seconds are in the database. This times the two cursor queries the two
 * sweeps use, against the same table. WRITES NOTHING.
 */
import { namesPool, endNamesPool } from '../names/names-pool'

;(async () => {
  const p = namesPool()
  const queries: Array<[string, string, unknown[]]> = [
    ['date sweep cursor (LIMIT 2000)',
      `SELECT id, "itemDate"::text AS "itemDate", "r2RawKey" FROM corpus_sections
        WHERE corpus=$1 AND id > $2 ORDER BY id LIMIT 2000`, ['tna-caselaw', '']],
    ['date sweep cursor, mid-collection',
      `SELECT id, "itemDate"::text AS "itemDate", "r2RawKey" FROM corpus_sections
        WHERE corpus=$1 AND id > $2 ORDER BY id LIMIT 2000`, ['tna-caselaw', 'tna-caselaw:[2015] EWCA Civ 1:1']],
    ['recompile cursor (LIMIT 500, NOT NULL predicates)',
      `SELECT id, "r2Key", "r2RawKey", notes FROM corpus_sections
        WHERE corpus=$1 AND "r2Key" IS NOT NULL AND "r2RawKey" IS NOT NULL AND id > $2
        ORDER BY id LIMIT 500`, ['tna-caselaw', '']],
  ]
  for (const [label, sql, params] of queries) {
    const t = Date.now()
    const r = await p.query(sql, params)
    console.log(`${((Date.now() - t) / 1000).toFixed(2)}s  ${r.rowCount} rows  ${label}`)
  }
  const plan = await p.query(
    `EXPLAIN (ANALYZE, BUFFERS) SELECT id, "itemDate"::text, "r2RawKey" FROM corpus_sections
      WHERE corpus='tna-caselaw' AND id > '' ORDER BY id LIMIT 2000`)
  console.log('\nPLAN:')
  plan.rows.forEach(r => console.log('  ' + Object.values(r)[0]))
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
