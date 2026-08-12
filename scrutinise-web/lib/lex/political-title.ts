// political-title.ts — how the four V34 corpora name themselves in front of a user.
//
// S2C6 §1 sets one correctness requirement that holds whatever type each collection gets:
// "a user must be able to tell an impact assessment from the law it assesses, and a roll-call
// from a debate." That is a claim about the RENDERED TITLE, and measured against the stored
// `sectionTitle` on 2026-08-12 all four collections failed it, three of them badly:
//
//   lords-divisions-votes    "Employment Rights Bill"          ← reads as a debate on that bill
//   commons-divisions-votes  "Crime and Policing Bill Report Stage: New Clause 1"
//                                                              ← names the question, not the vote
//   impact-assessments       "Summary" · "Policy objectives" · "Costs and benefits"
//                                                              ← names nothing at all. 1,024 rows
//                                                                are titled the single word
//                                                                "Summary".
//   consultations            "Corporation Tax: response to accounting changes for insurance
//                             contracts"                       ← reads as a policy paper
//
// A source panel showing "Summary" over a card is not a smaller version of the right answer, it
// is a different failure from the one S2C2 fixed for annotations and it has the same cause: the
// stored title is an INTERNAL heading, written for a document reader who already knows which
// document they opened. A search result has no such reader.
//
// WHY THIS IS A DISPLAY RULE AND NOT AN INGEST REWRITE. Same reasoning as annotation-title.ts,
// which this file deliberately mirrors: two adapters build titles independently (fts-search.ts
// and vector-search.ts) and both are live, so a rule applied in one place only would make a row's
// title depend on which retriever found it. Applying it at display also means it is correct the
// moment it ships rather than at the next full index build — the FTS index bakes `sectionTitle`
// in at build time, which is the staleness `dbTitleSupersedesIndex` exists to work around.
//
// ⚠ EVERY FUNCTION HERE FALLS BACK TO THE STRING THE CALLER ALREADY HAD, never to a blank and
// never to a partial. "Impact Assessment —" with nothing after it is worse than "Summary".

/** The two roll-call collections. Explicit, so no `*-divisions-*` prefix rule can widen it and
 *  quietly capture `lda-commonsdivisions` — which is a different (and near-empty) collection. */
export const DIVISION_CORPORA = ['commons-divisions-votes', 'lords-divisions-votes'] as const
export const IMPACT_ASSESSMENT_CORPUS = 'impact-assessments'
export const CONSULTATION_CORPUS = 'consultations'

const HOUSE: Record<string, string> = {
  'commons-divisions-votes': 'Commons',
  'lords-divisions-votes': 'Lords',
}

export function isDivisionCorpus(corpus: string): boolean {
  return (DIVISION_CORPORA as readonly string[]).includes(corpus)
}

/** True for any collection this module names. The adapters branch on this. */
export function isPoliticalCorpus(corpus: string): boolean {
  return isDivisionCorpus(corpus) || corpus === IMPACT_ASSESSMENT_CORPUS || corpus === CONSULTATION_CORPUS
}

/** Collapse whitespace and drop a dangling separator, so no branch can emit "X —". */
function tidy(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/[\s—–-]+$/, '').trim()
}

/**
 * A roll-call. "Division — {question} (Commons, 2025-06-17)".
 *
 * The word "Division" leads because it is the thing the reader must not mistake, and the House
 * is included because Commons and Lords roll-calls answer different questions about the same
 * bill. The date is in the title rather than only in the `date` field because a bill is divided
 * on many times and the panel shows one line per card.
 */
export function divisionTitle(
  corpus: string,
  current: string,
  date: string | null | undefined,
): { title: string; citation: string } {
  const house = HOUSE[corpus]
  if (!house) return { title: current, citation: current }
  const question = tidy(current)
  // A row with no usable title still says what it is and which House — never the corpus key.
  const stem = question && question !== corpus ? `Division — ${question}` : `${house} division`
  const suffix = [house, date || null].filter(Boolean).join(', ')
  return {
    title: tidy(question && question !== corpus ? `${stem} (${suffix})` : stem + (date ? ` (${date})` : '')),
    citation: tidy(`House of ${house} division${date ? `, ${date}` : ''}`),
  }
}

/**
 * An impact assessment section. "Impact Assessment — {instrument} — {heading}".
 *
 * `instrumentTitle` comes from `corpus_acts` joined on `corpus_sections.parentDocId`, which is
 * populated on 94.7% of rows (1,049 distinct instruments, 742 of them resolving to a title in
 * `corpus_acts` — 70%). When it does not resolve the DEPARTMENT stands in, because
 * "Impact Assessment (Department for Transport) — Costs and benefits" still tells a reader what
 * they have; "Costs and benefits" does not.
 *
 * ⚠ The instrument's name is a claim about WHAT THIS ASSESSES, not about what this IS. The
 * leading label is what stops the two being read as the same document — the identical hazard
 * `isLeg` poses for annotations, and the reason IMPACT_ASSESSMENT is not a legislation type.
 */
export function impactAssessmentTitle(
  instrumentTitle: string | null | undefined,
  department: string | null | undefined,
  current: string,
): { title: string; citation: string } {
  const heading = tidy(current)
  const named = instrumentTitle ? tidy(instrumentTitle) : null
  // `attribution` is stored as "{department} — {stage}"; the department alone is the useful half.
  const dept = department ? tidy(department.split('—')[0]) : null
  const subject = named ?? (dept || null)
  if (!subject) {
    // Nothing to attach it to. Still say what it is — this is the floor, not a failure.
    return { title: tidy(`Impact Assessment — ${heading}`) || 'Impact Assessment', citation: 'Impact Assessment' }
  }
  const stem = named ? `Impact Assessment — ${named}` : `Impact Assessment (${dept})`
  // The internal heading is kept, last, because it is genuinely useful once the document is
  // identified — "Costs and benefits" of a named instrument is exactly what a reader wants.
  return {
    title: tidy(heading ? `${stem} — ${heading}` : stem),
    citation: tidy(named ? `Impact Assessment to ${named}` : `Impact Assessment (${dept})`),
  }
}

/**
 * A consultation. "Consultation — {title}".
 *
 * The stored title is the consultation's own name and is usually good prose, so the rule is the
 * lightest of the three: prefix the word unless the title already carries it. Same shape as
 * billDisplayTitle's never-mistake-a-Bill-for-an-Act rule, and for the same reason — a document
 * about a policy that never became law must not read as a statement of what the law is.
 */
export function consultationTitle(
  department: string | null | undefined,
  current: string,
): { title: string; citation: string } {
  const name = tidy(current)
  const dept = department ? tidy(department.split('—')[0]) : null
  if (!name || name === CONSULTATION_CORPUS) {
    return { title: dept ? `Consultation (${dept})` : 'Consultation', citation: 'Consultation' }
  }
  const title = /\bconsultation\b/i.test(name) ? name : `Consultation — ${name}`
  return { title: tidy(title), citation: tidy(dept ? `${title} (${dept})` : title) }
}

/**
 * The one entry point the adapters call. Returns null for a corpus this module does not name, so
 * the caller keeps its existing branch untouched — the byte-identity property
 * `check:annotation-titles` holds for every other collection.
 */
export function politicalTitle(
  corpus: string,
  current: string,
  meta: { parentTitle?: string | null; attribution?: string | null; date?: string | null },
): { title: string; citation: string } | null {
  if (isDivisionCorpus(corpus)) return divisionTitle(corpus, current, meta.date)
  if (corpus === IMPACT_ASSESSMENT_CORPUS) return impactAssessmentTitle(meta.parentTitle, meta.attribution, current)
  if (corpus === CONSULTATION_CORPUS) return consultationTitle(meta.attribution, current)
  return null
}
