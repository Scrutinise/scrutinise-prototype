// 26-T1 §3b — THE ONE WRITE THE INCENTIVE MAP CAN CAUSE: accepting a spelling merge. The map stores nothing (decision 203); a merge is a new
// Who on the actions that used the other spelling, written by the same `setSlot` the screen uses (so the writer and the date are recorded).
import { prisma } from '@/lib/prisma'
import { setSlot } from './action-slots'
import { implementersIn, keyOf, renameImplementer } from './incentive-map'

export type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string }

export async function mergeImplementerSpellings(ideaId: string, fromKeys: string[], to: string): Promise<Result<{ changed: number; numbers: number[] }>> {
  const name = to.replace(/\s+/g, ' ').trim()
  if (!name) return { ok: false, error: 'A merged spelling needs a name. Nothing was changed.' }
  const keys = new Set(fromKeys)
  const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE' }, select: { id: true, number: true, whoImplements: true } })
  const numbers: number[] = []
  for (const r of rows) {
    if (!r.whoImplements) continue
    const hit = implementersIn(r.whoImplements).some((w) => keys.has(keyOf(w.name)) && keyOf(w.name) !== keyOf(name))
    if (!hit) continue
    let next = r.whoImplements
    for (const k of keys) next = renameImplementer(next, k, name)
    if (next === r.whoImplements) continue
    const w = await setSlot(ideaId, r.id, 'who', { text: next }, 'USER')
    if (!w.ok) return { ok: false, error: `${(w as { error: string }).error} (${numbers.length} actions had already been changed: ${numbers.map((n) => `#${n}`).join(', ') || 'none'}.)` }
    if (r.number != null) numbers.push(r.number)
  }
  if (!numbers.length) return { ok: false, error: 'No live action uses the spelling you asked to change. Nothing was changed.' }
  return { ok: true, data: { changed: numbers.length, numbers } }
}
