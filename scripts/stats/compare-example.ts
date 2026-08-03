/**
 * compare-example.ts — the Phase B acceptance check, runnable.
 *
 * Prints the worked comparative example the sprint brief asks for (§2.3): for a given COFOG
 * function, the UK value alongside OECD/other-country values over time. Read-only.
 *
 * Usage: npm run compare   (from scripts/stats/)
 */
import { compareByCofogFunction, compareByMeasure, availableGeographies } from './query/stats-query'
import { getStatsPrisma } from './lib/db'
import { geographyLabel } from './lib/iso'

const FROM_YEAR = 2010

function table(points: { periodLabel: string; byGeography: Record<string, number> }[], cols: string[], dp = 2) {
  console.log('  year   ' + cols.map((c) => geographyLabel(c).slice(0, 13).padStart(14)).join(''))
  for (const p of points.sort((a, b) => a.periodLabel.localeCompare(b.periodLabel))) {
    const cells = cols.map((c) => {
      const v = p.byGeography[c]
      return (v === undefined ? '—' : v.toFixed(dp)).padStart(14)
    })
    console.log('  ' + p.periodLabel.padEnd(7) + cells.join(''))
  }
}

async function main() {
  const geos = await availableGeographies('oecd-cofog-expenditure')
  console.log(`Geographies held on oecd-cofog-expenditure (${geos.length}): ${geos.join(' ')}\n`)

  // ---- The brief's worked example: UK vs OECD average, health (COFOG 07), % of GDP ----
  const cols = ['GB', 'OECD_REP', 'FR', 'DE', 'US']
  console.log('=== Health spending (COFOG 07) as % of GDP — UK vs OECD average and peers ===')
  const health = await compareByCofogFunction({
    cofogFunctionCode: '07',
    geographies: cols,
    unit: 'PERCENT_GDP',
    fromYear: FROM_YEAR,
  })
  if (health.length === 0) console.log('  (no data)')
  else table(health, cols)

  // ---- Same question via the World Bank outcome indicator (different source, same axis) ----
  console.log('\n=== Current health expenditure as % of GDP — World Bank (independent source) ===')
  const wbHealth = await compareByMeasure({
    measure: 'health_expenditure_pct_gdp',
    geographies: ['GB', 'FR', 'DE', 'US'],
    fromYear: FROM_YEAR,
  })
  if (wbHealth.length === 0) console.log('  (no data)')
  else table(wbHealth.slice(-8), ['GB', 'FR', 'DE', 'US'])

  // ---- The UK's own tax-to-GDP over time, comparatively ----
  console.log('\n=== Tax revenue as % of GDP — UK vs peers (World Bank) ===')
  const tax = await compareByMeasure({
    measure: 'tax_revenue_pct_gdp',
    geographies: ['GB', 'FR', 'DE', 'US'],
    fromYear: FROM_YEAR,
  })
  if (tax.length === 0) console.log('  (no data)')
  else table(tax.slice(-8), ['GB', 'FR', 'DE', 'US'])

  // ---- Outcome vs input: does more health spend track longer life? ----
  console.log('\n=== Life expectancy (years) — the outcome half of the comparison ===')
  const life = await compareByMeasure({
    measure: 'life_expectancy_years',
    geographies: ['GB', 'FR', 'DE', 'US'],
    fromYear: FROM_YEAR,
  })
  if (life.length === 0) console.log('  (no data)')
  else table(life.slice(-8), ['GB', 'FR', 'DE', 'US'], 1)

  await getStatsPrisma().$disconnect()
}

main().catch((e) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
