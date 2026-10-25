import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch } from './fts-core'

const QUERIES: { q: string; expectCorpus: string }[] = [
  { q: 'landlord kick out reason', expectCorpus: 'scottish-parliament-or' },
  { q: 'Competition and Markets Authority merger inquiry', expectCorpus: 'cma-cases' },
  { q: 'early day motion tabled parliament', expectCorpus: 'early-day-motions' },
  { q: 'FCDO treaty ratification', expectCorpus: 'uk-treaties-fcdo' },
]

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  for (const { q, expectCorpus } of QUERIES) {
    const hits = await rankedSearch(tbl, q, { limit: 10 })
    const found = hits.some((h) => h.corpus === expectCorpus)
    console.log(`"${q}" → expect corpus=${expectCorpus}: ${found ? 'FOUND' : 'not in top 10'}`)
    hits.slice(0, 3).forEach((h, i) => console.log(`    ${i + 1}. [${h.corpus}] ${h.id}`))
  }
}
main().then(() => console.log('DONE')).catch((e) => { console.error('FATAL', e); process.exit(1) })
