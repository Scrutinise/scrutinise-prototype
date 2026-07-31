// ONS Route B — CDID time-series CSV endpoint (www.ons.gov.uk/generator?format=csv&uri=...).
// Carries the headline economic series the Beta API does NOT host: GDP, CPI/CPIH,
// unemployment, wages. Each CDID is a stable 4-character code; the URI/dataset-id
// part of the path can and does change between ONS releases, so re-resolve rather
// than hardcoding full paths where possible — Phase A ships with a small curated,
// individually-verified list (see docs/STATS_PHASE_A_BRIEF.md §2).
import { politeFetch } from '../lib/fetch-utils'
import { parseCdidPeriod, NormalisedPeriod } from '../lib/period'

export interface CdidSeriesConfig {
  cdid: string
  uri: string // path after https://www.ons.gov.uk/generator?format=csv&uri=/
  measure: string
  unit: string
}

// Verified live against the real endpoint on 30 Jul 2026 (see session notes) — each
// entry was individually curl-checked, not assumed from memory. Trade balance is a
// known gap (brief names it as a headline series) — left out rather than guessed;
// add it once a CDID is confirmed the same way.
export const CDID_SERIES: CdidSeriesConfig[] = [
  { cdid: 'ABMI', uri: 'economy/grossdomesticproductgdp/timeseries/abmi/pn2', measure: 'gdp_cvm', unit: 'GBP_MILLION' },
  { cdid: 'MGSX', uri: 'employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms', measure: 'unemployment_rate', unit: 'PERCENT' },
  { cdid: 'L55O', uri: 'economy/inflationandpriceindices/timeseries/l55o/mm23', measure: 'cpih_annual_rate', unit: 'PERCENT' },
  { cdid: 'KAC3', uri: 'employmentandlabourmarket/peopleinwork/earningsandworkinghours/timeseries/kac3/lms', measure: 'avg_weekly_earnings_growth', unit: 'PERCENT' },
]

export interface CdidObservation extends NormalisedPeriod {
  value: number
}

export interface CdidSeriesResult {
  cdid: string
  title: string
  sourceDatasetId: string // ONS "Source dataset ID", e.g. "PN2"
  releaseDate: string | null
  observations: CdidObservation[]
}

/** Split a CSV line on commas, respecting double-quoted fields (no embedded-quote escaping needed — ONS doesn't use it in this feed). */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

export function parseCdidCsv(text: string): Omit<CdidSeriesResult, 'cdid'> {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  let title = ''
  let sourceDatasetId = ''
  let releaseDate: string | null = null
  const observations: CdidObservation[] = []

  for (const line of lines) {
    const cols = splitCsvLine(line)
    if (cols.length < 2) continue
    const [key, value] = cols
    const period = parseCdidPeriod(key)
    if (period) {
      const num = parseFloat(value)
      if (!Number.isNaN(num)) observations.push({ ...period, value: num })
      continue
    }
    // metadata row
    if (/^title$/i.test(key)) title = value
    else if (/^source dataset id$/i.test(key)) sourceDatasetId = value
    else if (/^release date$/i.test(key)) releaseDate = value
  }

  return { title, sourceDatasetId, releaseDate, observations }
}

export async function fetchCdidSeries(cfg: CdidSeriesConfig): Promise<CdidSeriesResult> {
  const url = `https://www.ons.gov.uk/generator?format=csv&uri=/${cfg.uri}`
  const res = await politeFetch(url)
  if (!res.ok) throw new Error(`CDID fetch failed for ${cfg.cdid}: HTTP ${res.status}`)
  const text = await res.text()
  const parsed = parseCdidCsv(text)
  return { cdid: cfg.cdid, ...parsed }
}
