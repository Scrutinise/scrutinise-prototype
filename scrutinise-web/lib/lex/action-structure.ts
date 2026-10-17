// ─────────────────────────────────────────────────────────────────────────────
// 26-Q — THE SERVER HALF OF "A LONG LIST OF COHERENT ACTIONS, WORKABLE".
//
// Everything the titles-only view, the headings, the facets, merge / compare / duplicates, park and rule-out do to an idea's
// actions lives here — ONE implementation, called by the route (the screen) and by the Lex tools (the chat) alike, so the
// two cannot drift (docs/CLAUDE.md §25.3).
//
// ⚠ NOTHING HERE DELETES AN ACTION. Rule-out and merge keep the row (RULED_OUT / ARCHIVED, restorable); "Delete" in the old
// UI is now `ruleOut`. A heading's deletion unassigns its actions first and removes only the heading.
// ⚠ EVERY MODEL OUTPUT IS A PROPOSAL until the user accepts it: titles (`titleProposal`), facets (`facetProposal`). A merge
// is a JUDGEMENT first (`judgeActionMerge`, writes nothing) and a write only when applied.
// ⚠ EVERYTHING IS SCOPED TO ONE IDEA: every query carries `ideaId`, and an id that is not on this idea resolves to nothing.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { callModelJson } from './model-call'
import { recordUsage } from './spend-ledger'
import { M_COHERENT_ACTIONS, M_GUIDING_POLICY } from './method'
import { colourFor, nextColourKey, HEADING_PALETTE } from './action-headings'
import {
  AVENUES, SEQUENCES, actionLabel, rankDuplicates, coverageGrid, type ActionLike, type DuplicatePair,
} from './action-facets'

/** Pro-class: titles and facets are read by the user as Lex's judgement, and a long list is one call per ~50 actions. */
export const STRUCTURE_MODEL = 'gemini-2.5-pro'
const BATCH = 45
import { LIMITS } from './input-limits'
import { clampStep, type ActionsStep } from './action-steps'
import { TEST_SYSTEM, TEST_SCHEMA, placeGroups } from './action-ideas'
const TITLE_MAX = LIMITS.actionTitle

export type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '')

// ── reading ────────────────────────────────────────────────────────────────────────────────────────────────

const ROW = {
  id: true, number: true, title: true, titleProposal: true, practicalStep: true, whoImplements: true, wording: true, mechanismType: true,
  headingId: true, targetCauseIds: true, avenue: true, link: true, sequence: true, beforeIds: true, facetProposal: true,
  parked: true, parkedReason: true, status: true, ruleOutReason: true, mergedFrom: true, mergedIntoId: true, source: true, orderIndex: true,
} as const

export async function liveRows(ideaId: string) {
  return prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE' }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }], select: ROW })
}
async function causesOf(ideaId: string) {
  const rows = await prisma.diagnosisCause.findMany({ where: { ideaId }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }], select: { id: true, number: true, cause: true } })
  // an old cause with no number is still addressable in a prompt: by its place in the list
  return rows.map((c, i) => ({ id: c.id, number: c.number ?? i + 1, cause: c.cause }))
}
/** Resolve "7" or "#7" or an id prefix to a LIVE action on THIS idea. */
export async function resolveActions(ideaId: string, refs: Array<string | number>) {
  const rows = await liveRows(ideaId)
  const out: typeof rows = []
  const missing: string[] = []
  for (const r of refs) {
    const s = String(r).trim().replace(/^#/, '')
    const hit = /^\d+$/.test(s) ? rows.find((x) => x.number === Number(s)) : rows.filter((x) => x.id.startsWith(s)).length === 1 ? rows.find((x) => x.id.startsWith(s)) : undefined
    if (hit) { if (!out.includes(hit)) out.push(hit) } else missing.push(s)
  }
  return { rows: out, missing }
}

// ── headings (§3) ──────────────────────────────────────────────────────────────────────────────────────────

export async function createHeading(ideaId: string, name: string, colourKey?: string): Promise<Result<{ id: string; name: string; created: boolean }>> {
  const n = clip(name, LIMITS.headingName)
  if (!n) return fail('A heading needs a name.')
  const existing = await prisma.actionHeading.findMany({ where: { ideaId }, select: { id: true, name: true, colourKey: true, orderIndex: true } })
  const same = existing.find((h) => h.name.toLowerCase() === n.toLowerCase())
  if (same) return { ok: true, data: { id: same.id, name: same.name, created: false } }
  const key = colourKey && HEADING_PALETTE.some((c) => c.key === colourKey) ? colourKey : nextColourKey(existing.map((h) => h.colourKey))
  const row = await prisma.actionHeading.create({ data: { ideaId, name: n, colourKey: key, orderIndex: existing.length ? Math.max(...existing.map((h) => h.orderIndex)) + 1 : 0 } })
  return { ok: true, data: { id: row.id, name: row.name, created: true } }
}

export async function updateHeading(ideaId: string, headingId: string, patch: { name?: string; colourKey?: string; hidden?: boolean }): Promise<Result> {
  const h = await prisma.actionHeading.findFirst({ where: { id: headingId, ideaId }, select: { id: true } })
  if (!h) return fail('That heading is not on this idea.')
  const data: Record<string, unknown> = {}
  if (patch.name !== undefined) { const n = clip(patch.name, 60); if (!n) return fail('A heading needs a name.'); data.name = n }
  if (patch.colourKey !== undefined) { if (!HEADING_PALETTE.some((c) => c.key === patch.colourKey)) return fail(`"${patch.colourKey}" is not one of the heading colours.`); data.colourKey = patch.colourKey }
  if (patch.hidden !== undefined) data.hidden = !!patch.hidden
  await prisma.actionHeading.update({ where: { id: headingId }, data: data as never })
  return { ok: true, data: null }
}

/** Removes the HEADING only. Its actions keep everything else and simply lose the heading. */
export async function deleteHeading(ideaId: string, headingId: string): Promise<Result<{ unassigned: number }>> {
  const h = await prisma.actionHeading.findFirst({ where: { id: headingId, ideaId }, select: { id: true } })
  if (!h) return fail('That heading is not on this idea.')
  const un = await prisma.lexCoherentAction.updateMany({ where: { ideaId, headingId }, data: { headingId: null } })
  await prisma.actionHeading.delete({ where: { id: headingId } })
  return { ok: true, data: { unassigned: un.count } }
}

export async function assignHeading(ideaId: string, actionIds: string[], headingId: string | null): Promise<Result<{ assigned: number }>> {
  if (headingId) {
    const h = await prisma.actionHeading.findFirst({ where: { id: headingId, ideaId }, select: { id: true } })
    if (!h) return fail('That heading is not on this idea.')
  }
  const r = await prisma.lexCoherentAction.updateMany({ where: { ideaId, id: { in: actionIds }, status: 'LIVE' }, data: { headingId } })
  // 26-S browser pass: a write that moved NOTHING is a refusal in words, never a quiet success.
  if (r.count === 0) return fail('None of those actions could be moved — they are no longer in the live list. Nothing was changed.')
  return { ok: true, data: { assigned: r.count } }
}

/** "+ New heading…" on the bulk bar: make the heading (or find the one with that name) and put the selected rows on it. One request. */
export async function assignToNewHeading(ideaId: string, actionIds: string[], name: string): Promise<Result<{ headingId: string; name: string; created: boolean; assigned: number }>> {
  const made = await createHeading(ideaId, name)
  if (!made.ok) return fail((made as { error: string }).error)
  const head = (made as { ok: true; data: { id: string; name: string; created: boolean } }).data
  const moved = await assignHeading(ideaId, actionIds, head.id)
  if (!moved.ok) return fail(`${head.created ? `The heading “${head.name}” was made, but` : 'The rows could not be moved:'} ${(moved as { error: string }).error}`)
  return { ok: true, data: { headingId: head.id, name: head.name, created: head.created, assigned: (moved as { ok: true; data: { assigned: number } }).data.assigned } }
}

// ── titles (§1) ────────────────────────────────────────────────────────────────────────────────────────────

export async function setTitle(ideaId: string, actionId: string, title: string | null): Promise<Result> {
  const row = await prisma.lexCoherentAction.findFirst({ where: { id: actionId, ideaId }, select: { id: true } })
  if (!row) return fail('That action is not on this idea.')
  const t = title == null ? null : clip(title, TITLE_MAX) || null
  await prisma.lexCoherentAction.update({ where: { id: actionId }, data: { title: t, titleProposal: null } })
  return { ok: true, data: null }
}

export async function acceptTitleProposals(ideaId: string, ids?: string[]): Promise<Result<{ accepted: number }>> {
  const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE', titleProposal: { not: null }, ...(ids ? { id: { in: ids } } : {}) }, select: { id: true, titleProposal: true } })
  for (const r of rows) await prisma.lexCoherentAction.update({ where: { id: r.id }, data: { title: r.titleProposal, titleProposal: null } })
  return { ok: true, data: { accepted: rows.length } }
}
export async function dismissTitleProposals(ideaId: string, ids?: string[]): Promise<Result<{ dismissed: number }>> {
  const r = await prisma.lexCoherentAction.updateMany({ where: { ideaId, titleProposal: { not: null }, ...(ids ? { id: { in: ids } } : {}) }, data: { titleProposal: null } })
  return { ok: true, data: { dismissed: r.count } }
}

/** A title that is a TOPIC ("Transparency") rather than what the action does. A mechanical flag, not a verdict. */
export function looksLikeATopic(title: string): boolean {
  const words = title.trim().split(/\s+/).filter(Boolean)
  return words.length < 3
}

const TITLE_SCHEMA = {
  type: 'object',
  properties: { titles: { type: 'array', items: { type: 'object', properties: { number: { type: 'integer' }, title: { type: 'string' } }, required: ['number', 'title'] } } },
  required: ['titles'],
}

const TITLE_SYSTEM = [
  M_COHERENT_ACTIONS, '',
  '════ YOU ARE GIVING EACH COHERENT ACTION A SHORT TITLE ════',
  'A title SAYS WHAT THE ACTION DOES — an imperative phrase with a verb and the thing acted on, three to twelve words. It is NOT',
  'a subject label: a title that names a theme or an area (one or two words of topic) is wrong, because it cannot be told from',
  'the next action on the same theme. Two actions on one subject must get titles that differ in what each one DOES.',
  'Use the action\'s own words and its implementer where they sharpen it. Never invent a detail the action does not state.',
  'Never carry over a wording, subject or figure from these instructions or from any other action: each title is about THAT action only.',
  'Return one title per number given, using the number exactly. No preamble.',
].join('\n')

export async function proposeTitles(ideaId: string, userId: string | null): Promise<Result<{ proposed: number; skipped: number; asTopics: number; pence: number | null }>> {
  const rows = (await liveRows(ideaId)).filter((r) => !r.title?.trim())
  if (!rows.length) return { ok: true, data: { proposed: 0, skipped: 0, asTopics: 0, pence: 0 } }
  let proposed = 0, skipped = 0, asTopics = 0, pence = 0, unpriced = false
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const user = batch.map((r) => `[${r.number}] ${clip(r.practicalStep, 700)}${r.whoImplements ? ` — implemented by ${clip(r.whoImplements, 160)}` : ''}`).join('\n')
    const res = await callModelJson<{ titles: Array<{ number: number; title: string }> }>({
      model: STRUCTURE_MODEL, system: TITLE_SYSTEM, user, schema: TITLE_SCHEMA, maxOutputTokens: 4096, timeoutMs: 90_000, reasoningEffort: 'low',
      label: 'action-titles', stream: 'lex', pass: 'actions.titles', ideaId, userId,
    })
    const priced = res.usage.recorded ?? (await recordUsage(res.usage, { stream: 'lex', pass: 'actions.titles', ideaId, userId }))
    if (priced.pence == null) unpriced = true; else pence += priced.pence
    if (!res.ok) return fail(`Lex could not write the titles (${(res as { reason: string }).reason}): ${(res as { detail: string }).detail.slice(0, 200)}`)
    const byNum = new Map(batch.map((r) => [r.number, r]))
    for (const t of res.value.titles ?? []) {
      const row = byNum.get(t.number)
      const title = clip(t.title, TITLE_MAX)
      if (!row || !title) { skipped++; continue }
      if (looksLikeATopic(title)) asTopics++
      await prisma.lexCoherentAction.update({ where: { id: row.id }, data: { titleProposal: title } })
      byNum.delete(t.number); proposed++
    }
    skipped += byNum.size
  }
  return { ok: true, data: { proposed, skipped, asTopics, pence: unpriced ? null : pence } }
}

// ── order, park, rule out (§2c, §7) ──────────────────────────────────────────────────────────────────────

/** Rewrites orderIndex 0..N-1 for the LIVE list in the order given (ids not named follow, in their old order). */
export async function reorder(ideaId: string, orderedIds: string[]): Promise<Result<{ count: number }>> {
  const live = await liveRows(ideaId)
  const known = new Set(live.map((r) => r.id))
  const first = orderedIds.filter((id, i) => known.has(id) && orderedIds.indexOf(id) === i)
  const rest = live.map((r) => r.id).filter((id) => !first.includes(id))
  const order = [...first, ...rest]
  await prisma.$transaction(order.map((id, i) => prisma.lexCoherentAction.update({ where: { id }, data: { orderIndex: i } })))
  return { ok: true, data: { count: order.length } }
}

export async function park(ideaId: string, ids: string[], reason?: string | null): Promise<Result<{ parked: number }>> {
  const r = await prisma.lexCoherentAction.updateMany({ where: { ideaId, id: { in: ids }, status: 'LIVE' }, data: { parked: true, parkedReason: clip(reason, LIMITS.ruleOutReason) || null } })
  return { ok: true, data: { parked: r.count } }
}
export async function unpark(ideaId: string, ids: string[]): Promise<Result<{ unparked: number }>> {
  const r = await prisma.lexCoherentAction.updateMany({ where: { ideaId, id: { in: ids } }, data: { parked: false, parkedReason: null } })
  return { ok: true, data: { unparked: r.count } }
}

export async function ruleOut(ideaId: string, ids: string[], reason: string): Promise<Result<{ ruledOut: number }>> {
  const why = clip(reason, LIMITS.ruleOutReason)
  if (why.length < 3) return fail('Ruling an action out needs a reason — it is kept, with the reason, so you can bring it back.')
  const r = await prisma.lexCoherentAction.updateMany({ where: { ideaId, id: { in: ids }, status: 'LIVE' }, data: { status: 'RULED_OUT', ruleOutReason: why, parked: false } })
  return { ok: true, data: { ruledOut: r.count } }
}
/** Bring a ruled-out or merged-away action back. */
export async function restore(ideaId: string, ids: string[]): Promise<Result<{ restored: number }>> {
  const r = await prisma.lexCoherentAction.updateMany({ where: { ideaId, id: { in: ids }, status: { not: 'LIVE' } }, data: { status: 'LIVE', ruleOutReason: null, mergedIntoId: null } })
  return { ok: true, data: { restored: r.count } }
}

// ── facets (§4) ──────────────────────────────────────────────────────────────────────────────────────────

export interface FacetPatch { targetCauseIds?: string[]; avenue?: string | null; link?: string | null; sequence?: string | null; beforeIds?: string[] }

export async function setFacets(ideaId: string, actionId: string, patch: FacetPatch): Promise<Result> {
  const row = await prisma.lexCoherentAction.findFirst({ where: { id: actionId, ideaId, status: 'LIVE' }, select: { id: true, facetProposal: true } })
  if (!row) return fail('That action is not on this idea.')
  const data: Record<string, unknown> = {}
  const proposal = { ...((row.facetProposal as Record<string, unknown> | null) ?? {}) }
  if (patch.targetCauseIds !== undefined) {
    const ok = new Set((await prisma.diagnosisCause.findMany({ where: { ideaId }, select: { id: true } })).map((c) => c.id))
    const bad = patch.targetCauseIds.filter((c) => !ok.has(c))
    if (bad.length) return fail('One of those causes is not on this idea.')
    data.targetCauseIds = [...new Set(patch.targetCauseIds)]; delete proposal.targetCauseIds
  }
  if (patch.avenue !== undefined) {
    if (patch.avenue !== null && !(AVENUES as readonly string[]).includes(patch.avenue)) return fail(`Avenue must be one of ${AVENUES.join(', ')}.`)
    data.avenue = patch.avenue; delete proposal.avenue
  }
  if (patch.sequence !== undefined) {
    if (patch.sequence !== null && !(SEQUENCES as readonly string[]).includes(patch.sequence)) return fail(`Sequence must be one of ${SEQUENCES.join(', ')}.`)
    data.sequence = patch.sequence; delete proposal.sequence
  }
  if (patch.link !== undefined) { data.link = patch.link === null ? null : clip(patch.link, 160) || null; delete proposal.link }
  if (patch.beforeIds !== undefined) {
    const live = new Set((await liveRows(ideaId)).map((r) => r.id))
    const ids = [...new Set(patch.beforeIds)].filter((x) => x !== actionId)
    if (ids.some((x) => !live.has(x))) return fail('One of those actions is not on this idea\'s live list.')
    data.beforeIds = ids; delete proposal.beforeIds
  }
  data.facetProposal = Object.keys(proposal).length ? proposal : Prisma.DbNull
  await prisma.lexCoherentAction.update({ where: { id: actionId }, data: data as never })
  return { ok: true, data: null }
}

/** The proposal keys that belong to a step (26-S2 §3d): step 1 the causes and avenue, step 4 the sequence and what comes before. Anything else (an old "link") belongs to none. */
const STEP_PROPOSAL_KEYS: Partial<Record<ActionsStep, Array<keyof FacetPatch>>> = { 1: ['targetCauseIds', 'avenue'], 4: ['sequence', 'beforeIds'] }

/** Accept proposals. With a `step`, only that step's keys are accepted and the rest of the proposal stays waiting; without one, all of them (Lex's chat tool). */
export async function acceptFacetProposals(ideaId: string, ids?: string[], step?: ActionsStep): Promise<Result<{ accepted: number }>> {
  const rows = (await prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE', ...(ids ? { id: { in: ids } } : {}) }, select: { id: true, facetProposal: true } })).filter((r) => r.facetProposal != null)
  const mine = step ? STEP_PROPOSAL_KEYS[step] ?? [] : null
  let n = 0
  for (const r of rows) {
    const all = (r.facetProposal ?? {}) as FacetPatch
    const p: FacetPatch = mine ? Object.fromEntries(Object.entries(all).filter(([k]) => mine.includes(k as keyof FacetPatch))) : all
    if (mine && Object.keys(p).length === 0) continue // nothing waiting for THIS step
    const rest = mine ? Object.fromEntries(Object.entries(all).filter(([k]) => !mine.includes(k as keyof FacetPatch))) : {}
    const data: Record<string, unknown> = { facetProposal: Object.keys(rest).length ? rest : Prisma.DbNull }
    if (p.targetCauseIds) data.targetCauseIds = p.targetCauseIds
    if (p.avenue !== undefined) data.avenue = p.avenue
    // decision 167: the "link" facet is retired from the screen — an old proposal's link is dropped, never written
    if (p.sequence !== undefined) data.sequence = p.sequence
    if (p.beforeIds) data.beforeIds = p.beforeIds.filter((x) => x !== r.id)
    await prisma.lexCoherentAction.update({ where: { id: r.id }, data: data as never }); n++
  }
  return { ok: true, data: { accepted: n } }
}
export async function dismissFacetProposals(ideaId: string, ids?: string[], step?: ActionsStep): Promise<Result<{ dismissed: number }>> {
  const rows = (await prisma.lexCoherentAction.findMany({ where: { ideaId, ...(ids ? { id: { in: ids } } : {}) }, select: { id: true, facetProposal: true } })).filter((r) => r.facetProposal != null)
  const mine = step ? STEP_PROPOSAL_KEYS[step] ?? [] : null
  let n = 0
  for (const r of rows) {
    const all = (r.facetProposal ?? {}) as Record<string, unknown>
    const rest = mine ? Object.fromEntries(Object.entries(all).filter(([k]) => !mine.includes(k as keyof FacetPatch))) : {}
    if (mine && Object.keys(rest).length === Object.keys(all).length) continue // nothing of THIS step's to dismiss
    await prisma.lexCoherentAction.update({ where: { id: r.id }, data: { facetProposal: Object.keys(rest).length ? (rest as never) : Prisma.DbNull } }); n++
  }
  return { ok: true, data: { dismissed: n } }
}

// 26-S2 §3d — "Classify with Lex" proposes ONLY the current step's facets: step 1 the causes an action attacks and its avenue; step 4
// its sequence and what it comes before. (Steps 2 and 3 have their own questions — the §5 slots and the cost form — and are not
// classified here.) Decision 167 retired the "link" facet: it is neither asked for nor proposed, and nothing is written to the column.
const FACET_PROPS = {
  causeNumbers: { type: 'array', items: { type: 'integer' } },
  avenue: { type: 'string', enum: [...AVENUES, 'NONE'] },
  sequence: { type: 'string', enum: [...SEQUENCES, 'NONE'] },
  beforeNumbers: { type: 'array', items: { type: 'integer' } },
} as const
const FACET_STEP_KEYS: Record<1 | 4, Array<keyof typeof FACET_PROPS>> = { 1: ['causeNumbers', 'avenue'], 4: ['sequence', 'beforeNumbers'] }

function facetSchema(step: 1 | 4) {
  const keys = FACET_STEP_KEYS[step]
  return {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        items: { type: 'object', properties: { number: { type: 'integer' }, ...Object.fromEntries(keys.map((k) => [k, FACET_PROPS[k]])) }, required: ['number', ...keys] },
      },
    },
    required: ['actions'],
  }
}

const FACET_LINES: Record<keyof typeof FACET_PROPS, string[]> = {
  causeNumbers: ['  causeNumbers   the numbered causes this action directly attacks. Only causes it plainly addresses; an empty list is a real answer.'],
  avenue: [
    '  avenue         LEGISLATIVE (a Bill or regulations), ORGANISATIONAL (how a body works) or FINANCIAL (money) — the avenue it is carried',
    '                 out through — or NONE if it plainly is not any one.',
  ],
  sequence: ['  sequence       NOW (can start at once and unlocks others), NEXT, LATER, or NONE if you cannot tell.'],
  beforeNumbers: [
    '  beforeNumbers  the numbers of the actions THIS one must come before (it unlocks or is a precondition for them). Only real',
    '                 dependencies; do not chain everything. Never its own number.',
  ],
}

function facetSystem(step: 1 | 4): string {
  return [
    M_GUIDING_POLICY, '', M_COHERENT_ACTIONS, '',
    '════ YOU ARE CLASSIFYING COHERENT ACTIONS, AS PROPOSALS THE USER WILL CORRECT ════',
    'For EACH numbered action, return:',
    ...FACET_STEP_KEYS[step].flatMap((k) => FACET_LINES[k]),
    'Use only the numbers given. Do not invent causes or actions. Never carry over a phrase from these instructions.',
  ].join('\n')
}

/** The step "Classify with Lex" works for: the one asked for, else the idea's own. Steps 2 and 3 have nothing to classify. */
async function facetStep(ideaId: string, asked?: ActionsStep): Promise<Result<1 | 4>> {
  const step = asked ?? clampStep((await prisma.idea.findUnique({ where: { id: ideaId }, select: { actionsStep: true } }))?.actionsStep)
  if (step === 1 || step === 4) return { ok: true, data: step }
  return fail(`Classifying is a job for step 1 (causes and avenue) or step 4 (sequence and what comes before); you are in step ${step}, which has its own questions. Nothing was proposed.`)
}

export async function proposeFacets(ideaId: string, userId: string | null, askedStep?: ActionsStep): Promise<Result<{ proposed: number; links: string[]; pence: number | null }>> {
  const fs = await facetStep(ideaId, askedStep)
  if (!fs.ok) return fail((fs as { error: string }).error)
  const step = (fs as { data: 1 | 4 }).data
  const [rows, causes, idea, chosen] = await Promise.all([
    liveRows(ideaId), causesOf(ideaId),
    prisma.idea.findUnique({ where: { id: ideaId }, select: { chosenApproach: true } }),
    prisma.policyOption.findFirst({ where: { ideaId, status: 'CHOSEN' as never }, select: { approach: true, caseFor: true, rulesOut: true, chainLink: true } }),
  ])
  if (!rows.length) return { ok: true, data: { proposed: 0, links: [], pence: 0 } }
  const causeByNum = new Map(causes.map((c) => [c.number, c.id]))
  const policy = [
    `SETTLED GUIDING POLICY: ${clip(idea?.chosenApproach || chosen?.approach, 900) || '(none settled)'}`,
    chosen?.chainLink ? `IF ONLY PART IS DELIVERED: ${clip(chosen.chainLink, 700)}` : '',
    chosen?.rulesOut ? `WHAT IT RULES OUT: ${clip(chosen.rulesOut, 700)}` : '',
  ].filter(Boolean).join('\n')
  const causeBlock = causes.map((c) => `[${c.number}] ${clip(c.cause, 260)}`).join('\n') || '(no causes recorded)'
  const numberToId = new Map(rows.map((r) => [r.number, r.id]))
  let proposed = 0, pence = 0, unpriced = false
  const system = facetSystem(step), schema = facetSchema(step)
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const user = [
      policy, '', ...(step === 1 ? ['THE NUMBERED CAUSES:', causeBlock, ''] : []),
      'ALL THE ACTIONS (for "before" references), numbered:', rows.map((r) => `[${r.number}] ${clip(r.title || r.practicalStep, 160)}`).join('\n'), '',
      'CLASSIFY THESE ACTIONS (full text):', batch.map((r) => `[${r.number}] ${clip(r.practicalStep, 700)}${r.whoImplements ? ` — implemented by ${clip(r.whoImplements, 160)}` : ''}`).join('\n'),
    ].join('\n')
    const res = await callModelJson<{ actions: Array<{ number: number; causeNumbers?: number[]; avenue?: string; sequence?: string; beforeNumbers?: number[] }> }>({
      model: STRUCTURE_MODEL, system, user, schema, maxOutputTokens: 6144, timeoutMs: 120_000, reasoningEffort: 'medium',
      label: 'action-facets', stream: 'lex', pass: 'actions.facets', ideaId, userId,
    })
    const priced = res.usage.recorded ?? (await recordUsage(res.usage, { stream: 'lex', pass: 'actions.facets', ideaId, userId }))
    if (priced.pence == null) unpriced = true; else pence += priced.pence
    if (!res.ok) return fail(`Lex could not classify the actions (${(res as { reason: string }).reason}): ${(res as { detail: string }).detail.slice(0, 200)}`)
    for (const a of res.value.actions ?? []) {
      const row = batch.find((r) => r.number === a.number)
      if (!row) continue
      const p: FacetPatch = {}
      // propose only where the user has nothing — a correction is not fought; and only this step's facets
      if (step === 1) {
        if (!row.targetCauseIds.length) p.targetCauseIds = [...new Set((a.causeNumbers ?? []).map((n) => causeByNum.get(n)).filter((x): x is string => !!x))]
        if (!row.avenue && (AVENUES as readonly string[]).includes(a.avenue ?? '')) p.avenue = a.avenue
      } else {
        if (!row.sequence && (SEQUENCES as readonly string[]).includes(a.sequence ?? '')) p.sequence = a.sequence
        if (!row.beforeIds.length) p.beforeIds = [...new Set((a.beforeNumbers ?? []).filter((n) => n !== row.number).map((n) => numberToId.get(n)).filter((x): x is string => !!x))]
      }
      if (Object.keys(p).length) {
        // merge into any proposal already waiting (the other step's) rather than replacing it
        const waiting = ((await prisma.lexCoherentAction.findUnique({ where: { id: row.id }, select: { facetProposal: true } }))?.facetProposal ?? {}) as FacetPatch
        await prisma.lexCoherentAction.update({ where: { id: row.id }, data: { facetProposal: { ...waiting, ...p } as never } }); proposed++
      }
    }
  }
  return { ok: true, data: { proposed, links: [], pence: unpriced ? null : pence } }
}

// ── 26-S2 §4 (decision 170) — "TEST AGAINST THE POLICY": the same test as the import's, for rows that were never tested ──────────────
//
// The import tests each row with the consolidation's own words and schema (`TEST_SYSTEM` / `TEST_SCHEMA`, action-ideas.ts) and every row it
// writes carries a verdict. Rows from before that — build-era actions, the user's own — read "? Not tested". This runs the SAME test on them
// (or, with `ids`, again on named ones: an action that was edited after a ✗ Conflicts is re-tested rather than argued with). Each batch is
// written as it completes, so a failure part-way keeps what was tested and says how many were.
const POLICY_TEST_BATCH = 25
const POLICY_TEST_ONE_BY_ONE = [
  '',
  '⚠ HERE EVERY GROUP HAS EXACTLY ONE MEMBER. These actions are already on the user\'s list and are judged one by one; do not merge any of them,',
  'whatever they have in common. The `text` of each group is that action\'s own wording.',
].join('\n')

export async function testAgainstPolicy(ideaId: string, userId: string | null, opts: { ids?: string[] } = {}): Promise<Result<{
  tested: number; counts: Record<string, number>; pence: number | null; batches: number; noPolicy?: false
}>> {
  const chosen = await prisma.policyOption.findFirst({ where: { ideaId, status: 'CHOSEN' as never }, select: { approach: true, rulesOut: true, chainLink: true } })
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { chosenApproach: true } })
  const policy = clip(idea?.chosenApproach || chosen?.approach, 1200)
  if (!policy) return fail('There is no accepted Guiding Policy on this idea yet, so there is nothing to test the actions against. Settle the policy first. Nothing was changed.')
  const all = await prisma.lexCoherentAction.findMany({
    where: { ideaId, status: 'LIVE', ...(opts.ids ? { id: { in: opts.ids } } : {}) },
    select: { id: true, number: true, title: true, practicalStep: true, policyTestVerdict: true }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
  })
  if (opts.ids && all.length !== new Set(opts.ids).size) return fail('One of those actions is not on this idea’s live list. Nothing was tested.')
  const rows = opts.ids ? all : all.filter((r) => !r.policyTestVerdict || r.policyTestVerdict === 'NOT_TESTED')
  const counts: Record<string, number> = { FITS: 0, DOES_NOT_FIT: 0, CONFLICTS: 0, NOT_TESTED: 0 }
  if (!rows.length) return { ok: true, data: { tested: 0, counts, pence: 0, batches: 0 } }
  const user0 = [
    'THE FINAL GUIDING POLICY',
    `Policy: ${policy}`,
    chosen?.rulesOut ? `What it rules out: ${clip(chosen.rulesOut, 700)}` : '',
    chosen?.chainLink ? `If only part is delivered: ${clip(chosen.chainLink, 700)}` : '',
    '', 'THE CANDIDATE ACTIONS',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '')
  let tested = 0, pence = 0, unpriced = false, batches = 0
  for (let i = 0; i < rows.length; i += POLICY_TEST_BATCH) {
    const batch = rows.slice(i, i + POLICY_TEST_BATCH)
    const user = [...user0, ...batch.map((r, k) => `[${k}] ${clip(r.title || '', 120)}${r.title ? ': ' : ''}${clip(r.practicalStep, 600)}`)].join('\n')
    const res = await callModelJson<{ groups?: Array<{ members?: unknown; text?: unknown; verdict?: unknown; reason?: unknown }> }>({
      model: STRUCTURE_MODEL, system: TEST_SYSTEM + POLICY_TEST_ONE_BY_ONE, user, schema: TEST_SCHEMA as never, maxOutputTokens: 8192, timeoutMs: 120_000,
      temperature: 0.1, reasoningEffort: 'medium', label: 'action-policy-test', stream: 'lex', pass: 'actions.policy-test', ideaId, userId,
    })
    const priced = res.usage.recorded ?? (await recordUsage(res.usage, { stream: 'lex', pass: 'actions.policy-test', ideaId, userId, failed: !res.ok }))
    if (priced.pence == null) unpriced = true; else pence += priced.pence
    batches++
    if (!res.ok) {
      console.warn('[action-policy-test] failed', { ideaId, reason: (res as { reason: string }).reason, detail: clip((res as { detail: string }).detail, 300) })
      return fail(`Testing did not finish: ${tested} of ${rows.length} actions were tested and saved; the rest still read “? Not tested”. Press “Test against the policy” again to continue.`)
    }
    for (const g of placeGroups(res.value.groups, batch.map((r) => r.title || r.practicalStep))) {
      for (const mem of g.members) {
        const row = batch[mem]
        await prisma.lexCoherentAction.update({ where: { id: row.id }, data: { policyTestVerdict: g.verdict, policyTestReason: g.reason || null } })
        counts[g.verdict] = (counts[g.verdict] ?? 0) + 1; tested++
      }
    }
  }
  return { ok: true, data: { tested, counts, pence: unpriced ? null : pence, batches } }
}

// ── 26-S2 §3 — the step the user is on, and "kept with a note" ───────────────────────────────────────────────

/** Stores the step (1–4) so the idea opens where the user left it. */
export async function setStep(ideaId: string, step: number): Promise<Result<{ step: ActionsStep }>> {
  const s = clampStep(step)
  if (s !== step) return fail(`There is no step ${step}: the steps are 1 Sort and prune, 2 Who, how and against, 3 Costs, 4 Order. Nothing was changed.`)
  await prisma.idea.update({ where: { id: ideaId }, data: { actionsStep: s } })
  return { ok: true, data: { step: s } }
}

/** "Kept with a note": the reason the user keeps an action the policy test says CONFLICTS. An empty note clears it. The verdict is never edited. */
export async function keepConflict(ideaId: string, actionId: string, note: string | null): Promise<Result<{ kept: boolean }>> {
  const row = await prisma.lexCoherentAction.findFirst({ where: { id: actionId, ideaId, status: 'LIVE' }, select: { id: true, number: true, policyTestVerdict: true } })
  if (!row) return fail('That action is not on this idea’s live list. Nothing was changed.')
  const text = (note ?? '').replace(/\s+/g, ' ').trim()
  if (text.length > LIMITS.ruleOutReason) return fail(`The note is ${text.length} characters; the limit is ${LIMITS.ruleOutReason}. Nothing was saved.`)
  if (text && row.policyTestVerdict !== 'CONFLICTS') return fail(`#${row.number ?? '?'} does not conflict with the policy (the test says ${row.policyTestVerdict ? row.policyTestVerdict.toLowerCase().replace(/_/g, ' ') : 'it was not tested'}), so there is nothing to keep with a note. Nothing was saved.`)
  await prisma.lexCoherentAction.update({ where: { id: row.id }, data: { conflictNote: text || null } })
  return { ok: true, data: { kept: !!text } }
}

// ── headings suggested from the guiding policy (§3c) ─────────────────────────────────────────────────────

const HEADING_SCHEMA = {
  type: 'object',
  properties: { headings: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, why: { type: 'string' } }, required: ['name', 'why'] } } },
  required: ['headings'],
}
const HEADING_SYSTEM = [
  M_GUIDING_POLICY, '',
  '════ YOU ARE OFFERING STARTING HEADINGS FOR A LIST OF COHERENT ACTIONS ════',
  'Read the SETTLED GUIDING POLICY and offer four to eight short headings the user could sort their actions under. They should come',
  'from the policy itself. FIRST the BINDING LINKS it depends on — the things that must hold together for it to work, which the',
  '"if only part is delivered" text and the policy\'s own clauses point at. Name each link in the POLICY\'S OWN WORDS, shortened to',
  'two to five words; do not translate them into generic management vocabulary. THEN, only if the policy implies them, the',
  'cross-cutting concerns (for example how it is made visible, or how it is moved into place). Write each heading in plain sentence',
  'case (a capital on the first word only). `why` is one sentence saying what belongs under it. The user may accept, rename or ignore each.',
  'Use only what the policy supports. Never carry over a heading, subject or phrase from these instructions.',
].join('\n')

export async function suggestHeadings(ideaId: string, userId: string | null): Promise<Result<{ suggestions: Array<{ name: string; why: string }>; basis: string; pence: number | null }>> {
  const [idea, chosen] = await Promise.all([
    prisma.idea.findUnique({ where: { id: ideaId }, select: { chosenApproach: true } }),
    prisma.policyOption.findFirst({ where: { ideaId, status: 'CHOSEN' as never }, select: { approach: true, caseFor: true, rulesOut: true, chainLink: true } }),
  ])
  const statement = clip(idea?.chosenApproach || chosen?.approach, 900)
  if (!statement) return fail('There is no settled guiding policy yet, so there is nothing to draw starting headings from. Create your own, or settle the policy first.')
  const user = [`SETTLED GUIDING POLICY: ${statement}`, chosen?.chainLink ? `IF ONLY PART IS DELIVERED: ${clip(chosen.chainLink, 700)}` : '', chosen?.rulesOut ? `WHAT IT RULES OUT: ${clip(chosen.rulesOut, 700)}` : '', chosen?.caseFor ? `THE CASE FOR IT: ${clip(chosen.caseFor, 700)}` : ''].filter(Boolean).join('\n')
  const res = await callModelJson<{ headings: Array<{ name: string; why: string }> }>({
    model: STRUCTURE_MODEL, system: HEADING_SYSTEM, user, schema: HEADING_SCHEMA, maxOutputTokens: 2048, timeoutMs: 90_000, reasoningEffort: 'low',
    label: 'action-headings', stream: 'lex', pass: 'actions.headings', ideaId, userId,
  })
  const priced = res.usage.recorded ?? (await recordUsage(res.usage, { stream: 'lex', pass: 'actions.headings', ideaId, userId }))
  if (!res.ok) return fail(`Lex could not suggest headings (${(res as { reason: string }).reason}).`)
  const seen = new Set<string>()
  const suggestions = (res.value.headings ?? []).map((h) => ({ name: clip(h.name, 60), why: clip(h.why, 240) })).filter((h) => h.name && !seen.has(h.name.toLowerCase()) && !!seen.add(h.name.toLowerCase())).slice(0, 8)
  return { ok: true, data: { suggestions, basis: statement, pence: priced.pence } }
}

// ── merge and compare (§5) ───────────────────────────────────────────────────────────────────────────────

export type ActionMergeVerdict = 'MERGE' | 'ONE_CONTAINS_THE_OTHER' | 'SEQUENCE' | 'CONTRADICTORY'
export interface ActionMergeAnswer {
  verdict: ActionMergeVerdict
  reasoning: string
  /** MERGE: the one action written as one thing. ONE_CONTAINS: the container's text restated, or null where it already says it all. */
  merged: { title: string; practicalStep: string } | null
  /** ONE_CONTAINS: the number to fold away. SEQUENCE: the number that goes later. */
  subordinateNumber: number | null
}

const MERGE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['MERGE', 'ONE_CONTAINS_THE_OTHER', 'SEQUENCE', 'CONTRADICTORY'] },
    reasoning: { type: 'string' },
    merged: { type: 'object', properties: { title: { type: 'string' }, practicalStep: { type: 'string' } }, required: ['title', 'practicalStep'] },
    subordinateNumber: { type: 'integer' },
  },
  required: ['verdict', 'reasoning'],
}
const MERGE_SYSTEM = [
  M_COHERENT_ACTIONS, '',
  '════ THE USER HAS ASKED YOU TO MERGE, OR COMPARE, TWO COHERENT ACTIONS ════',
  'Answer with exactly ONE of four verdicts and the reasoning for it, in the numbers the user used.',
  '  MERGE                   The two are parts of ONE thing to do and each is needed. Write that one action in `merged`: a `title` that says',
  '                          what it does, and `practicalStep` written as ONE action — not two paragraphs joined with "and". If you cannot',
  '                          write it as one action they are not a merge.',
  '  ONE_CONTAINS_THE_OTHER  One already covers the other (a near-duplicate, or one is a step of the other). Put the number to fold away in',
  '                          `subordinateNumber`. If the subordinate adds anything the container lacks, restate the CONTAINER in `merged` so it',
  '                          is not lost; leave `merged` out ONLY where the container already says it all.',
  '  SEQUENCE                Both are real and separate: one should happen first. Put the one that goes LATER in `subordinateNumber`.',
  '  CONTRADICTORY           They cannot both be done — say specifically WHICH two things cannot both hold.',
  'A legislative action and the operational action that makes it bite are normally a MERGE or ONE_CONTAINS, not a contradiction.',
  'Never carry over wording from these instructions. Write for the person who typed the numbers.',
].join('\n')

export async function judgeActionMerge(ideaId: string, userId: string | null, na: number, nb: number): Promise<Result<{ answer: ActionMergeAnswer; a: { id: string; number: number }; b: { id: string; number: number }; pence: number | null }>> {
  if (na === nb) return fail('Those are the same action.')
  const { rows, missing } = await resolveActions(ideaId, [na, nb])
  if (missing.length || rows.length < 2) return fail(`There is no live action ${missing.length ? missing.map((m) => `#${m}`).join(' or ') : 'matching'} on this idea.`)
  const [A, B] = [rows.find((r) => r.number === na)!, rows.find((r) => r.number === nb)!]
  const causes = await causesOf(ideaId)
  const cl = (r: typeof A) => r.targetCauseIds.map((id) => causes.find((c) => c.id === id)?.number).filter(Boolean).join(', ') || 'none recorded'
  const user = [
    `ACTION ${A.number}${A.title ? ` — ${A.title}` : ''}: ${clip(A.practicalStep, 1200)}${A.whoImplements ? ` (implemented by ${clip(A.whoImplements, 200)})` : ''} [causes attacked: ${cl(A)}]`,
    `ACTION ${B.number}${B.title ? ` — ${B.title}` : ''}: ${clip(B.practicalStep, 1200)}${B.whoImplements ? ` (implemented by ${clip(B.whoImplements, 200)})` : ''} [causes attacked: ${cl(B)}]`,
    '', 'THE NUMBERED CAUSES:', causes.map((c) => `[${c.number}] ${clip(c.cause, 220)}`).join('\n') || '(none)',
  ].join('\n')
  const res = await callModelJson<ActionMergeAnswer>({
    model: STRUCTURE_MODEL, system: MERGE_SYSTEM, user, schema: MERGE_SCHEMA, maxOutputTokens: 3000, timeoutMs: 90_000, reasoningEffort: 'medium',
    label: 'action-merge', stream: 'lex', pass: 'actions.merge-judge', ideaId, userId,
  })
  const priced = res.usage.recorded ?? (await recordUsage(res.usage, { stream: 'lex', pass: 'actions.merge-judge', ideaId, userId }))
  if (!res.ok) return fail(`Lex could not judge the pair (${(res as { reason: string }).reason}).`)
  const a = res.value
  if (!a?.verdict || !a.reasoning?.trim()) return fail('Lex returned no verdict for that pair.')
  // a MERGE with nothing merged is not a merge (the policy merge's own rule)
  if (a.verdict === 'MERGE' && !(a.merged?.practicalStep ?? '').trim()) return fail('Lex said MERGE but wrote no merged action, so nothing was applied. Try again.')
  return { ok: true, data: { answer: a, a: { id: A.id, number: A.number! }, b: { id: B.id, number: B.number! }, pence: priced.pence } }
}

/** Apply a MERGE or ONE_CONTAINS verdict. The originals are KEPT (ARCHIVED, pointing at the result), cost lines carried. */
export async function applyActionMerge(ideaId: string, userId: string, na: number, nb: number, answer: ActionMergeAnswer): Promise<Result<{ kind: 'MERGED' | 'ENHANCED'; resultId: string; resultNumber: number; archivedIds: string[] }>> {
  if (answer.verdict !== 'MERGE' && answer.verdict !== 'ONE_CONTAINS_THE_OTHER') return fail('Only a merge, or one action containing the other, is applied; the other two verdicts are advice.')
  const { rows } = await resolveActions(ideaId, [na, nb])
  const A = rows.find((r) => r.number === na), B = rows.find((r) => r.number === nb)
  if (!A || !B) return fail('One of those actions is no longer on the live list.')
  const union = (x: string[], y: string[]) => [...new Set([...x, ...y])]
  const earliest = (x: string | null, y: string | null) => { const r = ['NOW', 'NEXT', 'LATER']; const c = [x, y].filter((v): v is string => !!v && r.includes(v)); return c.length ? c.sort((p, q) => r.indexOf(p) - r.indexOf(q))[0] : null }
  const lines = await prisma.costLine.findMany({ where: { actionId: { in: [A.id, B.id] } } })
  const copyLines = (toId: string, fromIds: string[]) => lines.filter((l) => fromIds.includes(l.actionId)).map((l) => ({
    actionId: toId, label: l.label, costType: l.costType, category: l.category, staffLevel: l.staffLevel, fteCount: l.fteCount, durationMonths: l.durationMonths,
    low: l.low, high: l.high, unit: l.unit, basis: l.basis, benchmarkId: l.benchmarkId, priceYear: l.priceYear, orderIndex: l.orderIndex,
  }))

  if (answer.verdict === 'MERGE') {
    const full = await prisma.lexCoherentAction.findMany({ where: { id: { in: [A.id, B.id] } } })
    const fa = full.find((x) => x.id === A.id)!, fb = full.find((x) => x.id === B.id)!
    const made = await prisma.$transaction(async (tx) => {
      const row = await tx.lexCoherentAction.create({
        data: {
          ideaId, practicalStep: clip(answer.merged!.practicalStep, 2000), title: clip(answer.merged!.title, TITLE_MAX) || null,
          mechanismType: fa.mechanismType ?? fb.mechanismType, whoImplements: fa.whoImplements ?? fb.whoImplements,
          targetOrganisation: fa.targetOrganisation ?? fb.targetOrganisation, wording: fa.wording ?? fb.wording,
          benefits: (fa.benefits ?? fb.benefits ?? undefined) as never, implementationCost: (fa.implementationCost ?? fb.implementationCost ?? undefined) as never,
          enforcementCost: (fa.enforcementCost ?? fb.enforcementCost ?? undefined) as never, regulatoryFriction: (fa.regulatoryFriction ?? fb.regulatoryFriction ?? undefined) as never,
          source: (fa.source === 'LEX' && fb.source === 'LEX' ? 'LEX' : 'USER') as never, orderIndex: Math.min(fa.orderIndex, fb.orderIndex),
          headingId: fa.headingId ?? fb.headingId, targetCauseIds: union(fa.targetCauseIds, fb.targetCauseIds),
          avenue: fa.avenue === fb.avenue ? fa.avenue : (fa.avenue ?? fb.avenue), link: fa.link ?? fb.link, sequence: earliest(fa.sequence, fb.sequence),
          beforeIds: union(fa.beforeIds, fb.beforeIds).filter((x) => x !== fa.id && x !== fb.id), mergedFrom: [fa.number!, fb.number!], parked: fa.parked && fb.parked,
        },
        select: { id: true, number: true },
      })
      const cl = copyLines(row.id, [A.id, B.id])
      if (cl.length) await tx.costLine.createMany({ data: cl as never })
      await tx.lexCoherentAction.updateMany({ where: { id: { in: [A.id, B.id] } }, data: { status: 'ARCHIVED', mergedIntoId: row.id, ruleOutReason: `Merged into ${row.number}.` } })
      // anything that had to come BEFORE a parent now has to come before the result
      const pointing = await tx.lexCoherentAction.findMany({ where: { ideaId, beforeIds: { hasSome: [A.id, B.id] } }, select: { id: true, beforeIds: true } })
      for (const p of pointing) await tx.lexCoherentAction.update({ where: { id: p.id }, data: { beforeIds: [...new Set(p.beforeIds.map((x) => (x === A.id || x === B.id ? row.id : x)))].filter((x) => x !== p.id) } })
      return row
    })
    return { ok: true, data: { kind: 'MERGED', resultId: made.id, resultNumber: made.number!, archivedIds: [A.id, B.id] } }
  }

  // ONE_CONTAINS_THE_OTHER
  const subNum = answer.subordinateNumber
  if (subNum !== na && subNum !== nb) return fail('Lex did not say which of the two to fold away.')
  const sub = subNum === na ? A : B, con = subNum === na ? B : A
  const full = await prisma.lexCoherentAction.findMany({ where: { id: { in: [sub.id, con.id] } } })
  const fs = full.find((x) => x.id === sub.id)!, fc = full.find((x) => x.id === con.id)!
  await prisma.$transaction(async (tx) => {
    if (answer.merged?.practicalStep?.trim() && clip(answer.merged.practicalStep, 2000) !== fc.practicalStep) {
      // the container's prior wording is kept — the same record the guiding-policy enhance writes
      await tx.fieldRevision.create({ data: { ideaId, fieldKey: 'actions', targetId: fc.id, targetNumber: fc.number, previousText: fc.practicalStep, previousSource: fc.source, newText: clip(answer.merged.practicalStep, 2000), acceptedById: userId, origin: 'ACTION_MERGE' } })
    }
    await tx.lexCoherentAction.update({
      where: { id: fc.id },
      data: {
        ...(answer.merged?.practicalStep?.trim() ? { practicalStep: clip(answer.merged.practicalStep, 2000) } : {}),
        ...(answer.merged?.title?.trim() ? { title: clip(answer.merged.title, TITLE_MAX) } : {}),
        whoImplements: fc.whoImplements ?? fs.whoImplements, wording: fc.wording ?? fs.wording,
        targetCauseIds: union(fc.targetCauseIds, fs.targetCauseIds), mergedFrom: union(fc.mergedFrom.map(String), [String(fs.number)]).map(Number),
        beforeIds: union(fc.beforeIds, fs.beforeIds).filter((x) => x !== fc.id && x !== fs.id),
      },
    })
    const cl = copyLines(fc.id, [fs.id])
    if (cl.length) await tx.costLine.createMany({ data: cl as never })
    await tx.lexCoherentAction.update({ where: { id: fs.id }, data: { status: 'ARCHIVED', mergedIntoId: fc.id, ruleOutReason: `Folded into ${fc.number}.` } })
    const pointing = await tx.lexCoherentAction.findMany({ where: { ideaId, beforeIds: { has: fs.id } }, select: { id: true, beforeIds: true } })
    for (const p of pointing) await tx.lexCoherentAction.update({ where: { id: p.id }, data: { beforeIds: [...new Set(p.beforeIds.map((x) => (x === fs.id ? fc.id : x)))].filter((x) => x !== p.id) } })
  })
  return { ok: true, data: { kind: 'ENHANCED', resultId: fc.id, resultNumber: fc.number!, archivedIds: [fs.id] } }
}

/** Undo a MERGE: the originals come back and the merged action is ruled out ("Merge undone"), not deleted. */
export async function undoActionMerge(ideaId: string, mergedId: string): Promise<Result<{ restored: number }>> {
  const row = await prisma.lexCoherentAction.findFirst({ where: { id: mergedId, ideaId }, select: { id: true } })
  if (!row) return fail('That action is not on this idea.')
  const parents = await prisma.lexCoherentAction.updateMany({ where: { ideaId, mergedIntoId: mergedId }, data: { status: 'LIVE', mergedIntoId: null, ruleOutReason: null } })
  await prisma.lexCoherentAction.update({ where: { id: mergedId }, data: { status: 'RULED_OUT', ruleOutReason: 'Merge undone.' } })
  return { ok: true, data: { restored: parents.count } }
}

// ── duplicates and the gap (§5b, §6a) ────────────────────────────────────────────────────────────────────

export interface DuplicateView extends DuplicatePair { aNumber: number | null; bNumber: number | null; aLabel: string; bLabel: string }
export async function findDuplicates(ideaId: string): Promise<{ pairs: DuplicateView[]; ignoredUniversalCauses: Array<{ number: number; cause: string }> }> {
  const [rows, causes] = await Promise.all([liveRows(ideaId), causesOf(ideaId)])
  const r = rankDuplicates(rows)
  const by = new Map(rows.map((x) => [x.id, x]))
  return {
    pairs: r.pairs.map((p) => ({ ...p, aNumber: by.get(p.a)?.number ?? null, bNumber: by.get(p.b)?.number ?? null, aLabel: actionLabel(by.get(p.a)!), bLabel: actionLabel(by.get(p.b)!) })),
    ignoredUniversalCauses: r.ignoredUniversalCauseIds.map((id) => causes.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c).map((c) => ({ number: c.number, cause: c.cause })),
  }
}

export async function causesWithoutAction(ideaId: string) {
  const [rows, causes] = await Promise.all([liveRows(ideaId), causesOf(ideaId)])
  const grid = coverageGrid(rows as ActionLike[], causes)
  return { uncovered: grid.uncovered.map((u) => ({ number: u.number, cause: u.cause })), recorded: grid.recorded }
}
