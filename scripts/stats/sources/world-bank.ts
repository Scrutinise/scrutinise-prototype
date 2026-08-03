// World Bank — World Development Indicators (WDI) API.
// Licence: CC BY 4.0, VERIFIED 2026-08-03 at data.worldbank.org/summary-terms-of-use
// ("Creative Commons Attribution 4.0 International License"). Commercially clean —
// commercialUseExcluded = false.
//
// Plain JSON REST (no SDMX), paginated. One call per (indicator, country-batch): the API
// accepts semicolon-separated country codes, so the whole comparator set is one request per
// indicator per page rather than one per country.
import { politeFetch } from '../lib/fetch-utils'
import { COMPARATOR_ISO3, normaliseGeography } from '../lib/iso'

const API = 'https://api.worldbank.org/v2'

export interface WbIndicator {
  code: string      // WDI indicator id, e.g. 'NY.GDP.MKTP.CD'
  measure: string   // our measure slug
  unit: string      // our unit
  label: string
  /** true = an outcome indicator (did the approach work), false = a fiscal input. */
  outcome: boolean
}

/**
 * Curated set per the brief: fiscal aggregates PLUS outcome indicators — the outcome half is
 * what makes "did their approach actually work" answerable rather than just "what did they spend".
 */
export const WB_INDICATORS: WbIndicator[] = [
  // --- fiscal / economic ---
  { code: 'NY.GDP.MKTP.CD', measure: 'gdp_current_usd', unit: 'USD', label: 'GDP (current US$)', outcome: false },
  { code: 'NY.GDP.PCAP.PP.CD', measure: 'gdp_per_capita_ppp', unit: 'USD_PPP', label: 'GDP per capita, PPP (current international $)', outcome: false },
  { code: 'NE.CON.GOVT.ZS', measure: 'govt_final_consumption_pct_gdp', unit: 'PERCENT_GDP', label: 'General government final consumption expenditure (% of GDP)', outcome: false },
  { code: 'GC.TAX.TOTL.GD.ZS', measure: 'tax_revenue_pct_gdp', unit: 'PERCENT_GDP', label: 'Tax revenue (% of GDP)', outcome: false },
  { code: 'GC.DOD.TOTL.GD.ZS', measure: 'central_govt_debt_pct_gdp', unit: 'PERCENT_GDP', label: 'Central government debt, total (% of GDP)', outcome: false },
  { code: 'GC.XPN.TOTL.GD.ZS', measure: 'govt_expense_pct_gdp', unit: 'PERCENT_GDP', label: 'Expense (% of GDP)', outcome: false },
  // --- outcomes ---
  { code: 'SP.DYN.LE00.IN', measure: 'life_expectancy_years', unit: 'YEARS', label: 'Life expectancy at birth, total (years)', outcome: true },
  { code: 'SH.XPD.CHEX.GD.ZS', measure: 'health_expenditure_pct_gdp', unit: 'PERCENT_GDP', label: 'Current health expenditure (% of GDP)', outcome: true },
  { code: 'SH.XPD.CHEX.PC.CD', measure: 'health_expenditure_per_capita', unit: 'USD', label: 'Current health expenditure per capita (current US$)', outcome: true },
  { code: 'SE.XPD.TOTL.GD.ZS', measure: 'education_expenditure_pct_gdp', unit: 'PERCENT_GDP', label: 'Government expenditure on education, total (% of GDP)', outcome: true },
  { code: 'SP.DYN.IMRT.IN', measure: 'infant_mortality_per_1000', unit: 'PER_1000', label: 'Mortality rate, infant (per 1,000 live births)', outcome: true },
  { code: 'SI.POV.GINI', measure: 'gini_index', unit: 'INDEX', label: 'Gini index', outcome: true },
]

export interface WbObservation {
  indicator: string
  geography: string
  year: number
  value: number
}

/** Fetch one indicator across the comparator set. Returns [] on a source-side miss, never throws for "no data". */
export async function fetchIndicator(indicator: string, perPage = 20000): Promise<WbObservation[]> {
  const countries = COMPARATOR_ISO3.join(';')
  const url = `${API}/country/${countries}/indicator/${indicator}?format=json&per_page=${perPage}`
  const res = await politeFetch(url, { delayMs: 400 })
  if (!res.ok) throw new Error(`World Bank fetch failed for ${indicator}: HTTP ${res.status}`)
  const json = await res.json()
  // Shape: [meta, rows] — or [meta] with a message when the indicator has no data at all.
  if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) return []
  const out: WbObservation[] = []
  for (const r of json[1] as Array<Record<string, unknown>>) {
    const value = r.value
    if (value === null || value === undefined || typeof value !== 'number') continue
    const iso3 = String((r.countryiso3code as string) ?? '')
    const geography = normaliseGeography(iso3)
    if (!geography) continue
    const year = parseInt(String(r.date), 10)
    if (!Number.isFinite(year)) continue
    out.push({ indicator, geography, year, value })
  }
  return out
}
