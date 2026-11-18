// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Y decision 335 — THE APPRAISAL PERIOD. PURE; CLIENT-SAFE (imports nothing).
//
//   · the period is the owner's, on the idea: 1–60 years, default 10 (the Green Book's usual for policy);
//   · it has a stated START YEAR (the first year of delivery) and a PRICE YEAR (the year the figures are shown in, and the PV base year);
//   · years are FINANCIAL years, named by the calendar year they start in (2026 = 2026-27);
//   · the default price year is the LATEST YEAR THE DEFLATOR SERIES HOLDS (CCh GO, 18 Nov 12:05, replacing the brief's "current financial
//     year", which the series did not reach), shown as "Price year 2025-26 (latest deflator release held)". It moves forward by itself when
//     Ingest loads a newer release. With no series at all it falls back to the current financial year. The owner can still set it.
//
// Appraisal year t (0-based) is financial year startYear + t. Its discount year is (startYear − priceYear) + t: year 0 of the schedule is
// the price year, undiscounted. The start year may not be before the price year (discounting is not applied retrospectively, Green Book
// 6.58), and the last discount year may not pass 125 (GB discounting 3.10).
// ─────────────────────────────────────────────────────────────────────────────

export const APPRAISAL_DEFAULT_YEARS = 10
export const APPRAISAL_MIN_YEARS = 1
export const APPRAISAL_MAX_YEARS = 60
/** The schedule's last year (GB discounting 3.10). Restated from costing-params so this file stays import-free; check:lex-26y asserts they agree. */
export const SCHEDULE_LAST_YEAR = 125

/** The financial year (named by its starting calendar year) that `now` falls in: April onwards is the new year. */
export function currentFinancialYear(now: Date): number {
  return now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}

/** "2026-27". */
export function fyWords(y: number): string {
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`
}

export interface AppraisalPeriod {
  years: number
  startYear: number
  priceYear: number
  /** Which of the three the owner set (the rest are defaults) — the Assumptions list says which. */
  set: { years: boolean; startYear: boolean; priceYear: boolean }
  /** Where an unset price year came from: the latest deflator year, or (no series held) the current financial year. */
  priceYearFrom?: 'owner' | 'latest-deflator' | 'current-year'
}

export interface IdeaPeriodColumns { appraisalYears: number | null; appraisalStartYear: number | null; cbaPriceYear: number | null }

export function resolvePeriod(cols: IdeaPeriodColumns, now: Date, latestDeflatorYear: number | null = null): AppraisalPeriod {
  const priceYear = cols.cbaPriceYear ?? latestDeflatorYear ?? currentFinancialYear(now)
  return {
    priceYearFrom: cols.cbaPriceYear != null ? 'owner' : latestDeflatorYear != null ? 'latest-deflator' : 'current-year',
    years: cols.appraisalYears ?? APPRAISAL_DEFAULT_YEARS,
    startYear: cols.appraisalStartYear ?? priceYear,
    priceYear,
    set: { years: cols.appraisalYears != null, startYear: cols.appraisalStartYear != null, priceYear: cols.cbaPriceYear != null },
  }
}

/** "Price year 2025-26 (latest deflator release held)" / "(set by the owner)" / "(the current financial year: no deflator series is held)". */
export function priceYearWords(p: AppraisalPeriod): string {
  return `Price year ${fyWords(p.priceYear)} (${p.priceYearFrom === 'owner' || p.set.priceYear ? 'set by the owner' : p.priceYearFrom === 'latest-deflator' ? 'latest deflator release held' : 'the current financial year: no deflator series is held'})`
}

/** The discount year of appraisal year t. */
export function discountYearOf(p: Pick<AppraisalPeriod, 'startYear' | 'priceYear'>, t: number): number {
  return p.startYear - p.priceYear + t
}

/** A refusal in words, or null. Used by the settings route AND the engine, so the box and the sum cannot disagree. */
export function periodRefusal(p: { years: number; startYear: number; priceYear: number }): string | null {
  if (!Number.isInteger(p.years) || p.years < APPRAISAL_MIN_YEARS || p.years > APPRAISAL_MAX_YEARS) {
    return `Not saved: the appraisal period is ${p.years} years; it must be a whole number from ${APPRAISAL_MIN_YEARS} to ${APPRAISAL_MAX_YEARS}.`
  }
  if (!Number.isInteger(p.startYear) || !Number.isInteger(p.priceYear) || p.priceYear < 1955 || p.priceYear > 2100) {
    return 'Not saved: the start year and price year must each be a year from 1955 to 2100.'
  }
  if (p.startYear < p.priceYear) {
    return `Not saved: the start year (${fyWords(p.startYear)}) is before the price year (${fyWords(p.priceYear)}). Discounting is not applied to years before the price year (Green Book 6.58), so the start year must be the price year or later.`
  }
  const last = discountYearOf(p, p.years - 1)
  if (last > SCHEDULE_LAST_YEAR - 1) {
    return `Not saved: the last year of this period is year ${last} of the discount schedule, and the schedule stops at year ${SCHEDULE_LAST_YEAR} (GB discounting 3.10); a one-year delay test would pass it. Shorten the period or start it sooner.`
  }
  return null
}
