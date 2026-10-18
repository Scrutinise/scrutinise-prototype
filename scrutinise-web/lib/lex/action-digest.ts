// ─────────────────────────────────────────────────────────────────────────────
// 26-T1 §2 (decisions 146, 200, 201) — THE DIGEST, SERVER HALF. One implementation, called by the route (the screen) and by Lex's tools.
//
//   start    → validate the scope, read the actions, write the row (`ActionDigest`, status RUNNING, four panel slots PENDING).
//   advance  → ONE stage per call, so each request is inside the function limit and a closed tab loses nothing:
//                RUNNING     → the four models, in parallel (a failure is reported, never silent) → MODELS_DONE
//                MODELS_DONE → the judge → READY
//   retry    → re-run the models that failed (only those).
//
// ⚠ NOTHING HERE WRITES AN ACTION. The judge's gaps become SUGGESTIONS only when the user presses the button (`suggestGaps`), and a
//   suggestion becomes an action only on the existing accept in gap-check.ts. A model's proposed condition is written as a PROPOSAL in the
//   conditions panel (decision 201) - never as a condition.
// ⚠ ONE RUN AT A TIME PER STAGE: a stage is CLAIMED with an atomic status change (RUNNING→WORKING_MODELS, MODELS_DONE→WORKING_JUDGE); a
//   claim older than a function's limit is an orphan and may be taken again.
// ⚠ A STALE DIGEST SAYS SO: the ids of the live actions it read are stored, and every read compares them with the live list now.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { callModelJson, type LlmFail } from './model-call'
import { recordUsage } from './spend-ledger'
import { PREMIUM_DRAFT_MODELS, PANEL_FALLBACKS, DRAFT_REASONING_EFFORT } from './guiding-policy-consolidate'
import { parseRecord, slotText, type AnySlot } from './action-record'
import { activeConditions } from './action-conditions'
import { readConditions, proposeCondition } from './action-conditions-server'
import { actionLabel } from './action-facets'
import type { GapSource } from './gap-check'
import {
  DIGEST_QUESTIONS, DIGEST_SYSTEM, JUDGE_SYSTEM, MODEL_SCHEMA, JUDGE_SCHEMA, dataBlock, digestUserPrompt, judgeUserPrompt, parseModelAnswer, parseJudge,
  conditionTable, staleness, digestLine, staleSentence, refsIn, digestPrice,
  type DigestAction, type DigestContext, type DigestScope, type DigestHandled, type StoredModelOutput, type StoredJudge, type DigestView, type DigestQuote,
} from './action-digest-pure'

export type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

/** Longer than the route's `maxDuration` (300 s): a claim this old can only be an orphan from a dead request. */
const IN_FLIGHT_MS = 6 * 60_000
const JUDGE_MODEL = 'claude-opus-5-5'
const MODEL_TIMEOUT_MS: Record<DigestScope, number> = { HEADING: 150_000, SET: 240_000 }
const GROK_EXTRA_MS = 50_000
const MODEL_MAX_OUTPUT = 16_000
const JUDGE_MAX_OUTPUT = 20_000
/** The stage must finish well inside `maxDuration = 300` (the writes come after). */
const STAGE_BUDGET_MS = 265_000
const MIN_FALLBACK_MS = 45_000

// ── reading the scope ───────────────────────────────────────────────────────────────────────────────────────────

export interface ScopeRead {
  ctx: DigestContext
  actions: DigestAction[]
  /** Ids of the live actions in scope, in list order - what the digest "read". */
  ids: string[]
  headingName: string | null
  scopeWords: string
}

export async function readScope(ideaId: string, scope: DigestScope, headingId: string | null): Promise<Result<ScopeRead>> {
  const [idea, causes, headings, rows, policy, cond] = await Promise.all([
    prisma.idea.findUnique({ where: { id: ideaId }, select: { challenge: true, summaryDescription: true, pivotalObstacle: true } }),
    prisma.diagnosisCause.findMany({ where: { ideaId }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }], select: { id: true, number: true, cause: true } }),
    prisma.actionHeading.findMany({ where: { ideaId }, orderBy: { orderIndex: 'asc' }, select: { id: true, name: true, purpose: true, hidden: true } }),
    prisma.lexCoherentAction.findMany({
      where: { ideaId, status: 'LIVE' }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, number: true, title: true, practicalStep: true, whoImplements: true, headingId: true, targetCauseIds: true, avenue: true, parked: true,
        record: true, conditionIds: true, supportOnly: true, commentary: true, policyTestVerdict: true, policyTestReason: true, orderIndex: true,
      },
    }),
    prisma.policyOption.findFirst({ where: { ideaId, status: 'CHOSEN' } }),
    readConditions(ideaId),
  ])
  let heading: { id: string; name: string } | null = null
  if (scope === 'HEADING') {
    heading = headings.find((h) => h.id === headingId) ?? null
    if (!heading) return fail('That heading is not on this idea (it may have been retired). Nothing was started.')
  }
  const causeNum = new Map(causes.map((c, i) => [c.id, c.number ?? i + 1]))
  const active = activeConditions(cond)
  const condNum = new Map(active.map((c, i) => [c.id, i + 1]))
  const numById = new Map(rows.map((r) => [r.id, r.number]))
  const headingName = new Map(headings.map((h) => [h.id, h.name]))
  const inScope = rows.filter((r) => (scope === 'SET' ? true : r.headingId === headingId))
  const actions: DigestAction[] = inScope.flatMap((r): DigestAction[] => {
    if (r.number == null) return []
    const rec = parseRecord(r.record)
    const slots: DigestAction['slots'] = {}
    const put = (k: AnySlot) => {
      const t = slotText({ record: r.record, whoImplements: r.whoImplements }, k)
      if (!t) return
      const s = k === 'who' ? undefined : rec[k]
      slots[k] = { text: t, ...(s?.direction ? { direction: s.direction } : {}), ...(s?.linkActionId && numById.get(s.linkActionId) ? { linkNumber: numById.get(s.linkActionId) ?? null } : {}) }
    }
    ;(['who', 'incentiveNow', 'whatChangesIt', 'skill', 'how', 'against', 'worked'] as AnySlot[]).forEach(put)
    return [{
      number: r.number, title: r.title, statement: r.practicalStep, headingName: r.headingId ? headingName.get(r.headingId) ?? null : null,
      avenue: r.avenue, causeNumbers: r.targetCauseIds.map((id) => causeNum.get(id)).filter((n): n is number => n != null),
      conditionNumbers: r.conditionIds.map((id) => condNum.get(id)).filter((n): n is number => n != null).sort((a, b) => a - b),
      support: r.supportOnly,
      policyTest: r.policyTestVerdict ? { verdict: r.policyTestVerdict, reason: r.policyTestReason } : null,
      slots, commentary: r.commentary, parked: r.parked,
    }]
  })
  if (!actions.length) return fail(scope === 'HEADING' ? `“${heading?.name}” has no live actions, so there is nothing to ask the models about. Nothing was started.` : 'There are no live actions yet, so there is nothing to ask the models about. Nothing was started.')
  const ctx: DigestContext = {
    problem: idea?.challenge?.trim() || idea?.summaryDescription?.trim() || '(no problem statement recorded)',
    pivotalObstacle: idea?.pivotalObstacle?.trim() || null,
    causes: causes.map((c, i) => ({ number: c.number ?? i + 1, cause: c.cause })),
    policy: policy ? { number: policy.number ?? null, approach: policy.approach, rulesOut: policy.rulesOut ?? null, chainLink: policy.chainLink ?? null, caseFor: policy.caseFor ?? null, caseAgainst: policy.caseAgainst ?? null } : null,
    conditions: active.map((c, i) => ({ number: i + 1, text: c.text })),
    headings: (scope === 'HEADING' ? headings.filter((h) => h.id === headingId) : headings.filter((h) => !h.hidden)).map((h) => ({ name: h.name, purpose: h.purpose })),
  }
  return {
    ok: true,
    data: {
      ctx, actions, ids: inScope.filter((r) => r.number != null).map((r) => r.id), headingName: heading?.name ?? null,
      scopeWords: scope === 'HEADING'
        ? `the ${actions.length} live ${actions.length === 1 ? 'action' : 'actions'} under the heading “${heading?.name}”. The conditions are those of the whole proposal; these actions are not expected to deliver all of them.`
        : `the whole set: all ${actions.length} live actions, under all the headings.`,
    },
  }
}

/** A short index of the actions for the judge: number, heading, label. */
const indexOf = (actions: DigestAction[]) => actions.map((a) => `#${a.number}${a.headingName ? ` [${a.headingName}]` : ''} ${actionLabel({ title: a.title, practicalStep: a.statement }, 140)}`).join('\n')

const basisOf = (actions: DigestAction[], dataText: string, conditionCount: number) => ({
  actionNumbers: new Set(actions.map((a) => a.number)),
  conditionCount,
  refNumbers: new Set(refsIn(dataText)),
})

// ── the row ───────────────────────────────────────────────────────────────────────────────────────────────────

type Row = NonNullable<Awaited<ReturnType<typeof prisma.actionDigest.findFirst>>>

const asOutputs = (v: unknown): StoredModelOutput[] => (Array.isArray(v) ? (v as StoredModelOutput[]) : [])
const asJudge = (v: unknown): StoredJudge | null => (v && typeof v === 'object' && 'digest' in (v as object) ? (v as StoredJudge) : null)

async function view(row: Row): Promise<DigestView> {
  const read = await readScope(row.ideaId, row.scope as DigestScope, row.headingId)
  const now = read.ok ? read.data.ids : []
  const st = staleness(row.actionIds, now)
  const outputs = asOutputs(row.modelOutputs)
  const judge = asJudge(row.judgeOutput)
  const cond = read.ok ? read.data.ctx.conditions : []
  return {
    id: row.id, scope: row.scope as DigestScope, headingId: row.headingId, headingName: row.headingName, status: row.status,
    createdAt: row.createdAt.toISOString(),
    line: digestLine(row.createdAt, st),
    staleness: st,
    staleSentence: st.stale ? staleSentence(row.scope as DigestScope, row.headingName, st) : null,
    spentPence: row.spentPence, unpriced: row.unpriced, failure: row.failure,
    models: outputs.map((o) => ({ model: o.model, servedBy: o.servedBy, status: o.status, error: o.error, pence: o.pence ?? null, dropped: o.dropped })),
    judge,
    modelAnswers: outputs.filter((o) => o.status === 'OK' && o.answer).map((o) => ({ model: o.model, answers: o.answer!.answers })),
    table: outputs.some((o) => o.status === 'OK') ? conditionTable(outputs, cond) : null,
    conditions: cond,
    labels: read.ok ? Object.fromEntries(read.data.actions.map((a) => [a.number, actionLabel({ title: a.title, practicalStep: a.statement }, 100)])) : {},
    working: row.status === 'WORKING_MODELS' || row.status === 'WORKING_JUDGE',
  }
}

/** The digests to show: for each scope (a heading, or the set) the newest one - READY, or in progress, or the newest failure if nothing else. */
export async function listDigests(ideaId: string): Promise<DigestView[]> {
  const rows = await prisma.actionDigest.findMany({ where: { ideaId }, orderBy: { createdAt: 'desc' } })
  const seen = new Set<string>()
  const keep: Row[] = []
  for (const r of rows) {
    const key = `${r.scope}:${r.headingId ?? ''}`
    if (seen.has(key)) continue
    // a failure shows only if there is nothing newer and better; READY and in-progress ones always do
    seen.add(key); keep.push(r)
  }
  return Promise.all(keep.map(view))
}

export async function getDigest(ideaId: string, digestId: string): Promise<DigestView | null> {
  const row = await prisma.actionDigest.findFirst({ where: { id: digestId, ideaId } })
  return row ? view(row) : null
}

// ── start ─────────────────────────────────────────────────────────────────────────────────────────────────────

export async function startDigest(ideaId: string, userId: string, scope: DigestScope, headingId: string | null): Promise<Result<DigestView>> {
  const read = await readScope(ideaId, scope, scope === 'HEADING' ? headingId : null)
  if (!read.ok) return fail((read as { error: string }).error)
  // one at a time per scope: a digest still in flight (not older than a function's limit plus the gap between stages) is not started twice
  const cutoff = new Date(Date.now() - 30 * 60_000)
  const busy = await prisma.actionDigest.findFirst({
    where: { ideaId, scope, headingId: scope === 'HEADING' ? headingId : null, status: { in: ['RUNNING', 'WORKING_MODELS', 'MODELS_DONE', 'WORKING_JUDGE'] }, updatedAt: { gte: cutoff } },
  })
  if (busy) return fail(`A digest of ${scope === 'HEADING' ? `“${read.data.headingName}”` : 'the set'} is already under way (started ${busy.createdAt.toISOString().slice(11, 16)} UTC). Open it to carry on. Nothing new was started.`)
  const slots: StoredModelOutput[] = PREMIUM_DRAFT_MODELS.map((model) => ({ model, status: 'PENDING' }))
  const row = await prisma.actionDigest.create({
    data: {
      ideaId, scope, headingId: scope === 'HEADING' ? headingId : null, headingName: read.data.headingName, status: 'RUNNING',
      actionIds: read.data.ids, modelOutputs: slots as unknown as Prisma.InputJsonValue, startedBy: userId,
    },
  })
  return { ok: true, data: await view(row) }
}

// ── claiming a stage ──────────────────────────────────────────────────────────────────────────────────────────

async function claim(id: string, from: string, to: string): Promise<boolean> {
  const a = await prisma.actionDigest.updateMany({ where: { id, status: from }, data: { status: to } })
  if (a.count) return true
  const b = await prisma.actionDigest.updateMany({ where: { id, status: to, updatedAt: { lt: new Date(Date.now() - IN_FLIGHT_MS) } }, data: { status: to } })
  return b.count > 0
}

// ── the models ────────────────────────────────────────────────────────────────────────────────────────────────

async function priced(result: { usage: import('./model-call').LlmUsage; ok: boolean }, pass: string, ideaId: string, userId: string | null) {
  return result.usage.recorded ?? await recordUsage(result.usage, { stream: 'lex', pass, ideaId, userId, failed: !result.ok })
}

async function runModels(ideaId: string, userId: string, row: Row, read: ScopeRead): Promise<Result<DigestView>> {
  const outputs = asOutputs(row.modelOutputs)
  const data = dataBlock(read.ctx, read.actions)
  const system = DIGEST_SYSTEM
  const user = digestUserPrompt(data.text, read.scopeWords)
  const basis = basisOf(read.actions, data.text, read.ctx.conditions.length)
  const scope = row.scope as DigestScope
  const deadline = Date.now() + STAGE_BUDGET_MS
  const timeoutFor = (m: string) => MODEL_TIMEOUT_MS[scope] + (m === 'grok-4.7' ? GROK_EXTRA_MS : 0)

  const one = async (slot: StoredModelOutput): Promise<StoredModelOutput> => {
    const attempt = async (model: string, timeoutMs: number, label: string) => {
      const result = await callModelJson<unknown>({
        model, system, user, schema: MODEL_SCHEMA as never, maxOutputTokens: MODEL_MAX_OUTPUT, timeoutMs, reasoningEffort: DRAFT_REASONING_EFFORT,
        label: `action-digest:${label}`, stream: 'lex', pass: 'action-digest.model', ideaId, userId,
      })
      return { result, p: await priced(result, 'action-digest.model', ideaId, userId) }
    }
    const done = (res: Awaited<ReturnType<typeof attempt>>, servedBy?: string): StoredModelOutput => {
      const v = (res.result as { value: unknown }).value
      const { answer, dropped } = parseModelAnswer(v, basis)
      // an answer to none of the six questions is not an answer
      if (!answer.answers.length) return { model: slot.model, ...(servedBy ? { servedBy } : {}), status: 'FAILED', error: 'The model returned no answer to any of the six questions.', pence: res.p.pence }
      return { model: slot.model, ...(servedBy ? { servedBy } : {}), status: 'OK', answer, dropped, pence: res.p.pence }
    }
    const first = await attempt(slot.model, Math.min(timeoutFor(slot.model), Math.max(deadline - Date.now(), 30_000)), slot.model)
    if (first.result.ok) return done(first)
    const f1 = first.result as LlmFail
    const fb = PANEL_FALLBACKS[slot.model]
    const remaining = deadline - Date.now()
    // a preview model that errors is answered by its stable fallback AND SAYS SO (`servedBy`) - CLAUDE.md §18
    if (fb && f1.reason !== 'truncated' && f1.reason !== 'blocked' && remaining >= MIN_FALLBACK_MS) {
      const second = await attempt(fb, remaining - 5_000, `${slot.model}->${fb}`)
      if (second.result.ok) return done(second, fb)
      const f2 = second.result as LlmFail
      return { model: slot.model, status: 'FAILED', error: `${f1.reason}: ${f1.detail}; fallback ${fb} also failed: ${f2.reason}`, pence: (first.p.pence ?? 0) + (second.p.pence ?? 0) }
    }
    return { model: slot.model, status: 'FAILED', error: `${f1.reason}: ${f1.detail}`, pence: first.p.pence }
  }

  const pending = outputs.filter((o) => o.status === 'PENDING')
  const ran = await Promise.all(pending.map(one))
  const next = outputs.map((o) => ran.find((r) => r.model === o.model) ?? o)
  const spent = (row.spentPence ?? 0) + ran.reduce((n, r) => n + (r.pence ?? 0), 0)
  const anyOk = next.some((o) => o.status === 'OK')
  const failedAll = !anyOk
  await prisma.actionDigest.update({
    where: { id: row.id },
    data: {
      modelOutputs: next as unknown as Prisma.InputJsonValue, spentPence: Math.round(spent * 1000) / 1000,
      status: failedAll ? 'FAILED' : 'MODELS_DONE',
      failure: failedAll ? `None of the four models answered: ${next.map((o) => `${o.model} (${o.error ?? 'no reason'})`).join('; ')}` : next.some((o) => o.status === 'FAILED') ? `${next.filter((o) => o.status === 'FAILED').length} of the four did not answer - retry them, or go on with the rest.` : null,
    },
  })
  console.log('[action-digest] models done', { ideaId, digestId: row.id, scope, ok: next.filter((o) => o.status === 'OK').length, failed: next.filter((o) => o.status === 'FAILED').map((o) => o.model), pence: spent })
  return { ok: true, data: (await getDigest(ideaId, row.id))! }
}

// ── the judge ─────────────────────────────────────────────────────────────────────────────────────────────────

async function runJudge(ideaId: string, userId: string, row: Row, read: ScopeRead): Promise<Result<DigestView>> {
  const outputs = asOutputs(row.modelOutputs)
  const ok = outputs.filter((o) => o.status === 'OK')
  const data = dataBlock(read.ctx, read.actions)
  const basis = basisOf(read.actions, data.text, read.ctx.conditions.length)
  const panel = outputs.map((o) => o.model)
  const user = judgeUserPrompt(read.scopeWords, read.ctx.conditions, indexOf(read.actions), outputs)
  const result = await callModelJson<unknown>({
    model: JUDGE_MODEL, system: JUDGE_SYSTEM, user, schema: JUDGE_SCHEMA as never, maxOutputTokens: JUDGE_MAX_OUTPUT, timeoutMs: 240_000,
    reasoningEffort: DRAFT_REASONING_EFFORT, label: 'action-digest:judge', stream: 'lex', pass: 'action-digest.judge', ideaId, userId,
  })
  const p = await priced(result, 'action-digest.judge', ideaId, userId)
  const spent = Math.round(((row.spentPence ?? 0) + (p.pence ?? 0)) * 1000) / 1000
  const unpriced = row.unpriced || p.unpriced || p.pence == null || outputs.some((o) => o.status === 'OK' && o.pence == null)
  if (!result.ok) {
    const f = result as LlmFail
    // the four reviews are kept; only the judge is retried
    await prisma.actionDigest.update({ where: { id: row.id }, data: { status: 'MODELS_DONE', spentPence: spent, unpriced, failure: `The judge did not answer (${f.reason}: ${f.detail}). The four reviews are kept; ask the judge again.` } })
    return { ok: true, data: (await getDigest(ideaId, row.id))! }
  }
  const { digest, flags } = parseJudge((result as { value: unknown }).value, basis, panel)
  if (!digest.answers.length) {
    await prisma.actionDigest.update({ where: { id: row.id }, data: { status: 'MODELS_DONE', spentPence: spent, unpriced, failure: 'The judge returned no answer to any of the six questions. The four reviews are kept; ask the judge again.' } })
    return { ok: true, data: (await getDigest(ideaId, row.id))! }
  }
  const stored: StoredJudge = { digest, flags, handled: { gaps: {}, conditions: {} }, trimmedCommentaries: data.trimmedCommentaries, commentaryMax: data.commentaryMax }
  await prisma.actionDigest.update({ where: { id: row.id }, data: { status: 'READY', judgeOutput: stored as unknown as Prisma.InputJsonValue, spentPence: spent, unpriced, failure: null } })
  // decision 201: a model's extra condition is a PROPOSAL in the conditions panel - never a condition
  await writeConditionProposals(ideaId, row.id, ok.length)
  console.log('[action-digest] judged', { ideaId, digestId: row.id, scope: row.scope, gaps: digest.gaps.length, disagreements: digest.disagreements.length, pence: spent })
  return { ok: true, data: (await getDigest(ideaId, row.id))! }
}

async function writeConditionProposals(ideaId: string, digestId: string, answering: number) {
  const row = await prisma.actionDigest.findUnique({ where: { id: digestId } })
  const j = row && asJudge(row.judgeOutput)
  if (!row || !j) return
  const handled: DigestHandled = { ...j.handled, conditions: { ...j.handled.conditions } }
  for (const [i, c] of j.digest.proposedConditions.entries()) {
    const why = `From the ${row.scope === 'HEADING' ? `“${row.headingName}” ` : ''}digest, ${c.namedBy.length} of ${answering} models${c.namedBy.length ? ` (${c.namedBy.join(', ')})` : ''}. ${c.why}`.trim()
    const r = await proposeCondition(ideaId, c.text, why)
    handled.conditions[String(i)] = r.ok ? 'PROPOSED' : 'DUPLICATE'
  }
  await prisma.actionDigest.update({ where: { id: digestId }, data: { judgeOutput: { ...j, handled } as unknown as Prisma.InputJsonValue } })
}

// ── advance / retry ───────────────────────────────────────────────────────────────────────────────────────────

export async function advanceDigest(ideaId: string, userId: string, digestId: string): Promise<Result<DigestView>> {
  const row = await prisma.actionDigest.findFirst({ where: { id: digestId, ideaId } })
  if (!row) return fail('That digest is not on this idea. Nothing was changed.')
  if (row.status === 'READY' || row.status === 'FAILED') return { ok: true, data: await view(row) }
  const read = await readScope(ideaId, row.scope as DigestScope, row.headingId)
  if (!read.ok) return fail((read as { error: string }).error)
  if (row.status === 'RUNNING' || row.status === 'WORKING_MODELS') {
    if (!(await claim(row.id, 'RUNNING', 'WORKING_MODELS'))) return { ok: true, data: await view(row) } // another request is on it; `working` says so
    return runModels(ideaId, userId, (await prisma.actionDigest.findUnique({ where: { id: row.id } }))!, read.data)
  }
  if (row.status === 'MODELS_DONE' || row.status === 'WORKING_JUDGE') {
    if (!(await claim(row.id, 'MODELS_DONE', 'WORKING_JUDGE'))) return { ok: true, data: await view(row) }
    return runJudge(ideaId, userId, (await prisma.actionDigest.findUnique({ where: { id: row.id } }))!, read.data)
  }
  return fail(`That digest is in an unexpected state (${row.status}). Nothing was changed.`)
}

/** Put the models that failed back to PENDING and the digest back to RUNNING; the next advance runs only those. */
export async function retryModels(ideaId: string, digestId: string): Promise<Result<DigestView>> {
  const row = await prisma.actionDigest.findFirst({ where: { id: digestId, ideaId } })
  if (!row) return fail('That digest is not on this idea. Nothing was changed.')
  if (row.status === 'READY') return fail('That digest is finished; ask for a new one to read the list again. Nothing was changed.')
  if (row.status === 'WORKING_MODELS' || row.status === 'WORKING_JUDGE') return fail('A stage of that digest is running now. Nothing was changed.')
  const outputs = asOutputs(row.modelOutputs)
  if (!outputs.some((o) => o.status === 'FAILED')) return fail('No model failed on that digest. Nothing was changed.')
  const next = outputs.map((o) => (o.status === 'FAILED' ? { model: o.model, status: 'PENDING' as const } : o))
  const updated = await prisma.actionDigest.update({ where: { id: row.id }, data: { modelOutputs: next as unknown as Prisma.InputJsonValue, status: 'RUNNING', failure: null } })
  return { ok: true, data: await view(updated) }
}

// ── the gaps become SUGGESTIONS, on the user's press ───────────────────────────────────────────────────────────

/** Add the named gaps (all those not yet added, or the one `index`) as SUGGESTED rows beside the gap check's. ⚠ Not actions: accepting is gap-check's. */
export async function suggestGaps(ideaId: string, digestId: string, index?: number): Promise<Result<{ added: number; skipped: number }>> {
  const row = await prisma.actionDigest.findFirst({ where: { id: digestId, ideaId } })
  const j = row && asJudge(row.judgeOutput)
  if (!row || !j) return fail('That digest has no finished judge’s page to take gaps from. Nothing was changed.')
  const outputs = asOutputs(row.modelOutputs)
  const answering = outputs.filter((o) => o.status === 'OK').length
  const idxs = index == null ? j.digest.gaps.map((_, i) => i) : [index]
  if (idxs.some((i) => !j.digest.gaps[i])) return fail('That gap is not on this digest. Nothing was changed.')
  const existing = await prisma.actionIdea.findMany({ where: { ideaId, status: { in: ['SUGGESTED', 'ACCEPTED_GAP'] } }, select: { text: true } })
  const have = new Set(existing.map((e) => e.text.toLowerCase()))
  const handled: DigestHandled = { ...j.handled, gaps: { ...j.handled.gaps } }
  let added = 0, skipped = 0
  for (const i of idxs) {
    const g = j.digest.gaps[i]
    if (handled.gaps[String(i)]) { skipped++; continue }
    if (have.has(g.item.toLowerCase())) { skipped++; continue }
    const source: GapSource = { kind: 'DIGEST', models: g.namedBy, whatFails: g.whatFails, category: g.category, addressesCauseNumber: null, checkId: row.id, checkCostPence: row.spentPence, of: answering }
    const made = await prisma.actionIdea.create({
      data: {
        ideaId, status: 'SUGGESTED', text: g.item, verdict: 'NOT_TESTED',
        reason: 'From the digest - not yet tested against the guiding policy.', sources: [source] as never,
      },
    })
    handled.gaps[String(i)] = made.id
    added++
  }
  await prisma.actionDigest.update({ where: { id: row.id }, data: { judgeOutput: { ...j, handled } as unknown as Prisma.InputJsonValue } })
  return { ok: true, data: { added, skipped } }
}

// ── the price on the button ─────────────────────────────────────────────────────────────────────────────────────

export async function digestQuote(ideaId: string): Promise<DigestQuote> {
  const [rows, headings] = await Promise.all([
    prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE' }, select: { headingId: true } }),
    prisma.actionHeading.findMany({ where: { ideaId }, select: { id: true } }),
  ])
  const per: DigestQuote['headings'] = {}
  for (const h of headings) {
    const n = rows.filter((r) => r.headingId === h.id).length
    per[h.id] = { actions: n, price: digestPrice('HEADING', n) }
  }
  return { set: { actions: rows.length, price: digestPrice('SET', rows.length) }, headings: per }
}

export { DIGEST_QUESTIONS }
