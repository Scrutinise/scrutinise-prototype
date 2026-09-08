// ─────────────────────────────────────────────────────────────────────────────────────────
// SURFACE 5 §3 — WHAT IS ACTUALLY BEHIND "WHAT ELSE REFERS TO THIS LAW".
//
// ⚠⚠ THE COVERAGE STATEMENT IS THE FEATURE, NOT THE FOOTNOTE. `inbound()` returns
// `{ rows, coverage }` and the signature is deliberate: a bare array lets a caller present a
// short list as a complete one. The same reasoning applies one layer out — a heading that
// prints groups and counts with no statement of what the graph could not see is that same
// bare array, drawn on a screen.
//
// ⚠ ONE DEFINITION, FOUR SURFACES. The question panel, the long report, the evidence pack and
// the meeting pack all import this. Two copies of a caveat is one copy that will be updated —
// the fault this thread has now found seven times, most recently when the positions
// no-producer note was screen-only for two sprints.
//
// ⚠⚠ THIS FILE IMPORTS NOTHING, AND THAT IS LOAD-BEARING (CLAUDE.md §28). `QuestionPanel.tsx`
// is a `'use client'` component, so every value import it reaches is followed transitively
// into the browser bundle. `statutory-graph.ts` imports `lib/prisma`, so importing the live
// coverage type here would pull the Postgres driver into the client and fail the Vercel build
// on `dns`, `fs`, `net` and `tls` — three files away, with this file mentioning none of them.
//
// ⚠ SO THE SENTENCE IS A FUNCTION OF THE ROWS, NOT OF A LIVE QUERY. The live block — the
// percentages, the refusals, the recorded facts — is generated at run time by
// `statutory-graph.ts` and written into a coverage ROW, which every surface already carries.
// This says what is on the page and points at that row; it never restates a figure about the
// corpus, because a figure written here could not move when the graph does.
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * ⚠ THE MARKERS, DECLARED ONCE. The producer writes one of these into `sourceType`; every
 * reader counts by them. A row's kind is then a FACT ABOUT THE ROW rather than something a
 * renderer infers by reading its title — and a title is exactly the sort of thing that gets
 * reworded by somebody fixing the prose.
 */
export const CONSEQUENCE_SOURCE_TYPES = {
  /** ⚠ The strongest kind: the instrument's own enacting words name the power. */
  enabling: 'CITATION_GRAPH_ENABLING',
  /** A group of references that do the same kind of thing, with its disposition. */
  reference: 'CITATION_GRAPH',
  /** The live coverage statement, as a row of its own so it reaches every document. */
  coverage: 'CITATION_GRAPH_COVERAGE',
} as const

export const CONSEQUENCE_SOURCE_TYPE_VALUES: readonly string[] =
  Object.values(CONSEQUENCE_SOURCE_TYPES)

export interface ConsequencesTally {
  /** Everything filed under the heading, whatever its origin. */
  total: number
  /** Rows produced by the citation graph, of any of the three kinds. */
  fromGraph: number
  /** ⚠ Enabling-power rows. Named separately because the kind is the whole distinction. */
  enabling: number
  /** Grouped reference rows carrying a disposition. */
  references: number
  /** ⚠⚠ Whether the live coverage statement reached this heading at all. */
  hasCoverage: boolean
}

/**
 * Count a set of rows carrying a `sourceType`, so no caller writes the predicate twice.
 *
 * ⚠ IT COUNTS EVERYTHING UNDER THE HEADING, not only the graph's rows. A row filed here by
 * something else is still on the page a user is reading, and a caveat that describes three of
 * five items as though they were all of them is the same defect one level up.
 */
export function tallyConsequences(
  // ⚠⚠ REQUIRED, NOT OPTIONAL, AND THAT IS THE WHOLE GUARD. With `sourceType?` a caller whose
  // rows simply do not carry the field compiles cleanly and tallies zero of everything — the
  // caveat would then say the coverage statement was MISSING on a page where it is present,
  // for ever, with `tsc` green. An optional field on a counting function is a silent zero.
  rows: Array<{ sourceType: string | null }>,
): ConsequencesTally {
  const n = (t: string) => rows.filter((r) => r.sourceType === t).length
  const enabling = n(CONSEQUENCE_SOURCE_TYPES.enabling)
  const references = n(CONSEQUENCE_SOURCE_TYPES.reference)
  const coverage = n(CONSEQUENCE_SOURCE_TYPES.coverage)
  return {
    total: rows.length,
    fromGraph: enabling + references + coverage,
    enabling,
    references,
    hasCoverage: coverage > 0,
  }
}

/**
 * The caveat, in one paragraph, from the tally.
 *
 * ⚠⚠ THE THREE THINGS §4 FORBIDS ARE THE THREE THINGS THIS SENTENCE HAS TO PREVENT, and they
 * are prevented by saying them rather than by hoping a renderer never implies them:
 *
 *   · never "this is still good law" or "this is no longer good law" — those are legal
 *     conclusions; the graph reports references and the reader draws the conclusion;
 *   · never a total — every count is a count of what was found in the layers searched;
 *   · never flatten the kinds — an enacting power and a passing mention are different facts
 *     and adding them produces a confident wrong answer.
 *
 * ⚠ IT SAYS WHAT IS THERE, INCLUDING WHEN NOTHING IS. An empty section with no sentence reads
 * as "nothing in the statute book refers to this", which is a claim about the world; "we have
 * found nothing and here is what that does and does not mean" is a claim about us, and is the
 * true one.
 */
export function consequencesCaveat(t: ConsequencesTally): string {
  if (t.total === 0) {
    return 'Nothing has been filed under this heading for this proposal. That is a statement about '
      + 'what we have looked for, not about whether anything in the statute book refers to the law '
      + 'you want to change. This section needs an enactment to be identified first — link the Act, '
      + 'or name it in the proposal, and it will look.'
  }

  const parts: string[] = []

  if (t.enabling > 0) {
    parts.push(
      'The instruments listed at the top were made under this law, in their own enacting words. '
      + 'That is a different and stronger fact than a mention of it, and the two are kept apart here '
      + 'rather than added together: an instrument that merely mentions an Act survives its repeal, '
      + 'while one whose enabling power is repealed may fall with it.')
  }

  if (t.references > 0) {
    parts.push(
      'The rest are references grouped by what their words do, with what each kind would need if this '
      + 'law changed. The count tells you the scale; the grouping tells you the work — most references '
      + 'to a well-known Act are untouched by changing it.')
  }

  // ⚠⚠ NEVER A LEGAL CONCLUSION. This is the sentence that stops a reader taking a long list as
  // a verdict, and it is printed whatever else is on the page.
  parts.push(
    'None of this says whether the law here is or is not still good law. Those are legal conclusions. '
    + 'What is recorded is that certain words in certain provisions point at this one, with the words '
    + 'quoted and the source named, so you can go and read them.')

  // ⚠ NEVER A TOTAL. Charlie's own wording: a count is "what we found in the layers we have searched".
  parts.push(
    'Every number here is a count of what we found in the layers we have searched, never a total.')

  if (!t.hasCoverage) {
    // ⚠⚠ A MISSING COVERAGE STATEMENT IS A FINDING, NOT A TIDIER PAGE. The block is generated
    // live and written as a row of its own; if it is not here, this answer is a list with no
    // statement of what it could not see — which is precisely the shape the graph's own
    // `{ rows, coverage }` signature exists to make impossible.
    parts.push(
      'The statement of what this search could not see is MISSING from this section — it is written '
      + 'as an item of its own and there is not one here, so treat what is above as incomplete in '
      + 'ways nothing on this page is telling you about.')
  } else {
    parts.push(
      'What this search could not see is set out in full in the item titled below — read it before '
      + 'quoting any number from this section.')
  }

  return parts.join(' ')
}
