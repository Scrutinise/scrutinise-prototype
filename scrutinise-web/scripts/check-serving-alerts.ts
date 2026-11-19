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
