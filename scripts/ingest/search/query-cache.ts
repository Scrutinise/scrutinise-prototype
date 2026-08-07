/**
 * query-cache.ts — short-TTL in-memory result cache + single-flight coalescing for the
 * retrieval query services.
 *
 * WHY. Search queries repeat: the same idea, at the same stage, with the same keywords.
 * A repeat costs exactly what the first one cost — an ANN search, a chunk scan and (on
 * the vector path) a live Gemini embed — for an answer we already computed. This removes
 * that load before it reaches the database at all.
 *
 * TWO MECHANISMS, and the second matters more than it looks:
 *
 *  1. TTL cache. A completed result is held for TTL_MS and served from memory.
 *  2. SINGLE-FLIGHT. Identical queries that arrive while the first is still running
 *     WAIT on it instead of each doing the work. A plain TTL cache does nothing for a
 *     thundering herd — N simultaneous identical queries are N misses, all of which run.
 *     That is the exact shape this service sees: query-router.ts fans one user's search
 *     out to 5 concurrent streams, and a retry or a double-submit lands the same query
 *     again while the first is still in flight. Coalescing turns N concurrent identical
 *     queries into one unit of database work, which is a concurrency-guard saving as much
 *     as a latency one — a coalesced request never takes a semaphore slot.
 *
 * ⚠ THE KEY INCLUDES THE FULL SCOPE, NOT JUST {query, tier, limit}. `corpora` and
 * `excludeCorpora` MUST be part of it. The debates and committees streams both run on
 * tier='parliamentary' and are separated ONLY by their corpus scope — key on
 * {query, tier, limit} alone and a committees search would be served the debates
 * stream's cached results. That is precisely the "a stream quietly serving another
 * stream's content" failure the tier echo in both query services exists to prevent, and
 * a cache keyed too loosely would reintroduce it behind the check rather than in front
 * of it. Scope arrays are sorted before hashing so ['a','b'] and ['b','a'] share an entry.
 *
 * EMPTY RESULTS ARE CACHED DELIBERATELY. A query that legitimately returns nothing (see
 * GOLD_TEST_09 on the committees stream) costs the same to compute as one that returns
 * 20 rows. Not caching empties would leave the most expensive-per-unit-value queries
 * hitting the database every single time.
 *
 * BOUNDED, AND EVICTION IS COUNTED. MAX_ENTRIES caps the map with LRU eviction so the
 * cache cannot become the thing that breaches the memory cap it was added to protect.
 * Evictions are reported on /stats: a high eviction count next to a low hit rate means
 * the cache is too small for the traffic, and that should be visible rather than inferred.
 */

export interface CacheStats {
  hits: number
  misses: number
  coalesced: number
  evictions: number
  expired: number
  size: number
  maxEntries: number
  ttlMs: number
  hitRate: number | null
}

interface Entry<V> { value: V; expiresAt: number }

export class QueryCache<V> {
  private readonly ttlMs: number
  private readonly maxEntries: number
  // Map preserves insertion order, which is what makes LRU a delete+set away.
  private readonly store = new Map<string, Entry<V>>()
  private readonly inFlight = new Map<string, Promise<V>>()
  private hits = 0
  private misses = 0
  private coalescedCount = 0
  private evictions = 0
  private expiredCount = 0

  constructor(opts: { ttlMs: number; maxEntries: number }) {
    this.ttlMs = opts.ttlMs
    this.maxEntries = opts.maxEntries
  }

  get enabled(): boolean { return this.ttlMs > 0 && this.maxEntries > 0 }

  /**
   * Build a cache key from a query + its FULL scope. Exported through the class so both
   * query services key identically and neither can drift into the loose-key bug above.
   */
  static key(parts: {
    query: string
    tier?: string | null
    limit: number
    corpora?: string[] | null
    excludeCorpora?: string[] | null
  }): string {
    // Normalise the query the way a user's repeat would differ: surrounding whitespace and
    // case. Nothing more aggressive — stemming or token reordering here would merge queries
    // the retrieval layer itself treats as different, and the cache would start changing
    // answers rather than just remembering them.
    const q = parts.query.trim().replace(/\s+/g, ' ').toLowerCase()
    const sorted = (a?: string[] | null) => (a?.length ? [...a].sort() : [])
    return JSON.stringify([q, parts.tier ?? null, parts.limit, sorted(parts.corpora), sorted(parts.excludeCorpora)])
  }

  /**
   * Get from cache, or run `compute` — coalescing concurrent identical calls onto one run.
   * `onOutcome` reports what happened so the caller can label the response ('hit' |
   * 'coalesced' | 'miss') without re-deriving it.
   */
  async resolve(key: string, compute: () => Promise<V>, onOutcome?: (o: 'hit' | 'coalesced' | 'miss') => void): Promise<V> {
    if (!this.enabled) { this.misses++; onOutcome?.('miss'); return compute() }

    const hit = this.store.get(key)
    if (hit) {
      if (hit.expiresAt > Date.now()) {
        // Refresh recency for LRU: delete + re-set moves it to the end of the Map.
        this.store.delete(key)
        this.store.set(key, hit)
        this.hits++
        onOutcome?.('hit')
        return hit.value
      }
      this.store.delete(key)
      this.expiredCount++
    }

    const running = this.inFlight.get(key)
    if (running) {
      this.coalescedCount++
      onOutcome?.('coalesced')
      return running
    }

    this.misses++
    onOutcome?.('miss')
    const p = compute()
      .then((value) => { this.set(key, value); return value })
      // A failure is NOT cached — the next caller should get a real attempt, not a
      // remembered error. It is still shared with everyone already coalesced onto it,
      // which is correct: they would all have failed the same way.
      .finally(() => { this.inFlight.delete(key) })
    this.inFlight.set(key, p)
    return p
  }

  private set(key: string, value: V) {
    if (this.store.has(key)) this.store.delete(key)
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs })
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value as string | undefined
      if (oldest === undefined) break
      this.store.delete(oldest)
      this.evictions++
    }
  }

  stats(): CacheStats {
    const total = this.hits + this.misses + this.coalescedCount
    return {
      hits: this.hits,
      misses: this.misses,
      coalesced: this.coalescedCount,
      evictions: this.evictions,
      expired: this.expiredCount,
      size: this.store.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
      // Coalesced calls count as saves: they did not reach the database either.
      hitRate: total ? Math.round(((this.hits + this.coalescedCount) / total) * 1000) / 1000 : null,
    }
  }

  /** Drop everything. For tests, and for the "the index was just rebuilt" case. */
  clear() { this.store.clear() }
}
