/**
 * check-vector-cancel.ts — DOES `vector-serve` EXECUTE WORK NOBODY IS WAITING FOR?
 *
 * S15 §1.6 and §2. The brief is explicit that this must be proven from the OUTSIDE and
 * watched failing against the real broken build before it is watched passing:
 *
 *   "Does a client disconnect actually leave the work running? Prove it — start a request,
 *    kill the client, and show the work still executing. Do not infer this from the code."
 *
 * ⚠ THE MEASUREMENT IS THE SERVICE'S OWN `served` COUNTER, NOT A LATENCY. A completed
 * request increments `served` whether or not anyone is still on the other end of the
 * socket, so `served` climbing AFTER every client has been killed is direct evidence that
 * abandoned work ran. A latency number could not distinguish "the queue drained" from
 * "the queue was thrown away", which is the whole question.
 *
 * THE EXPERIMENT
 *   1. read /stats                       → baseline served / abandoned / queue state
 *   2. fire N distinct queries at once   → MAX_CONCURRENT start, the rest queue
 *   3. abort every client at T ms        → before any of them could have finished
 *   4. poll /stats until the service is idle, timing the drain
 *   5. servedDelta tells you which build you are on:
 *        servedDelta ≈ N              → abandoned work WAS executed   (the broken state)
 *        servedDelta ≤ MAX_CONCURRENT → only the already-started jobs ran (fixed)
 *
 * ⚠ STEP 3 IS CHECKED, NOT ASSUMED. If any request completed before the abort the run is
 * void and says so — a request that finished was never abandoned, and counting it would
 * flatter whichever build is under test.
 *
 * USAGE
 *   tsx search/check-vector-cancel.ts --expect=executes-abandoned   (the pre-fix state)
 *   tsx search/check-vector-cancel.ts --expect=cancels-abandoned    (after §2)
 *   tsx search/check-vector-cancel.ts                               (report only, no verdict)
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const BASE = (process.env.VECTOR_SEARCH_URL ?? 'https://vector-serve-production.up.railway.app').replace(/\/$/, '')

const arg = (k: string, d?: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.slice(k.length + 3) : d
}
const N = parseInt(arg('n', '12')!, 10)
const ABORT_AFTER_MS = parseInt(arg('abort-after', '2000')!, 10)
const DRAIN_TIMEOUT_MS = parseInt(arg('drain-timeout', '600000')!, 10)
const EXPECT = arg('expect') as 'executes-abandoned' | 'cancels-abandoned' | undefined

// Distinct queries so nothing coalesces onto anything else: a coalesced request never takes
// a semaphore slot, so a repeated query would quietly shrink N and understate the result.
// `noCache: true` on top of that, belt and braces.
const TIERS = ['legislation', 'caselaw', 'guidance']
function queries(n: number): Array<{ query: string; tier: string }> {
  const stems = [
    'statutory duty owed to a neighbouring occupier',
    'penalty for late filing of accounts',
    'when consent may be withdrawn after the event',
    'compensation for compulsory acquisition of land',
    'the standard of proof in professional discipline',
    'liability of a parent company for a subsidiary',
    'notice periods for termination of a tenancy',
    'restrictions on the export of cultural objects',
    'appeals against a refusal of planning permission',
    'the duty to consult before closing a service',
    'recovery of overpaid benefit',
    'powers of entry without a warrant',
    'the meaning of reasonable adjustments',
    'time limits for judicial review',
    'disclosure of information held by a regulator',
    'the test for unfair dismissal',
  ]
  return Array.from({ length: n }, (_, i) => ({
    // The index is folded into the text as well as taken from the list, so n > stems.length
    // still produces distinct cache keys rather than silently repeating.
    query: `${stems[i % stems.length]} ${i}`,
    tier: TIERS[i % TIERS.length],
  }))
}

interface Stats {
  served: number; errors: number
  warm_n: number; warm_p50_ms: number | null; warm_p95_ms: number | null
  concurrency: { max: number; maxQueue: number; inFlight: number; queued: number; queueHighWaterMark: number; rejections: number; abandoned?: number }
  uptime_s: number; started_at: string
}
async function stats(): Promise<Stats> {
  const res = await fetch(`${BASE}/stats`)
  if (!res.ok) throw new Error(`/stats → ${res.status}`)
  return await res.json() as Stats
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log(`── check-vector-cancel ── ${BASE}`)
  const before = await stats()
  const MAXC = before.concurrency.max
  console.log(`  build      started_at ${before.started_at} (up ${before.uptime_s}s)`)
  console.log(`  service    ${MAXC} wide · queue cap ${before.concurrency.maxQueue}`)
  console.log(`  baseline   served=${before.served} errors=${before.errors} inFlight=${before.concurrency.inFlight} queued=${before.concurrency.queued} rejections=${before.concurrency.rejections} abandoned=${before.concurrency.abandoned ?? '(not reported by this build)'}`)
  if (before.concurrency.inFlight || before.concurrency.queued) {
    console.log('  ⚠ the service is NOT idle — the drain measurement below will include somebody else\'s work.')
  }

  console.log(`\n  firing ${N} distinct requests, aborting every client at ${ABORT_AFTER_MS} ms…`)
  const ctrls: AbortController[] = []
  const outcomes: Array<'completed' | 'aborted' | 'shed' | 'error'> = []
  const t0 = Date.now()
  const flights = queries(N).map(async ({ query, tier }) => {
    const ctrl = new AbortController()
    ctrls.push(ctrl)
    try {
      const res = await fetch(`${BASE}/vector-search`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, tier, limit: 60, noCache: true }), signal: ctrl.signal,
      })
      // 503 is the bounded queue refusing — a shed is not an abandonment and must not be
      // counted as one. §3 makes this reachable; before §3 it needs a full 64-deep queue.
      outcomes.push(res.status === 503 ? 'shed' : 'completed')
      await res.text()
    } catch (e) {
      outcomes.push((e as Error).name === 'AbortError' || /abort/i.test((e as Error).message) ? 'aborted' : 'error')
    }
  })
  await sleep(ABORT_AFTER_MS)
  for (const c of ctrls) c.abort()
  const killedAt = Date.now()
  await Promise.all(flights)
  console.log(`  every client killed at t+${killedAt - t0} ms — ${outcomes.filter((o) => o === 'aborted').length} aborted, ` +
    `${outcomes.filter((o) => o === 'completed').length} completed first, ${outcomes.filter((o) => o === 'shed').length} shed, ${outcomes.filter((o) => o === 'error').length} errored`)

  const completedBeforeAbort = outcomes.filter((o) => o === 'completed').length
  const shed = outcomes.filter((o) => o === 'shed').length
  if (completedBeforeAbort > 0) {
    console.log(`  ⚠⚠ VOID: ${completedBeforeAbort} request(s) completed before the abort, so they were never abandoned.`)
    console.log(`     Re-run with a smaller --abort-after (service p50 is seconds, so this should not happen).`)
    process.exit(2)
  }

  console.log('\n  polling /stats until idle…')
  let last: Stats = before
  let idleAt: number | null = null
  const pollStart = Date.now()
  while (Date.now() - pollStart < DRAIN_TIMEOUT_MS) {
    await sleep(3_000)
    last = await stats()
    const d = last.served - before.served
    const el = Math.round((Date.now() - killedAt) / 1000)
    console.log(`    t+${String(el).padStart(4)}s after the last client died · served +${d} · inFlight ${last.concurrency.inFlight} · queued ${last.concurrency.queued} · warm_p95 ${last.warm_p95_ms} ms`)
    if (last.concurrency.inFlight === 0 && last.concurrency.queued === 0) { idleAt = Date.now(); break }
  }

  const servedDelta = last.served - before.served
  const abandonedDelta = (last.concurrency.abandoned ?? 0) - (before.concurrency.abandoned ?? 0)
  const recoverySec = idleAt ? Math.round((idleAt - killedAt) / 1000) : null

  console.log('\n  RESULT')
  console.log(`    requests abandoned     ${N - shed}${shed ? ` (+${shed} shed by the bounded queue, not abandoned)` : ''}`)
  console.log(`    served AFTER the kill  +${servedDelta}`)
  console.log(`    counted as abandoned   ${last.concurrency.abandoned === undefined ? '(build does not report it)' : `+${abandonedDelta}`}`)
  console.log(`    recovery to idle       ${recoverySec === null ? `NOT REACHED in ${Math.round(DRAIN_TIMEOUT_MS / 1000)}s` : `${recoverySec}s`}`)
  console.log(`    warm_p95 now           ${last.warm_p95_ms} ms  (was ${before.warm_p95_ms} ms)`)

  const verdict: 'executes-abandoned' | 'cancels-abandoned' | 'ambiguous' =
    servedDelta >= (N - shed) - 1 ? 'executes-abandoned'
      : servedDelta <= MAXC ? 'cancels-abandoned'
        : 'ambiguous'
  console.log(`    verdict                ${verdict}`)
  if (verdict === 'executes-abandoned') {
    console.log(`    → the service ran ${servedDelta} of ${N - shed} requests whose callers were already gone.`)
  } else if (verdict === 'cancels-abandoned') {
    console.log(`    → only the ${servedDelta} job(s) already running finished; nothing unstarted began. ≤ max (${MAXC}).`)
  } else {
    console.log(`    → between ${MAXC} and ${N - shed}: some queued work started before the cancel flag reached it.`)
  }

  if (!EXPECT) { console.log('\n  (no --expect given — reported, not asserted)'); return }
  if (verdict === EXPECT) { console.log(`\n  ✅ PASS — expected "${EXPECT}", observed "${verdict}".`); return }
  console.log(`\n  ❌ FAIL — expected "${EXPECT}", observed "${verdict}".`)
  process.exit(1)
}
main().catch((e) => { console.error('FAILED', e instanceof Error ? e.message : e); process.exit(1) })
