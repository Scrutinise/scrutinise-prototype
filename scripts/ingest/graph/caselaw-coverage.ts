/**
 * caselaw-coverage.ts — BRIEF_GRAPH_5 §1. THE COVERAGE BOUNDARY, DECLARED BEFORE ANYTHING IS BUILT.
 *
 * ── WHY THIS FILE EXISTS, AND WHY IT IS FIRST ────────────────────────────────
 *
 * ⚠⚠ **A LINE OF AUTHORITY THAT STARTS IN THE MIDDLE IS WORSE THAN NO LINE AT ALL**, because the
 * reader assumes they are seeing the whole of it. Ten pre-2001 authorities put through the real
 * search returned 10 of 10 absent, and 3 of 10 returned a DIFFERENT case with a similar name —
 * *Caparo Industries v Dickman* answered with *Caparo Atlas Fastenings*, an employment case.
 * **The absence never presents as an absence.** So the statement is built before the extraction,
 * not bolted on after, which is the only ordering in which it cannot be forgotten.
 *
 * ── THE TRAP THIS FILE IS SHAPED AROUND: MIN(date) IS A DECOY ────────────────
 *
 * `coverage.ts` already had a case-law boundary and it was one `MIN("itemDate")` across a corpus
 * list. That is the wrong instrument twice over:
 *
 *   1. ⚠⚠ **The earliest row held is not the floor.** `tna-caselaw`'s earliest item is 1965, and
 *      it holds 239 items before 2003 against 74,657 from 2003 on. A statement reading "our case
 *      law runs from 1965" is true of the MINIMUM and false of the HOLDING, and it is false in the
 *      reassuring direction — it tells a reader the Victorian authority they are looking for would
 *      have been found if it existed. So this module reports the earliest item AND the year the
 *      collection actually becomes continuous, AND the size of the thin tail between them.
 *   2. ⚠⚠ **A boundary summed across jurisdictions is a different lie.** Strasbourg runs to 1956
 *      and Northern Ireland to 1984, so ONE minimum over all collections returns 1956 — and a
 *      reader asking about an English authority from 1975 is told the corpus reaches back two
 *      decades before it does. Every figure here is PER COLLECTION and they are never summed.
 *
 * ── THE CLIFF IS DERIVED, NOT WRITTEN DOWN ───────────────────────────────────
 *
 * ⚠ There is no `2003` in this file. The brief names that year and the year is right, but a
 * hardcoded floor is the "17.5 GB alert line" again: a figure that outlives its own truth and
 * cannot be corrected by re-running anything. `continuousFrom` is computed from the live annual
 * histogram by ONE stated rule (see `cliffYear`), so a collection that gains a decade of backfill
 * reports the new floor without anybody editing a string.
 *
 * ⚠ And no sentence in `describeCaseLawBoundary()` contains a digit about the corpus, for the same
 * reason `describeCoverage()` doesn't — `check-graph5-boundary.ts` fails on one.
 *
 *   import { caseLawCoverage, describeCaseLawBoundary } from './caselaw-coverage'
 */
import { getNeonPool } from '../shared/neon-pool'

/**
 * ⚠⚠ THE COLLECTIONS, AS THE DATABASE ACTUALLY SPELLS THEM — verified by row count, not by
 * reading a previous list. `coverage.ts` shipped `['caselaw', 'caselaw-fcl', 'et-decisions',
 * 'tax-tribunals']`: the first two hold ZERO rows and do not exist, and the list omitted
 * `tna-caselaw` — all 74,896 judgments, the entire English holding. That boundary was therefore
 * computed over the two tribunal collections alone and answered with a floor of 1989, which is
 * both wrong and wrong in the reassuring direction. A corpus name that matches nothing is
 * indistinguishable from a corpus that is empty, so `caseLawCoverage()` REPORTS a named
 * collection holding no rows rather than letting it vanish out of the aggregate.
 */
export const CASE_LAW_COLLECTIONS = [
  'tna-caselaw',      // England & Wales + UKSC/UKPC, from The National Archives' Find Case Law
  'et-decisions',     // employment tribunals
  'scottish-courts',
  'ni-judgments',
  'tax-tribunals',
  'echr-hudoc',       // Strasbourg
  'cma-cases',        // competition decisions — not a court, and named so the reader can discount it
] as const

/** Dates this early are a parse artefact, not a holding (`0001-01-01` appears in scottish-courts). */
const MIN_REAL_DATE = '1200-01-01'

/**
 * The share of a collection's typical annual volume below which a year is "thin".
 * A year under this is one where the collection is NOT continuous.
 */
const CONTINUITY_FRACTION = 0.25

export type CollectionBoundary = {
  corpus: string
  rows: number
  /** ⚠ rows carrying no date at all — they cannot be placed inside or outside the window */
  undated: number
  /** the earliest item held. ⚠ NOT the floor — see `continuousFrom` */
  earliestItem: string | null
  latestItem: string | null
  /** ⚠⚠ which of the three shapes this collection has — see `collectionShape` */
  shape: CollectionShape
  /**
   * ⚠⚠ THE FIGURE A READER NEEDS, and only when `shape === 'cliff'`. The first year from which
   * every subsequent year holds at least CONTINUITY_FRACTION of the collection's typical annual
   * volume — where it stops being a scatter of survivors and starts being a holding.
   * **null on a ramp, and that null is an answer, not a missing value.**
   */
  continuousFrom: number | null
  /** items held BEFORE `continuousFrom` — the thin tail. Real, quotable, and not a line of authority. */
  tailRows: number
}

export type CaseLawBoundary = {
  generatedAt: string
  collections: CollectionBoundary[]
  /** collections named above that hold no rows at all — reported, never silently dropped */
  namedButEmpty: string[]
  totalRows: number
}

/**
 * ⚠⚠ THREE STATES, NOT TWO — AND THE THIRD IS THE ONE THAT KEEPS THIS HONEST.
 *
 * A collection can be shaped three ways, and telling a reader the wrong one is the whole failure
 * this module exists to prevent:
 *
 *   'cliff' — a sharp floor with a scatter of older survivors beneath it. `tna-caselaw` holds 18
 *             items dated 2002 and 2,054 dated 2003. THAT is a floor, and the 239 items below it
 *             are real documents that are emphatically not a line of authority.
 *   'ramp'  — no floor at all. `echr-hudoc` climbs from a single 1956 decision to a plateau in the
 *             1990s and falls away again; 98.7% of it sits below any year the cliff test would
 *             pick. ⚠ Reporting "continuous from 2025" for that collection would be a confident
 *             wrong answer of exactly the kind §1 is about — so the answer is NO FLOOR, said out
 *             loud, with the span and the unevenness instead.
 *   'thin'  — too few years to say anything. Reported as unknown rather than guessed.
 *
 * ⚠ THE FINAL YEAR IS ALWAYS PARTIAL and must not be allowed to end the walk. Ingest stops at a
 * date, not at a new year's eve — `tax-tribunals` runs to 2024-06-11, so its 2024 holds 102 against
 * a typical 649. A first version of this rule walked back from the newest year, hit that partial
 * year, stopped immediately, and reported `tax-tribunals` as "continuous from 2024 to 2024" with an
 * 11,987-document "tail". The floor it named was the cut-off of our own ingest run.
 */
export type CollectionShape = 'cliff' | 'ramp' | 'thin'

/**
 * Above this share of the collection sitting BELOW the candidate floor, there is no floor — the
 * collection is a ramp and saying otherwise would bury most of it in a footnote called a "tail".
 */
const MAX_TAIL_SHARE = 0.05

export function collectionShape(byYear: Array<{ year: number; n: number }>):
  { shape: CollectionShape; continuousFrom: number | null; tailRows: number } {
  const years = [...byYear].filter(y => y.n > 0).sort((a, b) => a.year - b.year)
  const dated = years.reduce((s, y) => s + y.n, 0)
  if (years.length < 4) return { shape: 'thin', continuousFrom: null, tailRows: 0 }

  // `typical` is the median over the BUSIER HALF of years. A median over ALL years is dragged down
  // by the sparse tail until the threshold sits beneath the tail itself, and the rule then reports
  // the earliest year as the floor — the very answer it exists to avoid.
  const counts = years.map(y => y.n).sort((a, b) => a - b)
  const busier = counts.slice(Math.floor(counts.length / 2))
  const typical = busier[Math.floor(busier.length / 2)]
  const threshold = typical * CONTINUITY_FRACTION

  // ⚠ the newest year is partial by construction; the walk starts below it.
  const lastComplete = years.length - 2
  let floor = years[lastComplete].year
  for (let i = lastComplete; i >= 0; i--) {
    if (years[i].n < threshold) break
    // ⚠ a GAP is a break too: a missing year is a year holding zero, not an absent data point
    if (i < lastComplete && years[i + 1].year - years[i].year > 1) { floor = years[i + 1].year; break }
    floor = years[i].year
  }
  const tailRows = years.filter(y => y.year < floor).reduce((s, y) => s + y.n, 0)
  return dated > 0 && tailRows / dated > MAX_TAIL_SHARE
    ? { shape: 'ramp', continuousFrom: null, tailRows }
    : { shape: 'cliff', continuousFrom: floor, tailRows }
}

export async function caseLawCoverage(): Promise<CaseLawBoundary> {
  const pool = getNeonPool()
  const { rows } = await pool.query(`
    SELECT corpus,
           COUNT(*)::bigint                                                        n_rows,
           COUNT(*) FILTER (WHERE "itemDate" IS NULL)::bigint                      undated,
           MIN("itemDate") FILTER (WHERE "itemDate" > DATE '${MIN_REAL_DATE}')::text earliest,
           MAX("itemDate")::text                                                   latest
      FROM corpus_sections WHERE corpus = ANY($1::text[]) GROUP BY corpus`,
    [CASE_LAW_COLLECTIONS])
  const { rows: hist } = await pool.query(`
    SELECT corpus, EXTRACT(YEAR FROM "itemDate")::int yr, COUNT(*)::bigint n
      FROM corpus_sections
     WHERE corpus = ANY($1::text[]) AND "itemDate" > DATE '${MIN_REAL_DATE}'
     GROUP BY corpus, yr`, [CASE_LAW_COLLECTIONS])

  const byCorpus = new Map<string, Array<{ year: number; n: number }>>()
  for (const h of hist) {
    const a = byCorpus.get(h.corpus) ?? []
    a.push({ year: h.yr, n: Number(h.n) })
    byCorpus.set(h.corpus, a)
  }

  const collections: CollectionBoundary[] = rows.map((r: {
    corpus: string; n_rows: string; undated: string; earliest: string | null; latest: string | null
  }) => {
    const years = byCorpus.get(r.corpus) ?? []
    const { shape, continuousFrom, tailRows } = collectionShape(years)
    return {
      corpus: r.corpus,
      rows: Number(r.n_rows),
      undated: Number(r.undated),
      earliestItem: r.earliest,
      latestItem: r.latest,
      shape,
      continuousFrom,
      tailRows,
    }
  }).sort((a: CollectionBoundary, b: CollectionBoundary) => b.rows - a.rows)

  const present = new Set(collections.map(c => c.corpus))
  return {
    generatedAt: new Date().toISOString(),
    collections,
    namedButEmpty: CASE_LAW_COLLECTIONS.filter(c => !present.has(c)),
    totalRows: collections.reduce((s, c) => s + c.rows, 0),
  }
}

/**
 * The boundary in words, for the coverage block on every case-law edge result.
 * ⚠ No digit about the corpus appears in any literal here — every number is interpolated.
 */
export function describeCaseLawBoundary(b: CaseLawBoundary): string[] {
  const lines: string[] = []
  lines.push(`CASE-LAW COVERAGE — the window these edges could have been found in (generated ${b.generatedAt.slice(0, 16)}Z)`)
  if (b.collections.length === 0) {
    lines.push(`  ⚠⚠ NO case-law collection holds a single row. Every case-law edge count below is zero`)
    lines.push(`     because nothing was searched — not because nothing cites the provision.`)
    return lines
  }
  for (const c of b.collections) {
    const last = (c.latestItem ?? 'unknown').slice(0, 4)
    if (c.shape === 'cliff' && c.continuousFrom !== null) {
      lines.push(`    ${c.corpus} — ${c.rows.toLocaleString()} documents, CONTINUOUS FROM ${c.continuousFrom} to ${last}`)
      if (c.earliestItem !== null && Number(c.earliestItem.slice(0, 4)) < c.continuousFrom) {
        lines.push(`        ⚠ ${c.tailRows.toLocaleString()} older items are held, back to ${c.earliestItem} — a scatter of survivors, NOT a line of authority.`)
        lines.push(`          An authority from that period is far more likely to be absent than present, and its absence is not evidence.`)
      }
    } else if (c.shape === 'ramp') {
      lines.push(`    ${c.corpus} — ${c.rows.toLocaleString()} documents spanning ${(c.earliestItem ?? 'unknown').slice(0, 4)} to ${last}, with NO YEAR FROM WHICH IT BECOMES CONTINUOUS.`)
      lines.push(`        ⚠⚠ Density varies across the span rather than starting at a floor, so neither the`)
      lines.push(`          presence nor the absence of any one decision says much about the period around it.`)
    } else {
      lines.push(`    ${c.corpus} — ${c.rows.toLocaleString()} documents, ⚠ TOO FEW DATED YEARS to state a boundary. Treat the window as unknown.`)
    }
    if (c.undated > 0) lines.push(`        ⚠ ${c.undated.toLocaleString()} documents carry no date and cannot be placed inside or outside this window.`)
  }
  for (const e of b.namedButEmpty) {
    lines.push(`    ${e} — ⚠⚠ NAMED BUT HOLDS NO ROWS. Nothing from this source was searched.`)
  }
  lines.push(`  ⚠⚠ An authority outside a collection's window CANNOT appear in these results, and this`)
  lines.push(`     platform has been measured returning a DIFFERENT case with a similar name in its place.`)
  lines.push(`     A short list here is a statement about our holdings, never about the law.`)
  return lines
}
