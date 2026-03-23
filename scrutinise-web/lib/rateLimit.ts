// Simple in-memory rate limiter.
// State is per-process — fine for a single-instance deployment on Vercel.
// For multi-instance deployments, replace with Redis (e.g. Upstash).

const limits = new Map<string, { count: number; reset: number }>()

/**
 * Check whether the key is within its rate limit.
 * @param key      Unique string (e.g. `ai:${userId}` or `invite:${userId}`)
 * @param max      Maximum number of requests allowed in the window
 * @param windowMs Window duration in milliseconds
 * @returns true if the request is allowed; false if rate-limited
 */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = limits.get(key)

  if (!entry || now > entry.reset) {
    limits.set(key, { count: 1, reset: now + windowMs })
    return true
  }

  if (entry.count >= max) return false

  entry.count++
  return true
}
