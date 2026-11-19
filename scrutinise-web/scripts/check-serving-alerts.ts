/**
 * check-serving-alerts.ts — SEARCH-30: the digest's latency alerts must be QUIET on a healthy service and LOUD on the 20 Oct state.
 *
 *   npm run check:serving-alerts
 *
 * The fixtures are not invented: they are vector-serve's own /stats as recorded in the census files —
 * s28-gold-off-1.json (26 Sep boot, healthy, read 20 Oct 07:40) and s28-gold-on-2.json (20 Oct 08:15 boot, the slow state).
 * Then the LIVE /stats of both services, which must raise nothing about latency today (they were measured healthy on 18 Nov).
 * The old rule (p95 > 5 s) is evaluated beside the new one on the same data, to show why it was replaced.
 */
import fs from 'node:fs'
import path from 'node:path'
import { servingAlerts, type ServeStatsShape } from '../lib/lex/cost-digest-data'

let pass = 0, fail = 0, controlsFired = 0, controlsDead = 0
const ok = (name: string, cond: boolean, detail = '') => { if (cond) pass++; else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`) } }
const control = (name: string, propertyHolds: boolean) => { if (!propertyHolds) controlsFired++; else { controlsDead++; console.log(`  ✗✗ CONTROL DEAD: ${name}`) } }
const census = (f: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/census', f), 'utf8'))
const latency = (lines: string[]) => lines.filter((l) => /storage|slow/.test(l))
const oldRule = (s: { warm_p95_ms?: number }) => (s.warm_p95_ms ?? 0) > 5000

async function main() {
  const healthy = census('s28-gold-off-1.json').vectorServeBefore as ServeStatsShape & { warm_p95_ms: number; started_at: string }
  const slow = census('s28-gold-on-2.json').vectorServeBefore as ServeStatsShape & { warm_p95_ms: number; started_at: string }
  ok('premise: the healthy fixture is the 26 Sep boot and the slow one the 20 Oct boot', healthy.started_at.startsWith('2026-09-26') && slow.started_at.startsWith('2026-10-20'))

  const h = servingAlerts('vector-serve', healthy), s = servingAlerts('vector-serve', slow)
  ok('HEALTHY 26 Sep boot (p50 3.3 s, cpu/wall 1.31): no latency alert', latency(h).length === 0, h.join(' | '))
  ok('SLOW 20 Oct boot (p50 46 s, cpu/wall 0.13): the storage-bound alert fires', s.some((l) => /waiting on storage/.test(l)), s.join(' | '))
  ok('SLOW 20 Oct boot: the slow-p50 alert fires too', s.some((l) => /is slow/.test(l)), s.join(' | '))
  // why the old rule went: it could not tell these two apart
  ok('the OLD rule (p95 > 5 s) fired on the HEALTHY boot as well — it could not tell them apart', oldRule(healthy) && oldRule(slow))
  control('the new rule is loud on the healthy boot', latency(h).length > 0)
  control('the new rule is quiet on the slow boot', latency(s).length === 0)

  // minimum samples: a just-restarted service with two slow queries must not trip it
  const fresh = servingAlerts('fts-serve', { warm_n: 2, warm_p50_ms: 40_000, cpu_over_wall: 0.1 })
  ok('a fresh boot with 2 warm queries raises no latency alert (minimum sample)', latency(fresh).length === 0, fresh.join(' | '))
  ok('fts-serve shape (cpu/wall at the top level) is read as well as vector-serve\'s (in stages)', servingAlerts('fts-serve', { warm_n: 20, cpu_over_wall: 0.1 }).some((l) => /storage/.test(l)))
  ok('memory and shed alerts are unchanged', servingAlerts('x', { memory: { peak_pct_of_cap: 80 }, concurrency: { rejections: 2 } }).length === 2)

  // SEARCH-31: the observer and the digest use the SAME storage-bound numbers. The observer is in the ingest package, which
  // the web program must not import (CLAUDE.md §20 check 0), so its source is read as text.
  const obsSrc = fs.readFileSync(path.join(__dirname, '../../scripts/ingest/search/serve-observer.ts'), 'utf8')
  const num = (re: RegExp) => { const m = obsSrc.match(re); return m ? Number(m[1]) : NaN }
  const { STORAGE_BOUND_CPU_OVER_WALL, STORAGE_BOUND_MIN_N, observerServingLines } = await import('../lib/lex/cost-digest-data')
  ok('premise: the observer source was read and defines its storage-bound threshold', /STORAGE_BOUND_CPU_OVER_WALL\s*=/.test(obsSrc))
  ok('observer and digest agree on the storage-bound cpu/wall threshold', num(/STORAGE_BOUND_CPU_OVER_WALL\s*=\s*([\d.]+)/) === STORAGE_BOUND_CPU_OVER_WALL, `${num(/STORAGE_BOUND_CPU_OVER_WALL\s*=\s*([\d.]+)/)} vs ${STORAGE_BOUND_CPU_OVER_WALL}`)
  ok('observer and digest agree on its minimum sample', num(/STORAGE_BOUND_MIN_N\s*=\s*(\d+)/) === STORAGE_BOUND_MIN_N)

  // SEARCH-31: what the observer's persisted state adds to the digest
  const boot = '2026-10-20T08:15:57.196Z', NOWD = Date.parse('2026-10-20T10:00:00Z')
  const st = {
    verdict: { 'vector-serve': { bootAt: boot, slow: true, reasons: ['waiting on storage, not computing: cpu/wall 0.13', 'warm p50 46000 ms over 50 queries is 13.9× the last healthy boot (3300 ms, booted 2026-09-26T02:10:13.171Z)'] } },
    autoRestartLog: { 'vector-serve': [{ at: '2026-10-20T09:30:00.000Z', reasons: ['cpu/wall 0.13'], outcome: 'requested' }, { at: '2026-10-18T09:30:00.000Z', reasons: ['old'], outcome: 'requested' }] },
  }
  const lines = observerServingLines('vector-serve', st, boot, NOWD)
  ok('the 3× rule reaches the digest line for the boot running now', lines.some((l) => /13\.9× the last healthy boot/.test(l)), lines.join(' | '))
  ok('the storage-bound reason is NOT repeated from the observer (servingAlerts computes it live)', !lines.some((l) => /waiting on storage/.test(l)))
  ok('an automatic restart in the last 24 h is named, with its reason', lines.some((l) => /restarted automatically at 09:30 UTC because: cpu\/wall 0\.13/.test(l)), lines.join(' | '))
  ok('one older than 24 h is not', !lines.some((l) => /because: old/.test(l)))
  control('a verdict for a DIFFERENT boot still reaches the digest', observerServingLines('vector-serve', st, '2026-10-21T00:00:00.000Z', NOWD).some((l) => /last healthy boot/.test(l)))
  ok('a failed restart says FAILED', observerServingLines('x', { autoRestartLog: { x: [{ at: '2026-10-20T09:30:00.000Z', reasons: ['r'], outcome: 'failed', detail: 'Bad Access' }] } }, null, NOWD).some((l) => /FAILED \(Bad Access\)/.test(l)))

  // live: both services were measured healthy on 18 Nov; today they must raise no latency alert
  for (const [name, url] of [['fts-serve', 'https://fts-serve-production-4cea.up.railway.app'], ['vector-serve', 'https://vector-serve-production.up.railway.app']]) {
    try {
      const live = await (await fetch(`${url}/stats`, { signal: AbortSignal.timeout(15_000) })).json() as ServeStatsShape & { warm_p95_ms?: number }
      const a = servingAlerts(name, live)
      console.log(`  live ${name}: p50 ${live.warm_p50_ms} ms, n ${live.warm_n}, cpu/wall ${live.cpu_over_wall ?? live.stages?.cpu_over_wall}; new rule: ${a.length ? a.join(' | ') : 'quiet'}; old rule: ${oldRule(live) ? 'FIRES' : 'quiet'}`)
      ok(`live ${name}: no latency alert today`, latency(a).length === 0, a.join(' | '))
    } catch (e) { console.log(`  live ${name}: NOT CHECKED (${(e as Error).message})`) }
  }
  console.log(`\ncheck:serving-alerts — ${pass} passed, ${fail} failed · controls: ${controlsFired} fired, ${controlsDead} dead`)
  // exitCode, not exit(): exiting while undici's sockets are closing trips a libuv assertion on Windows (exit 9 after a green run)
  process.exitCode = fail || controlsDead ? 1 : 0
}
main()
