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
        // Deterministic, platform-owned search trigger (§8.4).
        if (fieldKey === 'keywords') {
          await fireSearchTrigger(id)
          await postSearchPointer(id, idea.aiChatHistory)
        }
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

  const state = await computeCanonicalState(id)
  return NextResponse.json({ state })
}

// Lex's one-line pointer into the chat after the briefing lands (§8.1).
async function postSearchPointer(ideaId: string, history: unknown) {
  const msg: ChatMsg = {
    role: 'lex',
    content:
      "I've pulled an initial background briefing together — what the law says, where Parliament has been, and a few threads worth pulling. It's in the legislation panel on the right.",
    timestamp: new Date().toISOString(),
  }
  const updated: ChatMsg[] = [...(Array.isArray(history) ? (history as ChatMsg[]) : []), msg].slice(-60)
  await prisma.idea.update({ where: { id: ideaId }, data: { aiChatHistory: updated } })
}
