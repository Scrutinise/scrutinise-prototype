import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch } from './fts-core'

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  const id = 'scottish-parliament-or:arch-10199:48'
  const hits = await rankedSearch(tbl, 'landlord agent evict without specific reason David Cox', { limit: 200 })
  const rank = hits.findIndex((h) => h.id === id)
  console.log(`candidate pool size: ${hits.length}, target rank: ${rank >= 0 ? rank + 1 : 'NOT FOUND in top 200'}`)

  // raw FTS query, no boosts, larger net
  const raw = await tbl.search('David Cox landlord evict', 'fts', 'body').limit(500).toArray() as any[]
  const rawRank = raw.findIndex((r) => r.id === id)
  console.log(`raw FTS (no boosts) candidate pool: ${raw.length}, target rank: ${rawRank >= 0 ? rawRank + 1 : 'NOT FOUND in top 500'}`)

  // direct existence + body check
  const direct = await tbl.query().where(`id = '${id}'`).select(['id', 'body', 'tier', 'corpus']).toArray() as any[]
  console.log('direct row lookup:', direct.length ? JSON.stringify({ id: direct[0].id, tier: direct[0].tier, corpus: direct[0].corpus, bodyLen: direct[0].body.length }) : 'NOT FOUND')
}
main().then(() => console.log('DONE')).catch((e) => { console.error('FATAL', e); process.exit(1) })
