/**
 * v32-state-check.ts — one place to read the committees state across BOTH stores, so
 * "corpus and index reconcile" is a measurement rather than an assumption.
 *
 * The two stores drift in opposite directions and neither tool fixes both:
 *   - rows in Neon but not Lance  → fts-catchup appends them
 *   - rows in Lance but not Neon  → ORPHANS; only fts-hygiene removes them
 * Retiring blob rows creates the second kind, which is why this exists.
 *
 * Read-only. Usage: tsx v32-state-check.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { connectLance, FTS_TABLE } from './search/lance'

async function main() {
  const p = getNeonPool()

  const neon = await p.query(`
    SELECT
      count(*) FILTER (WHERE status='compiled')::int                         AS compiled,
      count(*) FILTER (WHERE status='compiled' AND id ~ '-[0-9]{4}$')::int   AS split_sections,
      count(*) FILTER (WHERE status='compiled' AND id !~ '-[0-9]{4}$'
        AND ("sectionTitle" ILIKE 'Report:%' OR "sectionTitle" ILIKE 'Special Report:%'
          OR "sectionTitle" ILIKE 'Government Response:%'))::int             AS blob_rows_left,
      count(*) FILTER (WHERE status<>'compiled')::int                        AS markers
    FROM corpus_sections WHERE corpus='committees-reports'`)
  console.log('── Neon: committees-reports ─────────────────────────────────────────────────')
  console.table(neon.rows)

  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  const lanceRows = await tbl.query().where(`corpus = 'committees-reports'`).select(['id']).toArray() as { id: string }[]
  const lanceIds = new Set(lanceRows.map(r => r.id))
  console.log(`── Lance: corpus_fts rows for committees-reports = ${lanceIds.size.toLocaleString()}`)

  const { rows: neonIdRows } = await p.query<{ id: string }>(
    `SELECT id FROM corpus_sections WHERE corpus='committees-reports' AND status='compiled'`)
  const neonIds = new Set(neonIdRows.map(r => r.id))

  const missing = [...neonIds].filter(id => !lanceIds.has(id))          // catch-up handles
  const orphans = [...lanceIds].filter(id => !neonIds.has(id))          // hygiene handles
  console.log(`   in Neon, NOT in Lance (fts-catchup appends):  ${missing.length.toLocaleString()}`)
  console.log(`   in Lance, NOT in Neon (fts-hygiene removes):  ${orphans.length.toLocaleString()}`)
  for (const o of orphans.slice(0, 5)) console.log(`      orphan e.g. ${o}`)

  try {
    const stats: any = await (tbl as any).indexStats('body_idx')
    const idx = Number(stats?.numIndexedRows ?? -1), un = Number(stats?.numUnindexedRows ?? -1)
    console.log(`── Index coverage (whole table): indexed=${idx.toLocaleString()} unindexed=${un.toLocaleString()}` +
      (idx + un > 0 ? ` (${((un / (idx + un)) * 100).toFixed(2)}% brute-force scanned per query)` : ''))
  } catch (e) { console.warn(`   indexStats unavailable: ${(e as Error).message}`) }

  await endNeonPool()
}
main().catch(e => { console.error('[state] FATAL', e); process.exit(1) })
