// LEX 26-AC part (a) (BRIEF_26AC §3) — SCRUTINY EDITIONS: the route behind the owner's Private Scrutiny page. Every op calls
// lib/lex/scrutiny-edition.ts or lib/lex/scrutiny-linking.ts. Nothing here deletes.
//
//   GET                              the editions, newest first (owner and team: a read)
//   POST { op: 'create' }            "Create scrutiny edition" — OWNER ONLY (§3)
//   POST { op: 'refresh' }           a DRAFT edition re-freezes the idea as it is now
//   POST { op: 'include' | 'blind' } which sections a DRAFT includes; the blind round (369)
//   POST { op: 'addNote' | 'editNote' | 'archiveNote' }   author's notes (374): set aside and restored, never deleted
//   POST { op: 'publish' }           the checklist first; with anything on it, `anyway: true` publishes and the list is recorded
//   POST { op: 'linkEstimate' }      the source-linking exercise's price — spends nothing
//   POST { op: 'linkRun' }           runs it at the price the owner agreed (re-reckoned; refused if higher). Proposals only.
//   POST { op: 'answerLink' | 'addLink' }   accept / reject a proposed link; the owner's own link
//
// ⚠ EVERY WRITE IS THE OWNER'S. An editor or a viewer may read the list (the team sees the workspace, 372) but is refused any write, in
//   words. A published edition refuses every write (lib/lex/scrutiny-edition.ts, and the database's triggers).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { describeIssues } from '@/lib/api-rejection'
import { LIMITS } from '@/lib/lex/input-limits'
import * as S from '@/lib/lex/scrutiny-edition'
import { linkingEstimate, runLinking } from '@/lib/lex/scrutiny-linking'
import { LINK_TARGETS, NOTE_TARGETS } from '@/lib/lex/scrutiny-edition-pure'
import { SCRUTINY_UI } from '@/lib/lex/screen-labels'

export const maxDuration = 300
type Params = { params: Promise<{ id: string }> }

const ED = z.string().min(1).max(64)
const Body = z.discriminatedUnion('op', [
  z.object({ op: z.literal('create') }),
  z.object({ op: z.literal('refresh'), editionId: ED }),
  z.object({ op: z.literal('include'), editionId: ED, hidden: z.array(z.string().max(80)).max(200) }),
  z.object({ op: z.literal('blind'), editionId: ED, blind: z.boolean() }),
  z.object({ op: z.literal('addNote'), editionId: ED, targetKind: z.enum(NOTE_TARGETS), targetId: z.string().max(64).nullable(), body: z.string().max(LIMITS.authorNote + 2000) }),
  z.object({ op: z.literal('editNote'), editionId: ED, noteId: ED, body: z.string().max(LIMITS.authorNote + 2000) }),
  z.object({ op: z.literal('archiveNote'), editionId: ED, noteId: ED, archived: z.boolean() }),
  z.object({ op: z.literal('publish'), editionId: ED, anyway: z.boolean().default(false) }),
  z.object({ op: z.literal('linkEstimate'), editionId: ED }),
  z.object({ op: z.literal('linkRun'), editionId: ED, agreedPence: z.number().min(0).max(5000) }),
  z.object({ op: z.literal('answerLink'), editionId: ED, linkId: ED, answer: z.enum(['ACCEPTED', 'REJECTED', 'PROPOSED']) }),
  z.object({ op: z.literal('addLink'), editionId: ED, targetKind: z.enum(LINK_TARGETS), targetId: z.string().max(64).nullable(), sourceNumber: z.number().int().positive(), claim: z.string().max(400).nullable().optional() }),
])
const OP_WORDS: Record<string, string> = {
  create: 'Creating the edition', refresh: 'Bringing the draft up to date', include: 'Choosing the sections', blind: 'Setting the blind round',
  addNote: 'Adding the note', editNote: 'Saving the note', archiveNote: 'Setting the note aside', publish: 'Publishing', linkEstimate: 'Pricing the exercise',
  linkRun: 'The source-linking exercise', answerLink: 'Answering the link', addLink: 'Linking the source',
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id, 'read')
  if (authz.error) return authz.error
  return NextResponse.json({ editions: await S.listEditions(id), owner: authz.access === 'owner' })
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  if (authz.access !== 'owner') return NextResponse.json({ error: SCRUTINY_UI.ownerOnly }, { status: 403 })
  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'That control sent something the server could not read (the body was not JSON). Nothing was changed.' }, { status: 400 }) }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    const op = (raw as { op?: unknown } | null)?.op
    const { message, rejected } = describeIssues(parsed.error.issues, { action: typeof op === 'string' && OP_WORDS[op] ? OP_WORDS[op] : 'That request' })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  const b = parsed.data
  const uid = authz.user.id
  let result: { ok: true; data: unknown } | { ok: false; error: string }
  try {
    switch (b.op) {
      case 'create': result = await S.createEdition(id, uid); break
      case 'refresh': result = await S.refreshDraft(id, b.editionId, uid); break
      case 'include': result = await S.setInclude(id, b.editionId, b.hidden); break
      case 'blind': result = await S.setBlind(id, b.editionId, b.blind); break
      case 'addNote': result = await S.addNote(id, b.editionId, { targetKind: b.targetKind, targetId: b.targetId, body: b.body }); break
      case 'editNote': result = await S.editNote(id, b.editionId, b.noteId, b.body); break
      case 'archiveNote': result = await S.archiveNote(id, b.editionId, b.noteId, b.archived); break
      case 'publish': result = await S.publishEdition(id, b.editionId, uid, b.anyway); break
      case 'linkEstimate': result = await linkingEstimate(id, b.editionId); break
      case 'linkRun': result = await runLinking(id, b.editionId, uid, b.agreedPence); break
      case 'answerLink': result = await S.answerLink(id, b.editionId, b.linkId, b.answer); break
      case 'addLink': result = await S.addOwnerLink(id, b.editionId, { targetKind: b.targetKind, targetId: b.targetId, sourceNumber: b.sourceNumber, claim: b.claim ?? null }); break
    }
  } catch (e) {
    const m = (e as Error).message ?? ''
    // the database's own guard (prisma/lex_26ac_a.sql) — reached only if the code's check was bypassed; said in the same words
    if (/is published/.test(m)) return NextResponse.json({ error: SCRUTINY_UI.publishedNeverChanges }, { status: 409 })
    throw e
  }
  if (!result.ok) return NextResponse.json({ error: (result as { error: string }).error }, { status: 409 })
  return NextResponse.json({ ok: true, data: result.data })
}
