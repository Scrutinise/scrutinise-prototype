// ─────────────────────────────────────────────────────────────────────────────
// The `query_stats` tool (STATS_PHASE_A_BRIEF §7 — the Lex-side integration).
//
// THE DISCIPLINE, unchanged from everywhere else in this codebase: the data source
// testifies, Lex narrates. This module returns structured observations with their
// unit, period, source and source URL attached. Lex may state a figure ONLY if it
// appears in that payload. It never computes, converts or estimates one.
//
// Three parts, kept separate so the wiring can change without touching the data:
//   1. QUERY_STATS  — a genuine Gemini FunctionDeclaration the model invokes.
//   2. runQueryStats — the handler; calls lib/stats read layer, returns a result
//                      object (also the shape a functionResponse part would carry).
//   3. formatStatsForPrompt — renders the result as the grounding block injected
//                      into the Lex turn.
//
// See lib/lex/tools/tool-runner.ts for WHY the invocation is a separate model call
// rather than a tool loop inside the main turn (the Gemini API rejects function
// calling combined with the structured output the /lex contract depends on).
// ─────────────────────────────────────────────────────────────────────────────

import {
  findSeries, getCofogRollup, getSeriesObservations, listCatalogue,
  getComparative, geographiesFor,
  type CofogRollup, type Comparative, type Observation, type SeriesMatch,
} from '@/lib/stats/stats-query'
import { statsConfigured } from '@/lib/stats/stats-db'

/** The key that means "the COFOG spending breakdown", not a named series. */
export const SPENDING_SERIES_KEY = 'public_spending_by_function'

// ── 1. the declaration ───────────────────────────────────────────────────────
// Written as a Gemini FunctionDeclaration (OpenAPI subset) so it can be handed to
// any tool-calling surface unchanged.
export const QUERY_STATS = {
  name: 'query_stats',
  description:
    'Look up official UK government statistics (HM Treasury PESA public spending, OBR fiscal ' +
    'outturn and forecasts, ONS series, HMRC tax gap) from the platform\'s own statistics ' +
    'database. Use it whenever the user asks what something costs, how much is spent on ' +
    'something, how big a figure is, or how a published statistic has changed over time. ' +
    'Returns real observations with units and sources — never estimate a figure yourself.',
  parameters: {
    type: 'object',
    properties: {
      series: {
        type: 'string',
        description:
          `What to look up. Use the exact value "${SPENDING_SERIES_KEY}" for UK public ` +
          'spending broken down by function (the answer to "what does the UK spend most on", ' +
          '"how much goes on health/defence/education"). Otherwise give a short search term ' +
          'for a named statistic, e.g. "tax gap", "nominal GDP", "public sector net debt".',
      },
      cofogFunction: {
        type: 'string',
        description:
          'Optional. Restrict a spending lookup to one COFOG function, by name or code: ' +
          '01 general public services, 02 defence, 03 public order and safety, 04 economic ' +
          'affairs, 05 environmental protection, 06 housing and community amenities, ' +
          '07 health, 08 recreation culture and religion, 09 education, 10 social protection.',
      },
      geography: {
        type: 'string',
        description:
          'Optional. Which country or countries. A single ISO-3166 alpha-2 code ("GB", "FR") ' +
          'filters to that country; a comma-separated list ("GB,FR,DE") returns a comparison ' +
          'across them; "OECD" or "compare" returns every country held for that measure, with ' +
          'the UK marked. Omit for UK-only. International data is World Bank WDI across 21 ' +
          'countries; UK public-spending data is UK-only.',
      },
      dateFrom: {
        type: 'string',
        description: 'Optional ISO date or year (e.g. "2015" or "2015-04-01") — earliest period to return.',
      },
      dateTo: {
        type: 'string',
        description: 'Optional ISO date or year — latest period to return.',
      },
    },
    required: ['series'],
  },
} as const

export interface QueryStatsArgs {
  series: string
  cofogFunction?: string
  geography?: string
  dateFrom?: string
  dateTo?: string
}

export interface QueryStatsResult {
  ok: boolean
  kind: 'spending_by_function' | 'time_series' | 'comparative' | 'catalogue' | 'unavailable' | 'no_match'
  /** Human-readable note the model may repeat (e.g. why there is nothing). */
  note?: string
  spending?: CofogRollup
  comparative?: Comparative
  series?: { match: SeriesMatch; observations: Observation[] }[]
  /** What CAN be asked, when nothing matched — so Lex can offer a real alternative. */
  available?: string[]
}

// ── COFOG name/code resolution ───────────────────────────────────────────────
const COFOG_NAMES: Record<string, string> = {
  '01': 'general public services', '02': 'defence', '03': 'public order and safety',
  '04': 'economic affairs', '05': 'environmental protection', '06': 'housing and community amenities',
  '07': 'health', '08': 'recreation, culture and religion', '09': 'education', '10': 'social protection',
}

/** "health" | "07" | "Health" → "07"; unknown → null. */
function resolveCofog(input: string): string | null {
  const raw = input.trim().toLowerCase()
  if (/^\d{2}(\.\d+)?$/.test(raw)) return raw.split('.')[0]
  if (/^\d$/.test(raw)) return `0${raw}`
  for (const [code, name] of Object.entries(COFOG_NAMES)) {
    if (name === raw || name.startsWith(raw) || raw.startsWith(name.split(' ')[0])) return code
  }
  return null
}

/** "2015" → "2015-01-01"; passes ISO dates through; anything else → undefined. */
function toDate(v?: string): string | undefined {
  if (!v) return undefined
  const s = v.trim()
  if (/^\d{4}$/.test(s)) return `${s}-01-01`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`
  return undefined
}

// ── 2. the handler ───────────────────────────────────────────────────────────
/** Execute the tool. Never throws — a stats failure must not break a Lex turn. */
export async function runQueryStats(args: QueryStatsArgs): Promise<QueryStatsResult> {
  if (!statsConfigured()) {
    return { ok: false, kind: 'unavailable', note: 'The statistics database is not configured in this environment.' }
  }
  try {
    const wantsSpending =
      args.series === SPENDING_SERIES_KEY ||
      /spend|expenditure|budget|cofog/i.test(args.series)

    if (wantsSpending) {
      const rollup = await getCofogRollup({ periodLabel: undefined })
      if (!rollup) return { ok: false, kind: 'no_match', note: 'No public-spending observations are loaded.' }

      if (args.cofogFunction) {
        const code = resolveCofog(args.cofogFunction)
        if (code) {
          const only = rollup.rows.filter((r) => r.cofogFunctionCode === code)
          if (only.length) return { ok: true, kind: 'spending_by_function', spending: { ...rollup, rows: only } }
        }
        // Unresolvable function: return the whole breakdown rather than nothing, and say so.
        return {
          ok: true, kind: 'spending_by_function', spending: rollup,
          note: `"${args.cofogFunction}" is not one of the ten COFOG functions; returning the full breakdown.`,
        }
      }
      return { ok: true, kind: 'spending_by_function', spending: rollup }
    }

    // Comparative geography: a list, or "OECD"/"compare", asks across countries.
    const geoRaw = (args.geography ?? '').trim()
    const wantsAll = /^(oecd|compare|comparison|international|all)$/i.test(geoRaw)
    const geoList = geoRaw && !wantsAll
      ? geoRaw.split(/[,\s]+/).map((g) => g.trim().toUpperCase()).filter(Boolean)
      : []
    const wantsComparison = wantsAll || geoList.length > 1

    if (wantsComparison) {
      // Resolve the free-text series to a real measure first, then compare on it.
      const candidates = await findSeries(args.series, 3)
      const measure = candidates[0]?.measure
      if (!measure) {
        const cat = await listCatalogue()
        return {
          ok: false, kind: 'no_match',
          note: `No series matches "${args.series}", so there is nothing to compare across countries.`,
          available: cat.slice(0, 12).map((c) => `${c.measure} (${c.unit}, ${c.source})`),
        }
      }
      const comparative = await getComparative({
        measure,
        geographies: wantsAll ? null : geoList,
        periodLabel: undefined,
      })
      if (!comparative) {
        const geos = await geographiesFor(measure)
        return {
          ok: false, kind: 'no_match',
          note:
            `"${measure}" is not held for enough countries to compare` +
            (geos.length ? ` — it covers ${geos.join(', ')}.` : '.'),
        }
      }
      return { ok: true, kind: 'comparative', comparative }
    }

    // A named statistic → catalogue match, then its observations.
    const matches = await findSeries(args.series, 3, false, geoList[0] ?? null)
    if (!matches.length) {
      const cat = await listCatalogue()
      return {
        ok: false, kind: 'no_match',
        note: `No series in the statistics database matches "${args.series}".`,
        available: cat.slice(0, 12).map((c) => `${c.measure} (${c.unit}, ${c.seriesCount} series, ${c.source})`),
      }
    }
    const dateFrom = toDate(args.dateFrom)
    const dateTo = toDate(args.dateTo)
    const series = await Promise.all(
      matches.map(async (match) => ({
        match,
        observations: await getSeriesObservations(match.seriesId, { dateFrom, dateTo, limit: 60 }),
      })),
    )
    return { ok: true, kind: 'time_series', series: series.filter((s) => s.observations.length) }
  } catch (err) {
    console.error('[query_stats] failed:', err instanceof Error ? err.message : err)
    return { ok: false, kind: 'unavailable', note: 'The statistics lookup failed.' }
  }
}

// ── 3. the grounding block ───────────────────────────────────────────────────
function money(value: number, unit: string): string {
  if (unit === 'GBP_MILLION') return `£${Math.round(value).toLocaleString()}m`
  if (unit === 'GBP_BILLION') return `£${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}bn`
  if (unit === 'PERCENT') return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
  const n = (d = 1) => value.toLocaleString(undefined, { maximumFractionDigits: d })
  // The percentage-shaped units must be spelled out, not collapsed to a bare "%". "2.1%" reads
  // as a level; "2.1% change on a year earlier" is a growth rate and "2.1% of GDP" is a share
  // — three different facts that would otherwise be rendered identically. These units arrived
  // with the OBR unit recovery (2026-08-05) and the IMF/OECD comparative layer.
  if (unit === 'PERCENT_GDP') return `${n()}% of GDP`
  if (unit === 'PERCENT_TOTAL_EXPENDITURE') return `${n()}% of total government expenditure`
  if (unit === 'PERCENT_CHANGE_YOY') return `${n()}% change on a year earlier`
  if (unit === 'PERCENT_POTENTIAL_OUTPUT') return `${n()}% of potential output`
  if (unit === 'PERCENTAGE_POINT_GDP_CONTRIBUTION') return `${n()} percentage points of GDP growth`
  if (unit === 'MILLIONS') return `${n()} million`
  if (unit === 'YEARS') return `${n()} years`
  if (unit === 'USD') return `US$${Math.round(value).toLocaleString()}`
  if (unit === 'USD_PPP' || unit === 'USD_PPP_PER_CAPITA') return `US$${Math.round(value).toLocaleString()} (PPP)`
  if (unit === 'GBP_PER_BARREL') return `£${n(2)}/barrel`
  if (unit === 'USD_PER_BARREL') return `US$${n(2)}/barrel`
  if (unit === 'GBP_PER_THERM') return `£${n(2)}/therm`
  if (unit === 'EUR_PER_GBP') return `€${n(3)} per £`
  if (unit === 'PER_1000') return `${n()} per 1,000`
  return `${value.toLocaleString()} ${unit}`
}

/** One line of licence provenance, attached to every block. */
function licenceLine(l: { licence: string; licenceUrl: string | null; commercialUseExcluded: boolean }): string {
  const flag = l.commercialUseExcluded
    ? 'NOT FOR COMMERCIAL USE — say so if you quote this figure.'
    : 'Commercial use permitted under these terms.'
  return `Licence: ${l.licence}${l.licenceUrl ? ` (${l.licenceUrl})` : ''}. ${flag}`
}

/** Render a result as the STATISTICS block for the Lex system prompt. */
export function formatStatsForPrompt(result: QueryStatsResult): string {
  const header =
    'RETRIEVED STATISTICS (from the platform statistics database — HM Treasury / OBR / ONS / HMRC / OECD / World Bank).\n' +
    'These figures are the ONLY numbers you may state. Quote them with their unit and period, name ' +
    'the source, and do not add, adjust, convert, extrapolate or round beyond what is written here. ' +
    'If the user needs something not in this block, say plainly that the database does not hold it.\n' +
    'LICENCE: each block below carries the terms the data is published under. If a figure is marked ' +
    'NOT FOR COMMERCIAL USE, say so when you quote it — the proposal may end up in a commercial ' +
    'context, and a wrongly-licensed figure is a legal problem, not a style one.'

  if (!result.ok || (!result.spending && !result.comparative && !result.series?.length)) {
    const lines = [header, '', `No figures retrieved. ${result.note ?? ''}`.trim()]
    if (result.available?.length) {
      lines.push('', 'The database does hold, among others:', ...result.available.map((a) => `  - ${a}`))
    }
    return lines.join('\n')
  }

  const lines = [header, '']

  if (result.spending) {
    const s = result.spending
    const nature =
      s.status === 'outturn' ? 'These are OUTTURN figures — money actually spent, not a forecast or a plan.'
        : s.status === 'forecast' ? 'These are FORECAST figures, not actual spend.'
          : s.status === 'provisional' ? 'These are PROVISIONAL figures and may be revised.'
            : s.status && s.status !== 'unstated' ? `Status: ${s.status}.`
              : 'The source does not state whether these are outturn or forecast — do not characterise them either way.'
    lines.push(
      `UK public expenditure by function — ${s.periodLabel} (${s.datasetTitle}, source: ${s.source}${s.sourceUrl ? `, ${s.sourceUrl}` : ''}).`,
      nature,
      licenceLine(s),
      `Total across the functions listed: ${money(s.total, s.unit)}.`,
      '',
    )
    for (const r of s.rows) {
      lines.push(
        `  ${r.cofogFunctionCode} ${r.cofogFunctionName ?? '(unnamed function)'}: ` +
        `${money(r.totalValue, r.unit)} (${(r.shareOfTotal * 100).toFixed(1)}% of the total)`,
      )
    }
    if (result.note) lines.push('', `Note: ${result.note}`)
  }

  if (result.comparative) {
    const c = result.comparative
    lines.push(
      `${c.measure} across countries — ${c.periodLabel} (${c.datasetTitle}, source: ${c.source}${c.sourceUrl ? `, ${c.sourceUrl}` : ''}), unit ${c.unit}.`,
      licenceLine(c),
      '',
    )
    for (const r of c.rows) {
      const mark = r.geography === 'GB' ? '  <- the UK' : ''
      const vintage = r.forecastVintage ? `, ${r.forecastVintage} forecast round` : ''
      lines.push(`  ${r.geography}: ${money(r.value, c.unit)}${r.status ? ` (${r.status})` : ''}${vintage}${mark}`)
    }
    if (c.computedMean != null) {
      lines.push(
        '',
        `Mean across these countries: ${money(c.computedMean, c.unit)}.`,
        `THIS MEAN IS COMPUTED BY US, NOT PUBLISHED: ${c.computedMeanBasis}.`,
        'Present it as "the average of the countries we hold", never as "the OECD average" — the',
        'OECD has more members than this set, and the mean is unweighted by population or economy.',
      )
    }
    if (c.ukValue == null) lines.push('', 'NOTE: the UK is not in this comparison — do not infer a UK position.')
    if (result.note) lines.push('', `Note: ${result.note}`)
  }

  for (const s of result.series ?? []) {
    const m = s.match
    lines.push(
      '',
      `${m.seriesLabel} — ${m.datasetTitle} (source: ${m.source}${m.sourceUrl ? `, ${m.sourceUrl}` : ''}), unit ${m.unit}, geography ${m.geography}.`,
      licenceLine(m),
    )
    // A forecast-round figure is not a fact about the year it names — it is a fact about what
    // one forecast round expected of that year. The OBR historical-forecasts dataset is 2,807
    // series of exactly this kind, and as of 2026-08-05 they all carry recovered units, so they
    // now reach catalogue search where before they were filtered out as unit='UNKNOWN'. Without
    // this line Lex would present "PSNB 2027-28: £52bn" as the number, with no way to know it
    // came from the March 2020 round and has been superseded a dozen times since.
    if (m.forecastVintage) {
      lines.push(
        `⚠ FORECAST VINTAGE: these are the figures from the ${m.forecastVintage} forecast round, `
        + 'NOT the current view. Say which round any figure comes from, and do not present it as '
        + 'the latest estimate.',
      )
    }
    const obs = s.observations
    const shown = obs.length > 12 ? [...obs.slice(0, 6), ...obs.slice(-6)] : obs
    for (const o of shown) {
      lines.push(`  ${o.periodLabel}: ${money(o.value, o.unit)}${o.status ? ` (${o.status})` : ''}`)
    }
    if (obs.length > shown.length) {
      lines.push(`  … ${obs.length} observations in total, ${obs[0].periodLabel} to ${obs[obs.length - 1].periodLabel} (middle years omitted here).`)
    }
  }

  return lines.join('\n')
}
