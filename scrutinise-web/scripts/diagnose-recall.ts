/**
 * diagnose-recall.ts — S2C6 §2: WHERE a document is lost, not merely THAT it is missing.
 *
 * S2C5's finding is the input: preference accuracy 66.7%, but only 4 of 15 scoreable pairs
 * compared two documents the system actually returned. Eleven turned on whether a document
 * arrived at all, six of those vacuously (neither side arrived). The brief's instruction is to
 * "raise the candidate count reaching the scorer, then re-measure" and to watch the DENOMINATOR.
 *
 * ⚠ BUT RAISING A NUMBER BEFORE KNOWING WHICH NUMBER IS BINDING IS A GUESS. There are at least
 * five distinct ways a document fails to reach the scorer, and only one of them is fixed by a
 * bigger candidate set:
 *
 *   ROUTING     the stream that owns the document was never dispatched      → raising limits: no help
 *   TYPING      retrieved, then dropped by corpusToType before any caller   → raising limits: no help
 *   ABSENT      not in the index at all, at any limit                       → raising limits: no help
 *   CANDIDATES  in the index, retrieved only at a larger per-stream limit   → raising limits: THIS one
 *   RANKING     retrieved and returned, but below the top K of the merge    → raising limits: no help
 *
 * Reporting a single "vacuous" count collapses all five, which is why five sprints of raising and
 * re-measuring could not converge. This script separates them, per missing document, by probing
 * each stage with the real production functions.
 *
 * ── THE CANDIDATE-COUNT CHAIN, read off the code (S2C6 §2's first ask) ──────────────────────
 * For a routed query at gateway `limit` L (default 12; the ordering harness passes 16):
 *   1. search-gateway.ts:133   L = q.limit ?? 12
 *   2. query-router.ts:222     each ACTIVE stream is called with L
 *   3. fts-search.ts:149       callFts asks the FTS service for max(3L, 30)
 *      vector-search.ts:91     callVector asks the vector service for max(3L, 30)
 *   4. fts-search.ts:257       adapter returns .slice(0, 3L)   ← after corpusToType drops nulls
 *   5. query-router.ts:90      mergeLegs → .slice(0, max(L, main.length))  ≈ 3L
 *   6. query-router.ts:178     fuseWeightedRrf(vec, bm25).slice(0, max(L, bm25.length)) ≈ 3L
 *   7. interleave.ts           round-robin across streams → up to 3L × streams
 *   8. score-ordering.ts:37    K = 20 — the scorer reads only the first 20
 * So at L=16 each stream offers ≤48 and five streams offer ≤240, of which the scorer sees 20.
 * ⚠ THE BINDING CONSTRAINT IS THEREFORE NOT OBVIOUSLY L. That is the hypothesis this tests.
 *
 * Usage:
 *   FTS_SEARCH_URL=… VECTOR_SEARCH_URL=… GEMINI_API_KEY=… DATABASE_URL=… LEX_QUERY_ROUTER=true \
 *     npx tsx --env-file=.env --tsconfig tsconfig.json scripts/diagnose-recall.ts [--limit 16]
 */
import fs from 'fs'
import path from 'path'
import { runSearch } from '../lib/lex/search-gateway'
import { runFtsSearch } from '../lib/lex/fts-search'
import { STREAMS } from '../lib/lex/query-router'
import { STREAM_SCOPES } from '../lib/lex/stream-scopes'
import { corpusToType } from '../lib/lex/corpus-type-map'
import { PREFERENCES, type PrefSide } from './gold-preferences'
import type { SearchResult } from '../lib/lex/page1-config'
// S3 §7.2 — this harness produced ABSENT 7 / ROUTING 16 on a machine with three
// retrieval flags unset, a result that read as V36 having broken routing. It now
// refuses to run degraded, and prints the configuration beside the number.
import { assertRetrievalConfig, resolvedConfigLine } from '../lib/lex/harness-preflight'

const L = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 16 })()
const K = parseInt(process.env.ORDER_K ?? '20', 10)
/** The "does a bigger candidate set find it" probe. Deliberately far larger than any production L. */
const WIDE = parseInt(process.env.WIDE_LIMIT ?? '120', 10)
const OUT = path.join(__dirname, `../../docs/recall_diagnosis_L${L}.json`)

const hay = (r: SearchResult) => `${r.id}\n${r.title ?? ''}\n${r.citation ?? ''}`
const matches = (side: PrefSide, r: SearchResult) => side.patterns.some((p) => p.test(hay(r)))
const rankOf = (side: PrefSide, rs: SearchResult[]) => { const i = rs.findIndex((r) => matches(side, r)); return i }

type Verdict = 'IN_TOP_K' | 'RANKING' | 'CANDIDATES' | 'ROUTING' | 'TYPING' | 'ABSENT'

async function main() {
  for (const v of ['GEMINI_API_KEY', 'DATABASE_URL']) {
    if (!process.env[v]) { console.error(`${v} is not set — this measures the LIVE path and must not report from no data.`); process.exit(1) }
  }
  // ⚠ The list above used to include FTS_SEARCH_URL and stop there — it guarded the flags
  // that THROW and not the two that degrade in silence, which is why this harness once
  // reported ROUTING 16/30 against a baseline of 0 and looked like an ingest regression.
  // `assertRetrievalConfig` covers all four and refuses rather than degrades (S3 §7.2).
  assertRetrievalConfig('diagnose-recall')
  const scoreable = PREFERENCES.filter((p) => p.surface === 'within-stream')
  console.log(`diagnose-recall — L=${L} K=${K} wide=${WIDE}, ${scoreable.length} within-stream pairs\n`)

  const findings: any[] = []
  const tally: Record<Verdict, number> = { IN_TOP_K: 0, RANKING: 0, CANDIDATES: 0, ROUTING: 0, TYPING: 0, ABSENT: 0 }

  // Each query is run ONCE and both sides diagnosed against it, so the routing decision and the
  // ranking are the same for the pair — as they are in production.
  const byQuery = new Map<string, typeof scoreable>()
  for (const p of scoreable) byQuery.set(p.query, [...(byQuery.get(p.query) ?? []), p])

  for (const [query, prefs] of byQuery) {
    const out = await runSearch({ keywords: query.split(/\s+/).filter(Boolean), intent: 'GENERAL_CORPUS_CHAT', limit: L })
    const routed = out.meta.routedStreams ?? []
    console.log(`\nq: ${query.slice(0, 88)}`)
    console.log(`   routed: [${routed.join(', ') || 'NONE — fail-open'}]   returned ${out.results.length} (scorer reads ${K})`)

    const sides = prefs.flatMap((p) => [{ side: p.above, role: 'above' as const, p }, { side: p.below, role: 'below' as const, p }])
    for (const { side, role, p } of sides) {
      const rTop = rankOf(side, out.results.slice(0, K))
      const rAll = rankOf(side, out.results)
      let verdict: Verdict
      const detail: any = { query, label: side.label, role, why: p.why, rankInTopK: rTop >= 0 ? rTop + 1 : null, rankInFull: rAll >= 0 ? rAll + 1 : null, routed, returned: out.results.length }

      if (rTop >= 0) { verdict = 'IN_TOP_K' }
      else if (rAll >= 0) {
        // It arrived — the merge just put it past the scorer's window.
        verdict = 'RANKING'
      } else {
        // Not in the production result at all. Ask each stream directly, at a WIDE limit, whether
        // it can produce the document. This separates "the candidate set is too small" from
        // "nothing could have retrieved it".
        let foundInStream: string | null = null
        let foundAtRank: number | null = null
        for (const s of STREAMS) {
          const rs = await s.search(query, WIDE).catch(() => [] as SearchResult[])
          const i = rankOf(side, rs)
          if (i >= 0) { foundInStream = s.name; foundAtRank = i + 1; break }
        }
        if (foundInStream) {
          // A stream CAN produce it. Was that stream routed? If not, the loss is routing, not size.
          verdict = routed.includes(foundInStream) ? 'CANDIDATES' : 'ROUTING'
          detail.foundInStream = foundInStream
          detail.foundAtWideRank = foundAtRank
        } else {
          // No stream produced it even at WIDE. Two remaining causes: the adapter dropped it on
          // type, or it is not in the index. Ask the FTS service with NO stream scope at all —
          // that is the widest thing the product can do — and inspect what comes back.
          const unscoped = await runFtsSearch([query], WIDE, {}).catch(() => ({ results: [] as SearchResult[] }))
          const i = rankOf(side, unscoped.results)
          if (i >= 0) {
            // Reachable unscoped but by no stream ⇒ a scoping/typing boundary is what removes it.
            verdict = 'TYPING'
            detail.unscopedRank = i + 1
            const hit = unscoped.results[i]
            detail.corpus = hit.id.split(':')[0]
            detail.type = hit.type
            detail.streamsThatCouldSelect = STREAM_SCOPES.filter((sc) =>
              sc.tier === 'legislation' || sc.extraCorpora?.includes(hit.id.split(':')[0])).map((sc) => sc.name)
          } else {
            verdict = 'ABSENT'
          }
        }
      }
      detail.verdict = verdict
      tally[verdict]++
      findings.push(detail)
      const mark = verdict === 'IN_TOP_K' ? '✓' : verdict === 'RANKING' ? '↓' : '✗'
      console.log(`   ${mark} ${verdict.padEnd(11)} ${side.label.slice(0, 46).padEnd(46)}` +
        (rTop >= 0 ? ` rank ${rTop + 1}` : rAll >= 0 ? ` rank ${rAll + 1} of ${out.results.length} — past the top ${K}` :
          detail.foundInStream ? ` reachable in "${detail.foundInStream}" at rank ${detail.foundAtWideRank}/${WIDE}` :
          detail.unscopedRank ? ` unscoped rank ${detail.unscopedRank} — corpus ${detail.corpus}, type ${detail.type}` : ' nowhere at any limit'))
    }
  }

  const total = Object.values(tally).reduce((a, b) => a + b, 0)
  console.log('\n════ WHERE THE MISSING DOCUMENTS ARE LOST ════')
  // The number and the configuration that produced it travel together, always (S3 §7.2).
  console.log(`  ${resolvedConfigLine()}`)
  for (const [k, v] of Object.entries(tally)) {
    console.log(`  ${k.padEnd(11)} ${String(v).padStart(3)}/${total}   ${'█'.repeat(Math.round(40 * v / Math.max(total, 1)))}`)
  }
  console.log('\n  Reading it: only CANDIDATES is fixed by raising the per-stream limit. RANKING needs a')
  console.log('  reranker or a better merge; ROUTING needs the router; TYPING needs a map entry;')
  console.log('  ABSENT needs ingest. A single "vacuous" count collapses all five, which is why the')
  console.log('  denominator could not be moved by guessing at a number.')

  fs.writeFileSync(OUT, JSON.stringify({ measuredAt: new Date().toISOString(), L, K, WIDE, tally, findings }, null, 2))
  console.log(`\n  → ${OUT}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
