// Country-code normalisation for Phase B (comparative/international).
//
// CRITICAL for the whole point of Phase B: Phase A wrote the UK as ISO-3166 alpha-2 `GB`
// (schema doc: "ISO-3166 alpha-2 for country level"). The international sources all speak
// alpha-3 (`GBR`). If Phase B stored `GBR`, the UK's own spending would sit in a different
// geography from the UK's comparator rows and NO comparative query would ever line up.
// Everything country-level is therefore normalised to alpha-2 on the way in.

/** Curated comparator set — the brief asks for a representative slice, not exhaustive coverage. */
export const COMPARATOR_ISO3 = [
  'GBR', // the subject — must map to GB and meet Phase A's UK data
  'USA', 'FRA', 'DEU', 'ITA', 'ESP', 'NLD', 'SWE', 'DNK', 'NOR', 'FIN',
  'IRL', 'CAN', 'AUS', 'NZL', 'JPN', 'KOR', 'CHE', 'AUT', 'BEL', 'POL', 'PRT',
] as const

/**
 * Non-ISO aggregate geographies, kept verbatim rather than forced into ISO.
 * These are the published aggregates — using OECD's own "average country" figure is more
 * defensible than averaging member rows ourselves.
 */
export const AGGREGATE_CODES = new Set(['OECD', 'OECD_REP', 'EUOECD', 'EU27_2020', 'EA19', 'EA20', 'WLD'])

const ISO3_TO_ISO2: Record<string, string> = {
  GBR: 'GB', USA: 'US', FRA: 'FR', DEU: 'DE', ITA: 'IT', ESP: 'ES', NLD: 'NL',
  SWE: 'SE', DNK: 'DK', NOR: 'NO', FIN: 'FI', IRL: 'IE', CAN: 'CA', AUS: 'AU',
  NZL: 'NZ', JPN: 'JP', KOR: 'KR', CHE: 'CH', AUT: 'AT', BEL: 'BE', POL: 'PL',
  PRT: 'PT', GRC: 'GR', CZE: 'CZ', HUN: 'HU', SVK: 'SK', SVN: 'SI', EST: 'EE',
  LVA: 'LV', LTU: 'LT', LUX: 'LU', ISL: 'IS', ISR: 'IL', TUR: 'TR', MEX: 'MX',
  CHL: 'CL', COL: 'CO', CRI: 'CR', BGR: 'BG', ROU: 'RO', HRV: 'HR', CYP: 'CY',
  MLT: 'MT', CHN: 'CN', IND: 'IN', BRA: 'BR', ZAF: 'ZA', RUS: 'RU', IDN: 'ID',
}

/**
 * Normalise a source's area code to the geography stored on stat_series/stat_observation.
 * Returns null for an area we deliberately don't store (unknown aggregate, region grouping),
 * so callers skip rather than inventing a geography.
 */
export function normaliseGeography(code: string): string | null {
  const c = code.trim().toUpperCase()
  if (!c) return null
  if (AGGREGATE_CODES.has(c)) return c
  if (c.length === 2) return c // already alpha-2
  const iso2 = ISO3_TO_ISO2[c]
  if (iso2) return iso2
  return null
}

/** Human label for a geography code, for series labels. */
export function geographyLabel(code: string): string {
  const names: Record<string, string> = {
    OECD: 'OECD', OECD_REP: 'OECD average country', EUOECD: 'EU countries in OECD',
    EU27_2020: 'EU27', WLD: 'World',
  }
  if (names[code]) return names[code]
  const back = Object.entries(ISO3_TO_ISO2).find(([, v]) => v === code)
  return back ? back[0] : code
}
