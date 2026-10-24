// LEX 26-V1 — THE ROUTE BEHIND THE DOCUMENTS TREE AND A DOCUMENT OPENED IN PLACE. Owner or collaborator (authorizeIdea), as
// /action-structure. Every op calls lib/lex/action-documents.ts. Nothing here deletes a document or a version.
//
//   GET                       the tree: heading → action → documents → parts, with "needs N: M drafted" and the counts
//   POST { op: 'open' }       one document: every version, every proposal, its parts and sources
//   POST { op: 'view' }       26-V1b §3: the document view — the above, plus each version's instruction, changes and law rows, the waiting proposal
//   POST { op: 'forAction' }  26-V1b §3h: one action's documents, as the record's Documents section lists them
//   POST { op: 'accept' }     accept a document as it stands
//   POST { op: 'addByHand' }  a document of any kind but the generated ones, with its first version
//   POST { op: 'saveText' }   a new version of a hand-written document
//   POST { op: 'setNeeds' }   "needs a document" derived / overridden to nothing / set by hand — with a reason
//   POST { op: 'generate' }   the action's collision report, or the idea's consequential schedule (free: no model call)
//   POST { op: 'draftNote' }  26-V1b §5: Lex drafts the explanatory note as a proposal (spends; the screen asks first, at the measured price)
//   POST { op: 'useProposal' | 'setAsideProposal' }  Lex's proposal on a text document: used as the next version, or set aside (kept)
//   POST { op: 'draftPlan' }   26-V2b §5: what a heading (or one action) needs, each with its MEASURED price — asks nothing, spends nothing
//   POST { op: 'draftQueue' }  26-V2b §5: queue that plan for the worker once the owner agreed the price (re-reckoned; refused if higher)
//   POST { op: 'draftRun' | 'draftStop' }  the run's progress in words; stop its waiting documents (the one drafting now finishes)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { describeIssues } from '@/lib/api-rejection'
import { LIMITS } from '@/lib/lex/input-limits'
import * as D from '@/lib/lex/action-documents'
import { documentView, actionDocuments } from '@/lib/lex/document-view'
import { draftExplanatoryNote } from '@/lib/lex/explanatory-note'
import { planFor, queueDrafting, draftRunView, stopDraftRun, type DraftScope } from '@/lib/lex/document-drafting'

export const maxDuration = 300
type Params = { params: Promise<{ id: string }> }

const KIND = z.enum(D.DOCUMENT_KINDS)
const Body = z.discriminatedUnion('op', [
  z.object({ op: z.literal('open'), documentId: z.string().min(1) }),
  z.object({ op: z.literal('view'), documentId: z.string().min(1) }),
  z.object({ op: z.literal('forAction'), actionId: z.string().min(1) }),
  z.object({ op: z.literal('accept'), documentId: z.string().min(1) }),
  z.object({ op: z.literal('addByHand'), actionId: z.string().min(1), kind: KIND, title: z.string().min(1).max(LIMITS.documentTitle), body: z.string().max(LIMITS.documentText) }),
  z.object({ op: z.literal('saveText'), documentId: z.string().min(1), body: z.string().max(LIMITS.documentText) }),
  z.object({ op: z.literal('setNeeds'), actionId: z.string().min(1), mode: z.enum(['derived', 'nothing', 'set']), kinds: z.array(KIND).max(8).optional(), reason: z.string().max(LIMITS.ruleOutReason).optional() }),
  z.object({ op: z.literal('generate'), what: z.enum(['collision', 'schedule']), actionId: z.string().min(1).optional() }),
  // 26-V1b §5 — the explanatory note: Lex drafts it as a proposal (asks first on the screen); a text proposal is used or set aside.
  z.object({ op: z.literal('draftNote'), actionId: z.string().min(1) }),
  z.object({ op: z.literal('useProposal'), documentId: z.string().min(1) }),
  z.object({ op: z.literal('setAsideProposal'), documentId: z.string().min(1) }),
  // 26-V2b §5 — "Draft what this heading needs" (headingId; null = not under a heading) or "… this action needs" (actionId)
  z.object({ op: z.literal('draftPlan'), headingId: z.string().min(1).nullable().optional(), actionId: z.string().min(1).optional() }),
  z.object({ op: z.literal('draftQueue'), headingId: z.string().min(1).nullable().optional(), actionId: z.string().min(1).optional(), agreedPence: z.number().min(0).max(5000) }),
  z.object({ op: z.literal('draftRun'), runId: z.string().min(1).optional() }),
  z.object({ op: z.literal('draftStop'), runId: z.string().min(1) }),
])
const scopeOf = (b: { headingId?: string | null; actionId?: string }): DraftScope => (b.actionId ? { actionId: b.actionId } : { headingId: b.headingId ?? null })
const OP_WORDS: Record<string, string> = {
  open: 'Opening that document', view: 'Opening that document', forAction: 'Reading that action’s documents', accept: 'Accepting that document', addByHand: 'Adding that document', saveText: 'Saving that document',
  setNeeds: 'Changing what that action needs', generate: 'Generating that document',
  draftNote: '“Draft the explanatory note”', useProposal: 'Using Lex’s proposal', setAsideProposal: 'Setting Lex’s proposal aside',
  draftPlan: 'Listing what needs drafting', draftQueue: 'Starting the drafting', draftRun: 'Reading the drafting run', draftStop: 'Stopping the drafting run',
}
const INPUT_WORDS = { documentId: 'the document', actionId: 'the action', kind: 'the kind of document', title: 'the title', body: 'the text', mode: 'the choice', kinds: 'the kinds of document', reason: 'the reason', what: 'what to generate', headingId: 'the heading', agreedPence: 'the price you agreed', runId: 'the drafting run' }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  // 251: reading the tree also records which generated documents have gone out of date (and clears the mark when they have not).
  return NextResponse.json(await D.documentTree(id, { recordStale: true }))
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'That control sent something the server could not read (the body was not JSON). Nothing was changed.' }, { status: 400 }) }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    const op = (raw as { op?: unknown } | null)?.op
    const { message, rejected } = describeIssues(parsed.error.issues, { action: typeof op === 'string' && OP_WORDS[op] ? OP_WORDS[op] : 'That request', labels: INPUT_WORDS })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  const b = parsed.data
  const uid = authz.user.id
  const author = authz.idea.creatorId === uid ? 'OWNER' as const : 'COLLABORATOR' as const
  let result: { ok: true; data: unknown } | { ok: false; error: string }
  try {
    switch (b.op) {
      case 'open': result = await D.openDocument(id, b.documentId); break
      case 'view': result = await documentView(id, b.documentId); break
      case 'forAction': result = await actionDocuments(id, b.actionId); break
      case 'accept': result = await D.acceptDocument(id, b.documentId); break
      case 'addByHand': result = await D.addDocumentByHand(id, b.actionId, { kind: b.kind, title: b.title, body: b.body }, { userId: uid, author }); break
      case 'saveText': result = await D.saveDocumentText(id, b.documentId, b.body, { userId: uid, author }); break
      case 'setNeeds': result = await D.setNeeds(id, b.actionId, { mode: b.mode, kinds: b.kinds, reason: b.reason }, uid); break
      case 'generate': {
        if (b.what === 'collision') {
          if (!b.actionId) { result = { ok: false, error: 'Say which action’s collision report to generate. Nothing was generated.' }; break }
          result = await D.generateCollisionReport(id, b.actionId)
          // A new collision report changes the schedule; regenerate it where an action holds one (said, never thrown).
          if (result.ok && !(result.data as { unchanged: boolean }).unchanged) {
            const s = await D.generateSchedule(id)
            result = { ok: true, data: { ...(result.data as object), schedule: 'error' in s ? { notGenerated: s.error } : s.data } }
          }
        } else result = await D.generateSchedule(id)
        break
      }
      case 'draftNote': result = await draftExplanatoryNote(id, b.actionId, uid); break
      case 'useProposal': result = await D.useTextProposal(id, b.documentId); break
      case 'setAsideProposal': result = await D.setAsideTextProposal(id, b.documentId); break
      case 'draftPlan': result = await planFor(id, scopeOf(b)); break
      case 'draftQueue': result = await queueDrafting(id, scopeOf(b), uid, b.agreedPence); break
      case 'draftRun': result = { ok: true, data: await draftRunView(id, b.runId) }; break
      case 'draftStop': result = await stopDraftRun(id, b.runId); break
    }
  } catch (err) {
    console.error('[action-documents] failed', b.op, err)
    return NextResponse.json({ error: `${OP_WORDS[b.op]} did not work: ${err instanceof Error ? err.message.slice(0, 200) : 'unknown error'}. Nothing was changed.` }, { status: 500 })
  }
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 422 })
  return NextResponse.json({ ok: true, data: result.data })
}
