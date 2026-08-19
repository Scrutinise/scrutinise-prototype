// ─────────────────────────────────────────────────────────────────────────────
// measure-s8-concurrency.ts — BRIEF_SEARCH_S8 §6. One variable, against the real services.
//
// "S5 batched stream calls at 3 concurrent; p95 on the chat route is 9.0s. S7 showed two
//  simultaneous users cost 0.75×–1.37× of serial p95, so headroom likely exists."
//
// PREDICTION, recorded in the change log BEFORE this ran: raising `LEX_STREAM_CONCURRENCY` to 4
// should cut p50/p95 on five-stream questions by roughly the cost of one serialised batch wave,
// without pushing the vector/FTS services into the saturation the batching was built to prevent.
//
// ⚠ MY OWN SHARPER PREDICTION, ALSO RECORDED FIRST: five streams at a cap of 3 takes TWO waves
// (3 + 2); at a cap of 4 it also takes two (4 + 1). So the saving should be smaller than "one
// wave" suggests — the second wave shrinks from 2 tasks to 1, it does not disappear. I predicted a
// real but modest p95 improvement rather than a step change.
//
// ⚠ `maxInFlight` IS THE ENGAGEMENT CHECK, and §6 asks for it by name. A cap of 4 that never
// actually reaches 4 in flight means the cap is not the binding constraint and this measurement is
// about something else — which would be the finding, not a footnote.
//
//   FTS_SEARCH_URL=… LEX_QUERY_ROUTER=true LEX_VECTOR_STREAMS=… \
//     npx tsx --env-file=.env scripts/measure-s8-concurrency.ts
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { retrieveForChat } from '../lib/lex/chat-retrieval'
import { streamConcurrency } from '../lib/lex/stream-batch'
import { assertRetrievalConfig, resolvedConfigLine, readServiceConfig, servedDelta } from '../lib/lex/harness-preflight'

export {}

const OUT = path.join(__dirname, '..', '..', 'docs', 'SEARCH_S8_CONCURRENCY.md')
const REPEATS = parseInt(process.argv.find((a) => a.startsWith('--repeats='))?.split('=')[1] ?? '2', 10)

/** ⚠ THE S5 TEN QUESTIONS, verbatim — the same set S4 audited, S5 re-ran and S7 re-used. */
const PROBES = [
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

interface Obs { cap: number; query: string; ms: number; streams: number; results: number; failed: boolean; maxInFlight: number | null; capCouldBind: boolean }

/**
 * ⚠ `maxInFlight` IS SCRAPED FROM THE LIMITER'S OWN LOG LINE, not recomputed.
 *
 * `runRoutedSearch` logs `[query-router] streams batched { streams, cap, maxInFlight, ms }`.
 * Re-deriving the number here would be measuring my own arithmetic; reading the limiter's own
 * observation is the engagement check §6 actually asks for. The console is patched for the
 * duration of the run and restored in a `finally`.
 */
let lastBatch: { cap: number; maxInFlight: number } | null = null
const realLog = console.log
function captureBatchLogs() {
  console.log = (...args: unknown[]) => {
    const first = args[0]
    if (typeof first === 'string' && first.includes('streams batched')) {
      const o = args[1] as { cap?: number; maxInFlight?: number } | undefined
      if (o && typeof o.maxInFlight === 'number') lastBatch = { cap: o.cap ?? -1, maxInFlight: o.maxInFlight }
    }
    realLog(...(args as []))
  }
}

const percentile = (xs: number[], p: number) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}
const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)

async function one(query: string, cap: number): Promise<Obs> {
  process.env.LEX_STREAM_CONCURRENCY = String(cap)
  if (streamConcurrency() !== cap) throw new Error(`cap did not take: asked ${cap}, got ${streamConcurrency()}`)
  lastBatch = null
  const t0 = Date.now()
  const r = await retrieveForChat({ query, limit: 10 })
  const ms = Date.now() - t0
  const streams = r.routedStreams?.length ?? 0
  return {
    cap, query, ms, streams,
    results: r.legislation.length + r.evidence.length, failed: r.failed,
    // ⚠ NULL HERE MEANS "THE CAP COULD NOT BIND", NOT "NOT MEASURED", and the difference matters
    // enough to compute rather than leave ambiguous. `runRoutedSearch` logs the batch line ONLY
    // when `active.length > cap` — so a query routed to 3 streams at a cap of 3 produces no log
    // because there was nothing to limit. Reading that null as a broken observation would have
    // been the wrong diagnosis; reading it as "this query says nothing about the cap" is right,
    // and it is why the five-stream subset below is the only place the comparison means anything.
    maxInFlight: lastBatch?.maxInFlight ?? null,
    capCouldBind: streams > cap,
  }
}

async function main() {
  assertRetrievalConfig('measure-s8-concurrency')
  const before = await readServiceConfig()
  realLog(resolvedConfigLine())

  captureBatchLogs()
  const obs: Obs[] = []
  try {
    // ⚠ WARM FIRST, AND DISCARD IT. The first query after a cold start pays the LanceDB index
    // fetch (~15s observed) and would land entirely in whichever arm happened to go first.
    realLog('\n── warming (discarded) ──')
    await one(PROBES[0], 3)

    for (let rep = 0; rep < REPEATS; rep++) {
      for (let i = 0; i < PROBES.length; i++) {
        // ⚠ ALTERNATE THE ORDER per question AND per repeat, so neither cap systematically runs
        // second on a warmer service. A cache-warming artefact has already misled one measurement
        // in this project.
        const fourFirst = (i + rep) % 2 === 1
        const a = await one(PROBES[i], fourFirst ? 4 : 3)
        const b = await one(PROBES[i], fourFirst ? 3 : 4)
        obs.push(a, b)
        realLog(`  rep${rep} q${i + 1}  cap3 ${(a.cap === 3 ? a : b).ms}ms  cap4 ${(a.cap === 4 ? a : b).ms}ms  streams=${a.streams}  maxInFlight ${(a.cap === 3 ? a : b).maxInFlight}/${(a.cap === 4 ? a : b).maxInFlight}`)
      }
    }
  } finally {
    console.log = realLog
  }

  const after = await readServiceConfig()
  const engagement = servedDelta(before, after)
  realLog(`[engagement] ${engagement}`)

  const arm = (cap: number) => obs.filter((o) => o.cap === cap)
  const ms = (cap: number) => arm(cap).map((o) => o.ms)
  const inFlight = (cap: number) => arm(cap).map((o) => o.maxInFlight).filter((n): n is number => n !== null)
  const couldBind = (cap: number) => arm(cap).filter((o) => o.capCouldBind)
  const errors = obs.filter((o) => o.failed)
  const fiveStream = obs.filter((o) => o.streams >= 5)

  const row = (label: string, xs: number[]) =>
    `| ${label} | ${percentile(xs, 50)} ms | ${percentile(xs, 95)} ms | ${mean(xs)} ms | ${xs.length} |`

  const md = [
    '# SEARCH S8 §6 — STREAM CONCURRENCY 3 vs 4',
    '',
    `*Generated ${new Date().toISOString()}. Both caps in ONE process, alternating per question and*`,
    '*per repeat, against the same warm services. First query discarded as a warm-up.*',
    '',
    '```',
    resolvedConfigLine(),
    `[engagement] ${engagement}`,
    '```',
    '',
    '## The prediction, recorded before the run',
    '',
    'From the change log (2026-08-19 09:01 UTC): raising the cap to 4 should cut p50/p95 by roughly',
    'the cost of one serialised batch wave, without saturating the services. And my own sharper',
    'version: **five streams at a cap of 3 takes two waves (3+2); at a cap of 4 it also takes two',
    '(4+1)** — the second wave shrinks from two tasks to one rather than disappearing — so a real',
    'but MODEST p95 improvement, not a step change.',
    '',
    '## Latency',
    '',
    '| arm | p50 | p95 | mean | n |',
    '|---|---:|---:|---:|---:|',
    row('cap 3', ms(3)),
    row('cap 4', ms(4)),
    `| **delta** | **${percentile(ms(4), 50) - percentile(ms(3), 50)} ms** | **${percentile(ms(4), 95) - percentile(ms(3), 95)} ms** | **${mean(ms(4)) - mean(ms(3))} ms** | |`,
    '',
    '### Five-stream questions only — the case the cap actually binds on',
    '',
    '| arm | p50 | p95 | mean | n |',
    '|---|---:|---:|---:|---:|',
    row('cap 3', fiveStream.filter((o) => o.cap === 3).map((o) => o.ms)),
    row('cap 4', fiveStream.filter((o) => o.cap === 4).map((o) => o.ms)),
    '',
    '## ⚠ The engagement check — did the cap bind at all?',
    '',
    '| arm | maxInFlight observed | of observations |',
    '|---|---|---:|',
    `| cap 3 | ${[...new Set(inFlight(3))].sort().join(', ') || '—'} | ${inFlight(3).length} of ${couldBind(3).length} that could bind |`,
    `| cap 4 | ${[...new Set(inFlight(4))].sort().join(', ') || '—'} | ${inFlight(4).length} of ${couldBind(4).length} that could bind |`,
    '',
    '⚠⚠ **A BLANK `maxInFlight` MEANS THE CAP COULD NOT BIND, NOT THAT NOTHING WAS MEASURED.** The',
    'limiter logs only when there are more streams than slots, so a question routed to three streams',
    'at a cap of three produces no observation — correctly, because there was nothing to limit.',
    `Of ${obs.length / 2} question-runs per arm, **${couldBind(3).length} could bind at cap 3 and`,
    `${couldBind(4).length} at cap 4** — and that difference is itself the mechanism: raising the cap`,
    'removes the constraint from some questions entirely rather than speeding them up.',
    '',
    inFlight(4).some((n) => n === 4)
      ? '✅ The cap of 4 was actually reached, so the two arms really did differ in what they did.'
      : '⚠⚠ **THE CAP OF 4 WAS NEVER REACHED.** The limiter was not the binding constraint on these questions, so any latency difference above is about something else. Read the delta as noise until this line changes.',
    '',
    '## Errors and timeouts',
    '',
    errors.length
      ? `⚠ ${errors.length} of ${obs.length} searches FAILED: ${[...new Set(errors.map((e) => `cap ${e.cap}: ${e.query}`))].join('; ')}`
      : `None. ${obs.length} searches, 0 failures, 0 timeouts, in either arm.`,
    '',
    '## Recommendation',
    '',
    '⚠ **This is a recommendation with numbers under it. `LEX_STREAM_CONCURRENCY` is a Vercel',
    "variable and Charlie's to set** — it is not readable or settable from this machine (SAML).",
    '',
    '## Per observation',
    '',
    '| rep/query | cap | ms | streams | maxInFlight | results |',
    '|---|---:|---:|---:|---:|---:|',
    ...obs.map((o, i) => `| ${Math.floor(i / 2) + 1}. ${o.query.slice(0, 46)} | ${o.cap} | ${o.ms} | ${o.streams} | ${o.maxInFlight ?? '—'} | ${o.results} |`),
    '',
  ].join('\n')

  fs.writeFileSync(OUT, md)
  realLog(`\ncap3 p50 ${percentile(ms(3), 50)} p95 ${percentile(ms(3), 95)}  ·  cap4 p50 ${percentile(ms(4), 50)} p95 ${percentile(ms(4), 95)}`)
  realLog(`maxInFlight cap3=${[...new Set(inFlight(3))].join(',')} cap4=${[...new Set(inFlight(4))].join(',')}`)
  realLog(`wrote ${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
