import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  console.log(new Date().toISOString(), 'fetching scottish-parliament-or ids…')
  const t0 = Date.now()
  const rows = await tbl.query().where(`corpus = 'scottish-parliament-or'`).select(['id']).toArray() as { id: string }[]
  console.log(new Date().toISOString(), `fetched ${rows.length} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.id, (counts.get(r.id) ?? 0) + 1)
  const dupes = [...counts.entries()].filter(([, n]) => n > 1)
  console.log(new Date().toISOString(), `total rows: ${rows.length}, distinct ids: ${counts.size}, duplicate ids: ${dupes.length}, extra rows from dupes: ${rows.length - counts.size}`)
  for (const [id, n] of dupes.slice(0, 5)) console.log(`  ${id} x${n}`)
}
main().then(() => console.log(new Date().toISOString(), 'DONE')).catch((e) => { console.error(new Date().toISOString(), 'FATAL', e); process.exit(1) })
