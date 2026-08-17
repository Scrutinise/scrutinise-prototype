/**
 * measure-s7-streams.ts — BRIEF_SEARCH_S7 §1. Semantic search on the other four streams,
 * one at a time, through the LIVE path.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IS ALREADY KNOWN, AND WHAT IS NOT
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * `scripts/ingest/search/score-stream-fusion.ts` measured recall for all four streams on 6 Aug —
 * OFFLINE, straight against the Lance tables, with no service in the path. Those numbers stand and
 * are NOT re-derived here. What they cannot tell anybody is the thing §1 actually asks for:
 *
 *   "Report per stream: recall before and after, latency at p50 and p95, and the QUEUE DEPTH on
 *    the semantic service under TWO SIMULTANEOUS USERS."
 *
 * None of that is measurable offline. Earlier load testing had all five streams at once doubling
 * the slowest queries to 25 seconds — ⚠ "that was before batching; it may not hold, and it may not
 * be wrong either." S5 added batching. This is the measurement that settles it.
 *
 * ⚠ ONE STREAM AT A TIME. `LEX_VECTOR_STREAMS` is read at CALL time, not module load, so this
 * harness flips it per run and the live code path really does change. Turning several on at once
 * would make any latency change unattributable, which is the one thing §1 says not to do.
 *
 * ⚠ THIS HARNESS CANNOT CHANGE PRODUCTION. `LEX_VECTOR_STREAMS` in Vercel is Charlie's to set and
 * unreadable from here (docs/CLAUDE.md §19 — the token is SAML-blocked). What this produces is a
 * recommendation with numbers under it, not a deployment.
 *
 * Usage (from scrutinise-web):
 *   FTS_SEARCH_URL=https://fts-serve-production.up.railway.app \
 *   VECTOR_SEARCH_URL=https://vector-serve-production.up.railway.app \
 *   LEX_QUERY_ROUTER=true \
 *     npx tsx --env-file=.env scripts/measure-s7-streams.ts
 *   ... --stream=committees     # just one
 *   ... --concurrent            # the two-simultaneous-users test only
 */
import { runSearch } from '../lib/lex/search-gateway'
import type { SearchResult } from '../lib/lex/page1-config'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const arg = (n: string) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null }

/**
 * ⚠ THE ORDER IS THE BRIEF'S, AND ITS PREDICTION IS RECORDED SO IT CAN BE SCORED.
 *
 * §1: "Order: committees, then debates, then case law, then guidance. Committee evidence is where a
 * lay description most often has to bridge to specialist language, so it should show the largest
 * gain — and if it does not, that is worth knowing before spending four sprints."
 *
 * That is a falsifiable prediction and it is written down here BEFORE the run, so the report can
 * say whether it held rather than quietly reordering the table afterwards.
 */
const STREAM_ORDER = ['committees', 'debates', 'caselaw', 'guidance'] as const

/**
 * Questions phrased the way a lay user phrases them — which is the whole case for semantic search.
 * ⚠ These are NOT the gold set. `gold-queries.ts` has 43 questions and NOT ONE caselaw archetype,
 * and no committee or guidance archetype either (see measure-router-caselaw.ts). So a "gold recall"
 * number for three of these four streams has never been available and is not invented here. What
 * is measured live is whether the stream RETURNS ITS OWN KIND for a lay question, and what it
 * costs. Recall against a validated key stays where it is: the 6 Aug offline reports.
 */
const PROBES: Record<string, Array<{ q: string; want: string }>> = {
  committees: [
    { q: 'people are waiting too long to see a GP and nobody seems accountable', want: 'COMMITTEE' },
    { q: 'water companies keep dumping sewage and getting away with it', want: 'COMMITTEE' },
    { q: 'children with special needs cannot get the support they are entitled to', want: 'COMMITTEE' },
  ],
  debates: [
    { q: 'politicians arguing about whether terminally ill people should be helped to die', want: 'DEBATE' },
    { q: 'the row over cutting the winter fuel payment for pensioners', want: 'DEBATE' },
    { q: 'concerns raised in parliament about buy now pay later lending', want: 'DEBATE' },
  ],
  caselaw: [
    { q: 'can the government shut down parliament to avoid being questioned', want: 'CASE_LAW' },
    { q: 'when does an employer have to change things for a disabled worker', want: 'CASE_LAW' },
    { q: 'someone was sacked for expressing their religious beliefs at work', want: 'CASE_LAW' },
  ],
  guidance: [
    { q: 'what am I allowed to do with customer data I collected years ago', want: 'GUIDANCE' },
    { q: 'rules about how councils should buy things from local suppliers', want: 'GUIDANCE' },
    { q: 'how should a bank treat a customer who is struggling to pay', want: 'GUIDANCE' },
  ],
}

const p = (xs: number[], q: number) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((q / 100) * s.length))]
}

const typed = (rs: SearchResult[], want: string) => rs.filter((r) => String(r.type) === want).length

async function measureStream(stream: string, vectorOn: boolean) {
  process.env.LEX_VECTOR_STREAMS = vectorOn ? stream : ''
  const probes = PROBES[stream] ?? []
  const times: number[] = []
  let wanted = 0
  let total = 0
  const idSets: string[][] = []
  for (const probe of probes) {
    const t = Date.now()
    const out = await runSearch({
      keywords: probe.q.split(/\s+/).filter(Boolean),
      intent: 'IDEA_CHAT_GROUNDING',
      limit: 20,
    })
    times.push(Date.now() - t)
    wanted += typed(out.results, probe.want)
    total += out.results.length
    idSets.push(out.results.slice(0, 20).map((r) => r.id))
  }
  return { p50: p(times, 50), p95: p(times, 95), wanted, total, n: probes.length, idSets }
}

/**
 * ⚠ THE TWO-SIMULTANEOUS-USERS TEST, WHICH IS THE ONE §1 SINGLES OUT.
 *
 * Not a load test — two users is not load. It is the smallest number that can show contention at
 * all, and the earlier 25-second finding came from exactly this shape of problem: five streams per
 * query against a service that handles four. With S5's batching capping one query at three
 * in flight, two users is six — still over the width. This measures whether that matters.
 *
 * ⚠ THE SERIAL BASELINE IS RUN IN THE SAME SESSION. "Concurrent is slower" means nothing without
 * the serial number beside it, taken against the same warm service on the same day.
 */
async function concurrency(stream: string) {
  process.env.LEX_VECTOR_STREAMS = stream
  const probes = PROBES[stream] ?? []
  const one = async (q: string) => {
    const t = Date.now()
    await runSearch({ keywords: q.split(/\s+/).filter(Boolean), intent: 'IDEA_CHAT_GROUNDING', limit: 20 })
    return Date.now() - t
  }
  const serial: number[] = []
  for (const probe of probes) serial.push(await one(probe.q))

  const conc: number[] = []
  for (const probe of probes) {
    const [a, b] = await Promise.all([one(probe.q), one(probe.q + ' funding')])
    conc.push(a, b)
  }
  return { serialP50: p(serial, 50), serialP95: p(serial, 95), concP50: p(conc, 50), concP95: p(conc, 95) }
}

async function main() {
  const only = arg('stream')
  const streams = only ? [only] : [...STREAM_ORDER]

  console.log('\n════ SEARCH S7 §1 — SEMANTIC SEARCH PER STREAM, THROUGH THE LIVE PATH ════')
  console.log(`  vector service: ${process.env.VECTOR_SEARCH_URL ?? '(unset — the dense half will be inert)'}`)
  console.log(`  fts service:    ${process.env.FTS_SEARCH_URL ?? '(unset)'}`)
  if (!process.env.VECTOR_SEARCH_URL) {
    console.log('\n  ⚠⚠ VECTOR_SEARCH_URL IS UNSET. Every "vector on" arm below is INERT and will')
    console.log('     measure identically to "off" — which reads exactly like "semantic search adds')
    console.log('     nothing". Set it before believing any number here.')
  }
  console.log(`\n  ⚠ THE BRIEF'S PREDICTION, recorded before the run: committees should show the LARGEST`)
  console.log(`    gain, "and if it does not, that is worth knowing before spending four sprints".\n`)

  if (flag('concurrent')) {
    for (const s of streams) {
      const c = await concurrency(s)
      console.log(`── ${s}`)
      console.log(`   serial      p50 ${String(c.serialP50).padStart(6)}ms  p95 ${String(c.serialP95).padStart(6)}ms`)
      console.log(`   2 users     p50 ${String(c.concP50).padStart(6)}ms  p95 ${String(c.concP95).padStart(6)}ms`)
      const ratio = c.serialP95 ? (c.concP95 / c.serialP95) : 0
      console.log(`   ⚠ p95 under two simultaneous users is ${ratio.toFixed(2)}× the serial p95`)
      console.log(`     (the pre-batching finding was 2× — "doubling the slowest queries to 25 seconds")`)
    }
    return
  }

  const results: Array<{ stream: string; off: Awaited<ReturnType<typeof measureStream>>; on: Awaited<ReturnType<typeof measureStream>> }> = []
  for (const s of streams) {
    // ⚠ OFF FIRST, THEN ON, then report both. Same session, same warm service.
    const off = await measureStream(s, false)
    const on = await measureStream(s, true)
    results.push({ stream: s, off, on })
    console.log(`── ${s}  (${off.n} lay-phrased questions)`)
    console.log(`   BM25 only   ${String(off.wanted).padStart(3)} of ${String(off.total).padStart(3)} results are ${PROBES[s]?.[0]?.want}   p50 ${String(off.p50).padStart(5)}ms  p95 ${String(off.p95).padStart(5)}ms`)
    console.log(`   + vector    ${String(on.wanted).padStart(3)} of ${String(on.total).padStart(3)} results are ${PROBES[s]?.[0]?.want}   p50 ${String(on.p50).padStart(5)}ms  p95 ${String(on.p95).padStart(5)}ms`)
    // ⚠⚠ THE ON-KIND COUNT SATURATES AND CANNOT ANSWER THE QUESTION — see the note in main().
    // What CAN be told apart cheaply is "vector changed nothing" from "vector is inert": if the
    // returned id sets are identical, the flag did nothing at all, which is a different finding
    // from a change that did not help.
    const overlap = off.idSets.map((a, i) => {
      const b = new Set(on.idSets[i] ?? [])
      const common = a.filter((x) => b.has(x)).length
      return a.length ? common / a.length : 1
    })
    const meanOverlap = overlap.reduce((x, y) => x + y, 0) / Math.max(1, overlap.length)
    console.log(`   ⚠ top-20 id overlap between the two arms: ${(100 * meanOverlap).toFixed(0)}%`
      + `${meanOverlap > 0.99 ? '  ← IDENTICAL: the vector arm changed nothing at all' : ''}`)
    const delta = on.wanted - off.wanted
    console.log(`   Δ on-kind results ${delta >= 0 ? '+' : ''}${delta}   Δ p50 ${on.p50 - off.p50 >= 0 ? '+' : ''}${on.p50 - off.p50}ms`)
    console.log()
  }

  console.log('════ SUMMARY, IN THE BRIEF\'S OWN ORDER ════')
  console.log('  stream       on-kind BM25 → +vector      Δ      p50 BM25 → +vector')
  for (const r of results) {
    console.log(`  ${r.stream.padEnd(12)} ${String(r.off.wanted).padStart(3)} → ${String(r.on.wanted).padStart(3)}`
      + `   ${String(r.on.wanted - r.off.wanted).padStart(6)}      ${String(r.off.p50).padStart(5)} → ${String(r.on.p50).padStart(5)}ms`)
  }
  const best = results.reduce((a, b) => (b.on.wanted - b.off.wanted > a.on.wanted - a.off.wanted ? b : a), results[0])
  if (best) {
    console.log(`\n  ⚠ largest gain: ${best.stream}. The brief predicted committees.`)
    console.log(`    ${best.stream === 'committees' ? 'The prediction HELD.' : 'The prediction did NOT hold — worth knowing before spending four sprints.'}`)
  }
  console.log(`\n  ⚠ THIS IS NOT GOLD RECALL. gold-queries.ts has no committee, caselaw or guidance`)
  console.log(`    archetype, so a validated recall number for three of these four has never existed.`)
  console.log(`    Recall against a validated key stays in the 6 Aug offline reports (GOLD_TEST_04–07).`)
  console.log(`    What is measured here is live behaviour and cost, which those could not measure.`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
