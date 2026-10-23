// ─────────────────────────────────────────────────────────────────────────────
// 26-V1b §7b (decision 262) — THE ORDER, BY DEPENDENCY ONLY. Now / Next / Later is retired from the screen ("the three words were vague
// and nobody found a use for them"); `sequence` stays in the data, unshown. What is left is the one thing that was real: "#60 must come
// after #59, because the Code must exist before the duty bites".
//
//   · The edge is the EXISTING `beforeIds`: #59.beforeIds holds #60's id. Nothing new is stored for it.
//   · The "because" is stored on the LATER action's record, keyed by the earlier one's id (`record.orderBecause`), optional, 300 characters.
//   · The order is DERIVED, never typed: a topological order over the edges, ties kept in list order.
//   · A cycle is refused in words naming both actions — an order cannot go round in a circle.
//
// PURE; CLIENT-SAFE (imports nothing), so the screen, the route, Lex's tools and the Actions Pack read one definition (§26.5).
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderNode { id: string; number: number | null; beforeIds: readonly string[] }
export interface AfterLine { id: string; number: number | null; because: string | null }
export interface OrderRow { place: number; id: string; number: number | null; after: AfterLine[] }

const num = (n: number | null) => `#${n ?? '?'}`

/** What `id` must come after: the actions whose beforeIds name it. Pure. */
export function afterOf(nodes: readonly OrderNode[], id: string, because?: (laterId: string, earlierId: string) => string | null): AfterLine[] {
  return nodes.filter((o) => o.id !== id && o.beforeIds.includes(id)).map((o) => ({ id: o.id, number: o.number, because: because?.(id, o.id) ?? null }))
}

/** The path from `from` to `to` along beforeIds, or null. Used to refuse an edge that closes a circle, naming who is in it. */
export function pathBetween(nodes: readonly OrderNode[], from: string, to: string): string[] | null {
  const next = new Map(nodes.map((n) => [n.id, n.beforeIds]))
  const seen = new Set<string>([from])
  const queue: string[][] = [[from]]
  while (queue.length) {
    const path = queue.shift()!
    for (const n of next.get(path[path.length - 1]) ?? []) {
      if (n === to) return [...path, n]
      if (!seen.has(n) && next.has(n)) { seen.add(n); queue.push([...path, n]) }
    }
  }
  return null
}

/**
 * Would "`later` must come after `earlier`" (earlier.beforeIds ∋ later) close a circle? If `earlier` can already be reached from `later`,
 * yes — and the refusal says so in words, naming both actions and any in between. Null means the edge is fine.
 */
export function cycleRefusal(nodes: readonly OrderNode[], earlierId: string, laterId: string): string | null {
  const name = (id: string) => num(nodes.find((n) => n.id === id)?.number ?? null)
  if (earlierId === laterId) return `${name(laterId)} cannot come after itself.`
  const path = pathBetween(nodes, laterId, earlierId)
  if (!path) return null
  const via = path.slice(1, -1).map(name)
  return `${name(laterId)} cannot come after ${name(earlierId)}: ${name(earlierId)} already has to come after ${name(laterId)}${via.length ? ` (through ${via.join(', ')})` : ''}. An order cannot go round in a circle — remove one of the two first.`
}

/** Any circle already in the data (an old pair from before this refusal existed): the ids on it, in order. Empty when there is none. */
export function cycleIn(nodes: readonly OrderNode[]): string[] {
  for (const n of nodes) for (const b of n.beforeIds) {
    const back = pathBetween(nodes, b, n.id)
    if (back) return [n.id, ...back.slice(0, -1)]
  }
  return []
}

/**
 * The derived order: every action that must come after another is placed after it; otherwise the list's own order is kept. Actions on a
 * circle cannot be placed and are returned apart, so the screen can say so rather than print an order that is not one.
 */
export function derivedOrder(nodes: readonly OrderNode[], because?: (laterId: string, earlierId: string) => string | null): { rows: OrderRow[]; unplaced: string[] } {
  const ids = new Set(nodes.map((n) => n.id))
  const indeg = new Map(nodes.map((n) => [n.id, 0]))
  for (const n of nodes) for (const b of n.beforeIds) if (ids.has(b) && b !== n.id) indeg.set(b, (indeg.get(b) ?? 0) + 1)
  const rows: OrderRow[] = []
  const done = new Set<string>()
  // Kahn's order, taking the EARLIEST ready action in list order each time, so independent actions keep the owner's order.
  for (;;) {
    const ready = nodes.find((n) => !done.has(n.id) && indeg.get(n.id) === 0)
    if (!ready) break
    done.add(ready.id)
    rows.push({ place: rows.length + 1, id: ready.id, number: ready.number, after: afterOf(nodes, ready.id, because) })
    for (const b of ready.beforeIds) if (ids.has(b) && b !== ready.id) indeg.set(b, (indeg.get(b) ?? 0) - 1)
  }
  return { rows, unplaced: nodes.filter((n) => !done.has(n.id)).map((n) => n.id) }
}

/** One action's order line, as the record, the row tag and the pack print it. */
export function afterWords(after: readonly AfterLine[]): string {
  if (!after.length) return 'nothing it must come after'
  return `must come after ${after.map((a) => `${num(a.number)}${a.because ? ` (${a.because})` : ''}`).join(', ')}`
}

/** A derived-order line: "3. #60 — must come after #59 (the Code must exist before the duty bites)". */
export const orderRowWords = (r: OrderRow, label?: string) => `${r.place}. ${num(r.number)}${label ? ` ${label}` : ''} — ${afterWords(r.after)}`

/** The record's `orderBecause`, read defensively (the same reader as action-record's, for callers holding a raw record). */
export function becauseOf(record: unknown): Record<string, string> {
  const o = record && typeof record === 'object' && !Array.isArray(record) ? (record as { orderBecause?: unknown }).orderBecause : null
  if (!o || typeof o !== 'object' || Array.isArray(o)) return {}
  return Object.fromEntries(Object.entries(o as Record<string, unknown>).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, (v as string).trim()]))
}
