// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-B §4 — PASS 3: RESEARCH WHAT THE DRAFT REVEALED.
//
// 25-A drafted a kernel from four answers with NO research behind it. This pass is the
// one that makes it worth reading: it runs the interrogation library against the pass-2
// draft, retrieves wide, sifts, and keeps what actually bears on the proposal.
//
// ⚠ EVERY MECHANISM HERE IS THE DEEPENING'S (§2). `siftCandidates`, the gather,
// `EvidenceItem`, `DeepeningIssue`, `supersedeOlderProposals` — all imported, none
// rebuilt. What is genuinely new is the UNIT: the Deepening researches per PASS, this
// researches per QUESTION, and a question knows what terms to send and when to fire.
//
// FOUR THINGS IT MUST NOT DO, each of which has bitten this codebase before:
//
//  1. REPORT A GAP IT DID NOT LOOK FOR. "The search broke", "the corpus is silent" and
//     "we reviewed 104 sources and none bore on this" are three different findings about
//     the world. Every question's outcome carries WHICH.
//  2. LET A LIMIT IN OUR TOOLING READ AS AN ABSENCE OF EVIDENCE. A question whose
//     retrieval mode Search has not built says so in those words (§3).
//  3. SPEND THE WHOLE BUILD'S BUDGET ON ONE QUESTION. The per-pass ceiling is checked
//     between questions, and hitting it stops the PASS, not the build (§8).
//  4. CLAIM A FINDING FOR A SOURCE IT DID NOT RETRIEVE. The gather's sourceId is checked
//     against the sifted set, exactly as the Deepening checks it.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import type { SearchResult } from './page1-config'
import { runSearch } from './search-gateway'
import { siftCandidates, siftSummaryLine, SIFT_CANDIDATE_TARGET, type SiftKeep } from './deepening-sift'
import { generateDeepeningFindings, type RawFinding } from './deepening-client'
import type { KnownUnknown } from './deepening'
import { supersedeOlderProposals } from './evidence-layer'
import { mergePerspectives, divergenceLine, type MergedGather, type PerspectiveRun } from './build-perspectives'
import { perspectivesFor, modelForPass, PASS_COST_CEILING_PENCE, PASS_BUDGET_MS } from './build-config'
import { priceBuild } from './build-cost'
import type { LlmUsage } from './build-llm'
import {
  questionsFor, retrievalStanding, retrievalNote,
  type DraftFacts, type InterrogationQuestion,
} from './interrogation-library'
import { assessInstrumentRetirement, type InstrumentAssessment } from './build-client'
import { llmOk } from './build-llm'
import {
  writeQueries, extractedQuery, noteQueryDefects, type IssuedQuery,
} from './build-query'
import { TESTIMONY_INSTRUCTION } from './testimony'
import { sourceDateFields } from './evidence-date'

/** Why a question produced nothing. Named apart — see rule 1 in the header. */
export type QuestionFailure = 'search-broke' | 'gather-failed' | 'nothing-bore-on-it' | 'corpus-silent' | null

export interface QuestionOutcome {
  id: string
  question: string
  panelHeading: string
  /** How well this question could be asked at all. See interrogation-library.ts. */
  standing: string
  retrievalNote: string | null
  reviewed: number
  kept: number
  siftSkipped: boolean
  findings: number
  contradictions: number
  gaps: KnownUnknown[]
  failure: QuestionFailure
  /** "Reviewed 104 sources; 12 bore on this proposal." */
  siftLine: string | null
  /** §7 — only present when more than one perspective ran. */
  divergence: string | null
}

/**
 * A finding AS STORED — with the citation attached.
 *
 * ⚠⚠ 25-F §1/§5 — THIS TYPE EXISTS BECAUSE THE REVISION PASS HAS NEVER SEEN A FINDING.
 *
 * `researchSummary()` used to render one line per question — a panel heading and a COUNT
 * ("Whether a power to do this already exists: 6 findings — reviewed 104, kept 12"). That
 * string is `carry.research`, and `carry.research` is the entire "═══ WHAT THE RESEARCH
 * FOUND ═══" block handed to pass 4. So the pass whose job is to rewrite the kernel in the
 * light of the evidence was given the ARITHMETIC of the evidence and not the evidence.
 *
 * That is the mechanism behind the brief's §0: 70 evidence items with real citations —
 * CRaG 2010 ss.1–3 with Explanatory Note paragraph numbers, the Lords Constitution
 * Committee's 2012 report, PASC 2014 — sitting in the database while the revised kernel
 * came out as "incentives encourage diffusion of responsibility". The material was never
 * lost. It was never delivered.
 */
export interface CitedFinding {
  questionId: string
  panelHeading: string
  kind: string
  title: string
  body: string
  /** The source's own citation string, or null where the source carried none. */
  citation: string | null
  sourceType: string | null
  url: string | null
}

export interface ResearchOutcome {
  outcomes: QuestionOutcome[]
  usages: LlmUsage[]
  /** §4 — the leading question's verdict, when one was reached. */
  instrument: InstrumentAssessment | null
  /** Every finding, for the adversarial read in pass 5. */
  findings: RawFinding[]
  /** 25-F — the same findings WITH their citations, for the revision and the screen. */
  cited: CitedFinding[]
  /** Prose for the carry: what passes 4 and 5 are revising and reading against. */
  summary: string
  /** 25-F §4 — every query this pass issued, and how each was built. */
  queries: IssuedQuery[]
  /** TRUE when the per-pass ceiling stopped the pass before every question ran. */
  stoppedEarly: boolean
  stoppedReason: string | null
}

const PER_QUESTION_LIMIT = () =>
  parseInt(process.env.LEX_BUILD_RESEARCH_CANDIDATES ?? String(SIFT_CANDIDATE_TARGET), 10)

/**
 * The facts a question's `firesWhen` and `terms` are allowed to see.
 *
 * ⚠ Read from the DATABASE, not from the in-memory carry alone. Pass 3 runs in its own
 * request (§1), and the draft it is researching is the one that was actually persisted —
 * including any correction the user made between passes. Researching a draft the user
 * has already edited would be researching something nobody is proposing.
 */
export async function draftFactsFor(ideaId: string, carry: {
  orientation?: string; diagnosis?: string; approach?: string; instrument?: string
}): Promise<DraftFacts> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: {
      title: true, challenge: true, summaryDiagnosis: true, pivotalObstacle: true,
      rootCause: true, summaryGuidingPolicy: true, chosenApproach: true,
      legalLandscape: true, whoAffectedImpactCost: true,
      diagnosisCauses: { select: { cause: true } },
      lexActions: { select: { practicalStep: true } },
      policyOptions: { select: { approach: true, status: true } },
    },
  })

  const asText = (v: unknown): string => {
    if (typeof v === 'string') return v
    if (v && typeof v === 'object') {
      return Object.values(v as Record<string, unknown>).filter((x) => typeof x === 'string').join(' · ')
    }
    return ''
  }

  const text = [
    idea?.title, idea?.challenge, idea?.summaryDiagnosis, idea?.rootCause, idea?.pivotalObstacle,
    asText(idea?.whoAffectedImpactCost), asText(idea?.legalLandscape),
    idea?.chosenApproach, idea?.summaryGuidingPolicy,
    ...(idea?.diagnosisCauses ?? []).map((c) => c.cause),
    ...(idea?.lexActions ?? []).map((a) => a.practicalStep),
    carry.orientation, carry.diagnosis, carry.approach,
  ].filter(Boolean).join('\n')

  const instrument = (carry.instrument ?? '').trim()
  const lower = instrument.toLowerCase()

  // ⚠ AN UNNAMED INSTRUMENT COUNTS AS PRIMARY. §3: EXISTING_POWER "should fire on every
  // idea whose drafted instrument is primary legislation" — and a build that never named
  // one is the case where a user is MOST likely to end up drafting a Bill by default, so
  // treating silence as "not primary" would switch the highest-value question off
  // precisely where it is most needed.
  const instrumentIsPrimary =
    !instrument || lower.includes('not named') ||
    (lower.includes('primary') && !lower.includes('secondary'))

  const devolution: DraftFacts['devolution'] =
    /\breserved\b/i.test(instrument) ? 'reserved'
      : /\bdevolved\b/i.test(instrument) ? 'devolved'
        : 'unknown'

  return {
    text,
    instrument,
    instrumentIsPrimary,
    devolution,
    namesExistingLaw: /\b(Act|Regulations?|Order|section|s\.\s?\d|Directive|Code|regulator|Ofgem|Ofcom|Ofwat|FCA|HSE)\b/.test(text),
    hasCauses: (idea?.diagnosisCauses?.length ?? 0) > 0,
    hasChosenApproach: !!(idea?.chosenApproach || idea?.policyOptions.some((o) => o.status === 'CHOSEN')),
  }
}

/** Retrieve for one question. Each intent is its own gateway call; a question with no
 *  intents is answered by reasoning and retrieves nothing (the domain-transfer case). */
async function retrieveFor(
  q: InterrogationQuestion, facts: DraftFacts,
  /**
   * 25-F §4 — the query WRITTEN for this question, when there is one. Absent means the
   * writer did not produce a usable query for this job and the extraction is standing in;
   * the caller has already recorded that, so this signature does not have to.
   */
  query: IssuedQuery,
): Promise<{ candidates: SearchResult[]; searchBroke: boolean; ran: boolean }> {
  if (!q.intents.length) return { candidates: [], searchBroke: false, ran: false }

  const keywords = query.terms
  const perIntent = Math.max(1, Math.ceil(PER_QUESTION_LIMIT() / q.intents.length))
  const seen = new Set<string>()
  const candidates: SearchResult[] = []
  let broke = false
  let ran = false

  for (const intent of q.intents) {
    try {
      const out = await runSearch({
        keywords,
        intent,
        ideaContext: facts.text.slice(0, 1500),
        // ⚠ `results`, not `grouped`. groupForPanel caps at 3 per display type and ~20
        // overall — the PANEL's presentation rule, which silently bounded the Deepening's
        // candidate set at ~20 however high the limit went (see deepening.ts).
        limit: perIntent,
      })
      ran = true
      if (out.failed) { broke = true; continue }
      for (const r of out.results) {
        if (seen.has(r.id)) continue
        seen.add(r.id)
        candidates.push(r)
      }
    } catch (err) {
      broke = true
      console.warn('[25b:research] retrieval threw', {
        question: q.id, intent, error: err instanceof Error ? err.message : err,
      })
    }
  }
  // ⚠ 25-C §2.1 — THE SAME CAP AS THE DEEPENING, FOR THE SAME REASON.
  //
  // `limit` is per-stream at the gateway and each stream over-fetches ×3 for fusion, so a request
  // for 34 returns ~500 (measured: `limit: 10` → 150 rows across five streams). Pass 3 pays a
  // sift AND a gather per question, so the flood arrives as truncation and spend rather than as
  // a slow page. Reported to CC-Search in docs/FINDING_FOR_SEARCH_gateway-limit-fanout.md; the
  // gateway is theirs and is deliberately untouched.
  //
  // A prefix is fair ONLY because `interleaveStreams` round-robins — it is stream-balanced, not
  // legislation-heavy. A prefix of a score-ordered list would have been a silent bias.
  const target = PER_QUESTION_LIMIT()
  const capped = candidates.slice(0, target)
  if (candidates.length > capped.length) {
    console.warn('[25b:research] gateway returned far more than asked — capping to the target', {
      question: q.id, asked: keywords.length ? perIntent : 0,
      returned: candidates.length, sifting: capped.length,
      discardedUnjudged: candidates.length - capped.length,
    })
  }
  return { candidates: capped, searchBroke: broke || !ran, ran }
}

/**
 * Run one question end to end: retrieve → sift → gather (once per perspective) → merge.
 *
 * Persists nothing. The caller owns the database, exactly as build.ts owns it for every
 * other pass, so that "what was asked" and "what was stored" stay separable.
 */
async function askQuestion(input: {
  q: InterrogationQuestion
  facts: DraftFacts
  costLines: string[]
  /** 25-F §4 — the query this question issues. Written, or the recorded fallback. */
  query: IssuedQuery
  /** 25-F §5 — the user's own words, verbatim. See `TESTIMONY_FOR_RESEARCH`. */
  testimony: string
  onUsage: (u: LlmUsage) => void
}): Promise<{
  outcome: Omit<QuestionOutcome, 'findings' | 'contradictions'>
  merged: MergedGather | null
  kept: SearchResult[]
  judgements: Map<string, SiftKeep>
}> {
  const { q, facts } = input
  const standing = retrievalStanding(q)
  const base = {
    id: q.id,
    question: q.question,
    panelHeading: q.panelHeading,
    standing,
    retrievalNote: retrievalNote(q),
  }

  const { candidates, searchBroke, ran } = await retrieveFor(q, facts, input.query)

  // The reasoning-only question. No retrieval, no sift, and it says so — the gather is
  // still run because the question is answerable BY REASONING, which is the entire point
  // of asking it. `results: []` means the gather has nothing it may cite, and its own
  // never-claim rules then force the answer to be labelled as reasoning.
  if (!ran && standing !== 'reasoned') {
    return {
      outcome: {
        ...base, reviewed: 0, kept: 0, siftSkipped: false, gaps: gapsFor(q, 'search-broke'),
        failure: 'search-broke', siftLine: null, divergence: null,
      },
      merged: null, kept: [], judgements: new Map(),
    }
  }

  if (ran && searchBroke && !candidates.length) {
    return {
      outcome: {
        ...base, reviewed: 0, kept: 0, siftSkipped: false, gaps: gapsFor(q, 'search-broke'),
        failure: 'search-broke', siftLine: null, divergence: null,
      },
      merged: null, kept: [], judgements: new Map(),
    }
  }

  if (ran && !candidates.length) {
    return {
      outcome: {
        ...base, reviewed: 0, kept: 0, siftSkipped: false, gaps: gapsFor(q, 'corpus-silent'),
        failure: 'corpus-silent', siftLine: null, divergence: null,
      },
      merged: null, kept: [], judgements: new Map(),
    }
  }

  // ── The sift. The Deepening's, unchanged. ────────────────────────────────
  //
  // ⚠ 25-F §5 — THE SIFT NOW SEES THE PROPOSER'S OWN ACCOUNT, AND IT NEVER HAS BEFORE.
  // `facts.text` is built from the persisted Idea columns and the carry; the user's own
  // sentences are in neither. So the step that decides which of a hundred retrieved
  // documents bear on the proposal was doing it without the first-hand account of what
  // the proposal is about. Appended, not substituted — see testimony.ts.
  const ideaWithTestimony = `${facts.text}${input.testimony}`
  const sift = candidates.length
    ? await siftCandidates({
        passMethod: q.method, mustAnswer: q.mustAnswer, idea: ideaWithTestimony, candidates,
      })
    : { kept: [] as SearchResult[], judgements: new Map<string, SiftKeep>(), reviewed: 0, skipped: false, skipReason: undefined }

  const siftLine = candidates.length ? siftSummaryLine(sift.reviewed, sift.kept.length, sift.skipped) : null

  // Reviewed a hundred and kept none is a RESULT, not a failure — and it is a different
  // sentence from "the corpus is silent", which is why the sift ran at all.
  if (candidates.length && !sift.kept.length) {
    return {
      outcome: {
        ...base, reviewed: sift.reviewed, kept: 0, siftSkipped: sift.skipped,
        gaps: gapsFor(q, 'nothing-bore-on-it', sift.reviewed),
        failure: 'nothing-bore-on-it', siftLine, divergence: null,
      },
      merged: null, kept: [], judgements: sift.judgements,
    }
  }

  // ── The gather, once per perspective (§7). ───────────────────────────────
  const perspectives = perspectivesFor('RESEARCH')
  const runs: PerspectiveRun[] = []
  for (const p of perspectives) {
    const result = await generateDeepeningFindings(
      {
        method: `${q.method}\n\nTHE QUESTION YOU ARE ANSWERING: ${q.question}\n\n${TESTIMONY_INSTRUCTION}`,
        mustAnswer: q.mustAnswer,
        idea: ideaWithTestimony,
        costLines: input.costLines,
        results: sift.kept,
      },
      {
        model: p.model ?? modelForPass('RESEARCH'),
        lens: p.lens || undefined,
        label: 'build-research',
        stream: 'build',
        onUsage: input.onUsage,
      },
    )
    runs.push({ perspective: p, result })
  }

  const merged = mergePerspectives(runs)
  const anyRan = runs.some((r) => r.result)
  if (!anyRan) {
    return {
      outcome: {
        ...base, reviewed: sift.reviewed, kept: sift.kept.length, siftSkipped: sift.skipped,
        gaps: gapsFor(q, 'gather-failed'), failure: 'gather-failed', siftLine,
        divergence: divergenceLine(merged.divergence),
      },
      merged: null, kept: sift.kept, judgements: sift.judgements,
    }
  }

  // Known unknowns, computed FROM THIS RUN — never a hardcoded list. A mustAnswer
  // question the gather did not report answering is declared, with its reason attached.
  const answered = new Set(merged.answered)
  const gaps: KnownUnknown[] = q.mustAnswer
    .filter((m) => !answered.has(m))
    .map((m) => ({ question: m, why: 'Nothing retrieved answered this.' }))
  for (const g of merged.gaps) {
    gaps.push({ question: g, why: 'Named by the question as unfindable in what was retrieved.' })
  }
  if (searchBroke) {
    gaps.push({
      question: `Everything a working ${q.intents.join('/')} search would have covered`,
      why: 'At least one of this question’s searches failed to run.',
    })
  }

  return {
    outcome: {
      ...base, reviewed: sift.reviewed, kept: sift.kept.length, siftSkipped: sift.skipped,
      gaps, failure: null, siftLine, divergence: divergenceLine(merged.divergence),
    },
    merged, kept: sift.kept, judgements: sift.judgements,
  }
}

/** Every mustAnswer question, declared unanswered, with the reason that is actually true. */
function gapsFor(q: InterrogationQuestion, failure: Exclude<QuestionFailure, null>, reviewed = 0): KnownUnknown[] {
  const why =
    failure === 'search-broke'
      ? 'The search for this question did not complete, so nothing was looked at. This is a failure in our search, not a finding about the corpus.'
      : failure === 'corpus-silent'
        ? 'The search ran and the corpus returned nothing on this.'
        : failure === 'nothing-bore-on-it'
          ? `${reviewed} sources were retrieved and reviewed, and none of them bore on this proposal.`
          : 'Retrieval succeeded and the analysis step failed, so the sources are stored but nothing was concluded from them.'
  return q.mustAnswer.map((m) => ({ question: m, why }))
}

/**
 * PASS 3.
 *
 * `onActivity` is called before each question so the progress display can name the
 * question being asked (§8). A ten-minute wait with no evidence of work is
 * indistinguishable from a hang.
 */
export async function runResearch(input: {
  ideaId: string
  buildId: string
  buildVersion: number
  facts: DraftFacts
  costLines: string[]
  /** 25-F §5 — the proposer's own account, verbatim and labelled. '' when they gave none. */
  testimony: string
  onActivity: (line: string) => Promise<void>
}): Promise<ResearchOutcome> {
  const startedAt = Date.now()
  const questions = questionsFor(input.facts)
  const usages: LlmUsage[] = []
  const onUsage = (u: LlmUsage) => { usages.push(u) }
  const outcomes: QuestionOutcome[] = []
  const allFindings: RawFinding[] = []
  const cited: CitedFinding[] = []
  let instrument: InstrumentAssessment | null = null
  // 25-C §3a — remembered so the verdict can be taken after every question has run.
  let instrumentQuestion: InterrogationQuestion | null = null
  let stoppedEarly = false
  let stoppedReason: string | null = null

  console.log('[25b:research] questions firing', {
    buildId: input.buildId, firing: questions.length, of: questions.length,
    leads: questions[0]?.id ?? null,
  })

  // ══ 25-F §4 — WRITE A QUERY PER QUESTION, IN ONE CALL, BEFORE ANY OF THEM RUN ══════
  //
  // ⚠ THE DEFECT THIS REPLACES IS NOT THE ONE THE BRIEF NAMES. Nothing truncated a query
  // mid-word (see build-query.ts for the byte-level diagnosis). What happened is that
  // `withTerms()` gave EVERY question the same fourteen frequency-ranked words from the
  // draft plus four or five literals — so nine questions issued nine near-identical
  // queries, and "231 sources read; 0 cited" is the view of that from the other end.
  //
  // One call for all of them, not one per question: this pass already hits its
  // 240-second budget, and nine extra round trips would buy better queries by losing two
  // questions. A question the writer skipped falls back to the old extraction and SAYS SO
  // on the record — a build where every query was written and one where none was must not
  // read the same.
  await input.onActivity('Writing a search query for each question')
  const written = await writeQueries({
    jobs: questions.map((q) => ({
      id: q.id,
      question: q.question,
      lookingFor: q.mustAnswer.join(' · '),
      anchors: q.anchors,
    })),
    // The proposer's own words lead: the terms of art we want are the ones a reader of
    // THEIR account would reach for, and the drafted kernel has already lost them once.
    context: [input.testimony, input.facts.text].filter(Boolean).join('\n\n'),
    onUsage,
  })
  const queries = new Map<string, IssuedQuery>()
  for (const q of questions) {
    const w = written.get(q.id)
    queries.set(q.id, w ?? extractedQuery(q.id, input.facts.text, q.anchors ?? []))
  }
  for (const q of queries.values()) noteQueryDefects(q, input.buildId)

  for (const q of questions) {
    // ⚠ §1/§8 — THE PER-PASS TIME CEILING, AND IT IS CHECKED HERE BECAUSE HERE IS THE
    // ONLY PLACE IT CAN FIRE.
    //
    // Every other pass is one or two model calls and finishes far inside the request. This
    // pass makes three calls PER QUESTION and there are up to nine questions, so it is the
    // one pass that can genuinely run past the platform's 300s and be killed mid-flight.
    // A budget declared in config and never checked would be a ceiling that cannot fire —
    // which this codebase has learned to distrust — so the check lives on the loop that
    // can actually exceed it.
    //
    // Stopping here means the questions already asked are PERSISTED and the rest are
    // reported as not asked. Being killed by the platform instead would mean the same
    // work, with no account of what was missed.
    const elapsed = Date.now() - startedAt
    if (elapsed > PASS_BUDGET_MS) {
      stoppedEarly = true
      stoppedReason =
        `The research pass reached its time budget of ${Math.round(PASS_BUDGET_MS / 1000)} seconds after ` +
        `${outcomes.length} of ${questions.length} questions. The rest were not asked, and that is a gap ` +
        `in what was looked at rather than a finding about the corpus.`
      console.warn('[25b:research] per-pass time budget hit', {
        buildId: input.buildId, asked: outcomes.length, of: questions.length, elapsedMs: elapsed,
      })
      break
    }

    // §8 — the PER-PASS spend ceiling. Hitting it stops this pass and lets the build
    // continue: losing the research is bad, losing passes 4 and 5 as well is worse, and a
    // build that reported "hit its spend ceiling" without saying one question ate it
    // would be hiding the thing the ceiling exists to expose.
    const spent = priceBuild(usages)
    if (spent.pence != null && spent.pence > PASS_COST_CEILING_PENCE) {
      stoppedEarly = true
      stoppedReason =
        `The research pass reached its own spend ceiling of ${PASS_COST_CEILING_PENCE}p after ` +
        `${outcomes.length} of ${questions.length} questions. The rest were not asked, and that is a ` +
        `gap in what was looked at rather than a finding about the corpus.`
      console.warn('[25b:research] per-pass cost ceiling hit', {
        buildId: input.buildId, asked: outcomes.length, of: questions.length, pence: spent.pence,
      })
      break
    }

    await input.onActivity(`Asking: ${q.question}`)

    const { outcome, merged, kept, judgements } = await askQuestion({
      q, facts: input.facts, costLines: input.costLines,
      query: queries.get(q.id)!,
      testimony: input.testimony,
      onUsage,
    })

    // ── PERSIST. One evidence layer, the Deepening's (§2). ─────────────────
    await supersedeOlderProposals(input.ideaId, q.id, input.buildVersion)

    let findingCount = 0
    let contradictions = 0
    if (merged) {
      const byId = new Map(kept.map((r) => [r.id, r]))
      for (const f of merged.findings) {
        const src = byId.get(f.sourceId)
        // A finding whose source is not in what we retrieved is not a finding, it is a
        // claim. Dropped exactly as the Deepening drops it.
        if (!src) continue
        const judged = judgements.get(src.id)

        // The precedent test, enforced rather than requested — the sift judged the
        // SOURCE before the gather decided what to say about it, so it can overrule.
        let kind = f.kind
        if (kind === 'PRECEDENT' && judged && !judged.isPrecedent) kind = 'FINDING'
        if (kind === 'CONTRADICTS') contradictions++

        await prisma.evidenceItem.create({
          data: {
            ideaId: input.ideaId,
            passKey: q.id,
            // 25-D §3 — TAGGED BY THE PRODUCER THAT KNOWS THE ANSWER. The question declares
            // which §25.5 heading it answers; nothing downstream has to work it out from the
            // finding's wording, which is where a wrong guess would come from.
            headingKey: q.heading,
            runVersion: input.buildVersion,
            fieldRef: f.fieldRef ?? null,
            kind,
            title: f.title,
            // §7 — a finding only one perspective produced is MARKED as such where the
            // user reads it, not only in an aggregate count.
            body: f.unique && merged.divergence.perspectivesRun > 1
              ? `${f.body}\n\n(Found only by ${f.perspectives[0]}.)`
              : f.body,
            sourceType: src.type,
            sourceId: src.id,
            citation: src.citation,
            url: src.url,
            status: 'PROPOSED',
            siftReason: judged?.reason ?? null,
            precedentTestPassed: judged ? judged.isPrecedent : null,
            // ⚠ 25-P §2b — THE DATE COMES OFF THE CORPUS ROW, AT WRITE TIME, NEVER FROM THE
            // MODEL. `src` is the retrieved row the finding cites; if it carries no date that
            // fact is recorded too. See lib/lex/evidence-date.ts.
            ...sourceDateFields(src),
          },
        })
        findingCount++
        allFindings.push(f)
        // 25-F — the same finding, with the citation the row carries. See `CitedFinding`.
        cited.push({
          questionId: q.id,
          panelHeading: q.panelHeading,
          kind,
          title: f.title,
          body: f.body,
          citation: src.citation ?? null,
          sourceType: src.type ?? null,
          url: src.url ?? null,
        })
      }

      for (const text of merged.issues) {
        await prisma.deepeningIssue.create({
          data: { ideaId: input.ideaId, passKey: q.id, runVersion: input.buildVersion, text, status: 'OPEN' },
        })
      }
    }

    // ── The gap, under its own panel heading (§3). ─────────────────────────
    // "A question that fires and finds nothing produces a stated gap under its own panel
    // heading. 'We looked for X and found nothing' is a result."
    await prisma.deepeningPass.upsert({
      where: { ideaId_passKey: { ideaId: input.ideaId, passKey: q.id } },
      create: {
        ideaId: input.ideaId, passKey: q.id,
        status: outcome.failure === 'search-broke' || outcome.failure === 'gather-failed' ? 'FAILED' : 'RUN',
        runVersion: input.buildVersion,
        startedAt: new Date(), completedAt: new Date(),
        failureReason: outcome.failure ? failureSentence(outcome) : null,
        knownUnknowns: outcome.gaps as never,
        candidatesReviewed: outcome.reviewed,
        candidatesKept: outcome.kept,
        siftSkipped: outcome.siftSkipped,
      },
      update: {
        status: outcome.failure === 'search-broke' || outcome.failure === 'gather-failed' ? 'FAILED' : 'RUN',
        runVersion: input.buildVersion,
        completedAt: new Date(),
        failureReason: outcome.failure ? failureSentence(outcome) : null,
        knownUnknowns: outcome.gaps as never,
        candidatesReviewed: outcome.reviewed,
        candidatesKept: outcome.kept,
        siftSkipped: outcome.siftSkipped,
      },
    })

    outcomes.push({ ...outcome, findings: findingCount, contradictions })

    // 25-C §3a — the leading question's own findings are NO LONGER assessed here. See the
    // assessment block after the loop, and the note on why it moved.
    if (q.retiresTheInstrument) instrumentQuestion = q
  }

  // ══ 25-C §3a — DOES AN EXISTING POWER RETIRE THE BILL? ════════════════════
  //
  // ⚠⚠ THIS MOVED OUT OF THE LOOP, AND THAT IS THE FIX FOR FOUR CONSECUTIVE FALSE NEGATIVES.
  //
  // `EXISTING_POWER` returned `powerFound: false` on every 25-B run, and the standing assumption
  // was that the corpus does not surface enabling provisions. It was wrong. Isolating the
  // assessment (`scripts/probe-existing-power.ts`) fed it the powers those very runs had found —
  // the Renters' Rights Act 2025, s.123 of the Housing and Planning Act 2016, the electrical
  // safety regulations — and it recognised **3 of 3**, with a control that names no power
  // correctly returning false. The gate was never shut.
  //
  // What was wrong was the SCOPE. The assessment ran INSIDE the question loop, on
  // `merged.findings` — the leading question's own six-or-fewer findings. But the powers were
  // found by the OTHER questions: the Renters' Rights Act surfaced in the revision pass reading
  // all of the research, and s.123 in the adversarial pass reading all of the evidence. The one
  // question named after the power was the one place the power was not.
  //
  // So the question still LEADS — its terms shape retrieval and its findings come first, which is
  // what §4's ordering is for — but the VERDICT is taken once, at the end, over everything the
  // pass found. Asking first and deciding last are not in conflict.
  if (instrumentQuestion && allFindings.length) {
    await input.onActivity('Checking whether an existing power removes the need for a Bill')
    const assessed = await assessInstrumentRetirement({
      question: instrumentQuestion.question,
      // ⚠ EVERY finding the pass produced, not one question's.
      findings: allFindings,
      instrument: input.facts.instrument,
    })
    onUsage(assessed.usage)
    if (llmOk(assessed)) {
      instrument = assessed.value
      console.log('[25b:research] instrument assessment', {
        buildId: input.buildId, powerFound: instrument.powerFound, reach: instrument.reach,
        findingsRead: allFindings.length,
      })
    } else {
      // ⚠ REPORTED, NOT ASSUMED NEGATIVE. "We could not tell whether a power exists" is
      // not "no power exists", and defaulting to the second would quietly restore the
      // Bill as the assumed route — the exact error this question exists to catch.
      console.warn('[25b:research] instrument assessment failed', { reason: assessed.reason })
      if (outcomes.length) {
        outcomes[outcomes.length - 1].gaps.push({
          question: 'Does an existing power remove the need for primary legislation?',
          why: 'The check ran after the research and did not complete, so this is unresolved rather than answered no.',
        })
      }
    }
  }

  return {
    outcomes,
    usages,
    instrument,
    findings: allFindings,
    cited,
    summary: researchSummary(outcomes, instrument, cited),
    queries: [...queries.values()],
    stoppedEarly,
    stoppedReason,
  }
}

function failureSentence(o: Pick<QuestionOutcome, 'failure' | 'reviewed'>): string {
  switch (o.failure) {
    case 'search-broke': return 'The search for this question did not complete.'
    case 'corpus-silent': return 'The search ran and the corpus returned nothing on this.'
    case 'nothing-bore-on-it': return `${o.reviewed} sources were reviewed and none bore on this proposal.`
    case 'gather-failed': return 'Retrieval succeeded and the analysis step failed.'
    default: return ''
  }
}

/**
 * The carry passes 4 and 5 read. Prose, because both consumers are prompts.
 *
 * ⚠⚠ 25-F — THE FINDINGS THEMSELVES ARE NOW IN IT. See `CitedFinding` for the diagnosis;
 * in one sentence, this function used to emit counts and the revision pass was therefore
 * revising against arithmetic. The counts and the gaps are KEPT — "we reviewed 104 and
 * kept 12" and "still unanswered: …" are results in their own right and the §22 rule that
 * an unlooked-for gap must not read as an absence depends on them — but they now sit
 * BELOW the material rather than instead of it.
 *
 * ⚠ CONTRADICTIONS LEAD THE FINDINGS. A finding that cuts against the draft is the one the
 * revision can still act on, and burying it among fifty supporting ones is how pass 4
 * comes back with an empty `contradictions` list.
 */
const FINDING_BODY_CAP = parseInt(process.env.LEX_BUILD_FINDING_BODY_CAP ?? '700', 10)
const FINDINGS_IN_CARRY = parseInt(process.env.LEX_BUILD_FINDINGS_IN_CARRY ?? '45', 10)

function researchSummary(
  outcomes: QuestionOutcome[], instrument: InstrumentAssessment | null, cited: CitedFinding[],
): string {
  const lines: string[] = []

  // ⚠ THE INSTRUMENT VERDICT LEADS EVERYTHING (§4). A live power changes what the whole
  // proposal is, so it cannot be one bullet among nine.
  if (instrument?.powerFound) {
    lines.push(
      `⚠ AN EXISTING POWER MAY REMOVE THE NEED FOR PRIMARY LEGISLATION. ${instrument.provision} — ` +
      `${instrument.reachNote} This must be reconsidered before anything else in the revision.`,
      '',
    )
  }

  if (cited.length) {
    // Contradictions first, then everything else in the order the questions ran.
    const ordered = [
      ...cited.filter((f) => f.kind === 'CONTRADICTS'),
      ...cited.filter((f) => f.kind !== 'CONTRADICTS'),
    ]
    const shown = ordered.slice(0, FINDINGS_IN_CARRY)
    lines.push('═══ THE FINDINGS THEMSELVES ═══')
    lines.push(
      'Each of these came from a document that was actually retrieved. The citation is the source\'s',
      'own — use it, name the finding rather than the citation, and do not attach a citation to',
      'anything not listed here.',
      '',
    )
    for (const f of shown) {
      lines.push(
        `[${f.kind}] ${f.panelHeading} — ${f.title}`,
        `    ${f.body.replace(/\s+/g, ' ').slice(0, FINDING_BODY_CAP)}`,
        f.citation ? `    CITATION: ${f.citation}` : '    CITATION: (the source carried none)',
        '',
      )
    }
    if (ordered.length > shown.length) {
      // ⚠ NEVER A SILENT CAP. §17's rule: if a step bounds coverage, say what was dropped.
      lines.push(
        `⚠ ${ordered.length - shown.length} further finding${ordered.length - shown.length === 1 ? '' : 's'} `
        + 'were kept and are on the record but are not reproduced here, to keep this pass inside its '
        + 'output budget. They are in the evidence layer and the user can see them.',
        '',
      )
    }
  } else {
    lines.push('═══ THE FINDINGS THEMSELVES ═══', 'Nothing retrieved produced a finding. See the per-question account below.', '')
  }

  lines.push('═══ WHAT WAS ASKED, AND WHAT IS STILL UNANSWERED ═══')
  for (const o of outcomes) {
    if (o.failure) {
      lines.push(`${o.panelHeading}: ${failureSentence(o)}${o.retrievalNote ? ` ${o.retrievalNote}` : ''}`)
      continue
    }
    lines.push(
      `${o.panelHeading}: ${o.findings} finding${o.findings === 1 ? '' : 's'}` +
      `${o.contradictions ? `, ${o.contradictions} of which CONTRADICT the draft` : ''}` +
      `${o.siftLine ? ` — ${o.siftLine}` : ''}` +
      `${o.gaps.length ? ` Still unanswered: ${o.gaps.map((g) => g.question).join('; ')}` : ''}`,
    )
  }
  return lines.join('\n')
}
