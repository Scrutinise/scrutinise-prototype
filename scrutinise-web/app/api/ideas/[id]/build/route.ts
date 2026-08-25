// SPRINT 25-A §2 / 25-B §1 — the build endpoint.
//
// GET  → the build state (the POLLING surface). It also carries out the lazy settle of
//        a build that never reported back, so a build cannot sit at RUNNING for ever —
//        and since 25-B it RESUMES a pass the platform killed rather than only failing.
// POST → run a pass. Starting and continuing are the SAME endpoint (see below).
//
// ⚠ 25-B §1 — ONE PASS PER REQUEST, AND WHY IT IS THIS ROUTE RATHER THAN A NEW ONE.
//
// 25-B's build cannot fit in one request: ten-odd library questions each retrieving ~100
// candidates and sifting them, plus a revision and an adversarial read, is minutes of
// model time against a `maxDuration` ceiling of 300 seconds that no configuration
// raises. So the client — which already polls this row every three seconds — POSTs again
// each time the poll says another pass is due, and each pass gets its own 300s.
//
// Start and continue are one endpoint because they are one action: "advance this build
// by one pass". A separate /continue route would need its own copy of the auth check,
// the claim and the 409 handling, and the two would drift. The BODY says which is meant:
// `pass` present ⇒ continue the build already running; absent ⇒ claim a new one.
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { buildState, claimBuild, claimQueuedBuild, runNextPass, BuildAlreadyRunning, ElicitationNotConfirmed } from '@/lib/lex/build'
import { DEFAULT_FRAMING, isFraming, isBuildPassKey, buildDriver } from '@/lib/lex/build-config'

type Params = { params: Promise<{ id: string }> }

const BodySchema = z.object({
  /** §3a — which query framing to run. Recorded on the row; no winner is picked in code. */
  framing: z.string().optional(),
  /**
   * 25-B §1 — the pass the CLIENT believes is next, echoed back from its last poll.
   *
   * ⚠ IT IS A CHECK, NOT AN INSTRUCTION. The server decides which pass runs, from the
   * stored log; this value only says which pass the client thought it was asking for. If
   * they disagree the client is working from a stale poll, and the server runs its own
   * answer — a client that could name the pass to run could re-run one that has already
   * completed, which would double-charge and overwrite proposals.
   */
  pass: z.string().optional(),
  /**
   * AMENDMENT_25B §C4 — "email me when it's done", as ticked on the build screen.
   * Absent means the user expressed no preference on this build and their remembered
   * default stands; present also UPDATES that default, which is what "remember the choice
   * per user as a default they can change" means.
   */
  notifyEmail: z.boolean().optional(),
  /**
   * 25-G §1a/§1b — HOW MUCH OF THE BUILD TO RUN.
   *
   * `REUSE` reads the previous build's orientation and research instead of running them
   * (measured: 65% of a build's input tokens and 6.14p of its 33.4p). `FULL` searches
   * again from scratch and is the explicit, separately-offered choice of §1b.
   *
   * ⚠ THE DEFAULT IS `FULL`, and it is the safe direction rather than the cheap one. An
   * omitted mode means the caller expressed no preference — a first build, an old tab, the
   * worker — and a build that quietly reused a search nobody asked it to reuse would be
   * indistinguishable on screen from one that had searched. The screen asks; the engine
   * does not guess.
   */
  mode: z.enum(['FULL', 'REUSE']).optional(),
})

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  return NextResponse.json(await buildState(id))
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  let body: unknown = {}
  try { body = await req.json() } catch { /* an empty body is a valid "start with the default" */ }
  const parsed = BodySchema.safeParse(body ?? {})
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  const framing = isFraming(parsed.data.framing) ? parsed.data.framing : DEFAULT_FRAMING
  const continuing = !!parsed.data.pass

  // ── CONTINUE an existing build — THE FALLBACK PATH ONLY ──────────────────
  //
  // ⚠ AMENDMENT_25B §B: with the worker driving, a continue request is a client acting on
  // a stale belief and must be refused rather than obeyed. Running the pass anyway would
  // race the worker through the same pass — two claims, and whichever lost would waste a
  // model call. `buildState.nextPass` is already null under the worker, so a current
  // client never sends this; refusing it is what protects against an old tab.
  if (continuing) {
    if (!isBuildPassKey(parsed.data.pass!)) {
      return NextResponse.json({ error: `Unknown pass "${parsed.data.pass}"` }, { status: 422 })
    }
    const state = await buildState(id)
    const latest = state.latest
    // Nothing to continue. NOT an error — a poll racing the last pass's own completion
    // is the ordinary case, and 409ing it would put a red banner on a finished build.
    //
    // ⚠ Under the worker driver `nextPass` is null, so a current client never gets here;
    // an OLD tab that does is refused by this same line rather than racing the worker.
    // The exception is `workerLate` — no worker took the build, so the page drives it.
    if (!latest || (latest.status !== 'RUNNING' && latest.status !== 'QUEUED') || !latest.nextPass) {
      return NextResponse.json(state)
    }

    // ⚠ CLAIM IT OFF THE QUEUE FIRST. Driving a build that is still QUEUED would leave it
    // visible to `claimQueuedBuild`, so a worker starting up mid-build would take it too
    // and both would run the same passes. Moving it to RUNNING is what makes the handover
    // one-way — and the claim is conditional, so if a worker got there first this fails
    // and the page simply goes back to polling.
    if (latest.status === 'QUEUED' && !(await claimQueuedBuild(latest.id))) {
      return NextResponse.json(await buildState(id))
    }

    await runNextPass(id, authz.idea.creatorId, latest.id)
    return NextResponse.json(await buildState(id))
  }

  // ── START a build ────────────────────────────────────────────────────────
  let buildId: string
  try {
    buildId = await claimBuild(id, framing, parsed.data.notifyEmail, parsed.data.mode ?? 'FULL')
  } catch (err) {
    if (err instanceof BuildAlreadyRunning) {
      return NextResponse.json({ error: err.message, state: await buildState(id) }, { status: 409 })
    }
    if (err instanceof ElicitationNotConfirmed) {
      return NextResponse.json({ error: err.message, state: await buildState(id) }, { status: 409 })
    }
    throw err
  }

  // ⚠ AMENDMENT_25B §B — ENQUEUE AND RETURN. THE REQUEST RUNS NOTHING.
  //
  // "The web app enqueues it and returns immediately." The row is left at QUEUED, the
  // Railway worker claims it, and this response comes back in milliseconds. That is the
  // whole point of the change: the build no longer depends on this request, this
  // function's time limit, or the browser tab that made it.
  //
  // The client polls the row exactly as before — it does not need to know where the work
  // happens, which is why the progress display needed no change for this.
  if (buildDriver() === 'client') {
    // The fallback: no worker is coming, so this request runs the first pass and the
    // client's poll drives the rest. Awaited on purpose — returning early and letting the
    // promise run on is how work gets silently killed when the response ends.
    await runNextPass(id, authz.idea.creatorId, buildId)
  }

  return NextResponse.json(await buildState(id))
}
