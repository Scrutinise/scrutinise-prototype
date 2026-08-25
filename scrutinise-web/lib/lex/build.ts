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
import { setProposal, setLoopProposal, createCauses, createPolicyOptions, createActions } from './field-machine'
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
  REUSABLE_PASSES, ORIENT_SOURCE_CAP,
  type BuildDriver, type BuildMode,
  type BuildPassKey, type Framing,
} from './build-config'
import {
  runOrientPass, runDiagnosisPass, runApproachPass, runActionsPass, writeBuildSummary,
  runRevisePass,
  type RawFork, type RawUncertainty, type OrientOutput, type InstrumentAssessment,
} from './build-client'
import {
  freshPassLog, reusedPassLog, readPassLog, carryInto, allUsages, nextPassKey, isResumable,
  passesComplete, steppedOverFailures,
  type PassRecord, type PassStatus, type PassCarry,
} from './build-carry'
import { runResearch, draftFactsFor } from './build-research'
import { buildEstimate, formatDuration, type BuildEstimate } from './build-estimate'
import { sendBuildCompleteEmail } from '@/lib/email'
import { generateAdversarialIssues } from './deepening-adversarial'
import { readKnownUnknowns } from './deepening'
import { supersedeOlderProposals } from './evidence-layer'
import { QUESTION_IDS } from './interrogation-library'
import { buildHighlights, type BuildHighlights } from './build-highlights'
import {
  writeQueries, extractedQuery, noteQueryDefects, queryProvenanceLine, type IssuedQuery,
} from './build-query'
import { testimonyForFacts, testimonyForPrompt } from './testimony'
import {
  smartPanelModels, smartCritiqueModel, pageOnePayload, PAGE_ONE_CAP,
  askPanelModel, testVocabulary, citeVocabulary, recordUnverifiedVocabulary,
  coverageCheck, critiqueKernel, recordPrognosis, SMART_PASS_KEY,
  type PanelAnswer,
} from './build-smart'
import {
  runKernelCompliance, runLogicCheck, recordVerificationIssues,
  complianceIssueText, logicIssueText, verifyModel, KERNEL_TESTS,
} from './build-verify'

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
  /**
   * 25-F §1 — WHAT THE BUILD ACTUALLY PRODUCED, ranked for the screen.
   *
   * ⚠ NULL WHILE THE BUILD IS STILL RUNNING, and that is not laziness: reading and ranking
   * the evidence layer on every three-second poll would run a join per poll for material
   * that changes once. It is computed when the build reaches a terminal status, which is
   * the moment there is something worth reading.
   */
  highlights: BuildHighlights | null
  /**
   * 25-F §2e — "report which model ran each pass." Derived from the usages the pass
   * recorded, so it says what ANSWERED rather than what was configured.
   */
  modelsByPass: Array<{ key: string; models: string[] }>
  /** 25-F §4 — the queries this build issued, and how each was built. */
  queries: IssuedQuery[]
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
  /**
   * 25-F §7 — THE NAME OF THE IDEA THIS BUILD BELONGS TO, so the finished-build screen can
   * link to it BY NAME rather than offering "Open the draft" and dropping the user on a
   * page headed "Untitled idea". Null while it is still the placeholder.
   */
  ideaTitle: string | null
  /**
   * 25-G §1a/§1b — THE TWO WAYS TO RUN IT AGAIN, AND WHAT EACH ONE COSTS.
   *
   * ⚠ NULL WHEN THERE IS NOTHING TO REUSE, which is a different statement from "reuse is
   * off" and the client must be able to tell them apart: a first build, a build whose
   * research never completed, and a build whose elicitation has since changed all produce
   * null — and the third of those is the one worth saying out loud, because the user has
   * just told us something new and the cheap option would answer the old question.
   */
  reuse: {
    /** The findings and sources a re-run would read instead of searching again. */
    findings: number
    cited: number
    sources: number
    /** The version being reused, so the screen can say which build it came from. */
    fromVersion: number
  } | null
  /**
   * ⚠ WHY reuse is unavailable, in words, when it is. Null when it IS available.
   * "No reason given" is how a user concludes the cheap option is broken rather than
   * inapplicable.
   */
  reuseBlockedReason: string | null
}

function toView(
  row: NonNullable<Awaited<ReturnType<typeof prisma.ideaBuild.findFirst>>>,
  forks: Array<{ id: string; forkKey: string; fieldKey: string; chosen: string; alternative: string; caseForAlternative: string; alternativeIndex: number; resolved: boolean }>,
  highlights: BuildHighlights | null = null,
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
    highlights,
    // 25-F §2e — what actually answered, per pass. `echoedModel` where the vendor told us
    // (a 200 is not proof you got the model you asked for — 25-D §1c), else what we asked.
    modelsByPass: passes.map((p) => ({
      key: p.key,
      models: [...new Set((p.usages ?? []).map((u) => u.echoedModel || u.model).filter(Boolean))],
    })).filter((m) => m.models.length),
    queries: passes.flatMap((p) => p.queries ?? []),
  }
}

export async function buildState(ideaId: string): Promise<BuildState> {
  // Settle on the READ, and by WRITING the status — invariant 2. A build that died
  // without reporting back must not be able to sit at RUNNING for ever.
  await settleAbandonedBuilds(ideaId)

  const estimate = await buildEstimate()
  const owner = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { title: true, creator: { select: { emailOnBuildComplete: true } } },
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

  // 25-F §1 — the ranked evidence, only once there is something finished to rank.
  const finished = latestRow && latestRow.status !== 'QUEUED' && latestRow.status !== 'RUNNING'
  const highlights = finished ? await buildHighlights(ideaId, latestRow.version) : null

  // ── 25-G §1a — can a re-run reuse the research, and if not, why not? ──────
  //
  // ⚠ COMPUTED ONLY WHEN A BUILD COULD ACTUALLY BE STARTED. `reuseSourceFor` reads the
  // elicitation and the pass log; doing that on every three-second poll of a RUNNING build
  // would be two queries a poll for an answer nobody can act on.
  let reuse: BuildState['reuse'] = null
  let reuseBlockedReason: string | null = null
  if (confirmed && !active && rows.length) {
    const source = await reuseSourceFor(ideaId)
    if (source) {
      const counts = await reuseSummary(ideaId, source.version)
      reuse = { ...counts, fromVersion: source.version }
      // Reusing nothing is not reuse. Say so rather than offering a saving that saves the
      // user a search they needed.
      if (!counts.findings) {
        reuse = null
        reuseBlockedReason = 'Your last build did not keep any findings, so there is nothing to re-run from — this will search again.'
      }
    } else {
      const elicitation = await prisma.ideaElicitation.findUnique({
        where: { ideaId }, select: { updatedAt: true },
      })
      const lastDone = rows.find((r) => r.status === 'DONE')
      reuseBlockedReason = !lastDone
        ? 'No build has finished yet, so there is no research to re-run from.'
        : elicitation && lastDone.startedAt && elicitation.updatedAt > lastDone.startedAt
          // ⚠ THE ONE WORTH SAYING OUT LOUD. They have told us something new; the cheap
          // option would answer the question they stopped asking.
          ? 'You’ve changed what you told me since the last build, so I’ll search again rather than reuse a search that never saw it.'
          : 'The last build didn’t get far enough through the research to reuse it.'
    }
  }

  return {
    ideaId,
    canStart: confirmed && !active,
    blockedReason: !confirmed
      ? 'Confirm what I’ve understood first — I won’t build on a reading you haven’t seen.'
      : active
        ? 'A build is already running for this idea.'
        : null,
    latest: latestRow ? toView(latestRow, forks, highlights) : null,
    history: rows.map((r) => ({
      id: r.id, version: r.version, status: r.status,
      framing: r.framing as Framing, completedAt: r.completedAt?.toISOString() ?? null,
    })),
    ceiling: { budgetMs: ceiling.ms, binding: ceiling.binding, costPence: COST_CEILING_PENCE },
    estimate,
    emailDefault: owner?.creator.emailOnBuildComplete ?? false,
    driver: buildDriver(),
    // Null for the placeholder, so the client can tell "not named yet" from "named".
    ideaTitle: owner?.title?.trim() && owner.title.trim() !== 'Untitled idea' ? owner.title.trim() : null,
    reuse,
    reuseBlockedReason,
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
  /**
   * 25-G §1a — `REUSE` reads the previous build's orientation and research instead of
   * running them. Ignored when there is nothing to reuse; see `reuseSourceFor`.
   */
  mode: BuildMode = 'FULL',
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

  // ── 25-G §1a — REUSE THE RESEARCH, WHEN THERE IS RESEARCH TO REUSE ────────
  //
  // ⚠ THE MODE IS A REQUEST, NOT A GUARANTEE, AND IT IS DOWNGRADED RATHER THAN REFUSED.
  // A `REUSE` asked for on an idea whose only previous build FAILED in pass 1 has nothing
  // to reuse; refusing it would leave the user with a button that does nothing, and
  // obeying it would produce a build with no orientation. `reuseSourceFor` returns null
  // and the build runs FULL — which is what they wanted anyway — and `reuseNote` says so
  // on screen rather than silently charging them 33p for the cheap option.
  const reuseFrom = mode === 'REUSE' ? await reuseSourceFor(ideaId) : null
  const passes = reuseFrom
    ? reusedPassLog(readPassLog(reuseFrom.passes), REUSABLE_PASSES, (key, output) =>
        key === 'ORIENT'
          ? `Reused from your last build — ${output ?? 'the corpus search it ran'}`
          : `Reused from your last build — ${output ?? 'the research it ran'}`)
    : freshPassLog()

  let created
  try {
    created = await prisma.ideaBuild.create({
      data: {
        ideaId, version, framing, status: 'QUEUED',
        notifyEmail: wantsEmail,
        passes: passes as never,
      },
    })
  } catch (err) {
    // P2002 on either unique index means someone else won the race. That is the guard
    // doing its job, not an error to surface as a 500.
    const code = (err as { code?: string })?.code
    if (code === 'P2002') throw new BuildAlreadyRunning()
    throw err
  }

  // 25-G §1a — the reused findings move to this run's version, or nothing downstream
  // will be able to see them. See `carryEvidenceForward` for why this is not optional.
  if (reuseFrom) await carryEvidenceForward(ideaId, reuseFrom.version, version)

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

// ═══════════════════════════════════════════════════════════════════════════
// 25-G §1a — THE RE-RUN THAT REUSES THE RESEARCH
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The build a `REUSE` run would read its orientation and research from, or null.
 *
 * Three conditions, and each one has a failure it prevents:
 *
 *  1. **A previous build that got past both passes.** Reusing from a build whose research
 *     never completed reuses nothing and calls it a saving.
 *  2. **THE ELICITATION HAS NOT CHANGED SINCE.** ⚠ This is the condition the brief names —
 *     *"unless the elicitation changed, they should not run again"*, and its contrapositive
 *     is the one that matters: if the user has told us something new, reusing a search that
 *     never saw it is worse than not offering the cheap option at all. They would pay less
 *     for an answer to the question they stopped asking.
 *  3. **There is evidence still attached.** A previous run whose findings the user rejected
 *     wholesale has nothing to hand forward.
 */
export async function reuseSourceFor(ideaId: string): Promise<{ id: string; version: number; passes: unknown } | null> {
  const previous = await prisma.ideaBuild.findFirst({
    where: { ideaId, status: 'DONE' },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, passes: true, startedAt: true },
  })
  if (!previous) return null

  const log = readPassLog(previous.passes)
  const usable = REUSABLE_PASSES.every((k) => {
    const p = log.find((q) => q.key === k)
    return p?.status === 'DONE' || p?.status === 'SKIPPED'
  })
  if (!usable) return null

  // ⚠ The elicitation test. `updatedAt` moves on every answer, correction and confirm.
  const elicitation = await prisma.ideaElicitation.findUnique({
    where: { ideaId }, select: { updatedAt: true },
  })
  if (elicitation && previous.startedAt && elicitation.updatedAt > previous.startedAt) {
    console.log('[lex-diag] 25g reuse declined — the elicitation changed since the last build', {
      ideaId, elicitationUpdatedAt: elicitation.updatedAt, buildStartedAt: previous.startedAt,
    })
    return null
  }

  return { id: previous.id, version: previous.version, passes: previous.passes }
}

/** What a REUSE run is actually reusing, counted — for the sentence the user reads. */
export async function reuseSummary(ideaId: string, fromVersion: number): Promise<{
  findings: number; cited: number; sources: number
}> {
  const [findings, cited, idea] = await Promise.all([
    prisma.evidenceItem.count({ where: { ideaId, runVersion: fromVersion, status: { not: 'REJECTED' } } }),
    prisma.evidenceItem.count({
      where: { ideaId, runVersion: fromVersion, status: { not: 'REJECTED' }, citation: { not: null } },
    }),
    prisma.idea.findUnique({ where: { id: ideaId }, select: { legislationRefs: true } }),
  ])
  const raw = idea?.legislationRefs
  return { findings, cited, sources: Array.isArray(raw) ? raw.length : 0 }
}

/**
 * ⚠⚠ CARRY THE REUSED EVIDENCE FORWARD TO THE NEW RUN VERSION, AND THIS IS THE STEP THAT
 * MAKES "REUSE" MEAN REUSE RATHER THAN "SKIP".
 *
 * Everything downstream is scoped by `runVersion`: `buildHighlights` reads the new
 * version, the adversarial pass reads the new version, `supersedeOlderProposals` REJECTS
 * anything PROPOSED at an older one. So a re-run that merely skipped the research passes
 * would produce a build with no findings on its screen — and worse, the revision and the
 * clerk would run against an empty evidence set while `carry.research` told them there
 * were seventy-five findings. The two would disagree and only one of them would be on the
 * page.
 *
 * ⚠ ONLY `PROPOSED` ROWS MOVE. An ACCEPTED finding is the user's judgement and an item they
 * REJECTED is also their judgement; dragging either into a new run would overwrite a
 * decision they made. Those stay where they are, at the version that produced them.
 *
 * ⚠ AND ONLY THE REUSED PASSES' ROWS. The previous run's REVISE contradictions and SMART
 * critique are about a DRAFT that this run is rewriting — carrying them forward would put
 * last week's "the critique rewrote summaryDiagnosis" beside this week's diagnosis.
 */
async function carryEvidenceForward(
  ideaId: string, fromVersion: number, toVersion: number,
): Promise<{ evidence: number; gaps: number }> {
  const researchPassKeys = QUESTION_IDS
  const evidence = await prisma.evidenceItem.updateMany({
    where: { ideaId, runVersion: fromVersion, status: 'PROPOSED', passKey: { in: researchPassKeys } },
    data: { runVersion: toVersion },
  })
  // The stated gaps travel too. §22's rule is that "we looked for this and could not reach
  // it" is a result; a re-run that dropped them would report a cleaner search than it had.
  const gaps = await prisma.deepeningPass.updateMany({
    where: { ideaId, runVersion: fromVersion, passKey: { in: researchPassKeys } },
    data: { runVersion: toVersion },
  })
  console.log('[lex-diag] 25g carried the reused evidence forward', {
    ideaId, fromVersion, toVersion, evidence: evidence.count, gaps: gaps.count,
  })
  return { evidence: evidence.count, gaps: gaps.count }
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

/**
 * A decision's identity for de-duplication: the field it bears on plus the road taken.
 *
 * ⚠ 25-F §6c — WHY THIS IS THE KEY AND NOT `forkKey`. On the first real build the SAME
 * decision reached the user as two forks — `approach:chosen` and
 * `policyOptions:chosenApproach` — with the identical `chosen` text, verbatim, and
 * different alternatives. Two different keys, so nothing de-duplicated them; one decision,
 * so the user reads it as confusion rather than choice. The model names its own keys and
 * will keep inventing near-synonyms, so the key cannot be what identifies a decision.
 * WHAT IT BEARS ON AND WHAT WAS CHOSEN can.
 */
function decisionIdentity(fieldKey: string, chosen: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return `${norm(fieldKey)}::${norm(chosen).slice(0, 220)}`
}

/** Persist a pass's forks. Two alternatives per fork; extras are dropped and counted. */
async function persistForks(
  buildId: string, ideaId: string, forks: RawFork[],
): Promise<{ written: number; trimmed: number; droppedSameDecision: number }> {
  let written = 0
  let trimmed = 0
  let droppedDupes = 0
  let droppedSameDecision = 0

  // ⚠ 25-F §6c — THE DECISIONS THIS BUILD HAS ALREADY RECORDED, read once.
  //
  // Read from the DATABASE and not from the incoming list, because the duplicate is
  // usually across PASSES, not within one: the approach pass emitted both halves of the
  // chosen-approach pair, but the revision pass can equally re-open a decision the
  // approach pass already recorded.
  const already = await prisma.buildFork.findMany({
    where: { buildId }, select: { fieldKey: true, chosen: true },
  })
  const seenDecisions = new Set(already.map((f) => decisionIdentity(f.fieldKey, f.chosen)))

  for (const f of forks) {
    if (!f?.forkKey?.trim() || !f?.chosen?.trim() || !Array.isArray(f.alternatives)) continue

    // ⚠ ONE DECISION, ONE FORK. The FIRST one recorded wins — it is the one whose
    // alternatives the earlier pass reasoned about — and the drop is COUNTED, because a
    // silent de-duplication is indistinguishable from a model that stopped doing it.
    // (That sentence is the instrument rule's, below, and it earned itself.)
    const identity = decisionIdentity((f.fieldKey ?? '').trim() || 'unassigned', f.chosen.trim())
    if (seenDecisions.has(identity)) {
      droppedSameDecision++
      continue
    }
    seenDecisions.add(identity)

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
  if (droppedSameDecision) {
    console.log('[lex-diag] 25f dropped fork(s) restating a decision already recorded', {
      buildId, dropped: droppedSameDecision,
    })
  }
  return { written, trimmed, droppedSameDecision }
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

    // ⚠⚠ 25-F — A FAILURE THE BUILD IS ALLOWED TO SURVIVE.
    //
    // `continueOnFailure` marks the three passes 25-F added and nothing else. On the first
    // live run of this sprint one panel model returned `coherentActions` as a string where
    // the schema asked for an array, the smart pass threw on `.join`, and FOUR of ten
    // passes died with it — the smart pass, both verification passes AND the hostile
    // clerk. The kernel was already drafted, researched and revised. Losing the
    // adversarial read because a critique misbehaved is the wrong trade.
    //
    // The pass stays FAILED with its reason, the later passes stay PENDING and run, and
    // the summary names what was lost. This is not a step-over; it is a recorded failure
    // the build carries.
    if (passDef(key)?.continueOnFailure) {
      console.warn('[lex-diag] 25f a continue-on-failure pass failed — the build carries on and says so', {
        buildId, key, reason: outcome.reason,
      })
      const after = readPassLog((await prisma.ideaBuild.findUnique({
        where: { id: buildId }, select: { passes: true },
      }))?.passes)
      if (!nextPassKey(after)) return finishBuild(ideaId, buildId)
      return buildViewOf(buildId)
    }

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
    case 'SMART': return smartPass(c)
    case 'KERNEL_CHECK': return kernelCheckPass(c)
    case 'LOGIC_CHECK': return logicCheckPass(c)
    case 'ADVERSARIAL': return adversarialPass(c)
  }
}

// §3 — one corpus search through the gateway, plus one domain-transfer question.
async function orientPass(c: PassContext): Promise<PassOutcome> {
  const { ideaId, buildId, framed } = c

  // ══ 25-F §4 — THE OPENING QUERY IS WRITTEN, NOT COUNTED ═══════════════════════
  //
  // `framed.keywords` is `termsFrom(ctx.problem)` — the eighteen most frequent content
  // words in the user's prose, against a 45-word stopword list that does not contain
  // `those`. That is the query on the row of the first real build, and pass 1 reported
  // "231 sources read; 0 cited".
  //
  // ⚠ THE FRAMING EXPERIMENT IS NOT DISTURBED. `frameQuery` still decides what CONTEXT
  // each arm carries and what the orient pass reasons over; what changes is how the
  // KEYWORDS are composed, and it changes identically for both arms — so A and B remain
  // comparable to each other, and neither is comparable to a pre-25-F run. That is
  // recorded on the row: `queryUsed` now says which builder produced the terms.
  await c.activity('Writing the opening search query')
  const openingJob = {
    id: 'ORIENT',
    question: 'What does the record hold that bears on this problem, and what law governs it today?',
    lookingFor:
      'The statutes, committee reports, evaluations and judgments a specialist in this field would '
      + 'reach for first — named by the terms the field actually uses.',
  }
  const writtenOpening = await writeQueries({
    jobs: [openingJob],
    context: [testimonyForFacts(c.ctx), framed.promptBlock].filter(Boolean).join('\n\n'),
    onUsage: (u) => c.usages.push(u),
  })
  const openingQuery: IssuedQuery =
    writtenOpening.get('ORIENT') ?? extractedQuery('ORIENT', c.ctx.problem || c.ctx.goalDetail || '')
  noteQueryDefects(openingQuery, buildId)
  await writePass(buildId, 'ORIENT', { queries: [openingQuery] })

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
        keywords: openingQuery.terms,
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
    query: openingQuery.terms,
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

  // ══ 25-G §1c — WHAT THE ORIENT MODEL READS, CAPPED AND COUNTED ═════════════
  //
  // ⚠⚠ THIS PASS WAS 36% OF EVERY BUILD'S INPUT TOKENS AND NOBODY HAD LOOKED. Measured on
  // build `42d68bea`: **77,970 input tokens across 2 calls** — ~39,000 each — out of
  // 217,687 for the whole build. The cause is one line: `merged` is every result from both
  // gateway calls (the gateway returns ~15× what it is asked for, so 16 becomes ~240 twice
  // over) and ALL of it went into the prompt.
  //
  // ⚠ AND THE PASS ONLY EVER STORED 20. So the model was reading four hundred documents to
  // reason over, citing ids from anywhere in that set, and the user could see twenty — with
  // a citation to source #300 counted as "cited" against a source that was never kept.
  // Three different numbers for one set.
  //
  // ⚠ THIS IS NOT §1c's FORBIDDEN TRUNCATION. The brief's warning is against showing a pass
  // a SUMMARY in place of findings — which is the 25-F defect, and nothing here summarises
  // anything. Every source the model reads is a whole source. What changes is how many, and
  // a prefix is a fair sample rather than a biased one for the same reason 25-C's research
  // cap is: `interleaveStreams` round-robins, so the head of the list is stream-balanced.
  // (A prefix of a SCORE-ordered list would have been a silent bias — that distinction is
  // the whole reason this is safe.)
  //
  // ⚠ AND THE RETRIEVED COUNT IS STILL REPORTED. "434 retrieved, 40 read" is the honest
  // sentence; "40 sources read" alone would quietly shrink what the corpus returned.
  const readCap = ORIENT_SOURCE_CAP
  const forReading = merged.slice(0, readCap)
  const readable = new Set(forReading.map((r) => r.id))
  if (merged.length > forReading.length) {
    console.log('[lex-diag] 25g orient capped what the model reads', {
      buildId, retrieved: merged.length, read: forReading.length, stored: Math.min(merged.length, 20),
    })
  }

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
      results: forReading,
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
  // ⚠ AGAINST WHAT THE MODEL WAS HANDED, not against everything retrieved. `seen` is all
  // ~434 ids; the model only ever saw `forReading`, so checking against `seen` would accept
  // a citation to a document that was never in front of it — a fabricated id that happened
  // to be real. Stricter, and it is the set the user can see.
  const citedAll = new Set<string>()
  for (const r of readings) for (const id of r.value.citedSourceIds ?? []) if (readable.has(id)) citedAll.add(id)
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

  // 25-F §4 — the A/B artefact records the terms ACTUALLY ISSUED and how they were built,
  // so a run whose query writer failed is distinguishable from one whose writer worked.
  await prisma.ideaBuild.update({
    where: { id: buildId },
    data: {
      queryUsed:
        `${c.framed.queryUsed.split(' :: ')[0]} :: ${openingQuery.terms.join(' | ')} `
        + `:: ${openingQuery.provenance} :: context(${framed.ideaContext.length} chars)`,
    },
  })

  console.log('[lex-diag] 25b orient done', {
    buildId, results: merged.length, searchFailed, cited: citedAll.size, readings: readings.length,
    query: openingQuery.provenance,
  })
  return {
    ok: true,
    output: (searchFailed
      ? `${merged.length} sources — ⚠ at least one corpus search did not complete`
      : `${merged.length} retrieved, ${forReading.length} read; ${citedAll.size} cited` +
        (readings.length > 1 ? ` across ${readings.length} readings` : ''))
      + ` · ${queryProvenanceLine([openingQuery])}`,
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
    // 25-F §6a — the proposal RENDERS the child rows rather than claiming an empty one.
    // The loop field is still marked AWAITING so it reads as "Lex has put candidates here
    // for you to curate", which is what has happened — but the proposal now says what.
    await setLoopProposal(ideaId, 'causes', causes.map((x) => `(${x.classification === 'MATERIAL' ? 'material' : 'contributory'}) ${x.cause.trim()}`))
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
    await setLoopProposal(ideaId, 'policyOptions', options.map((o) => o.approach.trim()))
  }
  if (a.chosenApproach?.trim()) await setProposal(ideaId, 'chosenApproach', { value: a.chosenApproach.trim() })
  if (a.leverage?.trim()) await setProposal(ideaId, 'leverage', { value: a.leverage.trim() })
  if (a.whatItRulesOut?.trim()) await setProposal(ideaId, 'whatItRulesOut', { value: a.whatItRulesOut.trim() })
  if (a.summaryGuidingPolicy?.trim()) await setProposal(ideaId, 'summaryGuidingPolicy', { value: a.summaryGuidingPolicy.trim() })

  // ── 25-F §6b — the two Rumelt tests the build has never drafted ────────────
  //
  // ⚠ EACH IS ONLY PROPOSED WHEN THERE IS SOMETHING IN IT. §19-D Task 2a: a "Proposed by
  // Lex" badge over five empty inputs is a claim nobody made, and that is exactly the
  // 6a defect this sprint is also fixing — so it must not be reintroduced here.
  const responses = a.anticipatedResponses
  if (responses && Object.values(responses).some((v) => String(v ?? '').trim())) {
    await setProposal(ideaId, 'anticipatedResponses', {
      value: {
        avoidance: String(responses.avoidance ?? '').trim(),
        gaming: String(responses.gaming ?? '').trim(),
        enforcementBurden: String(responses.enforcementBurden ?? '').trim(),
        legalChallenge: String(responses.legalChallenge ?? '').trim(),
        politicalAttack: String(responses.politicalAttack ?? '').trim(),
      },
    })
  } else {
    console.warn('[lex-diag] 25f APPROACH returned no anticipated responses', { buildId })
  }
  // ⚠ 25-G §4d — RENDERED AS A LIST, because it IS one.
  //
  // The field stores a string (`summarySchema`), so the list is joined here rather than
  // changing the field's type — and it is joined with bullets, so the five conditions
  // read as five conditions instead of the five-sentence paragraph the second build
  // produced, every sentence of which opened "For this to work".
  //
  // ⚠ THE STEM IS STRIPPED IF IT SURVIVES THE PROMPT. Telling a model not to repeat an
  // opener is a request; removing it afterwards is the guarantee. Only when it is the
  // OPENING of the item — a "for this to work" inside a sentence is the author's own.
  const conditions = (Array.isArray(a.conditionsForSuccess) ? a.conditionsForSuccess : [])
    .map((c) => String(c ?? '').trim())
    .filter(Boolean)
    .map((c) => c.replace(/^for (this|it) to work,?\s*/i, '').trim())
    .map((c) => (c ? c.charAt(0).toUpperCase() + c.slice(1) : c))
    .filter(Boolean)
  if (conditions.length) {
    await setProposal(ideaId, 'conditionsForSuccess', {
      value: conditions.map((c) => `• ${c}`).join('\n'),
    })
  } else {
    console.warn('[lex-diag] 25f APPROACH returned no conditions for success', { buildId })
  }

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
    await setLoopProposal(ideaId, 'actions', actions.map((x) => `${x.practicalStep.trim()}${x.whoImplements?.trim() ? ` — ${x.whoImplements.trim()}` : ''}`))
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
    // 25-F §5 — the sift and the gather have never seen the proposer's own account.
    testimony: testimonyForFacts(c.ctx),
    onActivity: c.activity,
  })
  c.usages.push(...outcome.usages)
  // 25-F §4 — what this pass actually asked, on the record beside what came back.
  await writePass(c.buildId, 'RESEARCH', { queries: outcome.queries })

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
      `${outcome.stoppedEarly ? ' (stopped at its own spend ceiling)' : ''}` +
      ` · ${queryProvenanceLine(outcome.queries)}`,
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

  const alternative = `Use the existing power: ${assessment.provision}`
  const caseFor =
    `⚠ THE RESEARCH FOUND AN EXISTING POWER. ${assessment.provision} — it ${reachWord}. ` +
    `${assessment.reachNote}`

  // ⚠⚠ 25-F §6c — THIS `updateMany` USED TO CARRY NO `alternativeIndex`, AND THAT IS THE
  // DUPLICATE FORK.
  //
  // The instrument fork has one ROW PER ALTERNATIVE (the unique key is
  // buildId+forkKey+alternativeIndex). An unfiltered `updateMany` therefore wrote the
  // SAME alternative and the SAME case onto every row of the group — which is exactly
  // what the first real build shows: `guidingPolicy:instrument` offering
  // "Use the existing power: CRaG 2010 s.3(1)" twice, verbatim, as alternatives 0 and 1.
  //
  // ⚠ THE BRIEF READS THIS AS "the duplicate-fork bug `persistForks` de-duplicated in
  // 25-A, returned". IT IS NOT THE SAME BUG. 25-A's was a model emitting two instrument
  // forks under different keys; this one is our own write clobbering a row it was never
  // meant to touch, and no de-duplication rule in `persistForks` could have caught it
  // because `persistForks` never ran on it.
  //
  // So the finding is now APPENDED as its own alternative rather than overwriting any: the
  // approach pass's two alternatives are the model's reasoning and are not ours to
  // destroy, and the research alternative is the most important of the three. Idempotent —
  // a re-run updates the row already carrying it rather than adding a fourth.
  const existingRows = await prisma.buildFork.findMany({
    where: { buildId: c.buildId, forkKey: INSTRUMENT_FORK_KEY },
    select: { id: true, alternativeIndex: true, alternative: true, chosen: true },
    orderBy: { alternativeIndex: 'asc' },
  })
  const alreadyCarrying = existingRows.find((r) => r.alternative.trim() === alternative.trim())
  let moved = { count: 0 }
  if (alreadyCarrying) {
    // A re-run. Refresh the text in place rather than adding a fourth alternative.
    //
    // ⚠ NOT `resolved: true`. The evidence has REOPENED this decision, not settled it —
    // marking it resolved would hide the very fork the finding makes urgent. 25-C turns
    // a fork into a decision, and this is the decision it most needs to offer.
    moved = await prisma.buildFork.updateMany({
      where: { id: alreadyCarrying.id },
      data: { alternative, caseForAlternative: caseFor, resolved: false },
    })
  } else if (existingRows.length) {
    const nextIndex = Math.max(...existingRows.map((r) => r.alternativeIndex)) + 1
    try {
      await prisma.buildFork.create({
        data: {
          buildId: c.buildId,
          ideaId: c.ideaId,
          forkKey: INSTRUMENT_FORK_KEY,
          fieldKey: 'summaryGuidingPolicy',
          // ⚠ COPIED FROM THE ROWS ALREADY IN THE GROUP, not re-derived from the carry.
          // Every row of a fork carries the same `chosen`, and the panel renders
          // `group[0].chosen`; a row whose `chosen` disagreed with its siblings would make
          // the displayed decision depend on which row sorted first.
          chosen: existingRows[0].chosen,
          alternativeIndex: nextIndex,
          alternative,
          caseForAlternative: caseFor,
        },
      })
    } catch (err) {
      // A duplicate means a concurrent write already put this alternative on the fork.
      // The finding IS recorded either way, which is what `moved` is about to report.
      if ((err as { code?: string })?.code !== 'P2002') throw err
    }
    // ⚠ The fork EXISTS and now carries the finding — by the create above or by whatever
    // raced it. Reporting `moved: 0` here would send the code below on to create a second
    // instrument fork, which is the duplicate this whole block exists to remove.
    moved = { count: 1 }
  }

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
      alternative,
      caseForAlternative: caseFor,
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
    await setLoopProposal(ideaId, 'causes', causes.map((x) => `(${x.classification === 'MATERIAL' ? 'material' : 'contributory'}) ${x.cause.trim()}`))
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

// ═══════════════════════════════════════════════════════════════════════════
// SPRINT 25-F — THE SMART PASS, AND THE TWO THAT VERIFY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * §2 — THE SMART PASS. After revision, before the agenda.
 *
 * The work is in build-smart.ts; what lives here is the pass's contract with the engine —
 * the order of the five steps, what is persisted, and the one rule the whole pass turns
 * on: a term another model produced is a HYPOTHESIS ABOUT WHAT TO LOOK FOR, and it becomes
 * a finding only once a retrieved document carries it.
 *
 * ⚠ IT DEGRADES IN PIECES, NOT ALL AT ONCE. A panel model that does not answer costs one
 * perspective; a coverage check that fails costs the coverage issues; a critique that fails
 * costs the rewrite. Each is reported separately and none of them fails the pass on its
 * own — because the vocabulary half can be the most valuable thing in the build and it
 * runs before any of them.
 */
async function smartPass(c: PassContext): Promise<PassOutcome> {
  const { ideaId, buildId } = c
  const notes: string[] = []

  const { models, skipped } = smartPanelModels()
  if (skipped.length) {
    // ⚠ SAID, NOT SWALLOWED. A panel that silently shrank from three to one would make
    // "the other models found nothing we missed" a claim about our configuration wearing
    // the clothes of a claim about the proposal.
    console.warn('[25f:smart] panel models skipped', { skipped })
    notes.push(`${skipped.length} panel model${skipped.length === 1 ? '' : 's'} unavailable (${skipped.map((s) => `${s.model}: ${s.why}`).join('; ')})`)
  }
  if (!models.length) {
    return { ok: false, reason: 'no outside model is reachable on this deployment, so there is nothing to compare against' }
  }

  const { text: pageOne, truncated } = pageOnePayload(c.ctx)
  if (!pageOne.trim()) {
    return { ok: false, reason: 'the elicitation recorded nothing to send, so there is nothing to ask about' }
  }
  if (truncated) {
    // §2a asks for the whole of page one, verbatim. A cap that bites is a summary chosen
    // by arithmetic, so it is said rather than hidden.
    console.warn('[25f:smart] page one hit the payload cap', { ideaId, cap: PAGE_ONE_CAP })
    notes.push(`your account was longer than the ${PAGE_ONE_CAP}-character limit and was cut at that point`)
  }

  const kernel = await kernelText(ideaId)

  // ── 1 & 2: the whole of page one, out to each model, for a Rumelt-shaped answer ──
  const answers: PanelAnswer[] = []
  for (const model of models) {
    await c.activity(`Putting your own words to ${model}`)
    const a = await askPanelModel({ model, pageOne, onUsage: (u) => c.usages.push(u) })
    if (a) answers.push(a)
    else notes.push(`${model} did not answer`)
  }
  if (!answers.length) {
    return { ok: false, reason: 'no outside model returned a usable answer, so nothing could be compared' }
  }

  // ── 3: every entity they name becomes a corpus query ──────────────────────
  const vocabulary = await testVocabulary({
    answers,
    ideaContext: `${kernel}\n${pageOne}`.slice(0, 4000),
    onActivity: c.activity,
  })
  const citedTerms = await citeVocabulary({
    ideaId, buildVersion: c.buildVersion, vocabulary, kernel,
    onUsage: (u) => c.usages.push(u),
  })
  const statedUnverified = await recordUnverifiedVocabulary({
    ideaId, buildVersion: c.buildVersion, vocabulary,
  })

  // ── 4: the coverage check ─────────────────────────────────────────────────
  await c.activity('Checking whether anything they found is missing from ours')
  const coverage = await coverageCheck({ kernel, answers, onUsage: (u) => c.usages.push(u) })
  let missedIssues = 0
  if (coverage) {
    for (const m of coverage.missed) {
      await prisma.deepeningIssue.create({
        data: {
          ideaId,
          passKey: SMART_PASS_KEY,
          runVersion: c.buildVersion,
          text:
            `ANOTHER MODEL MADE THIS POINT AND OUR PROPOSAL DOES NOT ADDRESS IT — ${m.point.trim()} `
            + `(${m.namedBy}). ${m.whyItMatters.trim()}`,
          status: 'OPEN',
        },
      })
      missedIssues++
    }
  } else {
    notes.push('the coverage check did not complete, so nothing was compared point by point')
  }

  // ── 5: the critique, with the rewrite mandate ─────────────────────────────
  await c.activity('Critiquing the kernel against Rumelt, and rewriting where it fails')
  const forkRows = await prisma.buildFork.findMany({
    where: { buildId }, orderBy: [{ forkKey: 'asc' }, { alternativeIndex: 'asc' }],
  })
  const forksByKey = new Map<string, { forkKey: string; chosen: string; alternatives: string[] }>()
  for (const f of forkRows) {
    const existing = forksByKey.get(f.forkKey)
    if (existing) existing.alternatives.push(f.alternative)
    else forksByKey.set(f.forkKey, { forkKey: f.forkKey, chosen: f.chosen, alternatives: [f.alternative] })
  }

  const critique = await critiqueKernel({
    kernel,
    pageOne,
    findings: c.carry.research ?? '',
    forks: [...forksByKey.values()],
    panelAnswers: answers,
    vocabulary,
    onUsage: (u) => c.usages.push(u),
  })

  let rewritten = 0
  let prognosis = 0
  let complianceIssues = 0
  if (critique) {
    // ── The rewrite. A field is only touched when the critique actually rewrote it. ──
    //
    // ⚠ AN EMPTY STRING MEANS "LEAVE IT". Writing an empty proposal over a good field
    // would be the §6a defect this same sprint is removing, arriving by a different door.
    const rewrites: Array<[string, string]> = [
      ['summaryDiagnosis', critique.rewrite?.summaryDiagnosis ?? ''],
      ['pivotalObstacle', critique.rewrite?.pivotalObstacle ?? ''],
      ['summaryGuidingPolicy', critique.rewrite?.summaryGuidingPolicy ?? ''],
      ['whatItRulesOut', critique.rewrite?.whatItRulesOut ?? ''],
      ['summaryCoherentActions', critique.rewrite?.summaryCoherentActions ?? ''],
    ]
    for (const [key, value] of rewrites) {
      if (!value.trim()) continue
      await setProposal(ideaId, key, { value: value.trim() })
      rewritten++
    }

    // ── What it changed, in the revision pass's own shape (§2d). ─────────────
    await supersedeOlderProposals(ideaId, SMART_PASS_KEY, c.buildVersion)
    for (const ch of critique.changed ?? []) {
      if (!ch?.fieldKey?.trim() || !ch?.nowSays?.trim()) continue
      await prisma.evidenceItem.create({
        data: {
          ideaId,
          passKey: SMART_PASS_KEY,
          runVersion: c.buildVersion,
          // Null for the same reason a REVISE contradiction is null (heading-map.ts): this
          // is the build's headline output, not a source card, and filing it among the
          // references is where 25-C §3b found it buried.
          headingKey: null,
          fieldRef: ch.fieldKey.trim(),
          kind: 'CONTRADICTS',
          title: `The critique rewrote ${ch.fieldKey.trim()}`,
          body: [
            `It was saying: ${ch.wasSaying?.trim() || '(not stated)'}`,
            `It now says: ${ch.nowSays.trim()}`,
            `Why that changed: ${ch.whyChanged?.trim() || '(not stated)'}`,
          ].join('\n\n'),
          sourceType: null, sourceId: null, citation: null, url: null,
          status: 'PROPOSED',
        },
      })
    }

    // Rumelt failures the critique named become issues, exactly as §3's do.
    for (const f of critique.failures ?? []) {
      if (!f?.test?.trim() || !f?.whatFails?.trim()) continue
      await prisma.deepeningIssue.create({
        data: {
          ideaId, passKey: SMART_PASS_KEY, runVersion: c.buildVersion,
          text: `THE KERNEL FAILS A RUMELT TEST — ${f.test.trim()}. ${f.whatFails.trim()}`
            + (f.theTextThatFails?.trim() ? ` The text: "${f.theTextThatFails.trim()}"` : ''),
          status: 'OPEN',
        },
      })
      complianceIssues++
    }
    for (const d of critique.forkDoubts ?? []) {
      if (!d?.forkKey?.trim() || !d?.doubt?.trim()) continue
      await prisma.deepeningIssue.create({
        data: {
          ideaId, passKey: SMART_PASS_KEY, runVersion: c.buildVersion,
          text: `THE ROAD TAKEN AT "${d.forkKey.trim()}" MAY BE THE WRONG ONE — ${d.doubt.trim()}`,
          status: 'OPEN',
        },
      })
      complianceIssues++
    }

    prognosis = await recordPrognosis({
      ideaId, buildVersion: c.buildVersion, critique, model: smartCritiqueModel(),
    })
  } else {
    notes.push('the critique did not complete, so the kernel was not rewritten')
  }

  const smartCarry = [
    critique ? `VERDICT ON THE KERNEL: ${critique.verdict} — ${critique.verdictReason}` : '',
    critique?.failures?.length
      ? `RUMELT TESTS IT FAILS:\n${critique.failures.map((f) => `- ${f.test}: ${f.whatFails}`).join('\n')}`
      : '',
    critique?.changed?.length
      ? `WHAT THE CRITIQUE REWROTE:\n${critique.changed.map((ch) => `- ${ch.fieldKey}: ${ch.whyChanged}`).join('\n')}`
      : '',
    vocabulary.confirmed.length
      ? `TERMS OF ART THE CORPUS CONFIRMED: ${vocabulary.confirmed.map((e) => e.name).join(', ')}`
      : '',
    vocabulary.unverified.length
      ? `NAMED BUT UNVERIFIED (never assert these): ${vocabulary.unverified.map((e) => e.name).join(', ')}`
      : '',
    coverage?.missed?.length
      ? `POINTS OTHER MODELS MADE THAT WE DO NOT ADDRESS:\n${coverage.missed.map((m) => `- ${m.point}`).join('\n')}`
      : '',
    critique ? `HOW HARD TO PASS: ${critique.howHardToPass}` : '',
    critique?.mostLikelyToGoWrong ? `MOST LIKELY TO GO WRONG: ${critique.mostLikelyToGoWrong}` : '',
  ].filter(Boolean).join('\n\n')

  console.log('[lex-diag] 25f smart done', {
    buildId,
    panel: answers.map((a) => a.model),
    entitiesNamed: vocabulary.confirmed.length + vocabulary.unverified.length,
    confirmed: vocabulary.confirmed.length,
    unverified: vocabulary.unverified.length,
    droppedByCap: vocabulary.droppedByCap,
    citedTerms, statedUnverified, missedIssues, rewritten, prognosis,
    verdict: critique?.verdict ?? null,
    critiqueModel: smartCritiqueModel(),
  })

  return {
    ok: true,
    output: [
      `${answers.length} model${answers.length === 1 ? '' : 's'} answered your own words (${answers.map((a) => a.model).join(', ')})`,
      `${vocabulary.confirmed.length + vocabulary.unverified.length} terms of art named — ${vocabulary.confirmed.length} confirmed by the corpus, ${vocabulary.unverified.length} unverified`,
      citedTerms ? `${citedTerms} cited finding${citedTerms === 1 ? '' : 's'} from them` : '',
      coverage ? `${coverage.coveredCount} of their points already covered, ${missedIssues} not` : '',
      critique ? `verdict ${critique.verdict}; ${rewritten} field${rewritten === 1 ? '' : 's'} rewritten; read by ${smartCritiqueModel()}` : '',
      ...notes.map((n) => `⚠ ${n}`),
    ].filter(Boolean).join('; '),
    carry: { smart: smartCarry },
  }
}

/**
 * §3a — IS THIS A KERNEL AT ALL? Nine tests from the method layer, each with a yes or a no
 * and, where the answer is no, the text that fails it quoted back.
 *
 * ⚠ IT RUNS AFTER THE SMART PASS, ON PURPOSE. §2's rewrite mandate means the kernel this
 * marks is the one the user will actually see. Marking the pre-rewrite version would
 * produce a list of failures the rewrite had already fixed.
 */
async function kernelCheckPass(c: PassContext): Promise<PassOutcome> {
  const model = verifyModel('KERNEL_CHECK')
  await c.activity('Marking the kernel against the method')

  const kernel = await kernelText(c.ideaId)
  if (!kernel.trim()) {
    return { ok: false, reason: 'nothing was drafted, so there is no kernel to check' }
  }

  const result = await runKernelCompliance({ kernel, model, onUsage: (u) => c.usages.push(u) })
  if (!result) {
    // ⚠ NOT AN EMPTY PASS LIST. "This kernel passes every test" is a strong claim and must
    // never be made by accident — the same rule the adversarial pass holds.
    return { ok: false, reason: 'the kernel-compliance check did not complete, so the kernel has not been marked' }
  }

  const failed = result.results.filter((r) => !r.passes)
  const written = await recordVerificationIssues({
    ideaId: c.ideaId,
    buildVersion: c.buildVersion,
    passKey: 'KERNEL_CHECK',
    issues: failed.map((r) => ({
      text: complianceIssueText(KERNEL_TESTS.find((t) => t.id === r.id)!, r),
    })),
  })

  console.log('[lex-diag] 25f kernel check done', {
    buildId: c.buildId, model, tests: result.results.length,
    passed: result.results.length - failed.length, failed: failed.length, issues: written,
  })

  return {
    ok: true,
    output:
      `${result.results.length - failed.length} of ${KERNEL_TESTS.length} kernel tests passed`
      + `${failed.length ? `; ${failed.length} failed and are on your list` : ''}`
      + ` — marked by ${model}`,
    carry: {
      verification: [
        `KERNEL COMPLIANCE (${model}): ${result.verdict}`,
        ...failed.map((r) => `- FAILS "${KERNEL_TESTS.find((t) => t.id === r.id)?.test ?? r.id}": ${r.whatFails}`),
      ].join('\n'),
    },
  }
}

/** §3b — does the chain hold: causes → obstacle → approach → actions? */
async function logicCheckPass(c: PassContext): Promise<PassOutcome> {
  const model = verifyModel('LOGIC_CHECK')
  await c.activity('Tracing the argument link by link')

  const kernel = await kernelText(c.ideaId)
  if (!kernel.trim()) {
    return { ok: false, reason: 'nothing was drafted, so there is no argument to trace' }
  }

  const result = await runLogicCheck({ kernel, model, onUsage: (u) => c.usages.push(u) })
  if (!result) {
    return { ok: false, reason: 'the logical-consistency check did not complete, so the argument has not been traced' }
  }

  const written = await recordVerificationIssues({
    ideaId: c.ideaId,
    buildVersion: c.buildVersion,
    passKey: 'LOGIC_CHECK',
    issues: result.defects.map((d) => ({ text: logicIssueText(d) })),
  })

  console.log('[lex-diag] 25f logic check done', {
    buildId: c.buildId, model, chainHolds: result.chainHolds, defects: result.defects.length, issues: written,
  })

  return {
    ok: true,
    output:
      (result.chainHolds
        ? 'the chain from causes to actions holds'
        : '⚠ the chain from causes to actions does NOT hold')
      + `; ${result.defects.length} defect${result.defects.length === 1 ? '' : 's'} in the argument`
      + ` — traced by ${model}`,
    carry: {
      verification: [
        c.carry.verification ?? '',
        `LOGIC (${model}): the chain ${result.chainHolds ? 'holds' : 'DOES NOT HOLD'}.`,
        result.chainAsRead ? `Read as: ${result.chainAsRead}` : '',
        ...result.defects.map((d) => `- ${d.kind}: ${d.problem}`),
      ].filter(Boolean).join('\n'),
    },
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
      //
      // ⚠ 25-F §5 — AND IT NOW READS THE PROPOSER'S OWN ACCOUNT. `kernelText` is built from
      // the persisted Idea columns; the user's own sentences are in none of them, so the
      // hostile clerk has been reading the abstraction of a case rather than the case. A
      // clerk who can see what actually happened to somebody asks a different question.
      //
      // ⚠ 25-F — IT ALSO READS WHAT THE THREE NEW PASSES FOUND, AND IT IS TOLD NOT TO
      // REPEAT THEM. Without this the clerk re-derives the same objections the critique
      // and the two verification passes have already put on the issues list, and the user
      // works through the same point three times under three headings — which reads as
      // three findings and is one.
      passMethod: [
        'This is the COMPLETE proposal after research and revision — the diagnosis, the approach, ',
        'the instrument and the actions, with every finding attached. You are not covering one angle ',
        'of it; you are reading all of it, cold, for the first time.',
        c.carry.smart
          ? `\n═══ A CRITIQUE HAS ALREADY BEEN MADE OF THIS PROPOSAL ═══\n${c.carry.smart}\n`
            + '⚠ DO NOT RESTATE ANY OF THAT. Those points are already on the user\'s list. Your value is '
            + 'what it did NOT see — go somewhere else, and if you genuinely cannot find anything it '
            + 'missed, say so rather than paraphrasing it.'
          : '',
        c.carry.verification
          ? `\n═══ AND IT HAS BEEN MARKED AGAINST THE METHOD ═══\n${c.carry.verification}\n`
            + '⚠ Same rule: these failures are recorded. Press on what they leave open.'
          : '',
        '',
        testimonyForPrompt(c.ctx, 3000),
      ].filter(Boolean).join('\n'),
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

/** The placeholder both entry points POST when they mint an idea. */
const UNTITLED = 'Untitled idea'

/**
 * 25-F §7 — A COMPLETED BUILD MUST BE FINDABLE.
 *
 * ⚠ THE DIAGNOSIS. Charlie logged out and could not find the idea his five-minute build had
 * produced, and the spend view showed it as "Untitled idea" — as does every other list on
 * the platform, because `Idea.title` is still the placeholder both entry points POST when
 * they mint the row. The DIAGNOSIS pass DOES draft a title; it writes it as a PROPOSAL, and
 * `Idea.title` is only written by `mirrorValue` when a human accepts one. Nobody had.
 *
 * ⚠ AND THIS DOES NOT BREAK INVARIANT 5 ("nothing is accepted on the user's behalf"),
 * which is the reason it is not simply an `acceptField` call. Two different things share
 * the word "title":
 *
 *   · `IdeaFieldState.title` — a KERNEL FIELD. It stays at AWAITING_CONFIRMATION, the
 *     title card still asks, and nothing here agrees to anything for them.
 *   · `Idea.title`           — the row's NAME, which is what every list on the platform
 *     renders. A row called "Untitled idea" is not an unanswered question, it is a filing
 *     failure, and leaving it that way is not respect for the user's judgement — it is
 *     five minutes of work they cannot find again.
 *
 * ⚠ IT ONLY EVER OVERWRITES THE PLACEHOLDER. A title the user has actually chosen, or an
 * accepted proposal already mirrored, is left exactly as it is.
 */
async function nameTheIdea(ideaId: string): Promise<string | null> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
  const current = idea?.title?.trim() ?? ''
  if (current && current !== UNTITLED) return null

  const row = await prisma.ideaFieldState.findUnique({
    where: { ideaId_fieldKey: { ideaId, fieldKey: 'title' } },
    select: { status: true, value: true, proposal: true },
  })
  const proposed = (row?.proposal as { value?: unknown } | null)?.value
  const title =
    (row?.status === 'ACCEPTED' && row.value?.trim())
    || (typeof proposed === 'string' ? proposed.trim() : '')

  if (!title) {
    // ⚠ REPORTED, NOT PAPERED OVER. A build that drafted no title leaves an idea nobody
    // can find, which is the very failure this function exists for — so it is visible in
    // the log rather than being replaced by a manufactured name.
    console.warn('[lex-diag] 25f the build drafted no title — the idea stays "Untitled idea"', { ideaId })
    return null
  }

  await prisma.idea.update({ where: { id: ideaId }, data: { title: title.slice(0, 120) } })
  console.log('[lex-diag] 25f named the built idea', { ideaId, title: title.slice(0, 120) })
  return title.slice(0, 120)
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
  // 25-F §7 — name the row before anything lists it. A five-minute build the user cannot
  // find again is worse than no build.
  await nameTheIdea(ideaId)
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
  const baseMessage = llmOk(result)
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

  // ⚠⚠ 25-F — A PASS THE BUILD SURVIVED MUST BE NAMED IN THE MESSAGE THE USER READS FIRST.
  //
  // `continueOnFailure` lets the build finish DONE with a pass that failed. That is the
  // right trade and it is also, exactly, the shape of a silent degradation — a green badge
  // over work that did not happen. The summary is written by a model that was not told
  // about the failure, so the sentence is APPENDED deterministically here rather than
  // asked for: a warning that depends on a model remembering to include it is not a
  // warning.
  const lost = steppedOverFailures(log)
  const message = lost.length
    ? `${baseMessage}\n\n⚠ ${lost.length === 1 ? 'One part of this build did not run' : `${lost.length} parts of this build did not run`}: `
      + `${lost.map((p) => `${p.label} (${p.failureReason ?? 'no reason recorded'})`).join('; ')}. `
      + 'Everything else is here and is real; that part is simply missing rather than clean.'
    : baseMessage

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
  const row = await prisma.ideaBuild.findUnique({
    where: { id: buildId }, select: { passes: true, ideaId: true },
  })
  const log = readPassLog(row?.passes).map((p) =>
    p.status === 'PENDING' || p.status === 'RUNNING'
      ? { ...p, status: 'NOT_REACHED' as PassStatus, completedAt: new Date().toISOString() }
      : p)
  await prisma.ideaBuild.update({ where: { id: buildId }, data: { passes: stripNullBytes(log) as never } })
  console.warn('[lex-diag] 25b build stopped early', { buildId, kind: stop.kind })

  // ⚠ 25-G §5 — A BUILD THAT STOPPED EARLY STILL NAMES ITS IDEA.
  //
  // `nameTheIdea` ran only in `finishBuild`, so a build that hit a ceiling or was cancelled
  // left its row called "Untitled idea" — and §5's whole point is that Charlie could not
  // find his work afterwards. A stopped build is exactly the case where someone is MOST
  // likely to go looking: it drafted a diagnosis, an approach and a title, and then
  // stopped. The draft is real either way; only the name was missing.
  if (row?.ideaId) await nameTheIdea(row.ideaId)

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

  // 25-F §1 — the ranked evidence travels back with the settle, so the request that
  // FINISHES a build already carries what the user is about to read. Without this the
  // screen would sit on a completed build with nothing on it until the next poll.
  const highlights = await buildHighlights(row.ideaId, row.version)
  return toView(row, forks, highlights)
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
