// 26-S §3 — THE ONE ROUTE BEHIND "Import actions from a document". Every op calls `lib/lex/action-import.ts`, the same functions Lex's
// tool calls, so the button and the chat cannot drift. Owner or collaborator (authorizeIdea), exactly as /action-structure.
// Nothing here writes to the Coherent Actions list except `confirm`; `advance` is one unit of model work per call, so each request is
// far inside the function limit and a closed tab loses nothing.

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { ActionImportBody as Body, IMPORT_OP_WORDS, IMPORT_INPUT_WORDS, type ActionImportOp } from '@/lib/lex/action-import-schema'
import { describeIssues } from '@/lib/api-rejection'
import { enterSpendFor } from '@/lib/lex/build-context'
import { assertWritableField } from '@/lib/lex/stage'
import * as I from '@/lib/lex/action-import'

export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const pass = await I.getImport(id)
  // The documents the button can offer (numbered, read, with their length and a measured price), beside the current pass if there is one.
  const importable = new URL(req.url).searchParams.get('importable') === '1' ? await I.listImportable(id) : null
  return NextResponse.json({ pass, importable })
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea)

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'That control sent something the server could not read at all (the body was not JSON). Nothing was changed.' }, { status: 400 }) }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    // CLAUDE.md §30 — a rejection names the input and the reason, in words. Never the flatten() object.
    const op = (raw as { op?: unknown } | null)?.op
    const action = typeof op === 'string' && op in IMPORT_OP_WORDS ? IMPORT_OP_WORDS[op as ActionImportOp] : 'That import'
    const { message, rejected } = describeIssues(parsed.error.issues, { action, labels: IMPORT_INPUT_WORDS })
    console.warn('[action-import] rejected', { op, rejected })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  const b = parsed.data

  if (b.op === 'start' && (await assertWritableField(id, 'actions'))) {
    return NextResponse.json({ error: 'You haven’t started the Coherent Actions yet, so there is nowhere to import to. Nothing was started.' }, { status: 409 })
  }

  const uid = authz.user.id
  try {
    switch (b.op) {
      case 'start': return respond(await I.startImport(id, uid, b.sourceNumber))
      case 'advance': return respond(await I.advanceImport(id, uid, b.passId))
      case 'retryPart': return respond(await I.retryPart(id, b.passId, b.chunkIndex))
      case 'edit': return respond(await I.editImport(id, b.passId, { items: b.items as I.EditInput['items'], existing: b.existing as I.EditInput['existing'], headings: b.headings }))
      case 'confirm': return respond(await I.confirmImport(id, uid, b.passId))
      case 'discard': return respond(await I.discardImport(id, b.passId))
    }
  } catch (err) {
    console.error('[action-import] failed', b.op, err)
    return NextResponse.json({ error: `${IMPORT_OP_WORDS[b.op]} did not work: ${err instanceof Error ? err.message.slice(0, 200) : 'unknown error'}. Nothing further was changed.` }, { status: 500 })
  }
}

function respond(r: I.Result): NextResponse {
  return r.ok
    ? NextResponse.json({ ok: true, result: r.data, error: null })
    : NextResponse.json({ ok: false, result: null, error: (r as { error: string }).error }, { status: 422 })
}
