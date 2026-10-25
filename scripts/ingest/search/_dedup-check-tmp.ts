import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  const rows = await tbl.query().where(`corpus = 'scottish-parliament-or'`).select(['id']).toArray() as { id: string }[]
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.id, (counts.get(r.id) ?? 0) + 1)
  const dupes = [...counts.entries()].filter(([, n]) => n > 1)
  console.log(`total rows: ${rows.length}, distinct ids: ${counts.size}, duplicate ids: ${dupes.length}, extra rows from dupes: ${rows.length - counts.size}`)
  for (const [id, n] of dupes.slice(0, 5)) console.log(`  ${id} x${n}`)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
