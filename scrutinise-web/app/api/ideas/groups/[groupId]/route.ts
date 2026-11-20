// ─────────────────────────────────────────────────────────────────────────────
// 26-D §6 — RENAME, SHOW/HIDE, AND UNGROUP.
//
// PATCH { name }     → rename.
// PATCH { hidden }   → show or hide. §6a: "named, visible and reversible" — the group
//                      itself always stays visible as a heading; hiding affects only
//                      whether its ideas render in the open list.
// PATCH { ungroup }  → §6c: "a group can be... ungrouped — its ideas returning to the
//                      ungrouped list, not deleted." Every idea's groupId is cleared.
//                      ⚠ 26-AA item 1 (183/196): the group row is ARCHIVED, not deleted, with
//                      the ideas it held (archivedIdeaIds), so it can be restored.
// PATCH { restore }  → 26-AA item 1: the group comes back, with every idea it held that is
//                      still undeleted and ungrouped (one filed elsewhere since stays there).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { ungroupArchive, restoreGroup } from '@/lib/lex/archive'

type Params = { params: Promise<{ groupId: string }> }

const BodySchema = z.union([
  z.object({ name: z.string().min(1).max(120) }),
  z.object({ hidden: z.boolean() }),
  z.object({ ungroup: z.literal(true) }),
  z.object({ restore: z.literal(true) }),
])

export async function PATCH(req: Request, { params }: Params) {
  const { groupId } = await params
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  // 26-AA item 1 — restore looks among the ARCHIVED groups, so it comes before the live lookup below.
  if ('restore' in parsed.data) {
    const r = await restoreGroup(user.id, groupId)
    if (!('group' in r)) return NextResponse.json({ error: 'That group is not among your ungrouped groups.' }, { status: 404 })
    return NextResponse.json(r)
  }

  const group = await prisma.ideaGroup.findFirst({ where: { id: groupId, ownerId: user.id } })
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if ('ungroup' in parsed.data) {
    // ⚠ 26-AA item 1 — ARCHIVED, not deleted (lib/lex/archive.ts): ideas first, then the group, in one transaction.
    await ungroupArchive(user.id, groupId)
    return NextResponse.json({ ok: true, ungrouped: true, group: { id: group.id, name: group.name, ideaCount: (await prisma.ideaGroup.findUnique({ where: { id: groupId }, select: { archivedIdeaIds: true } }))?.archivedIdeaIds.length ?? 0 } })
  }

  const updated = await prisma.ideaGroup.update({
    where: { id: groupId },
    data: 'name' in parsed.data ? { name: parsed.data.name.trim().slice(0, 120) } : { hidden: parsed.data.hidden },
    select: { id: true, name: true, hidden: true },
  })
  return NextResponse.json({ ok: true, group: updated })
}
