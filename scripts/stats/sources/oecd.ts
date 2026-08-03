// OECD — SDMX REST API (sdmx.oecd.org/public/rest).
//
// LICENCE, VERIFIED AT SOURCE 2026-08-03 (oecd.org/en/about/terms-conditions.html, §3 "Data"):
//   "you can extract from, download, copy, adapt, print, distribute, share and embed Data for
//    any purpose, EVEN FOR COMMERCIAL USE" (attribution required).
// This CONTRADICTS the sprint brief, which said to set commercialUseExcluded=true because
// "pre-2024 content is CC-BY-NC". Two things are wrong with that premise: (a) the CC-BY-NC
// question concerns OECD *written content* (publications), not Data, which has its own §3; and
// (b) even the pre-1-July-2024 written-content clause permits "commercial and non-commercial"
// use. So commercialUseExcluded = FALSE for OECD data. See CHANGE_LOG for the full quote.
// Caveat OECD itself states: individual datasets may carry third-party restrictions declared in
// their own metadata — this applies to the COFOG/public-finance flows ingested here, which are
// OECD-owned national-accounts aggregates.
//
// Data is pulled as CSV-with-labels rather than SDMX-ML: same endpoint, far less parsing risk,
// and it carries both codes and human labels in one response.
import { politeFetch } from '../lib/fetch-utils'
import { normaliseGeography } from '../lib/iso'

const SDMX = 'https://sdmx.oecd.org/public/rest/data'

/** OECD unit codes -> our unit vocabulary. Unmapped units are skipped, not guessed. */
export const OECD_UNIT_MAP: Record<string, string> = {
  PT_B1GQ: 'PERCENT_GDP',                  // % of GDP — the comparative headline
  PT_OTE_S13: 'PERCENT_TOTAL_EXPENDITURE', // % of total general government expenditure
  USD_PPP: 'USD_PPP_PER_CAPITA',
}

/** Government expenditure by COFOG function, yearly-updates flow (the comparative spine). */
export const OECD_COFOG_FLOW = 'OECD.GOV.GIP,DSD_GOV_COFOG@DF_GOV_COFOG_YU,1.0'

export interface OecdObservation {
  geography: string
  cofogCode: string | null
  cofogName: string | null
  unit: string
  year: number
  value: number
}

/** Minimal RFC4180-ish splitter — OECD labels contain commas inside quotes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q
    } else if (c === ',' && !q) { out.push(cur); cur = '' } else cur += c
  }
  out.push(cur)
  return out
}

/**
 * `EXPENDITURE` codes are "GF" + COFOG digits: GF07 -> 07 (top level), GF0605 -> 06.5
 * (sub-function). Mapping them onto the existing cofogFunctionCode axis is what makes UK PESA
 * data and OECD comparator data line up on the same column.
 */
export function cofogFromExpenditureCode(code: string): string | null {
  const m = /^GF(\d{2})(\d{2})?$/.exec(code.trim().toUpperCase())
  if (!m) return null
  const [, major, minor] = m
  // OECD's sub-codes are zero-padded two digits ("05"); COFOG writes them unpadded ("06.5").
  return minor ? `${major}.${String(parseInt(minor, 10))}` : major
}

/**
 * Fetch the whole COFOG flow for a period window and map it into our axes.
 *
 * LARGEST WINDOW FIRST, subdividing to 10- then 5-year windows only on failure (worst case 7
 * requests). This shape is chosen because the endpoint has TWO failure modes that both surface
 * as HTTP 500 — see docs/STATS_REFRESH.md for the measurements:
 *
 *   QUOTA  — too many requests. Intermittent, reported as 500 as often as 429. Waiting helps.
 *            A 20-request per-year pull failed 19 of 20 while the identical single-year request
 *            in isolation returned 200 with 426 KB.
 *   SIZE   — one window too large. Deterministic. Waiting does NOT help: after a full 12-minute
 *            cooldown with no other traffic, the whole-window request (~50 MB) still 500'd.
 *
 * Largest-first is right for both at once: it minimises request count (quota) while searching
 * downward for a window small enough to serve (size). Going back to per-year requests maximises
 * the quota problem to solve a size problem it cannot touch.
 *
 * Honest limit on the above: only the FIRST request after a cooldown cleanly isolates size from
 * quota. Later failures in the same run follow ~15 real requests (each failure carries 4
 * retries) and cannot be attributed to one mode or the other from the log alone.
 */
export async function fetchOecdCofog(startYear: number, endYear: number): Promise<OecdObservation[]> {
  // Try the whole window in ONE request first, then subdivide only if that fails.
  //
  // Request COUNT is the binding constraint here, not request size. A 20-request per-year pull
  // exhausted the quota and failed 19/20 (mixed 429 and 500) — while the same window fetched as
  // a handful of larger requests stays inside it. Chunk sizes are tried largest-first for
  // exactly that reason.
  for (const span of [endYear - startYear + 1, 10, 5]) {
    const windows: Array<[number, number]> = []
    for (let s = startYear; s <= endYear; s += span) windows.push([s, Math.min(s + span - 1, endYear)])
    console.log(`    OECD COFOG: trying ${windows.length} request(s) of up to ${span} year(s)`)

    const all: OecdObservation[] = []
    const failures: string[] = []
    for (const [a, b] of windows) {
      try {
        const rows = await fetchOecdCofogWindow(a, b)
        all.push(...rows)
        console.log(`    OECD COFOG ${a}-${b}: ${rows.length} observations`)
      } catch (e) {
        failures.push(`${a}-${b}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (failures.length === 0 && all.length > 0) return all
    console.warn(`    OECD COFOG: ${failures.length}/${windows.length} window(s) failed at span=${span}` +
      (span > 5 ? ' — subdividing' : '') + `: ${failures.slice(0, 2).join(' | ')}`)
    if (span === 5) return finalise(all, failures, windows.length)
  }
  return []
}

function finalise(all: OecdObservation[], failures: string[], attempted: number): OecdObservation[] {
  if (failures.length) console.warn(`    OECD COFOG — ${failures.length} window(s) failed: ${failures.join(' | ')}`)
  if (all.length === 0) throw new Error(`OECD COFOG returned no rows; failures: ${failures.join(' | ') || 'none'}`)
  // Refuse a run that lost most of the window. Without this, a throttled pull that returns one
  // good slice and a pile of HTTP 500s would be recorded as a SUCCESS holding a stub "time
  // series" — the same silent-partial-success failure mode the zero-observation rule exists to
  // prevent, just sitting above zero. Better to fail loudly and let the next tick retry.
  if (failures.length > attempted / 2) {
    throw new Error(
      `OECD COFOG lost ${failures.length} of ${attempted} windows (throttling — this endpoint returns `
      + `HTTP 500 as well as 429 under load). Refusing a partial window. First failures: ${failures.slice(0, 3).join(' | ')}`,
    )
  }
  return all
}

/**
 * SDMX series key that asks for only the units we actually store.
 *
 * `/all` returns four UNIT_MEASURE variants; `OECD_UNIT_MAP` maps three and the handler
 * discards the rest — so a quarter of every payload is fetched only to be thrown away, on an
 * endpoint whose hard limit is payload size. Filtering server-side is the real fix for the
 * whole-window 500.
 *
 * Key order is the DSD dimension order, read off the CSV-with-labels column order we already
 * have (no extra request needed to determine it):
 *   FREQ . REF_AREA . MEASURE . UNIT_MEASURE . SECTOR . EXPENDITURE . EDITION . CATEGORY
 * Empty position = "all values for that dimension".
 *
 * NOT YET CONFIRMED against a live response (the quota was spent working out the failure modes),
 * so `fetchOecdCofogWindow` tries this first and falls back to `/all` on any non-200 — a wrong
 * key costs one request, never the ingest.
 */
const OECD_UNIT_FILTER = Object.keys(OECD_UNIT_MAP).join('+')

export async function fetchOecdCofogWindow(startYear: number, endYear: number): Promise<OecdObservation[]> {
  const period = `format=csvfilewithlabels&startPeriod=${startYear}&endPeriod=${endYear}`
  const filteredKey = `A..GE.${OECD_UNIT_FILTER}.S13...`
  let res = await politeFetch(`${SDMX}/${OECD_COFOG_FLOW}/${filteredKey}?${period}`, { delayMs: 5000, retries: 4 })
  if (!res.ok) {
    // Fall back to the unfiltered key: either the key shape is wrong or the filter isn't the
    // constraint. Logged so the next reader knows which path produced the data.
    console.warn(`    OECD COFOG ${startYear}-${endYear}: filtered key returned HTTP ${res.status}, falling back to /all`)
    res = await politeFetch(`${SDMX}/${OECD_COFOG_FLOW}/all?${period}`, { delayMs: 5000, retries: 4 })
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length < 2) return []
  const head = splitCsvLine(lines[0])
  const col = (n: string) => head.indexOf(n)
  const iArea = col('REF_AREA')
  const iUnit = col('UNIT_MEASURE')
  const iExp = col('EXPENDITURE')
  const iExpName = col('Expenditure')
  const iTime = col('TIME_PERIOD')
  const iVal = col('OBS_VALUE')
  if ([iArea, iUnit, iExp, iTime, iVal].some((i) => i < 0)) {
    throw new Error(`OECD COFOG CSV missing expected columns; header was: ${head.join(',').slice(0, 300)}`)
  }

  const out: OecdObservation[] = []
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsvLine(lines[i])
    const raw = c[iVal]
    if (raw === undefined || raw.trim() === '') continue
    const value = Number(raw)
    if (!Number.isFinite(value)) continue
    const geography = normaliseGeography(c[iArea] ?? '')
    if (!geography) continue
    const year = parseInt(c[iTime] ?? '', 10)
    if (!Number.isFinite(year)) continue
    out.push({
      geography,
      cofogCode: cofogFromExpenditureCode(c[iExp] ?? ''),
      cofogName: iExpName >= 0 ? (c[iExpName] ?? null) : null,
      unit: c[iUnit] ?? '',
      year,
      value,
    })
  }
  return out
}
