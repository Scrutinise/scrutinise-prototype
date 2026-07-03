/**
 * pilot-fusion.ts — fusion-weight tuning on the pilot subset (SEARCH vector pilot
 * follow-up to pilot-score.ts). The bake-off found naive equal-weight RRF actively
 * HURTS strong models (hybrid < vector-alone; voyage B6 collapses 50%→0%), so the
 * vector flag stays off until fusion is fixed. This script answers the flag-flip
 * question two ways, at zero new embedding cost (reuses the pilot vectors on R2):
 *
 *   1. WEIGHTED RRF SWEEP — fused score = w·1/(K+rank_vec) + (1−w)·1/(K+rank_bm25),
 *      w ∈ {0, .3, .5, .6, .7, .8, .9, 1}. w=.5 IS the naive-RRF pilot baseline
 *      (scaling both arms by ½ can't change the order → identical ranking; self-
 *      checked against docs/pilot_results.json). w=0 = BM25-alone, w=1 = vector-alone.
 *   2. KIND-BASED ROUTING — the production-detectable signal parseCitation() (a
 *      "section N … Act YYYY" pattern; the same parser the BM25 resolver uses)
 *      routes each query to a citation weight wCit (BM25-heavy) vs a concept weight
 *      wCon (vector-heavy). Routing = picking a per-query weight, so every
 *      (wCit, wCon) pair is composable from the per-query fixed sweep for free —
 *      the full grid is evaluated.
 *
 * Everything reuses pilot-score.ts semantics EXACTLY (same subset chunk universe,
 * same BM25 arm incl. title/leg-tier boosts + the archetype-A citation-resolver
 * pin, same exact in-memory cosine vector arm, same gold regex scoring), so all
 * numbers are directly comparable to docs/PILOT_RESULTS.md.
 *
 * Run: tsx search/pilot-fusion.ts → docs/FUSION_RESULTS.md + docs/fusion_tuning.json
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import { connectLance } from './lance'
import { PILOT_CHUNKS } from './pilot-common'
import { TITLE_BOOST, LEX_LEG_TIER_BOOST, queryTerms } from './fts-core'
import { loadActIndex, parseCitation, resolveCitation, idPatternsFor } from './citation-resolver'
import { GOLD, GoldQuery } from './gold-queries'
import { enabledProviders } from './pilot-providers'

const CHUNK_K = parseInt(process.env.PILOT_CHUNK_K ?? '300', 10)
const RRF_K = parseInt(process.env.PILOT_RRF_K ?? '60', 10)
const TOPN = 20
/** wVec grid. 0 = BM25-alone · 0.5 = the pilot's naive RRF · 1 = vector-alone. */
const WEIGHTS = [0, 0.3, 0.5, 0.6, 0.7, 0.8, 0.9, 1] as const
const OUT_MD = path.join(__dirname, '../../../docs/FUSION_RESULTS.md')
const OUT_JSON = path.join(__dirname, '../../../docs/fusion_tuning.json')
const PILOT_JSON = path.join(__dirname, '../../../docs/pilot_results.json')

type SectionMeta = { sectionId: string; tier: string; corpus: string; sectionTitle: string | null; haystack: string }

/** recall@20 of an ordered sectionId list against a gold query (== pilot-score). */
function score(q: GoldQuery, ordered: string[], meta: Map<string, SectionMeta>): number {
  const stacks = ordered.slice(0, TOPN).map((id) => meta.get(id)?.haystack ?? id)
  const found = q.expected.filter((src) => stacks.some((h) => src.patterns.some((p) => p.test(h)))).length
  return q.expected.length ? found / q.expected.length : 0
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const pp = (d: number) => `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}pp`
const wlab = (w: number) => (w === 0 ? '0/100 (BM25)' : w === 1 ? '100/0 (vector)' : `${Math.round(w * 100)}/${Math.round((1 - w) * 100)}${w === 0.5 ? ' (naive RRF)' : ''}`)

/** Weighted RRF. w=0 → BM25 order, w=1 → vector order, w=.5 ≡ naive RRF. */
function fuseWeighted(vec: string[], bm: string[], w: number): string[] {
  const s = new Map<string, number>()
  if (w > 0) vec.forEach((id, i) => s.set(id, (s.get(id) ?? 0) + w / (RRF_K + i + 1)))
  if (w < 1) bm.forEach((id, i) => s.set(id, (s.get(id) ?? 0) + (1 - w) / (RRF_K + i + 1)))
  return [...s.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
}

async function main() {
  const conn = await connectLance()
  const chunks = await conn.openTable(PILOT_CHUNKS)

  // ── section metadata + haystack map (identical to pilot-score) ────────────────
  console.log('[pilot-fusion] loading pilot_chunks → section map…')
  const meta = new Map<string, SectionMeta>()
  const bodyParts = new Map<string, string[]>()
  {
    const all = await chunks.query()
      .select(['chunkId', 'sectionId', 'corpus', 'tier', 'sectionTitle', 'body']).limit(500_000).toArray() as any[]
    all.sort((a, b) => (a.chunkId < b.chunkId ? -1 : a.chunkId > b.chunkId ? 1 : 0))
    for (const r of all) {
      if (!meta.has(r.sectionId)) { meta.set(r.sectionId, { sectionId: r.sectionId, tier: r.tier, corpus: r.corpus, sectionTitle: r.sectionTitle ?? null, haystack: '' }); bodyParts.set(r.sectionId, []) }
      bodyParts.get(r.sectionId)!.push(r.body ?? '')
    }
    for (const [sid, m] of meta) m.haystack = `${sid}\n${m.sectionTitle ?? ''}\n${bodyParts.get(sid)!.join(' ')}`
  }
  console.log(`[pilot-fusion] ${meta.size} sections in subset`)

  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })
  const actIndex = await loadActIndex(pool)
  await pool.end()
  const subsetIds = [...meta.keys()]

  // ── BM25 arm (identical to pilot-score, incl. the citation-resolver pin) ──────
  async function bm25Ranking(q: GoldQuery): Promise<string[]> {
    const rows = await chunks.search(q.query, 'fts', 'body').limit(CHUNK_K).toArray() as any[]
    const terms = queryTerms(q.query)
    const best = new Map<string, number>()
    for (const r of rows) {
      const m = meta.get(r.sectionId)
      const title = m?.sectionTitle ?? null
      const titleBoost = title && terms.some((t) => title.toLowerCase().includes(t)) ? TITLE_BOOST : 1
      const tierBoost = m?.tier === 'legislation' ? LEX_LEG_TIER_BOOST : 1
      const s = (typeof r._score === 'number' ? r._score : 0) * titleBoost * tierBoost
      if (!best.has(r.sectionId) || s > best.get(r.sectionId)!) best.set(r.sectionId, s)
    }
    let ordered = [...best.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
    const parsed = parseCitation(q.query)
    if (parsed) {
      const r = resolveCitation(parsed, actIndex)
      if (r) {
        const { exact, actLevel } = idPatternsFor(r)
        const like = (exact ?? actLevel).replace(/^%/, '').replace(/%$/, '')
        const cap = exact ? 4 : 12
        const inj = subsetIds.filter((id) => id.includes(like)).slice(0, cap)
        if (inj.length) ordered = [...new Set([...inj, ...ordered])]
      }
    }
    return ordered
  }

  // ── vector arm (identical to pilot-score) — in-memory exact cosine ────────────
  type MemVec = { sectionId: string; v: Float32Array; norm: number }
  const l2 = (v: ArrayLike<number>) => { let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * v[i]; return Math.sqrt(s) || 1 }
  function vecRankingMem(vecs: MemVec[], qv: number[]): string[] {
    const qn = l2(qv)
    const best = new Map<string, number>()
    for (const it of vecs) {
      const v = it.v; let dot = 0
      for (let i = 0; i < v.length; i++) dot += v[i] * qv[i]
      const sim = dot / (it.norm * qn)
      const cur = best.get(it.sectionId)
      if (cur === undefined || sim > cur) best.set(it.sectionId, sim)
    }
    return [...best.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  }

  const scored: GoldQuery[] = GOLD.filter((q) => q.metric === 'recall@20' && q.scoreable)

  // ── router: the production-detectable citation signal ─────────────────────────
  const isCitation = new Map(scored.map((q) => [q.id, parseCitation(q.query) !== null]))
  const citIds = scored.filter((q) => isCitation.get(q.id)).map((q) => q.id)
  console.log(`[pilot-fusion] router: ${citIds.length}/${scored.length} scored queries classify as CITATION → ${citIds.join(', ')}`)

  // BM25 once
  console.log('[pilot-fusion] BM25 rankings…')
  const bm25Ranks = new Map<string, string[]>()
  for (const q of scored) bm25Ranks.set(q.id, await bm25Ranking(q))

  // ── per model: vector rankings, then the whole sweep is in-memory arithmetic ──
  const providers = enabledProviders()
  const vecTables = await conn.tableNames()
  type ModelSweep = {
    slug: string; model: string; dims: number
    /** recallByWeight[w].get(qid) — per-query recall@20 of weighted RRF at wVec=w */
    recallByWeight: Map<number, Map<string, number>>
  }
  const results: ModelSweep[] = []

  for (const p of providers) {
    const tname = `pilot_vec_${p.slug}`
    if (!vecTables.includes(tname)) { console.log(`[pilot-fusion] skip ${p.slug} — ${tname} not embedded`); continue }
    console.log(`[pilot-fusion] loading ${tname} vectors into memory…`)
    const table = await conn.openTable(tname)
    const vecRanks = new Map<string, string[]>()
    {
      const raw = await table.query().select(['sectionId', 'vector']).limit(1_000_000).toArray() as any[]
      const vecs: MemVec[] = raw.map((r) => { const v = Float32Array.from(r.vector as ArrayLike<number>); return { sectionId: r.sectionId as string, v, norm: l2(v) } })
      raw.length = 0
      console.log(`[pilot-fusion] ${p.slug}: ${vecs.length} vectors — embedding ${scored.length} queries (one batch) + ranking`)
      const qvs = await p.embed(scored.map((q) => q.query), 'query')
      for (let i = 0; i < scored.length; i++) vecRanks.set(scored[i].id, vecRankingMem(vecs, qvs[i]))
    } // vecs out of scope → GC before the next model loads

    const recallByWeight = new Map<number, Map<string, number>>()
    for (const w of WEIGHTS) {
      const m = new Map<string, number>()
      for (const q of scored) m.set(q.id, score(q, fuseWeighted(vecRanks.get(q.id)!, bm25Ranks.get(q.id)!, w), meta))
      recallByWeight.set(w, m)
    }
    results.push({ slug: p.slug, model: p.model, dims: p.dims, recallByWeight })
  }

  // ── aggregation helpers ────────────────────────────────────────────────────────
  const exIds = scored.filter((q) => !q.floor).map((q) => q.id)
  const archetypes = ['A', 'B', 'C', 'D', 'E', 'F'] as const
  const idsOf = (arch: string) => scored.filter((q) => q.archetype === arch).map((q) => q.id)
  const agg = (m: Map<string, number>, ids: string[]) => mean(ids.map((id) => m.get(id)!))
  /** routed per-query recall: citation queries at wCit, concept queries at wCon */
  const routedMap = (r: ModelSweep, wCit: number, wCon: number) => {
    const m = new Map<string, number>()
    for (const q of scored) m.set(q.id, r.recallByWeight.get(isCitation.get(q.id) ? wCit : wCon)!.get(q.id)!)
    return m
  }

  // ── self-check: w=.5 must reproduce the pilot's naive-RRF hybrid ──────────────
  let selfCheck: { slug: string; sweep: number; pilot: number }[] = []
  if (fs.existsSync(PILOT_JSON)) {
    const pilot = JSON.parse(fs.readFileSync(PILOT_JSON, 'utf8'))
    for (const r of results) {
      const pm = (pilot.models ?? []).find((m: any) => m.slug === r.slug)
      if (pm) selfCheck.push({ slug: r.slug, sweep: agg(r.recallByWeight.get(0.5)!, exIds), pilot: pm.hybrid.exclFloor })
    }
    for (const c of selfCheck) {
      const ok = Math.abs(c.sweep - c.pilot) < 0.001
      console.log(`[pilot-fusion] self-check ${c.slug}: w=0.5 → ${pct(c.sweep)} vs pilot hybrid ${pct(c.pilot)} ${ok ? 'MATCH' : '*** MISMATCH ***'}`)
    }
  }

  // ── report ─────────────────────────────────────────────────────────────────────
  const md: string[] = []
  md.push('# FUSION_RESULTS — weighted-RRF sweep + kind-based routing (pilot subset)', '')
  md.push(`*Generated ${new Date().toISOString()}. recall@20 over the ${meta.size}-section pilot subset, same arms/scoring as \`PILOT_RESULTS.md\` (CHUNK_K=${CHUNK_K}, RRF_K=${RRF_K}). Fused score = w·1/(K+rank_vec) + (1−w)·1/(K+rank_bm25); w=0 ≡ BM25-alone, w=0.5 ≡ the pilot's naive RRF (self-check below), w=1 ≡ vector-alone. Overall = excl. the archetype-D [GRAPH] floor (n=${exIds.length}). Router = \`parseCitation()\` (production-detectable "section N … Act YYYY" pattern).*`, '')

  if (selfCheck.length) {
    md.push('## Self-check — w=0.5 reproduces the pilot naive-RRF hybrid', '')
    md.push('| model | sweep w=0.5 | pilot hybrid | match |', '|---|---|---|---|')
    for (const c of selfCheck) md.push(`| ${c.slug} | ${pct(c.sweep)} | ${pct(c.pilot)} | ${Math.abs(c.sweep - c.pilot) < 0.001 ? '✓' : '✗ MISMATCH'} |`)
    md.push('')
  }

  md.push('## Router classification (parseCitation on the raw query)', '')
  md.push(`**CITATION** (${citIds.length}): ${citIds.join(', ') || '—'}  `)
  md.push(`**CONCEPT** (${scored.length - citIds.length}): ${scored.filter((q) => !isCitation.get(q.id)).map((q) => q.id).join(', ')}`, '')

  for (const r of results) {
    md.push(`## ${r.slug} (${r.model}) — fixed-weight sweep`, '')
    md.push('| w (vec/BM25) | overall excl-floor | Δ vs naive RRF | A (citation) | B (lay concept) | B6 | C | E | F |', '|---|---|---|---|---|---|---|---|---|')
    const naive = agg(r.recallByWeight.get(0.5)!, exIds)
    for (const w of WEIGHTS) {
      const m = r.recallByWeight.get(w)!
      md.push(`| ${wlab(w)} | **${pct(agg(m, exIds))}** | ${pp(agg(m, exIds) - naive)} | ${pct(agg(m, idsOf('A')))} | ${pct(agg(m, idsOf('B')))} | ${pct(m.get('B6')!)} | ${pct(agg(m, idsOf('C')))} | ${pct(agg(m, idsOf('E')))} | ${pct(agg(m, idsOf('F')))} |`)
    }
    md.push('')
  }

  md.push('## Kind-based routing — full (wCit, wCon) grid, best per model', '')
  md.push('*Routed = citation-classified queries fused at wCit, concept queries at wCon. Grid = all pairs from the sweep. Top rows per model by overall; ties broken toward the simplest (wCit=0 = pure BM25+resolver for citations).*', '')
  const routedBest: Record<string, { wCit: number; wCon: number; overall: number }[]> = {}
  for (const r of results) {
    const combos: { wCit: number; wCon: number; overall: number; A: number; B6: number }[] = []
    for (const wCit of WEIGHTS) for (const wCon of WEIGHTS) {
      const m = routedMap(r, wCit, wCon)
      combos.push({ wCit, wCon, overall: agg(m, exIds), A: agg(m, idsOf('A')), B6: m.get('B6')! })
    }
    combos.sort((a, b) => b.overall - a.overall || a.wCit - b.wCit || b.wCon - a.wCon)
    routedBest[r.slug] = combos.slice(0, 5).map(({ wCit, wCon, overall }) => ({ wCit, wCon, overall }))
    md.push(`### ${r.slug}`, '')
    md.push('| wCit (vec/BM25) | wCon (vec/BM25) | overall excl-floor | A | B6 |', '|---|---|---|---|---|')
    for (const c of combos.slice(0, 5)) md.push(`| ${wlab(c.wCit)} | ${wlab(c.wCon)} | **${pct(c.overall)}** | ${pct(c.A)} | ${pct(c.B6)} |`)
    md.push('')
  }

  // fixed-vs-routed comparison
  md.push('## Fixed weight vs routing — the flag-flip comparison', '')
  md.push('| model | BM25 | naive RRF (w=.5) | best fixed w | best fixed | vector-alone | best routed |', '|---|---|---|---|---|---|---|')
  for (const r of results) {
    let bestW = 0.5
    for (const w of WEIGHTS) if (agg(r.recallByWeight.get(w)!, exIds) > agg(r.recallByWeight.get(bestW)!, exIds)) bestW = w
    md.push(`| ${r.slug} | ${pct(agg(r.recallByWeight.get(0)!, exIds))} | ${pct(agg(r.recallByWeight.get(0.5)!, exIds))} | ${wlab(bestW)} | **${pct(agg(r.recallByWeight.get(bestW)!, exIds))}** | ${pct(agg(r.recallByWeight.get(1)!, exIds))} | **${pct(routedBest[r.slug][0].overall)}** (${wlab(routedBest[r.slug][0].wCit)} / ${wlab(routedBest[r.slug][0].wCon)}) |`)
  }
  md.push('')

  // per-query detail for the primary model at key weights
  const prime = results.find((r) => r.slug === 'gemini') ?? results[0]
  if (prime) {
    md.push(`## Per-query recall@20 — ${prime.slug} at key weights`, '')
    md.push('| id | arch | route | w=0 (BM25) | w=.5 (naive) | w=.7 | w=.8 | w=.9 | w=1 (vec) |', '|---|---|---|---|---|---|---|---|---|')
    for (const q of scored) {
      const cells = [0, 0.5, 0.7, 0.8, 0.9, 1].map((w) => pct(prime.recallByWeight.get(w)!.get(q.id)!)).join(' | ')
      md.push(`| ${q.id} | ${q.archetype}${q.floor ? '·fl' : ''} | ${isCitation.get(q.id) ? 'CIT' : 'con'} | ${cells} |`)
    }
    md.push('')
  }

  fs.writeFileSync(OUT_MD, md.join('\n'))
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    subsetSections: meta.size, chunkK: CHUNK_K, rrfK: RRF_K, weights: WEIGHTS,
    nQueries: scored.length, nExclFloor: exIds.length,
    router: { citation: citIds, concept: scored.filter((q) => !isCitation.get(q.id)).map((q) => q.id) },
    selfCheck,
    models: results.map((r) => ({
      slug: r.slug, model: r.model, dims: r.dims,
      byWeight: WEIGHTS.map((w) => ({
        w,
        overallExclFloor: agg(r.recallByWeight.get(w)!, exIds),
        byArch: archetypes.map((a) => ({ archetype: a, recall: agg(r.recallByWeight.get(w)!, idsOf(a)) })),
        b6: r.recallByWeight.get(w)!.get('B6')!,
        perQuery: scored.map((q) => ({ id: q.id, recall: r.recallByWeight.get(w)!.get(q.id)! })),
      })),
      routedTop5: routedBest[r.slug],
    })),
  }, null, 2))

  for (const r of results) {
    const line = WEIGHTS.map((w) => `w=${w}:${pct(agg(r.recallByWeight.get(w)!, exIds))}`).join('  ')
    console.log(`[pilot-fusion] ${r.slug}  ${line}`)
    console.log(`[pilot-fusion] ${r.slug}  best routed: wCit=${routedBest[r.slug][0].wCit} wCon=${routedBest[r.slug][0].wCon} → ${pct(routedBest[r.slug][0].overall)}`)
  }
  console.log(`[pilot-fusion] wrote ${OUT_MD} + ${OUT_JSON}`)
}

main().catch((e) => { console.error('[pilot-fusion] FATAL', e); process.exit(1) })
