/**
 * serve-observer.ts — ongoing health reporting + email alerting for BOTH retrieval serve
 * services (`fts-serve` and `vector-serve`).
 *
 * Same shape as embed-observer.ts, which is the proven pattern here: a pure `evaluate…()`
 * that turns observations into events (unit-testable, no I/O), and a `checkServeHealth()`
 * that does the fetching, the R2 state round-trip and the Resend send. `ops.ts` imports the
 * latter and calls it on the hourly tick.
 *
 * WHAT IT REPORTS (the brief's list, per service):
 *   memory      current + PEAK RSS against the 8 GB per-replica cap, as a percentage
 *   concurrency inFlight, queued, queueHighWaterMark, rejections
 *   throughput  served count, p50, p95 — both uncached and all-requests where available
 *   errors      5xx count, and CLASSIFIED crashes/restarts since the last report
 *   Neon        database size PRICED against a storage budget, and connection count
 *               (GRAPH 3C §5 — there is no plan ceiling; see the constants below)
 *   cost        Railway service-hours, and Gemini embed calls/day (vector's per-query cost)
 *
 * IMMEDIATE email on: memory >70% of cap, warm p95 >5s, a CRASH LOOP (3+ crashes/hour — see
 * below), Neon storage past its COST budget, rejections >0. Otherwise a daily digest.
 *
 * ── S25 — RESTART CLASSIFICATION (deploy / wake-from-sleep / crash) ──────────────────────
 *
 * Before S25 this file emailed "RESTARTED" on every boot-time change, with no distinction
 * between a deploy, a sleep/wake cycle, and an actual crash — measured to be the direct
 * cause of ~80 false alerts in one morning (docs/SEARCH_S25_REPORT.md §1). Railway's own
 * `environmentHistory` query (reachable with the SAME Project-Access-Token this file already
 * has no use for elsewhere — `ops/audit-sleep.ts`'s `rail()`) records `resumed` and
 * `deployed` events per service, timestamped to the millisecond. A restart is classified by
 * looking for one of those events within `RESTART_EVIDENCE_WINDOW_MS` of the new boot time:
 *
 *   'wake'    a `resumed` event nearby         → never alerts, only counted
 *   'deploy'  a `deployed` event nearby         → never alerts, only counted
 *   'crash'   neither, AND the history query succeeded → alerts, but ONLY at 3+ in an hour
 *   'unknown' the history query itself failed, or this service has no known Railway service
 *             id → NEVER alerts (a failed classification lookup must not manufacture a
 *             crash alert) but is reported, never silently dropped — same rule as an
 *             unpriced LlmSpend row (spend-ledger.ts) or a truncated LLM response (§18):
 *             "could not classify" is a different, honestly-labelled outcome from "crash".
 *
 * ── THREE THINGS THAT ARE DELIBERATE ─────────────────────────────────────────
 *
 * 1. THE DIGEST CARRIES RAW NUMBERS, NOT A TRAFFIC LIGHT. The brief asks for enough detail
 *    to paste into a conversation and get a useful read. A red/amber/green summary throws
 *    away exactly the information needed to say *why* — so every counter is printed, and
 *    the JSON block at the end is the whole `/stats` payload for both services.
 *
 * 2. COUNTERS ARE SINCE-BOOT, AND THAT IS STATED IN THE EMAIL. `/stats` resets on restart
 *    (docs/CLAUDE.md §17). An observer that silently reported "served: 12" after a restart
 *    would look like a traffic collapse. The digest prints uptime beside every counter and
 *    says so when a restart has been detected in the window.
 *
 * 3. UNREACHABLE ≠ HEALTHY. A service that fails to answer /stats produces a CRITICAL
 *    event, not a skipped section. The failure mode this exists to catch is a service that
 *    is dead, and the naive version of this script — fetch, and report what came back —
 *    reports nothing at all in precisely that case.
 */
import { r2Get, r2Put } from '../shared/r2-client'
import { rail } from '../ops/audit-sleep'
import { SERVICES as RAILWAY_SERVICE_IDS, ENV_ID as RAILWAY_ENVIRONMENT_ID } from '../ops/sleep-state'

const RESEND_API = 'https://api.resend.com/emails'
const EMAIL_TO = process.env.SERVE_OBSERVER_TO ?? 'cl@scrutinise.org'
const EMAIL_FROM = 'Scrutinise Search <ingest@messages.scrutinise.org>'
const STATE_KEY = '_search/serve-observer-state.json'

const MEM_ALERT_PCT = parseFloat(process.env.SERVE_MEM_ALERT_PCT ?? '70')
const P95_ALERT_MS = parseInt(process.env.SERVE_P95_ALERT_MS ?? '5000', 10)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// NEON STORAGE — A COST LINE, NOT A CEILING.        Replaced by GRAPH 3C §5, 21 Aug 2026.
// ════════════════════════════════════════════════════════════════════════════════════════════════
//
// What was here:
//     const NEON_CEILING_GB = parseFloat(process.env.NEON_CEILING_GB ?? '17.5')
//     // Neon plan ceiling. The handoff records the storage line at ~17.5 GB …
//
// ⚠⚠ It was not a plan ceiling and never had been, and its provenance was a closed loop: the
// comment cited "the handoff", and the handoff's percentage was emitted by THIS OBSERVER. Neither
// end of the citation was a source. GRAPH 3B located it and reported it; INGEST V38 (16 Aug) had
// already established that the wall does not exist. The enforced limit, read from the production
// compute, is `neon.max_cluster_size` = **16 TiB** — 0.1% of which is where the database actually
// sits. During 3B the database passed 17.5 GiB, so this line has been emitting a CRITICAL storage
// alert against a fiction ever since.
//
// What replaces it: **Neon's Launch plan has no fixed storage allowance.** Storage is usage-priced,
// so the only honest threshold is a cost one, tied to the $50 spending notification already set in
// the Neon console.
//
//   source        Neon console, Launch plan, read by Charlie; recorded in docs/BRIEF_GRAPH_3C.md §5
//   date checked  2026-08-21          ← a plan price is a fact about a day. Re-check it, do not
//                                       inherit it, and move this date when you do.
//   unit price    $0.35 per GB-month
//   budget        $15/month of storage — under a third of the $50 notification, because storage is
//                 the SMALL line: the same reading put compute at $33.01 against storage's $3.96.
//                 At $0.35/GB-month, $15 is ~43 GB, which is real headroom rather than a red light.
//
// ⚠ TWO THINGS THIS ALERT CANNOT SEE, SAID HERE RATHER THAN IMPLIED BY ITS SILENCE:
//   1. **Compute is eight times storage and is not observable from this process.** A storage alert
//      that never fires does not mean the bill is fine. The $50 notification in the console is the
//      thing that watches total spend; this only watches the line it can measure.
//   2. **The unit price and the reported bill do not reconcile, and that is not resolved here.**
//      19.09 GB × $0.35 = $6.68/month, against the $3.96 recorded in the brief — a factor of 1.7.
//      Most likely Neon bills average storage over the period and the figure was mid-month, but
//      nobody on this machine can read the console to find out. The alert is computed from the
//      UNIT PRICE, because that is the number that can be recomputed and checked; if the console
//      says otherwise, the console wins and this comment is the record of the discrepancy.
const NEON_STORAGE_USD_PER_GB_MONTH = parseFloat(process.env.NEON_STORAGE_USD_PER_GB_MONTH ?? '0.35')
const NEON_STORAGE_ALERT_USD = parseFloat(process.env.NEON_STORAGE_ALERT_USD ?? '15')
// S25: "a reminder after six hours if still open." The only two rules left that can ever
// alert immediately (down, crash-loop) both go through `raise()`/`shouldAlert()`, so this one
// window IS that reminder cadence — there is nothing else left for it to govern.
const REALERT_HOURS = parseInt(process.env.SERVE_REALERT_HOURS ?? '6', 10)
const FETCH_TIMEOUT_MS = parseInt(process.env.SERVE_FETCH_TIMEOUT_MS ?? '20000', 10)

// ── S25 restart classification ──
// Empirically, Railway's `resumed`/`deployed` environmentHistory events land within ~1s of
// the new process's own `started_at` (who-changed-sleep.ts, 25 Sep 2026 — every match in a
// 100-entry sample was <1.5s apart). 60s is generous headroom, not a tuned value.
const RESTART_EVIDENCE_WINDOW_MS = parseInt(process.env.SERVE_RESTART_EVIDENCE_WINDOW_MS ?? '60000', 10)
const CRASH_LOOP_THRESHOLD = parseInt(process.env.SERVE_CRASH_LOOP_THRESHOLD ?? '3', 10)
const CRASH_LOOP_WINDOW_MS = parseInt(process.env.SERVE_CRASH_LOOP_WINDOW_MS ?? '3600000', 10)
const RESTART_LOG_MAX_PER_SERVICE = 200 // ~a day of 15-min ticks, generously
// Brief: "immediate email only for service down more than five minutes." At a 15-min tick
// this means: never alert on the FIRST unreachable poll (could be transient), only once the
// condition has persisted this long — which in practice is the second consecutive miss.
const DOWN_ALERT_MS = parseInt(process.env.SERVE_DOWN_ALERT_MS ?? '300000', 10)

export interface ServiceTarget { name: string; url: string }

/** Both serve services. URLs are env-overridable so a staging URL can be watched instead. */
export function targets(): ServiceTarget[] {
  const out: ServiceTarget[] = []
  const fts = process.env.FTS_SEARCH_URL ?? process.env.FTS_SERVE_URL
  const vec = process.env.VECTOR_SERVE_URL ?? process.env.VECTOR_SEARCH_URL
  if (fts) out.push({ name: 'fts-serve', url: fts.replace(/\/$/, '') })
  if (vec) out.push({ name: 'vector-serve', url: vec.replace(/\/$/, '') })
  return out
}

export interface ServeStats {
  served?: number; errors?: number
  cold_ms?: number | null
  warm_p50_ms?: number | null; warm_p95_ms?: number | null; warm_n?: number
  /** fts-serve only, added 2026-08-08 — the queue share of warm_*. Both services now clock
   *  from before their semaphore, so warm_p95 is total wall time on the wire; this splits out
   *  how much of it was waiting rather than searching. */
  queue_p50_ms?: number | null; queue_p95_ms?: number | null
  all_p50_ms?: number | null; all_p95_ms?: number | null; all_n?: number
  embed_p50_ms?: number | null
  concurrency?: { max?: number; maxQueue?: number | null; inFlight?: number; queued?: number; queueHighWaterMark?: number; rejections?: number | null }
  cache?: { hits?: number; misses?: number; coalesced?: number; evictions?: number; size?: number; hitRate?: number | null; ttlMs?: number }
  memory?: { rss_mb?: number; peak_rss_mb?: number; peak_rss_at?: string; cap_mb?: number; pct_of_cap?: number; peak_pct_of_cap?: number }
  uptime_s?: number; started_at?: string
}

export interface Observation { name: string; url: string; ok: boolean; error?: string; stats?: ServeStats }
export interface NeonObservation {
  ok: boolean; error?: string; sizeGb?: number
  /** Projected monthly storage cost at the recorded unit price. GRAPH 3C §5. */
  storageUsdPerMonth?: number
  /** The storage budget this is measured against — a cost, not a capacity. */
  budgetUsd?: number
  /** storageUsdPerMonth as a % of budgetUsd. */
  pctOfBudget?: number
  connections?: number; maxConnections?: number
}
export type RestartKind = 'deploy' | 'wake' | 'crash' | 'unknown'
/** One `resumed`/`deployed` event from Railway's `environmentHistory`, for one service. */
export interface RestartEvidenceEvent { serviceId: string; action: string; createdAt: string }
/** One classified restart, kept for the crash-loop count and for the digest. */
export interface RestartLogEntry { at: string; kind: RestartKind }

export interface ServeState {
  startedAt: Record<string, string>          // service → last seen boot time
  lastAlertAt: Record<string, string>        // alert key → ISO time last emailed
  lastDigestDay: string
  embedCallsBaseline: Record<string, { day: string; served: number }>
  /** Every classified restart, most-recent-last, bounded per service. The crash-loop count
   *  and the digest's deploy/wake/crash tally both read this — one source, not two. */
  restartLog: Record<string, RestartLogEntry[]>
  /** service → ISO time it was FIRST observed unreachable, this outage. Cleared on recovery. */
  downSince: Record<string, string>
}
export interface ServeEvent { kind: 'alert' | 'digest'; severity: 'critical' | 'warning' | 'info'; key: string; subject: string; body: string }

const FRESH_STATE: ServeState = { startedAt: {}, lastAlertAt: {}, lastDigestDay: '', embedCallsBaseline: {}, restartLog: {}, downSince: {} }

/**
 * PURE. `serviceName` (e.g. 'fts-serve') → its Railway service id, from the same
 * `SERVICES` map `sleep-state.ts`/`why-awake.ts`/`who-changed-sleep.ts` already use — one
 * mapping, not a second one invented here to drift from it.
 */
function railwayServiceId(serviceName: string): string | undefined {
  return (RAILWAY_SERVICE_IDS as Record<string, string>)[serviceName]
}

/**
 * PURE. Classifies one restart from Railway's own recorded events — never from elimination
 * alone. `evidenceOk: false` means the environmentHistory query itself failed, which must
 * produce 'unknown', NOT 'crash' — a failed lookup is not evidence of a crash (§18's
 * OFF-vs-FAILED corollary, one level up: a restart we could not check must not look like
 * one we checked and could not explain).
 */
export function classifyRestart(
  serviceName: string, bootIso: string, evidence: RestartEvidenceEvent[], evidenceOk: boolean,
): RestartKind {
  const serviceId = railwayServiceId(serviceName)
  if (!serviceId || !evidenceOk) return 'unknown'
  const bootMs = Date.parse(bootIso)
  const nearby = evidence.filter((e) => e.serviceId === serviceId && Math.abs(Date.parse(e.createdAt) - bootMs) <= RESTART_EVIDENCE_WINDOW_MS)
  if (nearby.some((e) => e.action === 'resumed')) return 'wake'
  if (nearby.some((e) => e.action === 'deployed')) return 'deploy'
  return 'crash'
}

function fmtMs(v: number | null | undefined): string { return v == null ? '—' : `${Math.round(v)}ms` }
function fmtNum(v: number | null | undefined): string { return v == null ? 'n/a' : String(v) }

/**
 * PURE. Observations → events. No fetching, no sending, so the alert thresholds can be
 * tested against constructed inputs rather than by waiting for a real outage.
 */
export function evaluateServe(
  obs: Observation[],
  neon: NeonObservation,
  state: ServeState,
  nowMs: number,
  restartEvidence: RestartEvidenceEvent[] = [],
  restartEvidenceOk = true,
): { events: ServeEvent[]; nextState: ServeState } {
  const next: ServeState = {
    startedAt: { ...state.startedAt },
    lastAlertAt: { ...state.lastAlertAt },
    lastDigestDay: state.lastDigestDay,
    embedCallsBaseline: { ...state.embedCallsBaseline },
    restartLog: Object.fromEntries(Object.entries(state.restartLog ?? {}).map(([k, v]) => [k, [...v]])),
    downSince: { ...(state.downSince ?? {}) },
  }
  const events: ServeEvent[] = []

  const shouldAlert = (key: string) => {
    const last = state.lastAlertAt[key]
    if (!last) return true
    return nowMs - Date.parse(last) >= REALERT_HOURS * 3600_000
  }
  const raise = (severity: 'critical' | 'warning', key: string, subject: string, body: string) => {
    if (!shouldAlert(key)) return
    next.lastAlertAt[key] = new Date(nowMs).toISOString()
    events.push({ kind: 'alert', severity, key, subject, body })
  }

  for (const o of obs) {
    // ── unreachable is the loudest case, not a skipped section — but only alerts past
    // DOWN_ALERT_MS (brief: "service down more than five minutes"), and announces its own
    // resolution rather than just going quiet. ──
    if (!o.ok || !o.stats) {
      const since = state.downSince[o.name] ?? new Date(nowMs).toISOString()
      next.downSince[o.name] = since
      const downForMs = nowMs - Date.parse(since)
      if (downForMs >= DOWN_ALERT_MS) {
        raise('critical', `${o.name}:down`, `🔴 ${o.name} is NOT RESPONDING`,
          `${o.name} (${o.url}) has not answered /stats since ${since} (${Math.round(downForMs / 60_000)} min).\n\n` +
          `Error: ${o.error ?? 'unknown'}\n\n` +
          `This is the failure this observer exists to catch. Check:\n` +
          `  npx tsx search/${o.name === 'fts-serve' ? 'fts' : 'vector'}-serve-run.ts logs`)
      }
      continue
    }
    if (state.downSince[o.name]) {
      // Was down, now answering — a resolved event, but ONLY if it was ever loud enough to
      // have alerted (a blip under 5 minutes needed no email, so needs no all-clear either).
      const since = state.downSince[o.name]
      const downForMs = nowMs - Date.parse(since)
      delete next.downSince[o.name]
      if (downForMs >= DOWN_ALERT_MS) {
        delete next.lastAlertAt[`${o.name}:down`] // a FUTURE outage must alert fresh, not be swallowed by the re-alert window
        events.push({
          kind: 'alert', severity: 'info', key: `${o.name}:down-resolved`,
          subject: `✅ ${o.name} back up`,
          body: `${o.name} is responding again. Was down from ${since} to ${new Date(nowMs).toISOString()} (${Math.round(downForMs / 60_000)} min).`,
        })
      }
    }
    const s = o.stats

    // ── crash / restart — CLASSIFIED (S25). Only 'crash' can ever alert, and only at
    // CRASH_LOOP_THRESHOLD+ within CRASH_LOOP_WINDOW_MS. 'deploy' and 'wake' are counted
    // (for the digest) and never emailed — see this file's header for why. ──
    const boot = s.started_at
    if (boot) {
      const prev = state.startedAt[o.name]
      next.startedAt[o.name] = boot
      if (prev && prev !== boot) {
        const kind = classifyRestart(o.name, boot, restartEvidence, restartEvidenceOk)
        const log = (next.restartLog[o.name] ??= [])
        log.push({ at: new Date(nowMs).toISOString(), kind })
        if (log.length > RESTART_LOG_MAX_PER_SERVICE) log.splice(0, log.length - RESTART_LOG_MAX_PER_SERVICE)

        if (kind === 'crash') {
          const oneWindowAgo = nowMs - CRASH_LOOP_WINDOW_MS
          const crashesInWindow = log.filter((e) => e.kind === 'crash' && Date.parse(e.at) >= oneWindowAgo).length
          if (crashesInWindow >= CRASH_LOOP_THRESHOLD) {
            // Crash-loop dedup only — a single crash below the threshold never alerts at all,
            // per the brief ("only three or more in an hour"), so there is nothing to dedup
            // until the threshold is first crossed.
            raise('critical', `${o.name}:crash-loop`,
              `🔴 ${o.name} crash-looping (${crashesInWindow} crashes in the last hour)`,
              `${o.name} has crashed ${crashesInWindow} times in the last ${Math.round(CRASH_LOOP_WINDOW_MS / 60_000)} minutes.\n` +
              `  was up since: ${prev}\n  now up since: ${boot}\n  uptime now:   ${s.uptime_s}s\n\n` +
              `Classified as a crash because Railway's environmentHistory records neither a "resumed" ` +
              `nor a "deployed" event for this service within ${Math.round(RESTART_EVIDENCE_WINDOW_MS / 1000)}s of the new boot time — ` +
              `i.e. this restart is unexplained by a deploy or a sleep/wake cycle, which is what an OOM ` +
              `SIGKILL or an unhandled crash looks like (docs/CLAUDE.md §17).\n` +
              `Peak RSS before this report: ${s.memory?.peak_rss_mb ?? '?'} MB of ${s.memory?.cap_mb ?? '?'} MB.\n\n` +
              `⚠ All /stats counters reset on restart — the numbers below are since ${boot}, not since the last digest.`)
          }
        }
        // 'deploy' and 'wake' — and 'unknown', which must not be silently dropped either —
        // are logged above and read by the cost digest (docs/SEARCH_S25_REPORT.md §2/§4);
        // nothing more happens here.
      }
    }

    // ── crash-loop resolve — checked EVERY tick, not only when a restart just happened,
    // because resolving is the passage of time (old crashes aging out of the 1h window),
    // not an event like the restart itself. Brief: "one email... one when resolved." ──
    {
      const crashLoopKey = `${o.name}:crash-loop`
      if (state.lastAlertAt[crashLoopKey]) {
        const log = next.restartLog[o.name] ?? []
        const oneWindowAgo = nowMs - CRASH_LOOP_WINDOW_MS
        const stillLooping = log.filter((e) => e.kind === 'crash' && Date.parse(e.at) >= oneWindowAgo).length >= CRASH_LOOP_THRESHOLD
        if (!stillLooping) {
          delete next.lastAlertAt[crashLoopKey]
          events.push({
            kind: 'alert', severity: 'info', key: `${crashLoopKey}-resolved`,
            subject: `✅ ${o.name} crash loop resolved`,
            body: `${o.name} has not crashed in the last ${Math.round(CRASH_LOOP_WINDOW_MS / 60_000)} minutes — no longer crash-looping.`,
          })
        }
      }
    }

    // ── memory / latency / load-shedding — S25: NO LONGER an immediate email. ──
    // The brief names exactly four immediate-email rules (down>5min, crash loop, spend
    // threshold, build failure) and says "everything else goes to the digest." These three
    // used to `raise()` their own email; they now only feed `isHealthy()` below (so an
    // ongoing breach still shows up in the digest's one-line health summary) and the
    // digest's full per-service stats block (renderDigest already prints all three numbers
    // unconditionally). MEM_ALERT_PCT/P95_ALERT_MS/etc. are kept as the thresholds
    // `isHealthy()` uses to decide what is worth naming in that one line.
  }

  // ── Neon — S25: no immediate email either. `neon.ok`/`pctOfBudget` still feed
  // `isHealthy()` below and the digest's Neon section; nothing is silently dropped, it just
  // no longer emails on its own. ──

  // ── daily digest — RETIRED (S25). This used to auto-email `renderDigest()`'s output
  // (engineering counters: memory/concurrency/throughput/cache/Neon) once a day — exactly
  // what Charlie described being unhappy with. `scrutinise-web/scripts/cost-digest.ts` is
  // now the one daily email, in £; `renderDigest()` itself stays (it is NOT deleted) as the
  // source for that digest's "raw counters" link (`/admin/cost-digest`), just no longer
  // wired to fire on its own. `lastDigestDay` stays on `ServeState` unused rather than
  // removed — it is harmless persisted state and removing the field would be a schema
  // change to a JSON blob for no gain; `DIGEST_HOUR`/`londonParts` (whose only caller this
  // was) are removed below since they have no other use.

  return { events, nextState: next }
}

export interface HealthSummary { healthy: boolean; exceptions: string[] }

/**
 * PURE. The one line the S25 cost digest wants: "all services healthy" unless there is an
 * exception, in which case name it. Same thresholds that used to fire their OWN immediate
 * email before S25 moved memory/p95/rejections/Neon-storage to digest-only — the number is
 * unchanged, only whether it interrupts Charlie is. Down and crash-loop are read from
 * `ServeState` because those two DO still alert immediately; this just reflects the same
 * fact for the digest's benefit rather than computing it twice.
 */
export function summarizeHealth(obs: Observation[], neon: NeonObservation, state: ServeState, nowMs: number): HealthSummary {
  const exceptions: string[] = []
  for (const o of obs) {
    if (!o.ok || !o.stats) { exceptions.push(`${o.name} is not responding`); continue }
    const s = o.stats
    const peakPct = s.memory?.peak_pct_of_cap
    if (peakPct != null && peakPct > MEM_ALERT_PCT) exceptions.push(`${o.name} memory at ${peakPct}% of cap`)
    if (s.warm_p95_ms != null && s.warm_p95_ms > P95_ALERT_MS) exceptions.push(`${o.name} p95 ${fmtMs(s.warm_p95_ms)}`)
    if (s.concurrency?.rejections != null && s.concurrency.rejections > 0) exceptions.push(`${o.name} shed ${s.concurrency.rejections} request(s)`)
    const crashLog = state.restartLog[o.name] ?? []
    const recentCrashes = crashLog.filter((e) => e.kind === 'crash' && nowMs - Date.parse(e.at) <= CRASH_LOOP_WINDOW_MS).length
    if (recentCrashes >= CRASH_LOOP_THRESHOLD) exceptions.push(`${o.name} crash-looping (${recentCrashes} in the last hour)`)
    if (state.downSince?.[o.name]) exceptions.push(`${o.name} down since ${state.downSince[o.name]}`)
  }
  if (!neon.ok) exceptions.push(`Neon check failed: ${neon.error ?? 'unknown'}`)
  else if (neon.pctOfBudget != null && neon.pctOfBudget > 100) {
    exceptions.push(`Neon storage costing $${neon.storageUsdPerMonth?.toFixed(2)}/month (${neon.pctOfBudget}% of the $${neon.budgetUsd} budget)`)
  }
  return { healthy: exceptions.length === 0, exceptions }
}

export function renderDigest(obs: Observation[], neon: NeonObservation, nowMs: number): string {
  const L: string[] = []
  L.push(`Search serving digest — ${new Date(nowMs).toISOString()}`)
  L.push('')
  L.push('⚠ Every counter below is SINCE THAT SERVICE BOOTED, not since the last digest.')
  L.push('  /stats resets on restart, so compare against the uptime on each line.')
  L.push('')

  for (const o of obs) {
    L.push(`── ${o.name} ${'─'.repeat(Math.max(0, 56 - o.name.length))}`)
    L.push(`   ${o.url}`)
    if (!o.ok || !o.stats) { L.push(`   🔴 NOT RESPONDING — ${o.error ?? 'unknown'}`); L.push(''); continue }
    const s = o.stats
    const up = s.uptime_s ?? 0
    L.push(`   up ${(up / 3600).toFixed(1)}h (since ${s.started_at ?? '?'})`)
    if (s.memory) {
      L.push(`   memory      ${s.memory.rss_mb} MB now (${s.memory.pct_of_cap}% of cap) · PEAK ${s.memory.peak_rss_mb} MB (${s.memory.peak_pct_of_cap}%) at ${s.memory.peak_rss_at}`)
      L.push(`               cap ${s.memory.cap_mb} MB (Railway per-replica, measured — §17)`)
    }
    const c = s.concurrency ?? {}
    L.push(`   concurrency cap ${fmtNum(c.max)} · inFlight ${fmtNum(c.inFlight)} · queued ${fmtNum(c.queued)} · high-water ${fmtNum(c.queueHighWaterMark)}`)
    L.push(`               rejections ${c.rejections == null ? 'n/a (queue is UNBOUNDED — absorbs overload as latency, cannot refuse)' : c.rejections}` +
           (c.maxQueue != null ? ` · queue cap ${c.maxQueue}` : ''))
    L.push(`   throughput  served ${fmtNum(s.served)} · errors ${fmtNum(s.errors)} · cold ${fmtMs(s.cold_ms)}`)
    L.push(`   latency     uncached p50 ${fmtMs(s.warm_p50_ms)} p95 ${fmtMs(s.warm_p95_ms)} (n=${fmtNum(s.warm_n)}) — queue INCLUDED`)
    // The split matters operationally: queue-dominated means raise the concurrency cap, while
    // service-dominated means the index itself got slower. Same p95, opposite remedy.
    if (s.queue_p95_ms != null) L.push(`               of which queue p50 ${fmtMs(s.queue_p50_ms)} p95 ${fmtMs(s.queue_p95_ms)}`)
    if (s.all_p50_ms != null) L.push(`               all reqs p50 ${fmtMs(s.all_p50_ms)} p95 ${fmtMs(s.all_p95_ms)} (n=${fmtNum(s.all_n)})`)
    if (s.embed_p50_ms != null) L.push(`               gemini embed p50 ${fmtMs(s.embed_p50_ms)}`)
    if (s.cache) {
      const ca = s.cache
      L.push(`   cache       hit rate ${ca.hitRate == null ? '—' : `${(ca.hitRate * 100).toFixed(1)}%`} · hits ${fmtNum(ca.hits)} · coalesced ${fmtNum(ca.coalesced)} · misses ${fmtNum(ca.misses)}`)
      L.push(`               size ${fmtNum(ca.size)} · evictions ${fmtNum(ca.evictions)} · ttl ${Math.round((ca.ttlMs ?? 0) / 1000)}s`)
      // The cost line the brief asks for: on the vector path a MISS is a paid Gemini call.
      if (ca.misses != null) {
        const calls = ca.misses
        const perDay = up > 0 ? Math.round((calls / up) * 86400) : 0
        L.push(`   cost        gemini embed calls ${calls} since boot ≈ ${perDay}/day (a cache hit or coalesce costs nothing)`)
      }
    }
    L.push(`   cost        railway ${(up / 3600).toFixed(1)} service-hours this boot (always-on: ~730/month/service)`)
    L.push('')
  }

  L.push('── Neon ' + '─'.repeat(56))
  if (!neon.ok) L.push(`   🔴 check failed — ${neon.error}`)
  else {
    L.push(`   storage     ${neon.sizeGb?.toFixed(2)} GB = $${neon.storageUsdPerMonth?.toFixed(2)}/month at $${NEON_STORAGE_USD_PER_GB_MONTH}/GB-month ` +
      `(${neon.pctOfBudget}% of the $${neon.budgetUsd} storage budget; no capacity ceiling exists — compute is the bigger line and is not measured here)`)
    L.push(`   connections ${neon.connections}${neon.maxConnections ? ` of ${neon.maxConnections}` : ''}`)
  }
  L.push('')
  L.push('── raw /stats (paste-able) ' + '─'.repeat(38))
  L.push(JSON.stringify({ services: obs.map((o) => ({ name: o.name, ok: o.ok, error: o.error, stats: o.stats })), neon }, null, 1))
  return L.join('\n')
}

// ── I/O ──────────────────────────────────────────────────────────────────────

// Exported (S25): cost-digest.ts reuses these three rather than re-fetching the same
// numbers a second, drifting way — one source for "is search serving healthy right now."
export async function fetchStats(t: ServiceTarget): Promise<Observation> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`${t.url}/stats`, { signal: ctrl.signal })
    if (!res.ok) return { name: t.name, url: t.url, ok: false, error: `HTTP ${res.status}` }
    return { name: t.name, url: t.url, ok: true, stats: await res.json() as ServeStats }
  } catch (e) {
    return { name: t.name, url: t.url, ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally { clearTimeout(timer) }
}

export async function checkNeon(): Promise<NeonObservation> {
  const url = process.env.NEON_DATABASE_URL
  if (!url) return { ok: false, error: 'NEON_DATABASE_URL not set' }
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 30_000 })
  try {
    const size = await pool.query<{ gb: string }>(`SELECT pg_database_size(current_database())/1024.0/1024/1024 AS gb`)
    const conns = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM pg_stat_activity`)
    // current_setting(), not SHOW: `SHOW max_connections` returns a column NAMED
    // max_connections, so reading `.setting` off it gives undefined → NaN in the email.
    const maxc = await pool.query<{ setting: string }>(`SELECT current_setting('max_connections') AS setting`)
    const sizeGb = parseFloat(size.rows[0].gb)
    return {
      ok: true, sizeGb,
      storageUsdPerMonth: Math.round(sizeGb * NEON_STORAGE_USD_PER_GB_MONTH * 100) / 100,
      budgetUsd: NEON_STORAGE_ALERT_USD,
      pctOfBudget: Math.round((sizeGb * NEON_STORAGE_USD_PER_GB_MONTH / NEON_STORAGE_ALERT_USD) * 1000) / 10,
      connections: parseInt(conns.rows[0].n, 10),
      maxConnections: parseInt(maxc.rows[0].setting, 10),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally { await pool.end().catch(() => {}) }
}

/**
 * Railway's `environmentHistory` for this environment, filtered to the 'resumed'/'deployed'
 * events `classifyRestart` looks for. One query per check cycle covers BOTH services — same
 * shape as `who-changed-sleep.ts`, which found this reachable with a Project-Access-Token
 * where `auditLogs` (needs a `workspaceId` this token cannot obtain) is not.
 *
 * Returns `ok: false` on any failure — never partial data mislabelled as complete, per this
 * file's own `classifyRestart` contract (`evidenceOk: false` ⇒ 'unknown', never 'crash').
 */
async function fetchRestartEvidence(): Promise<{ ok: boolean; events: RestartEvidenceEvent[] }> {
  try {
    const r = await rail<{ environmentHistory: { edges: Array<{ node: {
      action: string; object: string; createdAt: string; serviceIds: string[]
    } }> } }>(`
      query H($environmentId: String!, $first: Int!) {
        environmentHistory(environmentId: $environmentId, first: $first) {
          edges { node { action object createdAt serviceIds } }
        }
      }
    `, { environmentId: RAILWAY_ENVIRONMENT_ID, first: 100 })
    const events: RestartEvidenceEvent[] = []
    for (const { node } of r.environmentHistory.edges) {
      if (node.object !== 'Deployment') continue
      if (node.action !== 'resumed' && node.action !== 'deployed') continue
      for (const serviceId of node.serviceIds ?? []) events.push({ serviceId, action: node.action, createdAt: node.createdAt })
    }
    return { ok: true, events }
  } catch (e) {
    console.error(`[serve-observer] restart-evidence query failed (restarts this cycle will classify as 'unknown', not 'crash'): ${e instanceof Error ? e.message : String(e)}`)
    return { ok: false, events: [] }
  }
}

async function sendEmail(subject: string, body: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.warn(`[serve-observer] RESEND_API_KEY unset — would have sent: ${subject}`); return }
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to: [EMAIL_TO], subject, text: body }),
  })
  if (!res.ok) console.error(`[serve-observer] Resend failed: ${res.status} ${await res.text()}`)
  else console.log(`[serve-observer] emailed ${EMAIL_TO}: ${subject}`)
}

export async function loadState(): Promise<ServeState> {
  try {
    const raw = await r2Get(STATE_KEY)
    if (!raw) return { ...FRESH_STATE }
    return { ...FRESH_STATE, ...JSON.parse(raw) }
  } catch { return { ...FRESH_STATE } }
}

/** The entry point ops.ts calls on the hourly tick. */
export async function checkServeHealth(opts: { dry?: boolean } = {}): Promise<ServeEvent[]> {
  const ts = targets()
  if (!ts.length) { console.warn('[serve-observer] no service URLs configured (FTS_SEARCH_URL / VECTOR_SERVE_URL) — nothing to watch'); return [] }
  const [obs, neon, state, restartEvidence] = await Promise.all([
    Promise.all(ts.map(fetchStats)), checkNeon(), loadState(), fetchRestartEvidence(),
  ])
  const { events, nextState } = evaluateServe(obs, neon, state, Date.now(), restartEvidence.events, restartEvidence.ok)

  for (const ev of events) {
    if (opts.dry) console.log(`[serve-observer] (dry) ${ev.severity.toUpperCase()} ${ev.subject}\n${ev.body}\n`)
    else await sendEmail(ev.subject, ev.body)
  }
  if (!opts.dry) await r2Put(STATE_KEY, JSON.stringify(nextState, null, 1), 'application/json')
  console.log(`[serve-observer] ${obs.filter((o) => o.ok).length}/${obs.length} services healthy, ${events.length} event(s)`)
  return events
}

/**
 * S25 Phase 3's "prove each rule fires once, forced" — constructed inputs, not a real
 * outage. Simulates 4 consecutive restarts with NO 'resumed'/'deployed' evidence (so every
 * one classifies 'crash'): the first two must produce no alert, the third crosses
 * CRASH_LOOP_THRESHOLD (default 3) and must be the ONLY alert, and the fourth must be
 * suppressed by the existing re-alert dedup (`shouldAlert`/`REALERT_HOURS`) rather than
 * firing again immediately.
 */
function forceTestCrashLoop(): void {
  const base = new Date('2026-01-01T00:00:00.000Z').getTime()
  let state: ServeState = { ...FRESH_STATE, startedAt: { 'fts-serve': new Date(base).toISOString() } }
  const alerts: string[] = []
  for (let i = 1; i <= 4; i++) {
    const nowMs = base + i * 5 * 60_000 // 5 minutes apart — all inside the 1-hour window
    const boot = new Date(nowMs).toISOString()
    const obs: Observation[] = [{ name: 'fts-serve', url: 'https://fake', ok: true, stats: { started_at: boot, uptime_s: 1 } }]
    const neon: NeonObservation = { ok: true, sizeGb: 1, storageUsdPerMonth: 1, budgetUsd: 15, pctOfBudget: 10, connections: 1, maxConnections: 100 }
    const { events, nextState } = evaluateServe(obs, neon, state, nowMs, [], true) // no evidence + ok:true ⇒ every restart is 'crash'
    state = nextState
    console.log(`  restart #${i} (${boot}): ${events.length} event(s)` + (events.length ? ` — ${events.map((e) => e.subject).join(', ')}` : ''))
    for (const e of events) alerts.push(e.subject)
  }
  console.log(`\ntotal alerts fired: ${alerts.length} (expected 1, on restart #${CRASH_LOOP_THRESHOLD})`)
  console.log(alerts.length === 1 && alerts[0].includes('crash-looping') ? 'PASS' : 'FAIL')
}

if (require.main === module) {
  const dry = process.argv.includes('--dry')
  if (process.argv.includes('--force-test') && process.argv.includes('crash-loop')) {
    forceTestCrashLoop()
  } else if (process.argv.includes('--digest')) {
    // Print the digest on demand, without waiting for the scheduled hour.
    (async () => {
      const ts = targets()
      const [obs, neon] = await Promise.all([Promise.all(ts.map(fetchStats)), checkNeon()])
      const body = renderDigest(obs, neon, Date.now())
      if (dry) console.log(body)
      else await sendEmail(`Search serving — digest (manual)`, body)
    })().catch((e) => { console.error(e); process.exit(1) })
  } else {
    checkServeHealth({ dry }).catch((e) => { console.error('[serve-observer] FATAL', e); process.exit(1) })
  }
}
