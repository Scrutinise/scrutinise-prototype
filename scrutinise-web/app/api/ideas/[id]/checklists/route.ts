// 26-P ADDENDUM (CCh follow-up) — THE SECTION CHECKLISTS IN THE WORKLIST.
//
// GET   → the checklists showing now for this idea and user, with their ticks and the "N of M checks not yet done" line.
// PATCH → tick or untick ONE check. The key must be one the registry owns (`lib/lex/section-checklists.ts`): this route
//         shares `IdeaWorklistTick` with the worklist, and must not become a way to tick arbitrary keys.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { agentEnabledFor } from '@/lib/lex/agent/flag'
import { buildChecklists } from '@/lib/lex/checklist-state'
import { allCheckKeys } from '@/lib/lex/section-checklists'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea)
  const askLex = agentEnabledFor({ id: authz.user.id, email: authz.user.email })
  return NextResponse.json(await buildChecklists(id, authz.user.id, askLex))
}

const TickSchema = z.object({ itemKey: z.string().min(1).max(200), ticked: z.boolean() })

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea)

  let body: unknown = {}
  try { body = await req.json() } catch { /* falls to the 422 */ }
  const parsed = TickSchema.safeParse(body ?? {})
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })
  const { itemKey, ticked } = parsed.data
  if (!allCheckKeys().includes(itemKey)) return NextResponse.json({ error: `"${itemKey}" is not a checklist item.` }, { status: 422 })

  if (ticked) {
    await prisma.ideaWorklistTick.upsert({
      where: { ideaId_userId_itemKey: { ideaId: id, userId: authz.user.id, itemKey } },
      create: { ideaId: id, userId: authz.user.id, itemKey },
      update: {},
    })
  } else {
    await prisma.ideaWorklistTick.deleteMany({ where: { ideaId: id, userId: authz.user.id, itemKey } })
  }
  const askLex = agentEnabledFor({ id: authz.user.id, email: authz.user.email })
  return NextResponse.json(await buildChecklists(id, authz.user.id, askLex))
}
