// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A §2/§3/§4 — THE BUILD HARNESS. "A build is a JOB, not a chat turn."
//
// FIVE INVARIANTS, every one enforced here rather than trusted:
//
//  1. ONE ACTIVE BUILD PER IDEA, CLAIMED IN A CONDITIONAL UPDATE WHOSE COUNT IS
//     CHECKED. Two concurrent POSTs must not both start. Belt and braces: a partial
//     unique index on (ideaId) WHERE status IN ('QUEUED','RUNNING') makes the database
//     the arbiter, and the claim is still a guarded update whose count is read.
//
//  2. THE STATUS SHOWN IS THE STATUS STORED. Nothing infers a build's state; the row
//     is the state. An abandoned RUNNING row is settled by WRITING it to FAILED
//     (build-settle.ts), never by rendering something different from what is stored.
//
//  3. INCREMENTAL PERSISTENCE. Each pass commits its own output — proposals, child
//     rows, forks, uncertainties — as it completes, and the pass log is rewritten with
//     it. A timeout loses the tail, never the run, and a partial build says WHICH
//     passes completed because the answer is stored rather than reconstructed.
//
//  4. A CEILING PRODUCES AN HONEST FAILED, NEVER A TRUNCATED DRAFT. Time and spend are
//     checked between every pass. Hitting either stops the build and writes a plain
//     reason; what was already drafted stays and the status says the build did not
//     finish. A "DONE" build with three of four passes would be the silent-degradation
//     failure this codebase has now recorded five times.
//
//  5. NOTHING IS ACCEPTED ON THE USER'S BEHALF. Every field the build fills is a
//     PROPOSAL at AWAITING_CONFIRMATION, through the unchanged `setProposal`. The two
//     narrative boxes carrying the user's OWN words are the only ACCEPTED writes, and
//     they were written by the elicitation, not here.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import type { SearchResult } from './page1-config'
import { runSearch } from './search-gateway'
import { storeStageSearch, type StageSearchRecord } from './stage-search'
import { setProposal, createCauses, createPolicyOptions, createActions } from './field-machine'
import { appendTranscript, lexBubble } from './transcript'
import { elicitationContext, isConfirmed, type ElicitationContext } from './elicitation'
import { CREDIBILITY_NOTE, DIRECT_EDITING_NOTE } from './elicitation-config'
import { priceBuild, formatSpend, type BuildPrice } from './build-cost'
import { plainFailure, llmFailed, llmOk, type LlmUsage } from './build-llm'
import { settleAbandonedBuilds } from './build-settle'
import { briefingBody } from './build-briefing'
import { stripNullBytes } from './json-safe'
import {
  BUILD_PASSES, passDef, frameQuery, effectiveBudgetMs, COST_CEILING_PENCE,
  INSTRUMENT_FORK_KEY, trimForkAlternatives, DOMAIN_TRANSFER_QUESTION,
  type BuildPassKey, type Framing,
} from './build-config'
import {
  runOrientPass, runDiagnosisPass, runApproachPass, runActionsPass, writeBuildSummary,
  type RawFork, type RawUncertainty,
} from './build-client'

export const BUILD_STAGE = 'BUILD'

// ── The pass log ─────────────────────────────────────────────────────────────

export type PassStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'NOT_REACHED'

export interface PassRecord {
  key: BuildPassKey
  label: string
  detail: string
  status: PassStatus
  startedAt: string | null
  completedAt: string | null
  /** A one-line account of what this pass produced, for the progress display. */
  output: string | null
  failureReason: string | null
}

function freshPassLog(): PassRecord[] {
  return BUILD_PASSES.map((p) => ({
    key: p.key, label: p.label, detail: p.detail,
    status: 'PENDING' as PassStatus,
    startedAt: null, completedAt: null, output: null, failureReason: null,
  }))
}

function readPassLog(raw: unknown): PassRecord[] {
  if (!Array.isArray(raw) || !raw.length) return freshPassLog()
  // Reconcile against the configured passes, so adding a pass in a later sprint does
  // not make an old row unreadable — and so a pass that is configured but missing from
  // a stored log shows as PENDING rather than vanishing.
  const stored = raw as PassRecord[]
  return BUILD_PASSES.map((p) => {
    const found = stored.find((s) => s?.key === p.key)
    return found
      ? { ...found, label: p.label, detail: p.detail }
      : { key: p.key, label: p.label, detail: p.detail, status: 'PENDING' as PassStatus, startedAt: null, completedAt: null, output: null, failureReason: null }
  })
}

// ── State (the polling surface) ──────────────────────────────────────────────

export interface BuildView {
  id: string
  version: number
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED'
  framing: Framing
  passes: PassRecord[]
  passesComplete: number
  passesTotal: number
  currentPass: string | null
  startedAt: string | null
  completedAt: string | null
  /** Seconds the build has been running (or ran). The progress display shows it. */
  elapsedSeconds: number | null
  failureReason: string | null
  cancelRequested: boolean
  summaryMessage: string | null
  uncertainties: Array<{ fieldKey: string; sentence: string }>
  queryUsed: string | null
  spend: { tokensIn: number; tokensOut: number; pence: number | null; line: string }
  forks: Array<{
    id: string; forkKey: string; fieldKey: string; chosen: string
    alternative: string; caseForAlternative: string; alternativeIndex: number; resolved: boolean
  }>
}

export interface BuildState {
  ideaId: string
  /** May a build be started right now, and if not, why not — in words a user can read. */
  canStart: boolean
  blockedReason: string | null
  /** The most recent build, or null if none has ever run. */
  latest: BuildView | null
  /** Every build, newest first — a re-run after a correction is the normal case. */
  history: Array<{ id: string; version: number; status: string; framing: Framing; completedAt: string | null }>
  /** The ceiling actually in force, and which of the two is binding. See build-config. */
  ceiling: { budgetMs: number; binding: string; costPence: number }
}

function toView(
  row: NonNullable<Awaited<ReturnType<typeof prisma.ideaBuild.findFirst>>>,
  forks: Array<{ id: string; forkKey: string; fieldKey: string; chosen: string; alternative: string; caseForAlternative: string; alternativeIndex: number; resolved: boolean }>,
): BuildView {
  const passes = readPassLog(row.passes)
  const started = row.startedAt ? row.startedAt.getTime() : null
  const ended = row.completedAt ? row.completedAt.getTime() : null
  const price: BuildPrice = {
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    pence: row.estCostPence == null ? null : Number(row.estCostPence),
    // The row records the outcome, not the models; when the price is null the reason is
    // that something in the run was unpriced, and the line says so without naming it.
    unpriced: row.estCostPence == null && (row.tokensIn || row.tokensOut) ? ['a model with no rate on file'] : [],
  }
  const unc = (row.uncertainties && typeof row.uncertainties === 'object' && !Array.isArray(row.uncertainties)
    ? (row.uncertainties as Record<string, string>)
    : {})
  return {
    id: row.id,
    version: row.version,
    status: row.status as BuildView['status'],
    framing: row.framing as Framing,
    passes,
    passesComplete: row.passesComplete,
    passesTotal: BUILD_PASSES.length,
    currentPass: row.currentPass,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    elapsedSeconds: started ? Math.round(((ended ?? Date.now()) - started) / 1000) : null,
    failureReason: row.failureReason,
    cancelRequested: row.cancelRequested,
    summaryMessage: row.summaryMessage,
    uncertainties: Object.entries(unc).map(([fieldKey, sentence]) => ({ fieldKey, sentence: String(sentence) })),
    queryUsed: row.queryUsed,
    spend: { tokensIn: price.tokensIn, tokensOut: price.tokensOut, pence: price.pence, line: formatSpend(price) },
    forks,
  }
}

export async function buildState(ideaId: string): Promise<BuildState> {
  // Settle on the READ, and by WRITING the status — invariant 2. A build that died
  // without reporting back must not be able to sit at RUNNING for ever.
  await settleAbandonedBuilds(ideaId)

  const rows = await prisma.ideaBuild.findMany({ where: { ideaId }, orderBy: { version: 'desc' } })
  const latestRow = rows[0] ?? null
  const forks = latestRow
    ? await prisma.buildFork.findMany({
        where: { buildId: latestRow.id },
        orderBy: [{ forkKey: 'asc' }, { alternativeIndex: 'asc' }],
      })
    : []

  const confirmed = await isConfirmed(ideaId)
  const active = rows.some((r) => r.status === 'QUEUED' || r.status === 'RUNNING')
  const ceiling = effectiveBudgetMs()

  return {
    ideaId,
    canStart: confirmed && !active,
    blockedReason: !confirmed
      ? 'Confirm what I’ve understood first — I won’t build on a reading you haven’t seen.'
      : active
        ? 'A build is already running for this idea.'
        : null,
    latest: latestRow ? toView(latestRow, forks) : null,
    history: rows.map((r) => ({
      id: r.id, version: r.version, status: r.status,
      framing: r.framing as Framing, completedAt: r.completedAt?.toISOString() ?? null,
    })),
    ceiling: { budgetMs: ceiling.ms, binding: ceiling.binding, costPence: COST_CEILING_PENCE },
  }
}

// ── Claiming ─────────────────────────────────────────────────────────────────

export class BuildAlreadyRunning extends Error {
  constructor() { super('A build is already running for this idea.') }
}
export class ElicitationNotConfirmed extends Error {
  constructor() { super('The elicitation has not been confirmed, so there is nothing to build from.') }
}

/**
 * Claim a build. Three guards, in order, and none of them is decorative:
 *   · the elicitation must be CONFIRMED — §6, "the confirmation step blocks the build",
 *     enforced HERE rather than by the UI declining to render a button;
 *   · any abandoned row is settled first, or it would block its own idea for ever;
 *   · the row is created (the partial unique index is the database's answer to two
 *     concurrent creates) and then CLAIMED in a conditional update whose count is read.
 */
export async function claimBuild(ideaId: string, framing: Framing): Promise<string> {
  if (!(await isConfirmed(ideaId))) throw new ElicitationNotConfirmed()

  await settleAbandonedBuilds(ideaId)

  const active = await prisma.ideaBuild.findFirst({
    where: { ideaId, status: { in: ['QUEUED', 'RUNNING'] } },
    select: { id: true },
  })
  if (active) throw new BuildAlreadyRunning()

  const highest = await prisma.ideaBuild.findFirst({
    where: { ideaId }, orderBy: { version: 'desc' }, select: { version: true },
  })
  const version = (highest?.version ?? 0) + 1

  let created
  try {
    created = await prisma.ideaBuild.create({
      data: { ideaId, version, framing, status: 'QUEUED', passes: freshPassLog() as never },
    })
  } catch (err) {
    // P2002 on either unique index means someone else won the race. That is the guard
    // doing its job, not an error to surface as a 500.
    const code = (err as { code?: string })?.code
    if (code === 'P2002') throw new BuildAlreadyRunning()
    throw err
  }

  // The conditional claim. Guarded on the status we expect to find, and the COUNT is
  // read — a claim whose result is not checked is not a claim.
  const claimed = await prisma.ideaBuild.updateMany({
    where: { id: created.id, status: 'QUEUED' },
    data: { status: 'RUNNING', startedAt: new Date(), currentPass: BUILD_PASSES[0].key },
  })
  if (claimed.count === 0) throw new BuildAlreadyRunning()

  console.log('[lex-diag] 25a build claimed', { ideaId, buildId: created.id, version, framing })
  return created.id
}

/** Ask a running build to stop. Co-operative: the engine checks between passes. */
export async function requestCancel(ideaId: string, buildId: string): Promise<boolean> {
  const res = await prisma.ideaBuild.updateMany({
    where: { id: buildId, ideaId, status: { in: ['QUEUED', 'RUNNING'] } },
    data: { cancelRequested: true },
  })
  console.log('[lex-diag] 25a cancel requested', { ideaId, buildId, applied: res.count })
  return res.count > 0
}

// ── Running ──────────────────────────────────────────────────────────────────

interface RunAccumulator {
  usages: LlmUsage[]
  uncertainties: Record<string, string>
  forkCount: number
  results: SearchResult[]
  searchFailed: boolean
  orientation: string
  diagnosis: string
  approach: string
  instrument: string
}

/** A reason a build stopped early. Naming them apart is the §18 rule. */
type StopReason =
  | { kind: 'time'; elapsedMs: number }
  | { kind: 'cost'; price: BuildPrice }
  | { kind: 'cancel' }

async function checkStop(
  buildId: string, startedAt: number, acc: RunAccumulator,
): Promise<StopReason | null> {
  const budget = effectiveBudgetMs()
  const elapsed = Date.now() - startedAt
  if (elapsed > budget.ms) return { kind: 'time', elapsedMs: elapsed }

  const price = priceBuild(acc.usages)
  // ⚠ An UNPRICED run cannot be stopped on cost, and pretending otherwise (by treating
  // null as 0) would mean the ceiling silently stopped existing. It is logged loudly
  // instead, so the gap is visible rather than assumed away.
  if (price.pence != null && price.pence > COST_CEILING_PENCE) return { kind: 'cost', price }
  if (price.pence == null && (price.tokensIn || price.tokensOut)) {
    console.warn('[lex-diag] 25a cost ceiling NOT ENFORCEABLE this run — unpriced model(s)', {
      buildId, unpriced: price.unpriced,
    })
  }

  const row = await prisma.ideaBuild.findUnique({ where: { id: buildId }, select: { cancelRequested: true } })
  if (row?.cancelRequested) return { kind: 'cancel' }
  return null
}

function stopMessage(stop: StopReason): string {
  switch (stop.kind) {
    case 'time':
      return `The build ran out of time after ${Math.round(stop.elapsedMs / 1000)} seconds and stopped. ` +
        'What it had already drafted is in the panel; the passes it finished are listed. Nothing was ' +
        'shortened to fit — it stopped where it got to.'
    case 'cost':
      return `The build hit its spend ceiling of ${COST_CEILING_PENCE}p (${formatSpend(stop.price)}) and ` +
        'stopped. What it had already drafted is in the panel.'
    case 'cancel':
      return 'You stopped this build. Everything it had drafted before you did is in the panel and stays there.'
  }
}

/** Update the pass log and the row's derived counters in one write. */
async function writePass(
  buildId: string, key: BuildPassKey, patch: Partial<PassRecord>, extra: Record<string, unknown> = {},
): Promise<void> {
  const row = await prisma.ideaBuild.findUnique({ where: { id: buildId }, select: { passes: true } })
  const log = readPassLog(row?.passes).map((p) => (p.key === key ? { ...p, ...patch } : p))
  await prisma.ideaBuild.update({
    where: { id: buildId },
    data: {
      passes: stripNullBytes(log) as never,
      passesComplete: log.filter((p) => p.status === 'DONE').length,
      ...extra,
    },
  })
}

/** Persist a pass's forks. Two alternatives per fork; extras are dropped and counted. */
async function persistForks(
  buildId: string, ideaId: string, forks: RawFork[],
): Promise<{ written: number; trimmed: number }> {
  let written = 0
  let trimmed = 0
  let droppedDupes = 0
  for (const f of forks) {
    if (!f?.forkKey?.trim() || !f?.chosen?.trim() || !Array.isArray(f.alternatives)) continue

    // ⚠ THE INSTRUMENT KEY IS THE PLATFORM'S, AND ASKING THE MODEL NOT TO USE IT DOES
    // NOT WORK.
    //
    // §4 records the instrument choice under ONE canonical key so 25-C can find it
    // without matching prose. Measured on 2026-08-17: all six framing-harness builds
    // ALSO emitted an instrument fork of their own — `instrument:chosen`,
    // `instrument:type`, `instrument:regulatorRule` — so the same decision reached the
    // user twice under two names. A prompt line forbidding it was added and the next
    // build produced `approach:instrument` regardless; a filter scoped to the approach
    // pass then failed too, because the duplicate does not always come from that pass.
    //
    // So the rule lives HERE, where every pass's forks pass through, and it is one
    // sentence: any fork mentioning the instrument that is not the platform's own key
    // is a duplicate and is dropped. THE DROP IS COUNTED — a silent de-duplication is
    // indistinguishable from a model that stopped doing it.
    if (f.forkKey !== INSTRUMENT_FORK_KEY && /instrument/i.test(f.forkKey)) {
      droppedDupes++
      continue
    }
    const capped = trimForkAlternatives(f.alternatives)
    trimmed += capped.trimmed
    for (const [i, a] of capped.kept.entries()) {
      try {
        await prisma.buildFork.create({
          data: {
            buildId, ideaId,
            forkKey: f.forkKey.trim(),
            fieldKey: (f.fieldKey ?? '').trim() || 'unassigned',
            chosen: f.chosen.trim(),
            alternativeIndex: i,
            alternative: a.alternative.trim(),
            caseForAlternative: a.caseForAlternative.trim(),
          },
        })
        written++
      } catch (err) {
        // A duplicate (buildId, forkKey, alternativeIndex) means the model emitted the
        // same decision point twice. Skip it; do not fail the pass over bookkeeping.
        if ((err as { code?: string })?.code !== 'P2002') throw err
      }
    }
  }
  if (droppedDupes) {
    console.log('[lex-diag] 25a dropped model-emitted instrument fork(s) — the platform owns that key', {
      buildId, dropped: droppedDupes,
    })
  }
  return { written, trimmed }
}

function mergeUncertainties(acc: RunAccumulator, list: RawUncertainty[]): void {
  for (const u of list ?? []) {
    if (!u?.fieldKey?.trim() || !u?.sentence?.trim()) continue
    acc.uncertainties[u.fieldKey.trim()] = u.sentence.trim()
  }
}

/**
 * Run the build. Awaited by its route ON PURPOSE — returning early and letting the
 * promise run on is how work gets silently killed when the response ends, and a build
 * that dies unrecorded is exactly the failure this feature exists to make impossible.
 */
export async function runBuild(ideaId: string, userId: string, buildId: string): Promise<BuildView> {
  const startedAt = Date.now()
  const budget = effectiveBudgetMs()
  console.log('[lex-diag] 25a build starting', {
    ideaId, buildId, budgetMs: budget.ms, binding: budget.binding, costCeilingPence: COST_CEILING_PENCE,
  })

  const row = await prisma.ideaBuild.findUnique({ where: { id: buildId } })
  if (!row) throw new Error('Build row missing')
  const framing = row.framing as Framing

  const ctx = await elicitationContext(ideaId, userId)
  if (!ctx) return settleBuild(buildId, 'FAILED', 'There is no elicitation to build from.', [])

  const framed = frameQuery(framing, ctx)
  await prisma.ideaBuild.update({ where: { id: buildId }, data: { queryUsed: framed.queryUsed } })

  const acc: RunAccumulator = {
    usages: [], uncertainties: {}, forkCount: 0,
    results: [], searchFailed: false,
    orientation: '', diagnosis: '', approach: '', instrument: '',
  }

  try {
    for (const pass of BUILD_PASSES) {
      const stop = await checkStop(buildId, startedAt, acc)
      if (stop) return await stopBuild(buildId, stop, acc)

      await writePass(buildId, pass.key, { status: 'RUNNING', startedAt: new Date().toISOString() }, {
        currentPass: pass.key,
      })

      const outcome = await runOnePass(pass.key, ideaId, userId, buildId, ctx, framed, acc)

      if (passFailed(outcome)) {
        await writePass(buildId, pass.key, {
          status: 'FAILED', completedAt: new Date().toISOString(), failureReason: outcome.reason,
        })
        // Mark the passes after this one as NOT_REACHED rather than leaving them PENDING:
        // "pending" on a finished build reads as "still to come".
        for (const later of BUILD_PASSES.slice(BUILD_PASSES.indexOf(pass) + 1)) {
          await writePass(buildId, later.key, { status: 'NOT_REACHED' })
        }
        return await settleBuild(
          buildId, 'FAILED',
          `${passDef(pass.key)?.label ?? pass.key} failed: ${outcome.reason}`,
          acc.usages, acc.uncertainties,
        )
      }

      await writePass(buildId, pass.key, {
        status: 'DONE', completedAt: new Date().toISOString(), output: outcome.output,
      })
    }

    // Everything drafted. Write the "what I did and what I'm unsure about" message and
    // open every page so the user can edit any of it (§5).
    await openAllPages(ideaId)
    const summary = await composeSummary(ideaId, buildId, acc)
    return await settleBuild(buildId, 'DONE', null, acc.usages, acc.uncertainties, summary)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error('[lex-diag] 25a build threw', { ideaId, buildId, reason })
    // Whatever was persisted before the throw STAYS. The status tells the truth about it.
    return settleBuild(buildId, 'FAILED', reason, acc.usages, acc.uncertainties)
  }
}

// ── One pass ─────────────────────────────────────────────────────────────────

interface PassOk { ok: true; output: string }
interface PassFail { ok: false; reason: string }
type PassOutcome = PassOk | PassFail

/** Same reason as `llmFailed` in build-llm.ts: `strict: false` means the truthiness of a
 *  literal discriminant does not narrow, so the predicate is the supported form. */
function passFailed(o: PassOutcome): o is PassFail { return o.ok === false }

async function runOnePass(
  key: BuildPassKey,
  ideaId: string,
  userId: string,
  buildId: string,
  ctx: ElicitationContext,
  framed: ReturnType<typeof frameQuery>,
  acc: RunAccumulator,
): Promise<PassOutcome> {
  switch (key) {
    case 'ORIENT': return orientPass(ideaId, buildId, framed, acc)
    case 'DIAGNOSIS': return diagnosisPass(ideaId, userId, buildId, framed, acc)
    case 'APPROACH': return approachPass(ideaId, userId, buildId, ctx, framed, acc)
    case 'ACTIONS': return actionsPass(ideaId, userId, buildId, framed, acc)
  }
}

// §3 — one corpus search through the gateway, plus one domain-transfer question.
async function orientPass(
  ideaId: string, buildId: string, framed: ReturnType<typeof frameQuery>, acc: RunAccumulator,
): Promise<PassOutcome> {
  // ⚠ TWO INTENTS, ONE SEARCH EACH, exactly as §3 asks: BACKGROUND_BRIEFING and
  // LEGAL_LANDSCAPE. They are separate gateway calls because the intents route
  // differently, and merging them into one query would make the routed streams the
  // union rather than the right set for each.
  const seen = new Set<string>()
  const merged: SearchResult[] = []
  let anyFailed = false
  let anyRan = false

  for (const intent of ['BACKGROUND_BRIEFING', 'LEGAL_LANDSCAPE'] as const) {
    try {
      const out = await runSearch({
        keywords: framed.keywords,
        intent,
        ideaContext: framed.ideaContext,
        limit: 16,
      })
      anyRan = true
      if (out.failed) { anyFailed = true; continue }
      for (const r of out.results) {
        if (seen.has(r.id)) continue
        seen.add(r.id)
        merged.push(r)
      }
    } catch (err) {
      anyFailed = true
      console.warn('[lex-diag] 25a orient search threw', { intent, error: err instanceof Error ? err.message : err })
    }
  }

  acc.results = merged
  // ⚠ "the search failed" and "the corpus is silent" are different sentences to a user
  // building a case for Parliament (§19-C Task 1a). The flag records which.
  acc.searchFailed = anyFailed || !anyRan

  // Store the retrieval where the existing panel already looks for it, so §5's "present
  // it in the panel as it stands today" needs no new surface.
  const record: StageSearchRecord = {
    intent: 'BACKGROUND_BRIEFING',
    ranAt: new Date().toISOString(),
    ok: !acc.searchFailed,
    failureReason: acc.searchFailed ? 'one or more corpus searches did not complete' : undefined,
    query: framed.keywords,
    results: merged.slice(0, 20),
  }
  await storeStageSearch(ideaId, 'ORIENTATION', record)
  await storeStageSearch(ideaId, 'DIAGNOSIS', { ...record, intent: 'LEGAL_LANDSCAPE' })
  await prisma.idea.update({
    where: { id: ideaId },
    // NUL-stripped — see lib/lex/json-safe.ts. This is the write that FOUND the defect:
    // one U+0000 in one snippet, out of 240 results across five routed streams, took a
    // whole build down with a driver message that named nothing.
    data: { legislationRefs: stripNullBytes(merged.slice(0, 20)) as never },
  })

  const result = await runOrientPass({ promptBlock: framed.promptBlock, results: merged })
  acc.usages.push(result.usage)
  if (llmFailed(result)) {
    console.error('[lex-diag] 25a orient pass failed', { reason: result.reason, detail: result.detail })
    return { ok: false, reason: plainFailure(result.reason) }
  }

  const o = result.value
  // Drop any cited id that is not in the set we handed over. A fabricated citation
  // cannot be persisted even if the model produces one.
  const cited = (o.citedSourceIds ?? []).filter((id) => seen.has(id))
  const dropped = (o.citedSourceIds ?? []).length - cited.length
  if (dropped) console.warn('[lex-diag] 25a orient dropped unknown source ids', { dropped })

  acc.orientation = [
    o.terrain,
    '',
    `On "${DOMAIN_TRANSFER_QUESTION}" — ${o.domainTransfer}`,
  ].join('\n')

  // The legal landscape is a structured PROPOSAL, like every other field this build
  // fills. It is only claimed when there is something in it (§19-D Task 2a — a
  // "Proposed by Lex" badge over five empty inputs is a claim nobody made).
  const landscape = { currentLaw: (o.currentLaw ?? '').trim(), whereItFails: (o.whereItFails ?? '').trim() }
  if (landscape.currentLaw || landscape.whereItFails) {
    await setProposal(ideaId, 'legalLandscape', { value: landscape })
  }

  // The briefing document, on the surface the panel already renders. The
  // domain-transfer half is LABELLED as reasoning in the body, because it is.
  await prisma.document.upsert({
    where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } },
    create: {
      ideaId, kind: 'INITIAL_BACKGROUND', status: 'ready',
      summary: o.terrain.slice(0, 400),
      body: briefingBody(o.terrain, o.domainTransfer, merged, acc.searchFailed),
    },
    update: {
      status: 'ready',
      summary: o.terrain.slice(0, 400),
      body: briefingBody(o.terrain, o.domainTransfer, merged, acc.searchFailed),
    },
  })

  console.log('[lex-diag] 25a orient done', {
    buildId, results: merged.length, searchFailed: acc.searchFailed, cited: cited.length,
  })
  return {
    ok: true,
    output: acc.searchFailed
      ? `${merged.length} sources — ⚠ at least one corpus search did not complete`
      : `${merged.length} sources read; ${cited.length} cited`,
  }
}

async function diagnosisPass(
  ideaId: string, userId: string, buildId: string,
  framed: ReturnType<typeof frameQuery>, acc: RunAccumulator,
): Promise<PassOutcome> {
  const result = await runDiagnosisPass({
    promptBlock: framed.promptBlock, orientation: acc.orientation, results: acc.results,
  })
  acc.usages.push(result.usage)
  if (llmFailed(result)) {
    console.error('[lex-diag] 25a diagnosis pass failed', { reason: result.reason, detail: result.detail })
    return { ok: false, reason: plainFailure(result.reason) }
  }
  const d = result.value

  // Page 1's two proposed scalars. The user's own narrative boxes were written as
  // ACCEPTED by the elicitation; these are Lex's, so they are proposals.
  if (d.title?.trim()) await setProposal(ideaId, 'title', { value: d.title.trim().slice(0, 120) })
  const keywords = (d.keywords ?? []).map((k) => String(k).trim()).filter(Boolean).slice(0, 8)
  if (keywords.length) await setProposal(ideaId, 'keywords', { value: keywords })

  if (d.challenge?.trim()) await setProposal(ideaId, 'challenge', { value: d.challenge.trim() })
  const who = d.whoAffectedImpactCost
  if (who && Object.values(who).some((v) => String(v ?? '').trim())) {
    await setProposal(ideaId, 'whoAffectedImpactCost', {
      value: {
        affectedGroups: String(who.affectedGroups ?? '').trim(),
        impact: String(who.impact ?? '').trim(),
        cost: String(who.cost ?? '').trim(),
        evidence: String(who.evidence ?? '').trim(),
      },
    })
  }

  const causes = (d.causes ?? []).filter((c) => c?.cause?.trim())
  if (causes.length) {
    await createCauses(ideaId, causes.map((c) => ({
      cause: c.cause.trim(),
      whyPersisted: c.whyPersisted?.trim() || null,
      classification: c.classification === 'MATERIAL' ? 'MATERIAL' : 'CONTRIBUTORY',
    })), 'LEX_CORPUS')
    // The loop field is marked AWAITING so it reads as "Lex has put candidates here for
    // you to curate", which is what has happened.
    await setProposal(ideaId, 'causes', { value: '' })
  }

  // ⚠ `rootCause` is a REFERENCE field — the user picks one cause from the loop. Lex's
  // pick is offered as a proposal (so agreeing is one click) and is ALSO recorded as a
  // fork, because choosing which cause is pivotal is the single most consequential
  // choice in the diagnosis and 25-C turns it into a decision.
  if (d.rootCause?.trim()) await setProposal(ideaId, 'rootCause', { value: d.rootCause.trim() })
  if (d.pivotalObstacle?.trim()) await setProposal(ideaId, 'pivotalObstacle', { value: d.pivotalObstacle.trim() })
  if (d.summaryDiagnosis?.trim()) await setProposal(ideaId, 'summaryDiagnosis', { value: d.summaryDiagnosis.trim() })

  const { written, trimmed } = await persistForks(buildId, ideaId, d.forks ?? [])
  acc.forkCount += written
  mergeUncertainties(acc, d.uncertainties ?? [])
  acc.diagnosis = [
    d.challenge, d.summaryDiagnosis,
    d.rootCause ? `Root cause: ${d.rootCause}` : '',
    d.pivotalObstacle ? `Pivotal obstacle: ${d.pivotalObstacle}` : '',
  ].filter(Boolean).join('\n')

  console.log('[lex-diag] 25a diagnosis done', { buildId, causes: causes.length, forks: written, trimmed })
  return { ok: true, output: `${causes.length} causes, ${written} recorded alternatives` }
}

async function approachPass(
  ideaId: string, userId: string, buildId: string, ctx: ElicitationContext,
  framed: ReturnType<typeof frameQuery>, acc: RunAccumulator,
): Promise<PassOutcome> {
  const result = await runApproachPass({
    promptBlock: framed.promptBlock,
    orientation: acc.orientation,
    diagnosis: acc.diagnosis,
    ruledOut: ctx.ruledOut,
    results: acc.results,
  })
  acc.usages.push(result.usage)
  if (llmFailed(result)) {
    console.error('[lex-diag] 25a approach pass failed', { reason: result.reason, detail: result.detail })
    return { ok: false, reason: plainFailure(result.reason) }
  }
  const a = result.value

  const options = (a.policyOptions ?? []).filter((o) => o?.approach?.trim())
  if (options.length) {
    await createPolicyOptions(ideaId, options.map((o) => ({
      approach: o.approach.trim(),
      caseFor: o.caseFor?.trim() || null,
      caseAgainst: o.caseAgainst?.trim() || null,
      mechanismTypes: (o.mechanismTypes ?? []).map(String).filter(Boolean),
      source: 'LEX' as const,
    })), 'LEX')
    await setProposal(ideaId, 'policyOptions', { value: '' })
  }
  if (a.chosenApproach?.trim()) await setProposal(ideaId, 'chosenApproach', { value: a.chosenApproach.trim() })
  if (a.leverage?.trim()) await setProposal(ideaId, 'leverage', { value: a.leverage.trim() })
  if (a.whatItRulesOut?.trim()) await setProposal(ideaId, 'whatItRulesOut', { value: a.whatItRulesOut.trim() })
  if (a.summaryGuidingPolicy?.trim()) await setProposal(ideaId, 'summaryGuidingPolicy', { value: a.summaryGuidingPolicy.trim() })

  // §4 — THE INSTRUMENT QUESTION. Named, recorded as a fork of its own, and folded into
  // the guiding-policy summary so it is visible without opening the fork list.
  const inst = a.instrument
  acc.instrument = inst?.chosen?.trim()
    ? `${inst.chosen.trim()} · ${inst.scope ?? 'scope not stated'} · ${inst.devolution ?? 'devolution not stated'}`
    : 'not named'
  const instrumentForks: RawFork[] = inst?.chosen?.trim()
    ? [{
        forkKey: INSTRUMENT_FORK_KEY,
        fieldKey: 'summaryGuidingPolicy',
        chosen: acc.instrument,
        alternatives: (inst.alternatives ?? []).map((x) => ({
          alternative: x.alternative, caseForAlternative: x.caseForAlternative,
        })),
      }]
    : []
  if (!instrumentForks.length) {
    // ⚠ Reported, not papered over. The instrument question is the one §4 adds, so a
    // build that skipped it must be visible rather than looking like a build that
    // answered it. It is not a pass failure — the rest of the approach is still useful.
    console.warn('[lex-diag] 25a APPROACH named no instrument', { buildId })
    acc.uncertainties['summaryGuidingPolicy'] =
      'I did not manage to name what KIND of instrument this would be (a Bill, a regulation, a ' +
      'regulator rule, funding, an organisational change) — that question is still open and it matters.'
  }

  // Duplicate instrument forks are dropped inside persistForks — see the note there.
  const { written, trimmed } = await persistForks(buildId, ideaId, [...instrumentForks, ...(a.forks ?? [])])
  acc.forkCount += written
  mergeUncertainties(acc, a.uncertainties ?? [])
  acc.approach = [a.chosenApproach, a.leverage, a.whatItRulesOut].filter(Boolean).join('\n')

  console.log('[lex-diag] 25a approach done', {
    buildId, options: options.length, instrument: acc.instrument, forks: written, trimmed,
  })
  return { ok: true, output: `${options.length} approaches; instrument: ${acc.instrument}` }
}

async function actionsPass(
  ideaId: string, userId: string, buildId: string,
  framed: ReturnType<typeof frameQuery>, acc: RunAccumulator,
): Promise<PassOutcome> {
  const result = await runActionsPass({
    promptBlock: framed.promptBlock,
    diagnosis: acc.diagnosis,
    approach: acc.approach,
    instrument: acc.instrument,
  })
  acc.usages.push(result.usage)
  if (llmFailed(result)) {
    console.error('[lex-diag] 25a actions pass failed', { reason: result.reason, detail: result.detail })
    return { ok: false, reason: plainFailure(result.reason) }
  }
  const v = result.value

  const actions = (v.actions ?? []).filter((x) => x?.practicalStep?.trim())
  if (actions.length) {
    await createActions(ideaId, actions.map((x) => ({
      practicalStep: x.practicalStep.trim(),
      whoImplements: x.whoImplements?.trim() || null,
      mechanismType: x.mechanismType?.trim() || null,
      // ⚠ NO COSTS. Costing is the user's work with Lex, and a fabricated range written
      // here would be carried into a cost-benefit case as though it had a source.
      source: 'LEX' as const,
    })), 'LEX')
    await setProposal(ideaId, 'actions', { value: '' })
  }
  if (v.summaryCoherentActions?.trim()) {
    await setProposal(ideaId, 'summaryCoherentActions', { value: v.summaryCoherentActions.trim() })
  }

  const { written, trimmed } = await persistForks(buildId, ideaId, v.forks ?? [])
  acc.forkCount += written
  mergeUncertainties(acc, v.uncertainties ?? [])

  console.log('[lex-diag] 25a actions done', { buildId, actions: actions.length, forks: written, trimmed })
  return { ok: true, output: `${actions.length} actions drafted` }
}

// ── Finishing ────────────────────────────────────────────────────────────────

/**
 * Open every page so the user can edit any of what was just drafted.
 *
 * `assertWritableField` refuses a write to a page ahead of `Idea.lexPage`, and the
 * canonical state scopes `currentField` to the active page. A build that fills all four
 * pages while the pointer still says ORIENTATION would produce a panel full of drafts
 * the user could look at and not save — the write would 409. So the pointer moves to
 * the last page, which makes every page `reachable` and every field writable, exactly
 * as it would be for a user who had walked there.
 */
async function openAllPages(ideaId: string): Promise<void> {
  await prisma.idea.update({ where: { id: ideaId }, data: { lexPage: 'COHERENT_ACTIONS' } })
}

async function composeSummary(ideaId: string, buildId: string, acc: RunAccumulator): Promise<string> {
  const passes = readPassLog((await prisma.ideaBuild.findUnique({ where: { id: buildId }, select: { passes: true } }))?.passes)
  const done = passes.filter((p) => p.status === 'DONE').map((p) => p.label)
  const uncertainties: RawUncertainty[] = Object.entries(acc.uncertainties).map(([fieldKey, sentence]) => ({ fieldKey, sentence }))

  const result = await writeBuildSummary({
    passesCompleted: done,
    uncertainties,
    forkCount: acc.forkCount,
    sourcesUsed: acc.results.length,
    searchFailed: acc.searchFailed,
  })
  acc.usages.push(result.usage)

  // A failed summary is not a failed build — the draft is real either way. But it must
  // not be replaced with prose that implies Lex reviewed its own work when it did not,
  // so the deterministic version states only facts the row already holds.
  const message = llmOk(result)
    ? result.value.message.trim()
    : [
        `I’ve drafted a first version from your four answers: ${done.join(', ')}.`,
        acc.searchFailed
          ? 'At least one corpus search did not complete, so the background is partial — that is a gap in what I looked at, not a finding that there is nothing there.'
          : `I read ${acc.results.length} sources from the corpus.`,
        uncertainties.length
          ? `There are ${uncertainties.length} things I said I was unsure about; they are listed against the fields they belong to.`
          : 'I did not record anything I was unsure about, which is itself worth a sceptical look.',
        'I couldn’t write my own summary of the run just then — that part failed, and the rest stands.',
      ].join(' ')

  if (llmFailed(result)) {
    console.warn('[lex-diag] 25a build summary fell back to the deterministic form', {
      reason: result.reason, detail: result.detail,
    })
  }

  // §5 — the message, then the credibility note, then the invitation to edit. The order
  // is the decision: the warning comes AFTER the work, where it reads as respect.
  await appendTranscript(ideaId, [
    lexBubble(message, BUILD_STAGE, 'build:summary'),
    lexBubble(CREDIBILITY_NOTE, BUILD_STAGE, 'build:credibility'),
    lexBubble(DIRECT_EDITING_NOTE, BUILD_STAGE, 'build:editing'),
  ])
  return message
}

async function stopBuild(buildId: string, stop: StopReason, acc: RunAccumulator): Promise<BuildView> {
  const status = stop.kind === 'cancel' ? 'CANCELLED' : 'FAILED'
  // Passes that never ran are NOT_REACHED, not PENDING — see the note in runBuild.
  const row = await prisma.ideaBuild.findUnique({ where: { id: buildId }, select: { passes: true } })
  const log = readPassLog(row?.passes).map((p) =>
    p.status === 'PENDING' || p.status === 'RUNNING'
      ? { ...p, status: 'NOT_REACHED' as PassStatus, completedAt: new Date().toISOString() }
      : p)
  await prisma.ideaBuild.update({ where: { id: buildId }, data: { passes: stripNullBytes(log) as never } })
  console.warn('[lex-diag] 25a build stopped early', { buildId, kind: stop.kind })
  return settleBuild(buildId, status, stopMessage(stop), acc.usages, acc.uncertainties)
}

/**
 * Write the final status, the spend and the uncertainties in ONE guarded update.
 *
 * ⚠ The spend is written on EVERY terminal path, including the failures. A build that
 * burned tokens and then failed still cost money, and a cost record that only exists on
 * success is a cost record that under-reports precisely when it matters.
 */
async function settleBuild(
  buildId: string,
  status: 'DONE' | 'FAILED' | 'CANCELLED',
  failureReason: string | null,
  usages: LlmUsage[],
  uncertainties: Record<string, string> = {},
  summaryMessage?: string,
): Promise<BuildView> {
  const price = priceBuild(usages)
  await prisma.ideaBuild.updateMany({
    // Guarded: a settle must never overwrite a row that has already reached a terminal
    // status (a cancel racing the last pass, for instance).
    where: { id: buildId, status: { in: ['QUEUED', 'RUNNING'] } },
    data: {
      status,
      completedAt: new Date(),
      currentPass: null,
      failureReason,
      tokensIn: price.tokensIn,
      tokensOut: price.tokensOut,
      // null when unpriced — never 0 as a stand-in. See build-cost.ts.
      estCostPence: price.pence,
      uncertainties: stripNullBytes(uncertainties) as never,
      ...(summaryMessage ? { summaryMessage } : {}),
    },
  })
  const row = await prisma.ideaBuild.findUnique({ where: { id: buildId } })
  if (!row) throw new Error('Build row vanished during settle')
  const forks = await prisma.buildFork.findMany({
    where: { buildId }, orderBy: [{ forkKey: 'asc' }, { alternativeIndex: 'asc' }],
  })
  console.log('[lex-diag] 25a build settled', {
    buildId, status, passesComplete: row.passesComplete, spend: formatSpend(price), forks: forks.length,
  })
  return toView(row, forks)
}
