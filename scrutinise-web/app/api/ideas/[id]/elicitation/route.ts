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
  elicitationState, answerStep, confirmElicitation, correctElicitation, ElicitationClosed,
} from '@/lib/lex/elicitation'
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
])

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
      return NextResponse.json({ state: await confirmElicitation(id, userId), messages: [] })
    }
    if (parsed.data.action === 'correct') {
      return NextResponse.json({ state: await correctElicitation(id, userId, parsed.data.text ?? ''), messages: [] })
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
    return NextResponse.json({ state, messages })
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
