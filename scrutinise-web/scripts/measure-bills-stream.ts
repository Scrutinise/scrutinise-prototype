/**
 * measure-bills-stream.ts — S2C3 §1, the before-and-after `bills-api` ships with.
 *
 * Same shape as measure-debates-scotland.ts (S2C2 §3), against the LEGISLATION stream this time:
 * gold questions, contamination on questions that plainly want ENACTED law, latency, and what a
 * Bill now renders as.
 *
 * PREDICTION, RECORDED BEFORE THE RUN (the brief's, and mine, which agree): 6,574 sections against
 * a legislation tier of ~15.9M is ~0.04% of the stream's reachable corpus, so no measurable
 * movement on gold and no measurable latency cost. ⚠ Predicting it is not measuring it — and the
 * one place I expect the prediction to be WRONG is contamination on Bill-shaped queries, because
 * BM25 does not know that "Bill" is a status rather than a subject.
 *
 * BEFORE / AFTER:
 *   before — the legislation MAIN LEG alone (tier `legislation`), reproduced from the live
 *            StreamScope, which is exactly what ftsStream did before the extra leg.
 *   after  — STREAMS.legislation.search, i.e. that leg merged with the corpus-only bills leg.
 *
 * ⚠ The gold figures use the ADAPTER's haystack (id + title + citation + snippet), not the body
 * the gold harness reads from Lance. NOT comparable with the gold reports; comparable only with
 * each other, which is all the delta claims.
 *
 * Usage: FTS_SEARCH_URL=… npx tsx --env-file=.env --tsconfig tsconfig.json scripts/measure-bills-stream.ts
 */
import { runFtsSearch } from '../lib/lex/fts-search'
import { STREAMS } from '../lib/lex/query-router'
import { STREAM_SCOPES } from '../lib/lex/stream-scopes'
import { GOLD } from '../../scripts/ingest/search/gold-queries'
import type { SearchResult } from '../lib/lex/page1-config'

if (!process.env.FTS_SEARCH_URL) {
  console.error('FTS_SEARCH_URL is not set — this measures the LIVE retrieval path.')
  process.exit(1)
}

const scope = STREAM_SCOPES.find((s) => s.name === 'legislation')!
const after = STREAMS.find((s) => s.name === 'legislation')!
const BILLS = 'bills-api'
const corpusOf = (id: string) => id.split(':')[0]
const hay = (r: SearchResult) => `${r.id}\n${r.title}\n${r.citation}\n${r.snippet}`
const pct = (n: number, d: number) => (d ? `${(n / d * 100).toFixed(1)}%` : '—')

/** The legislation stream EXACTLY as it stood before the extra leg — the `--pre-fix` mode. */
async function before(query: string, limit: number): Promise<SearchResult[]> {
  const { results } = await runFtsSearch([query], limit, {
    tier: scope.tier, corpora: scope.corpora, excludeCorpora: scope.excludeCorpora,
  })
  return scope.types ? results.filter((r) => scope.types!.includes(r.type)) : results
}

// Questions that plainly want ENACTED law. A Bill appearing high here is contamination: the user
// asked what the law IS, and proposed law is a different (and, if mistaken for law, harmful)
// answer. Deliberately includes two subjects with well-known Bills of the same name, because
// that is the hard case rather than the flattering one.
const WANT_ENACTED = [
  'what does the Data Protection Act 2018 require for automated decisions',
  'current legal duty on landlords to repair rented property',
  'what is the law on online safety duties for search services',
  'statutory duty of local authorities to house homeless applicants',
  'what are the current rules on leasehold ground rent',
  'employment rights on unfair dismissal qualifying period',
]

async function main() {
  console.log(`legislation scope: tier=${scope.tier} extraCorpora=${JSON.stringify(scope.extraCorpora)}`)

  // ── 1. legislation-stream gold questions ──────────────────────────────────
  const gold = (GOLD as any[]).filter((g) => g.metric === 'recall@20' && g.scoreable && String(g.stream).includes('legislation'))
  console.log(`\n=== 1. legislation-stream gold questions (${gold.length}) — adapter haystack, NOT gold-report recall ===`)
  let keysB = 0, keysA = 0
  const lost: string[] = []
  for (const g of gold) {
    const [b, a] = await Promise.all([before(g.query, 20), after.search(g.query, 20)])
    const B = b.slice(0, 20), A = a.slice(0, 20)
    const hits = (rs: SearchResult[]) => g.expected.filter((s: any) => rs.some((r) => s.patterns.some((p: RegExp) => p.test(hay(r)))))
    const kb = hits(B), ka = hits(A)
    keysB += kb.length; keysA += ka.length
    const dropped = kb.filter((k: any) => !ka.includes(k)).map((k: any) => k.label)
    if (dropped.length) lost.push(`${g.id}: ${dropped.join('; ')}`)
    const bills = A.filter((r) => corpusOf(r.id) === BILLS).length
    console.log(`  ${g.id.padEnd(4)} ${kb.length}/${g.expected.length} → ${ka.length}/${g.expected.length}   bills in top-20: ${String(bills).padStart(2)}/20   ${dropped.length ? '⚠ LOST ' + dropped.join('; ') : ''}`)
  }
  const totalKeys = gold.reduce((n: number, g: any) => n + g.expected.length, 0)
  console.log(`  TOTAL ${keysB}/${totalKeys} → ${keysA}/${totalKeys}  (${pct(keysB, totalKeys)} → ${pct(keysA, totalKeys)})`)
  console.log(lost.length ? `  ⚠ KEYS LOST:\n    ${lost.join('\n    ')}` : '  ✓ no answer key stopped being satisfied')

  // ── 2. contamination on questions that want enacted law ───────────────────
  console.log(`\n=== 2. contamination — Bills in the top 20 of a question that plainly wants ENACTED law ===`)
  let billsTotal = 0, slots = 0, displaced = 0, beforeSlots = 0
  for (const q of WANT_ENACTED) {
    const [b, a] = await Promise.all([before(q, 20), after.search(q, 20)])
    const B = b.slice(0, 20), A = a.slice(0, 20)
    const bills = A.filter((r) => corpusOf(r.id) === BILLS)
    const afterIds = new Set(A.map((x) => x.id))
    const pushedOut = B.filter((r) => !afterIds.has(r.id)).length
    billsTotal += bills.length; slots += A.length; beforeSlots += B.length; displaced += pushedOut
    console.log(`  ${q.slice(0, 54).padEnd(54)} ${String(bills.length).padStart(2)}/20 bills · ${String(pushedOut).padStart(2)} displaced` +
      (bills.length ? `\n      top bill: rank ${A.indexOf(bills[0]) + 1} — ${bills[0].title.slice(0, 78)}` : ''))
  }
  console.log(`  CONTAMINATION: ${billsTotal}/${slots} top-20 slots (${pct(billsTotal, slots)}); ` +
    `${displaced}/${beforeSlots} previously-returned rows displaced (${pct(displaced, beforeSlots)})`)

  // ── 3. latency, warm, both orders ─────────────────────────────────────────
  console.log(`\n=== 3. latency — warm, both orders (the standing rule) ===`)
  const LAT = [...WANT_ENACTED, ...gold.map((g: any) => g.query)]
  for (const q of LAT.slice(0, 4)) { await before(q, 20); await after.search(q, 20) }  // warm
  const times: Record<'before' | 'after', number[]> = { before: [], after: [] }
  for (let round = 0; round < 2; round++) {
    const order: Array<'before' | 'after'> = round === 0 ? ['before', 'after'] : ['after', 'before']
    for (const q of LAT) for (const which of order) {
      const t0 = Date.now()
      if (which === 'before') await before(q, 20); else await after.search(q, 20)
      times[which].push(Date.now() - t0)
    }
  }
  const qtl = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }
  for (const w of ['before', 'after'] as const) {
    console.log(`  ${w.padEnd(6)} n=${times[w].length}  p50 ${qtl(times[w], 0.5)}ms  p95 ${qtl(times[w], 0.95)}ms  max ${Math.max(...times[w])}ms`)
  }
  console.log(`  DELTA  p50 ${qtl(times.after, 0.5) - qtl(times.before, 0.5)}ms   p95 ${qtl(times.after, 0.95) - qtl(times.before, 0.95)}ms`)

  // ── 4. can a reader tell a Bill from an Act? ──────────────────────────────
  console.log(`\n=== 4. what a Bill now renders as — the "never mistake a Bill for an Act" requirement ===`)
  const seen = new Map<string, SearchResult>()
  for (const q of ['bill to reform leasehold ground rent', 'proposed law on assisted dying', 'bill on animal welfare', ...WANT_ENACTED]) {
    for (const r of await after.search(q, 20)) if (corpusOf(r.id) === BILLS && !seen.has(r.title)) seen.set(r.title, r)
  }
  const sample = [...seen.values()]
  for (const r of sample.slice(0, 8)) console.log(`  ${r.type.padEnd(6)} ${r.title}\n         ${r.url}`)
  const saysBill = sample.filter((r) => /\bBill\b/i.test(r.title)).length
  const saysStatus = sample.filter((r) => /reading|committee|Royal Assent|became an Act|withdrawn|defeated|stage/i.test(r.title)).length
  const ordinal = sample.filter((r) => /^Bill \d+ — publication/.test(r.title)).length
  console.log(`\n  ${sample.length} distinct Bill titles seen`)
  console.log(`  ${saysBill}/${sample.length} contain the word "Bill"; ${saysStatus}/${sample.length} carry a STAGE or status; ${ordinal}/${sample.length} still show the old ordinal title`)
  console.log(`  every one typed BILL: ${sample.every((r) => r.type === 'BILL')}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
