/**
 * pilot-score.ts — the payoff. For each candidate model, measure recall@20 on the
 * gold set THREE ways on the identical subset chunk universe:
 *   1. BM25 baseline   — the current engine's semantics on the subset (chunk BM25
 *      collapsed to sections, + title-boost + legislation-tier boost + the archetype-A
 *      known-item citation resolver). Model-independent → computed once.
 *   2. vector-alone    — pure cosine kNN over the model's chunk embeddings, collapsed
 *      to sections. Ranks the models against each other.
 *   3. hybrid (RRF)    — vector fused with BM25 by reciprocal-rank fusion. The real
 *      end-state; "does the vector layer help" = hybrid vs the BM25 baseline.
 *
 * All three run on the SAME pilot_chunks / pilot_vec_<slug> tables (all gold answers
 * present + stratified distractors), so the comparison is apples-to-apples. Scoring
 * reuses the gold regex-over-haystack method (id \n sectionTitle \n body), identical
 * to score-fts.ts, so pilot recall is directly comparable to the full-corpus headline.
 *
 * Reports per archetype, and CALLS OUT: B6 (the MiFID legislation-burial case the
 * vector layer is meant to fix) and archetype A (citation — vector must not HURT
 * precise lookups; hybrid ≥ BM25 is the bar). Overall reported incl. and excl. the
 * archetype-D [GRAPH] engine floor.
 *
 * Run: tsx search/pilot-score.ts   → docs/PILOT_RESULTS.md + docs/pilot_results.json
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import { connectLance } from './lance'
import { PILOT_CHUNKS } from './pilot-common'
import { TITLE_BOOST, LEX_LEG_TIER_BOOST, queryTerms } from './fts-core'
import { loadActIndex, parseCitation, resolveCitation, idPatternsFor, ActIndex } from './citation-resolver'
import { GOLD, GoldQuery } from './gold-queries'
import { enabledProviders } from './pilot-providers'

const CHUNK_K = parseInt(process.env.PILOT_CHUNK_K ?? '300', 10) // chunks fetched per arm before collapse
const RRF_K = parseInt(process.env.PILOT_RRF_K ?? '60', 10)
const TOPN = 20
const OUT_MD = path.join(__dirname, '../../../docs/PILOT_RESULTS.md')
const OUT_JSON = path.join(__dirname, '../../../docs/pilot_results.json')

type SectionMeta = { sectionId: string; tier: string; corpus: string; sectionTitle: string | null; haystack: string }

/** recall@20 + MRR of an ordered sectionId list against a gold query. */
function score(q: GoldQuery, ordered: string[], meta: Map<string, SectionMeta>) {
  const top = ordered.slice(0, TOPN)
  const stacks = top.map((id) => meta.get(id)?.haystack ?? id)
  const matched = q.expected.map((src) => {
    let rank: number | null = null
    for (let i = 0; i < stacks.length; i++) if (src.patterns.some((p) => p.test(stacks[i]))) { rank = i + 1; break }
    return { label: src.label, rank }
  })
  const found = matched.filter((m) => m.rank !== null).length
  const recall = q.expected.length ? found / q.expected.length : 0
  const firstRel = matched.reduce<number | null>((b, m) => (m.rank === null ? b : b === null ? m.rank : Math.min(b, m.rank)), null)
  return { recall, mrr: firstRel ? 1 / firstRel : 0, matched }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const pp = (d: number) => `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}pp`

async function main() {
  const conn = await connectLance()
  const chunks = await conn.openTable(PILOT_CHUNKS)

  // ── section metadata + haystack map (rebuild full section text from its chunks) ─
  console.log('[pilot-score] loading pilot_chunks → section map…')
  const meta = new Map<string, SectionMeta>()
  const bodyParts = new Map<string, string[]>()
  {
    // single-shot read of all chunks (~80k); order irrelevant — we group by section
    const all = await chunks.query()
      .select(['chunkId', 'sectionId', 'corpus', 'tier', 'sectionTitle', 'body']).limit(500_000).toArray() as any[]
    all.sort((a, b) => (a.chunkId < b.chunkId ? -1 : a.chunkId > b.chunkId ? 1 : 0)) // stable body order per section
    for (const r of all) {
      if (!meta.has(r.sectionId)) { meta.set(r.sectionId, { sectionId: r.sectionId, tier: r.tier, corpus: r.corpus, sectionTitle: r.sectionTitle ?? null, haystack: '' }); bodyParts.set(r.sectionId, []) }
      bodyParts.get(r.sectionId)!.push(r.body ?? '')
    }
    for (const [sid, m] of meta) m.haystack = `${sid}\n${m.sectionTitle ?? ''}\n${bodyParts.get(sid)!.join(' ')}`
  }
  console.log(`[pilot-score] ${meta.size} sections in subset`)

  // citation resolver index (for the BM25 arm's archetype-A known-item pin)
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })
  const actIndex = await loadActIndex(pool)
  await pool.end()
  const subsetIds = [...meta.keys()]

  // ── BM25 arm (model-independent) ───────────────────────────────────────────────
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
    // known-item citation resolver: pin the exact section (or act leaves) at the top
    const parsed = parseCitation(q.query)
    if (parsed) {
      const r = resolveCitation(parsed, actIndex)
      if (r) {
        const { exact, actLevel } = idPatternsFor(r)
        const like = (exact ?? actLevel).replace(/^%/, '').replace(/%$/, '') // substring
        const cap = exact ? 4 : 12 // match production resolver caps (fts-core RESOLVE_*_MAX)
        const inj = subsetIds.filter((id) => id.includes(like)).slice(0, cap)
        if (inj.length) ordered = [...new Set([...inj, ...ordered])]
      }
    }
    return ordered
  }

  // ── vector arm (per model) — in-memory exact cosine ────────────────────────────
  // Brute-force search directly on the R2-backed Lance table re-reads the whole
  // vector column from R2 on EVERY query (no index) → tens of GB of redundant reads.
  // Instead load each model's vectors into memory ONCE, then do exact cosine kNN in
  // JS for all queries. Exact (no ANN recall loss to confound the model comparison),
  // and it collapses ALL chunks to sections (a full section ranking, not a top-K).
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

  function rrf(a: string[], b: string[]): string[] {
    const s = new Map<string, number>()
    a.forEach((id, i) => s.set(id, (s.get(id) ?? 0) + 1 / (RRF_K + i + 1)))
    b.forEach((id, i) => s.set(id, (s.get(id) ?? 0) + 1 / (RRF_K + i + 1)))
    return [...s.entries()].sort((x, y) => y[1] - x[1]).map(([id]) => id)
  }

  const scored: GoldQuery[] = GOLD.filter((q) => q.metric === 'recall@20' && q.scoreable)
  const archetypes = ['A', 'B', 'C', 'D', 'E', 'F'] as const

  // BM25 once
  console.log('[pilot-score] BM25 baseline…')
  const bm25Ranks = new Map<string, string[]>()
  for (const q of scored) bm25Ranks.set(q.id, await bm25Ranking(q))
  const bm25Scores = new Map(scored.map((q) => [q.id, score(q, bm25Ranks.get(q.id)!, meta)]))

  // per model
  const providers = enabledProviders()
  const vecTables = await conn.tableNames()
  type ModelResult = { slug: string; model: string; dims: number; vec: Map<string, ReturnType<typeof score>>; hyb: Map<string, ReturnType<typeof score>> }
  const results: ModelResult[] = []

  for (const p of providers) {
    const tname = `pilot_vec_${p.slug}`
    if (!vecTables.includes(tname)) { console.log(`[pilot-score] skip ${p.slug} — ${tname} not embedded yet`); continue }
    console.log(`[pilot-score] loading ${tname} vectors into memory…`)
    const table = await conn.openTable(tname)
    const raw = await table.query().select(['sectionId', 'vector']).limit(1_000_000).toArray() as any[]
    const vecs: MemVec[] = raw.map((r) => { const v = Float32Array.from(r.vector as ArrayLike<number>); return { sectionId: r.sectionId as string, v, norm: l2(v) } })
    console.log(`[pilot-score] ${p.slug}: ${vecs.length} vectors — scoring ${scored.length} queries`)
    const vec = new Map<string, ReturnType<typeof score>>()
    const hyb = new Map<string, ReturnType<typeof score>>()
    for (const q of scored) {
      const [qv] = await p.embed([q.query], 'query')
      const vr = vecRankingMem(vecs, qv)
      vec.set(q.id, score(q, vr, meta))
      hyb.set(q.id, score(q, rrf(vr, bm25Ranks.get(q.id)!), meta))
    }
    results.push({ slug: p.slug, model: p.model, dims: p.dims, vec, hyb })
  }

  // ── aggregate helpers ──────────────────────────────────────────────────────────
  const idsOf = (arch?: string, exclFloor = false) => scored.filter((q) => (!arch || q.archetype === arch) && (!exclFloor || !q.floor)).map((q) => q.id)
  const agg = (m: Map<string, ReturnType<typeof score>>, ids: string[]) => mean(ids.map((id) => m.get(id)!.recall))
  const bm = (ids: string[]) => mean(ids.map((id) => bm25Scores.get(id)!.recall))

  // ── report ───────────────────────────────────────────────────────────────────
  const md: string[] = []
  md.push('# PILOT_RESULTS — embedding-model bake-off (vector vs hybrid vs BM25)', '')
  md.push(`*Generated ${new Date().toISOString()}. recall@20 on the ${scored.length}-query scoreable gold set, over the ${meta.size}-section pilot subset (all gold answers + stratified distractors). CHUNK_K=${CHUNK_K}, RRF_K=${RRF_K}. BM25 arm = subset chunk-BM25 + title/leg-tier boost + archetype-A citation resolver (production semantics). Vector = pure cosine kNN. Hybrid = RRF(vector, BM25).*`, '')

  const allIds = idsOf(undefined, false)
  const exIds = idsOf(undefined, true)
  md.push('## Headline — overall recall@20 (excl. [GRAPH] floor)', '')
  md.push('| model | dims | BM25 | vector | hybrid | hybrid − BM25 |', '|---|---|---|---|---|---|')
  for (const r of results) {
    md.push(`| ${r.slug} (${r.model}) | ${r.dims} | ${pct(bm(exIds))} | ${pct(agg(r.vec, exIds))} | **${pct(agg(r.hyb, exIds))}** | ${pp(agg(r.hyb, exIds) - bm(exIds))} |`)
  }
  md.push('')
  md.push(`*BM25 baseline (excl-floor) = ${pct(bm(exIds))} over n=${exIds.length}. Incl-floor BM25 = ${pct(bm(allIds))} (n=${allIds.length}).*`, '')

  // winner
  let winner: ModelResult | null = null
  for (const r of results) if (!winner || agg(r.hyb, exIds) > agg(winner.hyb, exIds)) winner = r
  if (winner) {
    md.push(`## Winner: **${winner.slug}** (${winner.model})`, '')
    md.push(`- hybrid recall@20 (excl-floor) = **${pct(agg(winner.hyb, exIds))}** vs BM25 ${pct(bm(exIds))} = **${pp(agg(winner.hyb, exIds) - bm(exIds))}**`)
    md.push(`- vector-alone = ${pct(agg(winner.vec, exIds))}`)
    md.push('')
  }

  md.push('## Per-archetype recall@20', '')
  for (const r of results) {
    md.push(`### ${r.slug}`, '')
    md.push('| archetype | BM25 | vector | hybrid | hyb−BM25 | n |', '|---|---|---|---|---|---|')
    for (const a of archetypes) {
      const ids = idsOf(a); if (!ids.length) continue
      md.push(`| ${a}${a === 'D' ? ' (floor)' : ''} | ${pct(bm(ids))} | ${pct(agg(r.vec, ids))} | ${pct(agg(r.hyb, ids))} | ${pp(agg(r.hyb, ids) - bm(ids))} | ${ids.length} |`)
    }
    md.push('')
  }

  // callouts: B6 + archetype A
  md.push('## Callout — B6 (MiFID legislation-burial; the vector-layer flagship)', '')
  md.push('| model | BM25 | vector | hybrid |', '|---|---|---|---|')
  md.push(`| — (baseline) | ${pct(bm25Scores.get('B6')!.recall)} | — | — |`)
  for (const r of results) md.push(`| ${r.slug} | ${pct(bm25Scores.get('B6')!.recall)} | ${pct(r.vec.get('B6')!.recall)} | ${pct(r.hyb.get('B6')!.recall)} |`)
  md.push('')
  md.push('## Callout — archetype A (citation; vector must NOT hurt precise lookups → hybrid ≥ BM25)', '')
  md.push('| model | BM25 | vector | hybrid | hyb−BM25 |', '|---|---|---|---|---|')
  const aIds = idsOf('A')
  for (const r of results) md.push(`| ${r.slug} | ${pct(bm(aIds))} | ${pct(agg(r.vec, aIds))} | ${pct(agg(r.hyb, aIds))} | ${pp(agg(r.hyb, aIds) - bm(aIds))} |`)
  md.push('')

  md.push('## Per-query recall@20 (all arms)', '')
  md.push('| id | arch | BM25 |' + results.map((r) => ` v:${r.slug} | h:${r.slug} |`).join(''), '|---|---|---|' + results.map(() => '---|---|').join(''))
  for (const q of scored) {
    let row = `| ${q.id} | ${q.archetype}${q.floor ? '·fl' : ''} | ${pct(bm25Scores.get(q.id)!.recall)} |`
    for (const r of results) row += ` ${pct(r.vec.get(q.id)!.recall)} | ${pct(r.hyb.get(q.id)!.recall)} |`
    md.push(row)
  }
  md.push('')

  fs.writeFileSync(OUT_MD, md.join('\n'))
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    subsetSections: meta.size, chunkK: CHUNK_K, rrfK: RRF_K, nQueries: scored.length,
    bm25: { exclFloor: bm(exIds), inclFloor: bm(allIds), byArch: archetypes.map((a) => ({ archetype: a, recall: bm(idsOf(a)) })), b6: bm25Scores.get('B6')!.recall, A: bm(aIds) },
    models: results.map((r) => ({
      slug: r.slug, model: r.model, dims: r.dims,
      vector: { exclFloor: agg(r.vec, exIds), inclFloor: agg(r.vec, allIds), A: agg(r.vec, aIds), b6: r.vec.get('B6')!.recall, byArch: archetypes.map((a) => ({ archetype: a, recall: agg(r.vec, idsOf(a)) })) },
      hybrid: { exclFloor: agg(r.hyb, exIds), inclFloor: agg(r.hyb, allIds), A: agg(r.hyb, aIds), b6: r.hyb.get('B6')!.recall, byArch: archetypes.map((a) => ({ archetype: a, recall: agg(r.hyb, idsOf(a)) })) },
      perQuery: scored.map((q) => ({ id: q.id, archetype: q.archetype, floor: q.floor, bm25: bm25Scores.get(q.id)!.recall, vector: r.vec.get(q.id)!.recall, hybrid: r.hyb.get(q.id)!.recall })),
    })),
  }, null, 2))

  console.log('\n[pilot-score] BM25 excl-floor =', pct(bm(exIds)))
  for (const r of results) console.log(`[pilot-score] ${r.slug}: vector=${pct(agg(r.vec, exIds))} hybrid=${pct(agg(r.hyb, exIds))} (${pp(agg(r.hyb, exIds) - bm(exIds))}) | B6 vec=${pct(r.vec.get('B6')!.recall)} hyb=${pct(r.hyb.get('B6')!.recall)} | A hyb=${pct(agg(r.hyb, aIds))}`)
  console.log(`[pilot-score] wrote ${OUT_MD} + ${OUT_JSON}`)
}

main().catch((e) => { console.error('[pilot-score] FATAL', e); process.exit(1) })
