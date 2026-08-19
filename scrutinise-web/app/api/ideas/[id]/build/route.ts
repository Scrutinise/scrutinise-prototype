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
import { buildState, claimBuild, runNextPass, BuildAlreadyRunning, ElicitationNotConfirmed } from '@/lib/lex/build'
import { DEFAULT_FRAMING, isFraming, isBuildPassKey } from '@/lib/lex/build-config'

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

  // ── CONTINUE an existing build (25-B §1) ─────────────────────────────────
  if (continuing) {
    if (!isBuildPassKey(parsed.data.pass!)) {
      return NextResponse.json({ error: `Unknown pass "${parsed.data.pass}"` }, { status: 422 })
    }
    const state = await buildState(id)
    const latest = state.latest
    // Nothing to continue. NOT an error — a poll racing the last pass's own completion
    // is the ordinary case, and 409ing it would put a red banner on a finished build.
    if (!latest || (latest.status !== 'RUNNING' && latest.status !== 'QUEUED') || !latest.nextPass) {
      return NextResponse.json(state)
    }
    await runNextPass(id, authz.idea.creatorId, latest.id)
    return NextResponse.json(await buildState(id))
  }

  // ── START a build ────────────────────────────────────────────────────────
  let buildId: string
  try {
    buildId = await claimBuild(id, framing)
  } catch (err) {
    if (err instanceof BuildAlreadyRunning) {
      return NextResponse.json({ error: err.message, state: await buildState(id) }, { status: 409 })
    }
    if (err instanceof ElicitationNotConfirmed) {
      return NextResponse.json({ error: err.message, state: await buildState(id) }, { status: 409 })
    }
    throw err
  }

  // Awaited on purpose. Returning early and letting the promise run on is how work gets
  // silently killed when the response ends — and a build that dies unrecorded is exactly
  // the failure this feature exists to make impossible. The client polls GET regardless,
  // so a platform timeout on this request costs the response, not the record.
  //
  // 25-B: this runs the FIRST pass only. The client's next poll carries `nextPass` and it
  // POSTs back to continue — see the header.
  await runNextPass(id, authz.idea.creatorId, buildId)

  return NextResponse.json(await buildState(id))
}
