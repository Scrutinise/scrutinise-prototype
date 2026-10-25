import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch } from './fts-core'

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)

  // pull one real row's body from each corpus, then search on a distinctive phrase from it
  const targets = [
    { id: 'scottish-parliament-or:arch-10199:48', corpus: 'scottish-parliament-or' },
  ]
  const cmaRows = await tbl.query().where(`corpus = 'cma-cases'`).limit(1).select(['id', 'body']).toArray() as any[]
  const edmRows = await tbl.query().where(`corpus = 'early-day-motions'`).limit(1).select(['id', 'body']).toArray() as any[]

  for (const t of targets) {
    const rows = await tbl.query().where(`id = '${t.id}'`).select(['id', 'body']).toArray() as any[]
    if (!rows.length) { console.log(`${t.id}: NOT FOUND in corpus_fts`); continue }
    const body = rows[0].body as string
    const phrase = body.slice(0, 60).trim()
    console.log(`${t.id} body starts: "${phrase}"`)
    const hits = await rankedSearch(tbl, phrase, { limit: 10 })
    const found = hits.some((h) => h.id === t.id)
    console.log(`  rankedSearch on that exact phrase → ${found ? `FOUND at rank ${hits.findIndex((h) => h.id === t.id) + 1}` : 'NOT in top 10'}`)
  }

  if (cmaRows.length) {
    const phrase = (cmaRows[0].body as string).slice(0, 60).trim()
    console.log(`${cmaRows[0].id} body starts: "${phrase}"`)
    const hits = await rankedSearch(tbl, phrase, { limit: 10 })
    const found = hits.some((h) => h.id === cmaRows[0].id)
    console.log(`  rankedSearch on that exact phrase → ${found ? `FOUND at rank ${hits.findIndex((h) => h.id === cmaRows[0].id) + 1}` : 'NOT in top 10'}`)
  }
  if (edmRows.length) {
    const phrase = (edmRows[0].body as string).slice(0, 60).trim()
    console.log(`${edmRows[0].id} body starts: "${phrase}"`)
    const hits = await rankedSearch(tbl, phrase, { limit: 10 })
    const found = hits.some((h) => h.id === edmRows[0].id)
    console.log(`  rankedSearch on that exact phrase → ${found ? `FOUND at rank ${hits.findIndex((h) => h.id === edmRows[0].id) + 1}` : 'NOT in top 10'}`)
  }
}
main().then(() => console.log('DONE')).catch((e) => { console.error('FATAL', e); process.exit(1) })
