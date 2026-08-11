/**
 * score-vector-full.ts — the full-corpus fusion/recall re-confirm (SEARCH_STRATEGY.md
 * §12 step 1), run against the REAL production indexes now that the full embed is
 * done: `corpus_fts` (16.5M-row BM25, live) and `corpus_vec` (21.8M-vector IVF_PQ ANN,
 * built 2026-07-21 — see handoff CURRENT STATE for the compaction-skip caveat this
 * run is also meant to validate). Everything the pilot measured on a 60k-chunk exact-
 * cosine subset (docs/PILOT_RESULTS.md, docs/FUSION_RESULTS.md) is re-measured here
 * on the real ANN index + real BM25 index, at the shipped weight (0.7) plus a small
 * sweep around it, using the SAME gold set / scoring semantics as score-fts.ts.
 *
 * BM25 arm: fts-core.rankedSearch (live query path). Vector arm: vector-core's
 * embedQuery + vectorSearchSections (live query path, real ANN — nprobes/refine as
 * configured for production, not overridden). Fusion: weighted RRF, same formula as
 * pilot-fusion.ts. Section metadata for candidates the BM25 arm didn't return (i.e.
 * vector-only hits) is batch-fetched from corpus_fts by id (it indexes every section,
 * so it's a safe metadata source regardless of which arm found the id).
 *
 * Usage: tsx search/score-vector-full.ts  →  docs/VECTOR_FULL_RECONFIRM.md + .json
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch, Hit } from './fts-core'
import { loadActIndex } from './citation-resolver'
import { GOLD, GoldQuery, ARCHETYPE_META } from './gold-queries'
import { embedQuery, vectorSearchSections, retrievalConfig } from './vector-core'
import { VEC_TABLE } from './vector-common'

const CAND_K = parseInt(process.env.RECONFIRM_CAND_K ?? '100', 10)
const RRF_K = parseInt(process.env.RECONFIRM_RRF_K ?? '60', 10)
const TOPN = 20
const WEIGHTS = [0, 0.5, 0.6, 0.7, 0.8, 0.9, 1] as const // 0.7 = shipped spec (FUSION_REPORT.md)
const OUT_MD = path.join(__dirname, '../../../docs/VECTOR_FULL_RECONFIRM.md')
const OUT_JSON = path.join(__dirname, '../../../docs/vector_full_reconfirm.json')

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const pp = (d: number) => `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}pp`
const wlab = (w: number) => (w === 0 ? '0/100 (BM25)' : w === 1 ? '100/0 (vector)' : `${Math.round(w * 100)}/${Math.round((1 - w) * 100)}${w === 0.7 ? ' (SHIPPED)' : ''}`)

function fuseWeighted(vec: string[], bm: string[], w: number): string[] {
  const s = new Map<string, number>()
  if (w > 0) vec.forEach((id, i) => s.set(id, (s.get(id) ?? 0) + w / (RRF_K + i + 1)))
  if (w < 1) bm.forEach((id, i) => s.set(id, (s.get(id) ?? 0) + (1 - w) / (RRF_K + i + 1)))
  return [...s.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
}

/** recall@20 against a gold query's expected-source patterns, using a haystack map. */
function score(q: GoldQuery, ordered: string[], haystack: Map<string, string>): number {
  const stacks = ordered.slice(0, TOPN).map((id) => haystack.get(id) ?? id)
  const found = q.expected.filter((src) => stacks.some((h) => src.patterns.some((p) => p.test(h)))).length
  return q.expected.length ? found / q.expected.length : 0
}

async function main() {
  console.log('[reconfirm] opening corpus_fts + corpus_vec…')
  const conn = await connectLance()
  const ftsTable = await conn.openTable(FTS_TABLE)
  const vecTable = await conn.openTable(VEC_TABLE)
  console.log(`[reconfirm] corpus_fts rows=${await ftsTable.countRows()} corpus_vec rows=${await vecTable.countRows()}`)

  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })
  const actIndex = await loadActIndex(pool)
  await pool.end()
  console.log(`[reconfirm] act index: ${actIndex.byTitle.size} titles`)

  const scored = GOLD.filter((q) => q.metric === 'recall@20' && q.scoreable)
  console.log(`[reconfirm] ${scored.length} scoreable recall@20 gold queries`)

  const haystack = new Map<string, string>()
  const bm25Ranks = new Map<string, string[]>()
  const vecRanks = new Map<string, string[]>()

  for (const q of scored) {
    console.log(`[reconfirm] ${q.id}: BM25…`)
    const bmHits: Hit[] = await rankedSearch(ftsTable, q.query, { limit: CAND_K, actIndex })
    for (const h of bmHits) haystack.set(h.id, `${h.id}\n${h.sectionTitle ?? ''}\n${h.body}`)
    bm25Ranks.set(q.id, bmHits.map((h) => h.id))

    console.log(`[reconfirm] ${q.id}: embedding + ANN…`)
    const qvec = await embedQuery(q.query)
    const vecHits = await vectorSearchSections(vecTable, qvec, CAND_K)
    vecRanks.set(q.id, vecHits.map((h) => h.sectionId))

    const missing = vecHits.map((h) => h.sectionId).filter((id) => !haystack.has(id))
    if (missing.length) {
      const esc = (s: string) => s.replace(/'/g, "''")
      const inList = missing.map((id) => `'${esc(id)}'`).join(',')
      const rows = await ftsTable.query().where(`id IN (${inList})`).select(['id', 'sectionTitle', 'body']).toArray() as any[]
      for (const r of rows) haystack.set(r.id, `${r.id}\n${r.sectionTitle ?? ''}\n${r.body ?? ''}`)
      for (const id of missing) if (!haystack.has(id)) haystack.set(id, id) // truly gone (deleted since indexing) — id-only fallback
    }
  }

  // ── sweep (all in-memory — rankings computed once above) ──────────────────────
  const recallByWeight = new Map<number, Map<string, number>>()
  for (const w of WEIGHTS) {
    const m = new Map<string, number>()
    for (const q of scored) m.set(q.id, score(q, fuseWeighted(vecRanks.get(q.id)!, bm25Ranks.get(q.id)!, w), haystack))
    recallByWeight.set(w, m)
  }

  const exIds = scored.filter((q) => !q.floor).map((q) => q.id)
  const archetypes = ['A', 'B', 'C', 'D', 'E', 'F'] as const
  const idsOf = (arch: string) => scored.filter((q) => q.archetype === arch).map((q) => q.id)
  const agg = (m: Map<string, number>, ids: string[]) => mean(ids.map((id) => m.get(id)!))

  // ── pilot comparison (docs/FUSION_RESULTS.md / fusion_tuning.json, gemini) ────
  const PILOT_JSON = path.join(__dirname, '../../../docs/fusion_tuning.json')
  let pilotAt07: number | null = null
  let pilotVecAlone: number | null = null
  let pilotBm25: number | null = null
  if (fs.existsSync(PILOT_JSON)) {
    const pilot = JSON.parse(fs.readFileSync(PILOT_JSON, 'utf8'))
    const gm = (pilot.models ?? []).find((m: any) => m.slug === 'gemini')
    if (gm) {
      pilotAt07 = gm.byWeight.find((b: any) => b.w === 0.7)?.overallExclFloor ?? null
      pilotVecAlone = gm.byWeight.find((b: any) => b.w === 1)?.overallExclFloor ?? null
      pilotBm25 = gm.byWeight.find((b: any) => b.w === 0)?.overallExclFloor ?? null
    }
  }

  // ── report ──────────────────────────────────────────────────────────────────
  const md: string[] = []
  md.push('# VECTOR_FULL_RECONFIRM — fusion/recall re-confirm on the full-corpus ANN index', '')
  md.push(`*Generated ${new Date().toISOString()}. Real production indexes: \`corpus_fts\` (${await ftsTable.countRows()} rows, BM25 live) + \`corpus_vec\` (${await vecTable.countRows()} vectors, IVF_PQ ANN, built 2026-07-21 with \`VECTOR_SKIP_COMPACT=true\` — see handoff CURRENT STATE for the caveat this run validates). CAND_K=${CAND_K}, RRF_K=${RRF_K}. Model gemini-embedding-001 @768d, query embedded live (RETRIEVAL_QUERY task type). Scored on the same ${scored.length}-query scoreable recall@20 gold set as \`score-fts.ts\`/\`pilot-fusion.ts\` (excl.-floor n=${exIds.length}).*`, '')

  md.push('## Headline — shipped weight (0.7) vs the pilot subset measurement', '')
  md.push('| arm | full-index (this run) | pilot subset (60k rows, exact cosine) | delta |', '|---|---|---|---|')
  const at07 = agg(recallByWeight.get(0.7)!, exIds)
  const atVecAlone = agg(recallByWeight.get(1)!, exIds)
  const atBm25 = agg(recallByWeight.get(0)!, exIds)
  md.push(`| BM25-alone | ${pct(atBm25)} | ${pilotBm25 !== null ? pct(pilotBm25) : 'n/a'} | ${pilotBm25 !== null ? pp(atBm25 - pilotBm25) : '—'} |`)
  md.push(`| vector-alone | ${pct(atVecAlone)} | ${pilotVecAlone !== null ? pct(pilotVecAlone) : 'n/a'} | ${pilotVecAlone !== null ? pp(atVecAlone - pilotVecAlone) : '—'} |`)
  md.push(`| **fused 70/30 (SHIPPED)** | **${pct(at07)}** | ${pilotAt07 !== null ? pct(pilotAt07) : 'n/a'} | ${pilotAt07 !== null ? pp(at07 - pilotAt07) : '—'} |`)
  md.push('')
  md.push(`**Read:** a large negative delta on vector-alone or fused vs the pilot is the signal for the compaction-skip caveat (degraded ANN partitioning). A small/positive delta means the un-compacted index is fine and the earlier kmeans warnings were benign chatter at this scale.`, '')

  md.push('## Full weight sweep (this run, full index)', '')
  md.push('| w (vec/BM25) | overall excl-floor | A (citation) | B (lay concept) | B6 | C | E | F |', '|---|---|---|---|---|---|---|---|')
  for (const w of WEIGHTS) {
    const m = recallByWeight.get(w)!
    md.push(`| ${wlab(w)} | **${pct(agg(m, exIds))}** | ${pct(agg(m, idsOf('A')))} | ${pct(agg(m, idsOf('B')))} | ${m.get('B6') !== undefined ? pct(m.get('B6')!) : 'n/a'} | ${pct(agg(m, idsOf('C')))} | ${pct(agg(m, idsOf('E')))} | ${pct(agg(m, idsOf('F')))} |`)
  }
  md.push('')

  md.push('## By archetype at the shipped weight (0.7)', '')
  md.push('| archetype | stream | recall@20 | n |', '|---|---|---|---|')
  const m07 = recallByWeight.get(0.7)!
  for (const a of archetypes) {
    const ids = idsOf(a)
    md.push(`| ${a} | ${ARCHETYPE_META[a]?.stream ?? ''} | ${pct(agg(m07, ids))} | ${ids.length} |`)
  }
  md.push('')

  md.push('## Per-query detail (w=0.7)', '')
  md.push('| id | archetype | recall@20 (fused 0.7) | recall@20 (vector-alone) | recall@20 (BM25-alone) |', '|---|---|---|---|---|')
  for (const q of scored) {
    md.push(`| ${q.id} | ${q.archetype}${q.floor ? '·fl' : ''} | ${pct(m07.get(q.id)!)} | ${pct(recallByWeight.get(1)!.get(q.id)!)} | ${pct(recallByWeight.get(0)!.get(q.id)!)} |`)
  }
  md.push('')

  fs.writeFileSync(OUT_MD, md.join('\n'))
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    ftsRows: await ftsTable.countRows(), vecRows: await vecTable.countRows(),
    candK: CAND_K, rrfK: RRF_K, weights: WEIGHTS, nQueries: scored.length, nExclFloor: exIds.length,
    pilotComparison: { pilotBm25, pilotVecAlone, pilotAt07, fullBm25: atBm25, fullVecAlone: atVecAlone, fullAt07: at07 },
    byWeight: WEIGHTS.map((w) => ({
      w, overallExclFloor: agg(recallByWeight.get(w)!, exIds),
      byArch: archetypes.map((a) => ({ archetype: a, recall: agg(recallByWeight.get(w)!, idsOf(a)) })),
      perQuery: scored.map((q) => ({ id: q.id, recall: recallByWeight.get(w)!.get(q.id)! })),
    })),
  }, null, 2))

  console.log('')
  console.log(`[reconfirm] HEADLINE excl-floor (n=${exIds.length}): BM25-alone=${pct(atBm25)} vector-alone=${pct(atVecAlone)} fused-0.7=${pct(at07)}`)
  // ⚠ Printed as well as written, because an nprobes A/B needs the PER-STREAM number and the box that
  // runs this is destroyed with its filesystem. A table that exists only in a file on a dead machine
  // is a measurement you cannot read.
  console.log(`[reconfirm] nprobes in force: ${JSON.stringify(retrievalConfig())}`)
  console.log('[reconfirm] by archetype at w=0.7:')
  for (const a of archetypes) {
    const ids = idsOf(a)
    console.log(`[reconfirm]   ${String(a).padEnd(3)} ${String(ARCHETYPE_META[a]?.stream ?? '').padEnd(28)} recall@20=${pct(agg(m07, ids))} n=${ids.length}`)
  }
  console.log(`[reconfirm] vector-alone by archetype: ${archetypes.map((a) => `${a}=${pct(agg(recallByWeight.get(1)!, idsOf(a)))}`).join(' ')}`)
  if (pilotAt07 !== null) console.log(`[reconfirm] vs pilot subset: BM25 ${pct(pilotBm25!)} vector ${pct(pilotVecAlone!)} fused-0.7 ${pct(pilotAt07)}`)
  console.log(`[reconfirm] wrote ${OUT_MD} + ${OUT_JSON}`)
}

main().catch((e) => { console.error('[reconfirm] FATAL', e); process.exit(1) })
