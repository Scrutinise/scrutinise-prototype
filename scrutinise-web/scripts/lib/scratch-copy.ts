// A SCRATCH COPY OF A REAL IDEA — for measuring what a process costs without touching the original.
//
// 26-P CCh follow-up item 4 and BRIEF_26O §6 both need to run real, spending processes (a gap check, a consolidation, a
// build) and read what they cost. Running them on a user's own idea would change it (a gap check writes suggestions into
// the actions list; a consolidation writes a consolidation). So: copy, run on the copy, DELETE the copy.
//
// ⚠ WHAT IS COPIED is exactly what those processes read: the idea's own columns (kernel mirrors, challenge, obstacle…),
// its field states, causes, candidate policies, coherent actions and elicitation. Filed documents are NOT copied (the
// copy files its own when a test needs one), nor chat history, nor builds. The copy is the owner's, PRIVATE, STAGE_1, and
// titled "ZZ-scratch …" so it can never be mistaken for a real idea in a list.
// ⚠ IDS ARE REMAPPED where rows point at each other (cause tree, candidate merges/parking, a candidate's target causes).
// ⚠ NOTHING HERE DELETES THE SOURCE. `deleteScratch` refuses an id that is not a scratch copy.

import { prisma } from '../../lib/prisma'

const SCRATCH_PREFIX = 'ZZ-scratch '

type Row = Record<string, unknown>
const strip = (r: Row, ...extra: string[]): Row => {
  const o = { ...r }
  for (const k of ['id', 'ideaId', 'createdAt', 'updatedAt', ...extra]) delete o[k]
  return o
}

export async function scratchCopy(sourceId: string, label: string): Promise<{ id: string; userId: string; title: string }> {
  const src = await prisma.idea.findFirst({ where: { id: { startsWith: sourceId }, deletedAt: null } })
  if (!src) throw new Error(`no idea starts with ${sourceId}`)

  const title = `${SCRATCH_PREFIX}${label}: ${src.title}`.slice(0, 200)
  const copy = await prisma.idea.create({
    data: {
      ...strip(src as unknown as Row, 'proposalShareToken', 'ownershipTransferToken', 'aiChatHistory', 'aiChatSummary', 'deletedAt', 'archivedAt', 'communityId', 'groupId'),
      title, stage: 'STAGE_1', visibility: 'PRIVATE', status: 'DRAFT',
    } as never,
    select: { id: true, creatorId: true },
  })
  const to = copy.id

  const elicit = await prisma.ideaElicitation.findUnique({ where: { ideaId: src.id } })
  if (elicit) await prisma.ideaElicitation.create({ data: { ...strip(elicit as unknown as Row), ideaId: to } as never })

  const fields = await prisma.ideaFieldState.findMany({ where: { ideaId: src.id } })
  for (const f of fields) await prisma.ideaFieldState.create({ data: { ...strip(f as unknown as Row), ideaId: to } as never })

  // causes: two passes (rows first, then the tree)
  const causes = await prisma.diagnosisCause.findMany({ where: { ideaId: src.id } })
  const causeMap = new Map<string, string>()
  for (const c of causes) {
    const made = await prisma.diagnosisCause.create({ data: { ...strip(c as unknown as Row, 'parentCauseId'), ideaId: to } as never })
    causeMap.set(c.id, made.id)
  }
  for (const c of causes) if (c.parentCauseId && causeMap.has(c.parentCauseId)) {
    await prisma.diagnosisCause.update({ where: { id: causeMap.get(c.id)! }, data: { parentCauseId: causeMap.get(c.parentCauseId)! } })
  }

  // actions (so parked/moved pointers can be remapped)
  const actions = await prisma.lexCoherentAction.findMany({ where: { ideaId: src.id } })
  const actionMap = new Map<string, string>()
  for (const a of actions) {
    const made = await prisma.lexCoherentAction.create({ data: { ...strip(a as unknown as Row), ideaId: to } as never })
    actionMap.set(a.id, made.id)
  }

  const opts = await prisma.policyOption.findMany({ where: { ideaId: src.id } })
  const optMap = new Map<string, string>()
  for (const o of opts) {
    const made = await prisma.policyOption.create({
      data: {
        ...strip(o as unknown as Row, 'parkedWithId', 'movedToActionId', 'mergedIntoId', 'targetCauseIds'), ideaId: to,
        targetCauseIds: (o.targetCauseIds ?? []).map((id: string) => causeMap.get(id)).filter((x): x is string => !!x),
        movedToActionId: o.movedToActionId ? (actionMap.get(o.movedToActionId) ?? null) : null,
      } as never,
    })
    optMap.set(o.id, made.id)
  }
  for (const o of opts) {
    const data: Row = {}
    if (o.parkedWithId && optMap.has(o.parkedWithId)) data.parkedWithId = optMap.get(o.parkedWithId)
    if (o.mergedIntoId && optMap.has(o.mergedIntoId)) data.mergedIntoId = optMap.get(o.mergedIntoId)
    if (Object.keys(data).length) await prisma.policyOption.update({ where: { id: optMap.get(o.id)! }, data: data as never })
  }

  return { id: to, userId: copy.creatorId, title }
}

/** Deletes a scratch copy and everything cascading from it. Refuses anything not titled as one. */
export async function deleteScratch(id: string): Promise<boolean> {
  const row = await prisma.idea.findUnique({ where: { id }, select: { title: true } })
  if (!row) return true
  if (!row.title.startsWith(SCRATCH_PREFIX)) throw new Error(`refusing to delete ${id}: it is not a scratch copy ("${row.title.slice(0, 40)}")`)
  try { await prisma.idea.delete({ where: { id } }); return true } catch (err) {
    // a hard delete can be refused by a restrictive foreign key; soft-delete so it is at least out of every list
    await prisma.idea.update({ where: { id }, data: { deletedAt: new Date() } }).catch(() => {})
    console.warn(`scratch ${id.slice(0, 8)} soft-deleted (hard delete refused: ${String(err).slice(0, 100)})`)
    return false
  }
}
