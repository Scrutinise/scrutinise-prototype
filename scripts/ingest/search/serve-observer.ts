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
 *   errors      5xx count, and crashes/restarts since the last report
 *   Neon        database size vs the plan ceiling, and connection count
 *   cost        Railway service-hours, and Gemini embed calls/day (vector's per-query cost)
 *
 * IMMEDIATE email on: memory >70% of cap, warm p95 >5s, any crash/restart, Neon >80%,
 * rejections >0. Otherwise a daily digest.
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

const RESEND_API = 'https://api.resend.com/emails'
const EMAIL_TO = process.env.SERVE_OBSERVER_TO ?? 'cl@scrutinise.org'
const EMAIL_FROM = 'Scrutinise Search <ingest@messages.scrutinise.org>'
const STATE_KEY = '_search/serve-observer-state.json'

const MEM_ALERT_PCT = parseFloat(process.env.SERVE_MEM_ALERT_PCT ?? '70')
const P95_ALERT_MS = parseInt(process.env.SERVE_P95_ALERT_MS ?? '5000', 10)
const NEON_ALERT_PCT = parseFloat(process.env.SERVE_NEON_ALERT_PCT ?? '80')
// Neon plan ceiling. The handoff records the storage line at ~17.5 GB; override rather
// than edit if the plan changes.
const NEON_CEILING_GB = parseFloat(process.env.NEON_CEILING_GB ?? '17.5')
const DIGEST_HOUR = parseInt(process.env.SERVE_DIGEST_HOUR ?? '8', 10)
// Re-alert window: a breach that persists should not email every hour forever.
const REALERT_HOURS = parseInt(process.env.SERVE_REALERT_HOURS ?? '12', 10)
const FETCH_TIMEOUT_MS = parseInt(process.env.SERVE_FETCH_TIMEOUT_MS ?? '20000', 10)

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
export interface NeonObservation { ok: boolean; error?: string; sizeGb?: number; ceilingGb?: number; pctOfCeiling?: number; connections?: number; maxConnections?: number }
export interface ServeState {
  startedAt: Record<string, string>          // service → last seen boot time
  lastAlertAt: Record<string, string>        // alert key → ISO time last emailed
  lastDigestDay: string
  embedCallsBaseline: Record<string, { day: string; served: number }>
}
export interface ServeEvent { kind: 'alert' | 'digest'; severity: 'critical' | 'warning' | 'info'; key: string; subject: string; body: string }

const FRESH_STATE: ServeState = { startedAt: {}, lastAlertAt: {}, lastDigestDay: '', embedCallsBaseline: {} }

function londonParts(nowMs: number): { day: string; hour: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false })
  const p = Object.fromEntries(fmt.formatToParts(new Date(nowMs)).map((x) => [x.type, x.value]))
  return { day: `${p.year}-${p.month}-${p.day}`, hour: parseInt(p.hour, 10) }
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
): { events: ServeEvent[]; nextState: ServeState } {
  const next: ServeState = {
    startedAt: { ...state.startedAt },
    lastAlertAt: { ...state.lastAlertAt },
    lastDigestDay: state.lastDigestDay,
    embedCallsBaseline: { ...state.embedCallsBaseline },
  }
  const events: ServeEvent[] = []
  const { day, hour } = londonParts(nowMs)

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
    // ── unreachable is the loudest case, not a skipped section ──
    if (!o.ok || !o.stats) {
      raise('critical', `${o.name}:down`, `🔴 ${o.name} is NOT RESPONDING`,
        `${o.name} (${o.url}) did not answer /stats.\n\nError: ${o.error ?? 'unknown'}\n\n` +
        `This is the failure this observer exists to catch. Check:\n` +
        `  npx tsx search/${o.name === 'fts-serve' ? 'fts' : 'vector'}-serve-run.ts logs`)
      continue
    }
    const s = o.stats

    // ── crash / restart ──
    const boot = s.started_at
    if (boot) {
      const prev = state.startedAt[o.name]
      next.startedAt[o.name] = boot
      if (prev && prev !== boot) {
        // A restart always emails, regardless of the re-alert window: two restarts are two
        // events, and collapsing them would hide a crash loop — the exact shape that burnt
        // ~25 minutes of container time on the FTS optimize job (docs/CLAUDE.md §17).
        next.lastAlertAt[`${o.name}:restart`] = new Date(nowMs).toISOString()
        events.push({
          kind: 'alert', severity: 'critical', key: `${o.name}:restart`,
          subject: `🔴 ${o.name} RESTARTED`,
          body: `${o.name} restarted.\n  was up since: ${prev}\n  now up since: ${boot}\n  uptime now:   ${s.uptime_s}s\n\n` +
            `Railway restarts on crash (restartPolicy ALWAYS), so an unexplained restart is usually a crash — ` +
            `and a silent death with no error line is what an OOM SIGKILL looks like (docs/CLAUDE.md §17).\n` +
            `Peak RSS before this report: ${s.memory?.peak_rss_mb ?? '?'} MB of ${s.memory?.cap_mb ?? '?'} MB.\n\n` +
            `⚠ All /stats counters reset on restart — the numbers below are since ${boot}, not since the last digest.`,
        })
      }
    }

    // ── memory ──
    const peakPct = s.memory?.peak_pct_of_cap
    if (peakPct != null && peakPct > MEM_ALERT_PCT) {
      raise('critical', `${o.name}:memory`, `🔴 ${o.name} memory at ${peakPct}% of cap`,
        `${o.name} peak RSS ${s.memory?.peak_rss_mb} MB of a ${s.memory?.cap_mb} MB cap (${peakPct}%), reached ${s.memory?.peak_rss_at}.\n` +
        `Current ${s.memory?.rss_mb} MB (${s.memory?.pct_of_cap}%).\n\n` +
        `Per docs/CLAUDE.md §17 the cap is real and exceeding it is a SILENT SIGKILL. ` +
        `Do NOT raise a limit or shrink the work to fit — if it genuinely does not fit, it goes to the Heavy Job Runner.`)
    }

    // ── latency ──
    const p95 = s.warm_p95_ms
    if (p95 != null && p95 > P95_ALERT_MS) {
      raise('warning', `${o.name}:p95`, `🟠 ${o.name} p95 ${fmtMs(p95)} (>${P95_ALERT_MS}ms)`,
        `${o.name} uncached p95 is ${fmtMs(p95)} over ${s.warm_n} requests (p50 ${fmtMs(s.warm_p50_ms)}).\n` +
        (s.all_p95_ms != null ? `All requests incl. cache hits: p50 ${fmtMs(s.all_p50_ms)}, p95 ${fmtMs(s.all_p95_ms)}.\n` : '') +
        `\nThis is the UNCACHED figure — what the database actually costs. ` +
        `Under a 25-concurrent synthetic burst this service has measured p95 ~10s, so a p95 breach during a load test is expected; ` +
        `a breach during ordinary traffic is not.`)
    }

    // ── load shedding ──
    const rej = s.concurrency?.rejections
    if (rej != null && rej > 0) {
      raise('warning', `${o.name}:rejections`, `🟠 ${o.name} shed ${rej} request(s)`,
        `${o.name} refused ${rej} request(s) with 503 — the bounded queue (max ${fmtNum(s.concurrency?.maxQueue)}) was full.\n` +
        `Queue high-water ${fmtNum(s.concurrency?.queueHighWaterMark)}, concurrency cap ${fmtNum(s.concurrency?.max)}.\n\n` +
        `Shedding is by design and better than an unbounded wait, but a non-zero count means demand exceeded capacity. ` +
        `Consider raising the concurrency cap (measure first) or the result-cache TTL.`)
    }
  }

  // ── Neon ──
  if (!neon.ok) {
    raise('warning', 'neon:down', '🟠 Neon check failed', `Could not read Neon size/connections.\n\nError: ${neon.error ?? 'unknown'}`)
  } else if (neon.pctOfCeiling != null && neon.pctOfCeiling > NEON_ALERT_PCT) {
    raise('critical', 'neon:storage', `🔴 Neon storage at ${neon.pctOfCeiling}% of plan`,
      `Neon is ${neon.sizeGb?.toFixed(2)} GB of a ${neon.ceilingGb} GB ceiling (${neon.pctOfCeiling}%).\n` +
      `Connections: ${neon.connections}/${neon.maxConnections ?? '?'}.\n\n` +
      `Storage growth has already forced one emergency resize in this project (Railway, 4 Jun). Plan the headroom, do not discover it.`)
  }

  // ── daily digest ──
  if (state.lastDigestDay !== day && hour >= DIGEST_HOUR) {
    next.lastDigestDay = day
    events.push({ kind: 'digest', severity: 'info', key: 'digest', subject: `Search serving — daily digest ${day}`, body: renderDigest(obs, neon, nowMs) })
  }

  return { events, nextState: next }
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
    L.push(`   storage     ${neon.sizeGb?.toFixed(2)} GB of ${neon.ceilingGb} GB ceiling (${neon.pctOfCeiling}%)`)
    L.push(`   connections ${neon.connections}${neon.maxConnections ? ` of ${neon.maxConnections}` : ''}`)
  }
  L.push('')
  L.push('── raw /stats (paste-able) ' + '─'.repeat(38))
  L.push(JSON.stringify({ services: obs.map((o) => ({ name: o.name, ok: o.ok, error: o.error, stats: o.stats })), neon }, null, 1))
  return L.join('\n')
}

// ── I/O ──────────────────────────────────────────────────────────────────────

async function fetchStats(t: ServiceTarget): Promise<Observation> {
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

async function checkNeon(): Promise<NeonObservation> {
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
      ok: true, sizeGb, ceilingGb: NEON_CEILING_GB,
      pctOfCeiling: Math.round((sizeGb / NEON_CEILING_GB) * 1000) / 10,
      connections: parseInt(conns.rows[0].n, 10),
      maxConnections: parseInt(maxc.rows[0].setting, 10),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally { await pool.end().catch(() => {}) }
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

async function loadState(): Promise<ServeState> {
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
  const [obs, neon, state] = await Promise.all([Promise.all(ts.map(fetchStats)), checkNeon(), loadState()])
  const { events, nextState } = evaluateServe(obs, neon, state, Date.now())

  for (const ev of events) {
    if (opts.dry) console.log(`[serve-observer] (dry) ${ev.severity.toUpperCase()} ${ev.subject}\n${ev.body}\n`)
    else await sendEmail(ev.subject, ev.body)
  }
  if (!opts.dry) await r2Put(STATE_KEY, JSON.stringify(nextState, null, 1), 'application/json')
  console.log(`[serve-observer] ${obs.filter((o) => o.ok).length}/${obs.length} services healthy, ${events.length} event(s)`)
  return events
}

if (require.main === module) {
  const dry = process.argv.includes('--dry')
  if (process.argv.includes('--digest')) {
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
