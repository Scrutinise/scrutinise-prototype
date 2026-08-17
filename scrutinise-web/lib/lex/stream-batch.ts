// ─────────────────────────────────────────────────────────────────────────────
// stream-batch.ts — BRIEF_SEARCH_S5 §2: batching, which is a prerequisite and not an
// optimisation.
//
// ⚠ THE PROBLEM, EXACTLY. `runRoutedSearch` dispatched every routed stream with
// `Promise.all(active.map(...))`. Five streams per query against a search service that
// handles four concurrently means ONE USER SATURATES IT — and S5 is the sprint that makes
// five streams the normal case for the Lex conversation rather than the exception.
//
// ⚠ THIS IS NOT A RATE LIMITER AND MUST NOT BECOME ONE. It bounds how many stream calls one
// QUERY has in flight. It knows nothing about other users, other requests or the service's
// real queue depth — a process-local cap cannot, and claiming otherwise would be the kind of
// guarantee that reads as true right up until there are two instances. What it prevents is a
// single query being its own thundering herd.
//
// ⚠ AND IT REPORTS WHAT IT ACTUALLY DID. `maxInFlight` is observed, not assumed: S5 §2 asks
// to "measure the concurrency behaviour rather than assuming it", and a limiter that silently
// fails open looks exactly like a limiter that is working.
// ─────────────────────────────────────────────────────────────────────────────

/** Default 3, under the service's 4, so one query never fills the pool on its own. */
export const STREAM_CONCURRENCY = (() => {
  const raw = process.env.LEX_STREAM_CONCURRENCY
  const n = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(n) && n >= 1 && n <= 16 ? n : 3
})()

export interface BatchStats {
  /** How many tasks were run. */
  tasks: number
  /** ⚠ OBSERVED, not the configured cap. If these differ, the limiter is not doing its job. */
  maxInFlight: number
  /** The cap that was in force. */
  limit: number
  /** Wall-clock milliseconds for the whole batch. */
  ms: number
}

/**
 * Run `tasks` with at most `limit` in flight, preserving input order in the output.
 *
 * ⚠ ORDER IS PRESERVED DELIBERATELY. `interleaveStreams` downstream assumes result[i] belongs
 * to stream[i]; a limiter that returned completion order would silently re-label every result
 * with the wrong stream — a correctness bug wearing a performance change's clothes.
 *
 * ⚠ A REJECTED TASK REJECTS THE BATCH, exactly as `Promise.all` did. Swallowing a stream
 * failure here would convert "committees is down" into "committees found nothing", which is
 * the never-claim rule broken at the retrieval layer.
 */
export async function mapWithLimit<T, R>(
  tasks: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<{ results: R[]; stats: BatchStats }> {
  const started = Date.now()
  const results = new Array<R>(tasks.length)
  const cap = Math.max(1, Math.min(limit, tasks.length || 1))
  let next = 0
  let inFlight = 0
  let maxInFlight = 0

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++
      if (i >= tasks.length) return
      inFlight++
      if (inFlight > maxInFlight) maxInFlight = inFlight
      try {
        results[i] = await fn(tasks[i], i)
      } finally {
        inFlight--
      }
    }
  }

  await Promise.all(Array.from({ length: cap }, () => worker()))
  return { results, stats: { tasks: tasks.length, maxInFlight, limit: cap, ms: Date.now() - started } }
}

// ── offline self-test ───────────────────────────────────────────────────────────────────────
// Run with:  npx tsx lib/lex/stream-batch.ts --self-test
async function selftest() {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const cases: Array<[string, boolean]> = []

  // order preserved
  const a = await mapWithLimit([30, 10, 20, 5], 2, async (ms, i) => { await sleep(ms); return i })
  cases.push(['⚠ output order follows INPUT order, not completion order',
    JSON.stringify(a.results) === JSON.stringify([0, 1, 2, 3])])
  cases.push(['the cap is respected', a.stats.maxInFlight <= 2])
  cases.push(['and it is OBSERVED, not copied from the config', a.stats.maxInFlight === 2])

  // a cap larger than the work list does not invent workers
  const b = await mapWithLimit([1, 2], 8, async (ms) => { await sleep(ms); return ms })
  cases.push(['a cap larger than the task list does not exceed the task count', b.stats.maxInFlight <= 2])

  // ⚠ concurrency really is limited — a serial run of 4×40ms takes ≥160ms, a 2-wide run ~80ms
  const t0 = Date.now()
  await mapWithLimit([40, 40, 40, 40], 2, async (ms) => { await sleep(ms); return ms })
  const twoWide = Date.now() - t0
  const t1 = Date.now()
  await mapWithLimit([40, 40, 40, 40], 4, async (ms) => { await sleep(ms); return ms })
  const fourWide = Date.now() - t1
  cases.push([`⚠ a narrower cap really is slower (2-wide ${twoWide}ms > 4-wide ${fourWide}ms) — the limiter is not a no-op`,
    twoWide > fourWide])

  // a rejection propagates rather than becoming an empty result
  let threw = false
  try {
    await mapWithLimit([1, 2, 3], 2, async (n) => { if (n === 2) throw new Error('stream down'); return n })
  } catch { threw = true }
  cases.push(['⚠ a failed stream REJECTS rather than returning nothing — "down" must not read as "empty"', threw])

  // empty input
  const e = await mapWithLimit([], 3, async () => 1)
  cases.push(['an empty task list is fine', e.results.length === 0 && e.stats.tasks === 0])

  let bad = 0
  for (const [n, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}
if (require.main === module && process.argv.includes('--self-test')) void selftest()
