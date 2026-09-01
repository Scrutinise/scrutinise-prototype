// ─────────────────────────────────────────────────────────────────────────────
// 25-S §2 — MOVING A CAUSE: THE NUMBER, THE ORDER, AND THE LOOP GUARD.
//
// ══ §2c — WHAT THE DATA MODEL ALREADY SUPPORTS, REPORTED BEFORE BUILDING ══════════
//
// **Everything the drag needs.** `DiagnosisCause` already carries a self-relation —
// `parentCauseId`, with `parent` / `children`, `onDelete: Cascade` and an index on
// `parentCauseId` — plus `orderIndex` for display position. 25-M introduced it and 25-O settled
// the direction (stored root-down, displayed material-cause-up).
//
// So there is no second structure to build: **drag-to-nest writes `parentCauseId`, and
// drag-to-reorder writes `orderIndex`.** Measured on production, 1 September: 22 causes across 7
// ideas, 6 of them with a parent, deepest chain stored = 2.
//
// ══ §2d — WHAT HAPPENS TODAY IF A LOOP IS ATTEMPTED, REPORTED ═════════════════════
//
// ⚠⚠ **IT CANNOT BE ATTEMPTED, BECAUSE THERE IS NO MOVE OPERATION.** The causes route's `add`
// takes an optional `parentCauseId` — creating a NEW child — and `update` writes only `cause`,
// `whyPersisted` and `evidence`. **Nothing re-parents an existing cause**, so a cycle has been
// unreachable rather than guarded.
//
// That is the honest answer to "report what happens today": nothing happens, because it cannot
// happen. It also means **the guard has to ship in the same change as the move that makes it
// possible** — which is this file. A cycle would be worse here than in most trees: `children` is
// walked recursively to render, so a loop is a hang, not a wrong answer.
//
// ⚠ AND `orderIndex` IS BARELY POPULATED — 22 causes use 6 distinct values, because nothing has
// ever needed it to be dense. `reorderedIds` therefore rewrites the whole list's indices rather
// than trying to slot one value between two others.
// ─────────────────────────────────────────────────────────────────────────────

export interface CauseNode {
  id: string
  parentCauseId: string | null
}

/**
 * ⚠⚠ THE LOOP GUARD. Would making `childId` a child of `newParentId` create a cycle?
 *
 * True when the proposed parent IS the cause itself, or is anywhere beneath it. Walk UP from the
 * proposed parent: if we meet the child, the child is one of its ancestors, so attaching would
 * close a loop.
 *
 * ⚠ THE WALK IS BOUNDED BY A `seen` SET, NOT BY A DEPTH LIMIT. If the data ALREADY contains a
 * cycle — from a bad write, a restore, or a future bug — a depth-limited walk would either loop
 * forever or give a wrong answer past the limit. This one terminates on any input and answers
 * "yes, a cycle" for data that is already broken, which is the safe direction.
 */
export function wouldCreateCycle(
  childId: string,
  newParentId: string | null,
  nodes: CauseNode[],
): boolean {
  if (!newParentId) return false          // detaching to the root can never loop
  if (newParentId === childId) return true // a cause cannot be its own parent
  const parentOf = new Map(nodes.map((n) => [n.id, n.parentCauseId]))
  const seen = new Set<string>()
  let cursor: string | null = newParentId
  while (cursor) {
    if (cursor === childId) return true
    if (seen.has(cursor)) return true      // the existing data already loops — refuse
    seen.add(cursor)
    cursor = parentOf.get(cursor) ?? null
  }
  return false
}

/**
 * The order to write, given the ids the user dragged into place.
 *
 * ⚠ IT REWRITES EVERY INDEX, and it keeps anything the client did not mention. A client sending a
 * partial list must not silently drop the causes it forgot — so unmentioned ids keep their
 * relative order and follow the ones that were named.
 */
export function reorderedIds(ids: string[], all: string[]): string[] {
  const named = ids.filter((id) => all.includes(id))
  const rest = all.filter((id) => !named.includes(id))
  return [...named, ...rest]
}

/**
 * §2a — the next stable number for an idea's causes. max+1, never reusing a gap.
 *
 * ⚠ THE SAME RULE AS `nextNumber` FOR POLICIES, and deliberately a separate function rather than
 * a shared one: they number different tables from different sequences, and sharing would invite
 * somebody to "fix" one and move the other.
 */
export function nextCauseNumber(existing: Array<{ number: number | null }>): number {
  const used = existing.map((x) => x.number).filter((n): n is number => typeof n === 'number')
  return used.length ? Math.max(...used) + 1 : 1
}
