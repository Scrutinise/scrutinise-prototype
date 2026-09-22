// ─────────────────────────────────────────────────────────────────────────────
// 26-D §3-§5 — MANAGE MODE'S TWO BULK ACTIONS: DELETE SELECTED, GROUP SELECTED.
//
// One route, one `action` discriminator, because both are "do this to a set of ids the
// caller ticked" and the ownership scoping is identical for each.
//
// ⚠ §4b — DELETE REUSES THE EXACT SAME FUNCTION THE SINGLE-IDEA ROUTE CALLS
// (`deleteIdeaForOwner`, lib/lex/idea-lifecycle.ts). A bulk path that re-implemented "soft
// delete, owner-only, refuse a public idea" would drift from the single path the moment
// either one changed, and the brief is explicit that it must not: "confirm the bulk path
// uses the same mechanism as the single delete and does not bypass it."
//
// ⚠ PARTIAL SUCCESS IS REPORTED, NOT SILENTLY SWALLOWED OR TREATED AS ALL-OR-NOTHING. A
// bulk selection can include an idea that is already public (refused) alongside nine that
// are not — the nine still delete, and the response says which one did not and why, so
// §4a's "names how many will go, and lists them" stays true of what actually happened,
// not just what was asked for.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { deleteIdeaForOwner, cleanupGroupIfEmpty } from '@/lib/lex/idea-lifecycle'

const BodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('delete'), ids: z.array(z.string()).min(1).max(200) }),
  z.object({
    action: z.literal('group'),
    ids: z.array(z.string()).min(1).max(200),
    // ⚠ §5a — exactly one of these, never both: a new heading or an existing one.
    groupId: z.string().optional(),
    newGroupName: z.string().min(1).max(120).optional(),
  }),
])

export async function PATCH(req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  if (parsed.data.action === 'delete') {
    const results = await Promise.all(parsed.data.ids.map((id) => deleteIdeaForOwner(id, user.id)))
    const deleted = results.filter((r) => r.ok && !r.alreadyDeleted)
    const refused = results.filter((r) => !r.ok)

    // §5d's cleanup applies here too: a deleted idea that was the last member of a group
    // leaves that group empty, and an empty group is removed silently, same as any other
    // route that can empty one.
    const groupsToCheck = await prisma.idea.findMany({
      where: { id: { in: deleted.map((d) => d.id) }, groupId: { not: null } },
      select: { groupId: true },
    })
    for (const gid of new Set(groupsToCheck.map((g) => g.groupId).filter((g): g is string => !!g))) {
      await cleanupGroupIfEmpty(gid)
    }

    return NextResponse.json({
      ok: true,
      deleted: deleted.map((d) => ({ id: d.id, title: d.title })),
      refused: refused.map((r) => ({ id: r.id, error: r.error, code: r.code })),
    })
  }

  // ── action: 'group' ─────────────────────────────────────────────────────────
  const { ids, groupId, newGroupName } = parsed.data
  if (!groupId && !newGroupName?.trim()) {
    return NextResponse.json({ error: 'Name a new heading or choose an existing one.' }, { status: 422 })
  }

  // Owner-scoped: only the caller's own, non-deleted ideas move.
  const owned = await prisma.idea.findMany({
    where: { id: { in: ids }, creatorId: user.id, deletedAt: null },
    select: { id: true, groupId: true },
  })
  if (!owned.length) return NextResponse.json({ error: 'None of those ideas could be found.' }, { status: 404 })

  let targetGroupId: string
  if (groupId) {
    // The target group must be the caller's own — a foreign groupId must not let one
    // account's ideas be filed under another account's heading.
    const target = await prisma.ideaGroup.findFirst({ where: { id: groupId, ownerId: user.id }, select: { id: true } })
    if (!target) return NextResponse.json({ error: 'That group does not exist.' }, { status: 404 })
    targetGroupId = target.id
  } else {
    const created = await prisma.ideaGroup.create({
      data: { ownerId: user.id, name: newGroupName!.trim().slice(0, 120) },
      select: { id: true },
    })
    targetGroupId = created.id
  }

  // ⚠ §5c — "an idea moved into a group leaves whichever group it was in." The groups an
  // idea is leaving are collected BEFORE the move, so they can be checked for emptiness
  // after it.
  const vacatedGroupIds = new Set(
    owned.map((o) => o.groupId).filter((g): g is string => !!g && g !== targetGroupId),
  )

  await prisma.idea.updateMany({
    where: { id: { in: owned.map((o) => o.id) } },
    data: { groupId: targetGroupId },
  })

  for (const gid of vacatedGroupIds) await cleanupGroupIfEmpty(gid)

  const groups = await prisma.ideaGroup.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, hidden: true },
  })
  return NextResponse.json({ ok: true, groupId: targetGroupId, moved: owned.length, groups })
}
