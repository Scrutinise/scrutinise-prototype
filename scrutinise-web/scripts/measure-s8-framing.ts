// ─────────────────────────────────────────────────────────────────────────────
// measure-s8-framing.ts — BRIEF_SEARCH_S8 §3. GOLD TEST 11, re-homed so both arms run
// through the real gateway.
//
// ════════════════════════════════════════════════════════════════════════════════════════════
// WHY THIS FILE EXISTS AND `scripts/ingest/search/measure-s7-framing.ts` DOES NOT
// ════════════════════════════════════════════════════════════════════════════════════════════
// S7's version measured **bare BM25 against `corpus_fts`** — no tier scoping, no per-stream
// fusion, no query expansion, no citation resolver — and scored 8.1% recall against a platform
// headline of ~62%. At that floor **27 of 31 queries returned nothing in BOTH arms**, so only 4
// could have differed in either direction and the "+0.0pp" result was a floor effect rather than
// a finding. S7 diagnosed it correctly and said so in its own output.
//
// ⚠ THE FAULT WAS THE HARNESS'S LOCATION, NOT ITS DESIGN. `scripts/ingest` sets `rootDir: "."`
// and cannot import anything under `scrutinise-web/`, so it could not reach `runSearch()` and had
// to call `rankedSearch` directly. This file is that harness MOVED, not forked: the S7 one is
// deleted in the same commit, because two framing harnesses with two leak tests would drift and
// the wrong one would be quoted.
//
// KEPT FROM S7, DELIBERATELY:
//   · per-query alternating run order (cache warming has misled a measurement here before)
//   · the DIFFERENTIAL leak test (a question naming its own subject is not a leak)
//   · the framing recorded in the report header, in the words that distinguish it
//   · the headroom count, printed by the harness itself rather than derived by a reader
//
// ADDED FOR S8:
//   · both arms go through `runSearch()` — real routing, fusion, expansion
//   · the flag state is READ POSITIVELY off the running services (`served` counters either side
//     of the run), not inferred from `process.env`
//
//   FTS_SEARCH_URL=… LEX_QUERY_ROUTER=true LEX_VECTOR_STREAMS=… \
//     npx tsx --env-file=.env scripts/measure-s8-framing.ts --out=../docs/GOLD_TEST_11_framing.md
//   npx tsx scripts/measure-s8-framing.ts --self-test    # offline, no DB, no network
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { runSearch } from '../lib/lex/search-gateway'
import {
  assertRetrievalConfig, resolvedConfigLine, readServiceConfig, servedDelta,
  type ServiceReadback,
} from '../lib/lex/harness-preflight'
// ⚠ The gold set is imported from the ingest tree rather than copied. It is pure data with no
// runtime imports, so it crosses the boundary cleanly — and a copied gold set is a gold set that
// silently stops matching the one everything else is scored against.
import { GOLD } from '../../scripts/ingest/search/gold-queries'

export {}

const arg = (n: string) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null }
const flag = (n: string) => process.argv.includes(`--${n}`)
const OUT = arg('out') ?? path.join(__dirname, '..', '..', 'docs', 'GOLD_TEST_11_framing.md')
const K = 20

/**
 * ⚠ THE ENRICHMENT IS THE CALLER'S CONTEXT, NOT THE ANSWER.
 *
 * The single most dangerous thing this experiment could do is leak the answer key into the query
 * and then report that enrichment helps. So the enriched form may use ONLY what a caller would
 * genuinely hold before searching: the archetype's description of the KIND of question, and the
 * stream it declares. It may never use `expect`, the answer ids, or anything derived from them.
 */
export function enrich(q: { query: string; stream?: string; kind?: string }): string {
  const bits = [q.query]
  if (q.stream) bits.push(q.stream.replace(/[+/]/g, ' '))
  if (q.kind) bits.push(q.kind)
  return bits.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * ⚠⚠ DIFFERENTIAL, AND S7's FIRST VERSION WAS NOT — it tested the enriched string alone and
 * excluded 13 of 31 scoreable queries. Every one of those "leaks" was in the ORIGINAL QUESTION:
 * "What laws govern e-scooters?" trips `/e-scooter/i`. A question naming its own subject is not a
 * leak, it is a question. Throwing those away shrank n by 42% and biased what remained towards
 * queries whose answer key happens not to use the subject's name.
 *
 * The real question is whether the ENRICHMENT ADDS a match the bare query did not already have.
 */
export function leaksAnswer(bare: string, enriched: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(enriched) && !re.test(bare))
}

/** recall@k — one expected source is found when any of its patterns matches any returned id. */
const recallAt = (ids: string[], expected: Array<{ patterns: RegExp[] }>, k: number) => {
  if (!expected.length) return null
  const top = ids.slice(0, k)
  const found = expected.filter((e) => e.patterns.some((re) => top.some((id) => re.test(id))))
  return found.length / expected.length
}

/** One arm, through the real gateway. */
async function armIds(query: string): Promise<{ ids: string[]; failed: boolean; streams: string[] }> {
  const out = await runSearch({
    keywords: query.trim().split(/\s+/).filter(Boolean),
    intent: 'GENERAL_CORPUS_CHAT', // untiered by construction, so the ROUTED path is exercised
    limit: K,
  })
  return { ids: out.results.map((r) => r.id), failed: out.failed, streams: out.meta.routedStreams ?? [] }
}

async function main() {
  if (flag('self-test')) return selftest()

  // ⚠ REFUSES TO RUN DEGRADED. A local run without the production flags is keyword-only and looks
  // like a regression (SEARCH_CONTRACT §4); producing that number without the configuration beside
  // it is exactly what S3 §7.2 exists to prevent.
  assertRetrievalConfig('measure-s8-framing')
  const before: ServiceReadback[] = await readServiceConfig()
  console.log(resolvedConfigLine())
  for (const s of before) console.log(`[readback:before] ${s.name} ${s.reachable ? 'OK' : 'UNREACHABLE'} ${s.detail}`)

  const rows: Array<{ id: string; bare: number | null; rich: number | null; leaked: boolean; failed: boolean }> = []
  let leakCount = 0
  let failedCount = 0
  const streamsSeen = new Set<string>()

  for (let i = 0; i < GOLD.length; i++) {
    const g = GOLD[i] as unknown as {
      id: string; query: string; stream?: string; kind?: string; scoreable?: boolean
      expected?: Array<{ patterns: RegExp[] }>
    }
    if (g.scoreable === false) { rows.push({ id: g.id, bare: null, rich: null, leaked: false, failed: false }); continue }
    const expected = g.expected ?? []
    const enriched = enrich(g)
    const leaked = leaksAnswer(g.query, enriched, expected.flatMap((e) => e.patterns))
    if (leaked) leakCount++

    // ⚠ ALTERNATE THE ORDER, per query. Kept from S7 verbatim.
    const richFirst = i % 2 === 1
    let bare: number | null
    let rich: number | null
    let failed = false
    if (richFirst) {
      const r = await armIds(enriched); const b = await armIds(g.query)
      rich = recallAt(r.ids, expected, K); bare = recallAt(b.ids, expected, K)
      failed = r.failed || b.failed
      for (const s of [...r.streams, ...b.streams]) streamsSeen.add(s)
    } else {
      const b = await armIds(g.query); const r = await armIds(enriched)
      bare = recallAt(b.ids, expected, K); rich = recallAt(r.ids, expected, K)
      failed = r.failed || b.failed
      for (const s of [...r.streams, ...b.streams]) streamsSeen.add(s)
    }
    if (failed) failedCount++
    rows.push({ id: g.id, bare, rich, leaked, failed })
    process.stdout.write(`  ${g.id.padEnd(8)} bare=${bare === null ? '—' : (100 * bare).toFixed(0).padStart(3)}%  rich=${rich === null ? '—' : (100 * rich).toFixed(0).padStart(3)}%${leaked ? '  LEAKED' : ''}${failed ? '  SEARCH FAILED' : ''}\n`)
  }

  const after: ServiceReadback[] = await readServiceConfig()
  const engagement = servedDelta(before, after)
  for (const s of after) console.log(`[readback:after ] ${s.name} ${s.reachable ? 'OK' : 'UNREACHABLE'} ${s.detail}`)
  console.log(`[engagement] ${engagement}`)

  const scored = rows.filter((r) => r.bare !== null && r.rich !== null && !r.leaked && !r.failed)
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const bareMean = mean(scored.map((r) => r.bare as number))
  const richMean = mean(scored.map((r) => r.rich as number))
  const better = scored.filter((r) => (r.rich as number) > (r.bare as number)).length
  const worse = scored.filter((r) => (r.rich as number) < (r.bare as number)).length
  // ⚠⚠ HEADROOM — the real sample size. A query scoring 0 in BOTH arms cannot show a difference
  // either way, so a headline without this number is a false negative dressed as a finding.
  const withHeadroom = scored.filter((r) => (r.bare as number) > 0 || (r.rich as number) > 0).length

  const md = [
    '# GOLD TEST 11 — QUERY FRAMING: BARE vs CALLER-ENRICHED',
    '',
    `*Generated ${new Date().toISOString()}. Through \`runSearch()\` — the real gateway. recall@${K}.*`,
    '',
    '## ⚠⚠ WHICH COMPARISON THIS IS',
    '',
    'This measures **bare query** versus **query plus whatever context the CALLER holds** — here the',
    "archetype's declared stream and its specific/principle kind.",
    '',
    "**It is NOT the Lex-build comparison.** That one contrasts the user's problem as typed against",
    'the problem plus their goal, their rejected options, what they already know, and their profile.',
    '**There is no user and no profile on the gold set**, so that comparison cannot be run here and',
    'no result below licenses a claim about user profiles.',
    '',
    '## ⚠ THE CONFIGURATION THIS RAN UNDER',
    '',
    'Read POSITIVELY off the running services, not inferred from the environment:',
    '',
    '```',
    resolvedConfigLine(),
    ...before.map((s) => `[before] ${s.name} ${s.reachable ? 'OK' : 'UNREACHABLE'} ${s.detail}`),
    ...after.map((s) => `[after ] ${s.name} ${s.reachable ? 'OK' : 'UNREACHABLE'} ${s.detail}`),
    `[engagement] ${engagement}`,
    '```',
    '',
    "⚠ `served` moving is what proves the retrieval this table describes actually reached the",
    'services. A zero delta beside a full results table would mean the numbers came from somewhere',
    'else, and that is a finding rather than a rounding error.',
    '',
    '## Result',
    '',
    '| | recall@20 |',
    '|---|---:|',
    `| bare query | **${(100 * bareMean).toFixed(1)}%** |`,
    `| caller-enriched | **${(100 * richMean).toFixed(1)}%** |`,
    `| difference | **${richMean >= bareMean ? '+' : ''}${(100 * (richMean - bareMean)).toFixed(1)}pp** |`,
    '',
    `Queries scored: **${scored.length}** of ${rows.length}. Enriched better on ${better}, worse on ${worse}.`,
    `Excluded: ${leakCount} for a differential leak, ${failedCount} for a failed search.`,
    '',
    '## ⚠⚠ HEADROOM — THE REAL SAMPLE SIZE',
    '',
    `**${withHeadroom} of the ${scored.length} scored queries had recall in at least one arm.**`,
    `The other ${scored.length - withHeadroom} returned nothing either way and could not have shown a`,
    'difference in either direction.',
    '',
    `**S7's harness, bare BM25 against \`corpus_fts\`, had headroom of 4 of 31.** This run, through`,
    `the gateway, has **${withHeadroom}**. That comparison is the point of re-homing the harness:`,
    'it says whether the floor effect was the measurement or the corpus.',
    '',
    '## Per query',
    '',
    '| query | bare | enriched | note |',
    '|---|---:|---:|---|',
    ...rows.map((r) => `| ${r.id} | ${r.bare === null ? '—' : (100 * r.bare).toFixed(0) + '%'} | ${r.rich === null ? '—' : (100 * r.rich).toFixed(0) + '%'} | ${r.leaked ? 'excluded — differential leak' : r.failed ? 'excluded — search failed' : r.bare === null ? 'not scoreable' : ''} |`),
    '',
  ].join('\n')

  fs.writeFileSync(OUT, md)
  console.log(`\nbare ${(100 * bareMean).toFixed(1)}%  ·  enriched ${(100 * richMean).toFixed(1)}%  ·  headroom ${withHeadroom}/${scored.length}`)
  console.log(`wrote ${OUT}`)
  console.log(resolvedConfigLine())
}

// ── offline self-test ───────────────────────────────────────────────────────────────────────
function selftest() {
  const cases: Array<[string, boolean]> = [
    ['enrichment adds the caller-held stream and kind',
      enrich({ query: 'what is the law on X', stream: 'legislation + guidance', kind: 'specific' })
        === 'what is the law on X legislation  guidance specific'.replace(/\s+/g, ' ')],
    ['⚠ a question naming its own subject is NOT a leak (differential)',
      !leaksAnswer('what laws govern e-scooters', 'what laws govern e-scooters legislation specific', [/e-scooter/i])],
    ['⚠ but enrichment that ADDS an answer-key match IS a leak',
      leaksAnswer('what is the law here', 'what is the law here dangerous dogs act 1991', [/dangerous dogs act 1991/i])],
    ['recall counts an expected source found by any pattern',
      recallAt(['primary-acts-pre-2000:ukpga/1988/50:section-21'], [{ patterns: [/ukpga\/1988\/50/] }], 20) === 1],
    ['…and misses one that is absent',
      recallAt(['something-else:1'], [{ patterns: [/ukpga\/1988\/50/] }], 20) === 0],
    ['a query with no expected sources scores null, not zero',
      recallAt(['anything'], [], 20) === null],
    ['the gold set imports across the rootDir boundary', Array.isArray(GOLD) && GOLD.length > 0],
  ]
  let bad = 0
  for (const [n, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
