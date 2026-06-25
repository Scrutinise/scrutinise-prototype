import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorizeIdea } from '@/lib/lex/authz'
import { computeCanonicalState } from '@/lib/lex/state'
import { fieldDef, BOX_KEYS } from '@/lib/lex/page1-config'
import { validateFieldValue } from '@/lib/lex/proposal-schema'
import {
  submitBox,
  acceptField,
  skipField,
  reopenField,
  fireSearchTrigger,
} from '@/lib/lex/field-machine'
import { orchestrateAfterWrite } from '@/lib/lex/orchestrator'

type Params = { params: Promise<{ id: string }> }

const BodySchema = z.object({
  fieldKey: z.string().min(1),
  action: z.enum(['submitBox', 'accept', 'skip', 'reopen']),
  // value: a string (box / title) or string[] (keywords). Optional for accept-as-proposed / skip / reopen.
  value: z.union([z.string(), z.array(z.string())]).optional(),
})

type ChatMsg = { role: string; content: string; timestamp?: string }

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

  try {
    switch (action) {
      case 'submitBox': {
        if (!BOX_KEYS.has(fieldKey)) {
          return NextResponse.json({ error: `${fieldKey} is not a box field` }, { status: 422 })
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
    }
  } catch (err) {
    console.error('[fields] transition failed:', err)
    return NextResponse.json({ error: 'Write failed' }, { status: 500 })
  }

  // Post-write conducting (§13 Task 3): every write produces a next step.
  let messages: string[] = []
  if (action === 'accept' && fieldKey === 'keywords') {
    // Deterministic, platform-owned search trigger (§8.4) + Lex's one-line pointer.
    // Stage advance to DIAGNOSIS is derived in computeCanonicalState once complete.
    await fireSearchTrigger(id)
    const pointer =
      "I've pulled an initial background briefing together — what the law says, where Parliament has been, and a few threads worth pulling. It's in the legislation panel on the right. Next we'll move on to the diagnosis."
    await postLexPointer(id, pointer)
    messages = [pointer]
  } else {
    messages = (await orchestrateAfterWrite(id, idea.creatorId)).messages
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

// Append a Lex message to the chat history.
async function postLexPointer(ideaId: string, content: string) {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { aiChatHistory: true } })
  const updated: ChatMsg[] = [
    ...(Array.isArray(idea?.aiChatHistory) ? (idea!.aiChatHistory as ChatMsg[]) : []),
    { role: 'lex', content, timestamp: new Date().toISOString() },
  ].slice(-60)
  await prisma.idea.update({ where: { id: ideaId }, data: { aiChatHistory: updated } })
}
