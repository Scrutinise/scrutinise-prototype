/**
 * score-fts.ts — Search S1b scoring harness (INERT until the index exists).
 *
 * Runs the 30 GOLD_QUERIES queries through the same BM25+title-boost path the
 * query service uses (fts-core.rankedSearch), then computes recall@20 + MRR per
 * archetype + overall, AND writes a by-eye top-20 dump per query so Charlie/CCh
 * can validate the citation-matcher key (brief addition #4).
 *
 * Scoring (approximate by design — see gold-queries.ts):
 *   recall@20 = (#expected sources whose pattern matched ≥1 top-20 hit) / (#expected)
 *   MRR       = 1 / (rank of the first top-20 hit matching ANY expected source)
 *
 * Floors (brief addition #5): archetype D (all [GRAPH]) cannot be answered by
 * text search alone — reported as an engine-floor, not a failure. A1/C3/D3 carry
 * [INFORCE] aspects (commencement/in-force metadata not yet extracted); their
 * in-force expectations are floors too. [BILLS] (F + B4) scores for real
 * (bills-api landed). Overall is reported BOTH including and excluding floors.
 *
 * Usage:
 *   tsx search/score-fts.ts            baseline (expansion OFF) → docs/FTS_S1b_SCORING.md + .json
 *   tsx search/score-fts.ts --ab       ALSO measure the Stage-3 payoff: for each recall@20
 *                                       query, run rankedSearch on the BARE query AND on the
 *                                       expandQuery-enriched set, and write the A/B delta →
 *                                       docs/FTS_STAGE3_AB.md + .json. Without --ab the harness
 *                                       is byte-identical to the baseline (expansion never runs).
 *   tsx search/score-fts.ts --router   ALSO measure the query-ROUTER payoff (CC brief "build
 *                                       the query router"): for each recall@20 query, run
 *                                       routeQuery() (the same LLM call search-gateway.ts uses
 *                                       behind LEX_QUERY_ROUTER) and dispatch to each named
 *                                       stream via rankedSearch tier-filtered (+ corpusToType
 *                                       split for debates/committees, mirroring query-router.ts
 *                                       exactly) → docs/FTS_ROUTER_AB.md + .json. A router
 *                                       fail-open (null/empty decision) falls back to the bare
 *                                       unfiltered query, same as search-gateway.ts.
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch, Hit } from './fts-core'
import { loadActIndex } from './citation-resolver'
import { GOLD, GoldQuery, ARCHETYPE_META } from './gold-queries'

// Stage-3 query expansion — the SAME platform function fireSearchTrigger uses.
// Loaded via runtime require with a computed path: the web file lives outside this
// package's tsconfig rootDir, so a static import would trip TS6059 (as v26-pooled-smoke
// does). tsc doesn't resolve computed-path require() → clean; tsx resolves the .ts.
type Expansion = { anchors: string[]; termsOfArt: string[]; rephrasings: string[] }
const { expandQuery, routeQuery } = require(path.join(__dirname, '../../../scrutinise-web/lib/lex/query-expansion')) as {
  expandQuery: (keywords: string[], ideaContext: string) => Promise<Expansion>
  routeQuery: (keywords: string[], ideaContext: string) => Promise<Record<string, string> | null>
}
// corpusToType is a pure function (only a type-only import of page1-config, erased at
// compile — safe to require directly via the same computed-path trick as above).
const { corpusToType } = require(path.join(__dirname, '../../../scrutinise-web/lib/lex/corpus-type-map')) as {
  corpusToType: (corpus: string, tier: string, id: string) => string | null
}

const OUT_MD = path.join(__dirname, '../../../docs/FTS_S1b_SCORING.md')
const OUT_JSON = path.join(__dirname, '../../../docs/fts_s1b_scores.json')
const OUT_AB_MD = path.join(__dirname, '../../../docs/FTS_STAGE3_AB.md')
const OUT_AB_JSON = path.join(__dirname, '../../../docs/fts_stage3_ab.json')
const OUT_ROUTER_MD = path.join(__dirname, '../../../docs/FTS_ROUTER_AB.md')
const OUT_ROUTER_JSON = path.join(__dirname, '../../../docs/fts_router_ab.json')

// query-router.ts's STREAMS config, mirrored here (can't import it directly — it
// imports fts-search.ts, which imports @/lib/prisma, outside this package's
// tsconfig rootDir and not resolvable via the require-by-computed-path trick).
// Keep in sync if the stream list in query-router.ts changes.
const ROUTER_STREAM_TIER: Record<string, string> = {
  legislation: 'legislation', debates: 'parliamentary', committees: 'parliamentary', caselaw: 'caselaw',
}
const ROUTER_STREAM_TYPES: Record<string, string[] | undefined> = {
  legislation: undefined, debates: ['DEBATE'], committees: ['COMMITTEE'], caselaw: undefined,
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Retry expandQuery over transient Gemini 503/overload (measurement only — in prod
 *  expandQuery degrades to EMPTY and the trigger falls back to the original keywords). */
async function expandWithRetry(keywords: string[], tries = 4) {
  let last = { anchors: [] as string[], termsOfArt: [] as string[], rephrasings: [] as string[] }
  for (let i = 0; i < tries; i++) {
    last = await expandQuery(keywords, '')
    if (last.anchors.length || last.termsOfArt.length || last.rephrasings.length) return last
    if (i < tries - 1) await sleep(2500)
  }
  return last
}

/** Retry routeQuery over transient Gemini 503/overload — but ONLY retry a null
 *  (transient failure/unparseable); a parsed-but-empty `{}` (the LLM judged zero
 *  streams relevant) is a real decision, not a fault, so it is returned as-is
 *  and the caller fails open exactly as search-gateway.ts does. */
async function routeWithRetry(keywords: string[], tries = 4): Promise<Record<string, string> | null> {
  let last: Record<string, string> | null = null
  for (let i = 0; i < tries; i++) {
    last = await routeQuery(keywords, '')
    if (last !== null) return last
    if (i < tries - 1) await sleep(2500)
  }
  return last
}

function ppDelta(d: number): string { const p = d * 100; return `${p > 0 ? '+' : ''}${p.toFixed(1)}pp` }

function haystack(h: Hit): string {
  return `${h.id}\n${h.sectionTitle ?? ''}\n${h.body}`
}

type QueryScore = {
  q: GoldQuery
  hits: Hit[]
  matched: { label: string; rank: number | null }[] // rank of first hit matching the source (1-based)
  recall: number
  mrr: number
}

function scoreQuery(q: GoldQuery, hits: Hit[]): QueryScore {
  const stacks = hits.map(haystack)
  const matched = q.expected.map((src) => {
    let rank: number | null = null
    for (let i = 0; i < stacks.length; i++) {
      if (src.patterns.some((p) => p.test(stacks[i]))) { rank = i + 1; break }
    }
    return { label: src.label, rank }
  })
  const found = matched.filter((m) => m.rank !== null).length
  const recall = q.expected.length ? found / q.expected.length : 0
  const firstRel = matched.reduce<number | null>((best, m) => {
    if (m.rank === null) return best
    return best === null ? m.rank : Math.min(best, m.rank)
  }, null)
  const mrr = firstRel ? 1 / firstRel : 0
  return { q, hits, matched, recall, mrr }
}

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0 }
function pctStr(x: number): string { return `${(x * 100).toFixed(1)}%` }

function dumpQuery(s: QueryScore): string {
  const q = s.q
  const lines: string[] = []
  const tag = q.metric === 'lesson'
    ? ' — PRINCIPLE (0–2, uncalibrated)'
    : q.floor ? ' — ENGINE FLOOR' : (!q.scoreable ? ' — PENDING VALIDATION' : '')
  lines.push(`### ${q.id} (${q.archetype}/${q.persona})${q.flags.length ? ' [' + q.flags.join('][') + ']' : ''}${tag}`)
  lines.push(`*Query:* ${q.query}`)
  lines.push(`*stream:* ${q.stream} · *kind:* ${q.kind} · *metric:* ${q.metric}`)
  if (q.metric === 'lesson') {
    lines.push(`*0–2 lesson:* NOT CALIBRATED — scaffold only (rubric set by example once a principle-stream result exists, §C.3). Excluded from the headline.`)
    lines.push('')
    lines.push(`Lesson target: ${q.lessonTarget ?? '(tbd)'}`)
  } else if (!q.scoreable) {
    lines.push(`*recall@20:* pending — expected-sources are TODO placeholders (§C); excluded from the headline until the validated answer-key lands.`)
    lines.push('')
    lines.push('Expected sources (TODO):')
    for (const m of s.matched) lines.push(`- ⋯ TODO — ${m.label}`)
  } else {
    lines.push(`*recall@20:* ${pctStr(s.recall)} · *MRR:* ${s.mrr.toFixed(3)}`)
    lines.push('')
    lines.push('Expected sources:')
    for (const m of s.matched) lines.push(`- ${m.rank ? `✓ @${m.rank}` : '✗ MISS'} — ${m.label}`)
  }
  lines.push('')
  lines.push('Top-20 retrieved:')
  s.hits.forEach((h, i) => {
    lines.push(`${(i + 1).toString().padStart(2)}. [${h.tier}/${h.corpus}] score=${h.score.toFixed(3)}${h.resolved ? '↑R' : ''}${h.titleBoosted ? '↑T' : ''} \`${h.id}\``)
    lines.push(`    ${h.sectionTitle ? `**${h.sectionTitle.slice(0, 100)}** — ` : ''}${h.snippet.slice(0, 160)}`)
  })
  lines.push('')
  return lines.join('\n')
}

async function main() {
  console.log('[score] opening Lance table…')
  const conn = await connectLance()
  const table = await conn.openTable(FTS_TABLE)
  console.log(`[score] rows=${await table.countRows()} — scoring ${GOLD.length} gold queries`)

  // Citation resolver index (archetype-A known-item fix). Reads NEON.
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })
  const actIndex = await loadActIndex(pool)
  await pool.end()
  console.log(`[score] act index: ${actIndex.byTitle.size} titles`)

  // A/B mode: --ab measures the Stage-3 payoff (expansion OFF vs ON). Enabling
  // expansion here is scoped to this process; the baseline outputs are unaffected.
  const AB = process.argv.includes('--ab')
  if (AB) {
    process.env.LEX_QUERY_EXPANSION = 'true'
    console.log('[score] A/B MODE — expansion ON variant computed for every recall@20 query')
  }

  // Router mode: --router measures the query-router payoff (router OFF vs ON).
  const ROUTER = process.argv.includes('--router')
  if (ROUTER) {
    process.env.LEX_QUERY_ROUTER = 'true'
    console.log('[score] ROUTER MODE — router ON variant computed for every recall@20 query')
  }

  type AbResult = { terms: string[]; anchors: string[]; on: QueryScore }
  type RouterResult = { streams: string[]; mode: 'routed' | 'fail-open'; on: QueryScore }
  const scores: QueryScore[] = []
  const ab: (AbResult | null)[] = [] // parallel to scores; null when not computed
  const router: (RouterResult | null)[] = [] // parallel to scores; null when not computed

  for (const q of GOLD) {
    // OFF (baseline): retrieval runs for every query — for principle/pending queries
    // the top-20 dump is the calibration/validation artefact (§C), even if not scored.
    const hits = await rankedSearch(table, q.query, { limit: 20, actIndex })
    const s = scoreQuery(q, hits)
    scores.push(s)

    // ON (expansion): only for recall@20 queries (lesson queries aren't recall-scored).
    let abRes: AbResult | null = null
    if (AB && q.metric === 'recall@20') {
      const exp = await expandWithRetry([q.query])
      const added = [...new Set([...exp.anchors, ...exp.termsOfArt, ...exp.rephrasings])]
      // mirror fireSearchTrigger: Set-merge the original keywords with the expansion
      const merged = [...new Set([q.query, ...added])].map((k) => k.trim()).filter(Boolean).join(' ')
      const expHits = await rankedSearch(table, merged, { limit: 20, actIndex })
      abRes = { terms: added, anchors: exp.anchors, on: scoreQuery(q, expHits) }
    }
    ab.push(abRes)

    // ON (router): only for recall@20 queries. Mirrors search-gateway.ts exactly —
    // dispatch to each named stream via a tier-filtered rankedSearch call (+ the
    // corpusToType split for debates/committees sharing the parliamentary tier),
    // merge, sort by score, take top 20. A null/empty decision fails open to the
    // bare unfiltered query, same as production.
    let routerRes: RouterResult | null = null
    if (ROUTER && q.metric === 'recall@20') {
      const route = await routeWithRetry([q.query])
      const streamNames = route ? Object.keys(route) : []
      let routedHits: Hit[]
      let mode: 'routed' | 'fail-open'
      if (route && streamNames.length) {
        mode = 'routed'
        // Sequential, NOT Promise.all: concurrent rankedSearch calls against the SAME
        // in-process Lance table handle crashed the harness twice (bare exit 255, no JS
        // stack trace — a native/Rust-binding fault under concurrent access, not a
        // catchable error). Measurement-only concern; order doesn't affect the score.
        // Flagged separately for query-router.ts's production dispatch, which also uses
        // Promise.all but through independent HTTP calls to fts-query-service rather than
        // a shared in-process handle — a different execution model, not necessarily the
        // same risk, but unconfirmed either way.
        const perStream: Hit[][] = []
        for (const name of streamNames) {
          const tier = ROUTER_STREAM_TIER[name]
          if (!tier) { perStream.push([]); continue } // unknown stream name from the LLM — ignore, don't crash
          const tailored = route[name]
          const streamHits = await rankedSearch(table, tailored, { tier, limit: 20, actIndex })
          const types = ROUTER_STREAM_TYPES[name]
          perStream.push(streamHits.filter((h) => {
            const t = corpusToType(h.corpus, h.tier, h.id)
            return types ? (t !== null && types.includes(t)) : t !== null
          }))
        }
        routedHits = perStream.flat().sort((a, b) => b.score - a.score).slice(0, 20)
      } else {
        mode = 'fail-open'
        routedHits = hits // identical call already made above for the OFF baseline
      }
      routerRes = { streams: streamNames, mode, on: scoreQuery(q, routedHits) }
    }
    router.push(routerRes)

    const status = q.metric === 'lesson' ? 'principle(0–2 uncalibrated)'
      : !q.scoreable ? 'pending(TODO)' : (q.floor ? '(floor)' : '')
    const num = q.metric === 'recall@20' && q.scoreable ? `recall@20=${pctStr(s.recall)} mrr=${s.mrr.toFixed(3)}` : ''
    const abStr = abRes ? ` | ON=${pctStr(abRes.on.recall)} (${ppDelta(abRes.on.recall - s.recall)}, +${abRes.terms.length} terms)` : ''
    const routerStr = routerRes ? ` | ROUTER=${pctStr(routerRes.on.recall)} (${ppDelta(routerRes.on.recall - s.recall)}, ${routerRes.mode}:${routerRes.streams.join(',') || 'none'})` : ''
    console.log(`  ${q.id} ${q.archetype} ${num} ${status}${abStr}${routerStr}`.trimEnd())
  }

  // ── aggregates ──────────────────────────────────────────────────────────────
  // The recall HEADLINE is over SCOREABLE recall@20 queries only (== the v1 set:
  // the new principle G–I and TODO B6/J1/K1/K2 queries are scoreable:false), so
  // these numbers are byte-identical to v1.
  const recallScores = scores.filter((s) => s.q.metric === 'recall@20' && s.q.scoreable)
  const archetypes = ['A', 'B', 'C', 'D', 'E', 'F'] as const // the scoreable recall archetypes
  const byArch = archetypes.map((a) => {
    const ss = recallScores.filter((s) => s.q.archetype === a)
    return { archetype: a, n: ss.length, recall: mean(ss.map((s) => s.recall)), mrr: mean(ss.map((s) => s.mrr)) }
  })
  const overall = { recall: mean(recallScores.map((s) => s.recall)), mrr: mean(recallScores.map((s) => s.mrr)) }
  const nonFloor = recallScores.filter((s) => !s.q.floor)
  const exFloor = { recall: mean(nonFloor.map((s) => s.recall)), mrr: mean(nonFloor.map((s) => s.mrr)), n: nonFloor.length }

  // Present-but-excluded groups (reported separately, never in the headline):
  const principle = scores.filter((s) => s.q.metric === 'lesson')                         // G–I — 0–2 scaffold
  const pending   = scores.filter((s) => s.q.metric === 'recall@20' && !s.q.scoreable)    // B6/J1/K1/K2 — TODO

  // markdown report
  const md: string[] = []
  md.push('# FTS S1b — scoring report', '')
  md.push(`*Generated ${new Date().toISOString()} against the Lance FTS dataset. Expected-sources are CCh's UNVALIDATED draft — these numbers are PROVISIONAL; the top-20 dumps below are the validation artefact.*`, '')
  md.push('## Headline', '')
  md.push(`*Headline = SCOREABLE recall@20 queries only (the v1 specific set, ${recallScores.length} queries). Principle streams G–I (0–2 lesson, rubric not calibrated) and new SPECIFIC queries with TODO expected-sources (B6, J1, K1, K2) are PRESENT but EXCLUDED until their answer-keys land — see the two tables below.*`, '')
  md.push('| scope | recall@20 | MRR | n |', '|---|---|---|---|')
  md.push(`| overall (scoreable v1 set) | ${pctStr(overall.recall)} | ${overall.mrr.toFixed(3)} | ${recallScores.length} |`)
  md.push(`| **overall excl. [GRAPH] floor** | **${pctStr(exFloor.recall)}** | **${exFloor.mrr.toFixed(3)}** | ${exFloor.n} |`)
  md.push('')
  md.push('## By archetype (scoreable recall streams)', '')
  md.push('| archetype | stream | recall@20 | MRR | n | note |', '|---|---|---|---|---|---|')
  const note: Record<string, string> = { A: '[INFORCE] aspects are floors', D: 'ALL [GRAPH] — engine floor', F: '[BILLS] scores for real' }
  for (const b of byArch) md.push(`| ${b.archetype} | ${ARCHETYPE_META[b.archetype].stream} | ${pctStr(b.recall)} | ${b.mrr.toFixed(3)} | ${b.n} | ${note[b.archetype] ?? ''} |`)
  md.push('')
  md.push('## Principle streams (G–I) — 0–2 lesson · SCAFFOLD, excluded from headline', '')
  md.push('*Metric is a 0–2 transferable-lesson judgement, not recall@20. The rubric is set by example once a principle-stream result exists (§C.3); the principle-retrieval method is not built. Scored NOT CALIBRATED for now. Top-20 dumps below exist so the rubric can later be calibrated against real output.*', '')
  md.push('| id | persona | stream | lesson target |', '|---|---|---|---|')
  for (const s of principle) md.push(`| ${s.q.id} | ${s.q.persona} | ${s.q.stream} | ${s.q.lessonTarget ?? ''} |`)
  md.push('')
  md.push('## Pending validation (specific, expected-sources TODO) — excluded from headline', '')
  md.push('*These are scoreable-in-principle recall@20 queries, but their expected-sources are TODO placeholders pending the validated answer-key (§C). Excluded from the headline until filled. B6 is the validated MiFID lay-vocabulary test; J1 is deferred (no foreign corpus).*', '')
  md.push('| id | archetype | persona | stream | query |', '|---|---|---|---|---|')
  for (const s of pending) md.push(`| ${s.q.id} | ${s.q.archetype} | ${s.q.persona} | ${s.q.stream} | ${s.q.query} |`)
  md.push('')
  md.push('## Per-query detail + top-20 eyeball dump', '')
  for (const s of scores) md.push(dumpQuery(s))

  fs.writeFileSync(OUT_MD, md.join('\n'))
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    headline: { note: 'over scoreable recall@20 queries (v1 set); principle G–I + TODO B6/J1/K1/K2 excluded', overall, exFloor },
    overall, exFloor, byArch,
    excluded: { principle: principle.map((s) => s.q.id), pending: pending.map((s) => s.q.id) },
    queries: scores.map((s) => ({
      id: s.q.id, archetype: s.q.archetype, persona: s.q.persona,
      stream: s.q.stream, kind: s.q.kind, metric: s.q.metric,
      scoreable: s.q.scoreable, todo: s.q.todo ?? false,
      flags: s.q.flags, floor: s.q.floor,
      // recall/mrr are meaningful only for scoreable recall@20 queries; null otherwise
      recall: s.q.metric === 'recall@20' && s.q.scoreable ? s.recall : null,
      mrr: s.q.metric === 'recall@20' && s.q.scoreable ? s.mrr : null,
      matched: s.matched,
    })),
  }, null, 2))

  console.log('')
  console.log(`[score] HEADLINE (scoreable v1 set, n=${recallScores.length}) overall recall@20=${pctStr(overall.recall)} mrr=${overall.mrr.toFixed(3)}`)
  console.log(`[score] excl floor recall@20=${pctStr(exFloor.recall)} mrr=${exFloor.mrr.toFixed(3)} (n=${exFloor.n})`)
  console.log(`[score] excluded from headline: ${principle.length} principle (${principle.map((s) => s.q.id).join(',')}) + ${pending.length} pending (${pending.map((s) => s.q.id).join(',')})`)
  console.log(`[score] wrote ${OUT_MD} + ${OUT_JSON}`)

  // ── A/B report (Stage-3 payoff: recall@20 OFF vs ON) ─────────────────────────
  if (AB) {
    const pairs = scores
      .map((s, i) => ({ s, ab: ab[i] }))
      .filter((x): x is { s: QueryScore; ab: AbResult } => x.ab !== null)
    const offR = (a: string) => pairs.filter((x) => x.s.q.archetype === a).map((x) => x.s.recall)
    const onR  = (a: string) => pairs.filter((x) => x.s.q.archetype === a).map((x) => x.ab.on.recall)
    const archOf = Array.from(new Set(pairs.map((x) => x.s.q.archetype)))

    const md2: string[] = []
    md2.push('# FTS Stage 3 — expansion A/B (recall@20 OFF vs ON)', '')
    md2.push(`*Generated ${new Date().toISOString()} against the Lance FTS dataset (${await table.countRows()} rows). For each recall@20 query: \`rankedSearch\` on the BARE query (OFF) vs the \`expandQuery\`-enriched keyword set (ON) — the same platform \`expandQuery\` \`fireSearchTrigger\` uses (Gemini 2.5 Flash). The concept query is modelled as a single lay keyword. Expansion feeds ONLY the FTS query (grounding guardrail).*`, '')
    md2.push('## Headline — archetype B (payoff) and A (flat check)', '')
    md2.push('| archetype | stream | recall@20 OFF | recall@20 ON | delta | n |', '|---|---|---|---|---|---|')
    for (const a of ['B', 'A'] as const) {
      md2.push(`| ${a} | ${ARCHETYPE_META[a].stream} | ${pctStr(mean(offR(a)))} | ${pctStr(mean(onR(a)))} | **${ppDelta(mean(onR(a)) - mean(offR(a)))}** | ${offR(a).length} |`)
    }
    md2.push('')
    md2.push('## All recall@20 archetypes', '')
    md2.push('| archetype | recall@20 OFF | recall@20 ON | delta | n |', '|---|---|---|---|---|')
    for (const a of archOf) md2.push(`| ${a} | ${pctStr(mean(offR(a)))} | ${pctStr(mean(onR(a)))} | ${ppDelta(mean(onR(a)) - mean(offR(a)))} | ${offR(a).length} |`)
    md2.push('')
    md2.push('## Per-query recall@20 OFF vs ON', '')
    md2.push('| id | arch | OFF | ON | delta | anchors named by expansion |', '|---|---|---|---|---|---|')
    for (const x of pairs) md2.push(`| ${x.s.q.id} | ${x.s.q.archetype} | ${pctStr(x.s.recall)} | ${pctStr(x.ab.on.recall)} | ${ppDelta(x.ab.on.recall - x.s.recall)} | ${x.ab.anchors.join('; ') || '—'} |`)
    md2.push('')
    md2.push('## Archetype B — per-source OFF vs ON (which sources the expansion pulled in)', '')
    for (const x of pairs.filter((p) => p.s.q.archetype === 'B')) {
      md2.push(`### ${x.s.q.id} — ${x.s.q.query}`)
      md2.push(`OFF ${pctStr(x.s.recall)} → ON ${pctStr(x.ab.on.recall)} (${ppDelta(x.ab.on.recall - x.s.recall)}) · anchors: ${x.ab.anchors.join('; ') || '—'}`, '')
      md2.push('| expected source | OFF | ON |', '|---|---|---|')
      x.s.matched.forEach((mOff, si) => {
        const mOn = x.ab.on.matched[si]
        const f = (m: { rank: number | null }) => (m.rank ? `✓ @${m.rank}` : '✗')
        md2.push(`| ${mOff.label} | ${f(mOff)} | ${f(mOn)} |`)
      })
      md2.push('')
    }
    fs.writeFileSync(OUT_AB_MD, md2.join('\n'))
    fs.writeFileSync(OUT_AB_JSON, JSON.stringify({
      generatedAt: new Date().toISOString(),
      byArchetype: archOf.map((a) => ({ archetype: a, n: offR(a).length, off: mean(offR(a)), on: mean(onR(a)), delta: mean(onR(a)) - mean(offR(a)) })),
      queries: pairs.map((x) => ({
        id: x.s.q.id, archetype: x.s.q.archetype, scoreable: x.s.q.scoreable,
        off: x.s.recall, on: x.ab.on.recall, delta: x.ab.on.recall - x.s.recall,
        anchors: x.ab.anchors, termsAdded: x.ab.terms.length,
        offMatched: x.s.matched, onMatched: x.ab.on.matched,
      })),
    }, null, 2))
    console.log('')
    console.log(`[score][A/B] archetype B (payoff): OFF ${pctStr(mean(offR('B')))} → ON ${pctStr(mean(onR('B')))} (${ppDelta(mean(onR('B')) - mean(offR('B')))})`)
    console.log(`[score][A/B] archetype A (flat?):  OFF ${pctStr(mean(offR('A')))} → ON ${pctStr(mean(onR('A')))} (${ppDelta(mean(onR('A')) - mean(offR('A')))})`)
    console.log(`[score][A/B] wrote ${OUT_AB_MD} + ${OUT_AB_JSON}`)
  }

  // ── Router report (per-stream routing payoff: recall@20 OFF vs ON) ───────────
  if (ROUTER) {
    const pairs = scores
      .map((s, i) => ({ s, r: router[i] }))
      .filter((x): x is { s: QueryScore; r: RouterResult } => x.r !== null)
    const offR = (a: string) => pairs.filter((x) => x.s.q.archetype === a).map((x) => x.s.recall)
    const onR  = (a: string) => pairs.filter((x) => x.s.q.archetype === a).map((x) => x.r.on.recall)
    const archOf = Array.from(new Set(pairs.map((x) => x.s.q.archetype)))
    const failOpenCount = pairs.filter((x) => x.r.mode === 'fail-open').length

    const md3: string[] = []
    md3.push('# FTS query ROUTER — per-stream routing A/B (recall@20 OFF vs ON)', '')
    md3.push(`*Generated ${new Date().toISOString()} against the Lance FTS dataset (${await table.countRows()} rows). For each recall@20 query: \`rankedSearch\` on the BARE query (OFF) vs \`routeQuery\`'s per-stream decision dispatched to tier-filtered \`rankedSearch\` calls, merged and re-sorted by score (ON) — the same \`routeQuery\`/query-router.ts path search-gateway.ts uses behind \`LEX_QUERY_ROUTER\` (Gemini 2.5 Flash). Router fail-opens (null/empty decision, ${failOpenCount}/${pairs.length} queries) fall back to the identical OFF result, so those queries show a flat delta by construction, not a router win/loss.*`, '')
    md3.push('## Headline — archetype B (payoff, the vocabulary-bridge target) and A (citation queries — expect flat or improved, NOT diluted)', '')
    md3.push('| archetype | stream | recall@20 OFF | recall@20 ON | delta | n |', '|---|---|---|---|---|---|')
    for (const a of ['B', 'A'] as const) {
      md3.push(`| ${a} | ${ARCHETYPE_META[a].stream} | ${pctStr(mean(offR(a)))} | ${pctStr(mean(onR(a)))} | **${ppDelta(mean(onR(a)) - mean(offR(a)))}** | ${offR(a).length} |`)
    }
    md3.push('')
    md3.push('## All recall@20 archetypes', '')
    md3.push('| archetype | recall@20 OFF | recall@20 ON | delta | n |', '|---|---|---|---|---|')
    for (const a of archOf) md3.push(`| ${a} | ${pctStr(mean(offR(a)))} | ${pctStr(mean(onR(a)))} | ${ppDelta(mean(onR(a)) - mean(offR(a)))} | ${offR(a).length} |`)
    md3.push('')
    md3.push('## Per-query recall@20 OFF vs ON + routing decision', '')
    md3.push('| id | arch | OFF | ON | delta | mode | streams routed |', '|---|---|---|---|---|---|---|')
    for (const x of pairs) md3.push(`| ${x.s.q.id} | ${x.s.q.archetype} | ${pctStr(x.s.recall)} | ${pctStr(x.r.on.recall)} | ${ppDelta(x.r.on.recall - x.s.recall)} | ${x.r.mode} | ${x.r.streams.join(', ') || '—'} |`)
    md3.push('')
    md3.push('## Archetype A — per-source OFF vs ON (citation dilution check)', '')
    for (const x of pairs.filter((p) => p.s.q.archetype === 'A')) {
      md3.push(`### ${x.s.q.id} — ${x.s.q.query}`)
      md3.push(`OFF ${pctStr(x.s.recall)} → ON ${pctStr(x.r.on.recall)} (${ppDelta(x.r.on.recall - x.s.recall)}) · mode: ${x.r.mode} · streams: ${x.r.streams.join(', ') || '—'}`, '')
      md3.push('| expected source | OFF | ON |', '|---|---|---|')
      x.s.matched.forEach((mOff, si) => {
        const mOn = x.r.on.matched[si]
        const f = (m: { rank: number | null }) => (m.rank ? `✓ @${m.rank}` : '✗')
        md3.push(`| ${mOff.label} | ${f(mOff)} | ${f(mOn)} |`)
      })
      md3.push('')
    }
    md3.push('## Archetype B — per-source OFF vs ON (which streams recovered the concept query)', '')
    for (const x of pairs.filter((p) => p.s.q.archetype === 'B')) {
      md3.push(`### ${x.s.q.id} — ${x.s.q.query}`)
      md3.push(`OFF ${pctStr(x.s.recall)} → ON ${pctStr(x.r.on.recall)} (${ppDelta(x.r.on.recall - x.s.recall)}) · mode: ${x.r.mode} · streams: ${x.r.streams.join(', ') || '—'}`, '')
      md3.push('| expected source | OFF | ON |', '|---|---|---|')
      x.s.matched.forEach((mOff, si) => {
        const mOn = x.r.on.matched[si]
        const f = (m: { rank: number | null }) => (m.rank ? `✓ @${m.rank}` : '✗')
        md3.push(`| ${mOff.label} | ${f(mOff)} | ${f(mOn)} |`)
      })
      md3.push('')
    }
    fs.writeFileSync(OUT_ROUTER_MD, md3.join('\n'))
    fs.writeFileSync(OUT_ROUTER_JSON, JSON.stringify({
      generatedAt: new Date().toISOString(),
      failOpenCount, totalQueried: pairs.length,
      byArchetype: archOf.map((a) => ({ archetype: a, n: offR(a).length, off: mean(offR(a)), on: mean(onR(a)), delta: mean(onR(a)) - mean(offR(a)) })),
      queries: pairs.map((x) => ({
        id: x.s.q.id, archetype: x.s.q.archetype, scoreable: x.s.q.scoreable,
        off: x.s.recall, on: x.r.on.recall, delta: x.r.on.recall - x.s.recall,
        mode: x.r.mode, streams: x.r.streams,
        offMatched: x.s.matched, onMatched: x.r.on.matched,
      })),
    }, null, 2))
    console.log('')
    console.log(`[score][ROUTER] archetype B (payoff): OFF ${pctStr(mean(offR('B')))} → ON ${pctStr(mean(onR('B')))} (${ppDelta(mean(onR('B')) - mean(offR('B')))})`)
    console.log(`[score][ROUTER] archetype A (dilution check): OFF ${pctStr(mean(offR('A')))} → ON ${pctStr(mean(onR('A')))} (${ppDelta(mean(onR('A')) - mean(offR('A')))})`)
    console.log(`[score][ROUTER] fail-opens: ${failOpenCount}/${pairs.length} queries`)
    console.log(`[score][ROUTER] wrote ${OUT_ROUTER_MD} + ${OUT_ROUTER_JSON}`)
  }
}

main().catch((e) => { console.error('[score] FATAL', e); process.exit(1) })
