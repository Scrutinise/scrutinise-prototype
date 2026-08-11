import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { computeCanonicalState } from '@/lib/lex/state'
import { performStageAdvance, performStageReentry } from '@/lib/lex/stage'

type Params = { params: Promise<{ id: string }> }

// The user explicitly moves the flow into the next Lex page ("Continue to Diagnosis",
// design §14 / Sprint 2 Task 4). Guarded server-side: only forward, only from a
// complete page. Then the conductor seeds the new page's first field.
//
// §19-B Task 1: this route no longer owns the advance — it calls the ONE shared
// path (`performStageAdvance`) that the chat-assent and inline-chat routes also use.
// `via` distinguishes them in `[lex-diag]`, nothing else differs.
//
// §19-D Task 3 adds `goto`: move the working context BACK into a stage the user has
// already reached. Deepening is iterative — the whole point of it is to send the user
// back with new evidence — so the pointer has to move both ways. `advance` is unchanged
// and remains the only way to reach a page for the FIRST time; `goto` can only land on
// a page already reached (`CanonicalPage.reachable`), so nothing is skipped.
const BodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('advance') }),
  z.object({ action: z.literal('goto'), page: z.string().trim().min(1).max(40) }),
])

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { idea } = authz

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 422 })

  if (parsed.data.action === 'goto') {
    const { movedTo, messages } = await performStageReentry(id, idea.creatorId, parsed.data.page)
    if (!movedTo) {
      return NextResponse.json(
        { error: 'You haven’t reached that section yet.' },
        { status: 409 },
      )
    }
    const state = await computeCanonicalState(id)
    console.log('[lex-diag] page goto', { to: movedTo, currentField: state?.currentField?.key ?? null })
    return NextResponse.json({ state, messages })
  }

  const { advanced, messages } = await performStageAdvance(id, idea.creatorId, 'panel-cta')
  if (!advanced) {
    return NextResponse.json({ error: 'Cannot advance yet — finish the current page first.' }, { status: 409 })
  }

  const state = await computeCanonicalState(id)
  console.log('[lex-diag] page advance', { to: advanced, seededField: state?.currentField?.key ?? null })
  return NextResponse.json({ state, messages })
}
