/**
 * a4-duplication-proof.ts — CENSUS C1 Part A4. PROVE THE DUPLICATION THROUGH RETRIEVAL.
 *
 * READ-ONLY.
 *
 * A4 requires each duplicated pair to be proved "with one concrete duplicated item returned by
 * `runSearch()` — the returned `corpus_key` on screen, not an absence of errors." So this calls the
 * real gateway, untiered, and prints the corpus of every hit. A pair is proved when one query
 * returns the same content from BOTH members.
 *
 * ⚠⚠ AND "BOTH COLLECTIONS ANSWERED THE QUERY" IS NOT DUPLICATION. The first run of this file
 * marked the two Hansard pairs ✅ DUPLICATED on exactly that basis, and it was wrong. The returned
 * items were a 1950s Lords exchange and a 2021 Commons one — two collections answering a generic
 * parliamentary phrase, which any two parliamentary collections will. The day-level join settles
 * it and says the opposite:
 *
 *   Commons: historic-hansard S5CV ends 1918-11-21 · pwdata-debates begins 1919-02-04 → 0 shared days
 *   Lords:   historic-hansard S5LV ends 1999-11-11 · pwdata-lords   begins 1999-11-17 → 0 shared days
 *
 * The collections ABUT. There is no Hansard duplication. An earlier count of "8,697 shared sitting
 * days" was itself an artefact — it compared historic-hansard's LORDS volumes against pwdata's
 * COMMONS stream, i.e. two Houses sitting on the same calendar dates, which is not the same debate.
 * Duplication has to be proved on the ITEM, and the only pairs here that survive that test are
 * Commons divisions and treaties.
 *
 * ⚠ IT MUST BE ABLE TO FAIL, and a control pair is included for that: a query whose subject exists
 * in only one of the two collections must come back from one corpus only. Without it, "both corpora
 * appeared" could just mean the query was broad enough to hit anything.
 *
 * Usage:
 *   FTS_SEARCH_URL=… LEX_QUERY_ROUTER=true LEX_VECTOR_STREAMS=legislation \
 *     npx tsx census/a4-duplication-proof.ts
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })

const FTS = (process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production.up.railway.app').replace(/\/$/, '')
const OUT = path.join(__dirname, '../../../docs/census/A4_duplication.json')

interface Pair { name: string; a: string; b: string; query: string; note: string }

const PAIRS: Pair[] = [
  { name: 'Hansard Commons', a: 'historic-hansard', b: 'pwdata-debates',
    query: 'the Prime Minister was asked about the situation in Northern Ireland internment',
    note: 'NOT duplicated — 0 shared sitting days. S5CV ends 1918-11-21, pwdata-debates begins 1919-02-04. Both answering this query is query breadth, not duplication.' },
  { name: 'Hansard Lords', a: 'historic-hansard', b: 'pwdata-lords',
    query: 'My Lords, I beg to move that this Bill be now read a second time',
    note: 'NOT duplicated — 0 shared sitting days. S5LV ends 1999-11-11, pwdata-lords begins 1999-11-17.' },
  { name: 'Commons divisions', a: 'lda-commonsdivisions', b: 'commons-divisions-votes',
    query: 'division ayes noes European Union Withdrawal Agreement', note: '' },
  { name: 'Lords divisions', a: 'lda-lordsdivisions', b: 'lords-divisions-votes',
    query: 'contents not contents division on the amendment', note: '' },
  { name: 'Treaties', a: 'uk-treaties', b: 'uk-treaties-fcdo',
    query: 'agreement between the government of the United Kingdom and the government concerning air services',
    note: '' },
  { name: 'Written answers (retired)', a: 'lda-lordswrittenquestions', b: 'pwdata-lordswrans',
    query: 'to ask Her Majesty\'s Government what representations they have made to the government of China',
    note: 'retired collection still live in the index' },
]

/** CONTROL: a subject that exists in only one of a pair. Must return ONE corpus, or the method is
 *  measuring query breadth rather than duplication. */
const CONTROL = {
  name: 'CONTROL — a subject in only one collection',
  a: 'et-decisions', b: 'pwdata-debates',
  query: 'unfair dismissal claimant respondent tribunal judgment reasons employment judge sitting alone',
  expectOnly: 'et-decisions',
}

async function search(query: string, corpora?: string[], limit = 30) {
  const res = await fetch(`${FTS}/fts-search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit, ...(corpora ? { corpora } : {}) }),
  })
  if (!res.ok) throw new Error(`FTS ${res.status}`)
  const j = await res.json() as { results?: Array<{ id: string; corpus: string; sectionTitle: string | null; snippet: string }> }
  return j.results ?? []
}

async function main() {
  const out: Record<string, unknown>[] = []
  console.log('=== A4 — DUPLICATION, PROVED THROUGH RETRIEVAL ===\n')

  for (const p of PAIRS) {
    // Scope to exactly the two members so the question is "do BOTH answer", not "who ranks".
    const hits = await search(p.query, [p.a, p.b], 30)
    const fromA = hits.filter(h => h.corpus === p.a)
    const fromB = hits.filter(h => h.corpus === p.b)
    // ⚠ Both answering is necessary but NOT sufficient — see the header. Item-level duplication is
    // asserted in the report only where the same document was found on both sides by hand.
    const proved = fromA.length > 0 && fromB.length > 0
    out.push({ pair: p.name, a: p.a, b: p.b, query: p.query, fromA: fromA.length, fromB: fromB.length, proved })
    console.log(`${proved ? '◐ both answered' : '—  one side only'}  ${p.name}`)
    console.log(`   query: "${p.query.slice(0, 78)}"`)
    console.log(`   ${p.a.padEnd(28)} ${fromA.length} hits`)
    console.log(`   ${p.b.padEnd(28)} ${fromB.length} hits`)
    if (proved) {
      console.log(`   e.g. ${fromA[0].corpus} :: ${fromA[0].id}`)
      console.log(`        "${(fromA[0].snippet ?? '').replace(/\s+/g, ' ').slice(0, 96)}"`)
      console.log(`        ${fromB[0].corpus} :: ${fromB[0].id}`)
      console.log(`        "${(fromB[0].snippet ?? '').replace(/\s+/g, ' ').slice(0, 96)}"`)
    }
    if (p.note) console.log(`   note: ${p.note}`)
    console.log('')
  }

  const ch = await search(CONTROL.query, [CONTROL.a, CONTROL.b], 30)
  const cA = ch.filter(h => h.corpus === CONTROL.a).length
  const cB = ch.filter(h => h.corpus === CONTROL.b).length
  const controlOk = cA > 0 && cB === 0
  out.push({ pair: CONTROL.name, a: CONTROL.a, b: CONTROL.b, fromA: cA, fromB: cB, controlOk })
  console.log(`${controlOk ? '✅' : '⚠'}  ${CONTROL.name}`)
  console.log(`   ${CONTROL.a} ${cA} hits · ${CONTROL.b} ${cB} hits — expected hits from ${CONTROL.expectOnly} only`)
  if (!controlOk) console.log('   ⚠ THE CONTROL DID NOT HOLD. "Both corpora appeared" above may be query breadth, not duplication.')

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), results: out }, null, 1))
  console.log(`\n[A4] → ${OUT}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
