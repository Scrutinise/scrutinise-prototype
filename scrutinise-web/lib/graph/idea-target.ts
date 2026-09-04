// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 4 §1 — ONE RESOLVER, SO THE SCREEN AND THE DOCUMENT CANNOT DISAGREE.
//
// ══ ⚠⚠ WHAT THIS FIXES, MEASURED ═════════════════════════════════════════════
//
// SURFACE 3 shipped TWO paths from an idea to a position target and did not
// notice they were different:
//
//   · the CLAIM CARD (`findClaimTarget`) took ONE BLOB — problem + goalDetail —
//     with the title left out entirely;
//   · the DOCUMENT FILER (`filePositionsForIdea`) passed the TITLE SEPARATELY,
//     so title phrases outranked body phrases.
//
// **Measured on 25 of Charlie's ideas: they disagree on 4.** On *The Sentencing
// Council and sentencing guidelines*, *Civil Service Decision Paralysis* and
// both plastic-bag ideas, **the document carries positions and the clickable
// card says NOTHING.** That is the literal shape of Charlie's report — "Key
// people and groups shows up a couple but you can't click through": the names
// he can see come from the filed document rows, and the drillable beta card
// beside them resolved to no target at all.
//
// ⚠ It is my own defect from SURFACE 3, and it is the fault CLAUDE.md §26.5
// names exactly: a rule implemented twice is a rule that will be fixed once.
// So there is now one function, both callers import it, and
// `check-surface-4.ts` asserts over every live idea that the two paths return
// the identical target — with a control that plants a divergence.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { getNeonPool } from '@/lib/pg-pool'
import { extractPhrasesFrom } from './phrases'
import { findTargetsByPhrases, parseTarget, type PositionTarget } from './positions'

export interface IdeaTarget {
  target: PositionTarget
  /** The division or motion's own title, for printing. */
  label: string
  /** ⚠ The phrase from the proposal that matched, carried out so a surface can SHOW it. */
  matchedPhrase: string
  matchedWords: number
  /** ⚠ Words in it that name something — the ranking number. */
  matchedContentWords: number
  /** TRUE when the phrase came from the proposal's own title rather than its body. */
  fromTitle: boolean
  /** `division` | `edm`. Carried because the two behave very differently — see the note below. */
  targetType: string
}

/**
 * The proposal's own words → the one thing to ask the graph about.
 *
 * ⚠ THE TITLE IS PASSED SEPARATELY AND THAT IS THE WHOLE POINT. A phrase the proposer put in
 * their own title outranks one found in the body, because nothing lexical can tell a central
 * subject from a passing mention and a title is a human's own summary. Concatenating them —
 * which is what the claim card did — throws that signal away silently.
 */
export async function targetForText(title: string, body: string): Promise<IdeaTarget | null> {
  const phrases = extractPhrasesFrom(title ?? '', body ?? '')
  if (!phrases.length) return null
  const found = await findTargetsByPhrases(phrases, 1)
  if (!found.length) return null
  const top = found[0]
  const parsed = parseTarget(`${top.type}:${top.id}`)
  if (!parsed) return null
  return {
    target: parsed,
    label: top.label,
    matchedPhrase: top.matchedPhrase,
    matchedWords: top.matchedWords,
    matchedContentWords: top.matchedContentWords,
    fromTitle: top.fromTitle,
    targetType: top.type,
  }
}

/**
 * The same, for an idea.
 *
 * ⚠ ONE QUERY SHAPE, ONE SOURCE OF TEXT. Every caller that resolves an idea to a target goes
 * through here, so "which fields does the matcher read" has exactly one answer.
 */
export async function targetForIdea(ideaId: string): Promise<IdeaTarget | null> {
  const [idea, el] = await Promise.all([
    prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } }),
    prisma.ideaElicitation.findUnique({
      where: { ideaId }, select: { problem: true, goalDetail: true },
    }),
  ])
  return targetForText(
    idea?.title ?? '',
    `${el?.problem ?? ''} ${el?.goalDetail ?? ''}`.trim(),
  )
}

/**
 * ══ ⚠⚠ WHAT A TARGET OF EACH KIND CAN POSSIBLY YIELD, STATED RATHER THAN LEFT TO BE INFERRED ══
 *
 * Measured across Charlie's ideas, and it is the second half of "shows up a couple":
 *
 *   · a DIVISION target returns 189–254 actors, one recorded act each;
 *   · an EDM target returns **exactly ONE actor**, always.
 *
 * The reason is not the graph and not the matcher. **`edm_sponsor` holds one row per motion —
 * 60,995 rows over 60,995 motions, 1.00 per motion — so what we hold is the motion's PRIMARY
 * SPONSOR, not its signatories.** An Early Day Motion's whole evidential value is the list of
 * members who signed it; we hold the member who tabled it.
 *
 * ⚠ This also corrects SURFACE 3's own coverage wording, which called the layer "signatures on
 * Early Day Motions". It is sponsorships. That sentence is fixed in `position-coverage.ts`.
 */
export function whatThisTargetCanYield(targetType: string): string {
  return targetType === 'edm'
    ? 'This is an Early Day Motion, and for motions we hold only the member who tabled it — not '
      + 'the members who signed it. So one name here is the most this can ever show, and it is a '
      + 'limit of what we hold rather than a measure of who cared.'
    : 'This is a recorded division, so everyone who voted is here.'
}

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 4 §2 — WHY AN IDEA SHOWS NOTHING, IN THE USER'S OWN TERMS.
//
// ⚠⚠ "An empty panel is the failure mode this platform exists to avoid." Measured over the 83
// live ideas: 44 find a target and 39 do not. Of those 39, **6 name something Parliament has
// demonstrably debated** — the phrase appears in the debate record — **and 33 match nothing
// anywhere**, most of those being untitled or scratch drafts.
//
// ⚠ The distinction matters because the honest sentence differs completely. "Parliament has
// debated this and we hold no division on it" is a statement about OUR RECORD. "Nothing we hold
// mentions this at all" is a statement about the SUBJECT, and may mean the proposal is about
// something too new or too local for the record — which is a fact about the idea worth knowing
// and not a failure of the feature.
//
// ⚠ THE THIRD CASE IS THE DESIGN, NOT A GAP. The graph holds positions toward CONCRETE THINGS —
// a division, a motion, an inquiry, an organisation — never toward a topic. An idea that names
// no concrete thing has nothing to be matched against, by design, and the surface says so rather
// than looking broken.
// ─────────────────────────────────────────────────────────────────────────────

export type NoTargetReason = 'no-phrases' | 'debated-but-no-division' | 'nothing-anywhere'

export interface NoTargetExplanation {
  reason: NoTargetReason
  /** What to put on the screen. ⚠ It never says "no results". */
  text: string
}

/**
 * Why this idea resolved to nothing, in ordinary words.
 *
 * ⚠ THE CHEAP TEST FIRST AND THE EXPENSIVE ONE ONLY IF NEEDED. Deciding between "Parliament has
 * debated this" and "nothing anywhere" costs a scan of several million titles, so it is asked
 * only when the answer changes what the user is told — and it is bounded by a statement timeout,
 * because an audit that can hang is an audit that will.
 */
export async function explainNoTarget(
  title: string, body: string,
): Promise<NoTargetExplanation> {
  const phrases = extractPhrasesFrom(title ?? '', body ?? '')
  if (!phrases.length) {
    return {
      reason: 'no-phrases',
      text: 'This proposal does not yet name anything concrete enough for us to look up. The '
        + 'record we hold is of specific things — a division, a motion, an inquiry, an '
        + 'organisation — never of topics, so there is nothing here to match against yet. Adding '
        + 'the name of a Bill, an Act or a body would give us something to search for.',
    }
  }
  const debated = await phraseAppearsInDebateRecord(phrases.slice(0, 3).map((p) => p.text))
  if (debated) {
    return {
      reason: 'debated-but-no-division',
      text: 'Parliament has discussed this subject — we can find it in the debate record — but we '
        + 'hold no division or motion on it that we can attribute to named members. That is a gap '
        + 'in what we hold, not a sign that nobody has taken a position.',
    }
  }
  return {
    reason: 'nothing-anywhere',
    // ⚠⚠ NO DATE AND NO COUNT IN THIS SENTENCE. A first draft read "our Commons division record
    // begins in March 2016 and we hold no signatures on Early Day Motions at all" — two figures
    // about the graph, written down, in a file no check was grepping. That is precisely the rule
    // SURFACE 3 §1a exists to enforce, broken by the person who wrote it, one sprint later.
    // The window and the missing layers are stated by the coverage block, which renders directly
    // beneath this on the empty path and is generated from live state on every call.
    text: 'Nothing in the record we hold mentions this subject, so we have nobody to show. A '
      + 'subject can be entirely absent here and well established in Parliament — what we hold '
      + 'and what does not reach it is set out just below. This is a statement about our '
      + 'coverage, not about your proposal.',
  }
}

/** ⚠ Bounded. A scan of the debate corpora is expensive; a timeout returns false rather than hanging. */
async function phraseAppearsInDebateRecord(texts: string[]): Promise<boolean> {
  if (!texts.length) return false
  const pool = getNeonPool()
  const client = await pool.connect()
  try {
    await client.query(`SET LOCAL statement_timeout = '8s'`)
    const { rows } = await client.query<{ n: string }>(`
      SELECT COUNT(*)::bigint n
        FROM unnest($1::text[]) AS p(t)
        JOIN LATERAL (
          SELECT 1 FROM corpus_sections c
           WHERE c.corpus = ANY($2::text[])
             AND c."sectionTitle" ILIKE '%' || p.t || '%'
           LIMIT 1
        ) hit ON TRUE`, [texts, DEBATE_CORPORA])
    return Number(rows[0]?.n ?? 0) > 0
  } catch {
    // ⚠ A TIMEOUT IS NOT A "NO". It is reported as the weaker claim, which is the safe direction:
    // saying "nothing anywhere" on a query that did not finish would be a confident wrong answer.
    return false
  } finally {
    client.release()
  }
}

/**
 * ⚠ The corpora the debate record actually lives in, read off the database rather than guessed.
 * An earlier audit asked for 'debates' and 'commons-debates', WHICH DO NOT EXIST, and cheerfully
 * reported "0 discussed elsewhere" — a wrong question answered with confidence.
 */
const DEBATE_CORPORA = [
  'pwdata-debates', 'pwdata-lords', 'pwdata-westminster', 'historic-hansard',
]
