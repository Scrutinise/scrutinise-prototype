// ═════════════════════════════════════════════════════════════════════════════════════════════
// costing.ts — BRIEF_SEARCH_S18 §2/§3. THE COST AND BENEFIT BLOCK.
//
// Charlie's requirement, verbatim: answer *"what is this proposed legislation going to cost
// against its likely benefits"* and *"what has been the cost of the Public Sector Equality Duty
// to date"*, and make it a standard block in all new ideas.
//
// ⚠⚠ IT IS A SPECIALISATION OF `PRECEDENT`, NOT A SECOND ASSEMBLER. §2 is explicit —
// *"Extend it; do not build a parallel assembler that will drift."* So `retrievePrecedent()` is
// IMPORTED and its legs are what the PREDICTED and CHECKED rows are built from. There is exactly
// one place that decides which document is a prediction and which is an outcome
// (`impactLegOf`), and it is not here.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// WHY THIS LAYER DOES NOT GO NEAR THE RANKER, AND THAT IS THE MEASUREMENT TALKING
// ═════════════════════════════════════════════════════════════════════════════════════════════
// S18 §1 was asked to fix routing on the assumption that the impact-assessment collection is
// never searched. It measured the opposite. Scoped to the collection itself, BM25-only:
//
//   section-level recall@20   0 of 9      ← what the gold set scores today
//   DOCUMENT-level recall@20  4 of 9      ← the right ASSESSMENT, wrong section
//   DOCUMENT-level in top 200 8 of 9
//
// and, reading the answer keys out of R2, **9 of the 18 keys are a cover sheet or an appraisal
// table whose figures did not survive extraction.** The collection is reachable, routed on 5 of 9
// questions, and retrievable; what fails is the UNIT — an assessment is held as ~16 sections and
// the question is about the assessment.
//
// So this block is assembled DETERMINISTICALLY BY INSTRUMENT and never by ranked retrieval, which
// is the one design that is immune to all of that. Ranking is used for exactly one row —
// COMPARABLE — where the question genuinely is "find me others", and even there the results are
// collapsed to DOCUMENTS before they are shown, because that is the unit §1 measured as working.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// THE THREE RULES, EACH OF WHICH WOULD OTHERWISE PRODUCE A CONFIDENT WRONG ANSWER (§2)
// ═════════════════════════════════════════════════════════════════════════════════════════════
//  1. A PREDICTION IS NEVER RENDERED AS AN OUTCOME. Enforced structurally: the PREDICTED and
//     CHECKED rows are built from different legs of the precedent, and `checked` is null unless a
//     post-implementation review was actually found. There is no code path that copies one into
//     the other, and `check:s18-costing` asserts there is none.
//  2. FIGURES FROM DIFFERENT YEARS ARE NOT COMPARABLE WITHOUT THEIR PRICE BASE YEAR. Every quoted
//     figure carries `priceBase`, and where the base year cannot be read off the document the
//     figure is marked `priceBase: null` and the block SAYS the figure is not comparable. Nothing
//     is ever deflated here — deflating silently is the failure this rule exists to stop.
//  3. "NOT MONETISED" IS NOT ZERO. `FigureState` has three values and never two. See below.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { r2Get } from '@/lib/r2'
import { searchCatalogue, type SeriesDescriptor, type StatsUseContext } from './stats-catalogue'
import { runFtsSearch } from './fts-search'
import {
  retrievePrecedent, impactLegOf, type Precedent, type RenderedBlock,
} from './deepening-retrieval'

// ── the three states a figure can be in ─────────────────────────────────────────────────────────

/**
 * ⚠⚠ THREE STATES, NEVER TWO, AND COLLAPSING ANY PAIR INVERTS AN ANSWER.
 *
 *   PUBLISHED       the department put a number on it and we hold the number.
 *   NOT_ESTIMATED   the department SAID it did not put a number on it — *"Not estimated"*,
 *                   *"benefits have not been monetised"*, *"Not in scope"*. **This is a finding,
 *                   with a citation.** It is the government's own answer, and it is the answer to
 *                   Charlie's second question far more often than a figure is.
 *   NOT_EXTRACTED   the document has an appraisal table and WE do not hold its figures. A defect
 *                   on our side. Measured on the nine gold assessments: 4 of 18 answer keys.
 *
 * ⚠ THE DAMAGING COLLAPSE IS `NOT_ESTIMATED` → 0, and §2 rule 3 names it: *"A measure whose
 * benefits were never quantified must not read as a measure with no benefits. This is the single
 * most likely way for the block to be systematically unfair to good legislation."* The second,
 * quieter collapse is `NOT_ESTIMATED` → `NOT_EXTRACTED`, which blames us for the department's
 * decision and hides the finding. Neither type-checks: there is no arithmetic on this enum.
 */
export type FigureState = 'PUBLISHED' | 'NOT_ESTIMATED' | 'NOT_EXTRACTED'

export interface CostingFigure {
  /** What the document calls it, in its own words. */
  label: string
  state: FigureState
  /**
   * ⚠ THE PRICE BASE YEAR, AND `null` IS A REAL AND COMMON VALUE. A 2011 £ and a 2024 £ are
   * different units; a figure whose base year we cannot read is not comparable with anything and
   * the block says so rather than quietly treating it as today's money.
   */
  priceBase: number | null
  /** The exact words the base year was read from, so the reader can check us. Null when unread. */
  priceBaseVerbatim: string | null
  /** ⚠ VERBATIM. Never a paraphrase, never a re-typed number — the text as the document has it. */
  verbatim: string
}

// ── the five rows of the block ──────────────────────────────────────────────────────────────────

export interface CostingSource {
  id: string
  title: string
  url: string | null
  /** The document's own date. ⚠ Off the corpus row, never from a model (25-P §2b). */
  date: string | null
}

export interface CostingRow {
  row: 'PREDICTED' | 'CHECKED' | 'MEASURED' | 'NOT KNOWN' | 'COMPARABLE'
  /** One line saying what this row IS, in words a reader can use. */
  whatItIs: string
  /** Present when the row was answered. Absent rows are stated in NOT KNOWN, never dropped. */
  source: CostingSource | null
  figures: CostingFigure[]
  /** What the row says, when it is not a figure — the review's finding, the series' title. */
  statements: string[]
  series: SeriesDescriptor[]
  /** ⚠ COMPARABLE only: the kind of comparison being made. See COMPARISON_KIND. */
  comparisonKind: string | null
  /**
   * MEASURED only: which of the subject's own words each series matched on, keyed by `seriesKey`.
   *
   * ⚠⚠ IT LIVES ON THE ROW, NOT ON THE DESCRIPTOR AND NOT IN A MODULE-LEVEL MAP, and both halves of
   * that are load-bearing. `SeriesDescriptor` must not grow fields — `stats-catalogue.ts` re-checks
   * at its own boundary that no descriptor can carry anything a value could travel in, and
   * widening it for a render detail is how that guarantee starts to erode. A module-level map is
   * worse: this process serves concurrent requests, so one user's matched terms would surface
   * inside another user's block. `query-router.ts` carries that exact warning about its own
   * degradation sink, and it applies here for the same reason. A field on the row is scoped to the
   * one call by construction.
   */
  matchedOn?: Record<string, string[]>
}

export interface CostingBlock {
  subject: string
  /** The instrument, when the block is about one. Null for a subject-only (forward) question. */
  gid: string | null
  instrumentTitle: string | null
  /** ⚠ The direction of the question. They need different material and say different things. */
  direction: 'FORWARD' | 'BACKWARD'
  rows: CostingRow[]
  /** ⚠ GENERATED FROM LIVE STATE ON EVERY CALL. Never hardcoded. See `coverageLine`. */
  coverage: string
  note: RenderedBlock
}

/**
 * ⚠⚠ SAY WHICH KIND OF COMPARISON IS BEING MADE. §2: *"a user told 'similar measures' will assume
 * the second."* We compare by SUBJECT AND SECTOR — other assessments whose text is about the same
 * thing. Comparison by MECHANISM — the same lever pulled in an unrelated field — is the mechanism
 * graph, it is not built, and `deepening-retrieval.ts::NOT_BUILT.MECHANISM_ANALOGUE` already
 * records why (it wants results that are topically DISTANT, which is the opposite of what BM25 and
 * dense retrieval both reward). Naming the kind in the payload, on the screen and in the prompt is
 * the whole of the mitigation.
 */
export const COMPARISON_KIND =
  'by SUBJECT — other impact assessments about the same policy area. NOT by mechanism: '
  + '"the same kind of lever used somewhere else" is a different question and we cannot answer it.'

// ── reading a price base year off the document ──────────────────────────────────────────────────

/**
 * The HMG summary sheet states it on its face: *"Price Base Year 2008"*, *"(2016 prices, 2017
 * present value)"*, *"EANDCB in 2014 prices"*.
 *
 * ⚠ THIS IS AN INTERIM AND IS LABELLED ONE. `BRIEF_INGEST_IMPACT_NUMBERS` §2 makes the price base
 * year a first-class extracted column with provenance, and when that table lands this function is
 * DELETED and the column read instead — one place, not two. It exists now because rule 2 forbids
 * showing a figure without its base year, so the block could not render at all without it, and
 * because a base year read off the same document as the figure cannot disagree with it.
 *
 * ⚠ IT RETURNS null RATHER THAN GUESSING. A wrong base year is worse than none: it makes two
 * incomparable figures look comparable, which is precisely rule 2's failure mode.
 */
export function priceBaseYearOf(text: string): { year: number | null; verbatim: string | null } {
  const patterns = [
    /Price\s+Base\s+Year\s*:?\s*((?:19|20)\d{2})/i,
    /\(\s*((?:19|20)\d{2})\s*prices\b[^)]*\)/i,
    /\bin\s+((?:19|20)\d{2})\s+prices\b/i,
    /\b((?:19|20)\d{2})\s+prices\b/i,
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) {
      const y = parseInt(m[1], 10)
      // A base year outside the range these documents can carry is a false match, not a finding.
      if (y >= 1990 && y <= new Date().getUTCFullYear() + 1) return { year: y, verbatim: m[0].trim() }
    }
  }
  return { year: null, verbatim: null }
}

/** The department's own statement that a figure was never produced. Shared with the S18 audit's
 *  key classifier by INTENT, not by import — see the note on `figureStateOf`. */
const NOT_ESTIMATED = /(Not\s+(been\s+)?(estimated|quantified|monetised|monetized)|have\s+not\s+been\s+(estimated|quantified|monetised|monetized)|Non[\s-]?qualifying\s+provision|Not\s+in\s+scope|unable\s+to\s+(monetise|quantify)|No\s+(significant\s+)?(costs?|benefits?)\s+(are\s+)?(anticipated|expected|identified))/i
const MONEY = /(£\s?-?[\d,]+(\.\d+)?\s*(m|bn|billion|million|k|thousand)?)|(-?[\d,]+(\.\d+)?\s*(million|billion)\s*(pounds|£))/i
const COST_LABELS = /(Net\s+Present\s+Value|Cost\s+of\s+Preferred|Business\s+Net\s+Present|EANDCB|Equivalent\s+Annual|Net\s+cost\s+to\s+business|One-In,?\s*(Two|Three)-Out)/i

/**
 * Which of the three states this passage is in — or `null`, meaning IT IS NOT A FIGURE AT ALL.
 *
 * ⚠ ORDER IS LOAD-BEARING AND THE ORDER IS: money, then declaration, then strip. A table that
 * carries a figure AND the words "wider benefits not monetised" is a PUBLISHED cost with an
 * unmonetised benefit — reading the declaration first would throw the figure away.
 *
 * ⚠⚠ `null` EXISTS BECAUSE THE FIRST VERSION DID NOT HAVE IT, AND THE FIRST RENDER SHOWED WHY.
 * It returned `NOT_EXTRACTED` for anything with no money in it, so a 179-word prose section —
 * *"Two options are considered. 'Do nothing', or a ban with specified exemptions…"* — came out
 * under the caption **"we do not hold the figure for this table"**. There was no figure and no
 * table. That is an accusation against our own corpus manufactured out of ordinary prose, and it
 * is the same over-claiming direction as calling the department's "Not estimated" a gap in our
 * extraction. A passage is a FIGURE only if it carries money, an appraisal label, or a
 * declaration that a figure was not produced; everything else is text, and is shown as text.
 */
export function figureStateOf(text: string): FigureState | null {
  const hasLabels = COST_LABELS.test(text)
  if (MONEY.test(text) && hasLabels) return 'PUBLISHED'
  if (NOT_ESTIMATED.test(text) && hasLabels) return 'NOT_ESTIMATED'
  if (hasLabels) return 'NOT_EXTRACTED'
  // Money with no appraisal label is a number in prose (a fee, a threshold), not the appraisal
  // table. It is quoted as text rather than presented as the measure's cost.
  return null
}

// ── the assembler ───────────────────────────────────────────────────────────────────────────────

interface Row { id: string; sectionTitle: string | null; sourceUrl: string | null; itemDate: string | null; r2Key: string | null; wordCount: number | null; attribution: string | null }

/** Every impact-assessment section held for an instrument, in document order.
 *  ⚠ JOINED ON `parentDocId`. An assessment's id carries its OWN number (`2020-57`), never the
 *  instrument's gid — 0 of 18,759 ids contain a slash. That mistake is what killed two of
 *  PRECEDENT's three legs for a month; see `retrievePrecedent`. */
async function assessmentSections(gid: string): Promise<Row[]> {
  return prisma.$queryRaw<Row[]>`
    SELECT id, "sectionTitle", "sourceUrl", "itemDate"::text AS "itemDate", "r2Key", "wordCount", attribution
    FROM corpus_sections
    WHERE corpus = 'impact-assessments' AND "parentDocId" = ${gid} AND status = 'compiled'
    ORDER BY split_part(id, ':', 2), (NULLIF(split_part(id, ':', 3), ''))::int
    LIMIT 200`
}

/** Read the bodies of up to `n` sections. R2, not the database — the corpus keeps no text. */
async function bodies(rows: Row[], n: number): Promise<Array<Row & { body: string }>> {
  const out: Array<Row & { body: string }> = []
  for (const r of rows.slice(0, n)) {
    if (!r.r2Key) continue
    const b = await r2Get(r.r2Key)
    if (b && b.trim()) out.push({ ...r, body: b })
  }
  return out
}

export interface CostingOptions {
  /** The instrument, when known. Without it the block is FORWARD-looking and has no own assessment. */
  gid?: string | null
  /** ⚠ Passed straight to the statistics catalogue's licence gate. Never defaulted silently. */
  useContext?: StatsUseContext
  comparableLimit?: number
}

/**
 * Build the COST AND BENEFIT block.
 *
 * ⚠ THE BLOCK ALWAYS RENDERS. §3: *"An empty block is the failure mode this platform exists to
 * avoid, and a user cannot tell 'nobody measured it' from 'we did not look'."* Every one of the
 * five rows is present in the output; a row with nothing in it says what was searched and what was
 * not found, which is a different sentence from silence.
 */
export async function retrieveCosting(subject: string, opts: CostingOptions = {}): Promise<CostingBlock> {
  const gid = opts.gid ?? null
  const useContext: StatsUseContext = opts.useContext ?? 'commercial'
  const direction: CostingBlock['direction'] = gid ? 'BACKWARD' : 'FORWARD'

  // ── PREDICTED and CHECKED, from the precedent legs ───────────────────────────────────────────
  const precedent: Precedent | null = gid ? await retrievePrecedent(gid) : null
  const sections = gid ? await assessmentSections(gid) : []
  const withBodies = await bodies(sections, 40)

  const predictedRow = await buildPredicted(precedent, withBodies)
  const checkedRow = await buildChecked(precedent, withBodies)
  const measuredRow = await buildMeasured(subject, useContext)
  const comparableRow = await buildComparable(subject, gid, opts.comparableLimit ?? 5)
  const notKnownRow = buildNotKnown(predictedRow, checkedRow, measuredRow, comparableRow, gid)

  const rows = [predictedRow, checkedRow, measuredRow, notKnownRow, comparableRow]
  return {
    subject,
    gid,
    instrumentTitle: precedent?.instrumentTitle ?? null,
    direction,
    rows,
    coverage: await coverageLine(gid, sections.length, measuredRow, direction),
    note: COSTING_NOTE,
  }
}

async function buildPredicted(p: Precedent | null, secs: Array<Row & { body: string }>): Promise<CostingRow> {
  const leg = p?.legs.find((l) => l.leg === 'predicted') ?? null
  const figures: CostingFigure[] = []
  const statements: string[] = []

  // Predicted ONLY: a section belonging to an assessment whose STAGE is Post Implementation is the
  // CHECKED row's material and never this one's, and the split is `impactLegOf`'s — the one rule,
  // not a second copy of it.
  const appraisal = secs.filter((s) =>
    impactLegOf(s.attribution) === 'predicted'
    && /costs? and benefits|preferred option|rpc opinion|options considered/i.test(s.sectionTitle ?? ''))

  // ⚠⚠ THE PRICE BASE YEAR IS TAKEN FROM THE ASSESSMENT, NOT ONLY FROM THE SECTION, AND THE
  // DIFFERENCE IS NOT COSMETIC. The plastic-straws appraisal table reads "Net cost to business per
  // year … -£44.7m -£47.0m £5.5m" and states its base year two sections away, on the front sheet
  // ("Price Base Year 2017"). Rule 2 forbids showing a figure without its base year, so a
  // section-only read would have suppressed the base year on the one row that has a real number in
  // it — the rule defeating its own purpose. The document-level fallback is used ONLY where the
  // section itself is silent, and `priceBaseVerbatim` records which section it was read from, so a
  // reader can see that it came from elsewhere in the same assessment rather than from this table.
  const docBase = (() => {
    for (const s of secs) {
      const r = priceBaseYearOf(s.body)
      if (r.year) return { ...r, from: s.sectionTitle ?? s.id }
    }
    return null
  })()

  for (const s of appraisal) {
    const state = figureStateOf(s.body)
    const own = priceBaseYearOf(s.body)
    const text = s.body.replace(/\s+/g, ' ').trim().slice(0, 600)
    if (state === null) {
      // Not a figure. Quoted as what it is, rather than captioned as a figure we failed to hold.
      statements.push(`${s.sectionTitle ?? s.id}: "${text}"`)
      continue
    }
    figures.push({
      label: s.sectionTitle ?? s.id,
      state,
      priceBase: own.year ?? docBase?.year ?? null,
      priceBaseVerbatim: own.verbatim
        ?? (docBase ? `${docBase.verbatim} (stated in "${docBase.from}", elsewhere in the same assessment)` : null),
      verbatim: text,
    })
  }
  if (leg && !figures.length) {
    statements.push(`An impact assessment is held (${leg.title}) and no appraisal table was found in it.`)
  }
  return {
    row: 'PREDICTED',
    whatItIs: 'what the department said it would cost, and gain, BEFORE it did it',
    source: leg ? { id: leg.id, title: leg.title, url: leg.url, date: leg.date } : null,
    figures, statements, series: [], comparisonKind: null,
  }
}

/**
 * ⚠⚠ THIS ROW IS `null` UNLESS A REVIEW WAS ACTUALLY FOUND, AND THAT IS THE POINT OF THE WHOLE
 * FEATURE. It is built from the `observed` leg only. There is no branch, no fallback and no
 * default that could put the impact assessment's predictions here — §2 rule 1, and
 * `check:s18-costing` asserts that no PREDICTED source id ever appears as a CHECKED source id.
 */
async function buildChecked(p: Precedent | null, secs: Array<Row & { body: string }>): Promise<CostingRow> {
  const leg = p?.legs.find((l) => l.leg === 'observed') ?? null
  const statements: string[] = []
  if (leg) {
    const body = secs.find((s) => s.id === leg.id)?.body
    if (body) statements.push(body.replace(/\s+/g, ' ').trim().slice(0, 800))
  }
  return {
    row: 'CHECKED',
    whatItIs: 'whether anyone assessed it AFTERWARDS, and what they found',
    source: leg ? { id: leg.id, title: leg.title, url: leg.url, date: leg.date } : null,
    figures: [], statements, series: [], comparisonKind: null,
  }
}

/**
 * ⚠ THE CATALOGUE STRUCTURALLY CANNOT RETURN A NUMBER, AND THAT BOUNDARY IS KEPT. §2: *"it says
 * which measurement exists, and values are fetched by exact call."* `SeriesDescriptor` has no
 * field a value could travel in and `stats-catalogue.ts` re-checks that at its own boundary. This
 * row therefore answers "is this measured at all", which for Charlie's backward question is
 * usually the only honest thing on the page.
 */
async function buildMeasured(subject: string, useContext: StatsUseContext): Promise<CostingRow> {
  const out = await searchCatalogue(subject, { limit: 6, useContext })
  const statements: string[] = []
  if (out.unavailable) {
    // ⚠ SEARCH_CONTRACT §6 — "we could not look" is not "there is nothing".
    statements.push('The statistics catalogue could not be consulted on this call, so nothing here says whether a series exists.')
  } else if (!out.results.length) {
    statements.push(`No official series in the catalogue matched this subject (searched ${out.searchedOver.toLocaleString()} series).`)
  }
  if (out.licenceWithheld > 0) {
    statements.push(`${out.licenceWithheld.toLocaleString()} series were withheld by their licence before scoring and were never candidates.`)
  }

  // ⚠⚠ SAY WHAT IT MATCHED ON, AND THE WORKED EXAMPLE IS WHY. Asked for the **public sector
  // equality DUTY**, the catalogue returned *Alcohol duty — Spirits duties*, *Tobacco duty —
  // Cigarette duty* and *customs_duties*: six HMRC series, every one of them matched on the single
  // word "duty", presented under the heading "official statistics series that BEAR ON the subject".
  // That is a confident wrong answer of precisely the kind this block exists to prevent, and the
  // catalogue's own documentation predicts it ("Office Budget Responsibility" matching *Home
  // Office*, S9 §4).
  //
  // ⚠ THE FIX IS DISCLOSURE, NOT A FILTER, AND THAT IS A DELIBERATE CHOICE. A threshold tuned here
  // would be a ranking rule used as a filter — it would silently drop the real series on the day a
  // subject shares only one word with it. Printing the overlap costs nothing, cannot discard a
  // right answer, and lets a reader see "matched on: duty" and dismiss the row themselves. Print
  // the surface form; never leave the reader to infer what a pattern matched.
  const stop = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'by', 'uk', 'public', 'sector', 'total', 'new', 'act'])
  const subjectTokens = new Set(
    subject.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !stop.has(t)),
  )
  const matchedOn: Record<string, string[]> = {}
  let thinnest = Infinity
  for (const s of out.results) {
    const hay = `${s.seriesLabel} ${s.measure} ${s.measureGloss ?? ''} ${s.datasetTitle}`.toLowerCase()
    const hayTokens = new Set(hay.split(/[^a-z0-9]+/).filter(Boolean))
    const overlap = [...subjectTokens].filter((t) => hayTokens.has(t))
    thinnest = Math.min(thinnest, overlap.length)
    matchedOn[s.seriesKey] = overlap
  }
  if (out.results.length && thinnest <= 1) {
    statements.push(
      '⚠ Every series above is shown with the words it matched on. Where that is a single common '
      + 'word, the series is almost certainly about something else — "duty" matches alcohol duty as '
      + 'readily as a statutory duty — and the honest reading is that NO series bears on this subject.',
    )
  }
  return {
    row: 'MEASURED',
    whatItIs: 'official statistics series that BEAR ON the subject — whether it is measured at all',
    source: null, figures: [], statements, series: out.results, comparisonKind: null, matchedOn,
  }
}



/**
 * Comparable measures, for the forward question.
 *
 * ⚠⚠ COLLAPSED TO DOCUMENTS BEFORE IT IS SHOWN, AND THE MEASUREMENT SAYS WHY. S18 §1: scoped to
 * this collection, section-level recall@20 is 0 of 9 and DOCUMENT-level recall@20 is 4 of 9. The
 * user's question is "which other measures", i.e. which ASSESSMENTS — so returning sections would
 * both answer the wrong question and return the unit that does not work.
 */
async function buildComparable(subject: string, gid: string | null, limit: number): Promise<CostingRow> {
  const statements: string[] = []
  // ⚠ THE REAL SEARCH PATH, CORPUS-SCOPED — not a second retriever, and not a Postgres query.
  // `corpus_sections` HAS NO `fts_vector` COLUMN: the sparse index lives in LanceDB behind
  // `fts-serve`, and the first draft of this function invented a Postgres full-text predicate that
  // would have thrown on every call. The prefilter is the same one the router's streams use.
  const out = await runFtsSearch(subject.trim().split(/\s+/).filter(Boolean), 60, {
    corpora: ['impact-assessments'],
  })
  if (out.failed) {
    // SEARCH_CONTRACT §6 — "we could not look" is a different sentence from "there is nothing".
    statements.push(`The comparable-measures search could not be completed (${out.reason ?? 'reason not reported'}), so this row is not evidence that no comparable measure exists.`)
    return {
      row: 'COMPARABLE',
      whatItIs: 'measures of a similar kind, and what they were predicted to cost',
      source: null, figures: [], statements, series: [], comparisonKind: COMPARISON_KIND,
    }
  }

  // Collapse sections to ASSESSMENTS, keeping the best-ranked section of each — the unit §1
  // measured as working, and the unit the user's question is actually about.
  const seen = new Set<string>()
  const docs: Array<{ doc: string; id: string; title: string; url: string | null; date: string | null }> = []
  for (const r of out.results) {
    const doc = r.id.split(':').slice(0, 2).join(':')
    if (seen.has(doc)) continue
    seen.add(doc)
    docs.push({ doc, id: r.id, title: r.title || r.citation || doc, url: r.url || null, date: r.date || null })
    if (docs.length >= limit) break
  }

  // ⚠ THE OWN INSTRUMENT IS REMOVED BY ITS parentDocId, NOT BY ITS ID. An assessment's id carries
  // its own number, so comparing ids against the gid would never match and the measure would
  // appear in its own list of comparables.
  let ownDocs = new Set<string>()
  if (gid) {
    const own = await prisma.$queryRaw<Array<{ doc: string }>>`
      SELECT DISTINCT split_part(id, ':', 1) || ':' || split_part(id, ':', 2) AS doc
      FROM corpus_sections WHERE corpus = 'impact-assessments' AND "parentDocId" = ${gid}`
    ownDocs = new Set(own.map((o) => o.doc))
  }
  const others = docs.filter((d) => !ownDocs.has(d.doc))
  if (!others.length) statements.push('No other impact assessment in the collection matched this subject.')

  return {
    row: 'COMPARABLE',
    whatItIs: 'measures of a similar kind, and what they were predicted to cost',
    source: null,
    figures: [],
    statements: [
      ...statements,
      ...others.map((d) => `${d.title}${d.date ? ` (${d.date})` : ''} — ${d.doc}${d.url ? ` · ${d.url}` : ''}`),
    ],
    series: [], comparisonKind: COMPARISON_KIND,
  }
}

/**
 * ⚠⚠ `NOT KNOWN` IS A FIRST-CLASS ROW, NOT AN ERROR STATE (§3). It is COMPUTED from the other
 * four — it can never disagree with them — and it distinguishes the three sentences a reader
 * must be able to tell apart:
 *
 *   · nobody ever produced the figure          (the department said so, or no review exists)
 *   · we do not hold the figure that exists    (our extraction lost it)
 *   · we did not look                          (the layer is not built)
 *
 * The last is the one §3 says a user cannot otherwise distinguish, and it is why the unbuilt
 * linkages are named here rather than omitted.
 */
function buildNotKnown(
  predicted: CostingRow, checked: CostingRow, measured: CostingRow, comparable: CostingRow, gid: string | null,
): CostingRow {
  const s: string[] = []
  if (!gid) {
    s.push('No instrument is named, so this is a FORWARD-looking block: there is no assessment OF this proposal, because it does not exist yet. Everything below is about comparable measures.')
  } else if (!predicted.source) {
    s.push('No impact assessment is held for this instrument, so we cannot say what it was predicted to cost. That is a gap in what we hold, not a statement that none was published.')
  }
  const notExtracted = predicted.figures.filter((f) => f.state === 'NOT_EXTRACTED')
  const notEstimated = predicted.figures.filter((f) => f.state === 'NOT_ESTIMATED')
  if (notEstimated.length) {
    s.push(`The department itself recorded that ${notEstimated.length === 1 ? 'a figure was' : `${notEstimated.length} figures were`} NOT estimated (${notEstimated.map((f) => f.label).join('; ')}). ⚠ That is not zero — it means nobody put a number on it.`)
  }
  if (notExtracted.length) {
    s.push(`${notExtracted.length} appraisal table(s) are held with their labels and without their figures (${notExtracted.map((f) => f.label).join('; ')}). The number may exist in the published PDF; we do not hold it.`)
  }
  if (gid && !checked.source) {
    s.push('NO POST-IMPLEMENTATION REVIEW IS HELD for this instrument, so nobody — as far as this platform can see — has assessed whether the predicted cost was right.')
  }
  const noFigure = predicted.figures.every((f) => f.state !== 'PUBLISHED')
  if (gid && predicted.source && noFigure) {
    s.push('No monetised figure could be quoted for this measure from what we hold.')
  }
  if (!measured.series.length) {
    s.push('No official statistics series was identified that bears on this subject, so the outturn is not measured by a published series we can name.')
  }
  // ⚠ THE UNBUILT LINKAGES, NAMED. "We did not look" must be distinguishable from "there is
  // nothing", and the only way to do that is to say which searches did not happen.
  s.push('NOT SEARCHED, because the linkage is not built: NAO reports, Public Accounts Committee reports and independent reviews are NOT linked to the measure they examine, so a review of this measure could exist in the corpus and not appear above.')
  return {
    row: 'NOT KNOWN',
    whatItIs: 'what nobody has established — stated plainly, because an absence is a finding',
    source: null, figures: [], statements: s, series: [], comparisonKind: null,
  }
}

// ── the coverage line, generated from live state ─────────────────────────────────────────────────

/**
 * ⚠⚠ GENERATED ON EVERY CALL FROM WHAT WAS ACTUALLY CONSULTED, NEVER HARDCODED (§3). The
 * cross-reference graph already works this way and a check fails its build if a coverage string
 * states a figure about the corpus; the same rule applies here, and `check:s18-costing` asserts
 * that this function's output contains no digit that did not come from a live count.
 */
async function coverageLine(
  gid: string | null, sectionsHeld: number, measured: CostingRow, direction: CostingBlock['direction'],
): Promise<string> {
  // ⚠⚠ COUNTED BY STAGE, NOT BY SECTION TITLE, AND THE FIRST VERSION OF THIS LINE GOT IT WRONG BY
  // 17×. It said "1,235 sections are post-implementation reviews", which is a true count of
  // sections whose TITLE says so and a false statement about how many reviews exist: 25 of 30 such
  // sections are the front-sheet box promising a future review (see `impactLegOf`). The real figure
  // is the number of assessments whose STAGE is Post Implementation — 71 of 1,169, 6.1%. A coverage
  // line that overstates the platform's own coverage is the exact failure the "generated from live
  // state" rule exists to prevent, arriving from inside the generator.
  const held = await prisma.$queryRaw<Array<{ assessments: number; reviews: number }>>`
    SELECT count(DISTINCT split_part(id, ':', 2))::int AS assessments,
           count(DISTINCT split_part(id, ':', 2)) FILTER (
             WHERE trim(split_part(attribution, '—', 2)) ILIKE 'post%implementation%'
           )::int AS reviews
    FROM corpus_sections WHERE corpus = 'impact-assessments' AND status = 'compiled'`
  const h = held[0]
  const parts = [
    `WHAT THIS BLOCK LOOKED AT (${direction.toLowerCase()}-looking).`,
    `PREDICTED and CHECKED: the ${h.assessments.toLocaleString()} impact assessments held on this platform, of which ${h.reviews.toLocaleString()} are post-implementation REVIEWS — ⚠ a section headed "Post-implementation review" inside an ordinary assessment is a box promising a future review, not a review, and is not counted here`
      + (gid ? `; ${sectionsHeld} section(s) are held for this instrument.` : '; no instrument was named, so none was read.'),
    `MEASURED: the official statistics catalogue — it says WHETHER a series exists and never what the number is.`,
    `COMPARABLE: matched BY SUBJECT inside the impact-assessment collection.`,
    `NOT BUILT, and therefore not searched: comparison by MECHANISM, and any link from a measure to an NAO, PAC or independent review of it.`,
  ]
  return parts.join(' ')
}

/** 25-C §2.2 — split at construction. The SUBSTANCE is the user's; only the imperative is the
 *  model's. A caveat the user cannot see is a caveat that cannot protect them. */
export const COSTING_NOTE: RenderedBlock = {
  forUser:
    '⚠ A PREDICTION IS NOT AN OUTCOME. Everything on the PREDICTED row is what a department '
    + 'expected before the measure took effect. Unless the CHECKED row names a review, nobody has '
    + 'established what actually happened. ⚠ Figures are shown with the PRICE BASE YEAR they were '
    + 'published in; two figures with different base years are in different units and are not '
    + 'comparable as they stand. ⚠ "Not estimated" means nobody put a number on it — it does not '
    + 'mean the cost, or the benefit, was nil.',
  forModel:
    'Never present a PREDICTED figure as an outcome, and never fill the CHECKED row from the '
    + 'PREDICTED one. Never compare two figures with different price base years, and never deflate '
    + 'one yourself. Never write or imply zero where the state is NOT_ESTIMATED or NOT_EXTRACTED. '
    + 'If the COMPARABLE row is used, say that the comparison is by subject and not by mechanism.',
}

// ── rendering ────────────────────────────────────────────────────────────────────────────────────

/**
 * The block as the contract in §3 draws it.
 *
 * ⚠ EVERY FIGURE CARRIES ITS SOURCE AND ITS DATE IN THE TEXT ITSELF, not behind a link. §3: *"on
 * paper there are no clicks, so it travels into the document, not behind a link."*
 */
export function costingBlock(b: CostingBlock): RenderedBlock {
  const lines: string[] = [`COST AND BENEFIT — ${b.instrumentTitle ?? b.subject}`]
  for (const r of b.rows) {
    lines.push(`  ${r.row.padEnd(10)} ${r.whatItIs}`)
    if (r.source) lines.push(`    source: ${r.source.title} [${r.source.id}${r.source.date ? ` · ${r.source.date}` : ''}${r.source.url ? ` · ${r.source.url}` : ''}]`)
    for (const f of r.figures) {
      const base = f.priceBase ? `${f.priceBase} prices` : '⚠ price base year NOT STATED — not comparable with another figure'
      const state = f.state === 'PUBLISHED' ? '' : f.state === 'NOT_ESTIMATED'
        ? '  ⚠ the department recorded this as NOT ESTIMATED — that is not zero'
        : '  ⚠ we do not hold the figure for this table'
      lines.push(`    · ${f.label} [${base}]${state}`)
      lines.push(`        "${f.verbatim}"`)
    }
    for (const s of r.statements) lines.push(`    · ${s}`)
    for (const s of r.series) {
      const on = r.matchedOn?.[s.seriesKey] ?? []
      const why = on.length ? `matched on: ${on.join(', ')}` : '⚠ matched on NONE of the subject’s own words'
      lines.push(`    · ${s.seriesLabel} — ${s.source} · ${s.geographyLabel} · ${s.firstPeriod ?? '?'}–${s.lastPeriod ?? '?'} [${why}; series exists, this layer never returns its values]`)
    }
    if (r.comparisonKind) lines.push(`    ⚠ ${r.comparisonKind}`)
  }
  lines.push('')
  lines.push(b.coverage)
  return { forUser: `${lines.join('\n')}\n\n${b.note.forUser}`, forModel: b.note.forModel }
}
