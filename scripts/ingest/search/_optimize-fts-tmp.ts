import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  console.log('rows before:', await tbl.countRows())
  const t0 = Date.now()
  const stats = await tbl.optimize()
  console.log(`optimize done in ${((Date.now() - t0) / 1000).toFixed(1)}s:`, JSON.stringify((stats as any)?.compaction ?? stats))
  console.log('rows after:', await tbl.countRows())
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
