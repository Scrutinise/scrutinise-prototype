// ─────────────────────────────────────────────────────────────────────────────
// 26-AA item 9(c) — THE STATISTICS THE COST–BENEFIT ANALYSIS READS, with their release dates, price bases and suppressed cells.
// Server only (the stats database). Kept apart from stats-query.ts, which is mirrored script-side and stays as it is.
//
//   readCell(seriesKey)        one cell by its source series id: a value, a suppressed state ([c]/[n] with the publisher's words), or absent
//   cssSalaryFloor(level, body) decision 340: the gross median salary; where the body's cell is suppressed, the cell AND the named fallback
//   deflatorRelease(index)      which dated release the platform's deflator series is, checked year by year, or why it is not one
//   cbaStatsHeld()              what is held, for the engine's Gaps (341)
//
// ⚠ Dates are read `::text`: the driver turns a DATE into a JS Date at local midnight, which in British Summer Time is 23:00 the day
//   before (30 Jun read as 29 Jun 23:00Z). A release date is a date.
// ─────────────────────────────────────────────────────────────────────────────

import { statsQuery } from './stats-db'
import { type StatCell, type CssLevel, type SalaryFloor, css7Key, css25Key, CSS_TABLE7_LEVEL } from './cell-pure'

export const CSS_DATASET = 'css-2026'
export const DEFLATOR_DATASET = 'hmt-gdp-deflators'

/** One cell of a dataset, by its source series id. A series with neither a value nor a suppressed cell is `absent`, with why. */
export async function readCell(datasetId: string, sourceSeriesId: string): Promise<StatCell> {
  const rows = await statsQuery<Record<string, unknown>>(
    `SELECT s.id, s.unit,
            o."periodLabel" AS "oLabel", o.value::text AS value, o."releaseDate"::text AS "oRelease", o."priceBasis" AS "oBasis",
            c."periodLabel" AS "cLabel", c.marker, c."markerText", c."releaseDate"::text AS "cRelease", c."priceBasis" AS "cBasis"
       FROM stat_series s
       LEFT JOIN stat_observation o ON o."seriesId" = s.id
       LEFT JOIN stat_suppressed_cell c ON c."seriesId" = s.id
      WHERE s."datasetId" = $1 AND s."sourceSeriesId" = $2
      ORDER BY o."periodStart" DESC NULLS LAST, c."periodStart" DESC NULLS LAST
      LIMIT 1`,
    [datasetId, sourceSeriesId],
  )
  const r = rows[0]
  if (!r) return { kind: 'absent', seriesId: null, why: `${datasetId} has no series "${sourceSeriesId}"` }
  if (r.value != null) {
    return { kind: 'value', seriesId: String(r.id), periodLabel: String(r.oLabel), value: Number(r.value), unit: String(r.unit), releaseDate: (r.oRelease as string | null) ?? null, priceBasis: (r.oBasis as string | null) ?? null }
  }
  if (r.marker === 'c' || r.marker === 'n') {
    return { kind: 'suppressed', seriesId: String(r.id), periodLabel: String(r.cLabel), marker: r.marker, markerText: String(r.markerText), releaseDate: (r.cRelease as string | null) ?? null, priceBasis: (r.cBasis as string | null) ?? null }
  }
  return { kind: 'absent', seriesId: String(r.id), why: 'the series holds no cell' }
}

/** Decision 340 — the salary floor for a level, in one body if named. Where the body's cell is suppressed or absent, the cell stays as it
 *  is (shown as suppressed) and the fallback, the grade across all departments (Table 7), is read and NAMED; never a silent substitute. */
export async function cssSalaryFloor(level: CssLevel, body: string | null = null): Promise<SalaryFloor> {
  if (!body) return { cell: await readCell(CSS_DATASET, css7Key(level)), fallback: null, level, body: null }
  const cell = await readCell(CSS_DATASET, css25Key(level, body))
  if (cell.kind === 'value') return { cell, fallback: null, level, body }
  return { cell, fallback: { cell: await readCell(CSS_DATASET, css7Key(level)), words: `the grade across all departments (Table 7, ${CSS_TABLE7_LEVEL[level]})` }, level, body }
}

export interface DeflatorRelease { held: boolean; vintage: string | null; releaseDate: string | null; priceBasis: string | null; why: string | null; yearsCompared: number }

/** Which dated release the platform's deflator index (DeflatorSeries, the one the engine uses) IS: compared year by year with each
 *  financial-year index release Ingest holds. A match names the release; no match says which years differ. */
export async function deflatorRelease(index: ReadonlyArray<{ year: number; index: number }>): Promise<DeflatorRelease> {
  if (!index.length) return { held: false, vintage: null, releaseDate: null, priceBasis: null, why: 'no deflator series is held', yearsCompared: 0 }
  const rows = await statsQuery<Record<string, unknown>>(
    `SELECT s."forecastVintage" AS vintage, o."periodLabel" AS label, o."periodStart"::text AS start, o.value::text AS value,
            o."releaseDate"::text AS release, o."priceBasis" AS basis
       FROM stat_series s JOIN stat_observation o ON o."seriesId" = s.id
      WHERE s."datasetId" = $1 AND s."sourceSeriesId" = 'gdp_deflator_index:FY'`,
    [DEFLATOR_DATASET],
  )
  const byVintage = new Map<string, Array<{ year: number; value: number; release: string | null; basis: string | null }>>()
  for (const r of rows) {
    const year = Number(String(r.start).slice(0, 4)) // FY 2025-26 starts April 2025 → 2025, the engine's year
    const v = String(r.vintage)
    if (!byVintage.has(v)) byVintage.set(v, [])
    byVintage.get(v)!.push({ year, value: Number(r.value), release: (r.release as string | null) ?? null, basis: (r.basis as string | null) ?? null })
  }
  const misses: string[] = []
  for (const [vintage, obs] of byVintage) {
    const at = new Map(obs.map((o) => [o.year, o.value]))
    const differ = index.filter((d) => at.get(d.year) == null || Math.abs((at.get(d.year) as number) - d.index) > 0.005)
    if (!differ.length) return { held: true, vintage, releaseDate: obs[0].release, priceBasis: obs[0].basis, why: null, yearsCompared: index.length }
    misses.push(`${vintage}: ${differ.length} of ${index.length} years differ`)
  }
  return { held: false, vintage: null, releaseDate: null, priceBasis: null, why: misses.length ? `the series held matches no dated release (${misses.join('; ')})` : 'no dated deflator release is held', yearsCompared: index.length }
}

/** A series' suppressed cells (any dataset), oldest first — for a reader that lists observations, so a suppressed period is shown as
 *  its marker rather than missing. */
export async function getSuppressedCells(seriesId: string): Promise<Array<{ periodLabel: string; marker: 'c' | 'n'; markerText: string; releaseDate: string | null }>> {
  const rows = await statsQuery<Record<string, unknown>>(
    `SELECT "periodLabel", marker, "markerText", "releaseDate"::text AS release FROM stat_suppressed_cell WHERE "seriesId" = $1 ORDER BY "periodStart" ASC LIMIT 60`,
    [seriesId],
  )
  return rows.map((r) => ({ periodLabel: String(r.periodLabel), marker: r.marker === 'n' ? 'n' : 'c', markerText: String(r.markerText), releaseDate: (r.release as string | null) ?? null }))
}

/** css-2026's salary table is held with its release, or why not. */
export async function cssHeld(): Promise<{ held: boolean; releaseDate: string | null; priceBasis: string | null }> {
  const c = await readCell(CSS_DATASET, css7Key('ALL'))
  return c.kind === 'value' ? { held: true, releaseDate: c.releaseDate, priceBasis: c.priceBasis } : { held: false, releaseDate: null, priceBasis: null }
}
