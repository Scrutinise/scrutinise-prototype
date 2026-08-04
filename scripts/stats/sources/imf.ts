// IMF — Government Finance Statistics, expenditure by COFOG function.
// SDMX 2.1 REST over api.imf.org, CSV-with-labels.
//
// ─── LICENCE, VERIFIED AT SOURCE 2026-08-04 ──────────────────────────────────────────────
// imf.org/en/about/copyright-and-terms ("Copyright and Usage", effective 11 October 2024).
// The page 403s every programmatic fetch from this environment — WebFetch, node fetch with a
// browser UA, and r.jina.ai all failed — which is why it sat unresolved from 3 Aug. It was
// read in a real browser instead. Do the same if you need to re-check it; do NOT conclude
// from a 403 that the terms are unavailable.
//
// The general terms prohibit commercial use of IMF Content, but a section "The Use of IMF
// Data" overrides that for published statistics and NAMES Government Finance Statistics (GFS)
// explicitly among the covered datasets:
//
//   "You may download, extract, copy, create derivative works, publish, distribute, and use
//    Data obtained from IMF Sites, subject to the following conditions…"
//
// with conditions on attribution, not impairing the integrity of the data, declaring material
// transformations, and passing the terms downstream. It then closes:
//
//   "For any potential commercial reuse of IMF Data, please email copyright@imf.org to
//    request permission."
//
// So: publication and redistribution are permitted outright; COMMERCIAL reuse requires
// written permission. That is `commercialUseExcluded = true` — this is the first genuinely
// non-commercial source in the store, which is what makes the per-series flag load-bearing
// rather than theoretical.
//
// ⚠ THE 3 AUG READING WAS WRONG, and it is worth knowing why. Every data row carries a
// `LICENSE` column reading "© International Monetary Fund Copyright. All Rights Reserved.
// https://www.imf.org/external/terms.htm", which was taken to mean the data could not be
// used. It is a copyright notice pointing AT the terms above, not a prohibition — and the
// URL it points to is itself dead (it 404s; the terms moved to /en/about/copyright-and-terms).
// Corroborating it, every row also carries `ACCESS_SHARING_LEVEL = PUBLIC_OPEN`.
import { politeFetch } from '../lib/fetch-utils'
import { normaliseGeography, COMPARATOR_ISO3 } from '../lib/iso'
import { cofogFromExpenditureCode } from './oecd'

const SDMX = 'https://api.imf.org/external/sdmx/2.1/data'

/** See the licence note above. Commercial reuse needs written permission from the IMF. */
export const IMF_COMMERCIAL_USE_EXCLUDED = true

/** "GFS Government Expenditures by Function", v11.0.0 as at 2026-08-04. */
export const IMF_GFS_COFOG_FLOW = 'IMF.STA,GFS_COFOG'

/**
 * `TYPE_OF_TRANSFORMATION` is IMF's unit axis on this flow. Mapped onto the same vocabulary
 * the OECD module uses so the two comparative sources are directly stackable.
 *
 * `XDC` (domestic currency) is deliberately NOT mapped: each country reports in its own
 * currency, so those rows cannot be compared across countries without an exchange-rate step
 * this layer does not do. Storing them would put 22 mutually incomparable currencies behind
 * one measure name — an invitation to a wrong answer. Unmapped rows are skipped, never
 * guessed (same rule as OECD_UNIT_MAP).
 */
export const IMF_UNIT_MAP: Record<string, string> = {
  POGDP_PT: 'PERCENT_GDP',                 // percent of GDP — the comparative headline
  POTO_PT: 'PERCENT_TOTAL_EXPENDITURE',    // percent of total outlays
}

/** General government. The sector OECD's COFOG flow reports on too, so the two line up. */
const IMF_SECTOR = 'S13'

/** Coverage begins 2007 on this flow; matches the OECD window so comparisons are like-for-like. */
export const IMF_START_YEAR = 2007

export interface ImfObservation {
  geography: string
  sector: string
  indicator: string
  typeOfTransformation: string
  cofogCode: string | null
  cofogName: string | null
  year: number
  value: number
}

/** RFC4180-ish splitter — IMF labels contain commas inside quotes (as OECD's do). */
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
 * Fetch the whole comparative window in ONE request.
 *
 * Measured 2026-08-04: the full key below returned HTTP 200, 52.8 MB, 65,985 rows in 38.6 s —
 * all 22 comparator countries, 2007–2025, 81 COFOG codes. Unlike OECD's flow (which 500s on
 * anything large and has two distinct failure modes both reported as 500 — see
 * STATS_REFRESH.md), this endpoint serves the whole thing, so there is no windowing logic
 * here and none should be added speculatively.
 *
 * The server-side key filter matters even so: it is what keeps 52.8 MB from becoming several
 * hundred. `/all` would return every sector, every unit including domestic currency, and
 * every country the IMF holds.
 *
 * SDMX key order is the DSD_GFS dimension order:
 *   COUNTRY . SECTOR . GFS_GRP . INDICATOR . TYPE_OF_TRANSFORMATION . FREQUENCY
 * An empty position means "all values for that dimension".
 */
export async function fetchImfGfsCofog(
  startYear = IMF_START_YEAR,
  endYear = new Date().getUTCFullYear(),
): Promise<ImfObservation[]> {
  const countries = COMPARATOR_ISO3.join('+')
  const units = Object.keys(IMF_UNIT_MAP).join('+')
  const key = `${countries}.${IMF_SECTOR}...${units}.A`
  const url = `${SDMX}/${IMF_GFS_COFOG_FLOW}/${key}?startPeriod=${startYear}&endPeriod=${endYear}&format=csv`

  // ⚠ The `format=csv` query parameter is IGNORED by this endpoint — the response type comes
  // from content negotiation alone. Without this Accept header the server returns 12 MB of
  // SDMX-ML with an HTTP 200, which the CSV parser reads as "no data rows" and the scheduler
  // then correctly reports as a FAILURE. Do not drop it.
  const res = await politeFetch(url, {
    delayMs: 1000,
    retries: 3,
    headers: { Accept: 'application/vnd.sdmx.data+csv; version=1.0.0, */*' },
  })
  if (!res.ok) throw new Error(`IMF GFS_COFOG HTTP ${res.status} for ${startYear}-${endYear}`)
  const contentType = res.headers.get('content-type') ?? ''
  if (!/csv/i.test(contentType)) {
    throw new Error(
      `IMF GFS_COFOG returned content-type "${contentType}", not CSV — content negotiation failed. `
      + 'Failing loudly rather than letting the CSV parser report an empty result.',
    )
  }
  const text = await res.text()
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length < 2) throw new Error('IMF GFS_COFOG returned no data rows')

  const head = splitCsvLine(lines[0])
  const col = (n: string) => head.indexOf(n)
  const iArea = col('COUNTRY')
  const iSector = col('SECTOR')
  const iIndicator = col('INDICATOR')
  const iTot = col('TYPE_OF_TRANSFORMATION')
  const iCofog = col('COFOG')
  const iName = col('SERIES_NAME')
  const iTime = col('TIME_PERIOD')
  const iVal = col('OBS_VALUE')
  if ([iArea, iSector, iIndicator, iTot, iCofog, iTime, iVal].some((i) => i < 0)) {
    throw new Error(`IMF GFS_COFOG CSV missing expected columns; header was: ${head.join(',').slice(0, 300)}`)
  }

  const out: ImfObservation[] = []
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
    // IMF writes COFOG as GF + digits ("GF0710"), the same shape OECD uses — so the OECD
    // module's parser is reused rather than reimplemented, and both sources land on the same
    // cofogFunctionCode axis as UK PESA. Rows with a blank COFOG (dataset-level totals) map
    // to null and are dropped by the handler.
    const cofogCode = cofogFromExpenditureCode(c[iCofog] ?? '')
    out.push({
      geography,
      sector: c[iSector] ?? '',
      indicator: c[iIndicator] ?? '',
      typeOfTransformation: c[iTot] ?? '',
      cofogCode,
      // SERIES_NAME leads with the function's own name, before the ", Expenditure by
      // function, …" boilerplate that is identical on every row.
      cofogName: iName >= 0 ? (c[iName] ?? '').split(',')[0].trim() || null : null,
      year,
      value,
    })
  }
  return out
}
