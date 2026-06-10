/**
 * rate-limiter.ts — in-memory per-source token bucket (V17).
 *
 * With all claim loops in one process, rate-limit enforcement is exact and free:
 * one bucket per source, shared by every loop. The DB round-trips that the old
 * claim SQL made against source_rate_limits existed only to coordinate 20
 * separate worker processes — they are gone. source_rate_limits remains the
 * CONFIGURATION source: rates are still edited there and re-read on startup.
 *
 * Two constraints per source:
 *   - intervalMs: minimum gap between successive claims (token refill rate)
 *   - maxConcurrent: maximum rows of that source in flight at once
 */

export interface SourceRateConfig {
  sourceKey: string
  intervalMs: number
  maxConcurrent: number
  suspendedUntil: number | null  // epoch ms, or null
}

interface Bucket {
  intervalMs: number
  maxConcurrent: number
  nextAvailableAt: number  // epoch ms when the next token is free
  inFlight: number
  suspendedUntil: number   // epoch ms; 0 = not suspended
}

// Sources with no source_rate_limits row were unconstrained pre-V17. A gentle
// default protects unknown upstreams without blocking new corpora.
const DEFAULT_INTERVAL_MS = 500
const DEFAULT_MAX_CONCURRENT = 4

class RateLimiter {
  private buckets = new Map<string, Bucket>()

  /** Load (or reload) configuration — called once at process startup. */
  configure(configs: SourceRateConfig[]): void {
    for (const c of configs) {
      const existing = this.buckets.get(c.sourceKey)
      // Defensive Number(): pg returns BIGINT columns as strings, and a string
      // intervalMs turns nextAvailableAt arithmetic into concatenation.
      const intervalMs = Number(c.intervalMs)
      const maxConcurrent = Number(c.maxConcurrent)
      this.buckets.set(c.sourceKey, {
        intervalMs: Number.isFinite(intervalMs) ? intervalMs : DEFAULT_INTERVAL_MS,
        maxConcurrent: Number.isFinite(maxConcurrent) && maxConcurrent >= 1 ? maxConcurrent : DEFAULT_MAX_CONCURRENT,
        nextAvailableAt: existing?.nextAvailableAt ?? 0,
        inFlight: existing?.inFlight ?? 0,
        suspendedUntil: c.suspendedUntil ?? 0,
      })
    }
  }

  private ensure(sourceKey: string): Bucket {
    let b = this.buckets.get(sourceKey)
    if (!b) {
      b = {
        intervalMs: DEFAULT_INTERVAL_MS,
        maxConcurrent: DEFAULT_MAX_CONCURRENT,
        nextAvailableAt: 0,
        inFlight: 0,
        suspendedUntil: 0,
      }
      this.buckets.set(sourceKey, b)
    }
    return b
  }

  /** Subset of `sourceKeys` that can be claimed from right now. */
  eligible(sourceKeys: string[]): string[] {
    const now = Date.now()
    return sourceKeys.filter(k => {
      const b = this.ensure(k)
      return b.suspendedUntil <= now && b.nextAvailableAt <= now && b.inFlight < b.maxConcurrent
    })
  }

  /** Consume a token and a concurrency slot — call after a successful claim. */
  recordClaim(sourceKey: string): void {
    const b = this.ensure(sourceKey)
    b.nextAvailableAt = Date.now() + b.intervalMs
    b.inFlight++
  }

  /** Release the concurrency slot — call when the row finishes (done OR failed). */
  release(sourceKey: string): void {
    const b = this.ensure(sourceKey)
    b.inFlight = Math.max(0, b.inFlight - 1)
  }

  /** Suspend a source (e.g. on HTTP 429). */
  suspend(sourceKey: string, durationMs: number): void {
    const b = this.ensure(sourceKey)
    b.suspendedUntil = Math.max(b.suspendedUntil, Date.now() + durationMs)
  }

  /**
   * Milliseconds until any of `sourceKeys` next has a token. Returns null when
   * every source is blocked on concurrency (a slot frees when a row finishes,
   * not at a known time) — caller should use a short fixed sleep.
   */
  msUntilNextToken(sourceKeys: string[]): number | null {
    const now = Date.now()
    let min: number | null = null
    for (const k of sourceKeys) {
      const b = this.ensure(k)
      if (b.inFlight >= b.maxConcurrent) continue
      const wait = Math.max(b.suspendedUntil - now, b.nextAvailableAt - now, 0)
      if (min === null || wait < min) min = wait
    }
    return min
  }
}

export const rateLimiter = new RateLimiter()
