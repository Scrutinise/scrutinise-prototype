// 26-T2 §6 — THE ONE ROUTE BEHIND A COMMENT THREAD ON AN ACTION. Reading is `GET ?actionId=`; adding a comment and replying go through the
// notebook route (a comment IS a note bearing on the action: same rules, one system). The only thing here that is new is the summary, which Lex
// writes ON REQUEST, shows, and stores nowhere. Owner or collaborator (authorizeIdea). Rejections are worded (CLAUDE.md §30).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { describeIssues } from '@/lib/api-rejection'
import { readThread, summariseThread } from '@/lib/lex/action-thread'

export const maxDuration = 60
type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const actionId = new URL(req.url).searchParams.get('actionId')
  if (!actionId) return NextResponse.json({ error: 'Which action? “actionId” was missing, so no thread was read.' }, { status: 422 })
  const r = await readThread(id, { id: authz.user.id, isOwner: authz.idea.creatorId === authz.user.id }, actionId)
  return r.ok ? NextResponse.json({ ...r.data, viewer: { id: authz.user.id, isOwner: authz.idea.creatorId === authz.user.id } }) : NextResponse.json({ error: (r as { error: string }).error }, { status: 404 })
}

const Body = z.object({ op: z.literal('summarise'), actionId: z.string().min(1) })

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea)
  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'That control sent something the server could not read at all (the body was not JSON). Nothing was changed.' }, { status: 400 }) }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    const { message, rejected } = describeIssues(parsed.error.issues, { action: '“Ask Lex to summarise”', labels: { op: 'the control', actionId: 'the action' } })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  const r = await summariseThread(id, authz.user.id, { id: authz.user.id, isOwner: authz.idea.creatorId === authz.user.id }, parsed.data.actionId)
  return r.ok ? NextResponse.json({ ok: true, result: r.data, error: null }) : NextResponse.json({ ok: false, result: null, error: (r as { error: string }).error }, { status: 422 })
}
