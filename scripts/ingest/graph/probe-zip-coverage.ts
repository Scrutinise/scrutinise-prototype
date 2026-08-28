/** probe-zip-coverage.ts — which document types the bulk CLML zip actually holds,
 *  and whether the source docs of our three targets are in it. */
import { ZipReader } from './zip-reader'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'

const ZIP = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'

async function main() {
  const t0 = Date.now()
  const zip = new ZipReader(ZIP)
  const byType: Record<string, number> = {}
  const gids = new Set<string>()
  for (const e of zip.entries) {
    const m = e.name.match(ENTRY_RX)
    if (!m) continue
    byType[m[1]] = (byType[m[1]] ?? 0) + 1
    gids.add(gidFromEntry(m))
  }
  console.log(`zip indexed in ${Date.now() - t0}ms: ${zip.entries.length} entries, ${gids.size} gids`)
  console.log('by type:', Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}=${v}`).join(', '))

  const pool = getNeonPool()
  const { rows } = await pool.query(
    `SELECT DISTINCT source_gid, source_type FROM ${CITATION_TABLE}
     WHERE target_act_id IN ('ukpga/2010/25','ukpga/1998/42','ukpga/2010/15','ukpga/2005/4')`)
  const inZip = rows.filter((r: any) => gids.has(r.source_gid))
  console.log(`source docs of the four targets: ${rows.length}; in the zip: ${inZip.length} (${(100*inZip.length/rows.length).toFixed(1)}%)`)
  const missByType: Record<string, number> = {}
  for (const r of rows) if (!gids.has(r.source_gid)) {
    const t = r.source_gid.split('/')[0]; missByType[t] = (missByType[t] ?? 0) + 1
  }
  console.log('missing by gid type:', Object.entries(missByType).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}=${v}`).join(', ') || 'none')

  // are the four target acts themselves in the zip?
  for (const g of ['ukpga/2010/25','ukpga/1998/42','ukpga/2010/15','ukpga/2005/4','ukpga/1998/46','ukpga/1998/47','ukpga/2006/32'])
    console.log(`  target ${g}: ${gids.has(g) ? 'IN ZIP' : 'NOT in zip'}`)
  zip.close()
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
