// ─────────────────────────────────────────────────────────────────────────────
// stats-catalogue.ts — THE STATISTICS CATALOGUE INDEX (BRIEF_SEARCH_S9 §4,
// executing SEARCH_STRATEGY_v5 §6d).
//
// ⚠⚠ THE ONE RULE THIS FILE EXISTS TO ENFORCE: **NUMBERS ARE NEVER SEARCHED, AND
// THIS LAYER NEVER RETURNS ONE.** What is searchable is the CATALOGUE — the headings
// that describe what a series *is*: dataset title, measure, geography, time span,
// publisher, COFOG function. Discovery finds the series; a separate exact call
// (`lib/stats/stats-query.ts::getSeriesByKey` → `getSeriesObservations`) fetches the
// values.
//
// Why, in one line: a plausible-looking approximate match over a numeric series is
// worthless and dangerous. "Roughly" is a legitimate output for a debate transcript and
// never a legitimate output for a statistic. Search answers *does a relevant series
// exist*; the tool answers *what is the number*.
//
// The type below therefore has NO FIELD A VALUE COULD TRAVEL IN, and
// `assertNoObservationValues()` re-checks that at the boundary on every call, because a
// structural guarantee that nothing re-checks is a comment.
//
// ── WHERE THIS SITS ──────────────────────────────────────────────────────────
// §4 says the index "belongs in the same discovery mechanism as everything else, not in
// a bespoke lookup". It does: the ROUTER selects this stream exactly as it selects
// legislation or caselaw (`LEX_STATS_STREAM`, query-expansion.ts). What is different is
// the PAYLOAD — it travels on `GatewayResult.statistics`, not in `results`, because a
// catalogue hit that renders like a corpus document invites Lex to quote it as evidence
// of a fact. It is evidence that a MEASUREMENT EXISTS. Those are different claims and
// the type system keeps them apart, the same way `EvidenceResult` has no field through
// which a committee transcript could render as a section of an Act (SEARCH_STRATEGY §10).
//
// ── WHY AN IN-PROCESS INDEX AND NOT POSTGRES FTS ─────────────────────────────
// The catalogue is 5,733 rows of short text — about 700 KB of headings, measured, not
// estimated. Two reasons it is built here rather than as a tsvector column:
//   1. The stats schema is owned by another thread (scripts/stats/prisma/schema.prisma).
//      S9 §6 forbids editing it. A column and a GIN index there is a change to request,
//      not to make — and it is recorded as such in SEARCH_S9_REPORT.md.
//   2. HALF THE HEADINGS THIS INDEX NEEDS DO NOT EXIST AS COLUMNS. The COFOG *name*, the
//      geography *name* and the time *span* are all derived (see DERIVED HEADINGS below),
//      and §3.4 asks precisely whether the catalogue can carry headings that are not raw
//      source columns. Building the index as its own artefact is what makes the answer
//      yes without a schema change anywhere.
// It is refreshed on a TTL rather than at build time because the stats refresh scheduler
// moves underneath us; a build-time snapshot would go stale silently.
// ─────────────────────────────────────────────────────────────────────────────

import { statsQuery, statsConfigured } from '@/lib/stats/stats-db'

// ── THE RESULT SHAPE: a series descriptor, not a document ────────────────────

/**
 * What the statistics stream returns. Every field answers "what IS this series" or
 * "how do I call it". **None of them can hold an observation.**
 *
 * ⚠ `observationCount`, `firstPeriod` and `lastPeriod` are about the SHAPE of the series
 * — how much data exists and over what span — and are the whole point of a catalogue
 * ("is there a long enough run to say anything?"). They are not measurements. The line
 * is: a number describing the SERIES is a heading; a number describing the WORLD is a
 * value, and only the exact call may return one.
 */
export interface SeriesDescriptor {
  /** THE HANDLE. A deterministic sha-256 over the series' identity — stable across
   *  re-ingest, where `seriesId` (a cuid) is not. This is what a caller passes to
   *  `getSeriesByKey` to fetch actual numbers. Definition:
   *  `scripts/stats/lib/series-key.ts`. */
  seriesKey: string
  /** What the series is, in the source's own words. */
  seriesLabel: string
  /** The machine name of the quantity — e.g. `unemployment_rate`, `beer_duties`. */
  measure: string
  /** ⚠ DERIVED. A plain-English gloss of `measure` where we have one, else null. */
  measureGloss: string | null
  unit: string
  geography: string
  /** ⚠ DERIVED. `GB` → "United Kingdom". */
  geographyLabel: string
  cofogFunctionCode: string | null
  /** ⚠ DERIVED, by join. `07` → "Health". The single highest-value derived heading:
   *  PESA's department series are labelled "Local Government — 07" and nothing else in
   *  the row says the 07 means health. */
  cofogFunctionName: string | null
  /** Non-null only for OBR forecast rounds, e.g. "March 2022". A vintage is part of what
   *  the series IS: "the 2027 figure" means different things in different rounds. */
  forecastVintage: string | null

  datasetId: string
  datasetTitle: string
  /** The publisher — ONS, OBR, HMRC, HMT_PESA, WORLD_BANK, IMF, OECD. */
  source: string
  sourceUrl: string | null
  refreshCadence: string

  // ── span (derived from the observations, never their values) ──
  observationCount: number
  firstPeriod: string | null
  lastPeriod: string | null
  periodType: string | null

  // ── licence, carried on EVERY descriptor ──
  licence: string
  licenceUrl: string | null
  /** EFFECTIVE terms: the per-series override where set, else the dataset's. */
  commercialUseExcluded: boolean
  /** What a caller must do to use this series' figures. Stated, not implied. */
  attribution: string

  /** BM25 score over the heading text. Comparable only within one call. */
  score: number
  /** Which headings actually matched, so a result can be explained rather than trusted. */
  matchedOn: string[]
}

/**
 * ⚠ THE NEVER-CLAIM BOUNDARY, ENFORCED RATHER THAN DOCUMENTED (§4).
 *
 * The search layer returns "this series exists"; it must not return, imply, or let a
 * caller infer a value. The type above cannot express one — but a type is a compile-time
 * promise, and this module hands objects to an LLM prompt builder. So the objects are
 * re-checked at the boundary on every call.
 *
 * Watch it fail before trusting it to pass: `check-s9-catalogue.ts` break 1 injects a
 * `latestValue` and asserts this throws.
 */
const FORBIDDEN_VALUE_KEYS = [
  'value', 'values', 'latestValue', 'observation', 'observations', 'figure',
  'amount', 'total', 'latest', 'datapoint', 'data',
]
export function assertNoObservationValues(rows: SeriesDescriptor[]): void {
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (FORBIDDEN_VALUE_KEYS.includes(k)) {
        throw new Error(
          `[stats-catalogue] NEVER-CLAIM VIOLATION: a descriptor for ${r.seriesKey ?? '(unkeyed)'} carries ` +
          `'${k}'. The catalogue says a series EXISTS; only the exact call may return what the number is. ` +
          `See SEARCH_CONTRACT.md §3 and BRIEF_SEARCH_S9 §4.`,
        )
      }
    }
  }
}

// ── LICENCE: a use context, required, never defaulted ────────────────────────

/**
 * ⚠ §3.3 — "A licence recorded and not enforced is the same failure class as a check
 * that cannot fail." So the filter is STRUCTURAL: it runs before scoring, it cannot be
 * skipped, and the caller must SAY which context it is retrieving for. There is
 * deliberately no default parameter — a caller that forgets does not silently get the
 * permissive branch; it does not compile.
 *
 * Measured position, 19 Aug 2026: 2,329 of 5,733 series (40.6%) carry
 * `commercialUseExcluded = true`, all of them IMF, covering 40,351 of 80,443
 * observations (50.2%). This is not a hypothetical corner.
 */
export type StatsUseContext = 'non-commercial' | 'commercial'

/**
 * How this deployment is using the figures. `scrutinise.org` is a not-for-profit, so
 * `non-commercial` is correct for it and is the default when unset — but the resolution
 * is LOGGED rather than assumed, because the whole point of the IMF flag is that a
 * commercial fork is a live possibility and the failure would be legal, not cosmetic.
 */
export function statsUseContext(): StatsUseContext {
  const raw = (process.env.STATS_USE_CONTEXT ?? '').trim().toLowerCase()
  if (raw === 'commercial') return 'commercial'
  if (raw === 'non-commercial' || raw === '') return 'non-commercial'
  console.warn(
    `[stats-catalogue] STATS_USE_CONTEXT=${JSON.stringify(raw)} is not recognised — ` +
    `falling back to the RESTRICTIVE value 'commercial', which hides licence-restricted series. ` +
    `Set it to 'non-commercial' or 'commercial'.`,
  )
  // ⚠ An unrecognised value fails SAFE (hides more), not open. Understating terms is the
  // dangerous direction; showing too little is merely unhelpful.
  return 'commercial'
}

// ── the row as loaded, before scoring ────────────────────────────────────────

interface CatalogueRow extends Omit<SeriesDescriptor, 'score' | 'matchedOn'> {
  /** The concatenated heading text this row is indexed on. Never shown to a user. */
  headingText: string
  /** WEIGHTED term frequency per token — see FIELD_WEIGHTS. */
  tf: Map<string, number>
  /** Weighted document length, the denominator BM25 normalises against. */
  len: number
  /** Which heading each token came from, for `matchedOn`. */
  fieldOfToken: Map<string, Set<string>>
}

/**
 * ⚠⚠ FIELD WEIGHTS — ADDED AFTER MEASURING, AND THE MEASUREMENT IS THE JUSTIFICATION.
 *
 * The first version indexed every heading at equal weight and ranked badly in a way that
 * was invisible until the §5 probes ran. Four of nine answerable probes returned a WRONG
 * top hit, and all four failed the same way:
 *
 *   "income inequality Gini coefficient ONS time series"  → top hit: *Unemployment rate*
 *
 * `ons` (df=44) matched BOTH `dataset` ("ONS headline economic series (CDID)") AND
 * `source` on all 44 ONS rows, and `series`→`sery` matched that title too — three field
 * hits of boilerplate, against one hit of `gini` (df=21) on the row that actually WAS the
 * Gini index. Same mechanism made `cofog` (df=2,329) a near-useless token: it appears in
 * the IMF *dataset title*, so it fires on every IMF row alike.
 *
 * The defect is general and has a name: **collection-level fields indexed per document.**
 * `datasetTitle` and `source` are identical across every row of a dataset, so they carry no
 * power to tell those rows apart, while adding score to all of them at once. They still
 * belong in the index — "the ONS one" is a real way to ask — but they must not outrank the
 * row's own identity.
 *
 * So: the source's own words for THIS series weigh most; our derived headings weigh nearly
 * as much (they are the whole point for the 49% of rows labelled with column codes); and
 * the collection-level fields are damped to 0.4.
 */
const FIELD_WEIGHTS: Record<string, number> = {
  label: 3.0,      // the source's own name for this line of data
  measure: 2.5,    // its machine name
  gloss: 2.0,      // ⚠ derived — the only route to `PSNB`-style labels
  cofog: 2.0,      // ⚠ derived — the only route to "— 07" meaning Health
  geography: 1.0,
  vintage: 1.0,
  unit: 0.5,
  dataset: 0.4,    // ⚠ collection-level: identical on every row of the dataset
  source: 0.4,     // ⚠ collection-level
  span: 0.2,
}

// ── DERIVED HEADINGS ─────────────────────────────────────────────────────────
//
// §3.4 asks whether the catalogue can carry discoverable headings that are NOT raw
// source columns. It can, and three of them are load-bearing rather than decorative.

/**
 * 1. GEOGRAPHY NAME. The store holds ISO alpha-2 only. "GB" does not match "UK" or
 *    "Britain" or "United Kingdom", which is how a user asks.
 *
 * ⚠ DUPLICATED ON PURPOSE, AND NARROWLY. The canonical map is
 * `scripts/stats/lib/iso.ts::geographyLabel`, which the web app cannot import (it is
 * outside the Vercel build root — see stats-db.ts). This copy covers exactly the 22
 * geographies MEASURED present in the store on 19 Aug 2026 and nothing speculative, so
 * a code that appears later shows up as itself rather than silently mislabelled.
 */
const GEOGRAPHY_LABELS: Record<string, string> = {
  GB: 'United Kingdom UK Britain', US: 'United States USA America', FR: 'France',
  DE: 'Germany', IT: 'Italy', ES: 'Spain', NL: 'Netherlands', SE: 'Sweden',
  DK: 'Denmark', NO: 'Norway', FI: 'Finland', IE: 'Ireland', CA: 'Canada',
  AU: 'Australia', NZ: 'New Zealand', JP: 'Japan', KR: 'South Korea',
  CH: 'Switzerland', AT: 'Austria', BE: 'Belgium', PL: 'Poland', PT: 'Portugal',
  'GB-ENG': 'England', 'GB-SCT': 'Scotland', 'GB-WLS': 'Wales', 'GB-NIR': 'Northern Ireland',
}
function geographyLabelFor(code: string): string {
  return GEOGRAPHY_LABELS[code] ?? code
}

/**
 * 2. MEASURE GLOSS. ⚠ THE SINGLE BIGGEST DISCOVERABILITY PROBLEM IN THIS STORE, and it
 *    is a finding rather than a design choice: **2,807 of 5,733 series (49%) are labelled
 *    with the source's own column codes** — "PSNB (April 1978)", "NICS (October 2018)",
 *    "PCDebtint (March 2022)". Nobody asks a question containing the token "pcdebtint".
 *
 * ⚠⚠ EVERY GLOSS BELOW IS DERIVED FROM THIS STORE'S OWN DATA, NOT FROM THE MODEL'S
 * KNOWLEDGE. `obr-psf-databank` carries the same quantities under long snake_case names
 * (`public_sector_net_borrowing_psnb`, `total_managed_expenditure`), so the databank
 * glosses the historical-forecast short codes. Each entry below is one of those
 * corroborated pairs. Codes with no corroborating long name in the store are
 * DELIBERATELY ABSENT rather than guessed — an invented expansion would put words in a
 * result that the source never used, which is the same failure as an invented figure.
 * The uncovered remainder is reported by name in SEARCH_S9_REPORT.md §A4.
 */
const MEASURE_GLOSS: Record<string, string> = {
  psnb: 'public sector net borrowing deficit',
  psnd: 'public sector net debt',
  psni: 'public sector net investment',
  pscr: 'public sector current receipts',
  tme: 'total managed expenditure spending',
  ngdp: 'nominal gross domestic product GDP',
  cb: 'current budget balance',
  cacb: 'cyclically adjusted current budget',
  capsnb: 'cyclically adjusted public sector net borrowing',
  debtint: 'debt interest',
  psdebtint: 'public sector debt interest',
  netdebtint: 'net debt interest',
  gilts: 'gilt yields government bonds',
}
/** The `_`-prefixed twin is the same quantity in £bn rather than % of GDP (measured). */
function measureGlossFor(measure: string): string | null {
  const bare = measure.replace(/^_/, '').replace(/_\d+_$/, '')
  return MEASURE_GLOSS[bare] ?? null
}

// 3. TIME SPAN and 4. COFOG NAME are derived in SQL below (min/max periodLabel, and a
//    join to stat_cofog_function) — both are headings the source rows do not carry.

// ── tokenisation ─────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'for', 'to', 'in', 'on', 'by', 'is', 'are',
  'was', 'were', 'be', 'as', 'at', 'it', 'that', 'this', 'with', 'from', 'do', 'does',
  'any', 'anyone', 'there', 'we', 'i', 'you', 'how', 'what', 'much', 'many', 'has',
  'have', 'about', 'over', 'per',
])

/**
 * Split heading text into match tokens.
 *
 * ⚠ THE SNAKE_CASE AND CAMELCASE SPLITS ARE NOT COSMETIC. `beer_duties` must match
 * "beer duty" and `PCDebtint` must match "debt interest"; without the splits, roughly
 * half this catalogue is unreachable by any natural phrasing. Measured effect is in
 * SEARCH_S9_REPORT.md §A4.
 *
 * Light suffix folding ('duties'→'duty', plural 's') stands in for a stemmer: it is the
 * smallest thing that makes "alcohol duty" reach `alcohol_duties`, and it is applied to
 * the query and the index identically so it cannot skew one side.
 */
export function tokenise(text: string): string[] {
  return text
    // ⚠ TWO camelCase rules, and the first one was missing until `check:s9-catalogue` caught
    // it. `([a-z0-9])([A-Z])` splits `netDebtInt` but NOT `PCDebtint`, because that boundary is
    // UPPER→UPPER→lower, not lower→UPPER. So `PCDebtint` tokenised to the single token
    // "pcdebtint" and was unreachable by any phrasing — the exact failure the split exists to
    // prevent, on the exact label family (OBR's, 49% of the catalogue) that motivated it.
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')  // PCDebtint → PC Debtint
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')     // netDebtInt → net Debt Int
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(fold)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}
function fold(t: string): string {
  if (t.endsWith('ies') && t.length > 4) return `${t.slice(0, -3)}y`
  if (t.endsWith('es') && t.length > 4) return t.slice(0, -2)
  if (t.endsWith('s') && t.length > 3) return t.slice(0, -1)
  return t
}

// ── loading the catalogue ────────────────────────────────────────────────────

/**
 * ONE query. Every heading, including the two derived in SQL (the COFOG name by join,
 * the span by aggregate). Values are never selected — note that `stat_observation.value`
 * appears nowhere below, which is the never-claim rule expressed as a query.
 */
const CATALOGUE_SQL = `
  SELECT s."seriesKey", s."seriesLabel", s.measure, s.unit, s.geography,
         s."cofogFunctionCode", f.name AS "cofogFunctionName",
         s."forecastVintage",
         d.id AS "datasetId", d.title AS "datasetTitle", d.source::text AS source,
         d."sourceUrl", d."refreshCadence"::text AS "refreshCadence",
         d.licence, d."licenceUrl",
         coalesce(s."commercialUseExcluded", d."commercialUseExcluded") AS "commercialUseExcluded",
         count(o.id)::int      AS "observationCount",
         min(o."periodLabel")  AS "firstPeriod",
         max(o."periodLabel")  AS "lastPeriod",
         min(o."periodType"::text) AS "periodType"
  FROM stat_series s
  JOIN stat_dataset d ON d.id = s."datasetId"
  LEFT JOIN stat_cofog_function f ON f.code = s."cofogFunctionCode"
  LEFT JOIN stat_observation o ON o."seriesId" = s.id
  GROUP BY s."seriesKey", s."seriesLabel", s.measure, s.unit, s.geography,
           s."cofogFunctionCode", f.name, s."forecastVintage", s."commercialUseExcluded",
           d.id, d.title, d.source, d."sourceUrl", d."refreshCadence", d.licence, d."licenceUrl",
           d."commercialUseExcluded"
  HAVING count(o.id) > 0
`

/** Attribution text per licence family. Stated so a caller can never use a figure
 *  without being told the terms that came with it. */
function attributionFor(licence: string, source: string): string {
  if (/creative commons|cc by/i.test(licence)) return `${source}, CC BY 4.0 — cite the source`
  if (/open government licence|ogl/i.test(licence)) return `${source} — Open Government Licence v3.0, cite the source`
  if (/imf/i.test(licence)) return `${source} — attribution required; COMMERCIAL reuse needs written permission`
  return `${source} — ${licence}`
}

function buildRow(r: Record<string, unknown>): CatalogueRow {
  const measure = String(r.measure)
  const geography = String(r.geography)
  const gloss = measureGlossFor(measure)
  const geoLabel = geographyLabelFor(geography)
  const cofogName = (r.cofogFunctionName as string | null) ?? null
  const firstPeriod = (r.firstPeriod as string | null) ?? null
  const lastPeriod = (r.lastPeriod as string | null) ?? null

  // The indexed fields, kept as a map so a hit can say WHICH heading matched rather than
  // just that something did. `unit` is indexed too — "percent of GDP" is a real way to
  // ask — but deliberately weighted by nothing special.
  const fields: Record<string, string> = {
    label: String(r.seriesLabel),
    measure,
    gloss: gloss ?? '',
    geography: `${geography} ${geoLabel}`,
    cofog: cofogName ? `${cofogName} ${r.cofogFunctionCode}` : '',
    dataset: String(r.datasetTitle),
    source: String(r.source).replace(/_/g, ' '),
    unit: String(r.unit).replace(/_/g, ' '),
    vintage: (r.forecastVintage as string | null) ?? '',
    span: [firstPeriod, lastPeriod].filter(Boolean).join(' '),
  }

  const fieldOfToken = new Map<string, Set<string>>()
  const tf = new Map<string, number>()
  let len = 0
  for (const [field, text] of Object.entries(fields)) {
    if (!text) continue
    const w = FIELD_WEIGHTS[field] ?? 1
    for (const t of tokenise(text)) {
      tf.set(t, (tf.get(t) ?? 0) + w)
      len += w
      if (!fieldOfToken.has(t)) fieldOfToken.set(t, new Set())
      fieldOfToken.get(t)!.add(field)
    }
  }

  return {
    seriesKey: String(r.seriesKey),
    seriesLabel: String(r.seriesLabel),
    measure,
    measureGloss: gloss,
    unit: String(r.unit),
    geography,
    geographyLabel: geoLabel.split(' ')[0] === 'United' ? geoLabel.split(' ').slice(0, 2).join(' ') : geoLabel.split(' ')[0],
    cofogFunctionCode: (r.cofogFunctionCode as string | null) ?? null,
    cofogFunctionName: cofogName,
    forecastVintage: (r.forecastVintage as string | null) ?? null,
    datasetId: String(r.datasetId),
    datasetTitle: String(r.datasetTitle),
    source: String(r.source),
    sourceUrl: (r.sourceUrl as string | null) ?? null,
    refreshCadence: String(r.refreshCadence),
    observationCount: Number(r.observationCount),
    firstPeriod,
    lastPeriod,
    periodType: (r.periodType as string | null) ?? null,
    licence: String(r.licence),
    licenceUrl: (r.licenceUrl as string | null) ?? null,
    commercialUseExcluded: r.commercialUseExcluded === true,
    attribution: attributionFor(String(r.licence), String(r.source)),
    headingText: Object.values(fields).filter(Boolean).join(' · '),
    tf,
    len,
    fieldOfToken,
  }
}

// ── the index ────────────────────────────────────────────────────────────────

interface CatalogueIndex {
  rows: CatalogueRow[]
  /** token → row indexes */
  postings: Map<string, number[]>
  /** token → number of rows containing it */
  df: Map<string, number>
  avgLen: number
  builtAt: number
}

let INDEX: CatalogueIndex | null = null
let INFLIGHT: Promise<CatalogueIndex | null> | null = null

const TTL_MS = parseInt(process.env.STATS_CATALOGUE_TTL_MS ?? '900000', 10) // 15 min

function buildIndex(rows: CatalogueRow[]): CatalogueIndex {
  const postings = new Map<string, number[]>()
  const df = new Map<string, number>()
  let total = 0
  rows.forEach((row, i) => {
    total += row.len
    for (const t of row.tf.keys()) {
      if (!postings.has(t)) postings.set(t, [])
      postings.get(t)!.push(i)
      df.set(t, (df.get(t) ?? 0) + 1)
    }
  })
  return { rows, postings, df, avgLen: rows.length ? total / rows.length : 0, builtAt: Date.now() }
}

/**
 * Load and index the catalogue, cached for `TTL_MS`.
 *
 * Returns null — never throws — when the stats DB is unconfigured or unreachable. A
 * missing statistics store must never break a Lex turn, and the caller degrades by
 * saying the stream was not consulted (which is a DIFFERENT statement from "no series
 * exists", per SEARCH_CONTRACT §6 and the failed-vs-empty distinction).
 */
export async function getCatalogueIndex(force = false): Promise<CatalogueIndex | null> {
  if (!statsConfigured()) return null
  if (!force && INDEX && Date.now() - INDEX.builtAt < TTL_MS) return INDEX
  if (INFLIGHT) return INFLIGHT
  INFLIGHT = (async () => {
    const t0 = Date.now()
    try {
      const raw = await statsQuery<Record<string, unknown>>(CATALOGUE_SQL)
      const rows = raw.map(buildRow)
      INDEX = buildIndex(rows)
      console.log('[stats-catalogue] index built', {
        series: rows.length,
        distinctTokens: INDEX.df.size,
        avgWeightedLen: Math.round(INDEX.avgLen * 10) / 10,
        restricted: rows.filter((r) => r.commercialUseExcluded).length,
        ms: Date.now() - t0,
      })
      return INDEX
    } catch (err) {
      // Loud, and does not poison the cache: the next call retries.
      console.error('[stats-catalogue] index build FAILED — the statistics stream will report ' +
        'that it could not be consulted, which is not the same as finding nothing:', err)
      return null
    } finally {
      INFLIGHT = null
    }
  })()
  return INFLIGHT
}

/** Test seam: drop the cache so a check can rebuild against changed data or env. */
export function resetCatalogueIndex(): void { INDEX = null }

// ── retrieval ────────────────────────────────────────────────────────────────

const K1 = 1.2
const B = 0.75

/**
 * ⚠⚠ THE RELEVANCE FLOOR — AND THE MEASUREMENT THAT FORCED IT.
 *
 * The §5 negative control is Q60, "How many people are on an NHS waiting list?", against a
 * store that holds **no NHS activity series at all** (measured: 0 rows match `nhs`,
 * `waiting` or `hospital` anywhere). The required behaviour is to return NOTHING, so that
 * Lex says "we do not hold that" instead of reaching for something adjacent.
 *
 * It returned nothing — until the router prompt was fixed to name the geography, after
 * which the tailored query became "UK NHS waiting list size number patients" and the
 * catalogue returned **five UK series**. The cause is exact and general: World Bank and IMF
 * labels literally begin with the country name ("United Kingdom — Life expectancy at
 * birth"), so `uk` matches the LABEL of thousands of rows at full weight. One meaningless
 * token was enough to manufacture five plausible-looking hits for a question the store
 * cannot answer.
 *
 * That is the worst failure this stream can have. A statistics feature that answers "no"
 * badly is worse than one that answers nothing at all, because the user cannot tell.
 *
 * Two floors, both structural, both applied after scoring and before returning:
 *
 *  1. AN IDENTITY MATCH IS REQUIRED. A hit must match at least one heading that describes
 *     THIS SERIES (`label`, `measure`, `gloss`, `cofog`, `vintage`) — matching only its
 *     container (`source`, `dataset`, `geography`, `unit`, `span`) is not a hit. "The ONS
 *     one" is a real way to narrow a search; it is not a way to find a series.
 *
 *  2. A DISCRIMINATING TERM IS REQUIRED. At least one matched token must appear in no more
 *     than `DISCRIMINATING_DF` of the searched population. `uk` matches ~60% of rows and
 *     tells you nothing; `gini` matches 0.6% and tells you everything. Without this, any
 *     query containing a common word returns that word's entire posting list, ranked.
 */
const IDENTITY_FIELDS = new Set(['label', 'measure', 'gloss', 'cofog', 'vintage'])
const DISCRIMINATING_DF = 0.10

export interface CatalogueSearchOutcome {
  results: SeriesDescriptor[]
  /** ⚠ TRUE when the catalogue could not be consulted at all. Distinct from an empty
   *  `results` (consulted, nothing matched) — SEARCH_CONTRACT §6's failed-vs-empty rule,
   *  which exists so Lex never says "there is no such series" when it did not look. */
  unavailable: boolean
  /** How many series the licence gate removed BEFORE scoring, so a thin result is never
   *  mistaken for a thin corpus. Always reported, never silently applied. */
  licenceWithheld: number
  /** The total the query was scored against, after the licence gate. */
  searchedOver: number
}

/**
 * Search the catalogue headings.
 *
 * ORDER MATTERS AND IS THE POINT (§3.3, §4): the licence gate runs **first**, on the row
 * set, before any scoring. A restricted series is not scored, not ranked, and not
 * filtered out of a result list afterwards — it is never a candidate. Filtering after
 * scoring is what produces the "flagged for the caller to respect" design the brief
 * rules out.
 */
export async function searchCatalogue(
  query: string,
  opts: { limit?: number; useContext: StatsUseContext },
): Promise<CatalogueSearchOutcome> {
  const limit = opts.limit ?? 8
  const idx = await getCatalogueIndex()
  if (!idx) return { results: [], unavailable: true, licenceWithheld: 0, searchedOver: 0 }

  // ── the licence gate, structural and before scoring ──
  const permitted: number[] = []
  let withheld = 0
  idx.rows.forEach((row, i) => {
    if (opts.useContext === 'commercial' && row.commercialUseExcluded) { withheld += 1; return }
    permitted.push(i)
  })
  const permittedSet = new Set(permitted)

  const qTokens = tokenise(query)
  if (!qTokens.length) {
    return { results: [], unavailable: false, licenceWithheld: withheld, searchedOver: permitted.length }
  }

  const N = permitted.length || 1
  const scores = new Map<number, number>()
  const matched = new Map<number, Set<string>>()
  /** Rows that matched at least one token rare enough to mean something (floor 2). */
  const hasDiscriminating = new Set<number>()

  for (const t of new Set(qTokens)) {
    const posting = idx.postings.get(t)
    if (!posting) continue
    // df is recomputed against the PERMITTED set: an IDF taken over rows the caller may
    // not see would rank the visible ones by a statistic drawn from a different corpus.
    const inScope = posting.filter((i) => permittedSet.has(i))
    if (!inScope.length) continue
    const discriminating = inScope.length / N <= DISCRIMINATING_DF
    const idf = Math.log(1 + (N - inScope.length + 0.5) / (inScope.length + 0.5))
    for (const i of inScope) {
      const row = idx.rows[i]
      const tf = row.tf.get(t) ?? 0
      const len = row.len || 1
      const score = idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (len / (idx.avgLen || 1)))))
      scores.set(i, (scores.get(i) ?? 0) + score)
      if (!matched.has(i)) matched.set(i, new Set())
      const fields = row.fieldOfToken.get(t) ?? new Set<string>()
      for (const f of fields) matched.get(i)!.add(f)
      // A token only counts as discriminating for THIS row if it is rare AND it landed on
      // one of the row's identity headings — a rare word in a dataset title is still the
      // container talking.
      if (discriminating && [...fields].some((f) => IDENTITY_FIELDS.has(f))) hasDiscriminating.add(i)
    }
  }

  let floored = 0
  const ranked = [...scores.entries()]
    .filter(([i]) => {
      const fields = matched.get(i) ?? new Set<string>()
      const identity = [...fields].some((f) => IDENTITY_FIELDS.has(f))
      const keep = identity && hasDiscriminating.has(i)
      if (!keep) floored += 1
      return keep
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([i, score]) => {
      const { headingText: _h, tf: _tf, len: _len, fieldOfToken: _f, ...rest } = idx.rows[i]
      return { ...rest, score: Math.round(score * 1000) / 1000, matchedOn: [...(matched.get(i) ?? [])].sort() }
    })

  if (floored) {
    console.log('[stats-catalogue] relevance floor dropped candidates', {
      query, dropped: floored, kept: ranked.length,
    })
  }

  // The boundary check, on every call — not only in the tests.
  assertNoObservationValues(ranked)

  return { results: ranked, unavailable: false, licenceWithheld: withheld, searchedOver: permitted.length }
}

/**
 * What the store holds, for the "we do not have that" answer. §5's negative control (Q60,
 * NHS waiting lists) requires Lex to name what IS held rather than substitute something
 * adjacent, and it cannot do that without being told.
 */
export async function catalogueCoverage(): Promise<
  { source: string; datasets: number; series: number; earliest: string | null; latest: string | null }[] | null
> {
  const idx = await getCatalogueIndex()
  if (!idx) return null
  const by = new Map<string, { datasets: Set<string>; series: number; first: string[]; last: string[] }>()
  for (const r of idx.rows) {
    if (!by.has(r.source)) by.set(r.source, { datasets: new Set(), series: 0, first: [], last: [] })
    const e = by.get(r.source)!
    e.datasets.add(r.datasetId); e.series += 1
    if (r.firstPeriod) e.first.push(r.firstPeriod)
    if (r.lastPeriod) e.last.push(r.lastPeriod)
  }
  return [...by.entries()]
    .map(([source, e]) => ({
      source, datasets: e.datasets.size, series: e.series,
      earliest: e.first.length ? e.first.sort()[0] : null,
      latest: e.last.length ? e.last.sort()[e.last.length - 1] : null,
    }))
    .sort((a, b) => b.series - a.series)
}
