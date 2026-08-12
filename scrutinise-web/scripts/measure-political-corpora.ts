/**
 * measure-political-corpora.ts — S2C6 §1's before-and-after for the four V34 collections.
 *
 * ⚠ HOW THIS DIFFERS FROM `measure-debates-scotland.ts`, WHICH IT OTHERWISE MIRRORS. There the
 * before and the after were two CONFIGURATIONS of a live index, so both could be measured in the
 * same run and interleaved to cancel drift. Here they are two STATES OF THE INDEX: the 31,852
 * V34 sections do not exist in `corpus_fts` until the V35 §2 build appends them. So this script
 * is run TWICE — `--label before` ahead of the build, `--label after` once it lands — and each
 * run writes its numbers to `docs/political_corpora_<label>.json` for the pair to be diffed.
 *
 * ⚠ WHICH MEANS THE TWO RUNS ARE NOT INTERLEAVED AND CANNOT CANCEL DRIFT. Anything else that
 * changes between them shows up in the delta. That is stated here rather than discovered later:
 * the latency figures in particular are a weaker claim than S2C2's, and the script records
 * `/stats` `started_at` on both runs so a service restart between them is visible rather than
 * silently attributed to the new rows.
 *
 * WHAT IT MEASURES, per the brief ("gold questions, contamination on queries that plainly want
 * something else, latency"), across the three streams that receive rows:
 *   legislation ← impact-assessments (18,756)
 *   debates     ← commons/lords-divisions-votes (5,645)
 *   guidance    ← consultations (7,448)
 *
 *   1. gold — the answer keys for each stream's recall@20 questions. ⚠ Read through the PRODUCT
 *      adapter, whose haystack is a SNIPPET not the body, so these are NOT comparable with the
 *      gold reports and must never be quoted as recall@20. They are comparable between the two
 *      runs, which is the only claim made.
 *   2. contamination — on questions that plainly want something else, how many top-20 slots the
 *      new collections take, and how many previously-returned rows they displace.
 *   3. latency — warm, per stream.
 *   4. what the rendered titles READ AS. §1's correctness requirement is about the title, so the
 *      measurement has to look at one.
 *
 * Usage:
 *   FTS_SEARCH_URL=… DATABASE_URL=… npx tsx --env-file=.env --tsconfig tsconfig.json \
 *     scripts/measure-political-corpora.ts --label before
 */
import fs from 'fs'
import path from 'path'
import { STREAMS } from '../lib/lex/query-router'
import { GOLD } from '../../scripts/ingest/search/gold-queries'
import type { SearchResult } from '../lib/lex/page1-config'

const LABEL = (() => { const i = process.argv.indexOf('--label'); return i >= 0 ? process.argv[i + 1] : 'unlabelled' })()
const OUT = path.join(__dirname, `../../docs/political_corpora_${LABEL}.json`)

if (!process.env.FTS_SEARCH_URL) {
  console.error('FTS_SEARCH_URL is not set — this measures the LIVE retrieval path and cannot run without it.')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  // ⚠ NOT a nicety. The FTS adapter hydrates url/date/title through Prisma; without it every
  // query returns empty and this harness would report "0 contamination, no keys lost" — a clean
  // bill of health from no data. Exactly the S2C5 failure, in a new script.
  console.error('DATABASE_URL is not set — the FTS adapter hydrates through Prisma and would return EMPTY,')
  console.error('which this harness would otherwise report as a flawless result. Refusing to run.')
  process.exit(1)
}

const NEW_CORPORA: Record<string, string> = {
  'impact-assessments': 'legislation',
  'commons-divisions-votes': 'debates',
  'lords-divisions-votes': 'debates',
  'consultations': 'guidance',
}
const corpusOf = (id: string) => id.split(':')[0]
const isNew = (r: SearchResult) => corpusOf(r.id) in NEW_CORPORA
const hay = (r: SearchResult) => `${r.id}\n${r.title}\n${r.citation}\n${r.snippet}`
const pct = (n: number, d: number) => (d ? +(n / d * 100).toFixed(1) : 0)
const quantile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0
}

/**
 * Questions that plainly want something else. Chosen so the new collections would be WRONG but
 * not obviously excluded by vocabulary — a division record and a debate share almost all their
 * words, and an impact assessment quotes the instrument it assesses, so a contamination number
 * flattered by disjoint vocabulary would measure nothing.
 */
const OFF_TARGET: Array<{ stream: string; q: string }> = [
  { stream: 'legislation', q: 'what does the Data Protection Act 2018 say about subject access requests' },
  { stream: 'legislation', q: 'the statutory duty on landlords to carry out gas safety checks' },
  { stream: 'legislation', q: 'section 21 no fault eviction notice requirements' },
  { stream: 'debates', q: 'what did the minister say about water company sewage discharges' },
  { stream: 'debates', q: 'second reading debate on the Renters Reform Bill' },
  { stream: 'debates', q: 'what was said about HS2 cancellation in the Commons' },
  { stream: 'guidance', q: 'ICO guidance on lawful basis for processing personal data' },
  { stream: 'guidance', q: 'FCA handbook rules on treating customers fairly' },
]

/** Questions that plainly DO want the new material — the other half of the picture. */
const ON_TARGET: Array<{ stream: string; q: string; want: string }> = [
  { stream: 'debates', q: 'how did MPs vote on the assisted dying bill', want: 'commons-divisions-votes' },
  { stream: 'debates', q: 'which peers voted against the Employment Rights Bill', want: 'lords-divisions-votes' },
  { stream: 'legislation', q: 'what did the government estimate the Ivory Act would cost business', want: 'impact-assessments' },
  { stream: 'legislation', q: 'expected costs and benefits of the plastic bag charge regulations', want: 'impact-assessments' },
  { stream: 'guidance', q: 'government consultation on leasehold reform and ground rents', want: 'consultations' },
  { stream: 'guidance', q: 'who responded to the consultation on special educational needs', want: 'consultations' },
]

const streamOf = (name: string) => STREAMS.find((s) => s.name === name)!

async function main() {
  const stats = await fetch(`${process.env.FTS_SEARCH_URL!.replace(/\/$/, '')}/stats`).then((r) => r.json()).catch(() => null) as any
  console.log(`label=${LABEL}   fts-serve started_at=${stats?.started_at ?? 'UNREADABLE'} served=${stats?.served ?? '?'}`)
  console.log('⚠ before and after are two INDEX STATES measured at different times — not interleaved,')
  console.log('  so anything else that moved between the runs lands in the delta. started_at above is')
  console.log('  recorded so a restart is visible rather than attributed to the new rows.\n')

  const report: any = { label: LABEL, measuredAt: new Date().toISOString(), ftsStartedAt: stats?.started_at ?? null, gold: {}, offTarget: [], onTarget: [], latency: {}, titles: [] }

  // ── 1. gold answer keys, per receiving stream ──────────────────────────────
  console.log('=== 1. gold answer keys (snippet haystack — NOT gold-report recall; comparable only run-to-run) ===')
  for (const streamName of ['legislation', 'debates', 'guidance']) {
    const stream = streamOf(streamName)
    const gold = (GOLD as any[]).filter((g) => g.metric === 'recall@20' && g.scoreable && String(g.stream).includes(streamName))
    let keys = 0, total = 0, newRows = 0, slots = 0
    const per: any[] = []
    for (const g of gold) {
      const r = (await stream.search(g.query, 20)).slice(0, 20)
      const hit = g.expected.filter((s: any) => r.some((x) => s.patterns.some((p: RegExp) => p.test(hay(x)))))
      const nn = r.filter(isNew).length
      keys += hit.length; total += g.expected.length; newRows += nn; slots += r.length
      per.push({ id: g.id, keys: hit.length, of: g.expected.length, hits: r.length, newRows: nn, satisfied: hit.map((k: any) => k.label) })
      console.log(`  ${streamName.padEnd(12)} ${String(g.id).padEnd(4)} ${hit.length}/${g.expected.length} keys   ${r.length} hits   ${nn}/20 from the new collections`)
    }
    report.gold[streamName] = { queries: gold.length, keys, total, keyPct: pct(keys, total), newRows, slots, per }
    console.log(`  ${streamName.padEnd(12)} TOTAL ${keys}/${total} keys (${pct(keys, total)}%)   ${newRows}/${slots} slots from new collections\n`)
  }

  // ── 2. contamination ───────────────────────────────────────────────────────
  console.log('=== 2. contamination — new-collection rows in the top 20 of a question that wants something else ===')
  let cTotal = 0, cSlots = 0
  for (const { stream, q } of OFF_TARGET) {
    const r = (await streamOf(stream).search(q, 20)).slice(0, 20)
    const bad = r.filter(isNew)
    cTotal += bad.length; cSlots += r.length
    report.offTarget.push({ stream, q, hits: r.length, contaminating: bad.length, top: bad[0] ? { rank: r.indexOf(bad[0]) + 1, id: bad[0].id, title: bad[0].title } : null })
    console.log(`  [${stream.padEnd(11)}] ${q.slice(0, 54).padEnd(54)} ${String(bad.length).padStart(2)}/${String(r.length).padStart(2)}` +
      (bad.length ? `\n      top: rank ${r.indexOf(bad[0]) + 1} — ${bad[0].title.slice(0, 78)}` : ''))
  }
  report.contamination = { slotsTaken: cTotal, slots: cSlots, pct: pct(cTotal, cSlots) }
  console.log(`  CONTAMINATION: ${cTotal}/${cSlots} top-20 slots (${pct(cTotal, cSlots)}%) over ${OFF_TARGET.length} off-target questions\n`)

  // ── 3. on-target — do they arrive at all when they are the right answer? ────
  console.log('=== 3. on-target — the questions the new material EXISTS to answer ===')
  for (const { stream, q, want } of ON_TARGET) {
    const r = (await streamOf(stream).search(q, 20)).slice(0, 20)
    const got = r.filter((x) => corpusOf(x.id) === want)
    report.onTarget.push({ stream, q, want, hits: r.length, found: got.length, firstRank: got.length ? r.indexOf(got[0]) + 1 : null, firstTitle: got[0]?.title ?? null })
    console.log(`  [${stream.padEnd(11)}] ${q.slice(0, 54).padEnd(54)} ${String(got.length).padStart(2)} ${want}` +
      (got.length ? ` @rank ${r.indexOf(got[0]) + 1}\n      ${got[0].title.slice(0, 84)}` : '   ← ABSENT'))
  }

  // ── 4. latency, warm, per stream ───────────────────────────────────────────
  console.log('\n=== 4. latency, warm, per receiving stream ===')
  const LAT = [...OFF_TARGET, ...ON_TARGET.map(({ stream, q }) => ({ stream, q }))]
  for (const { stream, q } of LAT.slice(0, 4)) await streamOf(stream).search(q, 20) // warm
  for (const streamName of ['legislation', 'debates', 'guidance']) {
    const qs = LAT.filter((x) => x.stream === streamName)
    const t: number[] = []
    for (let round = 0; round < 2; round++) {
      for (const { q } of qs) { const t0 = Date.now(); await streamOf(streamName).search(q, 20); t.push(Date.now() - t0) }
    }
    report.latency[streamName] = { n: t.length, p50: quantile(t, 0.5), p95: quantile(t, 0.95), max: Math.max(...t) }
    console.log(`  ${streamName.padEnd(12)} n=${t.length}  p50 ${quantile(t, 0.5)}ms  p95 ${quantile(t, 0.95)}ms  max ${Math.max(...t)}ms`)
  }

  // ── 5. what the titles READ AS — §1's correctness requirement ──────────────
  console.log('\n=== 5. rendered titles — can a reader tell a roll-call from a debate, an IA from the law? ===')
  for (const { stream, q, want } of ON_TARGET) {
    const r = await streamOf(stream).search(q, 20)
    for (const x of r.filter((y) => corpusOf(y.id) === want).slice(0, 2)) {
      report.titles.push({ corpus: want, type: x.type, title: x.title, citation: x.citation, url: x.url })
      console.log(`  ${x.type.padEnd(18)} ${x.title}\n  ${''.padEnd(18)} cite: ${x.citation}`)
    }
  }
  if (!report.titles.length) console.log('  (none retrieved — expected on the `before` run, since these rows are not in the index yet)')

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
  console.log(`\n  → ${OUT}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
