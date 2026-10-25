import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  console.log(new Date().toISOString(), 'starting delete of corpus=scottish-parliament-or …')
  const t0 = Date.now()
  const res = await tbl.delete(`corpus = 'scottish-parliament-or'`)
  console.log(new Date().toISOString(), `delete done in ${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(res))
  const remaining = await tbl.countRows(`corpus = 'scottish-parliament-or'`)
  console.log(new Date().toISOString(), `remaining scottish-parliament-or rows: ${remaining}`)
  const total = await tbl.countRows()
  console.log(new Date().toISOString(), `total corpus_fts rows now: ${total}`)
}
main().then(() => console.log(new Date().toISOString(), 'DONE')).catch((e) => { console.error(new Date().toISOString(), 'FATAL', e); process.exit(1) })
