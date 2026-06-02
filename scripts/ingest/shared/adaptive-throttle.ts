/**
 * Adaptive rate limiter. Doubles delay on 429/503, reduces 10% after WINDOW clean requests.
 * Floor is configurable per source (BAILII requires 1000ms minimum).
 */
export class AdaptiveThrottle {
  private delay: number
  private readonly floor: number
  private readonly ceiling: number
  private readonly window: number
  private readonly suspendThreshold: number
  private readonly onSuspend?: (delayMs: number) => void
  private history: boolean[] = []

  constructor(opts: {
    floor?: number
    ceiling?: number
    window?: number
    // Called when delay breaches suspendThreshold — use to write to source_rate_limits
    onSuspend?: (delayMs: number) => void
    suspendThresholdMs?: number
  } = {}) {
    this.floor = opts.floor ?? 200
    this.ceiling = opts.ceiling ?? 30_000
    this.window = opts.window ?? 50
    this.suspendThreshold = opts.suspendThresholdMs ?? 60_000
    this.onSuspend = opts.onSuspend
    this.delay = this.floor
  }

  async wait(): Promise<void> {
    await new Promise(r => setTimeout(r, this.delay))
  }

  success(): void {
    this.history.push(true)
    if (this.history.length > this.window) this.history.shift()
    if (this.history.length === this.window && this.history.every(v => v)) {
      const before = this.delay
      this.delay = Math.max(this.floor, Math.floor(this.delay * 0.9))
      if (this.delay < before) {
        console.log(`  [throttle] ${this.delay}ms/req`)
      }
    }
  }

  backoff(): void {
    this.history.push(false)
    if (this.history.length > this.window) this.history.shift()
    this.delay = Math.min(this.ceiling, this.delay * 2)
    console.warn(`  [throttle] rate limited — slowing to ${this.delay}ms`)
    if (this.onSuspend && this.delay >= this.suspendThreshold) {
      this.onSuspend(this.delay)
    }
  }

  currentDelay(): number { return this.delay }
}
