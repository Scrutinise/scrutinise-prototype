// 26-R — THE RESEARCH NOTEBOOK ROUTE. GET lists (the user's own notes by default; Lex's findings on request); POST runs one op.
// Every op calls `lib/lex/research-notes.ts`, the same functions Lex's tools call, so the screen and the chat cannot drift.
// Owner or collaborator (authorizeIdea). Nothing here deletes a note. Rejections are worded (CLAUDE.md §30).

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { describeIssues } from '@/lib/api-rejection'
import { NotebookBody, OP_WORDS, INPUT_WORDS, type NotebookOp } from '@/lib/lex/research-notebook-schema'
import * as N from '@/lib/lex/research-notes'

export const maxDuration = 120
type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const url = new URL(req.url)
  const viewer: N.Viewer = { id: authz.user.id, isOwner: authz.idea.creatorId === authz.user.id }
  const data = await N.readNotebook(id, viewer, {
    includeLex: url.searchParams.get('lex') === '1',
    includeSetAside: url.searchParams.get('setAside') === '1',
  })
  return NextResponse.json({
    ...data, viewer: { id: viewer.id, isOwner: viewer.isOwner },
    ...(url.searchParams.get('options') === '1' ? { bearsOnOptions: await N.bearsOnOptions(id) } : {}),
  })
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea)

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'That control sent something the server could not read at all (the body was not JSON). Nothing was changed.' }, { status: 400 }) }
  const parsed = NotebookBody.safeParse(raw)
  if (!parsed.success) {
    const op = (raw as { op?: unknown } | null)?.op
    const action = typeof op === 'string' && op in OP_WORDS ? OP_WORDS[op as NotebookOp] : 'That action'
    const { message, rejected } = describeIssues(parsed.error.issues, { action, labels: INPUT_WORDS })
    console.warn('[research-notebook] rejected', { op, rejected })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  const b = parsed.data
  const user = authz.user
  const viewer: N.Viewer = { id: user.id, isOwner: authz.idea.creatorId === user.id }
  const ownerId = authz.idea.creatorId

  let result: N.Result<unknown>
  try {
    switch (b.op) {
      case 'addNote': result = await N.addNote(id, user, viewer, b); break
      case 'updateNote': result = await N.updateNote(id, viewer, b); break
      case 'setStance': result = await N.setStance(id, viewer, b.noteIds, b.stance); break
      case 'addTags': result = await N.addTags(id, viewer, b.noteIds, b.tags); break
      case 'setHeading': result = await N.setHeading(id, viewer, b.noteIds, b.heading); break
      case 'setAside': result = await N.setAside(id, viewer, user.id, b.noteIds, b.reason); break
      case 'restore': result = await N.restore(id, viewer, ownerId, b.noteIds); break
      case 'putInRecord': result = await N.putInRecord(id, viewer, b.noteIds); break
      case 'reply': result = await N.reply(id, viewer, b.noteId, b.text); break
      case 'share': result = await N.share(id, viewer, b.noteIds); break
      case 'makeMineOnly': result = await N.makeMineOnly(id, viewer, b.noteIds); break
    }
  } catch (err) {
    console.error('[research-notebook] failed', b.op, err)
    return NextResponse.json({ error: `${OP_WORDS[b.op]} did not work: ${err instanceof Error ? err.message.slice(0, 200) : 'unknown error'}. Nothing was changed.` }, { status: 500 })
  }
  if (!result.ok) return NextResponse.json({ ok: false, result: null, error: (result as { error: string }).error }, { status: 422 })
  return NextResponse.json({ ok: true, result: result.data, error: null })
}
