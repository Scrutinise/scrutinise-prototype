/**
 * audit-s14-scores.ts — SEARCH S14 §1. THE AUDIT, AND IT CHANGES NOTHING.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * §1 REPORTS BEFORE §2 BUILDS. The brief's reason is specific: "the obvious replacement does not
 * work, and a sprint that discovers that halfway through will ship the wrong thing."
 *
 * Three questions, each answered from the live stack rather than from the code:
 *
 *   §1.1  WHAT ARE EACH STREAM'S SCORES, ACTUALLY? Printed per stream on the SAME query, with the
 *         `scorer` that produced them. The brief's warning is a real incident in this repository:
 *         `groupForPanel` sorted RRF (~0.01) against raw BM25 (~5–25) until 2026-08-09.
 *
 *   §1.2  CAN PLAIN RANK FUSION ACROSS STREAMS FIX THIS? Measured, not argued: the pairwise
 *         overlap between the streams' returned id sets. If the sets are disjoint, an unweighted
 *         rank fusion across them is arithmetically identical to round-robin, and anyone reaching
 *         for RRF here rebuilds today's behaviour and measures no change.
 *
 *   §1.4  HOW WIDE CAN RETRIEVAL GO BEFORE IT HURTS? Wall-clock for the whole routed fan-out at
 *         several per-stream widths, taken through `mapWithLimit` at the production concurrency,
 *         with `served` read off both services either side so a run that did not engage them
 *         cannot be reported as a latency figure.
 *
 * ── WHY IT CALLS THE PRODUCTION STREAM OBJECTS ──────────────────────────────────────────────────
 * `streams()` from query-router.ts is the live table of stream retrieval functions — the same ones
 * `runRoutedSearch` dispatches. A harness that rebuilt the scopes and the two legs would measure a
 * COPY (stream-scopes.ts records what a copy costs). Nothing here re-implements retrieval.
 *
 * ⚠ CUT-OFF, STATED. Distributions are over the WHOLE list each stream returned at the stated
 * width, not a top-N slice; the top-N figures are labelled where they appear.
 *
 * Usage:  bash scripts/s14-run.sh audit-scores [--json ../docs/census/s14-score-audit.json]
 */
import fs from 'node:fs'
import path from 'node:path'
import { routeQuery } from '../lib/lex/query-expansion'
import { streams } from '../lib/lex/query-router'
import { mapWithLimit, streamConcurrency } from '../lib/lex/stream-batch'
import { assertRetrievalConfig, resolvedConfigLine, readServiceConfig, servedDelta } from '../lib/lex/harness-preflight'
import { capabilityLine } from '../lib/env-flags'
import type { SearchResult } from '../lib/lex/page1-config'
import type { RouteResult } from '../lib/lex/query-expansion'

export {}

const JSON_OUT = (() => { const i = process.argv.indexOf('--json'); return i >= 0 ? process.argv[i + 1] : null })()

/**
 * The probe queries. Chosen to span the archetypes the validated set contains — a legal-doctrine
 * question, a policy question with a live Hansard vocabulary, and a regulator/guidance question —
 * so a claim about score scales is not made from one query's accident.
 *
 * ⚠ These are PROBES, not a gold set. Nothing here is scored against an answer key; §1 is about
 * the SHAPE of the numbers each stream produces, which does not need a key.
 */
const PROBES = [
  'landlords evicting tenants without a reason',
  'sewage discharge by water companies',
  'vicarious liability for an employee assault',
]

const WIDTHS = [20, 30, 50]

const num = (n: number) => (Number.isFinite(n) ? n.toFixed(4) : '—')
function quantiles(xs: number[]) {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const at = (q: number) => s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]
  return { n: s.length, min: s[0], p25: at(0.25), median: at(0.5), p75: at(0.75), max: s[s.length - 1] }
}

interface StreamProbe {
  stream: string
  query: string
  returned: number
  scorers: string[]
  scores: number[]
  ids: string[]
  ms: number
}

async function probeStreams(route: RouteResult, width: number): Promise<StreamProbe[]> {
  const active = streams().filter((s) => route[s.name])
  const { results } = await mapWithLimit(active, streamConcurrency(), async (s) => {
    const t0 = Date.now()
    const hits: SearchResult[] = await s.search(route[s.name]!, width)
    return { hits, ms: Date.now() - t0 }
  })
  return active.map((s, i) => ({
    stream: s.name,
    query: route[s.name]!,
    returned: results[i].hits.length,
    scorers: [...new Set(results[i].hits.map((r) => r.scorer ?? 'unstamped'))],
    scores: results[i].hits.map((r) => r.score),
    ids: results[i].hits.map((r) => r.id),
    ms: results[i].ms,
  }))
}

async function main() {
  console.log('═'.repeat(118))
  console.log('SEARCH S14 §1 — THE AUDIT. SCORE SCALES, RANK-FUSION OVERLAP, AND THE COST OF A WIDER WINDOW.')
  console.log('NOTHING IS CHANGED BY THIS SCRIPT.')
  console.log('═'.repeat(118))
  assertRetrievalConfig('audit-s14-scores')
  console.log(`  ${capabilityLine()}`)
  console.log(`  ${resolvedConfigLine()}`)
  console.log(`  stream concurrency  ${streamConcurrency()}  (LEX_STREAM_CONCURRENCY)`)

  const before = await readServiceConfig()
  before.forEach((s) => console.log(`  ${s.name.padEnd(7)} ${s.detail}`))
  console.log()

  const out: any = { takenAt: new Date().toISOString(), config: resolvedConfigLine(), probes: [], widths: [] }

  // ── §1.1 + §1.2 ────────────────────────────────────────────────────────────────────────────
  for (const q of PROBES) {
    const route = await routeQuery(q.split(/\s+/), '')
    if (!route) { console.log(`  ⚠ "${q}" — routeQuery returned null; SKIPPED (this is a router failure, not a result)`); continue }
    const probes = await probeStreams(route, 20)

    console.log('─'.repeat(118))
    console.log(`  QUERY: "${q}"`)
    console.log(`  routed: ${probes.map((p) => p.stream).join(', ')}`)
    console.log(`  ${'stream'.padEnd(20)} ${'scorer'.padEnd(12)} ${'n'.padEnd(5)} ${'min'.padEnd(11)} ${'median'.padEnd(11)} ${'max'.padEnd(11)} rank-1 score`)
    for (const p of probes) {
      const qs = quantiles(p.scores)
      console.log(`  ${p.stream.padEnd(20)} ${p.scorers.join('+').padEnd(12)} ${String(p.returned).padEnd(5)} ` +
        `${num(qs?.min ?? NaN).padEnd(11)} ${num(qs?.median ?? NaN).padEnd(11)} ${num(qs?.max ?? NaN).padEnd(11)} ${num(p.scores[0] ?? NaN)}`)
    }

    // ⚠ THE SCALE COMPARISON, STATED AS A RATIO RATHER THAN LEFT TO THE EYE. The question the
    // brief asks is whether two streams' scores are on comparable scales; the answer is a number.
    const tops = probes.filter((p) => p.scores.length).map((p) => ({ s: p.stream, v: p.scores[0], sc: p.scorers.join('+') }))
    if (tops.length > 1) {
      const hi = tops.reduce((a, b) => (b.v > a.v ? b : a))
      const lo = tops.reduce((a, b) => (b.v < a.v ? b : a))
      const ratio = lo.v === 0 ? Infinity : hi.v / lo.v
      console.log(`  ▶ rank-1 score spread across streams: ${lo.s} ${num(lo.v)} (${lo.sc}) … ${hi.s} ${num(hi.v)} (${hi.sc})  =  ${Number.isFinite(ratio) ? `${ratio.toFixed(1)}×` : '∞'}`)
    }

    // §1.2 — the overlap. Disjoint sets ⇒ rank fusion across streams IS round-robin.
    let pairs = 0, overlapping = 0, shared = 0
    for (let i = 0; i < probes.length; i++) {
      for (let j = i + 1; j < probes.length; j++) {
        pairs++
        const a = new Set(probes[i].ids)
        const common = probes[j].ids.filter((id) => a.has(id)).length
        if (common) { overlapping++; shared += common }
      }
    }
    console.log(`  ▶ pairwise id overlap between streams: ${overlapping}/${pairs} pairs share ANY document (${shared} shared ids in total)`)
    out.probes.push({ query: q, routed: probes.map((p) => p.stream), pairs, overlappingPairs: overlapping, sharedIds: shared,
      streams: probes.map((p) => ({ stream: p.stream, query: p.query, returned: p.returned, scorers: p.scorers, quantiles: quantiles(p.scores), top: p.scores[0] ?? null, ms: p.ms })) })
  }

  // ── §1.4 — how wide can retrieval go? ──────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(118))
  console.log('  §1.4 — THE COST OF A WIDER PER-STREAM WINDOW. Wall-clock for the WHOLE routed fan-out,')
  console.log(`         dispatched through mapWithLimit at concurrency ${streamConcurrency()} — i.e. what a user waits.`)
  const widthQuery = PROBES[1]
  const widthRoute = await routeQuery(widthQuery.split(/\s+/), '')
  if (!widthRoute) {
    console.log('  ⚠ routeQuery returned null for the width probe — NOT MEASURED (a router failure, not a latency result)')
  } else {
    console.log(`  query "${widthQuery}" · streams ${Object.keys(widthRoute).length}`)
    console.log(`  ${'per-stream width'.padEnd(20)} ${'fan-out ms'.padEnd(13)} ${'slowest stream'.padEnd(24)} results returned`)
    for (const w of WIDTHS) {
      const t0 = Date.now()
      const probes = await probeStreams(widthRoute, w)
      const ms = Date.now() - t0
      const slowest = probes.reduce((a, b) => (b.ms > a.ms ? b : a))
      const total = probes.reduce((n2, p) => n2 + p.returned, 0)
      console.log(`  ${String(w).padEnd(20)} ${String(ms).padEnd(13)} ${`${slowest.stream} ${slowest.ms}ms`.padEnd(24)} ${total} (${probes.map((p) => `${p.stream}:${p.returned}`).join(' ')})`)
      out.widths.push({ width: w, fanoutMs: ms, slowest: { stream: slowest.stream, ms: slowest.ms }, perStream: probes.map((p) => ({ stream: p.stream, returned: p.returned, ms: p.ms })) })
    }
    console.log('  ⚠ `limit` is a PER-STREAM budget and each stream over-fetches ×3 (capped at 100), so a')
    console.log('    "width" of 20 asks the services for 60 rows per stream. The returned count is what')
    console.log('    survived the display-type filter, which is why it is printed rather than assumed.')
  }

  const after = await readServiceConfig()
  console.log(`\n  service engagement: ${servedDelta(before, after)}`)
  out.served = servedDelta(before, after)

  if (JSON_OUT) {
    fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true })
    fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2))
    console.log(`  wrote ${JSON_OUT}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
