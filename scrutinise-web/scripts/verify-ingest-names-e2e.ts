// ─────────────────────────────────────────────────────────────────────────────
// verify-ingest-names-e2e.ts — BRIEF_INGEST_NAMES §2.3 (and the §1.2 display check).
//
// "run three committee questions through the platform's own search and report how many returned
//  results now carry a name. THIS IS THE NUMBER THAT MATTERS — a field populated in the database
//  that never reaches a user is the pattern this project keeps paying for."
//
// So this harness deliberately does NOT read `corpus_sections`. It asks the same gateway a Lex
// turn asks, and looks at what comes back out.
//
// ⚠ IT ALSO WATCHES THE CASE-LAW TITLE, which is the §1.2 half of the same question. The two
// retrievers title a row differently right now:
//
//     dense  (vector-search.ts:172)  `title = meta?.sectionTitle ?? corpusDisplayName(corpus)`
//                                    → reads Neon, so the recovered case name shows IMMEDIATELY
//     BM25   (fts-search.ts:270)     `dbTitleSupersedesIndex(corpus) ? meta… : h.sectionTitle`
//                                    → reads the FTS INDEX, where tna-caselaw's title is the NULL
//                                      it was built with, so it shows the generic collection name
//
// That is exactly the drift `corpus-type-map.ts`'s own comment warns about ("the same row would
// then be titled differently depending on which retriever found it"), and closing it is a
// one-line change in a SEARCH-OWNED file, which this sprint reports rather than makes. The
// harness prints both so the report can state the user-visible position rather than assert it.
//
//   FTS_SEARCH_URL=https://fts-serve-production.up.railway.app \
//   LEX_VECTOR_STREAMS=legislation,caselaw,guidance LEX_QUERY_ROUTER=true \
//     npx tsx --env-file=.env scripts/verify-ingest-names-e2e.ts
// ─────────────────────────────────────────────────────────────────────────────
import { retrieveForChat } from '../lib/lex/chat-retrieval'
import { assertRetrievalConfig, resolvedConfigLine, readServiceConfig, servedDelta } from '../lib/lex/harness-preflight'
import { attributionLine } from '../lib/lex/attribution'

export {}

/** §2.3's three committee questions. Two are S5/S8 probes, so the before/after is comparable. */
const COMMITTEE_PROBES = [
  'what have select committees said about water company sewage discharge',
  'what evidence did witnesses give on leasehold reform',
  'has parliament scrutinised the rollout of universal credit',
]

/** §1.2's display check — questions that should surface a judgment. */
const CASELAW_PROBES = [
  'how have the courts interpreted the duty to make reasonable adjustments',
  'supreme court judgment on prorogation of parliament',
  'court ruling on whether gig economy workers are employees',
]

const pct = (a: number, b: number) => (b === 0 ? '—' : `${((100 * a) / b).toFixed(0)}%`)

async function main() {
  // ⚠ allowDegraded is NOT set: a degraded run would understate every rate below and the
  // understatement would look like the sprint not having worked.
  assertRetrievalConfig('verify-ingest-names-e2e')
  const before = await readServiceConfig()
  console.log(resolvedConfigLine())
  for (const s of before) console.log(`[readback:before] ${s.name} ${s.reachable ? 'OK' : 'UNREACHABLE'} ${s.detail}`)

  // ── §2.3 — committee questions ─────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(96)}\n§2.3 — THREE COMMITTEE QUESTIONS THROUGH THE PLATFORM'S OWN SEARCH\n${'═'.repeat(96)}`)
  let cTotal = 0, cAttr = 0, committeeHits = 0, committeeAttr = 0
  for (const q of COMMITTEE_PROBES) {
    const r = await retrieveForChat({ query: q, limit: 10 })
    const withAttr = r.evidence.filter(e => e.attribution).length
    cTotal += r.evidence.length; cAttr += withAttr
    const committee = r.evidence.filter(e => String(e.kind) === 'COMMITTEE')
    committeeHits += committee.length
    committeeAttr += committee.filter(e => e.attribution).length
    console.log(`\nQ: ${q}`)
    console.log(`   evidence ${r.evidence.length} · with a name ${withAttr} (${pct(withAttr, r.evidence.length)})`
      + ` · COMMITTEE results ${committee.length}, named ${committee.filter(e => e.attribution).length}`
      + `${r.failed ? '  ⚠ SEARCH FAILED' : ''}`)
    for (const e of r.evidence.slice(0, 5)) {
      console.log(`     [${e.kindLabel}] ${e.title.slice(0, 76)}`)
      console.log(`        ${attributionLine(e.attribution) ?? '(no name held for this collection)'}`)
    }
  }

  // ── §1.2 — does the recovered case name reach a result title? ──────────────────────────────
  console.log(`\n${'═'.repeat(96)}\n§1.2 — DOES THE RECOVERED CASE NAME REACH THE RESULT TITLE?\n${'═'.repeat(96)}`)
  let caseHits = 0, caseNamed = 0
  const GENERIC = /^(case law|judgments?|find case law|tna-caselaw)$/i
  for (const q of CASELAW_PROBES) {
    const r = await retrieveForChat({ query: q, limit: 10 })
    const cases = r.evidence.filter(e => String(e.kind) === 'CASE_LAW')
    caseHits += cases.length
    const named = cases.filter(e => e.title && !GENERIC.test(e.title.trim()))
    caseNamed += named.length
    console.log(`\nQ: ${q}`)
    console.log(`   CASE_LAW results ${cases.length}, carrying a case NAME rather than a generic label ${named.length}`)
    for (const e of cases.slice(0, 5)) console.log(`     · ${e.title.slice(0, 90)}`)
  }

  const after = await readServiceConfig()
  for (const s of after) console.log(`\n[readback:after ] ${s.name} ${s.reachable ? 'OK' : 'UNREACHABLE'} ${s.detail}`)
  console.log(`[engagement] ${servedDelta(before, after)}`)

  console.log(`\n${'═'.repeat(96)}\nRESULT`)
  console.log(`  §2.3  committee questions: ${cAttr}/${cTotal} of ALL evidence results carry a name (${pct(cAttr, cTotal)})`)
  console.log(`  §2.3  of the COMMITTEE results specifically: ${committeeAttr}/${committeeHits} named (${pct(committeeAttr, committeeHits)})`)
  console.log(`  §1.2  case-law results carrying a case name: ${caseNamed}/${caseHits} (${pct(caseNamed, caseHits)})`)
  console.log(`\n${resolvedConfigLine()}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
