/**
 * check-vector-serving.ts — checks for the vector serving layer: the cache key, the
 * single-flight coalescing, and the concurrency guard's bookkeeping.
 *
 * These are pure-logic checks with no network and no Lance, so they run anywhere and in
 * under a second. The things they protect are not hypothetical:
 *
 *   - The cache key MUST separate streams that share a tier. debates and committees are
 *     both tier='parliamentary' and differ only by corpus scope; a key of
 *     {query, tier, limit} would serve one stream's results to the other.
 *   - Single-flight MUST NOT cache failures, or one transient Gemini error would be
 *     served to every caller for the whole TTL.
 *   - Eviction MUST be bounded, or the cache becomes the thing that breaches the memory
 *     cap it was added under.
 *
 * Usage: tsx search/check-vector-serving.ts
 */
import { QueryCache } from './query-cache'

export {}

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

const COMMITTEE_CORPORA = ['committee-reports', 'committee-evidence']

async function main() {
  console.log('cache key — scope separation')
  {
    const base = { query: 'water pollution enforcement', limit: 20 }
    const debates = QueryCache.key({ ...base, tier: 'parliamentary', excludeCorpora: COMMITTEE_CORPORA })
    const committees = QueryCache.key({ ...base, tier: 'parliamentary', corpora: COMMITTEE_CORPORA })
    const unscoped = QueryCache.key({ ...base, tier: 'parliamentary' })
    check('debates ≠ committees (same tier, different corpus scope)', debates !== committees)
    check('scoped ≠ unscoped', debates !== unscoped && committees !== unscoped)
    check('different tier ⇒ different key',
      QueryCache.key({ ...base, tier: 'legislation' }) !== QueryCache.key({ ...base, tier: 'caselaw' }))
    check('different limit ⇒ different key',
      QueryCache.key({ ...base, tier: 'legislation', limit: 20 }) !== QueryCache.key({ ...base, tier: 'legislation', limit: 50 }))
    check('corpus order does not matter (["a","b"] === ["b","a"])',
      QueryCache.key({ ...base, corpora: ['a', 'b'] }) === QueryCache.key({ ...base, corpora: ['b', 'a'] }))
    check('whitespace/case normalised into one entry',
      QueryCache.key({ query: '  Water   Pollution ', limit: 20 }) === QueryCache.key({ query: 'water pollution', limit: 20 }))
    check('empty scope === omitted scope',
      QueryCache.key({ ...base, corpora: [] }) === QueryCache.key({ ...base }))
  }

  console.log('\nTTL cache')
  {
    const c = new QueryCache<number>({ ttlMs: 50, maxEntries: 10 })
    let runs = 0
    const compute = async () => { runs++; return 1 }
    await c.resolve('k', compute)
    await c.resolve('k', compute)
    check('second identical call is served from cache', runs === 1, `compute ran ${runs}×`)
    check('hit counted', c.stats().hits === 1)
    await new Promise((r) => setTimeout(r, 70))
    await c.resolve('k', compute)
    check('expired entry recomputes', runs === 2, `compute ran ${runs}×`)
    check('expiry counted', c.stats().expired === 1)
  }

  console.log('\nsingle-flight coalescing')
  {
    const c = new QueryCache<number>({ ttlMs: 5000, maxEntries: 10 })
    let runs = 0
    const slow = async () => { runs++; await new Promise((r) => setTimeout(r, 60)); return 7 }
    const out = await Promise.all(Array.from({ length: 10 }, () => c.resolve('same', slow)))
    check('10 concurrent identical calls ⇒ 1 unit of work', runs === 1, `compute ran ${runs}×`)
    check('all 10 got the right answer', out.every((v) => v === 7))
    check('9 counted as coalesced', c.stats().coalesced === 9, `got ${c.stats().coalesced}`)
    check('hitRate counts coalesced as saved', c.stats().hitRate === 0.9, `got ${c.stats().hitRate}`)
  }

  console.log('\nfailures are not cached')
  {
    const c = new QueryCache<number>({ ttlMs: 5000, maxEntries: 10 })
    let runs = 0
    const flaky = async () => { runs++; if (runs === 1) throw new Error('transient'); return 42 }
    await c.resolve('k', flaky).catch(() => {})
    const second = await c.resolve('k', flaky)
    check('a failed compute is retried, not remembered', second === 42 && runs === 2, `runs=${runs}`)
    // A failure shared with coalesced waiters is correct — they would all have failed —
    // but it must not leave the key permanently poisoned.
    check('in-flight entry cleared after failure', (await c.resolve('k', flaky)) === 42)
  }

  console.log('\nbounded size / LRU')
  {
    const c = new QueryCache<number>({ ttlMs: 5000, maxEntries: 3 })
    for (let i = 0; i < 6; i++) await c.resolve(`k${i}`, async () => i)
    const s = c.stats()
    check('size never exceeds maxEntries', s.size === 3, `size=${s.size}`)
    check('evictions counted', s.evictions === 3, `evictions=${s.evictions}`)
    let recomputed = false
    await c.resolve('k0', async () => { recomputed = true; return 0 })
    check('oldest entry was the one evicted (LRU)', recomputed)
  }

  console.log('\ndisabled cache is a true bypass')
  {
    const c = new QueryCache<number>({ ttlMs: 0, maxEntries: 500 })
    let runs = 0
    await c.resolve('k', async () => { runs++; return 1 })
    await c.resolve('k', async () => { runs++; return 1 })
    check('TTL 0 ⇒ every call computes', runs === 2, `runs=${runs}`)
    check('nothing retained', c.stats().size === 0)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
