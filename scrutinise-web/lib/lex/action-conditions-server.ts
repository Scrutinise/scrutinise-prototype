// ─────────────────────────────────────────────────────────────────────────────
// 26-S2 decision 188 — THE CONDITIONS FACET, SERVER HALF. One implementation, called by the route (the screen) and Lex's tools (the chat).
//
// ⚠ Nothing here deletes. A condition is RETIRED (kept, out of the coverage). ⚠ Lex's additions are PROPOSALS; only the owner's act makes
// one a condition. ⚠ Everything is scoped to one idea: an id that is not on this idea resolves to nothing.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CONDITION_MAX, activeConditions, parseConditions, type ConditionsDoc } from './action-conditions'

type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '')

export async function readConditions(ideaId: string): Promise<ConditionsDoc> {
  return parseConditions((await prisma.idea.findUnique({ where: { id: ideaId }, select: { conditions: true } }))?.conditions)
}
async function write(ideaId: string, doc: ConditionsDoc) {
  await prisma.idea.update({ where: { id: ideaId }, data: { conditions: doc as unknown as Prisma.InputJsonValue } })
}

/** Replace the whole list with these texts (used to seed Charlie's ten verbatim). Existing ids are kept where the text is unchanged. */
export async function seedConditions(ideaId: string, userId: string, texts: string[], source: ConditionsDoc['source']): Promise<Result<{ count: number }>> {
  const doc = await readConditions(ideaId)
  const at = new Date().toISOString()
  const items = texts.map((t) => clip(t, CONDITION_MAX)).filter(Boolean).map((text) => doc.items.find((c) => c.text === text) ?? { id: randomUUID(), text, by: userId, at })
  await write(ideaId, { ...doc, items: [...items, ...doc.items.filter((c) => !items.includes(c))], source: source ?? doc.source })
  return { ok: true, data: { count: items.length } }
}

export async function addCondition(ideaId: string, userId: string, text: string): Promise<Result<{ id: string; number: number }>> {
  const t = clip(text, CONDITION_MAX)
  if (!t) return fail('A condition needs some words.')
  const doc = await readConditions(ideaId)
  if (activeConditions(doc).some((c) => c.text.toLowerCase() === t.toLowerCase())) return fail('That condition is already on the list. Nothing was added.')
  const id = randomUUID()
  doc.items.push({ id, text: t, by: userId, at: new Date().toISOString() })
  await write(ideaId, doc)
  return { ok: true, data: { id, number: activeConditions(doc).length } }
}

export async function editCondition(ideaId: string, id: string, text: string): Promise<Result> {
  const t = clip(text, CONDITION_MAX)
  if (!t) return fail('A condition needs some words. To remove one, retire it.')
  const doc = await readConditions(ideaId)
  const c = doc.items.find((x) => x.id === id)
  if (!c) return fail('That condition is not on this idea.')
  c.text = t
  await write(ideaId, doc)
  return { ok: true, data: null }
}

/** Retire / restore. A retired condition is kept (actions that point at it keep the pointer) and leaves the coverage and the checklist. */
export async function retireCondition(ideaId: string, id: string, retired: boolean): Promise<Result> {
  const doc = await readConditions(ideaId)
  const c = doc.items.find((x) => x.id === id)
  if (!c) return fail('That condition is not on this idea.')
  if (retired) c.retired = true; else delete c.retired
  await write(ideaId, doc)
  return { ok: true, data: null }
}

export async function moveCondition(ideaId: string, id: string, dir: 'up' | 'down'): Promise<Result> {
  const doc = await readConditions(ideaId)
  const active = activeConditions(doc)
  const i = active.findIndex((x) => x.id === id)
  if (i < 0) return fail('That condition is not on this idea.')
  const j = dir === 'up' ? i - 1 : i + 1
  if (j < 0 || j >= active.length) return { ok: true, data: null }
  const a = doc.items.indexOf(active[i]), b = doc.items.indexOf(active[j])
  ;[doc.items[a], doc.items[b]] = [doc.items[b], doc.items[a]]
  await write(ideaId, doc)
  return { ok: true, data: null }
}

// ── Lex's additions are PROPOSALS ─────────────────────────────────────────────────────────────────────────
export async function proposeCondition(ideaId: string, text: string, why: string): Promise<Result<{ id: string }>> {
  const t = clip(text, CONDITION_MAX)
  if (!t) return fail('A proposed condition needs some words.')
  const doc = await readConditions(ideaId)
  if (activeConditions(doc).some((c) => c.text.toLowerCase() === t.toLowerCase()) || doc.proposals.some((p) => p.text.toLowerCase() === t.toLowerCase())) return fail('That condition is already on the list or already proposed. Nothing was added.')
  const id = randomUUID()
  doc.proposals.push({ id, text: t, why: clip(why, 400) })
  await write(ideaId, doc)
  return { ok: true, data: { id } }
}
export async function acceptConditionProposal(ideaId: string, userId: string, proposalId: string): Promise<Result<{ id: string; number: number }>> {
  const doc = await readConditions(ideaId)
  const p = doc.proposals.find((x) => x.id === proposalId)
  if (!p) return fail('That proposal is no longer waiting.')
  doc.proposals = doc.proposals.filter((x) => x.id !== proposalId)
  const id = randomUUID()
  doc.items.push({ id, text: p.text, by: userId, at: new Date().toISOString() })
  await write(ideaId, doc)
  return { ok: true, data: { id, number: activeConditions(doc).length } }
}
export async function dismissConditionProposal(ideaId: string, proposalId: string): Promise<Result> {
  const doc = await readConditions(ideaId)
  if (!doc.proposals.some((x) => x.id === proposalId)) return fail('That proposal is no longer waiting.')
  doc.proposals = doc.proposals.filter((x) => x.id !== proposalId)
  await write(ideaId, doc)
  return { ok: true, data: null }
}

// ── an action's conditions ────────────────────────────────────────────────────────────────────────────────
/** Set the conditions the actions deliver (`conditionIds`, replacing), or mark them `support` (clears the list: support delivers none directly). */
export async function assignConditions(ideaId: string, actionIds: string[], patch: { conditionIds?: string[]; support?: boolean; mode?: 'set' | 'add' }): Promise<Result<{ assigned: number }>> {
  const doc = await readConditions(ideaId)
  const known = new Set(doc.items.map((c) => c.id))
  if (patch.conditionIds?.some((c) => !known.has(c))) return fail('One of those conditions is not on this idea. Nothing was changed.')
  const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId, id: { in: actionIds }, status: 'LIVE' }, select: { id: true, conditionIds: true } })
  if (!rows.length) return fail('None of those actions could be changed — they are no longer in the live list. Nothing was changed.')
  for (const r of rows) {
    if (patch.support === true) { await prisma.lexCoherentAction.update({ where: { id: r.id }, data: { supportOnly: true, conditionIds: [] } }); continue }
    const next = patch.conditionIds === undefined ? r.conditionIds : patch.mode === 'add' ? [...new Set([...r.conditionIds, ...patch.conditionIds])] : [...new Set(patch.conditionIds)]
    // choosing a condition ends "support": an action cannot both deliver a condition and deliver none
    await prisma.lexCoherentAction.update({ where: { id: r.id }, data: { conditionIds: next, ...(next.length || patch.support === false ? { supportOnly: false } : {}) } })
  }
  return { ok: true, data: { assigned: rows.length } }
}
