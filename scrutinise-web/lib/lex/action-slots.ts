// ─────────────────────────────────────────────────────────────────────────────
// 26-S2 §5 (decision 177) — THE SERVER HALF OF STEP 2, "WHO, HOW AND AGAINST".
//
// Seven slots on every action: Who (the `whoImplements` column) and six in the additive JSON `record` (lib/lex/action-record.ts). ONE
// implementation, called by the route (the screen) and by the Lex tools (the chat), so they cannot drift (docs/CLAUDE.md §25.3).
//
// ⚠ A USER'S ANSWER IS NEVER OVERWRITTEN BY A PROPOSAL. Lex's output is stored BESIDE the answer (`proposal`); accepting copies it, and
// accepting onto an answer the user wrote needs their explicit `replace`. A pass proposes only where there is no answer, and a slot the
// user filled while the pass was running is skipped when its result arrives.
// ⚠ EVERY WRITE RECORDS WHO WROTE IT AND WHEN (`by`, `at`) — the per-field provenance the database lacked (field-mapping report B2).
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { callModelJson } from './model-call'
import { recordUsage } from './spend-ledger'
import { M_COHERENT_ACTIONS, M_GUIDING_POLICY } from './method'
import { LIMITS } from './input-limits'
import { STRUCTURE_MODEL, liveRows, type Result } from './action-structure'
import {
  ALL_SLOTS, SLOT_KEYS, SLOT_UI, DIRECTIONS, parseRecord, slotAnswered, slotProposal,
  type ActionRecord, type AnySlot, type Direction, type SlotKey, type SlotProposal,
} from './action-record'

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '')
const limitFor = (slot: AnySlot) => (slot === 'who' ? LIMITS.whoAnswer : LIMITS.slotAnswer)
const isSlot = (s: string): s is AnySlot => (ALL_SLOTS as readonly string[]).includes(s)

/** The record to store: nothing at all when it is empty. */
const store = (rec: ActionRecord) => (Object.keys(rec).length ? (rec as never) : Prisma.DbNull)

async function load(ideaId: string, actionId: string) {
  return prisma.lexCoherentAction.findFirst({ where: { id: actionId, ideaId, status: 'LIVE' }, select: { id: true, number: true, record: true, whoImplements: true } })
}

// ── the user's own answer ───────────────────────────────────────────────────────────────────────────────────

export interface SlotInput { text: string; direction?: Direction | null; linkActionId?: string | null }

/** Write (or clear, with empty text) one slot. `by` is the writer: the person for the screen, or for a dictated Lex tool call. */
export async function setSlot(ideaId: string, actionId: string, slot: string, input: SlotInput, by: 'USER' | 'LEX' = 'USER'): Promise<Result<{ slot: AnySlot; number: number | null; cleared: boolean }>> {
  if (!isSlot(slot)) return fail(`There is no slot “${slot}”. The slots are ${ALL_SLOTS.join(', ')}. Nothing was changed.`)
  const row = await load(ideaId, actionId)
  if (!row) return fail('That action is not on this idea. Nothing was changed.')
  const text = input.text.replace(/\r\n/g, '\n').trim()
  if (text.length > limitFor(slot)) return fail(`“${SLOT_UI[slot].label}” is limited to ${limitFor(slot)} characters and this is ${text.length}. Shorten it${slot === 'who' ? '' : ', or put the rest in the action’s Detail'}. Nothing was changed.`)
  let linkActionId: string | null = null
  if (slot === 'whatChangesIt' && input.linkActionId) {
    const live = await liveRows(ideaId)
    if (input.linkActionId === actionId || !live.some((r) => r.id === input.linkActionId)) return fail('The action you linked is not on this idea’s live list (or is this action itself). Nothing was changed.')
    linkActionId = input.linkActionId
  }
  const direction = slot === 'incentiveNow' && input.direction && (DIRECTIONS as readonly string[]).includes(input.direction) ? input.direction : null
  const rec = parseRecord(row.record)
  const at = new Date().toISOString()
  const data: Record<string, unknown> = {}
  if (slot === 'who') {
    data.whoImplements = text || null
    const proposal = rec.who?.proposal
    if (text) rec.who = { by, at, ...(proposal ? { proposal } : {}) }
    else if (proposal) rec.who = { by, at: '', proposal }
    else delete rec.who
  } else {
    const proposal = rec[slot]?.proposal
    if (text) rec[slot] = { text, by, at, direction, linkActionId, ...(proposal ? { proposal } : {}) }
    else if (proposal) rec[slot] = { text: '', by, at: '', proposal }
    else delete rec[slot]
  }
  data.record = store(rec)
  await prisma.lexCoherentAction.update({ where: { id: actionId }, data: data as never })
  return { ok: true, data: { slot, number: row.number, cleared: !text } }
}

// ── Lex's proposal: accept / dismiss ─────────────────────────────────────────────────────────────────────────

/** Accept the proposal waiting in a slot. Onto an answer the USER wrote, only with `replace` — a proposal never overwrites by itself. */
export async function acceptSlot(ideaId: string, actionId: string, slot: string, opts: { replace?: boolean } = {}): Promise<Result<{ slot: AnySlot; number: number | null }>> {
  if (!isSlot(slot)) return fail(`There is no slot “${slot}”. Nothing was changed.`)
  const row = await load(ideaId, actionId)
  if (!row) return fail('That action is not on this idea. Nothing was changed.')
  const rec = parseRecord(row.record)
  const p = slotProposal(row, slot)
  if (!p) return fail(`Lex has no proposal waiting for “${SLOT_UI[slot].label}” on #${row.number ?? '?'}. Nothing was changed.`)
  const mine = slotAnswered(row, slot) && (slot === 'who' ? rec.who?.by !== 'LEX' : rec[slot]?.by !== 'LEX')
  if (mine && !opts.replace) return fail(`You have already written an answer for “${SLOT_UI[slot].label}” on #${row.number ?? '?'}. Lex’s proposal stays beside it; choose “Replace mine with this” to use it instead. Nothing was changed.`)
  const at = new Date().toISOString()
  const data: Record<string, unknown> = {}
  if (slot === 'who') {
    data.whoImplements = p.text.slice(0, LIMITS.whoAnswer)
    rec.who = { by: 'LEX', at }
  } else {
    let linkActionId: string | null = null
    if (slot === 'whatChangesIt' && p.linkNumber) linkActionId = (await liveRows(ideaId)).find((r) => r.number === p.linkNumber && r.id !== actionId)?.id ?? null
    rec[slot] = { text: p.text.slice(0, LIMITS.slotAnswer), by: 'LEX', at, direction: slot === 'incentiveNow' ? p.direction ?? null : null, linkActionId }
  }
  data.record = store(rec)
  await prisma.lexCoherentAction.update({ where: { id: actionId }, data: data as never })
  return { ok: true, data: { slot, number: row.number } }
}

export async function dismissSlot(ideaId: string, actionId: string, slot: string): Promise<Result<{ slot: AnySlot }>> {
  if (!isSlot(slot)) return fail(`There is no slot “${slot}”. Nothing was changed.`)
  const row = await load(ideaId, actionId)
  if (!row) return fail('That action is not on this idea. Nothing was changed.')
  const rec = parseRecord(row.record)
  if (!slotProposal(row, slot)) return fail(`There is no proposal waiting for “${SLOT_UI[slot].label}”. Nothing was changed.`)
  if (slot === 'who') {
    if (rec.who?.at) rec.who = { by: rec.who.by, at: rec.who.at }
    else delete rec.who
  } else {
    const { proposal: _p, ...rest } = rec[slot]!
    void _p
    if (rest.text) rec[slot] = rest
    else delete rec[slot]
  }
  await prisma.lexCoherentAction.update({ where: { id: actionId }, data: { record: store(rec) } })
  return { ok: true, data: { slot } }
}

/** Every waiting proposal on the named actions (or all live ones) is dismissed. Answers are untouched. */
export async function dismissAllSlotProposals(ideaId: string, ids?: string[]): Promise<Result<{ dismissed: number }>> {
  const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE', ...(ids ? { id: { in: ids } } : {}) }, select: { id: true, record: true, whoImplements: true } })
  let n = 0
  for (const r of rows) {
    const rec = parseRecord(r.record)
    let changed = false
    if (rec.who?.proposal) { if (rec.who.at) rec.who = { by: rec.who.by, at: rec.who.at }; else delete rec.who; changed = true; n++ }
    for (const k of SLOT_KEYS) {
      const cur = rec[k]
      if (!cur?.proposal) continue
      if (cur.text) { const { proposal: _drop, ...rest } = cur; void _drop; rec[k] = rest } else delete rec[k]
      changed = true; n++
    }
    if (changed) await prisma.lexCoherentAction.update({ where: { id: r.id }, data: { record: store(rec) } })
  }
  return { ok: true, data: { dismissed: n } }
}

/** Lex's own wording for one slot, stored as a PROPOSAL beside the answer (never as the answer). The chat tool's route for "Lex drafts it". */
export async function proposeSlotText(ideaId: string, actionId: string, slot: string, p: { text: string; reason?: string; direction?: Direction | null; linkNumber?: number | null; source?: number | null }): Promise<Result<{ slot: AnySlot; number: number | null }>> {
  if (!isSlot(slot)) return fail(`There is no slot “${slot}”. Nothing was changed.`)
  const row = await load(ideaId, actionId)
  if (!row) return fail('That action is not on this idea. Nothing was changed.')
  const text = clip(p.text, limitFor(slot))
  if (!text) return fail('There is nothing to propose. Nothing was changed.')
  const rec = parseRecord(row.record)
  const proposal: SlotProposal = { text, reason: clip(p.reason, 240), source: p.source ?? null, at: new Date().toISOString(), direction: slot === 'incentiveNow' ? p.direction ?? null : null, linkNumber: slot === 'whatChangesIt' ? p.linkNumber ?? null : null }
  if (slot === 'who') rec.who = { by: rec.who?.by ?? 'LEX', at: rec.who?.at ?? '', proposal }
  else rec[slot] = { text: rec[slot]?.text ?? '', by: rec[slot]?.by ?? 'LEX', at: rec[slot]?.at ?? '', direction: rec[slot]?.direction ?? null, linkActionId: rec[slot]?.linkActionId ?? null, proposal }
  await prisma.lexCoherentAction.update({ where: { id: actionId }, data: { record: store(rec) } })
  return { ok: true, data: { slot, number: row.number } }
}

// ── "Classify with Lex" in step 2, and the per-action "Ask Lex" ───────────────────────────────────────────────

const SLOT_BATCH = 6
const SLOT_ENUM = [...ALL_SLOTS] as string[]

const SLOT_SCHEMA = {
  type: 'object',
  properties: {
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          number: { type: 'integer' },
          slots: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                slot: { type: 'string', enum: SLOT_ENUM },
                text: { type: 'string' },
                reason: { type: 'string' },
                direction: { type: 'string', enum: [...DIRECTIONS, 'NONE'] },
                linkNumber: { type: 'integer' },
                sourceRef: { type: 'integer' },
              },
              required: ['slot', 'text', 'reason', 'direction', 'linkNumber', 'sourceRef'],
            },
          },
        },
        required: ['number', 'slots'],
      },
    },
  },
  required: ['actions'],
} as const

// ⚠ CLAUDE.md §27 — what a prompt SHOWS reaches the output as readily as what it asks for: nothing below is a specimen sentence.
const SLOT_SYSTEM = [
  M_GUIDING_POLICY, '', M_COHERENT_ACTIONS, '',
  '════ YOU ARE PROPOSING ANSWERS FOR STEP 2 OF THE COHERENT ACTIONS — WHO, HOW AND AGAINST. THE USER DECIDES, AND CAN EDIT OR REJECT EVERY ONE ════',
  'An action is only real when someone named will do it, with a reason to, and when you know what will push back.',
  'Each action below lists the slots to ANSWER ("ASK"). Answer only those. For each slot return `slot`, `text`, `reason`, `direction`, `linkNumber`, `sourceRef`:',
  '  who            the body or role that would implement it, and whether it sits inside or outside government. Name a body only where the action or the',
  '                 proposal points to one; otherwise say which KIND of body it would have to be and that the proposal does not name it.',
  '  incentiveNow   `direction` WITH, AGAINST or INDIFFERENT: whether that implementer’s present incentive pulls with the action, against it, or neither.',
  '                 `text` says why, in one or two sentences. (For every other slot `direction` is NONE.)',
  '  whatChangesIt  what in THIS PROPOSAL changes that incentive. Where it is another action on the list, give its number as `linkNumber`. If nothing in the',
  '                 proposal changes it, say so plainly — that is a finding, not a failure. (Otherwise `linkNumber` is 0.)',
  '  skill          why that implementer would — or would not — have the skill to do it. Say so if they would not.',
  '  how            how it is enforced, by whom, and with what consequence for failing.',
  '  against        what will oppose it, naming only the kinds that really apply (strikes, gaming, legal challenge, delay, a body’s own interest), and the counter to each.',
  '  worked         the measure: what would be seen if it worked, and how it would be seen.',
  'RULES. `text` is plain English, at most three sentences. `reason` is ONE line saying what the answer rests on (the action’s wording, the policy, a numbered source).',
  '`sourceRef` is the number of a source from SOURCES, ONLY where you actually used it; otherwise 0. Never invent a source, a figure or a fact about a real body.',
  'If the action and the proposal do not support an answer, say what is missing and answer that — a stated gap is a real answer. Use only the numbers given.',
  'Never carry over a phrase, a subject or a figure from these instructions.',
].join('\n')

/** The model seam (as `modelCaller` in the import): the check stands a model in for it, so the pass is exercised without spend. */
export const slotModel: { current: typeof callModelJson } = { current: callModelJson }

/**
 * A request does at most SLOT_MAX_PER_CALL actions (2 calls of 6; MEASURED 18 Oct: 6 actions took ~70 s, so 12 stay well inside the route's 300 s). `remaining` is how many
 * more still have an open slot with nothing waiting - the screen and the chat tool call again until it is 0. That is "chunked as the import is".
 */
export const SLOT_MAX_PER_CALL = 12
export interface SlotPassResult { proposed: number; actions: number; skipped: number; remaining: number; pence: number | null; calls: number }

interface RawSlot { slot?: unknown; text?: unknown; reason?: unknown; direction?: unknown; linkNumber?: unknown; sourceRef?: unknown }

/**
 * Propose answers for step 2. With `ids` (the per-action "Ask Lex") it asks for every slot that holds no ANSWER on those actions, replacing an old
 * proposal; without (the step's "Classify with Lex") it asks, for every live action, only for the slots with no answer AND no proposal waiting.
 */
export async function proposeSlots(ideaId: string, userId: string | null, opts: { ids?: string[]; model?: typeof callModelJson } = {}): Promise<Result<SlotPassResult>> {
  const call = opts.model ?? slotModel.current
  const [rows, causes, idea, chosen, sources] = await Promise.all([
    prisma.lexCoherentAction.findMany({
      where: { ideaId, status: 'LIVE' }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, number: true, title: true, practicalStep: true, whoImplements: true, wording: true, avenue: true, targetCauseIds: true, record: true, headingId: true },
    }),
    prisma.diagnosisCause.findMany({ where: { ideaId }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }], select: { id: true, number: true, cause: true } }),
    prisma.idea.findUnique({ where: { id: ideaId }, select: { chosenApproach: true } }),
    prisma.policyOption.findFirst({ where: { ideaId, status: 'CHOSEN' as never }, select: { approach: true, rulesOut: true, chainLink: true } }),
    prisma.ideaSource.findMany({ where: { ideaId, archivedAt: null, number: { not: null } }, orderBy: { number: 'asc' }, select: { number: true, title: true, snippet: true } }),
  ])
  if (opts.ids && new Set(rows.filter((r) => opts.ids!.includes(r.id)).map((r) => r.id)).size !== new Set(opts.ids).size) return fail('One of those actions is not on this idea’s live list. Nothing was proposed.')
  const target = rows.filter((r) => !opts.ids || opts.ids.includes(r.id))
  // what to ask, per action
  const asks = new Map<string, AnySlot[]>()
  for (const r of target) {
    const want = ALL_SLOTS.filter((k) => !slotAnswered(r, k) && (opts.ids ? true : !slotProposal(r, k)))
    if (want.length) asks.set(r.id, want)
  }
  const all = target.filter((r) => asks.has(r.id))
  const skipped = target.length - all.length
  if (opts.ids && all.length > SLOT_MAX_PER_CALL) return fail(`Ask for at most ${SLOT_MAX_PER_CALL} actions at a time (you named ${all.length}); for the whole list use “Classify with Lex”, which goes on by itself. Nothing was proposed.`)
  const work = all.slice(0, SLOT_MAX_PER_CALL)
  const remaining = all.length - work.length
  if (!work.length) return { ok: true, data: { proposed: 0, actions: 0, skipped, remaining: 0, pence: 0, calls: 0 } }

  const causeNo = new Map(causes.map((c, i) => [c.id, c.number ?? i + 1]))
  const policy = [
    `SETTLED GUIDING POLICY: ${clip(idea?.chosenApproach || chosen?.approach, 900) || '(none settled)'}`,
    chosen?.chainLink ? `IF ONLY PART IS DELIVERED: ${clip(chosen.chainLink, 600)}` : '',
    chosen?.rulesOut ? `WHAT IT RULES OUT: ${clip(chosen.rulesOut, 600)}` : '',
  ].filter(Boolean).join('\n')
  const everyAction = rows.map((r) => `[${r.number}] ${clip(r.title || r.practicalStep, 140)}`).join('\n')
  const sourceBlock = sources.length ? sources.map((s) => `[Ref: ${s.number}] ${clip(s.title, 100)}${s.snippet ? ` — ${clip(s.snippet, 160)}` : ''}`).join('\n') : '(no sources on this idea)'
  const refs = new Set(sources.map((s) => s.number as number))
  const numberToRow = new Map(rows.map((r) => [r.number, r]))
  const system = SLOT_SYSTEM

  let proposed = 0, pence = 0, unpriced = false, calls = 0, done = 0
  const touched = new Set<string>()

  const runBatch = async (batch: typeof work): Promise<Result<null>> => {
    const user = [
      policy, '', 'THE NUMBERED CAUSES:', causes.map((c, i) => `[${c.number ?? i + 1}] ${clip(c.cause, 200)}`).join('\n') || '(none)', '',
      'EVERY ACTION ON THE LIST (to link “what changes it”):', everyAction, '', 'SOURCES ON THIS IDEA:', sourceBlock, '',
      'ANSWER FOR THESE ACTIONS:',
      ...batch.map((r) => {
        const known = ALL_SLOTS.filter((k) => slotAnswered(r, k)).map((k) => `${SLOT_UI[k].label}: ${clip(slotTextOf(r, k), 240)}`)
        return [
          `[${r.number}] ${clip(r.title, 120)}${r.title ? ' — ' : ''}${clip(r.practicalStep, 700)}`,
          `    avenue: ${r.avenue ?? 'not set'}; attacks causes: ${r.targetCauseIds.map((id) => causeNo.get(id)).filter(Boolean).map((n) => `#${n}`).join(', ') || 'none recorded'}`,
          known.length ? `    ALREADY ANSWERED (stay consistent): ${known.join(' | ')}` : '',
          `    ASK: ${asks.get(r.id)!.join(', ')}`,
        ].filter(Boolean).join('\n')
      }),
    ].join('\n')
    const res = await call<{ actions?: Array<{ number?: number; slots?: RawSlot[] }> }>({
      model: STRUCTURE_MODEL, system, user, schema: SLOT_SCHEMA as never, maxOutputTokens: 8192, timeoutMs: 150_000, temperature: 0.2, reasoningEffort: 'medium',
      label: 'action-slots', stream: 'lex', pass: 'actions.slots', ideaId, userId,
    })
    calls++
    const priced = res.usage.recorded ?? (await recordUsage(res.usage, { stream: 'lex', pass: 'actions.slots', ideaId, userId, failed: !res.ok }))
    if (priced.pence == null) unpriced = true; else pence += priced.pence
    if (!res.ok) {
      const f = res as { reason: string; detail: string }
      console.warn('[action-slots] batch failed', { ideaId, size: batch.length, reason: f.reason, detail: clip(f.detail, 300) })
      if (f.reason === 'truncated' && batch.length > 1) { // too much for one call: split, never an error to the user
        const mid = Math.ceil(batch.length / 2)
        const a = await runBatch(batch.slice(0, mid)); if (!a.ok) return a
        return runBatch(batch.slice(mid))
      }
      return fail(f.reason === 'truncated' ? 'one action was too long to answer in one go' : 'the model did not answer')
    }
    for (const a of res.value.actions ?? []) {
      const row = batch.find((r) => r.number === a.number)
      if (!row) continue
      // re-read just before writing: the user may have answered a slot while the pass ran — an answer is never fought
      const fresh = await prisma.lexCoherentAction.findUnique({ where: { id: row.id }, select: { record: true, whoImplements: true } })
      if (!fresh) continue
      const rec = parseRecord(fresh.record)
      const at = new Date().toISOString()
      let wrote = 0
      for (const s of a.slots ?? []) {
        const slot = String(s.slot ?? '')
        if (!isSlot(slot) || !asks.get(row.id)!.includes(slot) || slotAnswered(fresh, slot)) continue
        const text = clip(s.text, limitFor(slot))
        if (!text) continue
        const direction = slot === 'incentiveNow' && (DIRECTIONS as readonly string[]).includes(String(s.direction)) ? (s.direction as Direction) : null
        const ln = Number(s.linkNumber)
        const linkNumber = slot === 'whatChangesIt' && Number.isInteger(ln) && ln > 0 && ln !== row.number && numberToRow.has(ln) ? ln : null
        const sr = Number(s.sourceRef)
        const proposal: SlotProposal = { text, reason: clip(s.reason, 240), source: Number.isInteger(sr) && refs.has(sr) ? sr : null, at, direction, linkNumber }
        if (slot === 'who') rec.who = { by: rec.who?.by ?? 'LEX', at: rec.who?.at ?? '', proposal }
        else rec[slot] = { text: rec[slot]?.text ?? '', by: rec[slot]?.by ?? 'LEX', at: rec[slot]?.at ?? '', direction: rec[slot]?.direction ?? null, linkActionId: rec[slot]?.linkActionId ?? null, proposal }
        wrote++
      }
      if (wrote) { await prisma.lexCoherentAction.update({ where: { id: row.id }, data: { record: store(rec) } }); proposed += wrote; touched.add(row.id) }
    }
    done += batch.length
    return { ok: true, data: null }
  }

  for (let i = 0; i < work.length; i += SLOT_BATCH) {
    const r = await runBatch(work.slice(i, i + SLOT_BATCH))
    if (!r.ok) return fail(`Lex could not finish proposing (${(r as { error: string }).error}): ${touched.size} of ${work.length} actions were proposed for and saved; the rest are as they were. Nothing you wrote was changed. Press the button again to continue.`)
  }
  void done
  return { ok: true, data: { proposed, actions: touched.size, skipped, remaining: touched.size ? remaining : 0, pence: unpriced ? null : pence, calls } }
}

const slotTextOf = (r: { record: unknown; whoImplements: string | null }, k: AnySlot): string => (k === 'who' ? r.whoImplements ?? '' : parseRecord(r.record)[k]?.text ?? '')
