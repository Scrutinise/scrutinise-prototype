// ─────────────────────────────────────────────────────────────────────────────
// 26-S2 decision 190 — "RE-SORT INTO HEADINGS" and "CONSOLIDATE THIS HEADING": THE SERVER HALF. One implementation, called by the route and
// by Lex's tools. The pure half (plan, fold lines, validation, price) is action-resort-pure.ts.
//
// ⚠ NOTHING DELETES (decision 190). A re-sort remembers where each action was; a retired heading is archived; a fold keeps the component
// (archived, with a pointer) and puts only a QUOTE the code copied from the row into the mechanism's commentary; a duplicate goes through
// the existing merge. ⚠ Every model answer is held to the pure validator; what it cannot apply is reported.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { callModelJson } from './model-call'
import { recordUsage } from './spend-ledger'
import { M_COHERENT_ACTIONS } from './method'
import { nextColourKey } from './action-headings'
import { applyActionMerge, STRUCTURE_MODEL, type Result } from './action-structure'
import {
  RESORT_BATCH, addFoldLines, consolidateEstimate, foldLine, norm, parseHeadingPlan, resortEstimate, validateConsolidation,
  type ConsolidationAnswer, type HeadingPlan,
} from './action-resort-pure'

/** The model call, as a seam: the checks put a fake here so the apply logic is tested without spending (as slotModel does for the step-2 slots). */
export const seams = { callModelJson }

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '')

export async function readHeadingPlan(ideaId: string): Promise<HeadingPlan | null> {
  return parseHeadingPlan((await prisma.idea.findUnique({ where: { id: ideaId }, select: { headingPlan: true } }))?.headingPlan)
}
export async function setHeadingPlan(ideaId: string, plan: HeadingPlan | null): Promise<void> {
  await prisma.idea.update({ where: { id: ideaId }, data: { headingPlan: plan ? (plan as unknown as Prisma.InputJsonValue) : Prisma.DbNull } })
}

// ── the target headings ──────────────────────────────────────────────────────────────────────────────────────
/**
 * Make the plan's headings exist, in the plan's order. A heading already there under the plan's name is kept; one under a `formerly` name is
 * RENAMED (its id, its actions, its hidden flag stay); the rest are created. Nothing is archived here - that waits until a heading is empty.
 */
export async function ensureTargetHeadings(ideaId: string, plan: HeadingPlan): Promise<Array<{ id: string; name: string; created: boolean; renamedFrom: string | null }>> {
  const existing = await prisma.actionHeading.findMany({ where: { ideaId }, select: { id: true, name: true, colourKey: true, orderIndex: true } })
  const out: Array<{ id: string; name: string; created: boolean; renamedFrom: string | null }> = []
  const colours = existing.map((h) => h.colourKey)
  let order = 0
  for (const t of plan.targets) {
    let row = existing.find((h) => norm(h.name) === norm(t.name))
    let renamedFrom: string | null = null
    if (!row) {
      const old = existing.find((h) => (t.formerly ?? []).some((f) => norm(f) === norm(h.name)))
      if (old) { renamedFrom = old.name; row = old }
    }
    if (row) {
      await prisma.actionHeading.update({ where: { id: row.id }, data: { name: t.name, orderIndex: order, purpose: t.purpose || undefined } })
      out.push({ id: row.id, name: t.name, created: false, renamedFrom })
    } else {
      const key = nextColourKey(colours); colours.push(key)
      const made = await prisma.actionHeading.create({ data: { ideaId, name: t.name, colourKey: key, orderIndex: order, purpose: t.purpose || null } })
      out.push({ id: made.id, name: made.name, created: true, renamedFrom: null })
    }
    order++
  }
  return out
}

// ── RE-SORT ──────────────────────────────────────────────────────────────────────────────────────────────────
export interface ResortPlanView {
  targets: Array<{ name: string; purpose: string; liveNow: number; exists: boolean; renamesFrom: string | null }>
  /** Headings that will be archived once empty, with how many live actions each holds now. */
  retiring: Array<{ id: string; name: string; live: number }>
  actions: number
  /** The batches the screen loops, in order (action ids). */
  batches: string[][]
  estimate: { pence: number; measured: boolean; calls: number }
}

export async function resortPlan(ideaId: string): Promise<Result<ResortPlanView>> {
  const plan = await readHeadingPlan(ideaId)
  if (!plan) return fail('This idea has no instrument headings set to sort into yet. Nothing was changed.')
  const [heads, rows] = await Promise.all([
    prisma.actionHeading.findMany({ where: { ideaId }, select: { id: true, name: true } }),
    prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE' }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }], select: { id: true, headingId: true } }),
  ])
  const live = (id: string) => rows.filter((r) => r.headingId === id).length
  const targets = plan.targets.map((t) => {
    const same = heads.find((h) => norm(h.name) === norm(t.name))
    const old = same ? null : heads.find((h) => (t.formerly ?? []).some((f) => norm(f) === norm(h.name)))
    const h = same ?? old
    return { name: t.name, purpose: t.purpose, liveNow: h ? live(h.id) : 0, exists: !!same, renamesFrom: old?.name ?? null }
  })
  const keepNames = new Set(plan.targets.flatMap((t) => [norm(t.name), ...(t.formerly ?? []).map(norm)]))
  const retiring = heads.filter((h) => !keepNames.has(norm(h.name))).map((h) => ({ id: h.id, name: h.name, live: live(h.id) }))
  const ids = rows.map((r) => r.id)
  const batches: string[][] = []
  for (let i = 0; i < ids.length; i += RESORT_BATCH) batches.push(ids.slice(i, i + RESORT_BATCH))
  return { ok: true, data: { targets, retiring, actions: ids.length, batches, estimate: resortEstimate(ids.length) } }
}

const RESORT_SYSTEM = (plan: HeadingPlan) => [
  M_COHERENT_ACTIONS, '',
  '════ YOU ARE SORTING COHERENT ACTIONS INTO THE INSTRUMENTS THAT CARRY THEM ════',
  'Each heading below is an INSTRUMENT OF IMPLEMENTATION - the thing an action is enacted, written, built, funded or run through. Put every action',
  'under exactly ONE of these headings, chosen by WHAT CARRIES IT, not by its theme: an action about transparency that needs an Act belongs with the',
  'Act; the same action done by publishing data belongs with the oversight heading. When an action could sit under two, choose the instrument that',
  'makes it binding or real.',
  '', 'THE HEADINGS (use these names EXACTLY):',
  ...plan.targets.map((t, i) => `  ${i + 1}. ${t.name}${t.purpose ? ` - ${t.purpose}` : ''}`),
  '',
  'For each numbered action return `number`, `heading` (one of the names above, spelled exactly) and `reason`: ONE sentence, in the action\'s own',
  'terms, saying why that instrument carries it. Never invent a detail the action does not state. Return every number you were given, once.',
].join('\n')

const resortSchema = (plan: HeadingPlan) => ({
  type: 'object',
  properties: {
    actions: {
      type: 'array',
      items: { type: 'object', properties: { number: { type: 'integer' }, heading: { type: 'string', enum: plan.targets.map((t) => t.name) }, reason: { type: 'string' } }, required: ['number', 'heading', 'reason'] },
    },
  },
  required: ['actions'],
})

/** One batch: make sure the headings exist, ask the model, MOVE the actions it placed (remembering where each was), return what it did. */
export async function resortBatch(ideaId: string, userId: string | null, ids: string[]): Promise<Result<{ moved: number; unchanged: number; notPlaced: number; pence: number | null; byHeading: Record<string, number> }>> {
  const plan = await readHeadingPlan(ideaId)
  if (!plan) return fail('This idea has no instrument headings set to sort into yet. Nothing was changed.')
  const rows = await prisma.lexCoherentAction.findMany({
    where: { ideaId, status: 'LIVE', id: { in: ids } }, orderBy: [{ number: 'asc' }],
    select: { id: true, number: true, title: true, practicalStep: true, whoImplements: true, headingId: true, headingWasId: true },
  })
  if (!rows.length) return fail('None of those actions are in the live list any more. Nothing was changed.')
  const heads = await ensureTargetHeadings(ideaId, plan)
  const byName = new Map(heads.map((h) => [norm(h.name), h.id]))
  const user = ['THE ACTIONS TO PLACE:', ...rows.map((r) => `[${r.number}] ${clip(r.title, 120)}${r.title ? ': ' : ''}${clip(r.practicalStep, 650)}${r.whoImplements ? ` - implemented by ${clip(r.whoImplements, 120)}` : ''}`)].join('\n')
  const res = await seams.callModelJson<{ actions: Array<{ number: number; heading: string; reason: string }> }>({
    model: STRUCTURE_MODEL, system: RESORT_SYSTEM(plan), user, schema: resortSchema(plan), maxOutputTokens: 8192, timeoutMs: 150_000, temperature: 0.1, reasoningEffort: 'medium',
    label: 'action-resort', stream: 'lex', pass: 'actions.resort', ideaId, userId,
  })
  const priced = res.usage.recorded ?? (await recordUsage(res.usage, { stream: 'lex', pass: 'actions.resort', ideaId, userId, failed: !res.ok }))
  if (!res.ok) return fail(`Lex could not place this group of actions (${(res as { reason: string }).reason}). Nothing in it was moved; actions already placed stay placed.`)
  const byNum = new Map(rows.map((r) => [r.number, r]))
  const by: Record<string, number> = {}
  let moved = 0, unchanged = 0
  for (const a of res.value.actions ?? []) {
    const row = byNum.get(a.number)
    const target = byName.get(norm(a.heading ?? ''))
    if (!row || !target) continue
    byNum.delete(a.number)
    by[a.heading] = (by[a.heading] ?? 0) + 1
    const reason = clip(a.reason, 300) || null
    if (row.headingId === target) { await prisma.lexCoherentAction.update({ where: { id: row.id }, data: { headingReason: reason } }); unchanged++; continue }
    // remember the FIRST heading it was on, so a second re-sort does not erase the way back
    await prisma.lexCoherentAction.update({ where: { id: row.id }, data: { headingId: target, headingReason: reason, headingWasId: row.headingWasId ?? row.headingId ?? 'NONE' } })
    moved++
  }
  return { ok: true, data: { moved, unchanged, notPlaced: byNum.size, pence: priced.pence, byHeading: by } }
}

/** After the batches: archive every heading that is not one of the plan's and holds no live action. A heading that still holds some is left, and reported. */
export async function resortFinish(ideaId: string): Promise<Result<{ archived: string[]; stillHolding: Array<{ name: string; live: number }> }>> {
  const plan = await readHeadingPlan(ideaId)
  if (!plan) return fail('This idea has no instrument headings set. Nothing was changed.')
  const keep = new Set(plan.targets.flatMap((t) => [norm(t.name), ...(t.formerly ?? []).map(norm)]))
  const heads = await prisma.actionHeading.findMany({ where: { ideaId }, select: { id: true, name: true } })
  const live = await prisma.lexCoherentAction.groupBy({ by: ['headingId'], where: { ideaId, status: 'LIVE', headingId: { not: null } }, _count: { _all: true } })
  const count = (id: string) => live.find((l) => l.headingId === id)?._count._all ?? 0
  const archived: string[] = [], stillHolding: Array<{ name: string; live: number }> = []
  for (const h of heads) {
    if (keep.has(norm(h.name))) continue
    if (count(h.id) === 0) { await prisma.actionHeading.update({ where: { id: h.id }, data: { archivedAt: new Date() } }); archived.push(h.name) }
    else stillHolding.push({ name: h.name, live: count(h.id) })
  }
  return { ok: true, data: { archived, stillHolding } }
}

/** Put every action back on the heading it was on before the first re-sort, and bring the archived headings back. Nothing is lost either way. */
export async function undoResort(ideaId: string): Promise<Result<{ restored: number; headingsBack: string[] }>> {
  const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId, headingWasId: { not: null } }, select: { id: true, headingWasId: true } })
  if (!rows.length) return fail('There is no re-sort to undo. Nothing was changed.')
  const archived = await prisma.actionHeading.findMany({ where: { ideaId, archivedAt: { not: null } }, select: { id: true, name: true } })
  const archivedIds = new Set(archived.map((h) => h.id))
  const wanted = new Set(rows.map((r) => r.headingWasId!).filter((id) => archivedIds.has(id)))
  for (const id of wanted) await prisma.actionHeading.update({ where: { id }, data: { archivedAt: null } })
  for (const r of rows) await prisma.lexCoherentAction.update({ where: { id: r.id }, data: { headingId: r.headingWasId === 'NONE' ? null : r.headingWasId, headingWasId: null, headingReason: null } })
  // the reasons the re-sort wrote on actions that did not move go too: Undo leaves the list as if the re-sort had not run
  await prisma.lexCoherentAction.updateMany({ where: { ideaId, headingReason: { not: null } }, data: { headingReason: null } })
  return { ok: true, data: { restored: rows.length, headingsBack: archived.filter((h) => wanted.has(h.id)).map((h) => h.name) } }
}

// ── CONSOLIDATE THIS HEADING ─────────────────────────────────────────────────────────────────────────────────
export async function consolidatePlan(ideaId: string, headingId: string): Promise<Result<{ heading: string; actions: number; estimate: { pence: number; measured: boolean } }>> {
  const h = await prisma.actionHeading.findFirst({ where: { id: headingId, ideaId }, select: { id: true, name: true } })
  if (!h) return fail('That heading is not on this idea.')
  const n = await prisma.lexCoherentAction.count({ where: { ideaId, headingId, status: 'LIVE' } })
  if (n < 2) return fail(`“${h.name}” holds ${n === 0 ? 'no actions' : 'one action'}, so there is nothing to consolidate.`)
  return { ok: true, data: { heading: h.name, actions: n, estimate: consolidateEstimate(n) } }
}

const CONSOLIDATE_SCHEMA = {
  type: 'object',
  properties: {
    mechanisms: { type: 'array', items: { type: 'object', properties: { leadNumber: { type: 'integer' }, componentNumbers: { type: 'array', items: { type: 'integer' } }, reason: { type: 'string' } }, required: ['leadNumber', 'componentNumbers', 'reason'] } },
    duplicates: { type: 'array', items: { type: 'object', properties: { keepNumber: { type: 'integer' }, duplicateNumber: { type: 'integer' }, reason: { type: 'string' } }, required: ['keepNumber', 'duplicateNumber', 'reason'] } },
  },
  required: ['mechanisms', 'duplicates'],
}
const CONSOLIDATE_SYSTEM = (heading: string, purpose: string | null) => [
  M_COHERENT_ACTIONS, '',
  `════ YOU ARE CONSOLIDATING THE ACTIONS UNDER THE HEADING “${heading}”${purpose ? ` (${purpose})` : ''} ════`,
  'A long list hides its few real mechanisms under their parts. Find them - and be CONSERVATIVE: when you are not sure, leave the action alone.',
  '',
  '  mechanisms  A MECHANISM is one action that states a thing to be done. Its COMPONENTS are other actions here that are parts, steps, details or',
  '              elaborations of that same thing, and say nothing the mechanism does not already imply. Give `leadNumber` (the action that states',
  '              the mechanism, which stays as it is), `componentNumbers`, and one sentence `reason`. Do NOT fold actions that have a different',
  '              implementer, a different consequence, or that would stand alone if the other were dropped.',
  '  duplicates  A TRUE DUPLICATE says the same thing as another action in the same words or nearly. Give `keepNumber` (the clearer or fuller one),',
  '              `duplicateNumber`, and a `reason`. A near-miss is not a duplicate.',
  '',
  'Each action may appear in at most ONE group, as a lead, a component, a kept original or a duplicate. A lead is never also a component.',
  'Use only the numbers given. Write nothing that is not a number or a one-sentence reason: the actions\' own words are copied by the system, not by you.',
].join('\n')

export interface ConsolidateResult {
  heading: string
  folded: Array<{ id: string; number: number; intoNumber: number }>
  merged: Array<{ id: string; number: number; intoNumber: number }>
  refused: string[]
  before: number
  after: number
  pence: number | null
}

export async function consolidateHeading(ideaId: string, userId: string, headingId: string): Promise<Result<ConsolidateResult>> {
  const h = await prisma.actionHeading.findFirst({ where: { id: headingId, ideaId }, select: { id: true, name: true, purpose: true } })
  if (!h) return fail('That heading is not on this idea.')
  const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId, headingId, status: 'LIVE' }, orderBy: [{ number: 'asc' }] })
  if (rows.length < 2) return fail(`“${h.name}” holds ${rows.length === 0 ? 'no actions' : 'one action'}, so there is nothing to consolidate.`)
  const user = ['THE ACTIONS UNDER THIS HEADING:', ...rows.map((r) => `[${r.number}] ${clip(r.title, 120)}${r.title ? ': ' : ''}${clip(r.practicalStep, 700)}${r.whoImplements ? ` - implemented by ${clip(r.whoImplements, 120)}` : ''}`)].join('\n')
  const res = await seams.callModelJson<ConsolidationAnswer>({
    model: STRUCTURE_MODEL, system: CONSOLIDATE_SYSTEM(h.name, h.purpose), user, schema: CONSOLIDATE_SCHEMA, maxOutputTokens: 8192, timeoutMs: 150_000, temperature: 0.1, reasoningEffort: 'medium',
    label: 'action-consolidate', stream: 'lex', pass: 'actions.consolidate', ideaId, userId,
  })
  const priced = res.usage.recorded ?? (await recordUsage(res.usage, { stream: 'lex', pass: 'actions.consolidate', ideaId, userId, failed: !res.ok }))
  if (!res.ok) return fail(`Lex could not consolidate “${h.name}” (${(res as { reason: string }).reason}). Nothing was changed.`)
  const v = validateConsolidation(res.value, new Set(rows.map((r) => r.number!).filter((n) => n != null)))
  const byNum = new Map(rows.map((r) => [r.number!, r]))
  const folded: ConsolidateResult['folded'] = [], merged: ConsolidateResult['merged'] = []
  const refused = [...v.refused]

  for (const m of v.mechanisms) {
    const lead = byNum.get(m.lead)!
    const comps = m.components.map((n) => byNum.get(n)!)
    const lines = comps.map((c) => foldLine(c.number!, c.title, c.practicalStep, m.reason))
    const leadCauses = new Set(lead.targetCauseIds), leadConds = new Set(lead.conditionIds)
    const addCauses = new Set<string>(), addConds = new Set<string>()
    await prisma.$transaction(async (tx) => {
      for (const c of comps) {
        const aC = c.targetCauseIds.filter((x) => !leadCauses.has(x)), aD = c.conditionIds.filter((x) => !leadConds.has(x))
        aC.forEach((x) => addCauses.add(x)); aD.forEach((x) => addConds.add(x))
        await tx.lexCoherentAction.update({
          where: { id: c.id },
          data: { status: 'ARCHIVED', foldedIntoId: lead.id, ruleOutReason: `Part of #${lead.number} - Restore puts it back as its own row.`, foldedAdded: { targetCauseIds: aC, conditionIds: aD } as never },
        })
      }
      await tx.lexCoherentAction.update({
        where: { id: lead.id },
        data: {
          commentary: addFoldLines(lead.commentary, lines),
          targetCauseIds: [...new Set([...lead.targetCauseIds, ...addCauses])],
          conditionIds: [...new Set([...lead.conditionIds, ...addConds])],
          ...(addConds.size ? { supportOnly: false } : {}),
        },
      })
    })
    lead.commentary = addFoldLines(lead.commentary, lines)
    for (const c of comps) folded.push({ id: c.id, number: c.number!, intoNumber: lead.number! })
  }
  for (const d of v.duplicates) {
    const out = await applyActionMerge(ideaId, userId, d.keep, d.duplicate, { verdict: 'ONE_CONTAINS_THE_OTHER', reasoning: d.reason, merged: null, subordinateNumber: d.duplicate })
    if (out.ok) merged.push({ id: (out as { data: { archivedIds: string[] } }).data.archivedIds[0], number: d.duplicate, intoNumber: d.keep })
    else refused.push(`#${d.duplicate} into #${d.keep}: ${(out as { error: string }).error}`)
  }
  const after = await prisma.lexCoherentAction.count({ where: { ideaId, headingId, status: 'LIVE' } })
  return { ok: true, data: { heading: h.name, folded, merged, refused, before: rows.length, after, pence: priced.pence } }
}
