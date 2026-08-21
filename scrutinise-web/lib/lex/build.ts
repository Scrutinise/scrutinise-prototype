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
  HARD_STOP_MS, PASS_BUDGET_MS, perspectivesFor, modelForPass, buildDriver, WORKER_PICKUP_GRACE_MS,
  type BuildDriver,
  type BuildPassKey, type Framing,
} from './build-config'
import {
  runOrientPass, runDiagnosisPass, runApproachPass, runActionsPass, writeBuildSummary,
  runRevisePass,
  type RawFork, type RawUncertainty, type OrientOutput, type InstrumentAssessment,
} from './build-client'
import {
  freshPassLog, readPassLog, carryInto, allUsages, nextPassKey, isResumable, passesComplete,
  type PassRecord, type PassStatus, type PassCarry,
} from './build-carry'
import { runResearch, draftFactsFor } from './build-research'
import { buildEstimate, formatDuration, type BuildEstimate } from './build-estimate'
import { sendBuildCompleteEmail } from '@/lib/email'
import { generateAdversarialIssues } from './deepening-adversarial'
import { readKnownUnknowns } from './deepening'
import { supersedeOlderProposals } from './evidence-layer'

export const BUILD_STAGE = 'BUILD'
export type { PassRecord, PassStatus }

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
  /**
   * 25-B §8 — "Report the spend per build, broken down by pass." Derived from the same
   * usages the build total is derived from, so the two cannot disagree.
   */
  spendByPass: Array<{ key: string; label: string; tokensIn: number; tokensOut: number; pence: number | null }>
  /**
   * 25-B §1 — THE POLLING SURFACE'S INSTRUCTION TO THE CLIENT. Which pass the server
   * wants run next, or null when there is nothing left to run. The client triggers it;
   * the server decides it. A client that guessed the next pass could ask for one that
   * has already run.
   */
  nextPass: BuildPassKey | null
  /** TRUE when this build stopped part-way and can be picked up from its last completed
   *  pass rather than restarted from nothing. */
  resumable: boolean
  /**
   * AMENDMENT_25B §B — TRUE when the worker was meant to take this build and has not
   * within the grace period, so the page is driving it instead. Surfaced rather than
   * hidden: a build running in the browser because the worker is down behaves
   * differently (it needs the tab open) and the user has to be told.
   */
  workerLate: boolean
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
  /**
   * AMENDMENT_25B §C4 — how long this usually takes, measured rather than guessed.
   * Carries its own sample size, so the page can say when it does not know yet.
   */
  estimate: BuildEstimate
  /** §C4 — the user's remembered choice, so the checkbox comes up as they left it. */
  emailDefault: boolean
  /**
   * AMENDMENT_25B §B — WHO IS DRIVING THIS BUILD.
   *
   * `worker` — Railway runs it end to end; the page may be closed and the build carries
   * on. `client` — the documented fallback, driven pass-by-pass from this page, which
   * therefore has to stay open.
   *
   * Told to the client rather than inferred by it: the difference decides whether the
   * page must warn the user not to leave, and a wrong guess either double-runs every pass
   * or leaves the build stalled for ever.
   */
  driver: BuildDriver
}

function toView(
  row: NonNullable<Awaited<ReturnType<typeof prisma.ideaBuild.findFirst>>>,
  forks: Array<{ id: string; forkKey: string; fieldKey: string; chosen: string; alternative: string; caseForAlternative: string; alternativeIndex: number; resolved: boolean }>,
): BuildView {
  const passes = readPassLog(row.passes)
  const started = row.startedAt ? row.startedAt.getTime() : null
  const ended = row.completedAt ? row.completedAt.getTime() : null

  // The worker was supposed to take this and has not. See WORKER_PICKUP_GRACE_MS.
  const workerLate =
    buildDriver() === 'worker' &&
    row.status === 'QUEUED' &&
    Date.now() - row.createdAt.getTime() > WORKER_PICKUP_GRACE_MS
  // ⚠ PRICED FROM THE PASS LOG WHILE THE BUILD IS STILL RUNNING. 25-A settled the row's
  // token columns only at the end, which was fine when the whole build was one request.
  // With one pass per request (§1) the columns are stale for minutes at a time, and a
  // spend line reading 0 while four passes have run would be the "zero is a claim"
  // failure build-cost.ts exists to prevent. The log is the live source; the columns are
  // the settled record, and `settleBuild` writes them from the same numbers.
  const live = priceBuild(allUsages(passes))
  const settled = row.status === 'QUEUED' || row.status === 'RUNNING'
  const price: BuildPrice = settled
    ? live
    : {
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
    spendByPass: passes.map((p) => {
      const per = priceBuild(p.usages ?? [])
      return {
        key: p.key, label: p.label,
        tokensIn: per.tokensIn, tokensOut: per.tokensOut, pence: per.pence,
      }
    }),
    // ⚠ NULL WHEN THE WORKER IS DRIVING. `nextPass` is an instruction to the client to
    // POST for the next pass; with the worker running the build, a client that acted on
    // it would drive the same passes a second time. The server decides who drives, and
    // it says so here rather than leaving the client to infer it.
    //
    // ⚠ …EXCEPT WHEN NO WORKER HAS PICKED IT UP. See WORKER_PICKUP_GRACE_MS: a build left
    // at QUEUED because there is no worker would otherwise spin for ever, so past the
    // grace period the client is told to drive it after all. `workerLate` says why, so
    // "the worker is absent" and "the worker is slow" do not read the same.
    nextPass: (row.status === 'RUNNING' || row.status === 'QUEUED') && (buildDriver() === 'client' || workerLate)
      ? nextPassKey(passes)
      : null,
    workerLate,
    resumable: isResumable(passes),
    forks,
  }
}

export async function buildState(ideaId: string): Promise<BuildState> {
  // Settle on the READ, and by WRITING the status — invariant 2. A build that died
  // without reporting back must not be able to sit at RUNNING for ever.
  await settleAbandonedBuilds(ideaId)

  const estimate = await buildEstimate()
  const owner = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { creator: { select: { emailOnBuildComplete: true } } },
  })

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
    estimate,
    emailDefault: owner?.creator.emailOnBuildComplete ?? false,
    driver: buildDriver(),
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
export async function claimBuild(
  ideaId: string,
  framing: Framing,
  /**
   * AMENDMENT_25B §C4 — "email me when it's done", as chosen for THIS build. Undefined
   * means the caller expressed no preference and the user's remembered default stands.
   */
  notifyEmail?: boolean,
): Promise<string> {
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

  // §C4 — the choice is FROZEN ONTO THE ROW at enqueue, and the user's default is updated
  // to match. The worker reads the row minutes later on another machine; reading the
  // preference at send time would make a change in another tab retroactive.
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { creatorId: true } })
  let wantsEmail = notifyEmail
  if (wantsEmail === undefined) {
    const u = idea && await prisma.user.findUnique({
      where: { id: idea.creatorId }, select: { emailOnBuildComplete: true },
    })
    wantsEmail = u?.emailOnBuildComplete ?? false
  } else if (idea) {
    await prisma.user.update({
      where: { id: idea.creatorId },
      data: { emailOnBuildComplete: wantsEmail },
    })
  }

  let created
  try {
    created = await prisma.ideaBuild.create({
      data: {
        ideaId, version, framing, status: 'QUEUED',
        notifyEmail: wantsEmail,
        passes: freshPassLog() as never,
      },
    })
  } catch (err) {
    // P2002 on either unique index means someone else won the race. That is the guard
    // doing its job, not an error to surface as a 500.
    const code = (err as { code?: string })?.code
    if (code === 'P2002') throw new BuildAlreadyRunning()
    throw err
  }

  // ⚠ AMENDMENT_25B §B — ON THE WORKER, THE ROW STAYS QUEUED AND THE REQUEST RETURNS.
  //
  // "The web app enqueues it and returns immediately." QUEUED is what the worker polls
  // for, so moving the row to RUNNING here would hide it from the queue and the build
  // would never start. The worker claims it, in its own conditional write.
  //
  // On the client-driven fallback the request DOES claim it, because there is no worker
  // coming and the very next POST runs pass 1.
  if (buildDriver() === 'worker') {
    console.log('[lex-diag] 25b build ENQUEUED for the worker', {
      ideaId, buildId: created.id, version, framing,
    })
    return created.id
  }

  // The conditional claim. Guarded on the status we expect to find, and the COUNT is
  // read — a claim whose result is not checked is not a claim.
  const claimed = await prisma.ideaBuild.updateMany({
    where: { id: created.id, status: 'QUEUED' },
    data: { status: 'RUNNING', startedAt: new Date(), currentPass: BUILD_PASSES[0].key },
  })
  if (claimed.count === 0) throw new BuildAlreadyRunning()

  console.log('[lex-diag] 25b build claimed for client-driven run', {
    ideaId, buildId: created.id, version, framing,
  })
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

/**
 * Everything ONE pass needs. 25-A passed a mutable `RunAccumulator` down a loop inside a
 * single function; §1 splits the passes across requests, so what a pass receives is
 * assembled fresh from the STORED carry and the database each time.
 *
 * `usages` is the exception and is genuinely per-pass: the pass owns what it spent, and
 * the build total is the sum over the log (build-carry.ts).
 */
interface PassContext {
  ideaId: string
  userId: string
  buildId: string
  buildVersion: number
  ctx: ElicitationContext
  framed: ReturnType<typeof frameQuery>
  carry: PassCarry
  usages: LlmUsage[]
  /** §8 — say what is happening while it happens, not after. */
  activity: (line: string) => Promise<void>
}

interface PassOk { ok: true; output: string; carry?: PassCarry }
interface PassFail { ok: false; reason: string }
type PassOutcome = PassOk | PassFail

/** A reason a build stopped early. Naming them apart is the §18 rule. */
type StopReason =
  | { kind: 'time'; elapsedMs: number }
  | { kind: 'cost'; price: BuildPrice }
  | { kind: 'cancel' }

/**
 * ⚠ THE HARD STOP IS MEASURED FROM THE ROW, NOT FROM THIS FUNCTION.
 *
 * This is the change that makes 25-A's 15-minute ceiling real (see build-config.ts). The
 * build now spans many requests, so "how long has this build been running" is a question
 * about `startedAt` on the stored row. Measuring from the current function's start would
 * reset the clock on every pass and produce a ceiling that can never fire — which is
 * exactly the guard-that-cannot-fail 25-A refused to ship.
 */
async function checkStop(buildId: string, usages: LlmUsage[]): Promise<StopReason | null> {
  const row = await prisma.ideaBuild.findUnique({
    where: { id: buildId },
    select: { cancelRequested: true, startedAt: true },
  })
  if (row?.cancelRequested) return { kind: 'cancel' }

  const elapsed = row?.startedAt ? Date.now() - row.startedAt.getTime() : 0
  if (elapsed > HARD_STOP_MS) return { kind: 'time', elapsedMs: elapsed }

  const price = priceBuild(usages)
  // ⚠ An UNPRICED run cannot be stopped on cost, and pretending otherwise (by treating
  // null as 0) would mean the ceiling silently stopped existing. It is logged loudly
  // instead, so the gap is visible rather than assumed away.
  if (price.pence != null && price.pence > COST_CEILING_PENCE) return { kind: 'cost', price }
  if (price.pence == null && (price.tokensIn || price.tokensOut)) {
    console.warn('[lex-diag] 25b cost ceiling NOT ENFORCEABLE this run — unpriced model(s)', {
      buildId, unpriced: price.unpriced,
    })
  }
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

/**
 * The corpus results pass 1 retrieved, re-read for a later pass.
 *
 * §1's cost: passes 2a–2c used to hold `acc.results` in memory. They now run in their own
 * requests, so they read back what pass 1 STORED. This is the same list the panel shows,
 * which is a small improvement on its own — what the later passes reason over and what
 * the user can see are now provably the same set.
 */
async function storedResults(ideaId: string): Promise<SearchResult[]> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { legislationRefs: true } })
  const raw = idea?.legislationRefs
  return Array.isArray(raw) ? (raw as unknown as SearchResult[]) : []
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
      passesComplete: passesComplete(log),
      ...extra,
    },
  })
}

/**
 * §1 — CLAIM ONE PASS, IN A CONDITIONAL WRITE WHOSE RESULT IS READ.
 *
 * The build's own single-active-build guard is not enough any more. With the client
 * triggering each pass, two polls landing together can both decide the same pass is
 * next, and both would run it — double-charging the user and writing two sets of
 * proposals. So a pass is claimed the same way a build is: read the stored log, verify
 * the pass is still PENDING, and write RUNNING guarded on the status we read.
 *
 * Returns false when someone else got there first, which is not an error.
 */
async function claimPass(buildId: string, key: BuildPassKey): Promise<boolean> {
  const row = await prisma.ideaBuild.findUnique({
    where: { id: buildId }, select: { passes: true, status: true },
  })
  if (!row || (row.status !== 'RUNNING' && row.status !== 'QUEUED')) return false

  const log = readPassLog(row.passes)
  const target = log.find((p) => p.key === key)
  if (!target || (target.status !== 'PENDING' && target.status !== 'RUNNING')) return false
  // A pass already marked RUNNING is either a concurrent claim or a request the platform
  // killed. `settleAbandonedBuilds` is what tells those apart, by age; here we simply
  // decline, because re-entering a pass that may still be live is how work gets doubled.
  if (target.status === 'RUNNING') return false

  const next = log.map((p) =>
    p.key === key
      ? { ...p, status: 'RUNNING' as PassStatus, startedAt: new Date().toISOString(), activity: 'Starting' }
      : p)

  const claimed = await prisma.ideaBuild.updateMany({
    // Guarded on the build status, and the count is read. A claim whose result is not
    // checked is not a claim.
    where: { id: buildId, status: { in: ['QUEUED', 'RUNNING'] } },
    data: {
      passes: stripNullBytes(next) as never,
      status: 'RUNNING',
      currentPass: key,
    },
  })
  return claimed.count > 0
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
            // 25-C §3a — the case FOR the road taken, so the agenda can show a
            // recommendation the user can weigh rather than one they can only defer to.
            recommendationReason: f.whyChosen?.trim() || null,
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

/** Merge this pass's uncertainties into the ones already on the row. Cross-request, so
 *  the accumulation is a read-modify-write rather than an in-memory object. */
async function mergeUncertainties(buildId: string, list: RawUncertainty[]): Promise<void> {
  const clean = (list ?? []).filter((u) => u?.fieldKey?.trim() && u?.sentence?.trim())
  if (!clean.length) return
  const row = await prisma.ideaBuild.findUnique({ where: { id: buildId }, select: { uncertainties: true } })
  const existing = (row?.uncertainties && typeof row.uncertainties === 'object' && !Array.isArray(row.uncertainties)
    ? (row.uncertainties as Record<string, string>)
    : {})
  for (const u of clean) existing[u.fieldKey.trim()] = u.sentence.trim()
  await prisma.ideaBuild.update({
    where: { id: buildId },
    data: { uncertainties: stripNullBytes(existing) as never },
  })
}

/**
 * §1 — RUN THE NEXT PASS, AND ONE PASS ONLY.
 *
 * ⚠ THIS IS THE ARCHITECTURAL CHANGE THE SPRINT TURNS ON, so the reasoning is here
 * rather than in a brief nobody reads next to the code.
 *
 * 25-A ran all four passes inside one request in 45–53 seconds. 25-B's seven passes
 * include ten-odd library questions, each retrieving ~100 candidates and sifting them,
 * plus a revision and an adversarial read — minutes of model time. Vercel's `maxDuration`
 * ceiling is 300 seconds and there is no configuration that raises it. A ceiling that
 * cannot be raised is an architecture constraint, not a configuration problem.
 *
 * So: the client already polls this build's row every three seconds. The poll response
 * now carries `nextPass`, and the client POSTs it back. Each pass therefore gets its own
 * 300-second budget, incremental persistence already existed, and a pass the platform
 * kills mid-flight is picked up by the settle and RESUMED rather than failed.
 *
 * Awaited by its route ON PURPOSE — returning early and letting the promise run on is
 * how work gets silently killed when the response ends.
 */
export async function runNextPass(ideaId: string, userId: string, buildId: string): Promise<BuildView> {
  const row = await prisma.ideaBuild.findUnique({ where: { id: buildId } })
  if (!row) throw new Error('Build row missing')
  if (row.status !== 'RUNNING' && row.status !== 'QUEUED') return buildViewOf(buildId)

  const log = readPassLog(row.passes)
  const key = nextPassKey(log)

  // Nothing left to run. Finish the build — and note that this is reached by a POLL, so
  // a build whose last pass completed in a request that then died still finishes.
  if (!key) return finishBuild(ideaId, buildId)

  const usagesSoFar = allUsages(log)
  const stop = await checkStop(buildId, usagesSoFar)
  if (stop) return stopBuild(buildId, stop)

  if (!(await claimPass(buildId, key))) {
    console.log('[lex-diag] 25b pass already claimed by another request', { buildId, key })
    return buildViewOf(buildId)
  }

  const ctx = await elicitationContext(ideaId, userId)
  if (!ctx) return settleBuild(buildId, 'FAILED', 'There is no elicitation to build from.', [])

  const framed = frameQuery(row.framing as Framing, ctx)
  if (!row.queryUsed) {
    await prisma.ideaBuild.update({ where: { id: buildId }, data: { queryUsed: framed.queryUsed } })
  }

  const passUsages: LlmUsage[] = []
  const pctx: PassContext = {
    ideaId, userId, buildId,
    buildVersion: row.version,
    ctx,
    framed,
    carry: carryInto(log, key),
    usages: passUsages,
    activity: (line: string) => writePass(buildId, key, { activity: line }),
  }

  console.log('[lex-diag] 25b pass starting', {
    ideaId, buildId, key, passBudgetMs: PASS_BUDGET_MS, hardStopMs: HARD_STOP_MS,
    perspectives: perspectivesFor(key).length, model: modelForPass(key),
  })

  let outcome: PassOutcome
  try {
    outcome = await runOnePass(key, pctx)
  } catch (err) {
    outcome = { ok: false, reason: err instanceof Error ? err.message : String(err) }
    console.error('[lex-diag] 25b pass threw', { ideaId, buildId, key, reason: outcome.reason })
  }

  if (passFailed(outcome)) {
    // ⚠ THE SPEND IS RECORDED ON THE FAILURE PATH TOO. A pass that burned tokens and then
    // failed still cost money.
    await writePass(buildId, key, {
      status: 'FAILED', completedAt: new Date().toISOString(),
      failureReason: outcome.reason, activity: null, usages: passUsages,
    })
    for (const later of BUILD_PASSES.slice(BUILD_PASSES.findIndex((p) => p.key === key) + 1)) {
      // "PENDING" on a finished build reads as "still to come".
      await writePass(buildId, later.key, { status: 'NOT_REACHED' })
    }
    const all = allUsages(readPassLog((await prisma.ideaBuild.findUnique({
      where: { id: buildId }, select: { passes: true },
    }))?.passes))
    return settleBuild(buildId, 'FAILED', `${passDef(key)?.label ?? key} failed: ${outcome.reason}`, all)
  }

  await writePass(buildId, key, {
    status: 'DONE', completedAt: new Date().toISOString(),
    output: outcome.output, activity: null,
    carry: outcome.carry ?? {}, usages: passUsages,
  })

  // Is that the last one? Finishing HERE as well as on the next poll means a build does
  // not need one extra round trip to reach DONE — and the poll path stays as the
  // belt-and-braces route for a request that dies after the last pass.
  const after = readPassLog((await prisma.ideaBuild.findUnique({
    where: { id: buildId }, select: { passes: true },
  }))?.passes)
  if (!nextPassKey(after)) return finishBuild(ideaId, buildId)

  return buildViewOf(buildId)
}

/**
 * AMENDMENT_25B §B — RUN A BUILD END TO END. What the Railway worker calls.
 *
 * A loop over `runNextPass`, which is deliberately the SAME function the client-driven
 * fallback calls: the worker is a different DRIVER, not a different engine, so a build
 * cannot behave one way on the worker and another in the browser.
 *
 * ⚠ THE LOOP IS BOUNDED. `nextPassKey` returning the same key forever — a pass that
 * cannot claim itself, say — would spin against the model API at full speed. The bound is
 * the pass count plus a small margin, and exhausting it is reported rather than retried.
 */
export async function runBuildToCompletion(
  ideaId: string, userId: string, buildId: string,
): Promise<BuildView> {
  /**
   * ⚠ THE LOOP READS THE STORED LOG, NOT `view.nextPass`. This cost a failed acceptance
   * test and it is worth the note.
   *
   * `BuildView.nextPass` is an INSTRUCTION TO THE CLIENT, and under the worker driver it
   * is deliberately null so a browser never drives a pass the worker is already running.
   * The first version of this loop used it as its own condition, so the worker ran
   * exactly ONE pass and stopped — "RUNNING · 1/7 passes · stopped cleanly", which looks
   * like a healthy worker with nothing to do.
   *
   * The two questions are not the same question: "should the CLIENT ask for another
   * pass" and "is there another pass" have different answers by design. The engine asks
   * the second, of the log, which is the only thing that knows.
   */
  const remaining = async (): Promise<BuildPassKey | null> => {
    const row = await prisma.ideaBuild.findUnique({
      where: { id: buildId }, select: { passes: true, status: true },
    })
    if (!row || (row.status !== 'RUNNING' && row.status !== 'QUEUED')) return null
    return nextPassKey(readPassLog(row.passes))
  }

  let view = await runNextPass(ideaId, userId, buildId)
  let guard = 0
  let next = await remaining()
  while (next && guard < BUILD_PASSES.length + 3) {
    guard++
    view = await runNextPass(ideaId, userId, buildId)
    next = await remaining()
  }
  if (next) {
    console.error('[lex-diag] 25b build did not converge — the same pass kept coming back', {
      buildId, stuckOn: next, iterations: guard,
    })
    return settleBuild(
      buildId, 'FAILED',
      `The build stopped making progress at "${passDef(next)?.label ?? next}". ` +
      'Nothing it had already drafted was lost; run it again to continue from there.',
      allUsages(readPassLog((await prisma.ideaBuild.findUnique({
        where: { id: buildId }, select: { passes: true },
      }))?.passes)),
    )
  }
  return view
}

/**
 * AMENDMENT_25B §B — the worker's queue read.
 *
 * Returns the oldest build waiting to be picked up, or null. Two kinds qualify, and they
 * are the same kind from the worker's point of view:
 *
 *   · QUEUED — enqueued by the web app and never started.
 *   · RUNNING with work left — a build whose worker died mid-pass. `settleAbandonedBuilds`
 *     has already reset the killed pass to PENDING by the time this runs, so picking it
 *     up RESUMES it from its last completed pass rather than restarting it.
 *
 * ⚠ NOT CLAIMED HERE. Reading and claiming are separate so the claim can be a conditional
 * write whose count is checked — see `claimQueuedBuild`.
 */
export async function nextQueuedBuild(): Promise<{ id: string; ideaId: string; userId: string } | null> {
  const row = await prisma.ideaBuild.findFirst({
    where: { status: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, ideaId: true, idea: { select: { creatorId: true } } },
  })
  if (!row) return null
  return { id: row.id, ideaId: row.ideaId, userId: row.idea.creatorId }
}

/**
 * Claim a QUEUED build for this worker. Conditional, and the count is read — two workers
 * polling the same row must not both start it.
 */
export async function claimQueuedBuild(buildId: string): Promise<boolean> {
  const res = await prisma.ideaBuild.updateMany({
    where: { id: buildId, status: 'QUEUED' },
    data: { status: 'RUNNING', startedAt: new Date(), currentPass: BUILD_PASSES[0].key },
  })
  return res.count > 0
}

/**
 * Builds stuck at RUNNING across every idea, settled or resumed.
 *
 * `settleAbandonedBuilds` is per-idea because it runs on an idea's own poll. The worker
 * has no idea in hand, so it needs the same housekeeping across the table — otherwise a
 * build whose owner never reopens the page would sit at RUNNING for ever and never be
 * picked up again.
 */
export async function sweepStalledBuilds(): Promise<number> {
  const rows = await prisma.ideaBuild.findMany({
    where: { status: { in: ['QUEUED', 'RUNNING'] } },
    select: { ideaId: true },
    distinct: ['ideaId'],
  })
  let swept = 0
  for (const r of rows) swept += await settleAbandonedBuilds(r.ideaId)
  return swept
}

// ── One pass ─────────────────────────────────────────────────────────────────

/** Same reason as `llmFailed` in build-llm.ts: `strict: false` means the truthiness of a
 *  literal discriminant does not narrow, so the predicate is the supported form. */
function passFailed(o: PassOutcome): o is PassFail { return o.ok === false }

async function runOnePass(key: BuildPassKey, c: PassContext): Promise<PassOutcome> {
  switch (key) {
    case 'ORIENT': return orientPass(c)
    case 'DIAGNOSIS': return diagnosisPass(c)
    case 'APPROACH': return approachPass(c)
    case 'ACTIONS': return actionsPass(c)
    case 'RESEARCH': return researchPass(c)
    case 'REVISE': return revisePass(c)
    case 'ADVERSARIAL': return adversarialPass(c)
  }
}

// §3 — one corpus search through the gateway, plus one domain-transfer question.
async function orientPass(c: PassContext): Promise<PassOutcome> {
  const { ideaId, buildId, framed } = c
  await c.activity('Searching the corpus')
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

  // ⚠ "the search failed" and "the corpus is silent" are different sentences to a user
  // building a case for Parliament (§19-C Task 1a). The flag records which.
  const searchFailed = anyFailed || !anyRan

  // Store the retrieval where the existing panel already looks for it, so §5's "present
  // it in the panel as it stands today" needs no new surface.
  const record: StageSearchRecord = {
    intent: 'BACKGROUND_BRIEFING',
    ranAt: new Date().toISOString(),
    ok: !searchFailed,
    failureReason: searchFailed ? 'one or more corpus searches did not complete' : undefined,
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

  // ── §7 — ONE READING PER PERSPECTIVE, AND THEY ARE NOT BLENDED. ────────────
  //
  // ⚠ THE MERGE RULE IS DIFFERENT HERE FROM PASS 3, AND DELIBERATELY SO. Pass 3 produces
  // FINDINGS, which are discrete and can be deduplicated with the divergence preserved.
  // Pass 1 produces PROSE, and averaging four terrain paragraphs into one is precisely
  // "the mush we are trying to avoid" — the thing §7 forbids for drafting passes. So the
  // readings are kept SEPARATE AND LABELLED in the briefing, the cited ids are unioned,
  // and the one structured field this pass proposes comes from a single voice.
  const perspectives = perspectivesFor('ORIENT')
  const readings: Array<{ label: string; value: OrientOutput }> = []
  let result: Awaited<ReturnType<typeof runOrientPass>> | null = null

  for (const p of perspectives) {
    if (perspectives.length > 1) await c.activity(`Reading the terrain — ${p.label}`)
    const r = await runOrientPass({
      promptBlock: framed.promptBlock,
      results: merged,
      lens: p.lens || undefined,
      model: p.model ?? modelForPass('ORIENT'),
    })
    c.usages.push(r.usage)
    if (llmFailed(r)) {
      console.error('[lex-diag] 25b orient perspective failed', {
        perspective: p.id, reason: r.reason, detail: r.detail,
      })
      continue
    }
    // The FIRST successful reading is the house one and owns the structured field.
    if (!result) result = r
    readings.push({ label: p.label, value: r.value })
  }

  if (!result || llmFailed(result)) {
    const reason = result && llmFailed(result) ? plainFailure(result.reason) : 'every reading of the terrain failed'
    console.error('[lex-diag] 25b orient pass failed', { reason })
    return { ok: false, reason }
  }

  const o = result.value
  // Drop any cited id that is not in the set we handed over. A fabricated citation
  // cannot be persisted even if the model produces one.
  const citedAll = new Set<string>()
  for (const r of readings) for (const id of r.value.citedSourceIds ?? []) if (seen.has(id)) citedAll.add(id)
  const droppedIds = readings.reduce((n, r) => n + (r.value.citedSourceIds ?? []).length, 0) - citedAll.size
  if (droppedIds > 0) console.warn('[lex-diag] 25b orient dropped unknown source ids', { dropped: droppedIds })

  const orientation = [
    ...readings.map((r) =>
      readings.length > 1 ? `[${r.label}]\n${r.value.terrain}` : r.value.terrain),
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
  const terrainForBriefing = readings.length > 1
    ? readings.map((r) => `**${r.label}**\n\n${r.value.terrain}`).join('\n\n')
    : o.terrain
  await prisma.document.upsert({
    where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } },
    create: {
      ideaId, kind: 'INITIAL_BACKGROUND', status: 'ready',
      summary: o.terrain.slice(0, 400),
      body: briefingBody(terrainForBriefing, o.domainTransfer, merged, searchFailed),
    },
    update: {
      status: 'ready',
      summary: o.terrain.slice(0, 400),
      body: briefingBody(terrainForBriefing, o.domainTransfer, merged, searchFailed),
    },
  })

  console.log('[lex-diag] 25b orient done', {
    buildId, results: merged.length, searchFailed, cited: citedAll.size, readings: readings.length,
  })
  return {
    ok: true,
    output: searchFailed
      ? `${merged.length} sources — ⚠ at least one corpus search did not complete`
      : `${merged.length} sources read; ${citedAll.size} cited` +
        (readings.length > 1 ? ` across ${readings.length} readings` : ''),
    carry: { orientation, searchFailed },
  }
}

async function diagnosisPass(c: PassContext): Promise<PassOutcome> {
  const { ideaId, buildId, framed } = c
  await c.activity('Drafting the diagnosis')
  const result = await runDiagnosisPass({
    promptBlock: framed.promptBlock,
    orientation: c.carry.orientation ?? '',
    results: await storedResults(ideaId),
  })
  c.usages.push(result.usage)
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
  await mergeUncertainties(buildId, d.uncertainties ?? [])
  const diagnosis = [
    d.challenge, d.summaryDiagnosis,
    d.rootCause ? `Root cause: ${d.rootCause}` : '',
    d.pivotalObstacle ? `Pivotal obstacle: ${d.pivotalObstacle}` : '',
  ].filter(Boolean).join('\n')

  console.log('[lex-diag] 25b diagnosis done', { buildId, causes: causes.length, forks: written, trimmed })
  return {
    ok: true,
    output: `${causes.length} causes, ${written} recorded alternatives`,
    carry: { diagnosis },
  }
}

async function approachPass(c: PassContext): Promise<PassOutcome> {
  const { ideaId, buildId, framed, ctx } = c
  await c.activity('Drafting the approach, and naming the instrument')
  const result = await runApproachPass({
    promptBlock: framed.promptBlock,
    orientation: c.carry.orientation ?? '',
    diagnosis: c.carry.diagnosis ?? '',
    ruledOut: ctx.ruledOut,
    results: await storedResults(ideaId),
  })
  c.usages.push(result.usage)
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
  const instrument = inst?.chosen?.trim()
    ? `${inst.chosen.trim()} · ${inst.scope ?? 'scope not stated'} · ${inst.devolution ?? 'devolution not stated'}`
    : 'not named'
  const instrumentForks: RawFork[] = inst?.chosen?.trim()
    ? [{
        forkKey: INSTRUMENT_FORK_KEY,
        fieldKey: 'summaryGuidingPolicy',
        chosen: instrument,
        // The approach pass argues the instrument inside `summaryGuidingPolicy`; that
        // paragraph IS the case for it, so the fork carries it rather than leaving the
        // platform's own fork the only one with no reasoning shown (25-C §3a).
        whyChosen: a.summaryGuidingPolicy?.trim() || a.leverage?.trim() || undefined,
        alternatives: (inst.alternatives ?? []).map((x) => ({
          alternative: x.alternative, caseForAlternative: x.caseForAlternative,
        })),
      }]
    : []
  if (!instrumentForks.length) {
    // ⚠ Reported, not papered over. The instrument question is the one §4 adds, so a
    // build that skipped it must be visible rather than looking like a build that
    // answered it. It is not a pass failure — the rest of the approach is still useful.
    console.warn('[lex-diag] 25b APPROACH named no instrument', { buildId })
    await mergeUncertainties(buildId, [{
      fieldKey: 'summaryGuidingPolicy',
      sentence:
        'I did not manage to name what KIND of instrument this would be (a Bill, a regulation, a ' +
        'regulator rule, funding, an organisational change) — that question is still open and it matters.',
    }])
  }

  // Duplicate instrument forks are dropped inside persistForks — see the note there.
  const { written, trimmed } = await persistForks(buildId, ideaId, [...instrumentForks, ...(a.forks ?? [])])
  await mergeUncertainties(buildId, a.uncertainties ?? [])
  const approach = [a.chosenApproach, a.leverage, a.whatItRulesOut].filter(Boolean).join('\n')

  console.log('[lex-diag] 25b approach done', {
    buildId, options: options.length, instrument, forks: written, trimmed,
  })
  return {
    ok: true,
    output: `${options.length} approaches; instrument: ${instrument}`,
    carry: { approach, instrument },
  }
}

async function actionsPass(c: PassContext): Promise<PassOutcome> {
  const { ideaId, buildId, framed } = c
  await c.activity('Drafting the coordinated actions')
  const result = await runActionsPass({
    promptBlock: framed.promptBlock,
    diagnosis: c.carry.diagnosis ?? '',
    approach: c.carry.approach ?? '',
    instrument: c.carry.instrument ?? '',
  })
  c.usages.push(result.usage)
  if (llmFailed(result)) {
    console.error('[lex-diag] 25b actions pass failed', { reason: result.reason, detail: result.detail })
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
  await mergeUncertainties(buildId, v.uncertainties ?? [])

  console.log('[lex-diag] 25b actions done', { buildId, actions: actions.length, forks: written, trimmed })
  return { ok: true, output: `${actions.length} actions drafted` }
}

// ═══════════════════════════════════════════════════════════════════════════
// SPRINT 25-B — PASSES 3, 4 AND 5
// ═══════════════════════════════════════════════════════════════════════════

/**
 * §4 — PASS 3. Run the interrogation library against the pass-2 draft.
 *
 * The work is in build-research.ts; what lives here is the pass's contract with the
 * engine: what it carries forward, what its one-line output says, and the fact that a
 * research pass which found nothing is a COMPLETED pass with stated gaps, not a failure.
 */
async function researchPass(c: PassContext): Promise<PassOutcome> {
  await c.activity('Working out which questions this draft raises')

  const facts = await draftFactsFor(c.ideaId, c.carry)
  const costLines = await costLinesFor(c.ideaId)

  const outcome = await runResearch({
    ideaId: c.ideaId,
    buildId: c.buildId,
    buildVersion: c.buildVersion,
    facts,
    costLines,
    onActivity: c.activity,
  })
  c.usages.push(...outcome.usages)

  // ⚠ A RESEARCH PASS THAT FOUND NOTHING HAS NOT FAILED. Every question that fired and
  // came back empty has written a stated gap under its own panel heading, which is a
  // result. The pass only fails if it could not ask anything at all — and even then the
  // gaps are already stored, so the revision reads "we looked and could not reach it"
  // rather than proceeding as though no question had been asked.
  const asked = outcome.outcomes.length
  if (!asked) {
    return { ok: false, reason: 'no library question fired on this draft, so there was nothing to research' }
  }

  const findings = outcome.outcomes.reduce((n, o) => n + o.findings, 0)
  const reviewed = outcome.outcomes.reduce((n, o) => n + o.reviewed, 0)
  const gaps = outcome.outcomes.reduce((n, o) => n + o.gaps.length, 0)
  const contradictions = outcome.outcomes.reduce((n, o) => n + o.contradictions, 0)

  // §4 — a live power leads everything, and the fork is UPDATED so the change is visible
  // where the user makes the decision rather than only in a paragraph.
  if (outcome.instrument?.powerFound) {
    await recordInstrumentRetirement(c, outcome.instrument)
  }

  const summary = [
    outcome.summary,
    outcome.stoppedReason ? `\n⚠ ${outcome.stoppedReason}` : '',
  ].filter(Boolean).join('\n')

  console.log('[lex-diag] 25b research done', {
    buildId: c.buildId, asked, reviewed, findings, gaps, contradictions,
    powerFound: outcome.instrument?.powerFound ?? null, stoppedEarly: outcome.stoppedEarly,
  })

  return {
    ok: true,
    output:
      `${asked} question${asked === 1 ? '' : 's'} asked; reviewed ${reviewed} sources; ` +
      `${findings} finding${findings === 1 ? '' : 's'}` +
      `${contradictions ? `, ${contradictions} contradicting the draft` : ''}; ` +
      `${gaps} stated gap${gaps === 1 ? '' : 's'}` +
      `${outcome.instrument?.powerFound ? ' — ⚠ an existing power may remove the need for a Bill' : ''}` +
      `${outcome.stoppedEarly ? ' (stopped at its own spend ceiling)' : ''}`,
    carry: { research: summary },
  }
}

/**
 * §4/§9 — "a positive finding visibly changes the instrument fork."
 *
 * Two writes, and both are needed for that sentence to be true. The FORK is where the
 * user makes the decision, so a finding that changes the answer has to land there; and
 * an UNCERTAINTY is what they read first, so it has to say the route may have changed.
 * A paragraph in a summary is not "visibly".
 */
async function recordInstrumentRetirement(c: PassContext, assessment: InstrumentAssessment): Promise<void> {
  const reachWord =
    assessment.reach === 'covers' ? 'appears to cover this outright'
      : assessment.reach === 'partial' ? 'reaches part of this and not the rest'
        : assessment.reach === 'unclear' ? 'exists, and what was retrieved does not settle whether it reaches this'
          : 'exists in this area but does not appear usable for this'

  const moved = await prisma.buildFork.updateMany({
    where: { buildId: c.buildId, forkKey: INSTRUMENT_FORK_KEY },
    data: {
      // ⚠ NOT `resolved: true`. The evidence has REOPENED this decision, not settled it —
      // marking it resolved would hide the very fork the finding makes urgent. 25-C turns
      // a fork into a decision, and this is the decision it most needs to offer.
      caseForAlternative:
        `⚠ THE RESEARCH FOUND AN EXISTING POWER. ${assessment.provision} — it ${reachWord}. ` +
        `${assessment.reachNote}`,
      alternative: `Use the existing power: ${assessment.provision}`,
    },
  })

  await mergeUncertainties(c.buildId, [{
    fieldKey: 'summaryGuidingPolicy',
    sentence:
      `I drafted this as ${c.carry.instrument || 'primary legislation'}, and then the research found ` +
      `${assessment.provision}, which ${reachWord}. Before anything else, decide whether you need a new Act at all.`,
  }])

  // ⚠⚠ 25-C §3a — THE COUNT IS READ, BECAUSE THIS LINE USED TO LIE.
  //
  // It logged "instrument fork changed by research" unconditionally after the `updateMany`,
  // without looking at how many rows it had touched. On the 20 Aug run the assessment correctly
  // returned `powerFound: true`, this line duly announced the fork had changed, and the
  // verification found no such fork in the database — because there was no instrument fork to
  // update. **A claim whose result is not checked is not a claim**, and this one was reporting
  // the sprint's headline acceptance criterion as met while it was not.
  if (moved.count > 0) {
    console.warn('[lex-diag] 25b instrument fork MOVED by the research', {
      buildId: c.buildId, rows: moved.count,
      provision: assessment.provision, reach: assessment.reach,
    })
    return
  }

  // ⚠ THE POWER IS REAL AND THERE IS NO FORK TO PUT IT ON. That happens when the approach pass
  // named no instrument, so no `guidingPolicy:instrument` fork was ever written. Losing the
  // finding here would be the worst outcome available: the research established that a Minister
  // may already be able to act, and the user would never be told.
  //
  // So the fork is CREATED. The build had an implicit instrument — an unnamed one is treated as
  // primary legislation everywhere else in this engine — and the research has just produced the
  // alternative to it, with the case for that alternative.
  console.warn('[lex-diag] 25b instrument fork ABSENT — creating one to carry the finding', {
    buildId: c.buildId, provision: assessment.provision,
  })
  await prisma.buildFork.create({
    data: {
      buildId: c.buildId,
      ideaId: c.ideaId,
      forkKey: INSTRUMENT_FORK_KEY,
      fieldKey: 'summaryGuidingPolicy',
      chosen: c.carry.instrument || 'primary legislation (assumed — the draft never named one)',
      recommendationReason:
        'The draft assumed a new Act. It did not say why, which is itself worth questioning.',
      alternativeIndex: 0,
      alternative: `Use the existing power: ${assessment.provision}`,
      caseForAlternative:
        `⚠ THE RESEARCH FOUND AN EXISTING POWER. ${assessment.provision} — it ${reachWord}. `
        + `${assessment.reachNote}`,
    },
  }).catch((err) => {
    // A duplicate means a fork appeared between the update and the create; the finding is already
    // recorded, so this is not an error to fail a pass over.
    if ((err as { code?: string })?.code !== 'P2002') throw err
  })
}

/**
 * §5 — PASS 4. Revise in the light of the research, and KEEP THE CONTRADICTIONS.
 *
 * ⚠ The contradictions are persisted as EvidenceItem rows of kind CONTRADICTS, in the
 * same evidence layer as everything else (§2 — no second layer). A revision record IS a
 * finding about the idea: "I first concluded X; the evidence says Y; here is why I
 * changed my mind" is exactly the shape of a finding, it attaches to a field by
 * `fieldRef` like every other finding, and the user accepts or rejects it the same way.
 * Its `sourceId` is null because its source is the research pass rather than a document,
 * and `citation` is therefore null rather than invented.
 */
async function revisePass(c: PassContext): Promise<PassOutcome> {
  const { ideaId, buildId } = c
  await c.activity('Re-reading the draft against what the research found')

  if (!c.carry.research) {
    // Nothing to revise against. Not a failure of this pass — a consequence of the one
    // before it, and said in those words rather than as a generic error.
    return { ok: false, reason: 'the research pass produced nothing to revise against' }
  }

  const forkRows = await prisma.buildFork.findMany({
    where: { buildId }, orderBy: [{ forkKey: 'asc' }, { alternativeIndex: 'asc' }],
  })
  const forksByKey = new Map<string, { forkKey: string; chosen: string; alternatives: string[] }>()
  for (const f of forkRows) {
    const existing = forksByKey.get(f.forkKey)
    if (existing) existing.alternatives.push(f.alternative)
    else forksByKey.set(f.forkKey, { forkKey: f.forkKey, chosen: f.chosen, alternatives: [f.alternative] })
  }

  const actions = await prisma.lexCoherentAction.findMany({
    where: { ideaId }, select: { practicalStep: true, whoImplements: true },
  })

  const result = await runRevisePass({
    promptBlock: c.framed.promptBlock,
    diagnosis: c.carry.diagnosis ?? '',
    approach: c.carry.approach ?? '',
    actions: actions.map((a) => `- ${a.practicalStep}${a.whoImplements ? ` (${a.whoImplements})` : ''}`).join('\n'),
    instrument: c.carry.instrument ?? '',
    research: c.carry.research,
    forks: [...forksByKey.values()],
  })
  c.usages.push(result.usage)
  if (llmFailed(result)) {
    console.error('[lex-diag] 25b revise pass failed', { reason: result.reason, detail: result.detail })
    return { ok: false, reason: plainFailure(result.reason) }
  }
  const r = result.value

  await c.activity('Writing the revision, and recording where it changed my mind')

  // ── The rewritten causes. §5: rewrite these first and hardest. ─────────────
  const causes = (r.causes ?? []).filter((x) => x?.cause?.trim())
  if (causes.length) {
    // ⚠ REPLACES the pass-2 causes rather than appending. Two sets of causes on one idea
    // is not a revision, it is a duplicate — and the contradiction records below are what
    // preserve what the first set said, which is the honest way to keep it.
    await prisma.diagnosisCause.deleteMany({ where: { ideaId, source: 'LEX_CORPUS' } })
    await createCauses(ideaId, causes.map((x) => ({
      cause: x.cause.trim(),
      whyPersisted: x.whyPersisted?.trim() || null,
      classification: x.classification === 'MATERIAL' ? 'MATERIAL' : 'CONTRIBUTORY',
    })), 'LEX_CORPUS')
    await setProposal(ideaId, 'causes', { value: '' })
  }

  if (r.rootCause?.trim()) await setProposal(ideaId, 'rootCause', { value: r.rootCause.trim() })
  if (r.pivotalObstacle?.trim()) await setProposal(ideaId, 'pivotalObstacle', { value: r.pivotalObstacle.trim() })
  if (r.summaryDiagnosis?.trim()) await setProposal(ideaId, 'summaryDiagnosis', { value: r.summaryDiagnosis.trim() })
  if (r.chosenApproach?.trim()) await setProposal(ideaId, 'chosenApproach', { value: r.chosenApproach.trim() })
  if (r.summaryGuidingPolicy?.trim()) await setProposal(ideaId, 'summaryGuidingPolicy', { value: r.summaryGuidingPolicy.trim() })
  if (r.summaryCoherentActions?.trim()) await setProposal(ideaId, 'summaryCoherentActions', { value: r.summaryCoherentActions.trim() })

  // ── THE CONTRADICTIONS. The output that justifies the iteration. ───────────
  await supersedeOlderProposals(ideaId, 'REVISE', c.buildVersion)
  const contradictions = (r.contradictions ?? []).filter(
    (x) => x?.firstConcluded?.trim() && x?.evidenceSays?.trim(),
  )
  for (const x of contradictions) {
    await prisma.evidenceItem.create({
      data: {
        ideaId,
        passKey: 'REVISE',
        runVersion: c.buildVersion,
        // ⚠ 25-D §3 — NULL, AND ON PURPOSE. A contradiction is not a source card; it is the
        // sentence that leads the review agenda (25-C §3b), and giving it a panel heading
        // would file the build's headline output back among the references, which is exactly
        // where §3b found it buried. Left explicit so the next reader knows it was decided
        // rather than forgotten; `heading-map.ts` records the same reasoning.
        headingKey: null,
        fieldRef: x.fieldKey?.trim() || null,
        kind: 'CONTRADICTS',
        title: `The research changed my mind about ${x.fieldKey?.trim() || 'this'}`,
        body: [
          `I first concluded: ${x.firstConcluded.trim()}`,
          `The evidence says: ${x.evidenceSays.trim()}`,
          `Why I changed my mind: ${x.whyChanged?.trim() || '(not stated)'}`,
        ].join('\n\n'),
        // ⚠ NULL, not a fabricated citation. This finding's source is the research pass,
        // which is named in the body; attaching a document citation to a reasoning step
        // would be exactly the never-claim breach the rest of the build refuses.
        sourceType: null, sourceId: null, citation: null, url: null,
        status: 'PROPOSED',
      },
    })
  }

  // The chain and coherence checks land as issues, on the existing issues list, because
  // that is what the user works through. A chain that holds raises nothing.
  const checks: string[] = []
  if (!r.chainHolds && r.chainNote?.trim()) {
    checks.push(`The chain from causes to actions does not hold as drafted: ${r.chainNote.trim()}`)
  }
  if (r.coherenceNote?.trim() && r.coherenceNote.trim().length >= 40) {
    checks.push(`On the coherence of the actions: ${r.coherenceNote.trim()}`)
  }
  for (const text of checks) {
    await prisma.deepeningIssue.create({
      data: { ideaId, passKey: 'REVISE', runVersion: c.buildVersion, text, status: 'OPEN' },
    })
  }

  // Forks the evidence has SETTLED are marked resolved WITH THE REASON; forks it has
  // OPENED are added. Both are §5's requirement and both are writes, not prose.
  let resolved = 0
  for (const f of r.forksResolved ?? []) {
    if (!f?.forkKey?.trim() || !f?.reason?.trim()) continue
    // ⚠⚠ 25-C §3a — THIS USED TO OVERWRITE `caseForAlternative`, AND IT DESTROYED THE SPRINT'S
    // HEADLINE FINDING.
    //
    // The research pass writes "⚠ THE RESEARCH FOUND AN EXISTING POWER…" onto the instrument
    // fork. Pass 4 then resolved the same fork and replaced that text with its own settlement
    // note — so on the 20 Aug run the fork provably MOVED in pass 3 and the verification, reading
    // the database afterwards, correctly found no trace of it. Two passes, both behaving
    // reasonably, and the more valuable of the two writes lost.
    //
    // It is also the exact thing §3a forbids: "the record keeps both, because a proposal that
    // shows what it considered and set aside is stronger than one that looks inevitable." A
    // resolution is not licence to erase what was resolved.
    //
    // So the settlement is recorded on `recommendationReason` — where reasoning about the choice
    // belongs — and the case for the road not taken is left exactly as it was.
    const existing = await prisma.buildFork.findFirst({
      where: { buildId, forkKey: f.forkKey.trim(), resolved: false },
      select: { recommendationReason: true },
    })
    const settled = `The research settled this: ${f.reason.trim()}`
    const res = await prisma.buildFork.updateMany({
      where: { buildId, forkKey: f.forkKey.trim(), resolved: false },
      data: {
        resolved: true,
        resolvedChoice: 'chosen',
        resolvedAt: new Date(),
        recommendationReason: existing?.recommendationReason
          ? `${existing.recommendationReason}\n\n${settled}`
          : settled,
      },
    })
    resolved += res.count
  }
  const { written } = await persistForks(buildId, ideaId, r.forks ?? [])
  await mergeUncertainties(buildId, r.uncertainties ?? [])

  const revision = [
    r.summaryDiagnosis,
    r.summaryGuidingPolicy,
    r.summaryCoherentActions,
    contradictions.length
      ? `\nWHERE THE RESEARCH CHANGED THE DRAFT:\n${contradictions
          .map((x) => `- ${x.fieldKey}: first "${x.firstConcluded}" → now "${x.evidenceSays}" (${x.whyChanged})`)
          .join('\n')}`
      : '\nThe research did not contradict the first draft anywhere, which is itself worth a sceptical look.',
    r.chainHolds ? '' : `\n⚠ THE CHAIN DOES NOT HOLD: ${r.chainNote}`,
  ].filter(Boolean).join('\n')

  console.log('[lex-diag] 25b revise done', {
    buildId, causes: causes.length, contradictions: contradictions.length,
    chainHolds: r.chainHolds, forksResolved: resolved, forksOpened: written,
  })

  return {
    ok: true,
    output:
      `${causes.length} causes rewritten; ` +
      `${contradictions.length} place${contradictions.length === 1 ? '' : 's'} the evidence changed the draft; ` +
      `${resolved} fork${resolved === 1 ? '' : 's'} settled, ${written} opened` +
      `${r.chainHolds ? '' : ' — ⚠ the chain from causes to actions does not hold'}`,
    carry: { revision, diagnosis: revision },
  }
}

/**
 * §6 — PASS 5. The adversarial read, against the WHOLE revised kernel.
 *
 * ⚠ This is `deepening-adversarial.ts`, unchanged apart from the two parameters §6 asked
 * for (§2 — reuse, do not rebuild). What differs from a Deepening pass is the VANTAGE:
 * the clerk is given the entire revised proposal and every finding the research produced,
 * not one pass's slice, and asked where the whole thing is weakest.
 */
async function adversarialPass(c: PassContext): Promise<PassOutcome> {
  const { ideaId, buildId } = c
  const model = modelForPass('ADVERSARIAL')
  await c.activity('Reading the whole proposal back as a hostile committee clerk')

  const kernel = await kernelText(ideaId)
  const costLines = await costLinesFor(ideaId)

  // Every finding the build produced, as the clerk's reading material. Rejected ones are
  // excluded: a finding the user has thrown out should not be pressed on them again.
  const evidence = await prisma.evidenceItem.findMany({
    where: { ideaId, runVersion: c.buildVersion, status: { not: 'REJECTED' } },
    orderBy: { createdAt: 'asc' },
    select: { kind: true, title: true, body: true },
  })

  const gapRows = await prisma.deepeningPass.findMany({
    where: { ideaId, runVersion: c.buildVersion },
    select: { knownUnknowns: true },
  })
  const knownUnknowns = gapRows
    .flatMap((g) => readKnownUnknowns(g.knownUnknowns))
    .map((g) => g.question)
    .slice(0, 40)

  const issues = await generateAdversarialIssues(
    {
      idea: kernel,
      costLines,
      findings: evidence.map((e) => ({
        kind: e.kind as 'FINDING', title: e.title, body: e.body, sourceId: '',
      })),
      // ⚠ THE WHOLE KERNEL, NOT ONE PASS'S ANGLE. The clerk is told it is reading the
      // finished thing, so "look for what that reading was NOT covering" points at the
      // proposal's blind spots rather than at a neighbouring pass.
      passMethod:
        'This is the COMPLETE proposal after research and revision — the diagnosis, the approach, ' +
        'the instrument and the actions, with every finding attached. You are not covering one angle ' +
        'of it; you are reading all of it, cold, for the first time.',
      knownUnknowns,
    },
    {
      model,
      label: 'build-adversarial',
      stream: 'build',
      onUsage: (u) => c.usages.push(u),
    },
  )

  if (!issues) {
    // ⚠ NOT AN EMPTY ISSUES LIST. "This proposal survived a hostile reading" is a strong
    // claim and we must not make it by accident, so a failed clerk is a failed pass with
    // everything else the build produced intact.
    console.error('[lex-diag] 25b adversarial pass failed', { buildId, model })
    return { ok: false, reason: 'the adversarial reading did not complete, so the proposal has not been read back hostilely' }
  }

  await supersedeOlderProposals(ideaId, 'ADVERSARIAL', c.buildVersion)
  for (const text of issues) {
    await prisma.deepeningIssue.create({
      data: { ideaId, passKey: 'ADVERSARIAL', runVersion: c.buildVersion, text, status: 'OPEN' },
    })
  }

  console.log('[lex-diag] 25b adversarial done', { buildId, issues: issues.length, model })
  return {
    ok: true,
    // §6 — the MODEL is named in the output, because "report the difference in the
    // findings" only means something if the reader knows which model produced them.
    output: `${issues.length} issue${issues.length === 1 ? '' : 's'} raised against the whole proposal, read by ${model}`,
  }
}

/** The revised kernel as prose — what the clerk reads, and what a report quotes. */
async function kernelText(ideaId: string): Promise<string> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: {
      title: true, challenge: true, summaryDiagnosis: true, rootCause: true, pivotalObstacle: true,
      chosenApproach: true, summaryGuidingPolicy: true, summaryCoherentActions: true,
      legalLandscape: true, whoAffectedImpactCost: true,
      diagnosisCauses: { select: { cause: true, classification: true } },
      lexActions: { select: { practicalStep: true, whoImplements: true } },
    },
  })
  if (!idea) return ''
  const asText = (v: unknown): string => {
    if (typeof v === 'string') return v
    if (v && typeof v === 'object') {
      return Object.values(v as Record<string, unknown>).filter((x) => typeof x === 'string').join(' · ')
    }
    return ''
  }
  return [
    idea.title && `TITLE: ${idea.title}`,
    idea.challenge && `THE PROBLEM: ${idea.challenge}`,
    asText(idea.whoAffectedImpactCost) && `WHO IS AFFECTED: ${asText(idea.whoAffectedImpactCost)}`,
    idea.diagnosisCauses.length && `CAUSES:\n${idea.diagnosisCauses.map((x) => `- (${x.classification}) ${x.cause}`).join('\n')}`,
    idea.rootCause && `ROOT CAUSE: ${idea.rootCause}`,
    idea.pivotalObstacle && `PIVOTAL OBSTACLE: ${idea.pivotalObstacle}`,
    idea.summaryDiagnosis && `THE DIAGNOSIS: ${idea.summaryDiagnosis}`,
    asText(idea.legalLandscape) && `THE LEGAL LANDSCAPE AS STATED: ${asText(idea.legalLandscape)}`,
    idea.chosenApproach && `THE APPROACH: ${idea.chosenApproach}`,
    idea.summaryGuidingPolicy && `THE GUIDING POLICY: ${idea.summaryGuidingPolicy}`,
    idea.lexActions.length && `ACTIONS:\n${idea.lexActions.map((a) => `- ${a.practicalStep}${a.whoImplements ? ` — ${a.whoImplements}` : ''}`).join('\n')}`,
    idea.summaryCoherentActions && `THE PLAN: ${idea.summaryCoherentActions}`,
  ].filter(Boolean).join('\n\n')
}

/** Cost lines as entered, for the passes that scrutinise them. Never invented. */
async function costLinesFor(ideaId: string): Promise<string[]> {
  const actions = await prisma.lexCoherentAction.findMany({
    where: { ideaId },
    select: { costLines: { select: { label: true, low: true, high: true, unit: true, basis: true } } },
  })
  return actions.flatMap((a) =>
    a.costLines.map((cl) => `${cl.label}: ${cl.low ?? '?'}–${cl.high ?? '?'} ${cl.unit ?? ''} (basis: ${cl.basis ?? 'NOT STATED'})`))
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

/**
 * §1 — FINISH THE BUILD. Reached from the last pass's own request, and ALSO from a poll,
 * so a build whose final pass completed in a request the platform then killed still
 * reaches DONE instead of waiting for a settle to call it abandoned.
 */
async function finishBuild(ideaId: string, buildId: string): Promise<BuildView> {
  const row = await prisma.ideaBuild.findUnique({ where: { id: buildId } })
  if (!row) throw new Error('Build row missing')
  if (row.status !== 'RUNNING' && row.status !== 'QUEUED') return buildViewOf(buildId)

  const log = readPassLog(row.passes)
  await openAllPages(ideaId)
  const { message, usage } = await composeSummary(ideaId, buildId, log)

  // ⚠ THE SUMMARY CALL IS ATTRIBUTED TO A PASS, AND THIS IS A FIX FROM THE FIRST LIVE RUN.
  //
  // It happens after the last pass, so it belonged to no pass — and the §8 breakdown came
  // out 737 tokens short of the build total (11,750 vs 12,487 on 2026-08-19). A breakdown
  // that does not sum to the total it sits beside is worse than no breakdown: it invites
  // the reader to trust two numbers that disagree, and neither is flagged.
  //
  // It is booked to the LAST COMPLETED PASS rather than to an invented "summary" row,
  // because inventing a pass in the log would put a pass in the progress display that
  // nobody configured.
  const lastDone = [...log].reverse().find((p) => p.status === 'DONE')
  if (lastDone) {
    await writePass(buildId, lastDone.key, { usages: [...(lastDone.usages ?? []), usage] })
  }

  const settledLog = readPassLog((await prisma.ideaBuild.findUnique({
    where: { id: buildId }, select: { passes: true },
  }))?.passes)
  return settleBuild(buildId, 'DONE', null, allUsages(settledLog), message)
}

/** Read the current row and render it, without changing anything. */
async function buildViewOf(buildId: string): Promise<BuildView> {
  const row = await prisma.ideaBuild.findUnique({ where: { id: buildId } })
  if (!row) throw new Error('Build row missing')
  const forks = await prisma.buildFork.findMany({
    where: { buildId }, orderBy: [{ forkKey: 'asc' }, { alternativeIndex: 'asc' }],
  })
  return toView(row, forks)
}

async function composeSummary(
  ideaId: string, buildId: string, log: PassRecord[],
): Promise<{ message: string; usage: LlmUsage }> {
  const done = log.filter((p) => p.status === 'DONE').map((p) => p.label)
  const row = await prisma.ideaBuild.findUnique({
    where: { id: buildId }, select: { uncertainties: true },
  })
  const unc = (row?.uncertainties && typeof row.uncertainties === 'object' && !Array.isArray(row.uncertainties)
    ? (row.uncertainties as Record<string, string>)
    : {})
  const uncertainties: RawUncertainty[] = Object.entries(unc).map(([fieldKey, sentence]) => ({ fieldKey, sentence: String(sentence) }))
  const forkCount = await prisma.buildFork.count({ where: { buildId } })
  const results = await storedResults(ideaId)
  const searchFailed = !!carryInto(log, 'DIAGNOSIS').searchFailed

  const result = await writeBuildSummary({
    passesCompleted: done,
    uncertainties,
    forkCount,
    sourcesUsed: results.length,
    searchFailed,
  })

  // A failed summary is not a failed build — the draft is real either way. But it must
  // not be replaced with prose that implies Lex reviewed its own work when it did not,
  // so the deterministic version states only facts the row already holds.
  const message = llmOk(result)
    ? result.value.message.trim()
    : [
        `I’ve drafted, researched and revised a version from your four answers: ${done.join(', ')}.`,
        searchFailed
          ? 'At least one corpus search did not complete, so the background is partial — that is a gap in what I looked at, not a finding that there is nothing there.'
          : `I read ${results.length} sources from the corpus.`,
        uncertainties.length
          ? `There are ${uncertainties.length} things I said I was unsure about; they are listed against the fields they belong to.`
          : 'I did not record anything I was unsure about, which is itself worth a sceptical look.',
        'I couldn’t write my own summary of the run just then — that part failed, and the rest stands.',
      ].join(' ')

  if (llmFailed(result)) {
    console.warn('[lex-diag] 25b build summary fell back to the deterministic form', {
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
  return { message, usage: result.usage }
}

async function stopBuild(buildId: string, stop: StopReason): Promise<BuildView> {
  const status = stop.kind === 'cancel' ? 'CANCELLED' : 'FAILED'
  // Passes that never ran are NOT_REACHED, not PENDING — see the note in runNextPass.
  const row = await prisma.ideaBuild.findUnique({ where: { id: buildId }, select: { passes: true } })
  const log = readPassLog(row?.passes).map((p) =>
    p.status === 'PENDING' || p.status === 'RUNNING'
      ? { ...p, status: 'NOT_REACHED' as PassStatus, completedAt: new Date().toISOString() }
      : p)
  await prisma.ideaBuild.update({ where: { id: buildId }, data: { passes: stripNullBytes(log) as never } })
  console.warn('[lex-diag] 25b build stopped early', { buildId, kind: stop.kind })
  return settleBuild(buildId, status, stopMessage(stop), allUsages(log))
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
      // ⚠ 25-B does NOT write `uncertainties` here. They accumulate across requests now
      // (mergeUncertainties), so settling them from a parameter would overwrite four
      // passes' worth with whatever the last one happened to hold.
      ...(summaryMessage ? { summaryMessage } : {}),
    },
  })
  const row = await prisma.ideaBuild.findUnique({ where: { id: buildId } })
  if (!row) throw new Error('Build row vanished during settle')
  const forks = await prisma.buildFork.findMany({
    where: { buildId }, orderBy: [{ forkKey: 'asc' }, { alternativeIndex: 'asc' }],
  })
  console.log('[lex-diag] 25b build settled', {
    buildId, status, passesComplete: row.passesComplete, spend: formatSpend(price), forks: forks.length,
  })

  // AMENDMENT_25B §C4 — the email, on EVERY terminal path, because a build that stopped
  // early is exactly what someone who walked away needs to be told.
  await notifyByEmail(row, status)

  return toView(row, forks)
}

/**
 * Send the "it's done" email, if this build asked for one.
 *
 * ⚠ IT MUST NEVER TAKE THE BUILD DOWN. The build is finished and persisted by the time
 * this runs; a Resend outage is not a reason to report a completed build as failed. So it
 * is awaited (the worker exits promptly, and a fire-and-forget send would be killed with
 * the process) but every failure is caught and logged.
 */
async function notifyByEmail(
  row: { id: string; ideaId: string; notifyEmail: boolean; startedAt: Date | null; completedAt: Date | null; failureReason: string | null },
  status: 'DONE' | 'FAILED' | 'CANCELLED',
): Promise<void> {
  if (!row.notifyEmail) return
  try {
    const idea = await prisma.idea.findUnique({
      where: { id: row.ideaId },
      select: { title: true, creator: { select: { email: true, name: true } } },
    })
    if (!idea?.creator?.email) return

    const seconds = row.startedAt && row.completedAt
      ? (row.completedAt.getTime() - row.startedAt.getTime()) / 1000
      : null

    await sendBuildCompleteEmail({
      toEmail: idea.creator.email,
      toName: idea.creator.name,
      ideaId: row.ideaId,
      ideaTitle: idea.title,
      status,
      // ⚠ The REAL duration, not the estimate. §C4 wants the estimate to be visibly
      // honest, and an email quoting the prediction back would be the opposite.
      durationText: seconds == null ? 'a few minutes' : formatDuration(seconds),
      failureReason: row.failureReason,
    })
    console.log('[lex-diag] 25b build-complete email sent', { buildId: row.id, status })
  } catch (err) {
    console.error('[lex-diag] 25b build-complete email FAILED — the build itself is unaffected', {
      buildId: row.id, error: err instanceof Error ? err.message : err,
    })
  }
}
