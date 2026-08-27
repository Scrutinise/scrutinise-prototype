/**
 * check-fts-cancel.ts — S16 §1. DOES `fts-serve` STILL EXECUTE WORK WHOSE CALLER HAS GONE?
 *
 * The dense twin of this (`check-vector-cancel.ts`) was watched failing against the real broken
 * build before it was watched passing: 12 of 12 abandoned requests were executed after every client
 * was killed, and recovery took 19 seconds. `fts-serve` had the same defect and, unlike the dense
 * service, **an unbounded queue to accumulate it in** — and it runs on every query.
 *
 * ⚠ THE MEASUREMENT IS THE SERVICE'S OWN COUNTERS, NOT A LATENCY. `served` increments whether or
 * not anyone is still on the socket, and `abandoned` counts work that was never begun. A latency
 * could not distinguish "the queue drained" from "the queue was thrown away", which is the whole
 * question.
 *
 * ⚠ THIS BUILD CANNOT SHOW THE FAILING SIDE, AND THAT IS STATED RATHER THAN GLOSSED. The broken
 * `fts-serve` build is gone — the fix deployed with the same push that added this file. The
 * two-sided evidence for this defect class is `check-vector-cancel.ts`'s, taken against the real
 * unfixed dense service (SEARCH_S15_REPORT §2). What this asserts is that `fts-serve` now behaves
 * the way the dense service does AFTER its fix, and it fails loudly if it does not.
 *
 * Usage:
 *   tsx search/check-fts-cancel.ts [--n=40] [--abort-after=1200]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const BASE = (process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production-4cea.up.railway.app').replace(/\/$/, '')
const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const N = parseInt(arg('n', '40'), 10)
const ABORT_AFTER_MS = parseInt(arg('abort-after', '1200'), 10)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const stats = async () => await (await fetch(`${BASE}/stats`)).json() as any

async function main() {
  console.log(`── check-fts-cancel ── ${BASE}`)
  const before = await stats()
  console.log(`  build ${before.build ?? '(no marker)'}`)
  if (before.build !== 'S16-fts-cancel-bounded') {
    console.error('  ⛔ the running service does not carry the S16 build.')
    process.exit(1)
  }
  const W = before.concurrency.max
  console.log(`  ${W} wide · queue cap ${before.concurrency.maxQueue}`)
  console.log(`  baseline served=${before.served} abandoned=${before.concurrency.abandoned} rejections=${before.concurrency.rejections}`)
  for (let i = 0; i < 60 && (before.concurrency.inFlight || before.concurrency.queued); i++) await sleep(2000)

  console.log(`\n  firing ${N} requests, aborting every client at ${ABORT_AFTER_MS} ms…`)
  const ctrls: AbortController[] = []
  const outcomes: string[] = []
  const t0 = Date.now()
  const flights = Array.from({ length: N }, (_, i) => (async () => {
    const ctrl = new AbortController()
    ctrls.push(ctrl)
    try {
      const res = await fetch(`${BASE}/fts-search`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: `abandoned work probe ${i} statutory duty compensation notice`, tier: 'legislation', limit: 60 }),
        signal: ctrl.signal,
      })
      outcomes.push(res.status === 503 ? 'shed' : 'completed')
      await res.text()
    } catch (e) {
      outcomes.push(/abort/i.test((e as Error).message) || (e as Error).name === 'AbortError' ? 'aborted' : 'error')
    }
  })())
  await sleep(ABORT_AFTER_MS)
  for (const c of ctrls) c.abort()
  const killedAt = Date.now()
  await Promise.all(flights)
  const completedFirst = outcomes.filter((o) => o === 'completed').length
  const shed = outcomes.filter((o) => o === 'shed').length
  console.log(`  every client killed at t+${killedAt - t0} ms — ${outcomes.filter((o) => o === 'aborted').length} aborted, ${completedFirst} completed first, ${shed} shed`)

  // ⚠ A request that finished before the abort was never abandoned; counting it would flatter the
  // result. The run is void rather than optimistic.
  if (completedFirst > 0) {
    console.log(`  ⚠⚠ VOID: ${completedFirst} completed before the abort. Re-run with a smaller --abort-after.`)
    process.exit(2)
  }

  console.log('\n  polling /stats until idle…')
  let last = before
  let idleAt: number | null = null
  for (let i = 0; i < 100; i++) {
    await sleep(3000)
    last = await stats()
    console.log(`    t+${String(Math.round((Date.now() - killedAt) / 1000)).padStart(4)}s · served +${last.served - before.served} · abandoned +${last.concurrency.abandoned - before.concurrency.abandoned} · inFlight ${last.concurrency.inFlight} · queued ${last.concurrency.queued}`)
    if (!last.concurrency.inFlight && !last.concurrency.queued) { idleAt = Date.now(); break }
  }

  const servedDelta = last.served - before.served
  const abandonedDelta = last.concurrency.abandoned - before.concurrency.abandoned
  const live = N - shed
  console.log('\n  RESULT')
  console.log(`    abandoned by their clients   ${live}${shed ? ` (+${shed} shed, not abandoned)` : ''}`)
  console.log(`    served AFTER the kill        +${servedDelta}`)
  console.log(`    counted as abandoned         +${abandonedDelta}`)
  console.log(`    recovery to idle             ${idleAt ? `${Math.round((idleAt - killedAt) / 1000)}s` : 'NOT REACHED'}`)

  let failed = 0
  const ok = (l: string, c: boolean, d = '') => { if (c) console.log(`  ✅ ${l}${d ? `  — ${d}` : ''}`); else { failed++; console.log(`  ❌ ${l}${d ? `  — ${d}` : ''}`) } }
  console.log('')
  ok('unstarted work is NOT executed for callers who have gone', servedDelta <= W,
    `served +${servedDelta}, at most ${W} could already have been running`)
  ok('and the service SAYS how much it declined', abandonedDelta > 0,
    `abandoned +${abandonedDelta} of ${live}`)
  ok('the queue reaches zero promptly', idleAt !== null,
    idleAt ? `${Math.round((idleAt - killedAt) / 1000)}s after the last client died` : 'still busy')
  console.log(`\n${3 - failed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}
main().catch((e) => { console.error('FAILED', e instanceof Error ? e.message : e); process.exit(1) })
