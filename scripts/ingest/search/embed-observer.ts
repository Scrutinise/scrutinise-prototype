/**
 * embed-observer.ts — email heartbeat + stall alarm for the full-corpus vector embed.
 *
 * WHY THIS EXISTS: the 7-Jul batch relaunch ran for days with NOTHING watching it.
 * When it looked stalled there was no alert — the only "monitor" (fts-watch.ts) is a
 * foreground human-run tool that prints and exits, and the Railway daily digest
 * (progress-reporter.ts) never mentions the embed at all. This closes that gap: a tiny
 * R2-only checker that `ops` calls every 15 min and that EMAILS Charlie on the events
 * that matter — so the next stall announces itself.
 *
 * DESIGN — edge-triggered, low-noise:
 *   - It reads the corpus_vec checkpoint from R2 and a small observer-state object
 *     (also R2, next to the checkpoint) that remembers what was last alerted.
 *   - It emails ONLY on transitions, never every tick:
 *       🔴 STALL     — phase=embedding and checkpoint updatedAt older than STALL_MIN.
 *       🟢 RECOVERED — was stalled, checkpoint has since advanced.
 *       ✅ COMPLETE  — embedding phase finished (phase left 'embedding' → indexing/done).
 *       💥 CRASH     — the Hetzner tail log shows a non-zero `build exited`, a FATAL, or a
 *                      shard that FAILED after retries — REGARDLESS of phase.
 *       ⏳ ANN-STUCK — phase=indexing but the checkpoint has been frozen past a ceiling
 *                      (default 8h), i.e. the ANN build died without flushing an exit line.
 *       💚 HEARTBEAT — one positive "still progressing" email per London day (≥08:00),
 *                      so a silent day is unambiguously good, not a dead observer.
 *   - No checkpoint yet ⇒ embed not running ⇒ silent no-op (never alarms on absence).
 *   - Indexing/ANN phase freezes the checkpoint legitimately, so the EMBEDDING stall test
 *     is suppressed unless phase='embedding' (same rule as fts-watch) — but the CRASH scan
 *     and the ANN-STUCK ceiling cover the indexing phase so a late ANN failure isn't silent.
 *
 * The pure decision (evaluateEmbed) is offline-selftested; the I/O wrapper
 * (checkEmbedProgress) does the R2 read/write + Resend send and is what `ops` imports.
 *
 *   npx tsx search/embed-observer.ts --selftest   # offline logic tests, no network
 *   npx tsx search/embed-observer.ts --once        # one live check (sends + persists)
 *   npx tsx search/embed-observer.ts --once --dry   # one live check, print only
 */
import { r2Get, r2Put } from '../shared/r2-client'
import { VEC_TABLE, VEC_CHECKPOINT_KEY } from './vector-common'

// ── config ──────────────────────────────────────────────────────────────────
// STALL_MIN 25: a single shard can take ~18 min through the Tier-2 create-429
// backoff (observed on the live run), so 12 would false-alarm; 25 gives margin
// over the worst legitimate shard while still catching a genuine death within ~½h.
const STALL_MIN = parseInt(process.env.EMBED_STALL_MIN ?? '25', 10)
// The deterministic shard plan for the 21,846,364-chunk corpus at SHARD_SIZE=12000.
// Only used for the "X/Y (Z%)" display; override if the plan is ever re-sized.
const TOTAL_SHARDS = parseInt(process.env.EMBED_TOTAL_SHARDS ?? '1821', 10)
// ANN-build watchdog: phase=indexing legitimately freezes the checkpoint while the
// IVF_PQ index builds, but that can't outlast this ceiling — beyond it, the box died
// mid-index (the 32GB OOM risk) without flushing an exit line. 8h is well over a healthy
// ANN build on the corpus while still catching a dead box within a working day.
const INDEXING_CEILING_MIN = parseInt(process.env.EMBED_INDEXING_CEILING_MIN ?? '480', 10)
const OBSERVER_STATE_KEY = `_search/${VEC_TABLE}.observer-state.json`
// The Hetzner build box mirrors its stdout here every 30s (see hetzner-build-run.ts).
const LOG_TAIL_KEY = process.env.HETZNER_LOG_TAIL_KEY ?? '_search/hetzner-build.tail.log'
const HEARTBEAT_LOCAL_HOUR = parseInt(process.env.EMBED_HEARTBEAT_HOUR ?? '8', 10)

const RESEND_API = 'https://api.resend.com/emails'
const EMAIL_TO = process.env.EMBED_OBSERVER_TO ?? 'cl@scrutinise.org'
const EMAIL_FROM = 'Scrutinise Ingest <ingest@messages.scrutinise.org>'

export interface EmbedCheckpoint {
  phase?: 'embedding' | 'indexing' | 'done'
  doneShards?: number[]
  vectors?: number
  misses?: number
  shardSize?: number
  updatedAt?: string
}
export interface ObserverState {
  alertState: 'ok' | 'stalled' | 'complete'
  lastDoneShards: number
  lastVectors: number
  lastCheckpointUpdatedAt: string | null
  lastHeartbeatDay: string | null   // Europe/London YYYY-MM-DD of the last heartbeat email
  completeAlerted: boolean
  lastFailureAlerted: string | null // the tail-log failure line already emailed (dedupe)
  indexingStallAlerted: boolean     // ANN-phase ceiling already emailed (dedupe)
}
export interface EmbedEvent { kind: 'stall' | 'recovered' | 'complete' | 'heartbeat' | 'crash' | 'ann-stuck'; subject: string; body: string }
export interface EmbedConfig { stallMin: number; totalShards: number; heartbeatHour: number; indexingCeilingMin: number }

const FRESH_STATE: ObserverState = {
  alertState: 'ok', lastDoneShards: 0, lastVectors: 0,
  lastCheckpointUpdatedAt: null, lastHeartbeatDay: null, completeAlerted: false,
  lastFailureAlerted: null, indexingStallAlerted: false,
}

/** Scan the Hetzner tail log for a terminal failure, regardless of build phase.
 *  Returns the most-recent offending line (crash signature) or null. A clean
 *  `build exited code=0` is NOT a failure. */
export function detectFailure(tail: string | null): string | null {
  if (!tail) return null
  let hit: string | null = null
  for (const raw of tail.split('\n')) {
    const line = raw.trim()
    const exit = line.match(/build exited code=(\d+)/)
    if (exit && exit[1] !== '0') hit = line
    else if (/\bFATAL\b/.test(line)) hit = line
    else if (/\[vec-index\].*FAILED after/.test(line)) hit = line
  }
  return hit
}

// London calendar day + hour for a given instant (heartbeat gating).
function londonParts(nowMs: number): { day: string; hour: number } {
  const d = new Date(nowMs)
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }).format(d))
  return { day, hour }
}

function pct(done: number, total: number): string {
  if (!total) return '?%'
  return `${((done / total) * 100).toFixed(1)}%`
}
function ageMin(updatedAt: string | undefined, nowMs: number): number | null {
  if (!updatedAt) return null
  const t = Date.parse(updatedAt)
  if (Number.isNaN(t)) return null
  return (nowMs - t) / 60_000
}

/**
 * Pure event decision. Given the current checkpoint, the prior observer state and
 * the clock, returns the emails to send and the state to persist. No I/O — this is
 * the offline-testable core.
 */
export function evaluateEmbed(
  cp: EmbedCheckpoint | null,
  prior: ObserverState,
  nowMs: number,
  cfg: EmbedConfig,
  tailLog: string | null = null,
): { events: EmbedEvent[]; next: ObserverState } {
  // No checkpoint → embed has never started (or table reset). Stay silent; keep state.
  if (!cp || !cp.updatedAt) return { events: [], next: prior }

  const done = Array.isArray(cp.doneShards) ? cp.doneShards.length : (cp.doneShards ?? 0)
  const vectors = cp.vectors ?? 0
  const phase = cp.phase ?? 'embedding'
  const age = ageMin(cp.updatedAt, nowMs)
  const advanced = done > prior.lastDoneShards || (cp.updatedAt !== prior.lastCheckpointUpdatedAt && vectors > prior.lastVectors)
  const events: EmbedEvent[] = []
  const next: ObserverState = {
    ...prior,
    lastDoneShards: done,
    lastVectors: vectors,
    lastCheckpointUpdatedAt: cp.updatedAt,
  }

  const posLine = `${done}/${cfg.totalShards} shards (${pct(done, cfg.totalShards)}), ${vectors.toLocaleString()} vectors, ${cp.misses ?? 0} misses`

  // ── CRASH — tail-log terminal failure, checked REGARDLESS of phase ───────────
  // Catches an ANN crash during phase=indexing (the checkpoint freeze would otherwise
  // hide it), a non-zero build exit, a FATAL, or a shard that exhausted its retries.
  // Edge-triggered: alert once per distinct failure line; re-arm when the line clears
  // (a fresh box uploads a clean tail).
  const failLine = detectFailure(tailLog)
  if (failLine) {
    if (failLine !== prior.lastFailureAlerted) {
      events.push({
        kind: 'crash',
        subject: `💥 Vector embed build CRASHED — ${failLine.slice(0, 80)}`,
        body: `The Hetzner build box reported a terminal failure (phase='${phase}').\n\n> ${failLine}\n\n${posLine}\ncheckpoint updatedAt: ${cp.updatedAt}\n\nCheck the box (scrutinise-build) + full tail log (${LOG_TAIL_KEY}). If it died mid-ANN, resume with --index-only. Runbook: docs/VECTOR_EMBED_REPORT.md §5.`,
      })
    }
    next.lastFailureAlerted = failLine
  } else {
    next.lastFailureAlerted = null // re-arm for a future, distinct failure
  }

  // ── COMPLETE / ANN-STUCK — phase left 'embedding' ───────────────────────────
  if (phase !== 'embedding') {
    if (!prior.completeAlerted) {
      const what = phase === 'indexing' ? 'embedding DONE — building the ANN index now' : 'embed + ANN index COMPLETE'
      events.push({
        kind: 'complete',
        subject: `✅ Vector embed: ${what}`,
        body: `The full-corpus vector embed reached phase='${phase}'.\n\n${posLine}\n\nphase: ${phase}\ncheckpoint updatedAt: ${cp.updatedAt}\n\n${phase === 'indexing' ? 'The IVF_PQ ANN index is building (checkpoint freezes during indexing — this is expected).' : 'corpus_vec is fully built and indexed.'}`,
      })
    }
    next.completeAlerted = true
    next.alertState = 'complete'
    // ANN-build watchdog: indexing must not outlast the ceiling (dead box, no exit line).
    if (phase === 'indexing') {
      if (age != null && age > cfg.indexingCeilingMin && !prior.indexingStallAlerted) {
        events.push({
          kind: 'ann-stuck',
          subject: `⏳ Vector embed ANN index STUCK — indexing frozen ${(age / 60).toFixed(1)}h`,
          body: `phase='indexing' but the checkpoint has not advanced for ${(age / 60).toFixed(1)}h (ceiling ${(cfg.indexingCeilingMin / 60).toFixed(0)}h). The IVF_PQ ANN build has likely died (32GB OOM risk) without flushing an exit line.\n\n${posLine}\ncheckpoint updatedAt: ${cp.updatedAt}\n\nResume the index only: build-vector-index.ts --index-only (CCX43 if the 32GB box OOMs). Runbook: docs/VECTOR_EMBED_REPORT.md §5.`,
        })
        next.indexingStallAlerted = true
      }
    } else {
      next.indexingStallAlerted = false // phase=done — re-arm for any future indexing pass
    }
    return { events, next }
  }

  // ── phase === 'embedding' ────────────────────────────────────────────────────
  // Coming back from a completed reset leaves completeAlerted / indexingStallAlerted
  // stale — clear them once we're embedding again so a future pass re-alerts.
  next.completeAlerted = false
  next.indexingStallAlerted = false

  const stalled = age != null && age > cfg.stallMin

  if (stalled && prior.alertState !== 'stalled') {
    events.push({
      kind: 'stall',
      subject: `🔴 Vector embed STALLED — no progress for ${age!.toFixed(0)} min`,
      body: `The vector embed checkpoint has not advanced for ${age!.toFixed(1)} min (threshold ${cfg.stallMin}m) while still embedding.\n\n${posLine}\n\ncheckpoint updatedAt: ${cp.updatedAt}\n\nCheck: the Hetzner build box (scrutinise-build), the tail log (_search/hetzner-build.tail.log), and Gemini batch job states. Runbook: docs/VECTOR_EMBED_REPORT.md §5.`,
    })
    next.alertState = 'stalled'
  } else if (prior.alertState === 'stalled' && (advanced || !stalled)) {
    events.push({
      kind: 'recovered',
      subject: `🟢 Vector embed RECOVERED — progressing again`,
      body: `The vector embed checkpoint is advancing again.\n\n${posLine}\n\ncheckpoint updatedAt: ${cp.updatedAt}`,
    })
    next.alertState = 'ok'
  } else if (!stalled) {
    next.alertState = 'ok'
  }

  // ── HEARTBEAT — one positive email per London day, from HEARTBEAT_LOCAL_HOUR ──
  // Only when healthy (not currently in a stall alert, which already emailed).
  if (next.alertState === 'ok') {
    const { day, hour } = londonParts(nowMs)
    if (hour >= cfg.heartbeatHour && prior.lastHeartbeatDay !== day) {
      const gain = vectors - prior.lastVectors // since last check (≈ recent throughput)
      events.push({
        kind: 'heartbeat',
        subject: `💚 Vector embed progressing — ${posLine}`,
        body: `Daily heartbeat: the vector embed is running normally.\n\n${posLine}\nlast checkpoint: ${cp.updatedAt}${gain > 0 ? `\n(+${gain.toLocaleString()} vectors since the previous check)` : ''}\n\nYou get this once per day while it runs; a 🔴 STALL email means it stopped.`,
      })
      next.lastHeartbeatDay = day
    }
  }

  return { events, next }
}

// ── I/O wrapper (what ops imports) ────────────────────────────────────────────

async function sendEmail(subject: string, body: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) { console.warn('[embed-observer] RESEND_API_KEY not set — cannot email:', subject); return }
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to: [EMAIL_TO], subject, text: body }),
  })
  if (!res.ok) console.error(`[embed-observer] Resend failed: ${res.status} ${await res.text()}`)
  else console.log(`[embed-observer] emailed ${EMAIL_TO}: ${subject}`)
}

async function loadState(): Promise<ObserverState> {
  const raw = await r2Get(OBSERVER_STATE_KEY)
  if (!raw) return { ...FRESH_STATE }
  try { return { ...FRESH_STATE, ...JSON.parse(raw) } } catch { return { ...FRESH_STATE } }
}

/**
 * One observation. Reads the checkpoint + observer state from R2, decides events,
 * sends any emails, and persists the new state. Safe to call every 15 min; a no-op
 * (no email, no write) when nothing has changed. `dry` prints instead of sending.
 * Returns the events it decided (for logging/tests).
 */
export async function checkEmbedProgress(opts: { dry?: boolean } = {}): Promise<EmbedEvent[]> {
  const cfg: EmbedConfig = { stallMin: STALL_MIN, totalShards: TOTAL_SHARDS, heartbeatHour: HEARTBEAT_LOCAL_HOUR, indexingCeilingMin: INDEXING_CEILING_MIN }
  const [cpRaw, prior, tailLog] = await Promise.all([r2Get(VEC_CHECKPOINT_KEY), loadState(), r2Get(LOG_TAIL_KEY)])
  let cp: EmbedCheckpoint | null = null
  if (cpRaw) { try { cp = JSON.parse(cpRaw) } catch { cp = null } }

  const { events, next } = evaluateEmbed(cp, prior, Date.now(), cfg, tailLog)

  for (const e of events) {
    if (opts.dry) console.log(`[embed-observer] (dry) ${e.kind}: ${e.subject}\n${e.body}\n`)
    else await sendEmail(e.subject, e.body)
  }
  // Persist only when something changed, to keep R2 writes minimal.
  const changed = JSON.stringify(next) !== JSON.stringify(prior)
  if (changed && !opts.dry) await r2Put(OBSERVER_STATE_KEY, JSON.stringify(next), 'application/json')
  return events
}

// ── offline self-test ──────────────────────────────────────────────────────────
function selftest() {
  const cfg: EmbedConfig = { stallMin: 25, totalShards: 1821, heartbeatHour: 8, indexingCeilingMin: 480 }
  const NOON = Date.parse('2026-07-12T11:00:00Z') // 12:00 Europe/London (BST) → past heartbeat hour
  const iso = (msAgo: number) => new Date(NOON - msAgo).toISOString()
  const cp = (over: Partial<EmbedCheckpoint>): EmbedCheckpoint => ({ phase: 'embedding', doneShards: [], vectors: 0, misses: 0, shardSize: 12000, updatedAt: iso(0), ...over })
  const doneArr = (n: number) => Array.from({ length: n }, (_, i) => i)
  let ok = true
  const chk = (label: string, cond: boolean) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) ok = false }

  // 1. fresh + healthy + past 08:00 → heartbeat only (no stall)
  {
    const r = evaluateEmbed(cp({ doneShards: doneArr(850), vectors: 10_200_000, updatedAt: iso(2 * 60_000) }), { ...FRESH_STATE }, NOON, cfg)
    chk('healthy fresh → one heartbeat', r.events.length === 1 && r.events[0].kind === 'heartbeat')
    chk('healthy → alertState ok', r.next.alertState === 'ok')
    chk('heartbeat records the day', r.next.lastHeartbeatDay === '2026-07-12')
  }
  // 2. same day, already sent heartbeat, still healthy → no email
  {
    const prior: ObserverState = { ...FRESH_STATE, lastHeartbeatDay: '2026-07-12', lastDoneShards: 850, lastVectors: 10_200_000, lastCheckpointUpdatedAt: iso(9 * 60_000) }
    const r = evaluateEmbed(cp({ doneShards: doneArr(851), vectors: 10_212_000, updatedAt: iso(2 * 60_000) }), prior, NOON, cfg)
    chk('healthy, heartbeat already sent today → silent', r.events.length === 0)
  }
  // 3. stalled (age > 25m) from ok → one stall email, edge-triggered
  {
    const prior: ObserverState = { ...FRESH_STATE, lastHeartbeatDay: '2026-07-12', lastDoneShards: 851, lastVectors: 10_212_000, lastCheckpointUpdatedAt: iso(40 * 60_000) }
    const r = evaluateEmbed(cp({ doneShards: doneArr(851), vectors: 10_212_000, updatedAt: iso(40 * 60_000) }), prior, NOON, cfg)
    chk('stall → one stall email', r.events.length === 1 && r.events[0].kind === 'stall')
    chk('stall → alertState stalled', r.next.alertState === 'stalled')
  }
  // 4. still stalled next tick → NO repeat email
  {
    const prior: ObserverState = { ...FRESH_STATE, alertState: 'stalled', lastHeartbeatDay: '2026-07-12', lastDoneShards: 851, lastVectors: 10_212_000, lastCheckpointUpdatedAt: iso(55 * 60_000) }
    const r = evaluateEmbed(cp({ doneShards: doneArr(851), vectors: 10_212_000, updatedAt: iso(55 * 60_000) }), prior, NOON, cfg)
    chk('still stalled → no repeat email', r.events.length === 0 && r.next.alertState === 'stalled')
  }
  // 5. recovery: was stalled, checkpoint advanced → recovered email
  {
    const prior: ObserverState = { ...FRESH_STATE, alertState: 'stalled', lastHeartbeatDay: '2026-07-12', lastDoneShards: 851, lastVectors: 10_212_000, lastCheckpointUpdatedAt: iso(55 * 60_000) }
    const r = evaluateEmbed(cp({ doneShards: doneArr(853), vectors: 10_236_000, updatedAt: iso(1 * 60_000) }), prior, NOON, cfg)
    chk('recovered → one recovered email', r.events.some(e => e.kind === 'recovered') && r.next.alertState === 'ok')
  }
  // 6. completion: phase left embedding → complete email once, then silent
  {
    const prior: ObserverState = { ...FRESH_STATE, alertState: 'ok', lastHeartbeatDay: '2026-07-12', lastDoneShards: 1821, lastVectors: 21_800_000 }
    const r1 = evaluateEmbed(cp({ phase: 'indexing', doneShards: doneArr(1821), vectors: 21_846_000, updatedAt: iso(5 * 60_000) }), prior, NOON, cfg)
    chk('phase=indexing → complete email once', r1.events.length === 1 && r1.events[0].kind === 'complete' && r1.next.completeAlerted)
    const r2 = evaluateEmbed(cp({ phase: 'done', doneShards: doneArr(1821), vectors: 21_846_000, updatedAt: iso(5 * 60_000) }), r1.next, NOON, cfg)
    chk('phase=done after already alerted → silent', r2.events.length === 0)
  }
  // 7. no checkpoint → silent no-op
  {
    const r = evaluateEmbed(null, { ...FRESH_STATE }, NOON, cfg)
    chk('no checkpoint → silent', r.events.length === 0)
  }
  // 8. before 08:00 London → no heartbeat even when healthy
  {
    const EARLY = Date.parse('2026-07-12T05:00:00Z') // 06:00 London
    const r = evaluateEmbed(cp({ doneShards: doneArr(850), vectors: 10_200_000, updatedAt: new Date(EARLY - 60_000).toISOString() }), { ...FRESH_STATE }, EARLY, cfg)
    chk('healthy before heartbeat hour → no email', r.events.length === 0)
  }
  // 9. detectFailure: non-zero exit / FATAL / shard-FAILED hit; clean exit does not
  {
    chk('detectFailure non-zero exit', detectFailure('foo\n[hetzner-build] build exited code=134\nbar') !== null)
    chk('detectFailure FATAL', detectFailure('[vec-index] FATAL Error: boom') !== null)
    chk('detectFailure shard FAILED', detectFailure('[vec-index] 842 FAILED after 3 retries: x') !== null)
    chk('detectFailure clean exit → null', detectFailure('[hetzner-build] build exited code=0\n[hetzner-build] DONE (exit 0)') === null)
    chk('detectFailure no signal → null', detectFailure('shard-000851 done (12000 vec, 0 miss)') === null)
  }
  // 10. crash email fires regardless of phase, edge-triggered, and re-arms when cleared
  {
    const tail = '…\n[hetzner-build] build exited code=134'
    const r1 = evaluateEmbed(cp({ phase: 'indexing', doneShards: doneArr(1821), vectors: 21_846_000, updatedAt: iso(3 * 60_000) }), { ...FRESH_STATE, completeAlerted: true, alertState: 'complete' }, NOON, cfg, tail)
    chk('crash during indexing → one crash email', r1.events.filter(e => e.kind === 'crash').length === 1)
    const r2 = evaluateEmbed(cp({ phase: 'indexing', doneShards: doneArr(1821), vectors: 21_846_000, updatedAt: iso(3 * 60_000) }), r1.next, NOON, cfg, tail)
    chk('same crash next tick → no repeat', r2.events.filter(e => e.kind === 'crash').length === 0)
    const r3 = evaluateEmbed(cp({ phase: 'embedding', doneShards: doneArr(1), vectors: 12_000, updatedAt: iso(1 * 60_000) }), r2.next, NOON, cfg, null)
    chk('failure line cleared → re-armed', r3.next.lastFailureAlerted === null)
  }
  // 11. ANN-STUCK: phase=indexing frozen past the 8h ceiling → one email, edge-triggered
  {
    const prior: ObserverState = { ...FRESH_STATE, completeAlerted: true, alertState: 'complete' }
    const r1 = evaluateEmbed(cp({ phase: 'indexing', doneShards: doneArr(1821), vectors: 21_846_000, updatedAt: iso(500 * 60_000) }), prior, NOON, cfg)
    chk('indexing frozen > ceiling → ann-stuck email', r1.events.filter(e => e.kind === 'ann-stuck').length === 1)
    const r2 = evaluateEmbed(cp({ phase: 'indexing', doneShards: doneArr(1821), vectors: 21_846_000, updatedAt: iso(560 * 60_000) }), r1.next, NOON, cfg)
    chk('still stuck → no repeat', r2.events.filter(e => e.kind === 'ann-stuck').length === 0)
  }
  // 12. healthy indexing within the ceiling → complete note only, no ann-stuck
  {
    const r = evaluateEmbed(cp({ phase: 'indexing', doneShards: doneArr(1821), vectors: 21_846_000, updatedAt: iso(60 * 60_000) }), { ...FRESH_STATE, alertState: 'ok' }, NOON, cfg)
    chk('indexing within ceiling → no ann-stuck', r.events.filter(e => e.kind === 'ann-stuck').length === 0)
  }

  console.log(ok ? '\nALL PASS' : '\nFAILED')
  if (!ok) process.exit(1)
}

if (require.main === module) {
  if (process.argv.includes('--selftest')) selftest()
  else if (process.argv.includes('--once')) {
    checkEmbedProgress({ dry: process.argv.includes('--dry') })
      .then(evs => { console.log(`[embed-observer] ${evs.length} event(s) this check.`); })
      .catch(e => { console.error('[embed-observer] error', e); process.exit(1) })
  } else {
    console.log('usage: embed-observer.ts --selftest | --once [--dry]')
  }
}
