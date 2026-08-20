// SPRINT 25-C §3 — the review agenda.
//
// GET   → the assembled agenda. Pure reads; no model call, so this is cheap enough to poll.
// PATCH → resolve a decision.
//
// ⚠ RESOLVING KEEPS BOTH. §3a: "the record keeps both, because a proposal that shows what it
// considered and set aside is stronger than one that looks inevitable." So the PATCH writes WHICH
// WAY the user went onto every row of that fork and touches nothing else — the alternative, its
// case, and Lex's own recommendation all survive the decision.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorizeIdea } from '@/lib/lex/authz'
import { buildAgenda } from '@/lib/lex/agenda'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  return NextResponse.json(await buildAgenda(id))
}

const PatchSchema = z.object({
  forkKey: z.string().min(1),
  /**
   * `'chosen'` keeps Lex's recommendation; `'alternative:<n>'` takes the road it set aside.
   *
   * ⚠ Validated as a SHAPE rather than against the stored alternatives, and then checked against
   * them below. A client that could send an arbitrary string would be writing free text into a
   * decision record that a Bill may later rest on.
   */
  choice: z.string().regex(/^(chosen|alternative:\d+)$/),
})

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  let body: unknown = {}
  try { body = await req.json() } catch { /* handled by the parse below */ }
  const parsed = PatchSchema.safeParse(body ?? {})
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  const { forkKey, choice } = parsed.data

  const rows = await prisma.buildFork.findMany({ where: { ideaId: id, forkKey } })
  if (!rows.length) return NextResponse.json({ error: `No decision "${forkKey}" on this idea.` }, { status: 404 })

  // ⚠ AN ALTERNATIVE THAT DOES NOT EXIST IS REFUSED, not stored. `alternative:7` on a two-way
  // fork would otherwise become a decision nobody can interpret afterwards.
  if (choice !== 'chosen') {
    const idx = Number(choice.split(':')[1])
    if (!rows.some((r) => r.alternativeIndex === idx)) {
      return NextResponse.json({ error: `That decision has no alternative ${idx}.` }, { status: 422 })
    }
  }

  await prisma.buildFork.updateMany({
    where: { ideaId: id, forkKey },
    // Only these three. `chosen`, `alternative`, `caseForAlternative` and `recommendationReason`
    // are deliberately untouched — see the header.
    data: { resolved: true, resolvedChoice: choice, resolvedAt: new Date() },
  })

  console.log('[lex-diag] 25c decision resolved', { ideaId: id, forkKey, choice })
  return NextResponse.json(await buildAgenda(id))
}
