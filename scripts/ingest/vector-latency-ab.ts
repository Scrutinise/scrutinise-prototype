/**
 * vector-latency-ab.ts — a LIKE-FOR-LIKE latency sample against the live vector service, so an
 * A/B on `VECTOR_NPROBES` is compared on equal terms (BRIEF_SEARCH_S2C5 §1).
 *
 * ⚠ WHY THIS EXISTS RATHER THAN JUST READING `/stats`. The service's own counters are since-boot and
 * whatever traffic happened to arrive: at the pre-change read they held **28 warm samples**, so its
 * "p95" was one or two data points and a restart resets them to zero anyway. Comparing a 28-sample
 * p95 against a fresh 28-sample p95 would be comparing two pieces of noise and calling the difference
 * a regression. This fires the SAME query list, in the SAME order, sequentially, with `noCache` — so
 * the only thing that differs between runs is the setting under test.
 *
 * It reports BOTH:
 *   · `noCache` — what the database actually costs, which is what nprobes changes;
 *   · cached — what a repeat caller experiences, so a cache-shaped win is not mistaken for a
 *     retrieval-shaped one.
 *
 * And it records `/stats` before and after its own run, so the service's own view is captured
 * alongside, never instead.
 *
 * Usage (from scripts/ingest):
 *   npx tsx vector-latency-ab.ts --label before --n 20
 *   npx tsx vector-latency-ab.ts --label after  --n 20
 *   npx tsx vector-latency-ab.ts --compare before after      # read the two artefacts back
 *
 * Artefacts land in scripts/ingest/.vector-ab/<label>.json — kept out of git, read by --compare.
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { GOLD } from './search/gold-queries'

export {}

const argv = process.argv.slice(2)
const arg = (f: string, d: string | null = null) => {
  const i = argv.indexOf(`--${f}`)
  const v = i >= 0 ? argv[i + 1] : undefined
  return v && !v.startsWith('--') ? v : d
}
const num = (f: string, d: number) => { const v = arg(f); const n = v ? parseInt(v, 10) : NaN; return Number.isFinite(n) ? n : d }

const URL = (process.env.VECTOR_SEARCH_URL ?? 'https://vector-serve-production.up.railway.app').replace(/\/$/, '')
const DIR = path.join(__dirname, '.vector-ab')
const N = num('n', 20)

const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)

async function stats(): Promise<any> {
  try { const r = await fetch(`${URL}/stats`); return r.ok ? await r.json() : { error: r.status } }
  catch (e) { return { error: (e as Error).message } }
}

async function one(query: string, noCache: boolean): Promise<{ ms: number; count: number; ok: boolean; serverMs: number | null }> {
  const t0 = Date.now()
  try {
    const r = await fetch(`${URL}/vector-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, limit: 20, noCache }),
    })
    const ms = Date.now() - t0
    if (!r.ok) return { ms, count: 0, ok: false, serverMs: null }
    const j = await r.json() as { count?: number; ms?: number }
    return { ms, count: j.count ?? 0, ok: true, serverMs: typeof j.ms === 'number' ? j.ms : null }
  } catch { return { ms: Date.now() - t0, count: 0, ok: false, serverMs: null } }
}

async function run(label: string) {
  const queries = GOLD.map((g) => g.query).slice(0, N)
  console.log(`[ab] label=${label}  n=${queries.length}  url=${URL}`)
  const before = await stats()
  console.log(`[ab] /stats before this run: served=${before.served} warm_p50=${before.warm_p50_ms} warm_p95=${before.warm_p95_ms} warm_n=${before.warm_n} nprobes=${before.config?.nprobes ?? '(not reported by this build)'}`)

  const uncached: number[] = []
  const serverUncached: number[] = []
  let failed = 0, empty = 0
  for (const q of queries) {
    const r = await one(q, true)
    if (!r.ok) { failed++; continue }
    if (r.count === 0) empty++
    uncached.push(r.ms)
    if (r.serverMs !== null) serverUncached.push(r.serverMs)
    process.stdout.write(`\r[ab] uncached ${uncached.length}/${queries.length}`)
  }
  console.log('')
  // Second pass over the SAME queries WITHOUT noCache — the first of these populates the cache, so
  // read it as "a repeat caller", which is a different question from what the database costs.
  const cached: number[] = []
  for (const q of queries) {
    const r = await one(q, false)
    if (r.ok) cached.push(r.ms)
  }
  for (const q of queries) {
    const r = await one(q, false)
    if (r.ok) cached.push(r.ms)
  }

  const after = await stats()
  const out = {
    label, measuredAt: new Date().toISOString(), url: URL, n: queries.length,
    failed, empty,
    uncached: { p50: pct(uncached, 50), p95: pct(uncached, 95), mean: Math.round(mean(uncached)), n: uncached.length, all: uncached },
    serverReported: { p50: pct(serverUncached, 50), p95: pct(serverUncached, 95), n: serverUncached.length },
    cachedPass: { p50: pct(cached, 50), p95: pct(cached, 95), n: cached.length },
    statsBefore: before, statsAfter: after,
  }
  fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(path.join(DIR, `${label}.json`), JSON.stringify(out, null, 1))

  console.log(`\n════ ${label.toUpperCase()} ════`)
  console.log(`  uncached (the database cost)   p50 ${out.uncached.p50} ms   p95 ${out.uncached.p95} ms   mean ${out.uncached.mean} ms   n=${out.uncached.n}`)
  console.log(`  server-reported ms             p50 ${out.serverReported.p50} ms   p95 ${out.serverReported.p95} ms`)
  console.log(`  cached repeat pass             p50 ${out.cachedPass.p50} ms   p95 ${out.cachedPass.p95} ms   n=${out.cachedPass.n}`)
  console.log(`  failures ${failed}, empty results ${empty}`)
  console.log(`  → scripts/ingest/.vector-ab/${label}.json`)
}

function compare(a: string, b: string) {
  const load = (l: string) => JSON.parse(fs.readFileSync(path.join(DIR, `${l}.json`), 'utf8'))
  const x = load(a), y = load(b)
  const d = (p: number, q: number) => `${q - p >= 0 ? '+' : ''}${q - p} ms (${p ? (((q - p) / p) * 100).toFixed(1) : '—'}%)`
  console.log(`\n════ ${a} → ${b} ════   (same query list, same order, sequential, noCache)`)
  console.log(`  n                ${x.n} vs ${y.n}`)
  console.log(`  uncached p50     ${x.uncached.p50} → ${y.uncached.p50}   ${d(x.uncached.p50, y.uncached.p50)}`)
  console.log(`  uncached p95     ${x.uncached.p95} → ${y.uncached.p95}   ${d(x.uncached.p95, y.uncached.p95)}`)
  console.log(`  uncached mean    ${x.uncached.mean} → ${y.uncached.mean}   ${d(x.uncached.mean, y.uncached.mean)}`)
  console.log(`  cached p50       ${x.cachedPass.p50} → ${y.cachedPass.p50}   ${d(x.cachedPass.p50, y.cachedPass.p50)}`)
  console.log(`  failures         ${x.failed} → ${y.failed};  empty ${x.empty} → ${y.empty}`)
  const rise = x.uncached.p95 ? ((y.uncached.p95 - x.uncached.p95) / x.uncached.p95) * 100 : 0
  console.log(`\n  p95 change: ${rise.toFixed(1)}%  — the brief's revert criterion is +50%`)
  console.log(rise > 50
    ? '  ✗ REVERT: p95 rose by more than 50%. Recall can be improved later; a slow product in front of pilot users is a worse trade.'
    : '  ✓ within the revert criterion')
}

async function main() {
  const cmp = arg('compare')
  if (cmp) { const second = argv[argv.indexOf('--compare') + 2]; return compare(cmp, second ?? 'after') }
  const label = arg('label')
  if (!label) { console.error('usage: --label <before|after> [--n 20]   |   --compare before after'); process.exit(1) }
  await run(label)
}
main().catch((e) => { console.error('[ab] FATAL', e); process.exit(1) })
