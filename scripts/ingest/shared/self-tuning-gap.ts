/**
 * self-tuning-gap.ts — the EDM sweep's rate controller, lifted out of `position-graph/sweep-edm-signatures.ts`
 * so a second sweep reuses it instead of writing a second limiter (BRIEF_INGEST_LEX_FIVE §5.2).
 *
 * The behaviour is the EDM sweep's, unchanged — 60,995 requests at 4.8/s with zero 429s, walking from
 * 250 ms to a 120 ms floor — and the reasons are in that file's header (a Cloudflare rule with a fixed
 * mitigation instant; an hour on the clock if tripped). In short:
 *   · one shared brake and one shared pace for every worker, so a 429 slows all of them;
 *   · it starts slow and speeds up 5% per `speedupEvery` clean requests, only while nothing has objected;
 *   · the FIRST 429 stops speeding up for the rest of the run: converge, then hold;
 *   · `Retry-After` is honoured in full, never capped;
 *   · a 429 drawn before `slowdownAfterOk` successful requests sleeps but does not slow the run: it is about
 *     an earlier process's pace, not this one's;
 *   · every request carries a timeout (fetch() has none, and a hung socket stops a sweep rather than failing it);
 *   · a non-429 4xx is an ANSWER and is returned, never retried; 5xx and network errors retry with backoff.
 *
 * ⚠ The EDM script still carries its own copy of this logic. Two copies is one that will be updated;
 * migrating that script to this module is a reported follow-up, not done here (it is a finished sweep).
 */
export interface GapOptions {
  startGapMs?: number
  minGapMs?: number
  requestTimeoutMs?: number
  speedupEvery?: number
  slowdownAfterOk?: number
  userAgent: string
  log?: (s: string) => void
}

export function createGapController(opts: GapOptions) {
  const startGap = opts.startGapMs ?? 250
  const minGap = opts.minGapMs ?? 120
  const timeoutMs = opts.requestTimeoutMs ?? 20_000
  const speedupEvery = opts.speedupEvery ?? 400
  const slowdownAfterOk = opts.slowdownAfterOk ?? 50
  const log = opts.log ?? ((s: string) => console.log(s))

  const rate = { gapMs: startGap, until: 0, hits: 0, sleptMs: 0, cleanSinceChange: 0, ok: 0, everThrottled: false, maxRetryAfter: 0 }
  const tally = { requests: 0, retried: 0, timedOut: 0, http: new Map<number, number>() }

  async function waitForBrake() {
    for (;;) {
      const wait = rate.until - Date.now()
      if (wait <= 0) return
      const nap = Math.min(wait, 5000)
      rate.sleptMs += nap
      await new Promise((r) => setTimeout(r, nap))
    }
  }
  function onThrottled(retryAfter: string | null) {
    rate.hits++
    const secs = retryAfter && /^\d+$/.test(retryAfter) ? parseInt(retryAfter, 10) : 60
    rate.maxRetryAfter = Math.max(rate.maxRetryAfter, secs)
    const until = Date.now() + secs * 1000
    const isNewMitigation = until > rate.until + 1000   // a concurrent 429 inside one mitigation is the SAME event
    rate.everThrottled = true
    rate.cleanSinceChange = 0
    if (!isNewMitigation) return
    rate.until = until
    if (rate.ok >= slowdownAfterOk) rate.gapMs = Math.min(5000, Math.max(minGap, rate.gapMs * 2))
    else log(`   ⚠ 429 after only ${rate.ok} successful requests this run — sleeping, but NOT slowing down (mitigation predates this process)`)
    log(`   ⏸ 429 — sleeping ${secs}s (until ${new Date(until).toISOString().slice(11, 19)}Z), gap → ${rate.gapMs}ms, speed-ups off for the rest of the run`)
  }
  function onClean() {
    rate.ok++
    rate.cleanSinceChange++
    if (!rate.everThrottled && rate.cleanSinceChange >= speedupEvery) {
      rate.gapMs = Math.max(minGap, Math.round(rate.gapMs * 0.95))
      rate.cleanSinceChange = 0
    }
  }

  let nextSlot = 0
  /** Serialises the pace across workers: each request takes the next slot `gapMs` after the last. */
  async function pace() {
    const now = Date.now()
    const at = Math.max(now, nextSlot)
    nextSlot = at + rate.gapMs
    if (at > now) await new Promise((r) => setTimeout(r, at - now))
  }

  /** GET json with the controller's pacing. `status` is the last HTTP status (-1 network, -2 timeout); `body` null on failure. */
  async function getJson(url: string, attempts = 6): Promise<{ status: number; body: any }> {
    let status = -1
    for (let i = 0; i < attempts; i++) {
      await waitForBrake()
      await pace()
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), timeoutMs)
      tally.requests++
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': opts.userAgent }, signal: ac.signal })
        status = res.status
        tally.http.set(status, (tally.http.get(status) ?? 0) + 1)
        if (res.ok) { const body = await res.json(); onClean(); return { status, body } }
        if (status === 429) { await res.text().catch(() => {}); onThrottled(res.headers.get('retry-after')); tally.retried++; continue }
        if (status < 500) { await res.text().catch(() => {}); return { status, body: null } }   // an answer, not a fault
        await res.text().catch(() => {})
      } catch (e) {
        status = (e as Error).name === 'AbortError' ? -2 : -1
        if (status === -2) tally.timedOut++
      } finally { clearTimeout(timer) }
      if (i < attempts - 1) { tally.retried++; await new Promise((r) => setTimeout(r, 1500 * (i + 1))) }
    }
    return { status, body: null }
  }

  return { rate, tally, getJson }
}
