/** Are the roll-calls retrievable at all, or just out-ranked? Ask three ways. */
import { runFtsSearch } from '../lib/lex/fts-search'
import { STREAMS } from '../lib/lex/query-router'
const corpusOf = (id: string) => id.split(':')[0]
const DIV = ['commons-divisions-votes', 'lords-divisions-votes']
async function main() {
  // 1. corpus-scoped: is the row in the index and reachable by the adapter at all?
  for (const c of DIV) {
    const { results } = await runFtsSearch(['assisted dying bill division ayes noes'], 20, { corpora: [c] })
    console.log(`\n[corpus-scoped ${c}] ${results.length} hits`)
    for (const r of results.slice(0, 3)) console.log(`   ${r.type.padEnd(9)} ${r.title.slice(0, 88)}`)
  }
  // 2. tier-scoped exactly as the debates stream does it
  const debates = STREAMS.find((s) => s.name === 'debates')!
  for (const q of ['how did MPs vote on the assisted dying bill', 'division ayes noes employment rights bill lords contents']) {
    const rs = await debates.search(q, 20)
    const d = rs.filter((r) => DIV.includes(corpusOf(r.id)))
    console.log(`\n[debates stream] "${q.slice(0, 52)}" → ${rs.length} hits, ${d.length} divisions`)
    console.log(`   top corpora: ${[...new Set(rs.slice(0, 8).map((r) => corpusOf(r.id)))].join(', ')}`)
    if (d.length) console.log(`   first division: rank ${rs.indexOf(d[0]) + 1} — ${d[0].title.slice(0, 80)}`)
  }
  // 3. unscoped — does anything at all surface them?
  const { results } = await runFtsSearch(['assisted dying bill division ayes noes'], 40, {})
  console.log(`\n[unscoped] ${results.length} hits, ${results.filter((r) => DIV.includes(corpusOf(r.id))).length} divisions`)
}
main().catch((e) => { console.error(e); process.exit(1) })
