import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch } from './fts-core'

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  const hits = await rankedSearch(tbl, 'prosecution guidance theft act offences', { limit: 10 })
  console.log('hits:', hits.length)
  for (const h of hits.slice(0, 5)) console.log(' ', h.id, h.corpus, h.score.toFixed(2))
  const found = hits.some((h) => h.corpus === 'cps-guidance')
  console.log(found ? 'PASS — cps-guidance row found via rankedSearch (no reindex needed)' : 'cps-guidance not in top 10 for this query')
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
