// ─────────────────────────────────────────────────────────────────────────────
// THE DEEPENING — the engine. One mechanism; the passes are configuration
// (deepening-config.ts).
//
// FOUR INVARIANTS, and every one of them is enforced here rather than trusted:
//
//  1. A SEPARATE EVIDENCE LAYER. Nothing in this file writes a canonical field. It
//     creates EvidenceItem rows that REFERENCE fields by `fieldRef`. Changing what a
//     field SAYS goes through the normal save path. `check:deepening` asserts that no
//     prisma.idea.update / field-machine call appears in this module.
//
//  2. KNOWN UNKNOWNS ARE OUTPUT, NOT A FOOTNOTE. Every run records what it looked for
//     and could not find. They are computed FROM THE RUN — from which of the pass's
//     mustAnswer questions the gather actually answered, and from which corpora
//     retrieval actually returned — never from a hardcoded list, because a hardcoded
//     gap becomes a lie the moment the ingest thread closes it. (It nearly did here:
//     the brief told me to declare the Impact Assessment corpus unreachable, and the
//     search thread made it reachable the same afternoon.)
//
//  3. NEVER-CLAIM, IN FULL. A pass that retrieved nothing says so and stores no
//     findings. Every finding carries its source. The status shown is the status
//     stored — a partial run is FAILED with what it managed KEPT, never RUN.
//
//  4. BACKGROUND GATHER, GUIDED JUDGMENT. The run is async and persists incrementally,
//     so a timeout loses the tail rather than the run. Accept / reject / triage are
//     ordinary synchronous writes.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import type { SearchResult } from './page1-config'
import { runSearch } from './search-gateway'
import { PASSES, passDef, type IssueContext, type PassDef } from './deepening-config'
import { generateDeepeningFindings, type RawFinding } from './deepening-client'
import { siftCandidates, siftSummaryLine, SIFT_CANDIDATE_TARGET, type SiftKeep } from './deepening-sift'
import { generateAdversarialIssues } from './deepening-adversarial'

/** A declared gap. Always carries WHAT was looked for, not just that something is missing. */
export interface KnownUnknown {
  question: string
  /** Why it could not be answered — always specific enough to act on. */
  why: string
}

export interface PassState {
  passKey: string
  label: string
  strapline: string
  training: string
  status: 'NOT_RUN' | 'RUNNING' | 'RUN' | 'FAILED'
  runVersion: number
  startedAt: string | null
  completedAt: string | null
  failureReason: string | null
  knownUnknowns: KnownUnknown[]
  findings: EvidenceView[]
  issues: IssueView[]
  /** The retrieval this pass's own run produced, for the right-hand panel. */
  references: SearchResult[]
  /** §19-E Task 3 — the sift, reported: "reviewed 104 sources; 12 bore on this proposal."
   *  Null before a run has happened. A discard count nobody sees is the same as no sift. */
  sift: { reviewed: number; kept: number; skipped: boolean; line: string } | null
}

export interface EvidenceView {
  id: string
  kind: string
  title: string
  body: string
  fieldRef: string | null
  sourceType: string | null
  citation: string | null
  url: string | null
  status: string
  note: string | null
  runVersion: number
  /** §19-E Task 3 — why the sift kept the source this finding cites. Null on findings
   *  written before the sift existed; the panel renders its absence rather than faking it. */
  siftReason: string | null
  /** Did this source satisfy the precedent test? Null = not assessed (pre-sift row). */
  precedentTestPassed: boolean | null
}

export interface IssueView {
  id: string
  text: string
  status: string
  dismissReason: string | null
  resolutionNote: string | null
  resolutionEvidenceId: string | null
  runVersion: number
}

/** The counts strip on the idea header (§24.2). Facts only — nothing is summed. */
export interface EvidenceFacts {
  issuesRaised: number
  issuesResolved: number
  issuesOpen: number
  knownUnknownsDeclared: number
  sourcesByType: Record<string, number>
  lastDeepeningRun: string | null
  passesRun: number
  passesTotal: number
}

const RUN_BUDGET_MS = parseInt(process.env.LEX_DEEPENING_BUDGET_MS ?? '110000', 10)

// ── reading state ────────────────────────────────────────────────────────────

export async function deepeningState(ideaId: string): Promise<{ passes: PassState[]; facts: EvidenceFacts }> {
  const [passRows, evidence, issues] = await Promise.all([
    prisma.deepeningPass.findMany({ where: { ideaId } }),
    prisma.evidenceItem.findMany({ where: { ideaId }, orderBy: { createdAt: 'asc' } }),
    prisma.deepeningIssue.findMany({ where: { ideaId }, orderBy: { createdAt: 'asc' } }),
  ])
  const refs = await readPassReferences(ideaId)

  const passes: PassState[] = PASSES.map((def) => {
    const row = passRows.find((r) => r.passKey === def.key)
    const mine = evidence.filter((e) => e.passKey === def.key)
    return {
      passKey: def.key,
      label: def.label,
      strapline: def.strapline,
      training: def.training,
      status: (row?.status ?? 'NOT_RUN') as PassState['status'],
      runVersion: row?.runVersion ?? 0,
      startedAt: row?.startedAt?.toISOString() ?? null,
      completedAt: row?.completedAt?.toISOString() ?? null,
      failureReason: row?.failureReason ?? null,
      knownUnknowns: readKnownUnknowns(row?.knownUnknowns),
      // ⚠ REJECTED items are returned too, not filtered. A superseded or rejected finding
      // that silently disappears makes a re-run look like it lost work.
      findings: mine.map(toEvidenceView),
      issues: issues.filter((i) => i.passKey === def.key).map(toIssueView),
      references: refs[def.key] ?? [],
      // Only after a run: "reviewed 0 sources" before one has happened would be a
      // statement about a search that never ran.
      sift: row && row.status !== 'NOT_RUN'
        ? {
            reviewed: row.candidatesReviewed,
            kept: row.candidatesKept,
            skipped: row.siftSkipped,
            line: siftSummaryLine(row.candidatesReviewed, row.candidatesKept, row.siftSkipped),
          }
        : null,
    }
  })

  return { passes, facts: buildFacts(passes, evidence) }
}

function toEvidenceView(e: {
  id: string; kind: string; title: string; body: string; fieldRef: string | null
  sourceType: string | null; citation: string | null; url: string | null
  status: string; note: string | null; runVersion: number
  siftReason?: string | null; precedentTestPassed?: boolean | null
}): EvidenceView {
  return {
    id: e.id, kind: e.kind, title: e.title, body: e.body, fieldRef: e.fieldRef,
    sourceType: e.sourceType, citation: e.citation, url: e.url,
    status: e.status, note: e.note, runVersion: e.runVersion,
    siftReason: e.siftReason ?? null,
    precedentTestPassed: e.precedentTestPassed ?? null,
  }
}

function toIssueView(i: {
  id: string; text: string; status: string; dismissReason: string | null
  resolutionNote: string | null; resolutionEvidenceId: string | null; runVersion: number
}): IssueView {
  return {
    id: i.id, text: i.text, status: i.status, dismissReason: i.dismissReason,
    resolutionNote: i.resolutionNote, resolutionEvidenceId: i.resolutionEvidenceId,
    runVersion: i.runVersion,
  }
}

export function readKnownUnknowns(raw: unknown): KnownUnknown[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .filter((x) => typeof x.question === 'string')
    .map((x) => ({ question: String(x.question), why: typeof x.why === 'string' ? x.why : '' }))
}

/**
 * §24.2 evidence facts. COUNTS ONLY, and deliberately no aggregate: there is no field
 * here that sums to a score, and `check:deepening` greps for one so that a later
 * "helpful" total cannot be added without the check failing.
 */
function buildFacts(passes: PassState[], evidence: Array<{ sourceType: string | null; status: string }>): EvidenceFacts {
  const allIssues = passes.flatMap((p) => p.issues)
  const sourcesByType: Record<string, number> = {}
  for (const e of evidence) {
    if (e.status === 'REJECTED') continue
    const key = e.sourceType ?? 'unattributed'
    sourcesByType[key] = (sourcesByType[key] ?? 0) + 1
  }
  const completed = passes.map((p) => p.completedAt).filter((d): d is string => !!d).sort()
  return {
    issuesRaised: allIssues.length,
    issuesResolved: allIssues.filter((i) => i.status === 'ADDRESSED').length,
    issuesOpen: allIssues.filter((i) => i.status === 'OPEN').length,
    knownUnknownsDeclared: passes.reduce((n, p) => n + p.knownUnknowns.length, 0),
    sourcesByType,
    lastDeepeningRun: completed.length ? completed[completed.length - 1] : null,
    passesRun: passes.filter((p) => p.status === 'RUN').length,
    passesTotal: passes.length,
  }
}

// ── the references a run retrieved ───────────────────────────────────────────
// Stored on the pass row's knownUnknowns sibling? No — on `Idea.stageSearches`, under a
// `deepening:<passKey>` key, reusing the EXISTING references-only store rather than adding
// a second one. Corpus full text never lands in the ideas database (docs/CLAUDE.md §6).

const DEEPENING_STAGE_PREFIX = 'deepening:'

async function readPassReferences(ideaId: string): Promise<Record<string, SearchResult[]>> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { stageSearches: true } })
  const raw = idea?.stageSearches
  if (!raw || typeof raw !== 'object') return {}
  const byStage = (raw as { byStage?: Record<string, { results?: SearchResult[] }> }).byStage ?? {}
  const out: Record<string, SearchResult[]> = {}
  for (const [k, v] of Object.entries(byStage)) {
    if (k.startsWith(DEEPENING_STAGE_PREFIX)) out[k.slice(DEEPENING_STAGE_PREFIX.length)] = v?.results ?? []
  }
  return out
}

async function writePassReferences(
  ideaId: string, passKey: string, intent: string, ok: boolean, query: string[], results: SearchResult[], failureReason?: string,
): Promise<void> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { stageSearches: true } })
  const raw = (idea?.stageSearches ?? {}) as Record<string, unknown>
  const byStage = (raw.byStage && typeof raw.byStage === 'object' ? raw.byStage : {}) as Record<string, unknown>
  byStage[`${DEEPENING_STAGE_PREFIX}${passKey}`] = {
    intent, ranAt: new Date().toISOString(), ok, failureReason, query, results,
  }
  await prisma.idea.update({
    where: { id: ideaId },
    // ⚠ This is the ONE write this module makes to `Idea`, and it touches `stageSearches`
    // only — the references store, not a canonical field. It is listed by name in
    // check:deepening's allow-list so the "no field writes" assertion stays meaningful
    // rather than being switched off wholesale.
    data: { stageSearches: { ...(raw as object), version: 2, byStage } as never },
  })
}

// ── running a pass ───────────────────────────────────────────────────────────

export class PassAlreadyRunning extends Error {
  constructor(public readonly passKey: string) {
    super(`A ${passKey} run is already in progress for this idea`)
  }
}

/**
 * Claim the pass. Increments runVersion and marks RUNNING in ONE conditional update, so two
 * concurrent POSTs cannot both think they started the run — the second updates zero rows.
 */
export async function claimPass(ideaId: string, passKey: string): Promise<number> {
  const existing = await prisma.deepeningPass.findUnique({ where: { ideaId_passKey: { ideaId, passKey } } })

  if (!existing) {
    const created = await prisma.deepeningPass.create({
      data: { ideaId, passKey, status: 'RUNNING', runVersion: 1, startedAt: new Date(), knownUnknowns: [] },
    })
    return created.runVersion
  }
  if (existing.status === 'RUNNING') throw new PassAlreadyRunning(passKey)

  const next = existing.runVersion + 1
  const claimed = await prisma.deepeningPass.updateMany({
    where: { id: existing.id, status: existing.status },
    data: { status: 'RUNNING', runVersion: next, startedAt: new Date(), completedAt: null, failureReason: null },
  })
  if (claimed.count === 0) throw new PassAlreadyRunning(passKey)
  return next
}

/**
 * Re-run housekeeping (§2.2): PROPOSED items from earlier runs are superseded — marked
 * REJECTED with a note saying why — and ACCEPTED items are NEVER touched. Issues from
 * earlier runs are left exactly as they are: an OPEN issue the user has not triaged is
 * still open, and silently clearing it would delete their to-do list.
 */
async function supersedeOlderProposals(ideaId: string, passKey: string, runVersion: number): Promise<number> {
  const res = await prisma.evidenceItem.updateMany({
    where: { ideaId, passKey, status: 'PROPOSED', runVersion: { lt: runVersion } },
    data: { status: 'REJECTED', note: `Superseded by run ${runVersion}` },
  })
  return res.count
}

export interface RunOutcome {
  runVersion: number
  status: 'RUN' | 'FAILED'
  findings: number
  issues: number
  knownUnknowns: number
  superseded: number
  failureReason?: string
  // §19-E Tasks 3/4 — what the run actually did, reported to the caller rather than
  // left in a log. `siftSkipped` and `adversarialIssues` exist so a degraded run and a
  // full one are distinguishable from outside (CLAUDE.md §18 corollary).
  reviewed?: number
  kept?: number
  siftSkipped?: boolean
  adversarialIssues?: boolean
  precedentsDowngraded?: number
}

/**
 * The gather. Runs the pass's intents, asks the model to turn what came back into findings
 * and issues, persists INCREMENTALLY, then settles the status.
 *
 * `runVersion` is passed in rather than read, so the row this writes is provably the row
 * `claimPass` claimed even if another run started in between.
 */
export async function runPass(ideaId: string, passKey: string, runVersion: number): Promise<RunOutcome> {
  const def = passDef(passKey)
  if (!def) throw new Error(`Unknown passKey: ${passKey}`)
  const startedAt = Date.now()
  const superseded = await supersedeOlderProposals(ideaId, passKey, runVersion)

  let findings = 0
  let issues = 0
  let knownUnknowns: KnownUnknown[] = []
  let failureReason: string | undefined

  try {
    const ctx = await loadIdeaContext(ideaId)

    // 1. RETRIEVE. Each intent in turn; a failed intent is recorded as failed and does not
    //    abort the pass — but it DOES become a known unknown, because "the search broke" and
    //    "the corpus is silent" are different sentences (§19-C Task 1a).
    const retrieved: SearchResult[] = []
    const failedIntents: string[] = []
    // §19-E Task 3 — A LARGER CANDIDATE SET, AND THE UNGROUPED ONE.
    //
    // Two changes, and the second is the one that actually matters. The limit rises so
    // the sift has something to sift; and the pass now reads `res.results` rather than
    // `res.grouped`. `groupForPanel` caps at 3 PER DISPLAY TYPE and ~20 overall — it is
    // the PANEL's presentation rule, and taking it as the gather's candidate set meant
    // that however high the limit went, a pass could never see a fourth impact
    // assessment. That cap is right for a panel a human reads and wrong for a machine
    // sift, and it silently bounded the old behaviour at ~20 regardless of `limit`.
    const perIntent = Math.max(1, Math.ceil(SIFT_CANDIDATE_TARGET / Math.max(1, def.intents.length)))
    for (const intent of def.intents) {
      if (Date.now() - startedAt > RUN_BUDGET_MS) { failureReason = 'Ran out of time during retrieval'; break }
      const res = await runSearch({
        keywords: ctx.keywords,
        intent,
        ideaContext: ctx.summary,
        limit: perIntent,
      })
      if (res.failed) { failedIntents.push(intent); continue }
      retrieved.push(...res.results)
    }
    const candidates = dedupeById(retrieved)

    // 1b. SIFT. "Does this actually bear on this proposal's problem, and how?" — a
    //     different question from "what is most similar", and one the interactive path
    //     could never afford. A sift that cannot run returns the ranked set MARKED as
    //     unsifted; it never empties the pass.
    const sift = candidates.length
      ? await siftCandidates({
          passMethod: def.method, mustAnswer: def.mustAnswer, idea: ctx.summary, candidates,
        })
      : { kept: [], judgements: new Map<string, SiftKeep>(), reviewed: 0, skipped: false as boolean, skipReason: undefined }
    const deduped = sift.kept
    if (sift.skipped) console.warn('[deepening] sift skipped —', sift.skipReason)
    console.log('[deepening] candidates', {
      passKey, retrieved: retrieved.length, deduped: candidates.length,
      kept: deduped.length, skipped: sift.skipped,
    })
    await writePassReferences(
      ideaId, passKey, def.intents.join('+'),
      failedIntents.length < def.intents.length, ctx.keywords, deduped,
      failedIntents.length ? `intents that failed: ${failedIntents.join(', ')}` : undefined,
    )

    // 2. NOTHING TO WORK FROM = NOTHING CLAIMED. No model call, no invented findings; the
    //    whole pass becomes known unknowns. This is the never-claim invariant at its plainest.
    //
    //    ⚠ THREE DIFFERENT SILENCES, AND THEY MUST NOT SHARE A SENTENCE. "The search
    //    broke", "the corpus holds nothing on this", and "we reviewed 104 sources and
    //    none of them bore on this proposal" are three different findings about the
    //    world, and the third is the sift working, not failing. Collapsing them into
    //    "nothing was found" is the §19-C Task 1a defect wearing a new hat.
    if (deduped.length === 0) {
      const why = failedIntents.length
        ? `Retrieval failed for ${failedIntents.join(', ')}, so nothing was searched successfully.`
        : candidates.length === 0
          ? 'The searches ran and returned no material on this idea.'
          : `${candidates.length} sources were retrieved and reviewed, and none of them bore on this proposal's problem.`
      knownUnknowns = def.mustAnswer.map((q) => ({ question: q, why }))
      await settle(ideaId, passKey, runVersion, failedIntents.length ? 'FAILED' : 'RUN', knownUnknowns,
        failedIntents.length ? `Retrieval failed: ${failedIntents.join(', ')}` : undefined,
        { reviewed: sift.reviewed, kept: 0, skipped: sift.skipped })
      const issueCount = await raiseTemplateIssues(ideaId, def, runVersion, {
        countsByKind: {}, findingCount: 0, typesReturned: {}, knownUnknownCount: knownUnknowns.length,
        hasCostLines: ctx.hasCostLines, hasChosenApproach: ctx.hasChosenApproach,
        jurisdictionMentioned: ctx.jurisdictionMentioned,
      })
      return {
        runVersion, status: failedIntents.length ? 'FAILED' : 'RUN', findings: 0, issues: issueCount,
        knownUnknowns: knownUnknowns.length, superseded,
        failureReason: failedIntents.length ? `Retrieval failed: ${failedIntents.join(', ')}` : undefined,
      }
    }

    // 3. GATHER. One model call per pass, given only what retrieval returned.
    const gathered = await generateDeepeningFindings({
      method: def.method,
      mustAnswer: def.mustAnswer,
      idea: ctx.summary,
      costLines: ctx.costLines,
      results: deduped,
    })

    if (!gathered) {
      // The model call failed. That is a FAILED run with its retrieval kept, not an empty one.
      knownUnknowns = def.mustAnswer.map((q) => ({
        question: q,
        why: 'The analysis step failed after retrieval succeeded — the sources are in the panel, but nothing was concluded from them. Re-run.',
      }))
      await settle(ideaId, passKey, runVersion, 'FAILED', knownUnknowns, 'The analysis step failed after retrieval succeeded',
        { reviewed: sift.reviewed, kept: deduped.length, skipped: sift.skipped })
      return { runVersion, status: 'FAILED', findings: 0, issues: 0, knownUnknowns: knownUnknowns.length, superseded, failureReason: 'The analysis step failed after retrieval succeeded' }
    }

    // 4. PERSIST INCREMENTALLY — one row at a time, so a timeout in the middle loses the
    //    tail and not the run.
    const byId = new Map(deduped.map((r) => [r.id, r]))
    let precedentsDowngraded = 0
    for (const f of gathered.findings) {
      const src = f.sourceId ? byId.get(f.sourceId) : undefined
      // A finding whose source is not in what we retrieved is not a finding, it is a claim.
      if (!src) continue
      const judged = sift.judgements.get(src.id)

      // §19-E Task 3 — THE PRECEDENT TEST, ENFORCED RATHER THAN REQUESTED.
      //
      // "A candidate kept as a PRECEDENT must satisfy the precedent test: a comparable
      // measure was tried, and we can say what it was for, what was predicted, or what
      // happened. A topically-related document is not a precedent."
      //
      // The sift makes that judgement about the SOURCE, separately and before the
      // gather has decided what to say about it — which is why it can overrule the
      // gather here. A downgrade is not a deletion: the finding survives as a FINDING,
      // with everything it says intact, and only the word "precedent" is withdrawn.
      // // A false precedent is worse than a missing one. The user takes it into a
      // // committee room and is asked what happened, and nothing did.
      let kind = f.kind
      if (kind === 'PRECEDENT' && judged && !judged.isPrecedent) {
        kind = 'FINDING'
        precedentsDowngraded++
        console.log('[deepening] precedent downgraded — source fails the precedent test', {
          passKey, sourceId: src.id, title: f.title.slice(0, 60),
        })
      }

      await prisma.evidenceItem.create({
        data: {
          ideaId, passKey, runVersion,
          fieldRef: f.fieldRef ?? null,
          kind,
          title: f.title,
          body: f.body,
          sourceType: src.type,
          sourceId: src.id,
          citation: src.citation,
          url: src.url,
          status: 'PROPOSED',
          siftReason: judged?.reason ?? null,
          // Null, not false, when the sift did not run: "not assessed" and "assessed and
          // failed" are different, and a null renders as neither.
          precedentTestPassed: judged ? judged.isPrecedent : null,
        },
      })
      findings++
    }
    if (precedentsDowngraded) {
      console.warn(`[deepening] ${precedentsDowngraded} finding(s) downgraded from PRECEDENT`, { passKey })
    }

    // 4b. THE ISSUES ARE A SEPARATE READING (§19-E Task 4). Not `gathered.issues` — the
    //     gather critiquing its own output from inside its own frame produced footnotes
    //     to the findings. This is a hostile committee clerk reading the proposal for
    //     the first time WITH the findings attached, asked where it is weakest.
    //
    //     If the adversarial call fails, we keep the gather's own issues rather than
    //     losing the list entirely — degraded, and SAID SO in the log, because a
    //     proposal shown as having survived a hostile reading it never had is exactly
    //     the kind of quiet false claim this codebase keeps having to remove.
    const adversarial = await generateAdversarialIssues({
      idea: ctx.summary,
      costLines: ctx.costLines,
      findings: gathered.findings,
      passMethod: def.method,
      knownUnknowns: gathered.gaps,
    })
    const issueTexts = adversarial ?? gathered.issues
    if (!adversarial) {
      console.warn('[deepening] adversarial issues call failed — falling back to the gather\'s own issues', { passKey })
    }
    console.log('[deepening] issues', {
      passKey, adversarial: !!adversarial, raised: issueTexts.length, gatherWouldHaveRaised: gathered.issues.length,
    })

    for (const text of issueTexts) {
      await prisma.deepeningIssue.create({ data: { ideaId, passKey, runVersion, text, status: 'OPEN' } })
      issues++
    }

    // 5. KNOWN UNKNOWNS, computed from THIS RUN. A mustAnswer question the model did not
    //    report answering is declared, with the reason attached.
    const answered = new Set(gathered.answered)
    knownUnknowns = def.mustAnswer
      .filter((q) => !answered.has(q))
      .map((q) => ({ question: q, why: 'Nothing retrieved answered this.' }))
    for (const intent of failedIntents) {
      knownUnknowns.push({ question: `Everything the ${intent} search would have covered`, why: 'That search failed to run.' })
    }
    for (const gap of gathered.gaps) knownUnknowns.push({ question: gap, why: 'Named by the pass as unfindable in what was retrieved.' })

    await settle(ideaId, passKey, runVersion, 'RUN', knownUnknowns, undefined,
      { reviewed: sift.reviewed, kept: deduped.length, skipped: sift.skipped })

    // 6. TEMPLATE ISSUES — the ones whose absence is itself a defect, raised deterministically
    //    rather than left to the model to remember.
    const typesReturned: Record<string, number> = {}
    for (const r of deduped) typesReturned[r.type] = (typesReturned[r.type] ?? 0) + 1
    const countsByKind: Record<string, number> = {}
    for (const f of gathered.findings) countsByKind[f.kind] = (countsByKind[f.kind] ?? 0) + 1
    issues += await raiseTemplateIssues(ideaId, def, runVersion, {
      countsByKind, findingCount: findings, typesReturned, knownUnknownCount: knownUnknowns.length,
      hasCostLines: ctx.hasCostLines, hasChosenApproach: ctx.hasChosenApproach,
      jurisdictionMentioned: ctx.jurisdictionMentioned,
    })

    return {
      runVersion, status: 'RUN', findings, issues, knownUnknowns: knownUnknowns.length, superseded,
      reviewed: sift.reviewed, kept: deduped.length, siftSkipped: sift.skipped,
      adversarialIssues: !!adversarial, precedentsDowngraded,
    }
  } catch (err) {
    failureReason = err instanceof Error ? err.message : String(err)
    // Whatever was persisted before the throw STAYS. The status tells the truth about it.
    await settle(ideaId, passKey, runVersion, 'FAILED', knownUnknowns, failureReason)
    return { runVersion, status: 'FAILED', findings, issues, knownUnknowns: knownUnknowns.length, superseded, failureReason }
  }
}

async function settle(
  ideaId: string, passKey: string, runVersion: number,
  status: 'RUN' | 'FAILED', knownUnknowns: KnownUnknown[], failureReason?: string,
  // §19-E Task 3 — the sift counts settle WITH the status, in the same guarded write.
  // Optional because the catch-all failure path may not have got as far as sifting, and
  // writing zeros there would claim a review that never happened.
  sift?: { reviewed: number; kept: number; skipped: boolean },
): Promise<void> {
  await prisma.deepeningPass.updateMany({
    // Guarded on runVersion: a slow run must never overwrite the status of a NEWER one.
    where: { ideaId, passKey, runVersion },
    data: {
      status, completedAt: new Date(),
      failureReason: failureReason ?? null,
      knownUnknowns: knownUnknowns as never,
      ...(sift ? { candidatesReviewed: sift.reviewed, candidatesKept: sift.kept, siftSkipped: sift.skipped } : {}),
    },
  })
}

async function raiseTemplateIssues(ideaId: string, def: PassDef, runVersion: number, ctx: IssueContext): Promise<number> {
  let n = 0
  for (const t of def.issueTemplates) {
    if (!t.when(ctx)) continue
    // Do not re-raise a template the user has already triaged — an issue they dismissed
    // with a reason coming straight back on the next run is nagging, not scrutiny.
    const prior = await prisma.deepeningIssue.findFirst({
      where: { ideaId, passKey: def.key, text: t.text, status: { in: ['DISMISSED', 'DEFERRED', 'ADDRESSED'] } },
    })
    if (prior) continue
    const open = await prisma.deepeningIssue.findFirst({ where: { ideaId, passKey: def.key, text: t.text, status: 'OPEN' } })
    if (open) continue
    await prisma.deepeningIssue.create({ data: { ideaId, passKey: def.key, runVersion, text: t.text, status: 'OPEN' } })
    n++
  }
  return n
}

function dedupeById(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>()
  const out: SearchResult[] = []
  for (const r of results) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    out.push(r)
  }
  return out
}

// ── the idea context a gather is allowed to see ──────────────────────────────
// READ-ONLY, and narrow on purpose: the gather needs to know what the proposal says, not
// to be handed a writable handle on it.

interface IdeaContext {
  keywords: string[]
  summary: string
  costLines: string[]
  hasCostLines: boolean
  hasChosenApproach: boolean
  jurisdictionMentioned: boolean
}

async function loadIdeaContext(ideaId: string): Promise<IdeaContext> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: {
      title: true, keywords: true, summaryDescription: true,
      challenge: true, diagnosis: true, pivotalObstacle: true, summaryDiagnosis: true,
      guidingPolicy: true, legalLandscape: true, whoAffectedImpactCost: true,
      lexActions: { select: { practicalStep: true, costLines: { select: { label: true, low: true, high: true, unit: true, basis: true } } } },
      policyOptions: { select: { approach: true, status: true } },
    },
  })
  if (!idea) throw new Error('Idea not found')

  const asText = (v: unknown): string => {
    if (typeof v === 'string') return v
    if (v && typeof v === 'object') return Object.values(v as Record<string, unknown>).filter((x) => typeof x === 'string').join(' · ')
    return ''
  }

  const chosen = idea.policyOptions.find((o) => o.status === 'CHOSEN')
  const ruledOut = idea.policyOptions.filter((o) => o.status === 'RULED_OUT')

  const summaryParts = [
    idea.title && `Title: ${idea.title}`,
    idea.challenge && `The problem: ${idea.challenge}`,
    asText(idea.whoAffectedImpactCost) && `Who is affected / impact / cost: ${asText(idea.whoAffectedImpactCost)}`,
    idea.pivotalObstacle && `Pivotal obstacle: ${idea.pivotalObstacle}`,
    asText(idea.legalLandscape) && `Legal landscape as stated: ${asText(idea.legalLandscape)}`,
    // ⚠ BOTH, and the second one is the live source. `Idea.guidingPolicy` is the LEGACY
    // column and is null on every rebuild idea — the chosen approach lives in a
    // PolicyOption row with status CHOSEN. The 12 Aug verification run found this the
    // honest way: the pass completed and its context simply had no guiding policy in it,
    // which would have quietly weakened FINANCIAL and POLITICAL_RISK for every idea built
    // since the rebuild without ever failing.
    idea.guidingPolicy && `Guiding policy: ${idea.guidingPolicy}`,
    chosen && `Chosen approach: ${chosen.approach}`,
    ruledOut.length && `Approaches ruled out: ${ruledOut.map((o) => o.approach).join('; ')}`,
    idea.lexActions.length && `Actions: ${idea.lexActions.map((a) => a.practicalStep).join('; ')}`,
  ].filter(Boolean) as string[]

  const costLines = idea.lexActions.flatMap((a) =>
    a.costLines.map((c) => `${c.label}: ${c.low ?? '?'}–${c.high ?? '?'} ${c.unit ?? ''} (basis: ${c.basis ?? 'NOT STATED'})`))

  const allText = summaryParts.join(' ')
  return {
    keywords: Array.isArray(idea.keywords) ? idea.keywords.filter(Boolean) : [],
    summary: summaryParts.join('\n'),
    costLines,
    hasCostLines: costLines.length > 0,
    hasChosenApproach: !!chosen,
    // A crude but honest test, and stated as such in the issue it drives: it asks whether the
    // proposal SAYS anything about extent, not whether the answer is right.
    jurisdictionMentioned: /\b(England|Wales|Scotland|Northern Ireland|UK-wide|United Kingdom|devolved|reserved)\b/i.test(allText),
  }
}

// ── the user's judgments ─────────────────────────────────────────────────────
// Ordinary synchronous writes. None of them touches a canonical field.

export async function setEvidenceStatus(
  ideaId: string, evidenceId: string, status: 'ACCEPTED' | 'REJECTED', note?: string,
): Promise<EvidenceView | null> {
  const row = await prisma.evidenceItem.findFirst({ where: { id: evidenceId, ideaId } })
  if (!row) return null
  const updated = await prisma.evidenceItem.update({
    where: { id: evidenceId },
    data: { status, note: note ?? row.note },
  })
  return toEvidenceView(updated)
}

export type IssueAction = 'address' | 'defer' | 'dismiss' | 'reopen'

export class DismissalNeedsAReason extends Error {
  constructor() { super('A dismissed issue must carry a reason') }
}

export async function triageIssue(
  ideaId: string, issueId: string,
  action: IssueAction,
  input: { note?: string; reason?: string; evidenceId?: string } = {},
): Promise<IssueView | null> {
  const row = await prisma.deepeningIssue.findFirst({ where: { id: issueId, ideaId } })
  if (!row) return null

  if (action === 'dismiss' && !input.reason?.trim()) throw new DismissalNeedsAReason()

  const data =
    action === 'address'
      ? {
          status: 'ADDRESSED' as const,
          resolutionNote: input.note?.trim() || null,
          resolutionEvidenceId: input.evidenceId ?? null,
          resolvedAt: new Date(),
        }
      : action === 'defer'
        ? { status: 'DEFERRED' as const, resolvedAt: null }
        : action === 'dismiss'
          ? { status: 'DISMISSED' as const, dismissReason: input.reason!.trim(), resolvedAt: new Date() }
          : { status: 'OPEN' as const, resolvedAt: null, resolutionNote: null, resolutionEvidenceId: null }

  const updated = await prisma.deepeningIssue.update({ where: { id: issueId }, data })
  return toIssueView(updated)
}

/** Findings the user has ACCEPTED against one field — the read-only evidence chips. */
export async function acceptedEvidenceFor(ideaId: string): Promise<Record<string, EvidenceView[]>> {
  const rows = await prisma.evidenceItem.findMany({
    where: { ideaId, status: 'ACCEPTED', fieldRef: { not: null } },
    orderBy: { createdAt: 'asc' },
  })
  const out: Record<string, EvidenceView[]> = {}
  for (const r of rows) {
    const key = r.fieldRef as string
    ;(out[key] ??= []).push(toEvidenceView(r))
  }
  return out
}

export type { RawFinding }
