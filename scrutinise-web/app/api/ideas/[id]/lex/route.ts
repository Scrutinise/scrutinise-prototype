import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimit'
import { authorizeIdea } from '@/lib/lex/authz'
import { computeCanonicalState } from '@/lib/lex/state'
import { fieldDef } from '@/lib/lex/page1-config'
import { buildLexSystemPrompt, runLexTurn } from '@/lib/lex/lex-client'
import { setProposal, storeExtracted } from '@/lib/lex/field-machine'
import { validateProposal } from '@/lib/lex/proposal-schema'
import { isContinueIntent, performStageAdvance } from '@/lib/lex/stage'

type Params = { params: Promise<{ id: string }> }

const BodySchema = z.object({ message: z.string().trim().min(1).max(4000) })

type ChatMsg = { role: string; content: string; timestamp?: string; stage?: string }

// POST /api/ideas/[id]/lex — one Lex turn. Lex returns content only; the
// platform validates any proposal and sets state. State never half-advances (§4).
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { user, idea } = authz

  if (!checkRateLimit(`ai:${user.id}`, 50, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Rate limit exceeded — up to 50 messages per hour.' }, { status: 429 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const { message } = parsed.data

  // Current field is whatever the platform says — never the model's choice.
  let pre = await computeCanonicalState(id)
  if (!pre) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── §19-B Task 1: chat-expressed intent to continue advances the STAGE, via the
  // same server-side path as the panel CTA — the platform moves first, then Lex
  // speaks for the new page. Lex is never left conducting a page the state machine
  // has not entered. // Invariant: chat page == state page, always. If they can
  // diverge, the bug will recur somewhere else.
  if (!pre.currentField && pre.nextPage && isContinueIntent(message)) {
    const now = new Date().toISOString()
    const historyWithUser: ChatMsg[] = [
      ...(Array.isArray(idea.aiChatHistory) ? (idea.aiChatHistory as ChatMsg[]) : []),
      { role: 'user', content: message, timestamp: now, stage: pre.stage },
    ].slice(-60)
    await prisma.idea.update({ where: { id }, data: { aiChatHistory: historyWithUser } })

    const { advanced, messages } = await performStageAdvance(id, idea.creatorId, 'chat-assent')
    const state = await computeCanonicalState(id)
    console.log('[lex-diag] lex turn → stage advance', {
      via: 'chat-assent', advanced, currentField: state?.currentField?.key ?? null,
    })
    if (advanced) return NextResponse.json({ chatText: null, messages, state })
    // Advance refused (page not actually complete) — fall through to a normal turn
    // against freshly-read state.
    pre = (await computeCanonicalState(id)) ?? pre
  }

  const current = pre.currentField ? fieldDef(pre.currentField.key) ?? null : null
  // While the current box already holds an unsaved proposal, Lex refines THAT box
  // only and points the user to Save — it must not advance (§13 / Sprint 1.3).
  const awaiting = pre.currentField?.status === 'AWAITING_CONFIRMATION'

  const allAcceptedFields = pre.pages.flatMap((p) => p.fields)
  const acceptedSummary = allAcceptedFields
    .filter((f) => f.status === 'ACCEPTED' && f.value)
    .map((f) => `${f.label}: ${typeof f.value === 'string' ? f.value.slice(0, 80) : JSON.stringify(f.value).slice(0, 120)}`)
    .join(' · ')

  const ideaCount = await prisma.idea.count({ where: { creatorId: idea.creatorId } })
  const systemPrompt = buildLexSystemPrompt({
    preferredName: user.preferredName ?? user.firstName,
    lexMode: user.aiPreferredStyle?.toUpperCase() ?? 'COLLABORATIVE',
    experienceLevel: pre.userProfile.experienceLevel,
    ideaTitle: (allAcceptedFields.find((f) => f.key === 'title')?.value as string | null) ?? idea.title,
    isFirstIdea: ideaCount <= 1,
    currentField: current,
    awaiting,
    // The method block and the transition guard both key off the STATE MACHINE's page.
    activePage: pre.stage,
    nextPageLabel: !current ? pre.nextPage?.label ?? null : null,
    acceptedSummary,
  })

  const history = (Array.isArray(idea.aiChatHistory) ? (idea.aiChatHistory as ChatMsg[]) : [])
    .filter((m) => m.role === 'user' || m.role === 'lex')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }))

  let lex
  try {
    lex = await runLexTurn(systemPrompt, message, history)
  } catch (err) {
    // Per-attempt status/body already logged in runLexTurn; this is the summary.
    const e = err as { kind?: string; status?: number; message?: string }
    console.error('[lex] turn failed (after retries)', { kind: e.kind ?? null, status: e.status ?? null, message: e.message })
    return NextResponse.json({ error: 'Lex unavailable', errorType: e.kind ?? 'api_error' }, { status: 502 })
  }

  // Proposal handling (§4 + §13): act only on a proposal for the CURRENT field
  // (narrative box or Title/Keywords) and only when valid. Otherwise discard —
  // chatText is still shown, state never half-advances. On a valid box proposal
  // the field goes AWAITING_CONFIRMATION and the box renders the tidied text.
  let proposalApplied = false
  if (current && lex.proposal && lex.proposal.fieldKey === current.key) {
    // A1: structured fields carry a valueObject (multi-slot); keywords a list; the rest text.
    const rawValue =
      current.type === 'structured' ? lex.proposal.valueObject
        : current.key === 'keywords' ? lex.proposal.valueList
          : lex.proposal.valueText
    const valid = validateProposal({ fieldKey: current.key, value: rawValue, rationale: lex.proposal.rationale })
    if (valid) {
      await setProposal(id, current.key, { value: valid.value, rationale: valid.rationale })
      proposalApplied = true
    }
  }
  // Diagnostic (Sprint 1.3 Task 1 — log/inspect, bytes before hypotheses). The
  // platform NEVER advances currentField on a /lex turn and only ever sets a
  // proposal for the current field; this records any turn where Lex tried to
  // propose for a different field (so the symptom is visible if it recurs).
  if (lex.proposal && lex.proposal.fieldKey !== current?.key) {
    console.warn('[lex-diag] off-field proposal discarded', {
      currentField: current?.key ?? null,
      currentStatus: pre.currentField?.status ?? null,
      proposedFor: lex.proposal.fieldKey,
    })
  }
  console.log('[lex-diag] lex turn', {
    currentField: current?.key ?? null,
    status: pre.currentField?.status ?? null,
    awaiting,
    proposalApplied,
  })

  // Extracted slots are stored, never carded (§4 extracted).
  if (Object.keys(lex.extracted).length) {
    await storeExtracted(id, idea.creatorId, lex.extracted).catch((e) =>
      console.error('[lex] storeExtracted failed:', e),
    )
  }

  // Persist chat history, each message tagged with the stage it was said in (§19-B
  // Task 3 — the chat's stage dividers must survive a reload).
  const now = new Date().toISOString()
  const updatedHistory: ChatMsg[] = [
    ...(Array.isArray(idea.aiChatHistory) ? (idea.aiChatHistory as ChatMsg[]) : []),
    { role: 'user', content: message, timestamp: now, stage: pre.stage },
    { role: 'lex', content: lex.chatText, timestamp: now, stage: pre.stage },
  ].slice(-60)
  await prisma.idea.update({ where: { id }, data: { aiChatHistory: updatedHistory } })

  const state = await computeCanonicalState(id)
  return NextResponse.json({ chatText: lex.chatText, messages: [], state })
}
