// SPRINT 25-A §1 — the elicitation endpoint.
//
// GET  → the whole elicitation state for one idea (the client renders whatever step the
//        server says is current; it never decides that for itself — §3.4).
// POST → one of three actions:
//          answer  — store one exchange's answer, apply the problem gate to the first
//          confirm — "That's right — build it" (§1c). Does NOT start the build.
//          correct — "Not quite — let me correct you". Re-runs the CONFIRMATION only.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import {
  elicitationState, answerStep, confirmElicitation, correctElicitation, retryUnderstanding,
  ElicitationClosed,
} from '@/lib/lex/elicitation'
import { buildState } from '@/lib/lex/build'
import { ELICITATION_STEPS } from '@/lib/lex/elicitation-config'

type Params = { params: Promise<{ id: string }> }

// The confirmation paragraph is one model call; 60s is ample and matches the platform's
// default for the rest of the Lex routes.
export const maxDuration = 60

const STEP_KEYS = ELICITATION_STEPS.map((s) => s.key) as [string, ...string[]]

const BodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('answer'),
    step: z.enum(STEP_KEYS),
    text: z.string().max(20_000).optional(),
    goalKind: z.string().max(64).optional(),
    ruledOut: z.string().max(5_000).optional(),
    readingUrl: z.string().max(2_000).optional(),
    readingFileName: z.string().max(512).optional(),
    skip: z.boolean().optional(),
  }),
  z.object({ action: z.literal('confirm') }),
  z.object({ action: z.literal('correct'), text: z.string().max(5_000).optional() }),
  // 25-E §1 — the paragraph failed to write; try again. NOT a correction: it must not
  // count against the user or put words in their mouth. See `retryUnderstanding`.
  z.object({ action: z.literal('retry') }),
])

/**
 * 25-E §1 — EVERY MUTATION RETURNS THE BUILD STATE TOO.
 *
 * ⚠⚠ THIS IS THE FIX FOR THE DEFECT THAT STOPPED THE WHOLE PRODUCT. The client held two
 * objects — the elicitation and the build — and refreshed only the first after confirming.
 * So the instant the user pressed "That's right — build it": the confirmation buttons
 * disappeared (the elicitation was now CONFIRMED), the build card appeared (same reason),
 * and it appeared GREYED OUT beside `blockedReason` from the boot-time fetch, which read
 * *"Confirm what I've understood first"* — telling the user to do the thing they had just
 * done, with no control left on the page to do it with.
 *
 * `canStart` is computed from `isConfirmed(ideaId)`, so it was never wrong; it was STALE.
 * Returning both halves of the answer from the one request that changed either is what makes
 * a stale half impossible, rather than making the client responsible for remembering to ask
 * again — which is the thing it forgot.
 */
async function bothStates(ideaId: string, userId: string) {
  const [state, build] = await Promise.all([
    elicitationState(ideaId, userId),
    // ⚠ Never allowed to take the response down. If the build half cannot be read the
    // elicitation half is still true, and `null` tells the client to go and ask rather than
    // to keep what it has.
    buildState(ideaId).catch((err) => {
      console.error('[elicitation] build state unreadable alongside the elicitation:', err)
      return null
    }),
  ])
  return { state, build }
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  return NextResponse.json(await elicitationState(id, authz.idea.creatorId))
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const userId = authz.idea.creatorId

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  try {
    if (parsed.data.action === 'confirm') {
      await confirmElicitation(id, userId)
      return NextResponse.json({ ...(await bothStates(id, userId)), messages: [] })
    }
    if (parsed.data.action === 'correct') {
      await correctElicitation(id, userId, parsed.data.text ?? '')
      return NextResponse.json({ ...(await bothStates(id, userId)), messages: [] })
    }
    if (parsed.data.action === 'retry') {
      await retryUnderstanding(id, userId)
      return NextResponse.json({ ...(await bothStates(id, userId)), messages: [] })
    }
    const { state, messages } = await answerStep(id, userId, {
      step: parsed.data.step as never,
      text: parsed.data.text,
      goalKind: parsed.data.goalKind,
      ruledOut: parsed.data.ruledOut,
      readingUrl: parsed.data.readingUrl,
      readingFileName: parsed.data.readingFileName,
      skip: parsed.data.skip,
    })
    // The answer path returns the build half as well, for the same reason: answering the
    // last question is what moves the elicitation to AWAITING_CONFIRMATION, and a client
    // holding a stale build alongside a fresh elicitation is the whole defect.
    const build = await buildState(id).catch(() => null)
    return NextResponse.json({ state, build, messages })
  } catch (err) {
    if (err instanceof ElicitationClosed) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    // A validation message from the engine ("Choose what you want to happen.") is meant
    // for the user, so it is returned rather than flattened into a 500.
    const message = err instanceof Error ? err.message : 'Something went wrong'
    console.error('[elicitation] failed:', message)
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
