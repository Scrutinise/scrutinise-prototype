// ─────────────────────────────────────────────────────────────────────────────
// AMENDMENT_25B §B — THE BUILD WORKER. Builds run here, not in a Vercel request.
//
// Charlie's decision and the reason for it: "A ten-minute job should not depend on a
// browser tab staying open. The user starts a build, closes the laptop, and comes back to
// a finished proposal."
//
// The web app enqueues an `IdeaBuild` row at QUEUED and returns in milliseconds. This
// process claims it, runs every pass to completion, and settles the row. Nothing about
// the client changes: the status is still read from the row, so the existing polling and
// progress display work unaltered — the client does not know or care where the work
// happens.
//
// ⚠ WHY THIS LIVES IN `scrutinise-web/scripts` RATHER THAN `scripts/ingest`. The build
// engine is `lib/lex/*` — the gateway, the field machine, the Prisma client, the whole
// Deepening. `scripts/ingest` CANNOT import any of it (SEARCH S7 §3 hit exactly this and
// had to report a measurement it could not take because of it). Running the worker from
// inside the web package is what makes "the same engine, a different driver" true rather
// than aspirational, and it is why there is no second implementation of a build.
//
// ⚠ CONCURRENCY IS DELIBERATELY ONE. §B: "A build fires 10–20 searches and the vector
// service handles four at once. One build must not saturate the search layer for
// everyone." A build is already serial inside itself — one question at a time, one intent
// at a time — so one build is at most one search in flight. See WORKER_CONCURRENCY.
//
// Railway deployment: root directory `scrutinise-web`, start command
//   npx tsx scripts/build-worker.ts
// Environment: DATABASE_URL, DIRECT_URL, GEMINI_API_KEY, FTS_SEARCH_URL,
//   VECTOR_SEARCH_URL + LEX_VECTOR_STREAMS (to match production retrieval),
//   LEX_BUILD_DRIVER=worker.
//
// Usage locally (this is also how the "close the tab" test is run):
//   npx tsx --env-file=.env scripts/build-worker.ts
//   npx tsx --env-file=.env scripts/build-worker.ts --once   (drain the queue and exit)
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import {
  nextQueuedBuild, claimQueuedBuild, runBuildToCompletion, sweepStalledBuilds,
} from '../lib/lex/build'
import { WORKER_CONCURRENCY, WORKER_IDLE_MS, buildDriver } from '../lib/lex/build-config'

const ONCE = process.argv.includes('--once')

/** A name in the log, so two workers can be told apart. */
const WORKER_ID = `bw-${Math.random().toString(36).slice(2, 8)}`

let stopping = false
let inFlight = 0

/**
 * ⚠ A SIGTERM MUST NOT ABANDON A BUILD MID-PASS.
 *
 * Railway sends SIGTERM on redeploy. Exiting immediately would leave a row at RUNNING
 * with a pass half-done — recoverable (the settle resets a killed pass and the next
 * worker resumes it), but it wastes a pass's spend every deploy. So the flag stops the
 * loop taking NEW work and the current build is allowed to finish.
 */
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    if (stopping) return
    stopping = true
    console.log(`[build-worker ${WORKER_ID}] ${sig} — finishing the build in hand, taking no more`)
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function runOne(): Promise<boolean> {
  const queued = await nextQueuedBuild()
  if (!queued) return false

  // Conditional, and the count is read. Two workers polling the same row must not both
  // start it — the loser simply moves on.
  if (!(await claimQueuedBuild(queued.id))) {
    console.log(`[build-worker ${WORKER_ID}] lost the claim on ${queued.id} — another worker has it`)
    return true
  }

  const startedAt = Date.now()
  console.log(`[build-worker ${WORKER_ID}] running build ${queued.id} for idea ${queued.ideaId}`)
  inFlight++
  try {
    const view = await runBuildToCompletion(queued.ideaId, queued.userId, queued.id)
    console.log(
      `[build-worker ${WORKER_ID}] ${view.status} · ${view.passesComplete}/${view.passesTotal} passes · ` +
      `${Math.round((Date.now() - startedAt) / 1000)}s · ${view.spend.line}`,
    )
  } catch (err) {
    // ⚠ THE ROW MUST NOT BE LEFT AT RUNNING BY A THROW HERE. `runBuildToCompletion`
    // settles its own failures, so reaching this means something outside the engine broke
    // — a lost database connection, most likely. The row is left alone ON PURPOSE: the
    // sweep will reset the killed pass and the next worker RESUMES from the last
    // completed one, which loses a pass rather than the build. Writing FAILED here would
    // throw away work that is still good.
    console.error(`[build-worker ${WORKER_ID}] build ${queued.id} threw outside the engine:`, err)
  } finally {
    inFlight--
  }
  return true
}

async function main() {
  console.log(`[build-worker ${WORKER_ID}] starting · concurrency ${WORKER_CONCURRENCY} · ` +
    `idle ${WORKER_IDLE_MS}ms · driver=${buildDriver()}${ONCE ? ' · --once' : ''}`)

  // ⚠ SAY SO IF THIS WORKER SHOULD NOT BE RUNNING. With LEX_BUILD_DRIVER=client the web
  // app claims and drives its own builds, and nothing will ever reach QUEUED — a worker
  // polling an empty queue for ever looks identical to a worker with nothing to do.
  if (buildDriver() !== 'worker') {
    console.warn(`[build-worker ${WORKER_ID}] ⚠ LEX_BUILD_DRIVER is not "worker" — the web app is ` +
      'driving builds itself, so nothing will ever be enqueued for this process.')
  }

  let idleTicks = 0
  while (!stopping) {
    // Housekeeping first: a build whose worker died is reset to its last completed pass
    // here, which is what makes it visible to the queue again.
    try {
      const swept = await sweepStalledBuilds()
      if (swept) console.warn(`[build-worker ${WORKER_ID}] settled ${swept} abandoned build(s)`)
    } catch (err) {
      console.error(`[build-worker ${WORKER_ID}] sweep failed:`, err instanceof Error ? err.message : err)
    }

    let did = false
    try {
      did = await runOne()
    } catch (err) {
      console.error(`[build-worker ${WORKER_ID}] queue read failed:`, err instanceof Error ? err.message : err)
      await sleep(WORKER_IDLE_MS)
    }

    if (did) { idleTicks = 0; continue }
    if (ONCE) break

    idleTicks++
    // A heartbeat rather than silence: a worker that logs nothing for an hour is
    // indistinguishable from a worker that has died, which is the distinction this
    // codebase keeps having to rebuild.
    if (idleTicks % 60 === 0) {
      console.log(`[build-worker ${WORKER_ID}] idle — ${idleTicks} polls with an empty queue`)
    }
    await sleep(WORKER_IDLE_MS)
  }

  while (inFlight > 0) await sleep(500)
  console.log(`[build-worker ${WORKER_ID}] stopped cleanly`)
  await prisma.$disconnect()
  process.exit(0)
}

main().catch(async (err) => {
  console.error(`[build-worker ${WORKER_ID}] fatal:`, err)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
