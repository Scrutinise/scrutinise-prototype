// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-L §5 (as amended) — VALIDATE THE GRAPH WITH USERS, BLIND FIRST.
//
// ⚠⚠ THE ORDER IS THE MEASUREMENT, AND IT IS THE ONLY REASON THIS FILE EXISTS.
//
//     "Our assessment is not shown until they have. Showing it first buys agreement,
//      not information."
//
// So the read that builds the question CANNOT CARRY OUR ANSWER. Not hidden in a field the
// client is trusted not to render, not greyed out behind a CSS class — absent from the
// response. A client-side reveal is one `view-source` away from being no experiment at all,
// and worse, it would look like one in every report we wrote afterwards.
//
// ⚠ FACTS ARE NEVER GATED. §5: "The votes and contributions are public record and visible
// to everyone. Only our inferred position waits behind the user's own judgement." So
// `grounds` — what the member did, when, and the link to it — go out with the question.
// The user is being asked to read the record and judge it, which they cannot do without it.
//
// ⚠⚠ THIS IS CORROBORATION, NOT VERIFICATION. Nothing a user says here overwrites a sourced
// record. A disagreement raises a flag for review, and the agreement rate is a measure of
// the graph's quality that must never be read as proof: a partisan sample agrees with
// itself, and a run of agreements from six people who share a view is six people sharing a
// view. That caveat is computed and returned with the rate rather than left to a reader to
// remember.
//
// ⚠ AND BETA MEANS INCOMPLETE, NOT UNRELIABLE. Coverage may be partial and every gap is
// stated. Every individual claim must still be TRUE and SOURCED — a beta label does not
// license a wrong fact, and on a scrutiny platform that distinction is load-bearing.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import {
  positionsFor, findTargetsByPhrases, parseTarget, RANK_KEY_WORDING, type PositionTarget,
} from './positions'
import { configVersion } from './position-config'
import { getPositionCoverage, coverageSentences } from './position-coverage'
import { targetForIdea, whatThisTargetCanYield } from './idea-target'

export type UserVerdict = 'supports' | 'opposes' | 'unclear' | 'not-enough'

export const USER_VERDICTS: UserVerdict[] = ['supports', 'opposes', 'unclear', 'not-enough']

export function isUserVerdict(v: unknown): v is UserVerdict {
  return typeof v === 'string' && (USER_VERDICTS as string[]).includes(v)
}

/** §5's invitation, verbatim, in one place so the screen and the check cannot drift. */
export const BETA_INVITATION =
  'Help us test this. We’re building a picture of where people stand on issues like yours, and '
  + 'it’s new. Take a look at one and tell us what you think before we show you what we found — '
  + 'that’s the most useful thing you can do with it right now.'

/**
 * One sourced thing a member did. This is what the user reads BEFORE judging.
 *
 * ⚠ EVERY FIELD HERE IS A FACT WITH A LINK. There is no room in this shape for a score, a
 * stance or a confidence, and that is deliberate: a type that cannot express our assessment
 * cannot leak it.
 */
export interface ClaimGround {
  what: string
  date: string
  signalType: string
  sourceUrl: string | null
  /** How the member acted, in words a non-specialist reads: 'for', 'against', 'took part'. */
  direction: 'for' | 'against' | 'took part'
}

/** The question, with the record, and NOT our answer. */
export interface ClaimQuestion {
  actorId: string
  actorName: string
  /** 'Stable external key' etc. — how well we know who this is. Shown, never hidden. */
  identityStatement: string
  identityCaveat: string | null
  targetKey: string
  questionText: string
  /**
   * ⚠ SURFACE 3 §2 — HOW WE GOT HERE FROM THE USER'S OWN WORDS, and how good that match is.
   * Null when the caller supplied the target explicitly (the admin path), where there is no
   * matching step to disclose.
   */
  matchBasis: string | null
  grounds: ClaimGround[]
  /** ⚠ COMPUTED FROM WHAT THE GRAPH REPORTED, never a written sentence (§5). */
  coverage: string
  /**
   * ══ SURFACE 3 §1 — WHAT THIS ANSWER COULD NOT SEE ═══════════════════════════════════════════
   *
   * ⚠⚠ THE COUNT ABOVE IS TRUE AND, ON ITS OWN, MISLEADING. *"1 person has a record here"* invites
   * the reader to conclude that nobody else took a position; what it actually reflects is that our
   * Commons division record begins in 2016 and that two whole signal types have no source data at
   * all. A silent gap reads as "nobody has a position", which is the exact opposite of the truth.
   *
   * ⚠ GENERATED FROM LIVE STATE ON EVERY CALL, never a hardcoded sentence — `position-coverage.ts`
   * holds the queries and `check-surface-3.ts` fails the build if a figure about the graph appears
   * in a string there. This field is the SAME object the generated document prints, so the screen
   * and the printed report cannot drift apart.
   */
  coverageNotes: string[]
  /**
   * ══ ⚠⚠ SURFACE 4 — WHY THIS PERSON AND NOT ONE OF THE OTHER 253 ═══════════════════════════
   *
   * `positionsFor()` has computed this since GRAPH 3B and BOTH of my SURFACE 3 assemblers threw
   * it away. Measured on Charlie's *Human Rights Act 1998* idea: 254 actors matched, 12 tied at
   * the top, `shownOrderIsNameOrderOnly = true`, and the note the graph produced reads
   * *"5 of 254 actors, tied at this confidence (0.394, 1 signal) — ordered by name. This is not
   * a ranking."*
   *
   * ⚠ Without it the surface presents an ALPHABETICAL SLICE as though it were the significant
   * people. That is the exact failure `Ranking` was built to prevent — `/admin/positions` once
   * said "showing the top 40" over a list in name order — and it is the third time this thread
   * has had correct data computed and then dropped by the layer that assembles the output.
   */
  ranking: { note: string | null; ofMatched: number; shown: number; key: string }
}

/** Our answer, released only after the user has given theirs. */
export interface ClaimAssessment {
  stance: string
  claim: string
  claimCaveat: string | null
  confidence: number
  confidenceWording: string
  configVersion: string | null
  /** What the ranking means, printed verbatim — an order nobody can read is not a result. */
  rankKey: string
}

function directionWord(d: number): ClaimGround['direction'] {
  if (d > 0) return 'for'
  if (d < 0) return 'against'
  // ⚠ ZERO IS "TOOK PART", NOT "NEUTRAL". An inquiry appearance or a committee membership
  // carries no direction at all; calling it neutral would assert a position we have not
  // observed, which is the never-claim rule applied to a number.
  return 'took part'
}

/**
 * Everything about one actor on one set of targets, split into what the user may see now and
 * what they may see after judging.
 *
 * ⚠ THE SPLIT HAPPENS HERE, ON THE SERVER, AND THE TWO HALVES ARE RETURNED SEPARATELY so a
 * route can hand back one without the other. A single object with a "don't render this yet"
 * flag is the version that leaks.
 */
export async function claimFor(
  targets: PositionTarget[],
  actorId: string | null,
  questionText: string,
  /** SURFACE 3 §2 — the disclosure from `matchBasis()`, where the target came from a text match. */
  basis: string | null = null,
): Promise<{ question: ClaimQuestion; assessment: ClaimAssessment } | null> {
  const result = await positionsFor(targets, { limit: 25, actorKind: 'person', maxGroundsPerActor: 12 })
  const actor = actorId
    ? result.actors.find((a) => a.actorId === actorId)
    : result.actors[0]
  if (!actor) return null

  const targetKey = targets.map((t) => `${t.type}:${t.id}`).join(',')

  // ⚠ COVERAGE IS COMPUTED FROM WHAT CAME BACK (§5), never a sentence somebody wrote once.
  // "We hold a partial picture" would be true on the day it was typed and unfalsifiable
  // afterwards; this changes when the graph does.
  const noSignal = result.targetsWithNoSignals.length
  const coverage = [
    `Built from ${actor.signalCount} recorded action${actor.signalCount === 1 ? '' : 's'}`,
    `across ${targets.length} question${targets.length === 1 ? '' : 's'}`,
    noSignal ? `. ${noSignal} of those returned nothing at all` : '',
    `. ${result.actorsMatched} ${result.actorsMatched === 1 ? 'person has' : 'people have'} a record here.`,
  ].join(' ').replace(/\s+\./g, '.')

  // ⚠ SURFACE 3 §1. `used` is what ACTUALLY contributed to the answer being shown, merged across
  // the actors on screen — so "searched and found nothing" is a statement about this question and
  // not a guess. Passing nothing here would report every signal type as unused, which is the
  // flattering direction to be wrong in and therefore the one to rule out.
  const used: Record<string, { n: number }> = {}
  for (const a of result.actors) {
    for (const [k, v] of Object.entries(a.signalCounts)) used[k] = { n: (used[k]?.n ?? 0) + v.n }
  }
  const coverageNotes = coverageSentences(await getPositionCoverage({ used }))

  return {
    question: {
      // ⚠ SURFACE 4 — carried, not recomputed. The graph decides what its own order means.
      ranking: {
        note: result.ranking.note,
        ofMatched: result.ranking.ofMatched,
        shown: 1,
        key: result.ranking.key,
      },
      actorId: actor.actorId,
      actorName: actor.name,
      identityStatement: actor.identityStatement,
      identityCaveat: actor.identityCaveat,
      targetKey,
      questionText,
      matchBasis: basis,
      grounds: actor.grounds.map((g) => ({
        what: g.targetLabel ?? `${g.targetType} ${g.targetId}`,
        date: g.date,
        signalType: g.signalType,
        sourceUrl: g.sourceUrl,
        direction: directionWord(g.direction),
      })),
      coverage,
      coverageNotes,
    },
    assessment: {
      stance: actor.stanceWording,
      claim: actor.claim,
      claimCaveat: actor.claimCaveat,
      confidence: actor.confidence,
      confidenceWording: actor.confidenceWording,
      configVersion: result.configVersion ?? configVersion(),
      rankKey: RANK_KEY_WORDING,
    },
  }
}

/**
 * Find something worth asking about, from the words of an idea.
 *
 * ⚠ IT RETURNS NULL RATHER THAN A WEAK MATCH. §5's whole premise is that every claim shown
 * is true and sourced; offering a division that has nothing to do with the user's subject
 * would collect judgements about our search rather than about the graph, and the agreement
 * rate would then be measuring the wrong thing entirely.
 *
 * ══ ⚠⚠ SURFACE 3 §2 — REWRITTEN, BECAUSE IT RETURNED NULL ON EVERY IDEA IN THE DATABASE ═══════
 *
 * The old body passed the user's whole problem statement to `findTargets`, which runs
 * `title ILIKE '%' || $1 || '%'`. That is a substring match of the ENTIRE 200-character
 * statement against a division title, and it can only succeed if the statement appears verbatim
 * inside one. **Measured before this was touched: NO TARGET on all twelve live ideas, and the
 * title control found nothing on eight of eight.** 25-Z reported it on one idea; it was universal,
 * and it meant the positions surface had rendered nothing for anybody since it shipped.
 *
 * ⚠⚠ AND THE WORD-LEVEL FIX WAS MEASURED AND REJECTED — see `phrases.ts`. It produced
 * *Shoemakers Museum shortlisted for Permanent Exhibition* for "permanent", which is a real
 * division a real member really voted in, presented under a proposal about the civil service.
 * Weak matches here do not degrade the feature; they poison the measurement it exists to collect.
 *
 * ⚠ SO THE MATCHED PHRASE COMES BACK WITH THE TARGET AND IS SHOWN. The bar is two words of the
 * user's own subject; that is a real bar and it is not a high one, and the honest response to a
 * bar that is not high is to print what was matched so a reader can tell us it was wrong. 25-L
 * already built the verdict for exactly this — "Not enough here", whose header says it is the
 * signal that "our coverage, not the member, is the problem".
 */
export async function findClaimTarget(
  ideaId: string,
): Promise<{
  targets: PositionTarget[]
  questionText: string
  matchedPhrase: string
  matchedWords: number
  targetType: string
} | null> {
  // ⚠⚠ SURFACE 4 — IT TAKES AN ideaId AND CALLS THE SHARED RESOLVER, and both of those are the
  // fix. It used to take a text blob assembled by the caller, WITHOUT THE TITLE, while the
  // document filer passed the title separately — and the two disagreed on 4 of 25 of Charlie's
  // ideas, every one of them in the direction where the document shows positions and this card
  // shows nothing. See `idea-target.ts` for the measurement.
  const found = await targetForIdea(ideaId)
  if (!found) return null
  return {
    targets: [found.target],
    questionText: `Where does this member stand on “${found.label}”?`,
    matchedPhrase: found.matchedPhrase,
    matchedWords: found.matchedWords,
    targetType: found.targetType,
  }
}

/**
 * How the target was arrived at, in ordinary words, for printing beside the question.
 *
 * ⚠ IT NAMES THE WEAKNESS WHERE THERE IS ONE. A two-word match is the floor, and a floor that is
 * not disclosed is a floor a reader assumes is a ceiling. Composed from the match, never written
 * down as a fixed sentence.
 */
export function matchBasis(
  matchedPhrase: string, matchedWords: number, targetType?: string,
): string {
  const strength = matchedWords >= 3
    ? 'That is a close match to your subject.'
    : 'That is a loose match — only two words of your subject — so it may not be the right question '
      + 'at all. If it is not, “Not enough here” is the useful answer.'
  // ⚠ SURFACE 4 — AND WHAT THIS KIND OF TARGET CAN POSSIBLY SHOW. One name under a motion is
  // not a thin result; it is the most a motion can ever give us, because we hold the sponsor and
  // not the signatories. Saying so is the difference between a limit and an apparent failure.
  const kind = targetType ? ` ${whatThisTargetCanYield(targetType)}` : ''
  return `We picked this by matching the phrase “${matchedPhrase}” from your own words against the `
    + `titles of divisions and motions we hold. ${strength}${kind}`
}

/**
 * The agreement rate, with the caveat that must travel with it.
 *
 * ⚠⚠ THE CAVEAT IS RETURNED, NOT DOCUMENTED. §5: "do not let a run of agreements be read as
 * proof — a partisan sample agrees with itself." A number printed alone will be quoted alone,
 * and the sentence that makes it honest has to be attached to it at the point it is
 * produced, not left in a brief nobody re-reads.
 *
 * ⚠ AND THE DENOMINATOR IS ANSWERED JUDGEMENTS, NOT ALL OF THEM. A user who judged and then
 * closed the tab before the reveal has told us nothing about agreement, and counting them as
 * a disagreement would make the rate a measure of how many people finish a form.
 */
export async function agreementRate(): Promise<{
  answered: number
  agreed: number
  rate: number | null
  judges: number
  caveat: string
}> {
  const rows = await prisma.graphClaimJudgement.findMany({
    where: { agreed: { not: null } },
    select: { agreed: true, userId: true },
  })
  const answered = rows.length
  const agreed = rows.filter((r) => r.agreed).length
  const judges = new Set(rows.map((r) => r.userId)).size
  return {
    answered,
    agreed,
    rate: answered ? agreed / answered : null,
    judges,
    caveat: answered
      ? `${answered} judgement${answered === 1 ? '' : 's'} from ${judges} `
        + `${judges === 1 ? 'person' : 'people'}. This is corroboration, not verification: a user’s `
        + 'judgement never overwrites the sourced record, and a run of agreements is not proof — '
        + 'a partisan sample agrees with itself.'
      : 'Nobody has judged a claim yet, so there is no rate. That is an absence of evidence '
        + 'about the graph, not evidence that it is right.',
  }
}
