// SPRINT 25-D §3 / §25.5 — the right-hand panel, organised by question.
//
// GET → the assembled panel. Pure reads and NO MODEL CALL, so it is cheap enough to poll —
// the same contract the agenda route keeps, for the same reason.
//
// `?field=` is what the user is currently reading (§3 rule 3). It ORDERS and MARKS; it
// never filters, because a finding that contradicts the diagnosis must not become invisible
// the moment the user moves to the next page.

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { buildQuestionPanel } from '@/lib/lex/question-panel'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  const focusFieldRef = new URL(req.url).searchParams.get('field')
  return NextResponse.json(await buildQuestionPanel(id, { focusFieldRef }))
}
