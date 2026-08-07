/**
 * check-serve-observer.ts — checks for serve-observer.ts's alert logic.
 *
 * The whole point of splitting `evaluateServe()` out as a pure function is that the
 * thresholds can be exercised against constructed inputs instead of by waiting for a real
 * outage. An alerting system that has never been shown to fire is not a monitored system.
 *
 * Usage: tsx search/check-serve-observer.ts
 */
import { evaluateServe, renderDigest, type Observation, type NeonObservation, type ServeState } from './serve-observer'

export {}

let passed = 0, failed = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

const FRESH: ServeState = { startedAt: {}, lastAlertAt: {}, lastDigestDay: '', embedCallsBaseline: {} }
const OK_NEON: NeonObservation = { ok: true, sizeGb: 8, ceilingGb: 17.5, pctOfCeiling: 45.7, connections: 12, maxConnections: 100 }
// 2026-08-07 09:00 UTC — past the 08:00 digest hour, so digest tests are deterministic.
const NOW = Date.parse('2026-08-07T09:00:00Z')

function healthy(name = 'vector-serve', over: Partial<Observation['stats']> = {}): Observation {
  return {
    name, url: `https://${name}.example`, ok: true,
    stats: {
      served: 100, errors: 0, warm_p50_ms: 900, warm_p95_ms: 1800, warm_n: 100,
      concurrency: { max: 4, maxQueue: 64, inFlight: 0, queued: 0, queueHighWaterMark: 3, rejections: 0 },
      memory: { rss_mb: 300, peak_rss_mb: 800, cap_mb: 7629, pct_of_cap: 3.9, peak_pct_of_cap: 10.5, peak_rss_at: '2026-08-07T08:00:00Z' },
      uptime_s: 7200, started_at: '2026-08-07T07:00:00Z',
      ...over,
    },
  }
}
const keys = (evs: { key: string }[]) => evs.map((e) => e.key)

function main() {
  console.log('healthy baseline')
  {
    const { events } = evaluateServe([healthy()], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW)
    check('no alerts when everything is within threshold', events.length === 0, keys(events).join(','))
  }

  console.log('\nunreachable service — the case a naive observer reports as silence')
  {
    const down: Observation = { name: 'fts-serve', url: 'https://x', ok: false, error: 'fetch failed' }
    const { events } = evaluateServe([down], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW)
    check('raises a CRITICAL alert', events.some((e) => e.key === 'fts-serve:down' && e.severity === 'critical'))
    check('does not silently skip the service', events.length > 0)
  }

  console.log('\nmemory > 70% of cap')
  {
    const hot = healthy('vector-serve', { memory: { rss_mb: 6000, peak_rss_mb: 5800, cap_mb: 7629, pct_of_cap: 78.6, peak_pct_of_cap: 76.0, peak_rss_at: 'x' } })
    const { events } = evaluateServe([hot], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW)
    check('fires', events.some((e) => e.key === 'vector-serve:memory' && e.severity === 'critical'))
    check('body says do NOT raise the limit (§17)', events.find((e) => e.key === 'vector-serve:memory')!.body.includes('Heavy Job Runner'))
    const edge = healthy('vector-serve', { memory: { rss_mb: 100, peak_rss_mb: 5340, cap_mb: 7629, pct_of_cap: 1, peak_pct_of_cap: 70.0, peak_rss_at: 'x' } })
    check('exactly 70.0% does NOT fire (threshold is >70)', !evaluateServe([edge], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW).events.some((e) => e.key.endsWith(':memory')))
  }

  console.log('\np95 > 5s')
  {
    const slow = healthy('fts-serve', { warm_p95_ms: 5001 })
    check('fires just over the line', evaluateServe([slow], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW).events.some((e) => e.key === 'fts-serve:p95'))
    const okp = healthy('fts-serve', { warm_p95_ms: 5000 })
    check('does not fire exactly at the line', !evaluateServe([okp], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW).events.some((e) => e.key === 'fts-serve:p95'))
  }

  console.log('\nrejections > 0')
  {
    const shed = healthy('vector-serve', { concurrency: { max: 4, maxQueue: 64, inFlight: 4, queued: 64, queueHighWaterMark: 64, rejections: 7 } })
    check('fires', evaluateServe([shed], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW).events.some((e) => e.key === 'vector-serve:rejections'))
    // FTS reports null (unbounded queue) — null must NOT be treated as 0 or as a breach.
    const unbounded = healthy('fts-serve', { concurrency: { max: 4, maxQueue: null, inFlight: 0, queued: 0, queueHighWaterMark: 9, rejections: null } })
    check('null rejections (unbounded queue) does not fire', !evaluateServe([unbounded], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW).events.some((e) => e.key.endsWith(':rejections')))
  }

  console.log('\ncrash / restart detection')
  {
    const prior: ServeState = { ...FRESH, startedAt: { 'vector-serve': '2026-08-07T01:00:00Z' }, lastDigestDay: '2026-08-07' }
    const { events, nextState } = evaluateServe([healthy()], OK_NEON, prior, NOW)
    check('a changed started_at fires', events.some((e) => e.key === 'vector-serve:restart' && e.severity === 'critical'))
    check('state records the new boot time', nextState.startedAt['vector-serve'] === '2026-08-07T07:00:00Z')
    check('warns that counters reset', events.find((e) => e.key === 'vector-serve:restart')!.body.includes('counters reset'))
    // First ever sighting must not be reported as a restart.
    check('first sighting is not a restart', !evaluateServe([healthy()], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW).events.some((e) => e.key.endsWith(':restart')))
    // A crash loop is many restarts; the re-alert window must NOT swallow the second one.
    const s2: ServeState = { ...nextState, lastDigestDay: '2026-08-07' }
    const again = evaluateServe([healthy('vector-serve', { started_at: '2026-08-07T08:30:00Z' })], OK_NEON, s2, NOW)
    check('a SECOND restart still fires (crash loops must not be deduped away)', again.events.some((e) => e.key === 'vector-serve:restart'))
  }

  console.log('\nNeon storage > 80%')
  {
    const full: NeonObservation = { ok: true, sizeGb: 15, ceilingGb: 17.5, pctOfCeiling: 85.7, connections: 20, maxConnections: 100 }
    check('fires', evaluateServe([healthy()], full, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW).events.some((e) => e.key === 'neon:storage'))
    check('a failed Neon check is itself reported', evaluateServe([healthy()], { ok: false, error: 'timeout' }, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW).events.some((e) => e.key === 'neon:down'))
  }

  console.log('\nre-alert suppression')
  {
    const hot = healthy('vector-serve', { memory: { rss_mb: 6000, peak_rss_mb: 5800, cap_mb: 7629, pct_of_cap: 78.6, peak_pct_of_cap: 76.0, peak_rss_at: 'x' } })
    const recent: ServeState = { ...FRESH, lastDigestDay: '2026-08-07', lastAlertAt: { 'vector-serve:memory': new Date(NOW - 3600_000).toISOString() } }
    check('same breach 1h later is suppressed', !evaluateServe([hot], OK_NEON, recent, NOW).events.some((e) => e.key === 'vector-serve:memory'))
    const old: ServeState = { ...FRESH, lastDigestDay: '2026-08-07', lastAlertAt: { 'vector-serve:memory': new Date(NOW - 13 * 3600_000).toISOString() } }
    check('same breach 13h later fires again', evaluateServe([hot], OK_NEON, old, NOW).events.some((e) => e.key === 'vector-serve:memory'))
  }

  console.log('\ndaily digest')
  {
    const { events, nextState } = evaluateServe([healthy()], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-06' }, NOW)
    check('fires once for a new day past the digest hour', events.filter((e) => e.kind === 'digest').length === 1)
    check('state advances so it does not repeat', nextState.lastDigestDay === '2026-08-07')
    check('does not repeat within the same day', !evaluateServe([healthy()], OK_NEON, nextState, NOW).events.some((e) => e.kind === 'digest'))
    const early = Date.parse('2026-08-07T05:00:00Z')
    check('does not fire before the digest hour', !evaluateServe([healthy()], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-06' }, early).events.some((e) => e.kind === 'digest'))
  }

  console.log('\ndigest content — it must be pasteable, not a traffic light')
  {
    const body = renderDigest([healthy('fts-serve'), healthy('vector-serve')], OK_NEON, NOW)
    check('states that counters are since-boot', body.includes('SINCE THAT SERVICE BOOTED'))
    check('includes peak memory vs cap', body.includes('PEAK') && body.includes('% of cap'))
    check('includes raw JSON for pasting', body.includes('raw /stats') && body.includes('"warm_p95_ms"'))
    check('names both services', body.includes('fts-serve') && body.includes('vector-serve'))
    const withDown = renderDigest([{ name: 'fts-serve', url: 'u', ok: false, error: 'boom' }], OK_NEON, NOW)
    check('renders an unreachable service loudly', withDown.includes('NOT RESPONDING'))
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}

main()
