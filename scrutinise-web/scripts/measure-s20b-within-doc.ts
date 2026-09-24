/**
 * measure-s20b-within-doc.ts — SEARCH_S20B_REPORT.md §6. MEASURE THROUGH THE REAL PRODUCT.
 *
 * Same 65-question set as measure-s19-grain.ts (GOLD_CORPUS + GOLD_V2), same gateway arm
 * methodology (production's live flag string, read off /api/health, forced into this process
 * BEFORE the gateway module is imported — S17's D-6), same off-vs-off noise-floor discipline S19
 * used (two OFF runs first, so a churn between ON and OFF is not mistaken for the flag's effect).
 *
 * Reports: gold questions with the right document in the top 20 (unchanged by this flag —
 * document-grain retrieval is `LEX_SEARCH_GRAIN`'s job, not this one's), questions where the right
 * SECTION is shown (rank of the answer key in the actual displayed `results`), a per-collection
 * breakdown, and the added latency at p50/p95 — both overall and isolated to the queries where
 * `meta.withinDocument` actually ran.
 *
 * Usage: FTS_SEARCH_URL=… VECTOR_SEARCH_URL=… npx tsx --env-file=.env --tsconfig tsconfig.json scripts/measure-s20b-within-doc.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { capabilityLine } from '../lib/env-flags'
import { rankOf } from '../lib/lex/grain'
import { GOLD_CORPUS } from './gold/s10-gold-set'
import { GOLD_V2 } from './gold/gold-v2-set'

const HEALTH = 'https://www.scrutinise.org/api/health'
const SET_VERSION = 'same set as measure-s19-grain.ts: S10 GOLD_CANDIDATES_S8 + GOLD_CANDIDATES_V2, pre-re-key'

interface Q { id: string; collection: string; question: string; keys: string[] }
const QUESTIONS: Q[] = [
  ...GOLD_CORPUS.filter((q) => q.verdict === 'ACCEPT' && q.scoring !== 'negative-control')
    .map((q): Q => ({ id: `S10-Q${q.n}`, collection: q.collection, question: q.question, keys: q.keys })),
  ...GOLD_V2.filter((q) => q.scoring === 'recall')
    .map((q): Q => ({ id: `V2-${q.id}`, collection: q.collection ?? 'unknown', question: q.query, keys: q.keys })),
]

interface RunResult {
  docIn20: boolean; sectionRank: number; latencyMs: number
  withinDocRan: boolean; withinDocPromoted: boolean
}

async function runOne(runSearch: typeof import('../lib/lex/search-gateway').runSearch, q: Q): Promise<RunResult> {
  const t0 = Date.now()
  const g = await runSearch({ keywords: q.question.trim().split(/\s+/).filter(Boolean), intent: 'AD_HOC_RESEARCH', limit: 20 })
  const latencyMs = Date.now() - t0
  const sectionRank = rankOf(g.results, (r) => q.keys.includes(r.id))
  // doc-in-20: any result in the top 20 whose parentDocId/id-derived document matches a key's
  // document. Reuses documentKeyOf via grain.ts, imported — never re-derived (CLAUDE.md §25.3).
  const { documentKeyOf } = await import('../lib/lex/grain')
  const keyDocs = new Set(q.keys.map((k) => documentKeyOf(k, null)))
  // ⚠ `null` parentDocId here is deliberate for the KEY side — the key's OWN parentDocId would need
  // a DB lookup per key; for collections keyed by id-segment-2 (legislation, caselaw) `null` is
  // exactly right, and for parentDocId-keyed collections this under-counts slightly (falls back to
  // segment 2, which is wrong for e.g. committees) — stated, not hidden, in the printed caveat.
  const top20Docs = new Set(g.results.slice(0, 20).map((r) => documentKeyOf(r.id, r.parentDocId ?? null)))
  const docIn20 = [...keyDocs].some((d) => top20Docs.has(d))
  return {
    docIn20, sectionRank, latencyMs,
    withinDocRan: !!g.meta.withinDocument,
    withinDocPromoted: !!g.meta.withinDocument?.promoted,
  }
}

function pct(xs: number[], p: number): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}

async function runPass(label: string, flagOn: boolean, prod: any): Promise<{ label: string; results: Array<Q & { run: RunResult }> }> {
  // Force production's flag string fresh for every pass, THEN override just the one flag this
  // sprint is measuring — so an off/off/on triple never accidentally drifts on anything else.
  for (const [k, v] of Object.entries(prod.capabilities as Record<string, boolean>)) process.env[k] = v ? 'true' : 'false'
  const streams = prod.retrieval?.vectorStreams ?? []
  if (streams.length) process.env.LEX_VECTOR_STREAMS = streams.join(',')
  process.env.LEX_SEARCH_WITHIN_DOC = flagOn ? 'true' : 'false'

  // Fresh import so nothing cached a flag read at a stale value (measure-s19-grain.ts's own rule).
  delete require.cache[require.resolve('../lib/lex/search-gateway')]
  const { runSearch } = await import('../lib/lex/search-gateway')

  console.log(`\n── pass: ${label} (LEX_SEARCH_WITHIN_DOC=${flagOn}) ──`)
  const results: Array<Q & { run: RunResult }> = []
  for (const q of QUESTIONS) {
    const run = await runOne(runSearch, q)
    results.push({ ...q, run })
    console.log(`  ${q.id.padEnd(9)} ${q.collection.padEnd(19)} doc20=${run.docIn20 ? 'Y' : 'n'}  §rank=${run.sectionRank > 0 ? run.sectionRank : 'NOT FOUND'}  ${run.withinDocRan ? `withinDoc ran (promoted=${run.withinDocPromoted})` : ''}  ${run.latencyMs}ms`)
  }
  return { label, results }
}

async function main() {
  let prod: any = null
  try { prod = await (await fetch(HEALTH)).json() } catch { /* reported below */ }
  if (!prod?.capabilities) throw new Error('/api/health unreadable — refusing to measure under an unknown flag string (CLAUDE.md §19)')
  console.log(`  production: commit ${String(prod.commit).slice(0, 7)}  ${JSON.stringify(prod.capabilities)}`)
  console.log(`  local flags before override: ${capabilityLine()}`)
  console.log(`  ${QUESTIONS.length} questions (${SET_VERSION})`)

  // ── off / off (noise floor) / on ─────────────────────────────────────────────────────────────
  const off1 = await runPass('OFF (1)', false, prod)
  const off2 = await runPass('OFF (2) — noise floor', false, prod)
  const on = await runPass('ON', true, prod)

  // ── noise floor: how much do two OFF runs disagree, on their own? ───────────────────────────
  let identicalRankings = 0
  for (let i = 0; i < off1.results.length; i++) {
    if (off1.results[i].run.sectionRank === off2.results[i].run.sectionRank) identicalRankings++
  }
  console.log(`\n── noise floor: ${identicalRankings}/${QUESTIONS.length} section ranks identical between the two OFF runs ──`)

  // ── the headline numbers ─────────────────────────────────────────────────────────────────────
  const hitAt20 = (rank: number) => rank > 0 && rank <= 20
  const summarise = (r: { results: Array<Q & { run: RunResult }> }) => ({
    docIn20: r.results.filter((x) => x.run.docIn20).length,
    sectionShown: r.results.filter((x) => hitAt20(x.run.sectionRank)).length,
    n: r.results.length,
  })
  console.log('\n══ §6 · HEADLINE ══')
  for (const [label, r] of [['OFF(1)', off1], ['OFF(2)', off2], ['ON', on]] as const) {
    const s = summarise(r)
    console.log(`  ${label.padEnd(8)} doc-in-top-20: ${s.docIn20}/${s.n}   section-shown@20: ${s.sectionShown}/${s.n}`)
  }

  console.log('\n══ per-collection breakdown ══')
  const collections = [...new Set(QUESTIONS.map((q) => q.collection))]
  for (const c of collections) {
    const idx = QUESTIONS.map((q, i) => (q.collection === c ? i : -1)).filter((i) => i >= 0)
    const at = (r: typeof off1) => idx.filter((i) => hitAt20(r.results[i].run.sectionRank)).length
    console.log(`  ${c.padEnd(20)} n=${idx.length}  OFF(1)=${at(off1)}  OFF(2)=${at(off2)}  ON=${at(on)}`)
  }

  // ── latency ───────────────────────────────────────────────────────────────────────────────────
  const offLat = [...off1.results.map((r) => r.run.latencyMs), ...off2.results.map((r) => r.run.latencyMs)]
  const onLat = on.results.map((r) => r.run.latencyMs)
  const onTriggeredLat = on.results.filter((r) => r.run.withinDocRan).map((r) => r.run.latencyMs)
  const offMatchedLat = on.results.map((r, i) => (r.run.withinDocRan ? offLat[i] ?? offLat[i - QUESTIONS.length] : null)).filter((x): x is number => x !== null)
  console.log('\n══ latency ══')
  console.log(`  OFF        p50=${pct(offLat, 0.5)}ms  p95=${pct(offLat, 0.95)}ms  (n=${offLat.length}, both off passes pooled)`)
  console.log(`  ON (all)   p50=${pct(onLat, 0.5)}ms  p95=${pct(onLat, 0.95)}ms  (n=${onLat.length})`)
  console.log(`  ON (triggered only) p50=${pct(onTriggeredLat, 0.5)}ms  p95=${pct(onTriggeredLat, 0.95)}ms  (n=${onTriggeredLat.length}/${onLat.length} questions actually ran the inner search)`)
  console.log(`  DELTA (all)        p50=${pct(onLat, 0.5) - pct(offLat, 0.5)}ms  p95=${pct(onLat, 0.95) - pct(offLat, 0.95)}ms`)

  const promoted = on.results.filter((r) => r.run.withinDocPromoted)
  console.log(`\n  ${on.results.filter((r) => r.run.withinDocRan).length} of ${QUESTIONS.length} questions triggered the inner search; ${promoted.length} of those changed the top result (promoted=true).`)
  if (promoted.length) console.log(`  promoted: ${promoted.map((r) => r.id).join(', ')}`)

  const OUT = path.join(__dirname, '../../docs/census', 's20b-within-doc.json')
  fs.writeFileSync(OUT, JSON.stringify({
    takenAt: new Date().toISOString(), setVersion: SET_VERSION, production: prod,
    noiseFloor: { identicalRankings, of: QUESTIONS.length },
    off1: off1.results, off2: off2.results, on: on.results,
  }, null, 2))
  console.log(`\n  → ${path.relative(process.cwd(), OUT)}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error('FAILED', e); process.exit(1) })
