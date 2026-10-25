import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'

const CORPORA = ['scottish-parliament-or', 'cma-cases', 'early-day-motions']

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  for (const corpus of CORPORA) {
    const t0 = Date.now()
    const rows = await tbl.query().where(`corpus = '${corpus}'`).select(['id']).toArray() as { id: string }[]
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(r.id, (counts.get(r.id) ?? 0) + 1)
    const dupes = [...counts.entries()].filter(([, n]) => n > 1)
    console.log(new Date().toISOString(), `${corpus}: total=${rows.length} distinct=${counts.size} dupeIds=${dupes.length} extraRows=${rows.length - counts.size} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
    for (const [id, n] of dupes.slice(0, 3)) console.log(`    ${id} x${n}`)
  }
}
main().then(() => console.log(new Date().toISOString(), 'DONE')).catch((e) => { console.error(new Date().toISOString(), 'FATAL', e); process.exit(1) })
