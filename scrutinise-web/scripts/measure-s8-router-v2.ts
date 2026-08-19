// ─────────────────────────────────────────────────────────────────────────────
// measure-s8-router-v2.ts — BRIEF_SEARCH_S8 §4. Does adding three streams cost anything?
//
// §4 asks for three things and names the honest expected outcome up front:
//   (a) SELECTION — when is a new stream chosen, and does its choice DISPLACE a stream that was
//       serving the answer
//   (b) RECALL on the questions the old router already served — **no regression is the gate**
//   (c) LATENCY delta
//
// ⚠⚠ AND §4 PREDICTS THE GAIN WILL BE UNMEASURABLE: "the gold set has no archetype for these
// streams (same instrument problem as committees), so a *gain* is probably unmeasurable today."
// This harness is therefore built to detect a REGRESSION reliably and to report the absence of a
// measurable gain as the finding it is, rather than reaching for a number that would not mean
// anything. The flag stays OFF; this reports; Charlie decides.
//
// ⚠ BOTH ARMS RUN IN ONE PROCESS, alternating per question, against the same warm services. Two
// processes would give the two arms different cache states and different service warm-ups, and
// the latency comparison — the one number §4 most needs — would be measuring the wrong thing.
// `query-router.ts::streams()` reads the flag per call and memoises per value precisely so this
// is possible.
//
//   FTS_SEARCH_URL=… LEX_QUERY_ROUTER=true LEX_VECTOR_STREAMS=… \
//     npx tsx --env-file=.env scripts/measure-s8-router-v2.ts
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { runSearch } from '../lib/lex/search-gateway'
import { routerStreamsV2 } from '../lib/lex/query-router'
import { assertRetrievalConfig, resolvedConfigLine, readServiceConfig, servedDelta } from '../lib/lex/harness-preflight'
import { GOLD } from '../../scripts/ingest/search/gold-queries'

export {}

const OUT = path.join(__dirname, '..', '..', 'docs', 'SEARCH_S8_ROUTER_V2.md')
const K = 20
const NEW_STREAMS = ['impact-assessments', 'consultations', 'explanatory']

/** ⚠ THE SAME TEN QUESTIONS S4 AUDITED AND S5 RE-RAN. They carry no answer key, so they measure
 *  SELECTION and LATENCY only — which is what §4 asks of them ("selection looks sane on N probe
 *  questions"). Scoring them would require inventing a key, which is §5's job and not this one's. */
const S5_PROBES = [
  'companies act 2006 directors duties',
  'data protection lawful basis for processing personal data',
  'equality act public sector equality duty',
  'what have select committees said about water company sewage discharge',
  'what did MPs argue in the debate on assisted dying',
  'how have the courts interpreted the duty to make reasonable adjustments',
  'government guidance on procurement social value',
  'what evidence did witnesses give on leasehold reform',
  'has parliament scrutinised the rollout of universal credit',
  'what was said about buy now pay later regulation in parliament',
]

/** ⚠ Three questions the new streams SHOULD answer, written for this measurement and marked as
 *  such. They have no answer key either — they exist to see whether the router CHOOSES the new
 *  stream when the question is squarely about what it holds. A selection probe, not a recall one. */
const V2_PROBES = [
  { q: 'what did the government predict this policy would cost', want: 'impact-assessments' },
  { q: 'what did respondents say in the consultation on leasehold reform', want: 'consultations' },
  { q: 'what was the purpose of the Data Protection Act 2018 according to its explanatory notes', want: 'explanatory' },
]

interface Arm { streams: string[]; ids: string[]; ms: number; failed: boolean }

async function arm(query: string, v2: boolean): Promise<Arm> {
  process.env.LEX_ROUTER_STREAMS_V2 = v2 ? 'true' : 'false'
  if (routerStreamsV2() !== v2) throw new Error(`flag did not take: asked v2=${v2}, got ${routerStreamsV2()}`)
  const t0 = Date.now()
  const out = await runSearch({
    keywords: query.trim().split(/\s+/).filter(Boolean),
    intent: 'GENERAL_CORPUS_CHAT',
    limit: K,
  })
  return {
    streams: out.meta.routedStreams ?? [],
    ids: out.results.map((r) => r.id),
    ms: Date.now() - t0,
    failed: out.failed,
  }
}

const recallAt = (ids: string[], expected: Array<{ patterns: RegExp[] }>) => {
  if (!expected.length) return null
  const top = ids.slice(0, K)
  return expected.filter((e) => e.patterns.some((re) => top.some((id) => re.test(id)))).length / expected.length
}
const pct = (n: number) => `${(100 * n).toFixed(1)}%`
const percentile = (xs: number[], p: number) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}

async function main() {
  assertRetrievalConfig('measure-s8-router-v2')
  const before = await readServiceConfig()
  console.log(resolvedConfigLine())

  interface Row {
    id: string; query: string; kind: 'gold' | 's5' | 'v2-probe'
    v1: Arm; v2: Arm; r1: number | null; r2: number | null; want?: string
  }
  const rows: Row[] = []

  const scoreable = (GOLD as unknown as Array<{
    id: string; query: string; scoreable?: boolean; expected?: Array<{ patterns: RegExp[] }>
  }>).filter((g) => g.scoreable !== false)

  const work: Array<{ id: string; query: string; kind: Row['kind']; expected: Array<{ patterns: RegExp[] }>; want?: string }> = [
    ...scoreable.map((g) => ({ id: g.id, query: g.query, kind: 'gold' as const, expected: g.expected ?? [] })),
    ...S5_PROBES.map((q, i) => ({ id: `S5-${i + 1}`, query: q, kind: 's5' as const, expected: [] })),
    ...V2_PROBES.map((p, i) => ({ id: `V2-${i + 1}`, query: p.q, kind: 'v2-probe' as const, expected: [], want: p.want })),
  ]

  for (let i = 0; i < work.length; i++) {
    const w = work[i]
    // ⚠ ALTERNATE, so neither arm systematically gets the warm cache.
    const v2First = i % 2 === 1
    let a1: Arm
    let a2: Arm
    if (v2First) { a2 = await arm(w.query, true); a1 = await arm(w.query, false) }
    else { a1 = await arm(w.query, false); a2 = await arm(w.query, true) }
    const r1 = recallAt(a1.ids, w.expected)
    const r2 = recallAt(a2.ids, w.expected)
    rows.push({ id: w.id, query: w.query, kind: w.kind, v1: a1, v2: a2, r1, r2, want: w.want })
    const newChosen = a2.streams.filter((s) => NEW_STREAMS.includes(s))
    console.log(`  ${w.id.padEnd(8)} v1[${a1.streams.length}] ${a1.ms}ms  v2[${a2.streams.length}] ${a2.ms}ms  new=${newChosen.join(',') || '—'}  recall ${r1 === null ? '—' : pct(r1)} → ${r2 === null ? '—' : pct(r2)}`)
  }

  const after = await readServiceConfig()
  const engagement = servedDelta(before, after)
  console.log(`[engagement] ${engagement}`)

  // ── (b) RECALL — the gate ──────────────────────────────────────────────────────────────────
  const scored = rows.filter((r) => r.r1 !== null && r.r2 !== null && !r.v1.failed && !r.v2.failed)
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const m1 = mean(scored.map((r) => r.r1 as number))
  const m2 = mean(scored.map((r) => r.r2 as number))
  const regressed = scored.filter((r) => (r.r2 as number) < (r.r1 as number))
  const improved = scored.filter((r) => (r.r2 as number) > (r.r1 as number))

  // ── (a) SELECTION and DISPLACEMENT ─────────────────────────────────────────────────────────
  const chosenCount: Record<string, number> = {}
  for (const s of NEW_STREAMS) chosenCount[s] = rows.filter((r) => r.v2.streams.includes(s)).length
  // ⚠⚠ DISPLACEMENT IS THE RISK §4 NAMES. A new stream chosen INSTEAD of one that was serving the
  // answer is a regression even if the average recall holds, so it is counted per question and the
  // questions are named rather than summarised.
  const displaced = rows
    .map((r) => ({ id: r.id, kind: r.kind, lost: r.v1.streams.filter((s) => !r.v2.streams.includes(s)) }))
    .filter((x) => x.lost.length > 0)

  // ── (c) LATENCY ────────────────────────────────────────────────────────────────────────────
  const l1 = rows.map((r) => r.v1.ms)
  const l2 = rows.map((r) => r.v2.ms)

  const md = [
    '# SEARCH S8 §4 — ROUTER STREAMS V2, MEASURED',
    '',
    `*Generated ${new Date().toISOString()}. Both arms in ONE process, alternating per question,*`,
    '*against the same warm services. `LEX_ROUTER_STREAMS_V2` stays OFF; this is a recommendation.*',
    '',
    '```',
    resolvedConfigLine(),
    `[engagement] ${engagement}`,
    '```',
    '',
    '## The gate: no recall regression on the questions the old router already served',
    '',
    '| | recall@20 |',
    '|---|---:|',
    `| five streams (today) | **${pct(m1)}** |`,
    `| eight streams (V2) | **${pct(m2)}** |`,
    `| difference | **${m2 >= m1 ? '+' : ''}${(100 * (m2 - m1)).toFixed(1)}pp** |`,
    '',
    `Scored on **${scored.length}** gold questions. Improved on ${improved.length}, regressed on ${regressed.length}.`,
    regressed.length
      ? `\n⚠⚠ **THE GATE IS NOT MET.** These questions lost recall: ${regressed.map((r) => `${r.id} (${pct(r.r1 as number)} → ${pct(r.r2 as number)})`).join(', ')}.`
      : '\n✅ **No question lost recall.** The gate §4 sets is met.',
    '',
    '## Selection — is a new stream ever chosen?',
    '',
    '| stream | chosen on | of |',
    '|---|---:|---:|',
    ...NEW_STREAMS.map((s) => `| ${s} | ${chosenCount[s]} | ${rows.length} |`),
    '',
    '### The three purpose-built selection probes',
    '',
    '| probe | wanted | streams chosen (V2) | chosen? |',
    '|---|---|---|---|',
    ...rows.filter((r) => r.kind === 'v2-probe').map((r) =>
      `| ${r.query} | \`${r.want}\` | ${r.v2.streams.join(', ') || '—'} | ${r.v2.streams.includes(r.want as string) ? '✅' : '❌'} |`),
    '',
    '⚠ These three questions were written for this measurement and have **no answer key**. They test',
    'whether the router CHOOSES the right stream when the question is squarely about what that stream',
    'holds. They do not and cannot show that the answer got better.',
    '',
    '## Displacement — did a new stream push out one that was serving the answer?',
    '',
    displaced.length
      ? ['| question | streams present at five, absent at eight |', '|---|---|',
         ...displaced.map((d) => `| ${d.id} (${d.kind}) | ${d.lost.join(', ')} |`)].join('\n')
      : 'No question lost a stream it had at five. Every V2 selection was additive.',
    '',
    '## Latency',
    '',
    '| | p50 | p95 | mean |',
    '|---|---:|---:|---:|',
    `| five streams | ${percentile(l1, 50)} ms | ${percentile(l1, 95)} ms | ${Math.round(mean(l1))} ms |`,
    `| eight streams | ${percentile(l2, 50)} ms | ${percentile(l2, 95)} ms | ${Math.round(mean(l2))} ms |`,
    `| delta | ${percentile(l2, 50) - percentile(l1, 50)} ms | ${percentile(l2, 95) - percentile(l1, 95)} ms | ${Math.round(mean(l2) - mean(l1))} ms |`,
    '',
    '⚠ A stream is a retrieval call per query. Eight streams against `LEX_STREAM_CONCURRENCY=3` is',
    'three waves where five was two, so a latency cost is expected rather than surprising; the number',
    'above is what it actually is.',
    '',
    '## Per question',
    '',
    '| id | kind | streams (5) | streams (8) | recall 5 | recall 8 | ms 5 | ms 8 |',
    '|---|---|---|---|---:|---:|---:|---:|',
    ...rows.map((r) => `| ${r.id} | ${r.kind} | ${r.v1.streams.join(' ') || '—'} | ${r.v2.streams.join(' ') || '—'} | ${r.r1 === null ? '—' : pct(r.r1)} | ${r.r2 === null ? '—' : pct(r.r2)} | ${r.v1.ms} | ${r.v2.ms} |`),
    '',
  ].join('\n')

  fs.writeFileSync(OUT, md)
  console.log(`\nrecall ${pct(m1)} → ${pct(m2)}  ·  regressed ${regressed.length}  ·  p95 ${percentile(l1, 95)} → ${percentile(l2, 95)} ms`)
  console.log(`wrote ${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
