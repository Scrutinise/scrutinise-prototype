/**
 * measure-debates-scotland.ts — S2C2 §3, the before-and-after that `scottish-parliament-or`
 * ships with, or does not ship at all.
 *
 * WHY THIS IS A SCRIPT AND NOT A CONFIG LINE. The collection is 1,044,188 sections — 86% of the
 * whole reachability gap S2C measured — and adding it changes what the debates stream returns for
 * EVERY query, not only for Scottish ones. Charlie's instruction was explicit: it ships with a
 * before-and-after or not at all.
 *
 * BEFORE / AFTER, defined precisely:
 *   before — the debates MAIN LEG alone: tier `parliamentary`, types ['DEBATE'], the
 *            NON_DEBATE_PARLIAMENTARY exclusion. Reproduced here from the LIVE StreamScope
 *            (imported, never copied), which is exactly what `ftsStream` did before the extra leg.
 *   after  — `STREAMS.debates.search`, i.e. that leg merged with the corpus-only Scottish leg.
 *
 * ⚠ WHAT THE RECALL NUMBERS HERE ARE AND ARE NOT. The gold harness matches answer-key patterns
 * against `id + sectionTitle + BODY`, read straight from Lance. This runs through the product
 * adapter, which carries a SNIPPET, not the body — a strictly weaker haystack. So these figures
 * are NOT comparable with the gold reports and must never be quoted as recall@20. They are
 * comparable with EACH OTHER, because both configurations get the identical haystack, and the
 * delta is the only thing being claimed.
 *
 * Usage:  FTS_SEARCH_URL=… npx tsx --env-file=.env --tsconfig tsconfig.json scripts/measure-debates-scotland.ts
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

const scope = STREAM_SCOPES.find((s) => s.name === 'debates')!
const after = STREAMS.find((s) => s.name === 'debates')!
const SCOT = 'scottish-parliament-or'
const corpusOf = (id: string) => id.split(':')[0]

/** The debates stream EXACTLY as it stood before the extra leg — the `--pre-fix` mode. */
async function before(query: string, limit: number): Promise<SearchResult[]> {
  const { results } = await runFtsSearch([query], limit, {
    tier: scope.tier, corpora: scope.corpora, excludeCorpora: scope.excludeCorpora,
  })
  return scope.types ? results.filter((r) => scope.types!.includes(r.type)) : results
}

const hay = (r: SearchResult) => `${r.id}\n${r.title}\n${r.citation}\n${r.snippet}`
const pct = (n: number, d: number) => (d ? `${(n / d * 100).toFixed(1)}%` : '—')

// Plainly-Westminster questions for the contamination measurement. Deliberately reserved words
// that a Scottish Official Report would ALSO use ("the minister", "committee") rather than
// England-only terms, so the number is not flattered by vocabulary that excludes Holyrood anyway.
const WESTMINSTER = [
  'House of Commons debate on the Online Safety Bill duties of care',
  'what did the minister say about water company sewage discharges in England',
  'debate on the second reading of the Renters Reform Bill',
  'MPs debate on NHS England waiting list targets',
  'Westminster debate on universal credit sanctions',
  'what was said about HS2 cancellation in the Commons',
]

async function main() {
  console.log(`debates scope: tier=${scope.tier} types=${scope.types} extraCorpora=${JSON.stringify(scope.extraCorpora)}`)

  // ── 1. the debates-stream gold questions ──────────────────────────────────
  const gold = (GOLD as any[]).filter((g) => g.metric === 'recall@20' && g.scoreable && String(g.stream).includes('debates'))
  console.log(`\n=== 1. debates-stream gold questions (${gold.length}) — snippet haystack, NOT gold-report recall ===`)
  console.log('  id   keys before → after   scottish in top-20   keys LOST')
  let keysB = 0, keysA = 0, lost: string[] = []
  for (const g of gold) {
    const [b, a] = await Promise.all([before(g.query, 20), after.search(g.query, 20)])
    const B = b.slice(0, 20), A = a.slice(0, 20)
    const hitKeys = (rs: SearchResult[]) => g.expected.filter((s: any) => rs.some((r) => s.patterns.some((p: RegExp) => p.test(hay(r)))))
    const kb = hitKeys(B), ka = hitKeys(A)
    keysB += kb.length; keysA += ka.length
    const dropped = kb.filter((k: any) => !ka.includes(k)).map((k: any) => k.label)
    if (dropped.length) lost.push(`${g.id}: ${dropped.join('; ')}`)
    const scot = A.filter((r) => corpusOf(r.id) === SCOT).length
    console.log(`  ${g.id.padEnd(4)} ${kb.length}/${g.expected.length} → ${ka.length}/${g.expected.length}` +
      `          ${String(scot).padStart(2)}/20              ${dropped.length ? '⚠ ' + dropped.join('; ') : '—'}`)
  }
  const totalKeys = gold.reduce((n: number, g: any) => n + g.expected.length, 0)
  console.log(`  TOTAL  ${keysB}/${totalKeys} → ${keysA}/${totalKeys}   (${pct(keysB, totalKeys)} → ${pct(keysA, totalKeys)})`)
  console.log(lost.length ? `  ⚠ ANSWER KEYS THAT STOPPED BEING SATISFIED:\n    ${lost.join('\n    ')}` : '  ✓ no answer key stopped being satisfied')

  // ── 2. contamination on plainly-Westminster questions ─────────────────────
  console.log(`\n=== 2. contamination — Scottish rows in the top 20 of a plainly-Westminster question ===`)
  let scotTotal = 0, slots = 0, displaced = 0, beforeSlots = 0
  for (const q of WESTMINSTER) {
    const [b, a] = await Promise.all([before(q, 20), after.search(q, 20)])
    const B = b.slice(0, 20), A = a.slice(0, 20)
    const scot = A.filter((r) => corpusOf(r.id) === SCOT)
    const bIds = new Set(B.map((r) => r.id))
    const pushedOut = B.filter((r) => !new Set(A.map((x) => x.id)).has(r.id)).length
    scotTotal += scot.length; slots += A.length; beforeSlots += B.length; displaced += pushedOut
    console.log(`  ${q.slice(0, 56).padEnd(56)} ${String(scot.length).padStart(2)}/20 scottish · ${String(pushedOut).padStart(2)} Westminster rows displaced` +
      (scot.length ? `\n      top scottish: rank ${A.indexOf(scot[0]) + 1} — ${scot[0].title.slice(0, 70)}` : ''))
  }
  console.log(`  CONTAMINATION: ${scotTotal}/${slots} top-20 slots (${pct(scotTotal, slots)}) across ${WESTMINSTER.length} Westminster questions; ` +
    `${displaced}/${beforeSlots} previously-returned rows displaced (${pct(displaced, beforeSlots)})`)

  // ── 3. latency, warm, order reversed ──────────────────────────────────────
  // The standing rule: warm the path first, then run the two configurations in BOTH orders, so a
  // cold cache or a warming index cannot be read as a cost of the change.
  console.log(`\n=== 3. latency — warm, both orders (the standing rule) ===`)
  const LAT_Q = [...WESTMINSTER, ...gold.map((g: any) => g.query)]
  for (const q of LAT_Q.slice(0, 4)) { await before(q, 20); await after.search(q, 20) }   // warm
  const times: Record<'before' | 'after', number[]> = { before: [], after: [] }
  for (let round = 0; round < 2; round++) {
    const order: Array<'before' | 'after'> = round === 0 ? ['before', 'after'] : ['after', 'before']
    for (const q of LAT_Q) {
      for (const which of order) {
        const t0 = Date.now()
        if (which === 'before') await before(q, 20); else await after.search(q, 20)
        times[which].push(Date.now() - t0)
      }
    }
  }
  const quantile = (xs: number[], p: number) => {
    const s = [...xs].sort((a, b) => a - b)
    return s[Math.min(s.length - 1, Math.floor(p * s.length))]
  }
  for (const which of ['before', 'after'] as const) {
    console.log(`  ${which.padEnd(6)} n=${times[which].length}  p50 ${quantile(times[which], 0.5)}ms  p95 ${quantile(times[which], 0.95)}ms  max ${Math.max(...times[which])}ms`)
  }
  const d50 = quantile(times.after, 0.5) - quantile(times.before, 0.5)
  const d95 = quantile(times.after, 0.95) - quantile(times.before, 0.95)
  console.log(`  DELTA  p50 ${d50 >= 0 ? '+' : ''}${d50}ms   p95 ${d95 >= 0 ? '+' : ''}${d95}ms`)

  // ── 4. jurisdiction visibility, as rendered ───────────────────────────────
  console.log(`\n=== 4. can a reader tell Holyrood from Westminster? what the panel now shows ===`)
  const sample = (await after.search('debate on climate targets and net zero', 20)).filter((r) => corpusOf(r.id) === SCOT)
  for (const r of sample.slice(0, 4)) console.log(`  title: ${r.title}\n  cite:  ${r.citation}\n  url:   ${r.url}\n`)
  const named = sample.filter((r) => /Scottish Parliament/i.test(`${r.title} ${r.citation}`)).length
  console.log(`  ${named}/${sample.length} of the Scottish rows in this sample name the parliament in the rendered title or citation`)
}
main().catch((e) => { console.error(e); process.exit(1) })
