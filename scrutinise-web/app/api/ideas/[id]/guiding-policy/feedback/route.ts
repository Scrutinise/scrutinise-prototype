// ─────────────────────────────────────────────────────────────────────────────
// 26-I addendum A1 — the general feedback box: input about guiding policies that
// isn't about one candidate card. Filed to the same PolicyFeedback record every
// other source (a card's reason box, the Lex chat) writes to.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'

type Params = { params: Promise<{ id: string }> }

const BodySchema = z.object({ text: z.string().trim().min(1).max(4000) })

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea) // cost dashboard: attribute this request's spend

  const items = await prisma.policyFeedback.findMany({
    where: { ideaId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ items })
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea) // cost dashboard: attribute this request's spend

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  const item = await prisma.policyFeedback.create({
    data: { ideaId: id, source: 'GENERAL_BOX', text: parsed.data.text },
  })
  const feedbackCount = await prisma.policyFeedback.count({ where: { ideaId: id } })
  return NextResponse.json({ item, feedbackCount })
}
