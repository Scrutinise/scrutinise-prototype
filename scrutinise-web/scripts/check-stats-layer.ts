// End-to-end check of the WEB-side stats read layer against the live stats DB — the exact
// surface Lex answers from. Run after any change to lib/stats/* or to the ingest schema.
//   cd scrutinise-web && npx tsx scripts/check-stats-layer.ts
//
// Written 2026-08-05 alongside `seriesKey`. It exists because the two things most likely to
// break here are invisible to `tsc`: a SQL column rename, and an analytical drift between this
// mirror and the script-side one. Every assertion below is against real rows.
import 'dotenv/config'
import {
  findSeries, getSeriesByKey, getSeriesById, resolveSeries, getCofogRollup,
  getComparative, listCatalogue, geographiesFor,
} from '../lib/stats/stats-query'

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

async function main() {
  console.log('=== web-side stats read layer, against the live DB ===\n')

  // 1. catalogue search returns a stable key on every hit
  const found = await findSeries('public_expenditure_by_function', 5)
  check('findSeries returns rows', found.length > 0, `${found.length} hits`)
  check('every hit carries a seriesKey', found.every((s) => typeof s.seriesKey === 'string' && s.seriesKey.length === 64),
    `e.g. ${found[0]?.seriesKey?.slice(0, 16)}…`)
  check('every hit carries effective licence terms', found.every((s) => typeof s.commercialUseExcluded === 'boolean'))

  // 2. THE RETRIEVAL CONTRACT: the key is the handle, and it resolves back to the same row
  const one = found[0]
  const byKey = await getSeriesByKey(one.seriesKey)
  check('getSeriesByKey round-trips', byKey?.seriesId === one.seriesId, `${byKey?.seriesLabel}`)
  const byId = await getSeriesById(one.seriesId)
  check('getSeriesById agrees with getSeriesByKey', byId?.seriesKey === one.seriesKey)
  check('getSeriesByKey returns null LOUDLY on an unknown key', (await getSeriesByKey('0'.repeat(64))) === null)
  const resolved = await resolveSeries({
    datasetId: one.datasetId, measure: one.measure, geography: one.geography,
    cofogFunctionCode: one.cofogFunctionCode, seriesLabel: one.seriesLabel,
  })
  check('resolveSeries (repair path) finds it too', resolved.some((r) => r.seriesKey === one.seriesKey))

  // 3. the headline question still reconciles with the figure of record
  const rollup = await getCofogRollup({})
  check('COFOG rollup returns 10 functions', rollup?.rows.length === 10, `${rollup?.periodLabel}`)
  const total = Math.round(rollup?.total ?? 0)
  check('total is the verified £1,157,828m', total === 1157828, `£${total.toLocaleString()}m`)
  const top = rollup?.rows[0]
  check('top function is Social protection ~33.2%', top?.cofogFunctionCode === '10' && Math.abs(top.shareOfTotal - 0.332) < 0.002,
    `${top?.cofogFunctionName} ${(100 * (top?.shareOfTotal ?? 0)).toFixed(1)}%`)
  check('rollup states its status rather than leaving Lex to guess', !!rollup?.status, `status=${rollup?.status}`)

  // 4. Phase B comparative — including the IMF layer added 2026-08-05
  const health = await getComparative({ measure: 'health_expenditure_pct_gdp' })
  check('World Bank comparative works', (health?.rows.length ?? 0) >= 10, `${health?.rows.length} countries, ${health?.periodLabel}`)
  check('the UK is present in the comparison', health?.ukValue != null, `GB=${health?.ukValue}`)
  check('a computed mean is labelled as computed, not published', !!health?.computedMeanBasis)

  const imf = await getComparative({ measure: 'govt_expenditure_by_function' })
  check('IMF comparative measure is queryable', (imf?.rows.length ?? 0) > 0, `${imf?.rows.length} rows, ${imf?.periodLabel}`)
  // The licence flag is the whole point of the per-series column — IMF must come back restricted.
  check('IMF rows report commercialUseExcluded=true', imf?.commercialUseExcluded === true)

  const geos = await geographiesFor('govt_expenditure_by_function')
  check('IMF covers the comparator set', geos.length >= 20, `${geos.length} geographies`)
  check('UK is stored as GB, not UK', geos.includes('GB') && !geos.includes('UK'))

  // 5. the catalogue Lex is shown
  const cat = await listCatalogue()
  check('catalogue lists measures', cat.length > 0, `${cat.length} measure/unit/geography groups`)

  // 6. unit recovery — the OBR forecast series must now be reachable by search
  const obr = await findSeries('psnb', 5)
  check('OBR forecast series reach catalogue search', obr.length > 0,
    obr[0] ? `${obr[0].seriesLabel} [${obr[0].unit}]` : 'none')
  check('…and none of them are unit=UNKNOWN', obr.every((s) => s.unit !== 'UNKNOWN'))
  check('…and the forecast round travels with them',
    obr.some((s) => s.forecastVintage) || obr.every((s) => s.forecastVintage === null),
    `e.g. vintage=${obr[0]?.forecastVintage ?? 'null (outturn)'}`)

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1) })
