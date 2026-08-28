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
import { positionsFor, findTargets, parseTarget, RANK_KEY_WORDING, type PositionTarget } from './positions'
import { configVersion } from './position-config'

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
  grounds: ClaimGround[]
  /** ⚠ COMPUTED FROM WHAT THE GRAPH REPORTED, never a written sentence (§5). */
  coverage: string
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

  return {
    question: {
      actorId: actor.actorId,
      actorName: actor.name,
      identityStatement: actor.identityStatement,
      identityCaveat: actor.identityCaveat,
      targetKey,
      questionText,
      grounds: actor.grounds.map((g) => ({
        what: g.targetLabel ?? `${g.targetType} ${g.targetId}`,
        date: g.date,
        signalType: g.signalType,
        sourceUrl: g.sourceUrl,
        direction: directionWord(g.direction),
      })),
      coverage,
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
 */
export async function findClaimTarget(
  terms: string,
): Promise<{ targets: PositionTarget[]; questionText: string } | null> {
  const query = terms.trim().slice(0, 200)
  if (query.length < 3) return null
  const found = await findTargets(query, 5)
  if (!found.length) return null
  const top = found[0]
  const parsed = parseTarget(`${top.type}:${top.id}`)
  if (!parsed) return null
  return {
    targets: [parsed],
    questionText: `Where does this member stand on “${top.label}”?`,
  }
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
