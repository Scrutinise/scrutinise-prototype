/**
 * check-serve-observer.ts — checks for serve-observer.ts's alert logic.
 *
 * The whole point of splitting `evaluateServe()` out as a pure function is that the
 * thresholds can be exercised against constructed inputs instead of by waiting for a real
 * outage. An alerting system that has never been shown to fire is not a monitored system.
 *
 * Usage: tsx search/check-serve-observer.ts
 */
import {
  evaluateServe, renderDigest, classifyRestart, summarizeHealth,
  type Observation, type NeonObservation, type ServeState, type RestartEvidenceEvent,
} from './serve-observer'
import { SERVICES } from '../ops/sleep-state'

export {}

let passed = 0, failed = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

const FRESH: ServeState = { startedAt: {}, lastAlertAt: {}, lastDigestDay: '', embedCallsBaseline: {}, restartLog: {}, downSince: {} }
const FTS_ID = SERVICES['fts-serve']
const VECTOR_ID = SERVICES['vector-serve']
// GRAPH 3C §5 — a COST observation now, not a capacity one. 8 GB × $0.35 = $2.80/month against a
// $15 budget = 18.7%, comfortably quiet.
const OK_NEON: NeonObservation = { ok: true, sizeGb: 8, storageUsdPerMonth: 2.80, budgetUsd: 15, pctOfBudget: 18.7, connections: 12, maxConnections: 100 }
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

  console.log('\nunreachable service — the case a naive observer reports as silence, gated to >5 min (S25)')
  {
    const down: Observation = { name: 'fts-serve', url: 'https://x', ok: false, error: 'fetch failed' }
    const first = evaluateServe([down], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW)
    check('the FIRST unreachable poll does not alert (could be transient)', !first.events.some((e) => e.key === 'fts-serve:down'))
    check('but it is not silently skipped either — downSince is recorded', first.nextState.downSince['fts-serve'] === new Date(NOW).toISOString())

    const stillDown = evaluateServe([down], OK_NEON, { ...first.nextState, lastDigestDay: '2026-08-07' }, NOW + 6 * 60_000)
    check('still down 6 minutes later raises a CRITICAL alert', stillDown.events.some((e) => e.key === 'fts-serve:down' && e.severity === 'critical'))

    const stillDownSoon = evaluateServe([down], OK_NEON, { ...first.nextState, lastDigestDay: '2026-08-07' }, NOW + 3 * 60_000)
    check('still down only 3 minutes later does not yet alert', !stillDownSoon.events.some((e) => e.key === 'fts-serve:down'))

    const backUp: Observation = healthy('fts-serve')
    const resolved = evaluateServe([backUp], OK_NEON, { ...stillDown.nextState, lastDigestDay: '2026-08-07' }, NOW + 12 * 60_000)
    check('recovery after an alerted outage announces itself resolved', resolved.events.some((e) => e.key === 'fts-serve:down-resolved'))
    check('downSince is cleared on recovery', resolved.nextState.downSince['fts-serve'] === undefined)

    const blipUp = evaluateServe([healthy('fts-serve')], OK_NEON, { ...stillDownSoon.nextState, lastDigestDay: '2026-08-07' }, NOW + 4 * 60_000)
    check('recovery from a SHORT blip (never alerted) does not send an all-clear either', !blipUp.events.some((e) => e.key === 'fts-serve:down-resolved'))
  }

  console.log('\nmemory > 70% of cap — S25: no longer an immediate email, folds into summarizeHealth()')
  {
    const hot = healthy('vector-serve', { memory: { rss_mb: 6000, peak_rss_mb: 5800, cap_mb: 7629, pct_of_cap: 78.6, peak_pct_of_cap: 76.0, peak_rss_at: 'x' } })
    const { events, nextState } = evaluateServe([hot], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW)
    check('does NOT fire an immediate alert any more', !events.some((e) => e.key === 'vector-serve:memory'))
    check('but summarizeHealth() names it as an exception', summarizeHealth([hot], OK_NEON, nextState, NOW).exceptions.some((x) => x.includes('memory at 76')))
    const edge = healthy('vector-serve', { memory: { rss_mb: 100, peak_rss_mb: 5340, cap_mb: 7629, pct_of_cap: 1, peak_pct_of_cap: 70.0, peak_rss_at: 'x' } })
    check('exactly 70.0% is not an exception (threshold is >70)', summarizeHealth([edge], OK_NEON, FRESH, NOW).healthy)
  }

  console.log('\np95 > 5s — S25: digest-only')
  {
    const slow = healthy('fts-serve', { warm_p95_ms: 5001 })
    check('no immediate alert', !evaluateServe([slow], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW).events.some((e) => e.key === 'fts-serve:p95'))
    check('summarizeHealth names it', summarizeHealth([slow], OK_NEON, FRESH, NOW).exceptions.some((x) => x.includes('fts-serve p95')))
    const okp = healthy('fts-serve', { warm_p95_ms: 5000 })
    check('exactly at the line is healthy', summarizeHealth([okp], OK_NEON, FRESH, NOW).healthy)
  }

  console.log('\nrejections > 0 — S25: digest-only')
  {
    const shed = healthy('vector-serve', { concurrency: { max: 4, maxQueue: 64, inFlight: 4, queued: 64, queueHighWaterMark: 64, rejections: 7 } })
    check('no immediate alert', !evaluateServe([shed], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW).events.some((e) => e.key === 'vector-serve:rejections'))
    check('summarizeHealth names it', summarizeHealth([shed], OK_NEON, FRESH, NOW).exceptions.some((x) => x.includes('shed 7')))
    // FTS reports null (unbounded queue) — null must NOT be treated as 0 or as a breach.
    const unbounded = healthy('fts-serve', { concurrency: { max: 4, maxQueue: null, inFlight: 0, queued: 0, queueHighWaterMark: 9, rejections: null } })
    check('null rejections (unbounded queue) is healthy', summarizeHealth([unbounded], OK_NEON, FRESH, NOW).healthy)
  }

  console.log('\nrestart classification (S25) — classifyRestart() in isolation')
  {
    const boot = '2026-08-07T07:00:00.000Z'
    const nearbyResume: RestartEvidenceEvent[] = [{ serviceId: FTS_ID, action: 'resumed', createdAt: '2026-08-07T07:00:02.000Z' }]
    const nearbyDeploy: RestartEvidenceEvent[] = [{ serviceId: FTS_ID, action: 'deployed', createdAt: '2026-08-07T07:00:01.500Z' }]
    const farResume: RestartEvidenceEvent[] = [{ serviceId: FTS_ID, action: 'resumed', createdAt: '2026-08-07T07:10:00.000Z' }] // 10 min away — outside the window
    check('a nearby "resumed" event classifies as wake', classifyRestart('fts-serve', boot, nearbyResume, true) === 'wake')
    check('a nearby "deployed" event classifies as deploy', classifyRestart('fts-serve', boot, nearbyDeploy, true) === 'deploy')
    check('no matching evidence, query OK, classifies as crash', classifyRestart('fts-serve', boot, [], true) === 'crash')
    check('a failed evidence query classifies as unknown, NOT crash', classifyRestart('fts-serve', boot, [], false) === 'unknown')
    check('an unmapped service name classifies as unknown', classifyRestart('some-other-service', boot, nearbyResume, true) === 'unknown')
    check('evidence outside the window does not count — still crash', classifyRestart('fts-serve', boot, farResume, true) === 'crash')
    check('evidence for a DIFFERENT service does not count', classifyRestart('fts-serve', boot, [{ serviceId: VECTOR_ID, action: 'resumed', createdAt: '2026-08-07T07:00:01.000Z' }], true) === 'crash')
  }

  console.log('\nrestart classification — through evaluateServe(): only a CRASH can ever alert, only at 3+/hour')
  {
    const prior: ServeState = { ...FRESH, startedAt: { 'vector-serve': '2026-08-07T01:00:00Z' }, lastDigestDay: '2026-08-07' }
    const resumeEvidence: RestartEvidenceEvent[] = [{ serviceId: VECTOR_ID, action: 'resumed', createdAt: '2026-08-07T07:00:00.500Z' }]

    const wake = evaluateServe([healthy('vector-serve')], OK_NEON, prior, NOW, resumeEvidence, true)
    check('a wake (matching "resumed" evidence) never alerts', !wake.events.some((e) => e.kind === 'alert'))
    check('but IS recorded in restartLog, so it still surfaces (never hidden)', wake.nextState.restartLog['vector-serve']?.[0]?.kind === 'wake')
    check('state records the new boot time regardless of kind', wake.nextState.startedAt['vector-serve'] === '2026-08-07T07:00:00Z')

    // First ever sighting must not be reported as a restart at all (no prior boot to compare).
    check('first sighting is not a restart', !evaluateServe([healthy()], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW).events.some((e) => e.kind === 'alert' && e.key.includes('crash')))

    // One crash alone (no evidence, query ok) must NOT alert — only 3+/hour does.
    const oneCrash = evaluateServe([healthy('vector-serve')], OK_NEON, prior, NOW, [], true)
    check('a LONE crash (below threshold) does not alert', !oneCrash.events.some((e) => e.kind === 'alert'))
    check('but is still logged as a crash', oneCrash.nextState.restartLog['vector-serve']?.[0]?.kind === 'crash')

    // Three crashes inside the hour, no evidence each time → the third (only) fires.
    let state = prior
    let crashAlerts = 0
    for (let i = 1; i <= 3; i++) {
      const t = NOW + i * 5 * 60_000
      const boot = new Date(t).toISOString()
      const r = evaluateServe([healthy('vector-serve', { started_at: boot })], OK_NEON, state, t, [], true)
      state = r.nextState
      crashAlerts += r.events.filter((e) => e.key === 'vector-serve:crash-loop').length
    }
    check('exactly one crash-loop alert after 3 unexplained restarts in an hour', crashAlerts === 1, `got ${crashAlerts}`)

    // A 4th crash immediately after must be deduped by the re-alert window, not re-fire at once.
    const t4 = NOW + 4 * 5 * 60_000
    const r4 = evaluateServe([healthy('vector-serve', { started_at: new Date(t4).toISOString() })], OK_NEON, state, t4, [], true)
    check('a 4th crash right after does not immediately re-alert (re-alert window)', !r4.events.some((e) => e.key === 'vector-serve:crash-loop'))

    // Once the crashes age out of the 1-hour window (no restart needed — just time passing
    // and a normal healthy tick), the crash loop must announce itself resolved.
    const wayLater = t4 + 65 * 60_000 // >1h after the last logged crash
    const resolvedTick = evaluateServe([healthy('vector-serve', { started_at: new Date(t4).toISOString() })], OK_NEON, r4.nextState, wayLater)
    check('crash loop announces itself resolved once crashes age out of the window', resolvedTick.events.some((e) => e.key === 'vector-serve:crash-loop-resolved'))

    // A deploy or a wake must NEVER count toward the crash-loop tally, however many happen.
    let s2 = prior
    let deployAlerts = 0
    for (let i = 1; i <= 5; i++) {
      const t = NOW + i * 5 * 60_000
      const boot = new Date(t).toISOString()
      const evidence: RestartEvidenceEvent[] = [{ serviceId: VECTOR_ID, action: 'deployed', createdAt: boot }]
      const r = evaluateServe([healthy('vector-serve', { started_at: boot })], OK_NEON, s2, t, evidence, true)
      s2 = r.nextState
      deployAlerts += r.events.filter((e) => e.kind === 'alert').length
    }
    check('5 deploys in an hour never alert', deployAlerts === 0)
  }

  console.log('\nNeon storage past its COST budget — S25: digest-only, via summarizeHealth()')
  {
    // ⚠ 15 GB is NOT a breach any more, and that is the point of the change: 15 × $0.35 = $5.25,
    // 35% of the $15 budget. The old fixture breached at 15 GB because it was measured against a
    // 17.5 GB "ceiling" that did not exist — and the live database has been past that line since
    // GRAPH 3B, emitting a CRITICAL alert against a fiction. The breach fixture is now a database
    // that genuinely costs more than the budget: 50 GB = $17.50/month, 116.7%.
    const full: NeonObservation = { ok: true, sizeGb: 50, storageUsdPerMonth: 17.50, budgetUsd: 15, pctOfBudget: 116.7, connections: 20, maxConnections: 100 }
    const under: NeonObservation = { ok: true, sizeGb: 19.01, storageUsdPerMonth: 6.65, budgetUsd: 15, pctOfBudget: 44.3, connections: 20, maxConnections: 100 }
    check('no immediate alert for the under-budget case', !evaluateServe([healthy()], under, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW).events.some((e) => e.key === 'neon:storage'))
    check('no immediate alert even over budget (S25 moved this to the digest)', !evaluateServe([healthy()], full, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW).events.some((e) => e.key === 'neon:storage'))
    check('over-budget is healthy=false via summarizeHealth', !summarizeHealth([healthy()], full, FRESH, NOW).healthy)
    check('under-budget is healthy via summarizeHealth', summarizeHealth([healthy()], under, FRESH, NOW).healthy)
    check('a failed Neon check no longer alerts immediately either', !evaluateServe([healthy()], { ok: false, error: 'timeout' }, { ...FRESH, lastDigestDay: '2026-08-07' }, NOW).events.some((e) => e.key === 'neon:down'))
    check('but IS surfaced via summarizeHealth (never silently dropped)', summarizeHealth([healthy()], { ok: false, error: 'timeout' }, FRESH, NOW).exceptions.some((x) => x.includes('Neon check failed')))
  }

  console.log('\nre-alert suppression (tested against `down`, one of the two rules that still alerts immediately post-S25)')
  {
    const down: Observation = { name: 'vector-serve', url: 'https://x', ok: false, error: 'fetch failed' }
    const downSince = new Date(NOW - 3600_000).toISOString() // already down an hour — well past the 5-min gate
    const recent: ServeState = { ...FRESH, lastDigestDay: '2026-08-07', downSince: { 'vector-serve': downSince }, lastAlertAt: { 'vector-serve:down': new Date(NOW - 3600_000).toISOString() } }
    check('same outage, alerted 1h ago, is suppressed', !evaluateServe([down], OK_NEON, recent, NOW).events.some((e) => e.key === 'vector-serve:down'))
    const old: ServeState = { ...FRESH, lastDigestDay: '2026-08-07', downSince: { 'vector-serve': downSince }, lastAlertAt: { 'vector-serve:down': new Date(NOW - 13 * 3600_000).toISOString() } }
    check('same outage, alerted 13h ago, fires again', evaluateServe([down], OK_NEON, old, NOW).events.some((e) => e.key === 'vector-serve:down'))
  }

  console.log('\ndaily digest — RETIRED from evaluateServe() by S25 (scrutinise-web/scripts/cost-digest.ts is the one daily email now)')
  {
    const { events } = evaluateServe([healthy()], OK_NEON, { ...FRESH, lastDigestDay: '2026-08-06' }, NOW)
    check('evaluateServe() never emits a digest event any more', !events.some((e) => e.kind === 'digest'))
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
