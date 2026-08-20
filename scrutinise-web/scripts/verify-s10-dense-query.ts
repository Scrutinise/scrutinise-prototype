/**
 * verify-s10-dense-query.ts — BRIEF_SEARCH_S10 §6.1, ASSERTED LIVE RATHER THAN READ.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE QUESTION §6.1 ASKS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * "The router rewrites the question per stream before retrieval. Confirm whether the vector leg
 * embeds the REWRITTEN, stream-specific query or the raw user text. If it is the raw text, that is
 * a large improvement available for very little work — and it may also explain part of the debates
 * result, since a raw conversational question is exactly the input a dense retriever handles worst
 * on a huge conversational collection."
 *
 * ⚠ THE CODE SAYS IT IS THE REWRITTEN QUERY. `fusedStream(query, limit)` receives
 * `route[s.name]` — the stream's own tailored string — and passes that SAME `query` variable to
 * both `bm25Only(query, …)` and `runVectorSearch([query], …)`. There is no path in `fusedStream`
 * where the two legs see different text.
 *
 * ⚠⚠ AND THAT IS EXACTLY THE KIND OF CLAIM docs/CLAUDE.md §0 SAYS TO VERIFY RATHER THAN ASSERT.
 * A reading of a call chain is a claim about behaviour, not an observation of it. So this runs one
 * real routed search with a sink installed on the production leg-capture seam and reads back what
 * the dense leg was actually handed. The negative control matters as much as the positive one: the
 * captured query must differ from the raw user text, otherwise "it embeds the rewritten query"
 * would pass trivially on a question the router happened to rewrite into itself.
 *
 * Usage:  FTS_SEARCH_URL=… LEX_QUERY_ROUTER=true npx tsx --env-file=.env scripts/verify-s10-dense-query.ts
 */
import { runSearch } from '../lib/lex/search-gateway'
import { routeQuery } from '../lib/lex/query-expansion'
import { captureLegs, type CapturedLegs } from '../lib/lex/query-router'

export {}

// A deliberately conversational question — the shape §6.1 says a dense retriever handles worst,
// and the shape a router rewrite exists to fix.
const QUESTION = 'why do water companies keep getting away with dumping sewage in rivers'

async function main() {
  console.log('═'.repeat(96))
  console.log('S10 §6.1 — DOES THE DENSE LEG EMBED THE REWRITTEN QUERY OR THE RAW USER TEXT?')
  console.log('═'.repeat(96))
  console.log(`  raw question: "${QUESTION}"`)

  const keywords = QUESTION.split(/\s+/).filter(Boolean)
  // Roll the route separately FIRST so the expected per-stream strings are known independently of
  // what the capture reports. Comparing the capture against itself would prove nothing.
  const route = await routeQuery(keywords, '')
  if (!route) { console.error('  router failed open — cannot run this verification. Re-run.'); process.exit(1) }
  console.log('\n  the router\'s tailored query per stream:')
  for (const [s, q] of Object.entries(route)) console.log(`    ${s.padEnd(14)} "${q}"`)

  // Dense on for every stream, so every routed stream produces a dense leg to inspect.
  process.env.LEX_VECTOR_STREAMS = 'legislation,debates,committees,caselaw,guidance'
  const captured: CapturedLegs[] = []
  const uninstall = captureLegs((l) => captured.push(l))
  try {
    await runSearch({ keywords, intent: 'GENERAL_CORPUS_CHAT', limit: 20 })
  } finally { uninstall() }

  console.log('\n  what each stream\'s legs were actually handed (read off the production path):')
  // ⚠⚠ THE COMPARISON IS *NOT* AGAINST THE ROUTE ROLLED ABOVE, AND THE FIRST DRAFT OF THIS SCRIPT
  // GOT THAT WRONG. `routeQuery` is an LLM call and it re-rolls: the standalone roll said debates
  // "…enforcement failures" and the roll inside `runSearch` said "…enforcement fines". Comparing
  // the capture against a separately-rolled route therefore reports "neither" on a perfectly
  // correct rewrite, and would have been read as a defect.
  //
  // The load-bearing test needs neither roll to match. "The dense leg embeds the RAW USER TEXT"
  // makes two predictions that the capture can falsify on its own:
  //   1. the captured query EQUALS the raw question, and
  //   2. every stream gets the SAME string, since there is only one raw question.
  // Five streams receiving five DIFFERENT strings, none of them the raw text, refutes both at once
  // and does not depend on which roll produced them.
  const rawJoined = keywords.join(' ')
  let raw = 0
  for (const l of captured) {
    const isRaw = l.query.trim().toLowerCase() === rawJoined.trim().toLowerCase()
    if (isRaw) raw++
    const expected = (route as Record<string, string | undefined>)[l.stream]
    const sameRoll = !!expected && l.query.trim() === expected.trim()
    console.log(`    ${l.stream.padEnd(14)} "${l.query}"`)
    console.log(`      ${isRaw ? '✗ THE RAW USER TEXT' : '✓ a stream-specific rewrite'}   ${sameRoll ? '(identical to the standalone roll)' : '(differs from the standalone roll — the router re-rolled; expected, not a defect)'}   bm25 ${l.bm25.length} · dense ${l.vector.length}`)
  }

  console.log('\n' + '═'.repeat(96))
  const distinct = new Set(captured.map((l) => l.query.trim().toLowerCase()))
  console.log(`  streams captured: ${captured.length}   handed the RAW question: ${raw}   distinct query strings: ${distinct.size}`)
  // ⚠ THE CONTROL. If every rewrite happened to equal the raw text, "it uses the rewrite" and "it
  // uses the raw text" would be the same observation and this run would prove nothing.
  const anyDifferent = captured.some((l) => l.query.trim().toLowerCase() !== rawJoined.trim().toLowerCase())
  console.log(`  control — at least one captured query genuinely differs from the raw text: ${anyDifferent ? '✓ yes' : '✗ NO — this run proves nothing, pick a different question'}`)
  if (!anyDifferent) process.exit(1)

  const proven = raw === 0 && distinct.size === captured.length && captured.length > 1
  console.log('\n  ▶ FINDING: ' + (proven
    ? 'the dense leg ALREADY embeds the rewritten, STREAM-SPECIFIC query. Every routed stream was\n' +
      '    handed a different string and not one of them was the raw question — which the raw-text\n' +
      '    hypothesis cannot produce. §6.1\'s hypothesis is REFUTED for the routed path: the improvement\n' +
      '    it hoped for is already banked, and it cannot be part of the debates explanation.'
    : `NOT PROVEN — ${raw} stream(s) received the raw question and ${captured.length - distinct.size} duplicate string(s) were handed out. §6.1's improvement may be real; investigate.`))
  console.log('\n  ⚠ SCOPE OF THE FINDING. This covers the ROUTED path, which is what production runs.')
  console.log('    The gateway\'s legacy whole-query fusion (step 4b, reachable only with')
  console.log('    LEX_SEARCH_VECTOR=true AND LEX_VECTOR_STREAMS unset) fuses ONE unscoped dense')
  console.log('    ranking built from the bare/expansion-widened keywords — there is no per-stream')
  console.log('    rewrite on that path because there are no per-stream queries on it. That branch is')
  console.log('    superseded and logs loudly when reached; it is named here so the finding is not')
  console.log('    read as covering it.')
}

main().catch((e) => { console.error(e); process.exit(1) })
