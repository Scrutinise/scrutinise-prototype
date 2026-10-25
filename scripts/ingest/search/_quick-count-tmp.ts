import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  const t0 = Date.now()
  const total = await tbl.countRows()
  console.log(`total: ${total} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  const t1 = Date.now()
  const sp = await tbl.countRows(`corpus = 'scottish-parliament-or'`)
  console.log(`scottish-parliament-or: ${sp} (${((Date.now() - t1) / 1000).toFixed(1)}s)`)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
