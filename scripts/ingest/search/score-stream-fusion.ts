/**
 * score-stream-fusion.ts — per-stream BM25 / vector / fusion recall, offline.
 *
 * A stream-scoped generalisation of score-vector-full.ts. Two things differ, and both matter:
 *
 *  1. BOTH ARMS ARE TIER-SCOPED. score-vector-full measures the whole corpus; this measures one
 *     stream, with the same tier prefilter the live per-stream path uses (query-router.ts
 *     ::fusedStream). Scoring unscoped and shipping scoped would measure a system nobody runs.
 *  2. IT GOES STRAIGHT TO THE LANCE TABLES. No fts-serve, no vector-query-service, no
 *     VECTOR_SEARCH_URL — none of which is deployed. Measurement must not be blocked on a
 *     deployment, and the HTTP hop adds nothing to a recall number.
 *
 * Usage:
 *   tsx search/score-stream-fusion.ts --stream=legislation --out=GOLD_TEST_03_fusion_reweight.md
 *   tsx search/score-stream-fusion.ts --stream=debates     --out=GOLD_TEST_04_debates_vector.md
 *   ... committees | caselaw | guidance   (these score DRAFT questions — see gold-draft-streams.ts)
 *
 * EVERY NUMBER THIS EMITS IS PROVISIONAL. The answer-key validation pass is outstanding, and
 * the index changed twice this week (coverage fix 4 Aug, dedup 5 Aug). For the three streams
 * with no gold coverage the questions themselves are CC drafts, so those reports are
 * provisional twice over. Nothing here is a live decision: the flag stays OFF.
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch, Hit } from './fts-core'
import { loadActIndex } from './citation-resolver'
import { GOLD } from './gold-queries'
import { embedQuery, vectorSearchSections } from './vector-core'
import { VEC_TABLE } from './vector-common'
import { draftFor, DraftStream } from './gold-draft-streams'

const arg = (n: string) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null }
const STREAM = (arg('stream') ?? 'legislation') as string
const OUT = arg('out') ?? `GOLD_TEST_${STREAM}.md`
const CAND_K = parseInt(process.env.STREAM_CAND_K ?? '100', 10)
const RRF_K = parseInt(process.env.STREAM_RRF_K ?? '60', 10)
const TOPN = 20
/** The brief's four, plus the two reference arms that make them interpretable. */
const WEIGHTS = [0, 0.5, 0.6, 0.7, 0.8, 1] as const

interface StreamSpec { tier: string; archetypes: string[]; draft?: DraftStream; note: string }
const SPEC: Record<string, StreamSpec> = {
  legislation: { tier: 'legislation', archetypes: ['A', 'B', 'C'], note: 'A citation-lookup, B concept-bridge (the vector target), C policy sweep.' },
  debates:     { tier: 'parliamentary', archetypes: ['E', 'F'], note: 'E legislative intent, F bills+debates. Tier `parliamentary` also holds committees; the router separates them by display type downstream, not by tier.' },
  committees:  { tier: 'parliamentary', archetypes: [], draft: 'committees', note: 'No gold coverage exists. Scored on CC-DRAFTED questions — see the review table at the top.' },
  caselaw:     { tier: 'caselaw', archetypes: [], draft: 'caselaw', note: 'No gold query anywhere names a caselaw source. Scored on CC-DRAFTED questions.' },
  guidance:    { tier: 'guidance', archetypes: [], draft: 'guidance', note: 'Archetype G is `lesson`-metric with 0 scoreable. Scored on CC-DRAFTED questions.' },
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const pp = (d: number) => `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}pp`
const wlab = (w: number) => (w === 0 ? 'BM25 only' : w === 1 ? 'vector only' : `${Math.round(w * 100)}/${Math.round((1 - w) * 100)}${w === 0.7 ? ' ←carried' : ''}`)

function fuseWeighted(vec: string[], bm: string[], w: number): string[] {
  const s = new Map<string, number>()
  if (w > 0) vec.forEach((id, i) => s.set(id, (s.get(id) ?? 0) + w / (RRF_K + i + 1)))
  if (w < 1) bm.forEach((id, i) => s.set(id, (s.get(id) ?? 0) + (1 - w) / (RRF_K + i + 1)))
  return [...s.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
}

interface Q { id: string; query: string; expected: { label: string; patterns: RegExp[] }[]; draft: boolean }

function score(q: Q, ordered: string[], haystack: Map<string, string>): number {
  const stacks = ordered.slice(0, TOPN).map((id) => haystack.get(id) ?? id)
  const found = q.expected.filter((src) => stacks.some((h) => src.patterns.some((p) => p.test(h)))).length
  return q.expected.length ? found / q.expected.length : 0
}

async function main() {
  const spec = SPEC[STREAM]
  if (!spec) { console.error(`unknown stream "${STREAM}" — one of ${Object.keys(SPEC).join(', ')}`); process.exit(1) }

  const queries: Q[] = [
    ...GOLD.filter((g: any) => spec.archetypes.includes(g.archetype) && g.metric === 'recall@20' && g.scoreable)
      .map((g: any) => ({ id: g.id, query: g.query, expected: g.expected, draft: false })),
    ...(spec.draft ? draftFor(spec.draft).map((d) => ({ id: d.id, query: d.query, expected: d.expected, draft: true })) : []),
  ]
  console.log(`[stream-score] stream=${STREAM} tier=${spec.tier} queries=${queries.length} (draft=${queries.filter((q) => q.draft).length})`)

  const conn = await connectLance()
  const ftsTable = await conn.openTable(FTS_TABLE)
  const vecTable = await conn.openTable(VEC_TABLE)
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })
  const actIndex = await loadActIndex(pool)
  await pool.end()

  const haystack = new Map<string, string>()
  const bm25Ranks = new Map<string, string[]>()
  const vecRanks = new Map<string, string[]>()

  for (const q of queries) {
    const bmHits: Hit[] = await rankedSearch(ftsTable, q.query, { limit: CAND_K, actIndex, tier: spec.tier })
    for (const h of bmHits) haystack.set(h.id, `${h.id}\n${h.sectionTitle ?? ''}\n${h.body}`)
    bm25Ranks.set(q.id, bmHits.map((h) => h.id))

    const qvec = await embedQuery(q.query)
    const vecHits = await vectorSearchSections(vecTable, qvec, CAND_K, spec.tier)
    vecRanks.set(q.id, vecHits.map((h) => h.sectionId))

    const missing = vecHits.map((h) => h.sectionId).filter((id) => !haystack.has(id))
    if (missing.length) {
      const esc = (s: string) => s.replace(/'/g, "''")
      const rows = await ftsTable.query().where(`id IN (${missing.map((i) => `'${esc(i)}'`).join(',')})`).select(['id', 'sectionTitle', 'body']).toArray() as any[]
      for (const r of rows) haystack.set(r.id, `${r.id}\n${r.sectionTitle ?? ''}\n${r.body ?? ''}`)
      for (const id of missing) if (!haystack.has(id)) haystack.set(id, id)
    }
    console.log(`[stream-score] ${q.id}: bm25=${bmHits.length} vec=${vecHits.length}`)
  }

  const recallByWeight = new Map<number, Map<string, number>>()
  for (const w of WEIGHTS) {
    const m = new Map<string, number>()
    for (const q of queries) m.set(q.id, score(q, fuseWeighted(vecRanks.get(q.id)!, bm25Ranks.get(q.id)!, w), haystack))
    recallByWeight.set(w, m)
  }
  const agg = (m: Map<string, number>) => mean(queries.map((q) => m.get(q.id) ?? 0))

  const best = [...WEIGHTS].sort((a, b) => agg(recallByWeight.get(b)!) - agg(recallByWeight.get(a)!))[0]
  const md: string[] = []
  const title = OUT.replace(/\.md$/, '')
  md.push(`# ${title} — ${STREAM} stream, BM25 vs vector vs fusion`, '')
  md.push(`> ## ⚠ PROVISIONAL — NOT A FINAL NUMBER`)
  md.push(`> Charlie's answer-key validation pass is **outstanding**, and \`corpus_fts\` changed twice this week`)
  md.push(`> (coverage fix 4 Aug: 1,191,345 rows merged; dedup 5 Aug: 19,161 rows removed, which moved BM25`)
  md.push(`> document frequencies). A confirmatory re-score is required once the validation lands.`)
  if (spec.draft) {
    md.push(`>`)
    md.push(`> **PROVISIONAL TWICE OVER:** this stream has no gold questions, so the questions below were`)
    md.push(`> **drafted by CC** and are themselves unvalidated. Review them before trusting any number here.`)
  }
  md.push(`> **The flag stays OFF.** This is measurement, not a live decision.`, '')
  md.push(`*Generated ${new Date().toISOString()}. Offline against the Lance tables (\`${FTS_TABLE}\`, \`${VEC_TABLE}\`) — no HTTP path, nothing deployed. Both arms prefiltered to \`tier='${spec.tier}'\`, matching query-router.ts::fusedStream. CAND_K=${CAND_K}, RRF_K=${RRF_K}, recall@${TOPN}. Model gemini-embedding-001 @768d.*`, '')
  md.push(`**Stream note.** ${spec.note}`, '')

  if (spec.draft) {
    md.push('## ⚠ DRAFTED QUESTIONS — please confirm or correct', '')
    md.push('These are CC\'s drafts, presented here rather than as a separate round-trip so they can be waved through alongside the results. If a question is wrong, its row below is meaningless.', '')
    md.push('| id | question | why it tests this stream | expected sources |', '|---|---|---|---|')
    for (const d of draftFor(spec.draft!)) {
      md.push(`| ${d.id} | ${d.query} | ${d.rationale} | ${d.expected.map((e) => e.label).join('; ')} |`)
    }
    md.push('')
  }

  md.push('## Weight sweep', '')
  md.push('| weight (vector/BM25) | recall@20 | vs BM25-only |', '|---|---|---|')
  const base = agg(recallByWeight.get(0)!)
  for (const w of WEIGHTS) {
    const a = agg(recallByWeight.get(w)!)
    md.push(`| ${wlab(w)} | ${pct(a)}${w === best ? ' **← best**' : ''} | ${w === 0 ? '—' : pp(a - base)} |`)
  }
  md.push('')
  md.push(`**Best weight in this sweep: ${wlab(best)} at ${pct(agg(recallByWeight.get(best)!))}.** Carried weight 0.7 scores ${pct(agg(recallByWeight.get(0.7)!))} (${pp(agg(recallByWeight.get(0.7)!) - base)} vs BM25 alone).`, '')

  md.push('## Per query', '')
  md.push('| id | query | BM25 | vector | 70/30 | best-in-sweep |', '|---|---|---|---|---|---|')
  for (const q of queries) {
    const r = (w: number) => pct(recallByWeight.get(w)!.get(q.id) ?? 0)
    md.push(`| ${q.id}${q.draft ? ' *(draft)*' : ''} | ${q.query.slice(0, 70)}${q.query.length > 70 ? '…' : ''} | ${r(0)} | ${r(1)} | ${r(0.7)} | ${r(best)} |`)
  }
  md.push('')

  const outPath = path.join(__dirname, '../../../docs', OUT)
  fs.writeFileSync(outPath, md.join('\n'))
  console.log(`[stream-score] wrote ${outPath}`)
  console.log(`[stream-score] BM25=${pct(base)} vec=${pct(agg(recallByWeight.get(1)!))} 0.7=${pct(agg(recallByWeight.get(0.7)!))} best=${wlab(best)} ${pct(agg(recallByWeight.get(best)!))}`)
}

main().catch((e) => { console.error('[stream-score] FATAL', e instanceof Error ? e.stack ?? e.message : e); process.exit(1) })
