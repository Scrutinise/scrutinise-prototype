import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { computeCanonicalState } from '@/lib/lex/state'
import { performStageAdvance } from '@/lib/lex/stage'

type Params = { params: Promise<{ id: string }> }

// The user explicitly moves the flow into the next Lex page ("Continue to Diagnosis",
// design §14 / Sprint 2 Task 4). Guarded server-side: only forward, only from a
// complete page. Then the conductor seeds the new page's first field.
//
// §19-B Task 1: this route no longer owns the advance — it calls the ONE shared
// path (`performStageAdvance`) that the chat-assent and inline-chat routes also use.
// `via` distinguishes them in `[lex-diag]`, nothing else differs.
const BodySchema = z.object({ action: z.literal('advance') })

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { idea } = authz

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!BodySchema.safeParse(raw).success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 422 })
  }

  const { advanced, messages } = await performStageAdvance(id, idea.creatorId, 'panel-cta')
  if (!advanced) {
    return NextResponse.json({ error: 'Cannot advance yet — finish the current page first.' }, { status: 409 })
  }

  const state = await computeCanonicalState(id)
  console.log('[lex-diag] page advance', { to: advanced, seededField: state?.currentField?.key ?? null })
  return NextResponse.json({ state, messages })
}
