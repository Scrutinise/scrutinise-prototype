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

type Params = { params: Promise<{ id: string }> }

const BodySchema = z.object({ message: z.string().trim().min(1).max(4000) })

type ChatMsg = { role: string; content: string; timestamp?: string }

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
  const pre = await computeCanonicalState(id)
  if (!pre) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const current = pre.currentField ? fieldDef(pre.currentField.key) ?? null : null

  const acceptedSummary = pre.pages[0].fields
    .filter((f) => f.status === 'ACCEPTED' && f.value)
    .map((f) => `${f.label}: ${typeof f.value === 'string' ? f.value.slice(0, 80) : JSON.stringify(f.value)}`)
    .join(' · ')

  const ideaCount = await prisma.idea.count({ where: { creatorId: idea.creatorId } })
  const systemPrompt = buildLexSystemPrompt({
    preferredName: user.preferredName ?? user.firstName,
    lexMode: user.aiPreferredStyle?.toUpperCase() ?? 'COLLABORATIVE',
    experienceLevel: pre.userProfile.experienceLevel,
    ideaTitle: pre.pages[0].fields.find((f) => f.key === 'title')?.value as string | null ?? idea.title,
    isFirstIdea: ideaCount <= 1,
    currentField: current,
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
    console.error('[lex] turn failed:', err)
    return NextResponse.json({ error: 'Lex unavailable', errorType: 'api_error' }, { status: 502 })
  }

  // Proposal handling (§4): act only when the active field is one Lex proposes,
  // and only when valid. Otherwise discard — chatText still shown, no advance.
  if (current && current.origin === 'proposed' && lex.proposal && lex.proposal.fieldKey === current.key) {
    const rawValue = current.key === 'keywords' ? lex.proposal.valueList : lex.proposal.valueText
    const valid = validateProposal({ fieldKey: current.key, value: rawValue, rationale: lex.proposal.rationale })
    if (valid) {
      await setProposal(id, current.key, { value: valid.value, rationale: valid.rationale })
    }
  }

  // Extracted slots are stored, never carded (§4 extracted).
  if (Object.keys(lex.extracted).length) {
    await storeExtracted(id, idea.creatorId, lex.extracted).catch((e) =>
      console.error('[lex] storeExtracted failed:', e),
    )
  }

  // Persist chat history.
  const now = new Date().toISOString()
  const updatedHistory: ChatMsg[] = [
    ...(Array.isArray(idea.aiChatHistory) ? (idea.aiChatHistory as ChatMsg[]) : []),
    { role: 'user', content: message, timestamp: now },
    { role: 'lex', content: lex.chatText, timestamp: now },
  ].slice(-60)
  await prisma.idea.update({ where: { id }, data: { aiChatHistory: updatedHistory } })

  const state = await computeCanonicalState(id)
  return NextResponse.json({ chatText: lex.chatText, state })
}
