/**
 * _fts-index-diag-tmp.ts — TEMPORARY. Metadata-only: does corpus_fts actually have a
 * usable inverted index on `body`, and does it cover all 17.7M rows?
 * No scans, no queries. Outside search/ so it can't trip the fts-serve watchPattern.
 */
import { connectLance, FTS_TABLE } from './search/lance'

async function main() {
  const conn = await connectLance()
  const table = await conn.openTable(FTS_TABLE)
  const rows = await table.countRows()
  console.log(`table=${FTS_TABLE}  rows=${rows.toLocaleString()}`)

  const idx = await table.listIndices()
  console.log(`\nindices: ${idx.length}`)
  for (const i of idx) {
    console.log(`  - name=${(i as any).name}  type=${(i as any).indexType}  columns=${JSON.stringify((i as any).columns)}`)
    try {
      const st = await table.indexStats((i as any).name)
      console.log(`      stats: ${JSON.stringify(st)}`)
    } catch (e) {
      console.log(`      stats unavailable: ${(e as Error).message}`)
    }
  }
  if (!idx.length) console.log('  (NONE — every FTS query must scan)')
}

main().catch((e) => { console.error('FATAL', e instanceof Error ? e.message : e); process.exit(1) })
