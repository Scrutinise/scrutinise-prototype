// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-V2b (decision 243, BRIEF_26V §5) — "DRAFT WHAT THIS HEADING NEEDS" / "DRAFT WHAT THIS ACTION NEEDS": the server half.
//
//   composeKindDocument — one model call for a template kind (code text, specification, costing, operating text, background note); writes
//                         nothing (the measurement on a scratch copy calls this alone).
//   draftKindDocument   — compose, then write a PROPOSAL on the action's document of that kind (made if not there).
//   planFor             — the missing documents under a heading or on one action, each with its MEASURED price, and the ones left out (why).
//   queueDrafting       — after the owner agreed the price: one job row per document, for the worker (document_draft_job).
//   runNextDraftJob     — the worker's turn: claim the oldest waiting row, draft or generate it, save it, settle the row in words.
//   sweepDraftJobs      — a row left "drafting now" by a killed worker goes back to waiting (failed after two tries): RESUMABLE.
//   draftRunView / stopDraftRun — what the screen polls; stop takes the waiting rows out (the one drafting now finishes).
//
// ⚠ Every result is a PROPOSAL; nothing is written over a version, and nothing is deleted (§0).
// ⚠ Asks first: queueDrafting refuses unless the owner agreed at least the plan's measured price, re-reckoned here, so a stale screen
//   cannot queue more than was agreed.
// ⚠ Collision reports and schedules are generated without a model call and cost nothing (§5).
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { callModelJson } from './model-call'
import { recordUsage } from './spend-ledger'
import { parseRecord, SLOT_KEYS, SLOT_UI } from './action-record'
import { currentVersion, INSTRUMENT_WORD } from './action-draft-pure'
import { draftWithLex, DRAFT_MODEL } from './action-draft'
import { draftExplanatoryNote } from './explanatory-note'
import { draftFor, documentTree, generateCollisionReport, generateSchedule, writeTextProposal } from './action-documents'
import { KIND_WORD, type DocumentKind } from './action-documents-pure'
import { refsIn } from './action-digest-pure'
import { resolveRefs } from './source-registry'
import {
  TEMPLATES, TEMPLATE_SCHEMA, JOB_MAX_ATTEMPTS, JOB_STALL_MS, JOB_WORD, draftPlan, isTemplateKind, priceWords, templateBody, templateSystem,
  type DraftPlan, type JobStatus, type PlanAction, type TemplateAnswer, type TemplateKind,
} from './document-drafting-pure'
import type { Result } from './action-structure'

export * from './document-drafting-pure'

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '')
type Call = typeof callModelJson

// ── composing one template kind ─────────────────────────────────────────────────────────────────────────────

export interface KindInput {
  number: number | null; title: string | null; statement: string; detail: string | null; avenue: string | null; who: string | null
  heading: string | null; policy: string | null; slots: string[]
  instruction: { instrument: string | null; dutyOnWhom: string; enforcedHow: string; plainWording: string } | null
  costLines: Array<{ label: string; low: number | null; high: number | null; unit: string | null; basis: string | null; priceYear: number | null; recurrence: string | null }>
  sources: Array<{ number: number; title: string; citation: string | null; snippet: string | null }>
}
export interface KindRun { body: string; reason: string; pence: number | null; seconds: number; dropped: number[]; missing: string[] }

/** What Lex reads for one action: the action, its Action details and slots, the guiding policy, its instruction, cost lines, cited sources. */
export async function kindInput(ideaId: string, actionId: string): Promise<KindInput | null> {
  const a = await prisma.lexCoherentAction.findFirst({
    where: { id: actionId, ideaId, status: 'LIVE' },
    select: { id: true, number: true, title: true, practicalStep: true, commentary: true, avenue: true, whoImplements: true, record: true, headingId: true, costLines: { orderBy: { orderIndex: 'asc' } } },
  })
  if (!a) return null
  const [idea, heading, draft, refs] = await Promise.all([
    prisma.idea.findUnique({ where: { id: ideaId }, select: { chosenApproach: true } }),
    a.headingId ? prisma.actionHeading.findUnique({ where: { id: a.headingId }, select: { name: true } }).catch(() => null) : null,
    draftFor(a.id),
    resolveRefs(ideaId, a.commentary ?? ''),
  ])
  const rec = parseRecord(a.record)
  const cur = currentVersion(draft)
  return {
    number: a.number, title: a.title, statement: a.practicalStep, detail: a.commentary, avenue: a.avenue, who: a.whoImplements, heading: heading?.name ?? null,
    policy: idea?.chosenApproach ?? null,
    slots: SLOT_KEYS.map((k) => (rec[k]?.text ? `${SLOT_UI[k].label}: ${clip(rec[k]!.text, 500)}` : '')).filter(Boolean),
    instruction: cur ? { instrument: cur.instrument ? INSTRUMENT_WORD[cur.instrument] : null, dutyOnWhom: cur.dutyOnWhom, enforcedHow: cur.enforcedHow, plainWording: cur.plainWording } : null,
    costLines: a.costLines.map((c) => ({ label: c.label, low: c.low, high: c.high, unit: c.unit, basis: c.basis, priceYear: c.priceYear, recurrence: c.recurrence })),
    sources: refs.found.filter((s) => !s.archived).map((s) => ({ number: s.number, title: s.title, citation: s.citation, snippet: s.snippet })),
  }
}

/** The model call and the checks for one template kind, writing nothing. */
export async function composeKindDocument(kind: TemplateKind, input: KindInput, ctx: { ideaId: string; userId: string | null; call?: Call }): Promise<Result<KindRun>> {
  const started = Date.now()
  if (kind === 'BACKGROUND_NOTE' && !input.sources.length) return fail(`#${input.number ?? '?'}’s Action details cite no source, so a background note has nothing to draw on. Nothing was drafted.`)
  const user = [
    `THE GUIDING POLICY:\n${clip(input.policy ?? '(not settled)', 3000)}`,
    `<action>\nAction #${input.number ?? '?'}${input.title ? ` — ${input.title}` : ''} (avenue: ${input.avenue ?? 'not set'}${input.heading ? `; heading: ${input.heading}` : ''})\nSTATEMENT:\n${input.statement}\n${input.detail?.trim() ? `EXPLANATION:\n${clip(input.detail, 8000)}\n` : 'EXPLANATION: none written.\n'}${input.who ? `Who: ${clip(input.who, 300)}\n` : ''}${input.slots.join('\n')}\n</action>`,
    input.instruction ? `THE DRAFTING INSTRUCTION: instrument — ${input.instruction.instrument ?? 'not set'}; duty on — ${input.instruction.dutyOnWhom || 'not set'}; enforced — ${input.instruction.enforcedHow || 'not set'}.${input.instruction.plainWording ? `\nPLAIN WORDING:\n${clip(input.instruction.plainWording, 3000)}` : ''}` : '',
    kind === 'COSTING' ? (input.costLines.length
      ? `COST LINES (the only figures you may use):\n${input.costLines.map((c) => `- ${c.label}: ${c.low ?? '?'}–${c.high ?? '?'} ${c.unit ?? 'GBP'}${c.priceYear ? `, ${c.priceYear} prices` : ''}${c.recurrence ? `, ${c.recurrence === 'PER_YEAR' ? 'each year' : 'once'}` : ''}${c.basis ? `; basis: ${clip(c.basis, 300)}` : ''}`).join('\n')}`
      : 'COST LINES: none recorded on this action.') : '',
    input.sources.length ? `SOURCES (cite only these, as [Ref: n]):\n${input.sources.map((s) => `[Ref: ${s.number}] ${s.title}${s.citation ? ` — ${s.citation}` : ''}${s.snippet ? `\n  ${clip(s.snippet, 1200)}` : ''}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n')
  const pass = `actions.document.${kind.toLowerCase()}`
  const call = ctx.call ?? callModelJson
  const res = await call<TemplateAnswer>({
    model: DRAFT_MODEL, system: templateSystem(kind), user, schema: TEMPLATE_SCHEMA as never, maxOutputTokens: 8_000, timeoutMs: 180_000, reasoningEffort: 'medium',
    label: `document-${kind.toLowerCase()}`, stream: 'lex', pass, ideaId: ctx.ideaId, userId: ctx.userId,
  })
  const priced = res.usage.recorded ?? (await recordUsage(res.usage, { stream: 'lex', pass, ideaId: ctx.ideaId, userId: ctx.userId, failed: !res.ok }))
  if (!res.ok) return fail(`The ${KIND_WORD[kind]} did not complete: ${(res as { detail?: string }).detail ?? (res as { reason?: string }).reason ?? 'no reason given'}. Nothing was written.${priced.pence ? ` It cost ${priced.pence.toFixed(1)}p.` : ''}`)
  const allowed = new Set([...refsIn(input.detail ?? ''), ...input.sources.map((s) => s.number)])
  const { body, dropped, dNumbers, missing } = templateBody(kind, res.value, { hasCommentary: !!input.detail?.trim(), allowedRefs: allowed })
  const reason = [
    clip(res.value.reason, 1500),
    missing.length ? `Lex wrote nothing under ${missing.map((m) => `“${m}”`).join(', ')}; the document says so there.` : '',
    dropped.length ? `Taken out because neither the Action details nor the sources cite them: ${dropped.map((n) => `[Ref: ${n}]`).join(', ')}.` : '',
    dNumbers ? `Taken out: ${dNumbers} document number${dNumbers === 1 ? '' : 's'} cited as if evidence (a D-number is never a source).` : '',
  ].filter(Boolean).join(' ')
  return { ok: true, data: { body, reason, pence: priced.pence ?? null, seconds: Math.round((Date.now() - started) / 100) / 10, dropped, missing } }
}

/** Compose one template kind and write it as a PROPOSAL on the action's document of that kind. */
export async function draftKindDocument(ideaId: string, actionId: string, kind: TemplateKind, userId: string | null, opts: { call?: Call } = {}): Promise<Result<{ d: string; v: number; pence: number | null; reason: string }>> {
  const input = await kindInput(ideaId, actionId)
  if (!input) return fail('That action is not on this idea’s live list. Nothing was drafted.')
  const r = await composeKindDocument(kind, input, { ideaId, userId, call: opts.call })
  if (!r.ok) return fail((r as { error: string }).error)
  const fresh = await prisma.lexCoherentAction.findFirst({ where: { id: actionId, ideaId, status: 'LIVE' }, select: { id: true } })
  if (!fresh) return fail('The action was ruled out or merged while Lex was drafting. Nothing was written.')
  const w = await writeTextProposal(ideaId, actionId, kind, TEMPLATES[kind].title, { body: r.data.body, reason: r.data.reason, pence: r.data.pence, sources: refsIn(r.data.body) })
  return { ok: true, data: { d: w.d, v: w.v, pence: r.data.pence, reason: r.data.reason } }
}

// ── the plan (what the button lists, with prices) ─────────────────────────────────────────────────────────────

export type DraftScope = { headingId: string | null } | { actionId: string }

export async function planFor(ideaId: string, scope: DraftScope): Promise<Result<DraftPlan & { scope: string }>> {
  const tree = await documentTree(ideaId)
  const known = new Set(tree.headings.map((h) => h.id))
  // "Not under a heading" (id null) also holds actions whose heading is gone; match the tree, not the column
  const rows = tree.headings.flatMap((h) => h.actions.map((a) => ({ a, headingId: known.has(a.headingId) ? a.headingId : null })))
  const chosen = rows.filter(({ a, headingId }) => ('actionId' in scope ? a.id === scope.actionId : headingId === scope.headingId)).map((x) => x.a)
  if (!chosen.length) return fail('Nothing is under that heading on this idea’s live list. Nothing was planned.')
  const live = await prisma.lexCoherentAction.findMany({ where: { id: { in: chosen.map((a) => a.id) } }, select: { id: true, commentary: true } })
  const cites = new Map(await Promise.all(live.map(async (x) => [x.id, (await resolveRefs(ideaId, x.commentary ?? '')).found.some((s) => !s.archived)] as const)))
  const actions: PlanAction[] = chosen.map((a) => ({
    id: a.id, number: a.number, title: a.title, missing: a.missing,
    hasClauseVersion: a.documents.some((d) => d.kind === 'DRAFT_CLAUSE' && d.status !== 'SUPERSEDED' && d.current != null), hasSources: cites.get(a.id) ?? false,
  }))
  const label = 'actionId' in scope ? `#${chosen[0].number ?? '?'}` : (tree.headings.find((h) => h.id === scope.headingId)?.name ?? 'Not under a heading')
  return { ok: true, data: { ...draftPlan(actions), scope: label } }
}

// ── the queue ──────────────────────────────────────────────────────────────────────────────────────────────

export async function queueDrafting(ideaId: string, scope: DraftScope, userId: string, agreedPence: number): Promise<Result<{ runId: string; queued: number; alreadyWaiting: number; pence: number }>> {
  const p = await planFor(ideaId, scope)
  if (!p.ok) return fail((p as { error: string }).error.replace('Nothing was planned.', 'Nothing was queued.'))
  const plan = p.data
  if (!plan.items.length) return fail('Nothing here can be drafted now. Nothing was queued.')
  // asks first (§0): the plan is re-reckoned here; a price above what the owner agreed is asked again, never queued
  if (plan.pence > agreedPence + 0.05) return fail(`The price is now about ${priceWords(plan.pence)}, not the ${priceWords(agreedPence)} you agreed — look again and agree the new price. Nothing was queued.`)
  const runId = randomUUID()
  const now = Date.now()
  const r = await prisma.documentDraftJob.createMany({
    data: plan.items.map((it, seq) => ({ id: randomUUID(), runId, ideaId, actionId: it.actionId, kind: it.kind, seq, pricePence: it.pence, userId, createdAt: new Date(now) })),
    skipDuplicates: true, // the partial unique index: an action's kind already waiting or drafting is not queued twice
  })
  return { ok: true, data: { runId, queued: r.count, alreadyWaiting: plan.items.length - r.count, pence: plan.pence } }
}

// ── the worker's turn ───────────────────────────────────────────────────────────────────────────────────────

interface JobRow { id: string; run_id: string; idea_id: string; action_id: string; kind: string; user_id: string | null }
export interface Settled { status: Extract<JobStatus, 'DONE' | 'SKIPPED' | 'FAILED'>; outcome: string; pence: number | null; d: string | null }

/** Does the action already have a live document of this kind with a version or a waiting proposal? Then the row is not needed. */
async function alreadyThere(actionId: string, kind: DocumentKind): Promise<string | null> {
  const doc = await prisma.actionDocument.findFirst({
    where: { actionId, kind, status: { not: 'SUPERSEDED' } },
    include: { versions: { where: { OR: [{ role: 'VERSION' }, { role: 'PROPOSAL', answer: null }] }, take: 1 } },
  })
  return doc && doc.versions.length ? `it already has a ${KIND_WORD[kind]}${doc.versions[0].role === 'PROPOSAL' ? ' (Lex’s proposal waiting)' : ''}` : null
}

/** Draft or generate one row's document. Every model kind's result is a proposal; the generated kinds write a GENERATED version. */
export async function executeJob(job: JobRow, opts: { call?: Call } = {}): Promise<Settled> {
  const kind = job.kind as DocumentKind
  const live = await prisma.lexCoherentAction.findFirst({ where: { id: job.action_id, ideaId: job.idea_id, status: 'LIVE' }, select: { number: true } })
  if (!live) return { status: 'SKIPPED', outcome: 'The action is no longer on the live list.', pence: 0, d: null }
  const n = `#${live.number ?? '?'}`
  if (kind === 'COLLISION_REPORT' || kind === 'CONSEQUENTIAL_SCHEDULE') {
    const r = kind === 'COLLISION_REPORT' ? await generateCollisionReport(job.idea_id, job.action_id) : await generateSchedule(job.idea_id)
    if (!r.ok) return { status: 'SKIPPED', outcome: (r as { error: string }).error, pence: 0, d: null }
    return { status: 'DONE', outcome: r.data.unchanged ? `${r.data.d} already matched its data; unchanged (free).` : `${r.data.d} generated, ${r.data.rows} row${r.data.rows === 1 ? '' : 's'} (free).`, pence: 0, d: r.data.d }
  }
  const there = await alreadyThere(job.action_id, kind)
  if (there) return { status: 'SKIPPED', outcome: `Not drafted: ${there}.`, pence: 0, d: null }
  if (kind === 'DRAFT_CLAUSE') {
    const r = await draftWithLex(job.idea_id, job.action_id, job.user_id, { call: opts.call })
    if (!r.ok) return { status: 'FAILED', outcome: (r as { error: string }).error, pence: null, d: null }
    const doc = await prisma.actionDocument.findFirst({ where: { actionId: job.action_id, kind: 'DRAFT_CLAUSE', status: { not: 'SUPERSEDED' } }, orderBy: { number: 'asc' }, select: { number: true } })
    const d = doc ? `D.${live.number ?? '?'}.${doc.number}` : null
    return { status: 'DONE', outcome: `${d ?? n}: Lex’s drafting instruction and clause, a proposal waiting to be used or set aside.`, pence: r.data.pence, d }
  }
  const r = kind === 'EXPLANATORY_NOTE' ? await draftExplanatoryNote(job.idea_id, job.action_id, job.user_id, { call: opts.call })
    : isTemplateKind(kind) ? await draftKindDocument(job.idea_id, job.action_id, kind, job.user_id, { call: opts.call })
    : fail(`A ${KIND_WORD[kind]} is written by hand.`)
  if (!r.ok) return { status: kind === 'BACKGROUND_NOTE' && /cites no source/.test((r as { error: string }).error) ? 'SKIPPED' : 'FAILED', outcome: (r as { error: string }).error, pence: null, d: null }
  return { status: 'DONE', outcome: `${r.data.d}: Lex’s ${KIND_WORD[kind]}, a proposal waiting to be used or set aside.`, pence: r.data.pence, d: r.data.d }
}

/**
 * Claim the oldest waiting row (two workers never take the same one), run it, settle it. Null when nothing is waiting.
 * ⚠ A row on a SCRATCH copy (264's flag) is taken only when `includeScratch` is asked for: a check queues rows there and runs them itself
 *   with a fixture model, and the live worker polling the same database must never draft them for real. One query, so the check exercises
 *   the very filter the worker runs. `ideaId` narrows the claim to one idea (a check, a measurement).
 */
export async function runNextDraftJob(worker: string, opts: { call?: Call; ideaId?: string; includeScratch?: boolean } = {}): Promise<{ id: string; settled: Settled } | null> {
  const rows = await prisma.$queryRaw<JobRow[]>`UPDATE document_draft_job SET status = 'RUNNING', claimed_at = now(), attempts = attempts + 1, worker = ${worker}
    WHERE id = (SELECT j.id FROM document_draft_job j JOIN "Idea" i ON i.id = j.idea_id
                WHERE j.status = 'QUEUED' AND (${opts.ideaId ?? null}::text IS NULL OR j.idea_id = ${opts.ideaId ?? null}) AND (${opts.includeScratch === true} OR NOT i."isScratch")
                ORDER BY j.created_at, j.seq LIMIT 1 FOR UPDATE OF j SKIP LOCKED)
    RETURNING id, run_id, idea_id, action_id, kind, user_id`
  const job = rows[0]
  if (!job) return null
  let settled: Settled
  try { settled = await executeJob(job, opts) } catch (e) { settled = { status: 'FAILED', outcome: `It stopped with an error: ${(e as Error).message.slice(0, 200)}.`, pence: null, d: null } }
  await prisma.documentDraftJob.updateMany({ where: { id: job.id, status: 'RUNNING' }, data: { status: settled.status, outcome: settled.outcome, pence: settled.pence, dNumber: settled.d, finishedAt: new Date() } })
  return { id: job.id, settled }
}

/** RESUMABLE: a row a killed worker left "drafting now" goes back to waiting; after two tries it is failed, in words. */
export async function sweepDraftJobs(now = new Date()): Promise<{ requeued: number; failed: number }> {
  const before = new Date(now.getTime() - JOB_STALL_MS)
  const failed = await prisma.documentDraftJob.updateMany({ where: { status: 'RUNNING', claimedAt: { lt: before }, attempts: { gte: JOB_MAX_ATTEMPTS } }, data: { status: 'FAILED', outcome: `Stopped ${JOB_MAX_ATTEMPTS} times while drafting (the worker was restarted); not tried again.`, finishedAt: now } })
  const requeued = await prisma.documentDraftJob.updateMany({ where: { status: 'RUNNING', claimedAt: { lt: before } }, data: { status: 'QUEUED', claimedAt: null } })
  return { requeued: requeued.count, failed: failed.count }
}

// ── what the screen polls ───────────────────────────────────────────────────────────────────────────────────

export interface DraftRunItem { id: string; number: number | null; kind: DocumentKind; status: JobStatus; word: string; outcome: string | null; d: string | null; pence: number | null; pricePence: number | null }
export interface DraftRunView { runId: string; at: string; items: DraftRunItem[]; finished: boolean; spent: number; agreed: number; line: string }

export async function draftRunView(ideaId: string, runId?: string): Promise<DraftRunView | null> {
  const id = runId ?? (await prisma.documentDraftJob.findFirst({ where: { ideaId }, orderBy: { createdAt: 'desc' }, select: { runId: true } }))?.runId
  if (!id) return null
  const jobs = await prisma.documentDraftJob.findMany({ where: { ideaId, runId: id }, orderBy: { seq: 'asc' } })
  if (!jobs.length) return null
  const nums = new Map((await prisma.lexCoherentAction.findMany({ where: { id: { in: [...new Set(jobs.map((j) => j.actionId))] } }, select: { id: true, number: true } })).map((a) => [a.id, a.number]))
  const items: DraftRunItem[] = jobs.map((j) => ({
    id: j.id, number: nums.get(j.actionId) ?? null, kind: j.kind as DocumentKind, status: j.status as JobStatus, word: JOB_WORD[j.status as JobStatus], outcome: j.outcome, d: j.dNumber,
    pence: j.pence == null ? null : Number(j.pence), pricePence: j.pricePence == null ? null : Number(j.pricePence),
  }))
  const count = (s: JobStatus) => items.filter((i) => i.status === s).length
  const spent = Math.round(items.reduce((s, i) => s + (i.pence ?? 0), 0) * 10) / 10
  const agreed = Math.round(items.reduce((s, i) => s + (i.pricePence ?? 0), 0) * 10) / 10
  const running = items.find((i) => i.status === 'RUNNING')
  const finished = !count('QUEUED') && !count('RUNNING')
  const line = [
    `${count('DONE')} of ${items.length} done`,
    running ? `drafting now: #${running.number ?? '?'} ${KIND_WORD[running.kind]}` : '',
    count('QUEUED') ? `${count('QUEUED')} waiting` : '',
    count('SKIPPED') ? `${count('SKIPPED')} not needed` : '',
    count('FAILED') ? `${count('FAILED')} did not complete` : '',
    count('STOPPED') ? `${count('STOPPED')} stopped` : '',
    `spent ${priceWords(spent)} of about ${priceWords(agreed)} agreed`,
  ].filter(Boolean).join(' · ')
  return { runId: id, at: jobs[0].createdAt.toISOString(), items, finished, spent, agreed, line: finished ? `Finished: ${line}.` : line }
}

/** Stop a run: its waiting rows are stopped (kept, in words); the one drafting now finishes and is saved. */
export async function stopDraftRun(ideaId: string, runId: string): Promise<Result<{ stopped: number }>> {
  const r = await prisma.documentDraftJob.updateMany({ where: { ideaId, runId, status: 'QUEUED' }, data: { status: 'STOPPED', outcome: 'Stopped by the owner before it was drafted.', finishedAt: new Date() } })
  if (!r.count) return fail('Nothing in that run is waiting, so there is nothing to stop.')
  return { ok: true, data: { stopped: r.count } }
}
