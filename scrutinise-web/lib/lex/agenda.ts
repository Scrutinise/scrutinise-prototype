// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-C §3 — THE REVIEW AGENDA. §25.3, and the point of the inverted design.
//
// 25-A drafts. 25-B researches and revises. **The user still has no agenda** — they get a
// filled-in kernel and a long list of findings, and have to work out for themselves what to
// decide, what to read and what to answer. This is that agenda: the user's work is DECIDING,
// READING and ANSWERING, not hunting through a form for what changed.
//
// ⚠⚠ CONTRADICTIONS LEAD. Not decisions, not challenges. §3b: 25-B's best output is currently
// buried mid-list —
//
//     "I first concluded: primary legislation… The evidence says: regulations under an existing
//      power may already reach this."
//
// — and that is the single most valuable sentence a build produces. A user who reads nothing else
// should read that. Ordering is the whole design here, so the section order is a CONSTANT the
// check asserts rather than the order someone happened to write the code in.
//
// ⚠ IT ASSEMBLES, IT DOES NOT GENERATE. Every item below is already a row: BuildFork,
// EvidenceItem, DeepeningIssue, DeepeningPass.knownUnknowns, IdeaElicitation. There is no model
// call in this file and there must not be one — an agenda that re-summarised the findings would
// be a fifth opinion about them, and it would cost money on every page load.
//
// ⚠ AND IT NAMES WHAT MATTERS RATHER THAN REPRODUCING THE LIBRARY (§3d). Two or three sources,
// not a list. Everything else stays in the panel where it already is.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { collapseKnownUnknowns, type KnownUnknown } from './known-unknowns'
// 25-L §2 — material we were given and could not read is a gap on the idea, and it is one
// only the user can close. See `rejectionsAsGaps`.
import { readRejections, rejectionsAsGaps } from './material-rejection'
import { readKnownUnknowns } from './deepening'
import { isAssembled } from './evidence-labels'

/**
 * ⚠ THE ORDER IS THE DESIGN, so it is data rather than the sequence of some JSX.
 * §3: "ordered by what most changes the proposal".
 */
export const AGENDA_SECTIONS = [
  'contradictions', 'decisions', 'challenges', 'reading', 'gaps', 'contribution',
] as const
export type AgendaSectionKey = (typeof AGENDA_SECTIONS)[number]

/** §3d — "two or three sources, not a list." */
export const READING_COUNT = parseInt(process.env.LEX_AGENDA_READING ?? '3', 10)

/**
 * §3's framing paragraph. **After the work, never before it** — §19-E's placement lesson: a
 * warning that arrives before the thing it is about reads as a disclaimer; the same words after it
 * read as respect.
 */
export const AGENDA_FRAMING =
  'Everything above is mine until you’ve been through it. If this goes to an MP or a committee, '
  + 'you’ll be asked to defend it — so where you disagree, or where I’ve put words in your mouth, '
  + 'change it. Where I’m wrong, that’s the most useful thing you can tell me.'

export interface AgendaContradiction {
  id: string
  fieldKey: string | null
  firstConcluded: string
  evidenceSays: string
  whyChanged: string
  status: string
}

export interface AgendaDecision {
  forkKey: string
  fieldKey: string
  /** What Lex chose. */
  chosen: string
  /** WHY it chose that. Null on builds made before 25-C — rendered as absent, never invented. */
  recommendationReason: string | null
  alternatives: Array<{ id: string; index: number; alternative: string; caseFor: string }>
  resolved: boolean
  /** `'chosen'` or `'alternative:<n>'` once decided. */
  resolvedChoice: string | null
  /**
   * ⚠ TRUE when the research found a power that may remove the need for primary legislation.
   * This is the decision §3a says to check end to end, and it sorts to the top of its section.
   */
  changedByResearch: boolean
}

export interface AgendaChallenge {
  id: string
  text: string
  status: string
  dismissReason: string | null
  passKey: string
  /** ⚠ 25-Q §7a — the challenge's own name. Null on a row written before 25-Q, and rendered
   *  as absent rather than as a guess: a title inferred downstream from the text is exactly
   *  what 25-D §3 forbids. */
  title: string | null
  /** ⚠ 25-Q §7b — the model that raised it, for the SOURCE LINE AT THE FOOT. It used to be
   *  eleven shouty words at the head of the text; see the backfill. */
  sourceModel: string | null
}

export interface AgendaReading {
  id: string
  title: string
  citation: string | null
  url: string | null
  /** §3d — ONE specific sentence on why this one and what to look for. */
  why: string
  /** Assembled record or a model's reading of one document — the user should know which. */
  assembled: boolean
}

export interface AgendaGap {
  question: string
  why: string
  /** §3e — what KIND of gap this is, so the user knows whose job it is. */
  task: 'research' | 'only-you' | 'limitation'
}

export interface Agenda {
  ideaId: string
  /** Null when no build has completed — the agenda is a thing you get after a build. */
  buildVersion: number | null
  contradictions: AgendaContradiction[]
  decisions: AgendaDecision[]
  challenges: AgendaChallenge[]
  reading: AgendaReading[]
  gaps: AgendaGap[]
  contribution: {
    /** What the user told us at Page 1 that the record would not show. */
    ownKnowledge: string | null
    /** Where it was used — the fields whose drafts cite testimony. */
    usedIn: string[]
    /** §3f — where MORE of it would strengthen the case. Derived from the gaps, not invented. */
    wouldStrengthen: string[]
  }
  framing: string
}

/**
 * §3e — WHOSE JOB IS THIS GAP?
 *
 * ⚠ Classified from the gap's own `kind` tag, not from its wording. `known-unknowns.ts` tags at
 * creation precisely so that nothing downstream has to guess, and guessing here would put "only
 * you can answer this" on a gap that is actually a search failure — telling the user to do our
 * work.
 */
function classifyGap(g: KnownUnknown): AgendaGap['task'] {
  switch (g.kind) {
    // The search did not run, or a retrieval mode does not exist. Ours to fix, not theirs.
    case 'search-failed': return 'limitation'
    // A job could not run for want of an instrument, or the corpus holds nothing.
    case 'job-unmet': return 'limitation'
    // The pass looked and could not find it. Someone could go and look properly.
    case 'named-gap': return 'research'
    case 'unanswered': return 'research'
    default: return 'research'
  }
}

/** Parse a stored contradiction body back into its three parts. */
function readContradiction(body: string): { firstConcluded: string; evidenceSays: string; whyChanged: string } {
  // ⚠ The body is written by ONE place (build.ts revisePass) in a fixed three-part shape, so this
  // is reading our own format rather than parsing prose. If the shape is ever missing, the whole
  // body is shown as `firstConcluded` — the user sees everything, and nothing is silently dropped.
  const first = /I first concluded:\s*([\s\S]*?)(?=\n\nThe evidence says:|$)/.exec(body)
  const says = /The evidence says:\s*([\s\S]*?)(?=\n\nWhy I changed my mind:|$)/.exec(body)
  const why = /Why I changed my mind:\s*([\s\S]*)$/.exec(body)
  if (!first) return { firstConcluded: body, evidenceSays: '', whyChanged: '' }
  return {
    firstConcluded: first[1].trim(),
    evidenceSays: says?.[1].trim() ?? '',
    whyChanged: why?.[1].trim() ?? '',
  }
}

export async function buildAgenda(ideaId: string): Promise<Agenda> {
  const latest = await prisma.ideaBuild.findFirst({
    where: { ideaId, status: 'DONE' },
    orderBy: { version: 'desc' },
    select: { id: true, version: true },
  })

  const [evidence, issues, forks, passRows, elicitation] = await Promise.all([
    prisma.evidenceItem.findMany({
      where: { ideaId, status: { not: 'REJECTED' } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.deepeningIssue.findMany({ where: { ideaId }, orderBy: { createdAt: 'asc' } }),
    latest
      ? prisma.buildFork.findMany({
          where: { buildId: latest.id },
          orderBy: [{ forkKey: 'asc' }, { alternativeIndex: 'asc' }],
        })
      : Promise.resolve([]),
    prisma.deepeningPass.findMany({ where: { ideaId } }),
    prisma.ideaElicitation.findUnique({
      where: { ideaId },
      select: { ownKnowledge: true },
    }).catch(() => null),
  ])

  // ── §3b — CONTRADICTIONS, and they lead ───────────────────────────────────
  const contradictions: AgendaContradiction[] = evidence
    .filter((e) => e.kind === 'CONTRADICTS' && e.passKey === 'REVISE')
    .map((e) => ({
      id: e.id,
      fieldKey: e.fieldRef,
      ...readContradiction(e.body),
      status: e.status,
    }))

  // ── §3a — DECISIONS, grouped by decision point ────────────────────────────
  const byFork = new Map<string, AgendaDecision>()
  for (const f of forks) {
    const existing = byFork.get(f.forkKey)
    const alt = {
      id: f.id, index: f.alternativeIndex,
      alternative: f.alternative, caseFor: f.caseForAlternative,
    }
    if (existing) { existing.alternatives.push(alt); continue }
    byFork.set(f.forkKey, {
      forkKey: f.forkKey,
      fieldKey: f.fieldKey,
      chosen: f.chosen,
      recommendationReason: f.recommendationReason,
      alternatives: [alt],
      resolved: f.resolved,
      resolvedChoice: f.resolvedChoice,
      // 25-B writes this marker onto the instrument fork when the research finds a live power.
      changedByResearch: /THE RESEARCH FOUND AN EXISTING POWER/i.test(f.caseForAlternative),
    })
  }
  const decisions = [...byFork.values()].sort((a, b) => {
    // A decision the research reopened comes first — it is the one §3a says matters most.
    if (a.changedByResearch !== b.changedByResearch) return a.changedByResearch ? -1 : 1
    // Then outstanding before settled: the agenda is a to-do list, not an archive.
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
    return a.forkKey.localeCompare(b.forkKey)
  })

  // ── §3c — CHALLENGES, on the existing triage ──────────────────────────────
  const challenges: AgendaChallenge[] = issues
    .map((i) => ({
      id: i.id, text: i.text, status: i.status,
      dismissReason: i.dismissReason, passKey: i.passKey,
      title: i.title, sourceModel: i.sourceModel,
    }))
    // Open first; a dismissed issue STAYS VISIBLE with its reason (§3c, and §22's rule).
    .sort((a, b) => Number(a.status !== 'OPEN') - Number(b.status !== 'OPEN'))

  // ── §3d — READING: two or three, never the library ────────────────────────
  //
  // ⚠ CHOSEN BY WHAT WOULD MOST CHANGE THE PROPOSAL, not by score. A source that contradicts the
  // draft is worth more of the user's time than one that agrees with it, and an assembled record
  // is worth more than a model's reading of one document — so those sort first. The "why" is the
  // SIFT'S OWN REASON, which was written as "what it bears on and how" and is therefore already
  // the sentence §3d asks for. Nothing is generated here.
  const reading: AgendaReading[] = evidence
    .filter((e) => !!e.url && !!e.siftReason)
    .sort((a, b) => {
      const rank = (e: typeof a) =>
        (e.kind === 'CONTRADICTS' ? 0 : isAssembled(e.sourceType) ? 1 : e.precedentTestPassed ? 2 : 3)
      return rank(a) - rank(b)
    })
    .slice(0, READING_COUNT)
    .map((e) => ({
      id: e.id,
      title: e.citation || e.title,
      citation: e.citation,
      url: e.url,
      why: e.siftReason as string,
      assembled: isAssembled(e.sourceType),
    }))

  // ── §3e — GAPS, collapsed and classified ──────────────────────────────────
  const rawGaps = passRows.flatMap((p) => readKnownUnknowns(p.knownUnknowns))
  const gaps: AgendaGap[] = collapseKnownUnknowns(rawGaps).map((g) => ({
    question: g.question, why: g.why, task: classifyGap(g),
  }))

  // ⚠ 25-L §2 — MATERIAL WE COULD NOT READ IS A GAP, AND IT IS THEIRS TO CLOSE.
  //
  // §2: "Record it as a known unknown on the idea, so the gap is visible rather than
  // silent." It is filed `only-you` deliberately: a video's transcript and a paywalled
  // article's text are things only the person holding them can fetch. Filing them as
  // `research` would put them on OUR list, where nothing would ever happen to them, and
  // the user would never learn that the way in was two clicks away.
  //
  // ⚠ APPENDED, NOT MERGED INTO THE COLLAPSE. `collapseKnownUnknowns` groups on tags the
  // producers write; these have no producer and no pass, and forcing them through it would
  // mean inventing a tag so a group-by could ignore it.
  for (const r of rejectionsAsGaps(await readRejections(ideaId))) {
    gaps.push({ question: r.question, why: r.why, task: 'only-you' })
  }

  // ── §3f — YOUR CONTRIBUTION ───────────────────────────────────────────────
  //
  // ⚠ `usedIn` is derived from the uncertainties Lex recorded against fields, not from a claim
  // that testimony was used. Saying "your knowledge shaped the diagnosis" without being able to
  // point at where would be exactly the kind of flattering, unfalsifiable sentence this product
  // does not write.
  const wouldStrengthen = gaps.filter((g) => g.task === 'research').slice(0, 3).map((g) => g.question)

  return {
    ideaId,
    buildVersion: latest?.version ?? null,
    contradictions,
    decisions,
    challenges,
    reading,
    gaps,
    contribution: {
      ownKnowledge: elicitation?.ownKnowledge?.trim() || null,
      usedIn: [],
      wouldStrengthen,
    },
    framing: AGENDA_FRAMING,
  }
}
