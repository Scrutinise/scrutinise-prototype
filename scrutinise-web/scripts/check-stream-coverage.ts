/**
 * check-stream-coverage.ts — the §1 invariant, asserted against the REAL runSearch.
 *
 *   For a query routed to N streams, the context handed to the answer call contains at least
 *   one document from EVERY stream that returned hits.
 *
 * WHY THIS IS A CHECK AND NOT A COMMENT. Until 9 Aug the routed path ended `perStream.flat()`,
 * so the answer context (`results.slice(0, 16)`) landed entirely inside the first stream. Four
 * streams were routed, retrieved, counted, shown in the source panel — and dropped before the
 * answer was written. Nothing failed, nothing logged, and the only symptom was Lex saying the
 * sources contained nothing on select committees while the committees stream had returned hits.
 * A failure that looks like an answer needs an invariant, not a code comment.
 *
 * PROVE IT CAN FAIL. `--pre-fix` re-creates the old behaviour by concatenating the per-stream
 * lists in stream order instead of interleaving them, and asserts the check REPORTS THE FAILURE.
 * A check only trusted when it passes is not evidence. Run both:
 *
 *   npx tsx --tsconfig tsconfig.json scripts/check-stream-coverage.ts --pre-fix   (must FAIL)
 *   npm run check:stream-coverage                                                 (must PASS)
 *
 * Env: `--env-file=.env` supplies DATABASE_URL and GEMINI_API_KEY; the rest are passed inline.
 *   FTS_SEARCH_URL LEX_QUERY_ROUTER=true
 *
 * ⚠ It must be `--env-file`, NOT a `require('dotenv')` at the top of this file. TypeScript hoists
 * every `import` above ordinary statements, so a dotenv call here runs AFTER lib/lex/fts-search.ts
 * has already read FTS_SEARCH_URL and after the Prisma client has been constructed without
 * DATABASE_URL. The first run of this script did exactly that: five identical
 * "Invalid prisma.$queryRaw() invocation" lines with an EMPTY message, every stream returning
 * zero hits, and a check that reported "vacuous" rather than "misconfigured".
 */
import { runSearch } from '../lib/lex/search-gateway'
import { interleaveStreams } from '../lib/lex/interleave'
import type { SearchResult } from '../lib/lex/page1-config'

/** The answer-context budget general-chat.ts uses. Read from the same env var so the two cannot
 *  drift; the check must measure the budget the app actually applies. */
const BUDGET = (() => {
  const raw = parseInt(process.env.LEX_GENERAL_CONTEXT_LIMIT ?? '', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 16
})()

const PRE_FIX = process.argv.includes('--pre-fix')

/**
 * Queries chosen to route WIDE — each plainly implicates law, Parliament, committee scrutiny and
 * regulator practice at once. A single-stream query cannot exercise this invariant: if the router
 * names one stream, "every stream reached the context" is true by construction.
 */
const QUERIES = [
  'what have select committees said about the regulation of buy now pay later lending',
  'how has Parliament scrutinised the Online Safety Act and what does Ofcom require',
  'what does the law and the case law say about landlord possession under section 21',
  'what is the current legal and regulatory position on water company sewage discharges',
]

let passed = 0
const failures: string[] = []
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

/** The pre-fix ordering: streams concatenated in dispatch order, exactly as `perStream.flat()`. */
function flatConcat(perStream: Array<{ stream: string; ids: string[] }>, all: SearchResult[]): SearchResult[] {
  const byId = new Map(all.map((r) => [r.id, r]))
  const out: SearchResult[] = []
  for (const s of perStream) for (const id of s.ids) { const r = byId.get(id); if (r) out.push(r) }
  return out
}

async function main() {
  for (const v of ['FTS_SEARCH_URL', 'GEMINI_API_KEY']) {
    if (!process.env[v]) { console.error(`${v} is not set — this asserts against the LIVE retrieval path and cannot run without it.`); process.exit(1) }
  }
  if (process.env.LEX_QUERY_ROUTER !== 'true') {
    console.error('LEX_QUERY_ROUTER must be true — with the router off there is one unfiltered stream and the invariant is vacuous.')
    process.exit(1)
  }

  console.log(`stream coverage — every routed stream that returned hits must reach the answer context`)
  console.log(`budget=${BUDGET}  ordering=${PRE_FIX ? 'PRE-FIX flat concatenation (must fail)' : 'interleaved (must pass)'}\n`)

  let routedQueries = 0
  for (const q of QUERIES) {
    console.log(`\n"${q.slice(0, 78)}"`)
    const out = await runSearch({ keywords: q.split(/\s+/).filter(Boolean), intent: 'GENERAL_CORPUS_CHAT', limit: 16 })

    const perStream = out.meta.perStream
    if (!perStream?.length) {
      // A fail-open is a routing failure, not a coverage failure — reported, and it does not
      // silently make the run look green either. §2's exit criterion is where that is scored.
      console.log(`  · router did not dispatch (fail-open) — no streams to cover. Not counted.`)
      continue
    }
    const withHits = perStream.filter((s) => s.ids.length > 0)
    console.log(`  routed: ${perStream.map((s) => `${s.stream}=${s.ids.length}`).join(' ')}`)
    if (withHits.length === 0) {
      // Not "vacuous" — this is retrieval being broken, and the two must not read the same. The
      // first run of this script showed exactly this and called it vacuous, which is how a
      // misconfigured harness gets mistaken for a corpus with nothing in it.
      console.log(`  ✗ EVERY routed stream returned 0 hits — retrieval is not working (FTS_SEARCH_URL / DATABASE_URL), this is not a coverage result`)
      failures.push(`retrieval returned nothing at all for "${q.slice(0, 50)}"`)
      continue
    }
    if (withHits.length < 2) {
      console.log(`  · only ${withHits.length} stream returned hits — the invariant is vacuous here. Not counted.`)
      continue
    }
    routedQueries++

    const ordered = PRE_FIX ? flatConcat(perStream, out.results) : out.results
    const context = ordered.slice(0, BUDGET)
    const inContext = new Set(context.map((r) => r.id))
    const covered = withHits.filter((s) => s.ids.some((id) => inContext.has(id)))
    const missing = withHits.filter((s) => !s.ids.some((id) => inContext.has(id)))

    console.log(`  context: ${context.length} docs · ${covered.map((s) => `${s.stream}=${s.ids.filter((id) => inContext.has(id)).length}`).join(' ')}`)
    ok(`every stream with hits reaches the context (${covered.length}/${withHits.length})`,
       missing.length === 0,
       missing.length ? `absent from the answer: ${missing.map((s) => `${s.stream}(${s.ids.length} hits)`).join(', ')}` : '')

    // The floor. Not a separate invariant so much as the reason the first one is worth having:
    // a stream represented by a single document reads to the user as a stream that found nothing.
    const thin = covered.filter((s) => s.ids.filter((id) => inContext.has(id)).length < 2 && s.ids.length >= 2)
    if (thin.length) console.log(`     ⚠ represented by a single document: ${thin.map((s) => s.stream).join(', ')} (budget ${BUDGET} over ${withHits.length} streams)`)
  }

  if (!routedQueries) {
    console.error('\nNo query routed to 2+ streams with hits — this run asserted NOTHING. Treating as a failure rather than a pass.')
    process.exit(1)
  }

  console.log(`\n${passed} passed, ${failures.length} failed  (over ${routedQueries} multi-stream quer${routedQueries === 1 ? 'y' : 'ies'})`)
  if (PRE_FIX) {
    // Inverted on purpose: the point of this mode is to show the check has teeth.
    if (failures.length) { console.log('\nPRE-FIX MODE: the check FAILED, as it must. It can detect the bug.'); process.exit(0) }
    console.error('\nPRE-FIX MODE: the check PASSED against the old flat concatenation — it cannot detect the bug it exists for.')
    process.exit(1)
  }
  if (failures.length) { failures.forEach((f) => console.error(`  FAILED: ${f}`)); process.exit(1) }
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
