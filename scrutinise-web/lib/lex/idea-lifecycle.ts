// ─────────────────────────────────────────────────────────────────────────────
// 26-D §4b — ONE DELETE FUNCTION, IMPORTED BY THE SINGLE ROUTE AND THE BULK ONE.
//
// §4b: "Confirm the bulk path uses the same mechanism as the single delete and does not
// bypass it." The mechanism that matters is not just "set deletedAt" — it is the owner
// check, the idempotent re-delete, and the refusal once an idea is public and carries
// other people's votes and contributions (app/api/ideas/[id]/route.ts's own DELETE
// handler, unchanged by this sprint). Lifting it here and importing it from both call
// sites is CLAUDE.md §25 rule 3: import the function, never re-implement it — two copies
// of "when is a delete allowed" is one copy that will drift from the other.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

/**
 * ⚠ FLAT, NOT A DISCRIMINATED UNION. This package compiles with `strict: false`
 * (`strictNullChecks` off), under which TypeScript's control-flow narrowing on a tagged
 * union's `ok` field does not reliably narrow at either call site — confirmed empirically
 * (`tsc` still reported the `ok: true` shape's fields missing inside an `if (!outcome.ok)`
 * block). Every field is present on every outcome instead, `null` where it does not
 * apply, so no caller needs narrowing to read the right one.
 */
export interface DeleteOutcome {
  ok: boolean
  id: string
  title: string
  alreadyDeleted: boolean
  error: string | null
  code: string | null
  status: number
}

const PUBLIC_STAGES = ['STAGE_4', 'STAGE_5']

/**
 * Delete one idea, owner-checked, idempotent, refusing a public idea — exactly the rule
 * the single DELETE route has always enforced. Never called with an id the caller has
 * not already scoped to the acting user's own ideas at the query that produced the list,
 * but the ownership check runs here too: a caller must not be able to widen a bulk
 * request into deleting an idea it does not own.
 */
export async function deleteIdeaForOwner(ideaId: string, userId: string): Promise<DeleteOutcome> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, creatorId: true, title: true, stage: true, deletedAt: true },
  })
  if (!idea) {
    return { ok: false, id: ideaId, title: '', alreadyDeleted: false, error: 'Not found', code: null, status: 404 }
  }

  if (idea.creatorId !== userId) {
    return {
      ok: false, id: ideaId, title: idea.title, alreadyDeleted: false,
      error: 'Only the owner can delete an idea', code: null, status: 403,
    }
  }

  if (idea.deletedAt) {
    return { ok: true, id: ideaId, title: idea.title, alreadyDeleted: true, error: null, code: null, status: 200 }
  }

  if (PUBLIC_STAGES.includes(idea.stage)) {
    return {
      ok: false, id: ideaId, title: idea.title, alreadyDeleted: false,
      error: 'This idea is public and carries other people’s votes and contributions. '
        + 'Withdraw it instead — deleting it would take their work with it.',
      code: 'PUBLIC_IDEA', status: 409,
    }
  }

  await prisma.idea.update({ where: { id: ideaId }, data: { deletedAt: new Date() } })
  console.log('[idea] deleted', { id: ideaId, stage: idea.stage, by: userId })
  return { ok: true, id: ideaId, title: idea.title, alreadyDeleted: false, error: null, code: null, status: 200 }
}

/**
 * ⚠ §5d — "report what happens to an empty group... recommend removing it silently."
 * Called after any mutation that could leave a group with no ACTIVE (non-deleted) idea
 * in it: bulk-group reassignment away from an old group, explicit ungroup, and idea
 * deletion. A group row existing at all is meant to be evidence it still has a member —
 * this is what keeps that true, rather than a DB constraint that would fight a mid-
 * transaction moment where it is briefly empty.
 */
export async function cleanupGroupIfEmpty(groupId: string): Promise<void> {
  const remaining = await prisma.idea.count({ where: { groupId, deletedAt: null } })
  if (remaining === 0) {
    // Idempotent: a concurrent caller may have already deleted it.
    await prisma.ideaGroup.deleteMany({ where: { id: groupId } })
  }
}
