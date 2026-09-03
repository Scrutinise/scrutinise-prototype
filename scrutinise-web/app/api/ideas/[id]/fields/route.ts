import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorizeIdea } from '@/lib/lex/authz'
import { computeCanonicalState } from '@/lib/lex/state'
import { fieldDef, CHILD_ENTITY_FIELDS } from '@/lib/lex/page1-config'
import { validateFieldValue } from '@/lib/lex/proposal-schema'
import {
  submitBox,
  acceptField,
  skipField,
  reopenField,
  dismissProposal,
  fireSearchTrigger,
} from '@/lib/lex/field-machine'
import { orchestrateAfterWrite } from '@/lib/lex/orchestrator'
import { assertWritableField } from '@/lib/lex/stage'
import { runStageSearch } from '@/lib/lex/stage-search'

type Params = { params: Promise<{ id: string }> }

// Child-entity fields are mutated via their own endpoints, not here:
//   causes/rootCause → /causes · policyOptions/chosenApproach → /policy-options · actions → /actions
// ⚠ The set now lives in page1-config.ts and is imported. It used to be declared privately here,
// and the create client's "Save & exit" — which has to know the same thing — did not have it,
// so it POSTed a child-entity field to this route and took the 422 as a failed save (see
// CHILD_ENTITY_FIELDS for the walk-through that found it).

const BodySchema = z.object({
  fieldKey: z.string().min(1),
  // ⚠ 25-X §1b — `keepMine` is its own action and not a flavour of skip. See dismissProposal.
  action: z.enum(['submitBox', 'accept', 'skip', 'reopen', 'keepMine']),
  // value: a string (narrative/title/challenge), string[] (keywords), or an object
  // (structured fields — whoAffectedImpactCost/legalLandscape). Optional for
  // accept-as-proposed / skip / reopen.
  value: z.union([z.string(), z.array(z.string()), z.record(z.string(), z.string())]).optional(),
})

type ChatMsg = { role: string; content: string; timestamp?: string; stage?: string }

// POST /api/ideas/[id]/fields — server-authoritative field transition (§3.2/§3.4).
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { idea } = authz

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const { fieldKey, action, value } = parsed.data

  const def = fieldDef(fieldKey)
  if (!def) return NextResponse.json({ error: `Unknown fieldKey: ${fieldKey}` }, { status: 422 })
  if (CHILD_ENTITY_FIELDS.has(fieldKey)) {
    return NextResponse.json({ error: `${fieldKey} is managed via its own child-entity endpoint` }, { status: 422 })
  }
  // §19-B Task 1 — the write-side half of "chat page == state page": a field on a
  // page the state machine has not entered cannot be written at all.
  const blocked = await assertWritableField(id, fieldKey)
  if (blocked) {
    return NextResponse.json(
      { error: `${fieldKey} belongs to ${blocked.fieldPage}, which you haven’t started yet.` },
      { status: 409 },
    )
  }

  try {
    switch (action) {
      case 'submitBox': {
        // submitBox is for narrative boxes only (the user authored plain text directly).
        if (def.type !== 'narrative') {
          return NextResponse.json({ error: `${fieldKey} is not a narrative box` }, { status: 422 })
        }
        if (typeof value !== 'string' || !value.trim()) {
          return NextResponse.json({ error: 'value (non-empty string) required' }, { status: 422 })
        }
        await submitBox(id, idea.creatorId, fieldKey, value.trim())
        break
      }
      case 'accept': {
        let edited: unknown = undefined
        if (value !== undefined) {
          edited = validateFieldValue(fieldKey, value)
          if (edited === undefined) {
            return NextResponse.json({ error: 'edited value failed validation' }, { status: 422 })
          }
        }
        await acceptField(id, idea.creatorId, fieldKey, edited)
        break
      }
      case 'skip':
        await skipField(id, fieldKey)
        break
      case 'reopen':
        await reopenField(id, fieldKey)
        break
      // ⚠⚠ 25-X §1b (decision 59) — "keep mine". The user read the build's suggested
      // revision to a field they had already accepted, and declined it. The offer goes; the
      // acceptance and its value are untouched.
      //
      // ⚠ A 409, NOT A SILENT SUCCESS, when there was nothing to dismiss. `dismissProposal`
      // is guarded on ACCEPTED, so a stale tab pressing this on a field the user has since
      // reopened would otherwise get an OK for a write that did not happen — and the screen
      // would show the offer gone until the next poll put it back.
      case 'keepMine': {
        const cleared = await dismissProposal(id, fieldKey)
        if (!cleared) {
          return NextResponse.json(
            { error: 'There is no suggestion to dismiss on that field — it may have changed in another tab.' },
            { status: 409 },
          )
        }
        break
      }
    }
  } catch (err) {
    console.error('[fields] transition failed:', err)
    return NextResponse.json({ error: 'Write failed' }, { status: 500 })
  }

  // Post-write conducting (§13 Task 3): every write produces a next step.
  let messages: string[] = []
  let briefingOk = true
  if (action === 'accept' && fieldKey === 'keywords') {
    // Deterministic, platform-owned search trigger (§8.4). The briefing must exist
    // BEFORE the conductor speaks, because the end-of-page wrap-up (§19-B Task 2)
    // points at it.
    briefingOk = (await fireSearchTrigger(id)).ok
  }
  // §19-C Task 2 — the challenge is the sharpest signal for the legal-landscape
  // search, so accepting it refreshes the Diagnosis stage's results.
  if (action === 'accept' && fieldKey === 'challenge') {
    await runStageSearch(id, 'DIAGNOSIS').catch((e) =>
      console.warn('[lex-diag] landscape refresh failed:', e instanceof Error ? e.message : e))
  }
  // §19-B Task 2: the conductor always runs — on a completed page it posts the
  // wrap-up + transition offer rather than falling silent.
  messages = (await orchestrateAfterWrite(id, idea.creatorId)).messages
  if (!messages.length && action === 'accept' && fieldKey === 'keywords') {
    // Keywords accepted but the page isn't finished (an earlier box is still open):
    // still say what happened — including when the search DIDN'T complete (§19-C 1a).
    const pointer = briefingOk
      ? "I've pulled an initial background briefing together — what the law says, where Parliament has been, and a few threads worth pulling. It's in the legislation panel on the right."
      : "The corpus search didn't complete, so there's no background briefing yet — nothing has been put in the panel. You can retry it there whenever you like; it doesn't block us."
    const state = await computeCanonicalState(id)
    await postLexPointer(id, pointer, state?.stage)
    messages = [pointer]
  }

  const state = await computeCanonicalState(id)
  // Diagnostic (Sprint 1.3 Task 1): currentField advances ONLY here, on a Save
  // (ACCEPTED) or Skip — never on a /lex turn. Logs the resulting current field.
  console.log('[lex-diag] field write', {
    action,
    fieldKey,
    nextField: state?.currentField?.key ?? null,
    nextStatus: state?.currentField?.status ?? null,
  })
  return NextResponse.json({ state, messages })
}

// Append a Lex message to the chat history, tagged with the stage it was said in.
async function postLexPointer(ideaId: string, content: string, stage?: string) {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { aiChatHistory: true } })
  const updated: ChatMsg[] = [
    ...(Array.isArray(idea?.aiChatHistory) ? (idea!.aiChatHistory as ChatMsg[]) : []),
    { role: 'lex', content, timestamp: new Date().toISOString(), stage },
  ].slice(-60)
  await prisma.idea.update({ where: { id: ideaId }, data: { aiChatHistory: updated } })
}
