// POST /api/ideas/[id]/deepening/[passKey]/run — start (or re-run) one Deepening pass.
//
// §2.4: one active run per idea per pass; the pass is CLAIMED in a single conditional
// update so two concurrent POSTs cannot both start it; the gather persists incrementally,
// so a timeout loses the tail rather than the run; a partial run is FAILED with what it
// managed kept. Status is read by polling GET /api/ideas/[id]/deepening.

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { claimPass, runPass, PassAlreadyRunning } from '@/lib/lex/deepening'
import { settleAbandonedRuns } from '@/lib/lex/deepening-settle'
import { isPassKey } from '@/lib/lex/deepening-config'
import { developmentState } from '@/lib/lex/development'

type Params = { params: Promise<{ id: string; passKey: string }> }

// The gather is retrieval + one model call. Minutes are fine here — this is not the
// interactive path (§2.1.4). The engine's own budget (LEX_DEEPENING_BUDGET_MS) stops the
// retrieval loop well inside this, so the run settles itself rather than being killed.
export const maxDuration = 300

export async function POST(_req: Request, { params }: Params) {
  const { id, passKey } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea) // cost dashboard: attribute this request's spend

  if (!isPassKey(passKey)) {
    return NextResponse.json({ error: `Unknown pass: ${passKey}` }, { status: 404 })
  }

  // 26-X decision 317 — THE LOCK. Nothing in the Deepening runs until every live action is accepted or needs no draft, unless the owner
  // has overridden the lock with a reason. Refused in words, with the count, before anything is claimed or spent.
  const dev = await developmentState(id)
  if (!dev.deepeningOpen) {
    return NextResponse.json({
      error: `That Deepening pass was not run. The Deepening opens when every live action is accepted or needs no draft: ${dev.counts.toGo} ${dev.counts.toGo === 1 ? 'action is' : 'actions are'} still to go (Drafting). The owner can open it early with a reason (“Deepen now”). Nothing was run or spent.`,
      locked: true, toGo: dev.counts.toGo,
    }, { status: 423 })
  }

  // Clear any run that died without reporting back BEFORE claiming, or an abandoned row
  // would block its own pass for ever with "already running".
  await settleAbandonedRuns(id)

  let runVersion: number
  try {
    runVersion = await claimPass(id, passKey)
  } catch (err) {
    if (err instanceof PassAlreadyRunning) {
      return NextResponse.json({ error: err.message, status: 'RUNNING' }, { status: 409 })
    }
    throw err
  }

  // Awaited on purpose. Returning early and letting the promise run on is how work gets
  // silently killed when the response ends — and a run that dies unrecorded is precisely
  // the failure this feature is supposed to make impossible.
  const outcome = await runPass(id, passKey, runVersion)

  return NextResponse.json(outcome, { status: outcome.status === 'FAILED' ? 200 : 200 })
}
