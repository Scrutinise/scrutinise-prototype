// ─────────────────────────────────────────────────────────────────────────────
// 26-D §6 — RENAME, SHOW/HIDE, AND UNGROUP.
//
// PATCH { name }     → rename.
// PATCH { hidden }   → show or hide. §6a: "named, visible and reversible" — the group
//                      itself always stays visible as a heading; hiding affects only
//                      whether its ideas render in the open list.
// PATCH { ungroup }  → §6c: "a group can be... ungrouped — its ideas returning to the
//                      ungrouped list, not deleted." Every idea's groupId is cleared and
//                      the group row itself is removed (an ungrouped group is, by
//                      definition, empty — §5d's rule applies to it directly).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ groupId: string }> }

const BodySchema = z.union([
  z.object({ name: z.string().min(1).max(120) }),
  z.object({ hidden: z.boolean() }),
  z.object({ ungroup: z.literal(true) }),
])

export async function PATCH(req: Request, { params }: Params) {
  const { groupId } = await params
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const group = await prisma.ideaGroup.findFirst({ where: { id: groupId, ownerId: user.id } })
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  if ('ungroup' in parsed.data) {
    // ⚠ IDEAS FIRST, THEN THE GROUP — in one transaction, so a crash between the two
    // steps cannot leave ideas pointing at a group row that no longer exists.
    await prisma.$transaction([
      prisma.idea.updateMany({ where: { groupId }, data: { groupId: null } }),
      prisma.ideaGroup.delete({ where: { id: groupId } }),
    ])
    return NextResponse.json({ ok: true, ungrouped: true })
  }

  const updated = await prisma.ideaGroup.update({
    where: { id: groupId },
    data: 'name' in parsed.data ? { name: parsed.data.name.trim().slice(0, 120) } : { hidden: parsed.data.hidden },
    select: { id: true, name: true, hidden: true },
  })
  return NextResponse.json({ ok: true, group: updated })
}
