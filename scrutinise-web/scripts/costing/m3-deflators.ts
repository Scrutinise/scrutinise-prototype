// ─────────────────────────────────────────────────────────────────────────────
// M3 — HMT GDP deflator series → DeflatorSeries (manifest: "do this first").
//
// Source: HMT "GDP deflators at market prices, and money GDP" (quarterly).
// This run: June 2026 QNA update (outturn to FY 2025-26, ONS series L8GG).
// On the next quarterly release: update SOURCE_URL and re-run — that is the
// whole refresh procedure.
//
// Extraction rule (verified against the file's own footnotes):
//   - financial-year rows: col 1 = "YYYY-YY", col 2 = deflator (2025-26 = 100);
//   - OBR FORECAST rows print "-" in the deflator column → excluded by requiring
//     a numeric value. Forecasts must NEVER enter the series: computeCostSummary
//     uprates to max(year), which must be the latest OUTTURN, not a projection.
//   - key = the FY's STARTING year (2019-20 → 2019), matching how priceYear is
//     stored on CostBenchmark (crime "2019/20 prices" → 2019, QALY "20/21" → 2020).
//
// REPLACES the whole table (the Sprint-3 illustrative placeholder series dies here).
//
//   Dry run:  npx tsx scripts/costing/m3-deflators.ts
//   Apply:    npx tsx scripts/costing/m3-deflators.ts --apply
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'path'
import * as XLSX from 'xlsx'
import { neonPrisma, download, CACHE_DIR, APPLY } from './util'

const SOURCE_URL =
  'https://assets.publishing.service.gov.uk/media/6a43dbc7167a99cf0018d9a0/GDP_Deflators_Qtrly_National_Accounts_June_2026_update.xlsx'
const SOURCE_LABEL = 'HMT GDP deflators, June 2026 QNA update (ONS L8GG, FY, 2025-26 = 100)'

async function main() {
  const prisma = neonPrisma()
  const buf = await download(SOURCE_URL, join(CACHE_DIR, 'gdp-deflators-june-2026.xlsx'))
  const wb = XLSX.read(buf, { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true })

  const series: { year: number; index: number }[] = []
  for (const r of rows) {
    const label = r?.[1]
    const value = r?.[2]
    const m = typeof label === 'string' && label.trim().match(/^(\d{4})-\d{2}$/)
    if (m && typeof value === 'number' && isFinite(value)) {
      series.push({ year: parseInt(m[1], 10), index: value })
    }
  }

  // Sanity gates — fail loudly rather than load a malformed series.
  const years = series.map((s) => s.year)
  const maxYear = Math.max(...years)
  const rebase = series.find((s) => s.year === maxYear)
  const problems: string[] = []
  if (series.length < 60) problems.push(`only ${series.length} rows parsed (expected ~70)`)
  if (!years.includes(1999)) problems.push('1999 missing (manifest wants 1999→present)')
  if (new Set(years).size !== years.length) problems.push('duplicate years')
  if (!rebase || Math.abs(rebase.index - 100) > 0.01) problems.push(`latest year ${maxYear} index ${rebase?.index} ≠ 100 (rebase year should be the latest outturn)`)
  if (maxYear > new Date().getFullYear()) problems.push(`max year ${maxYear} is in the future — a forecast row leaked in`)
  if (problems.length) {
    console.error('SANITY FAIL:', problems.join(' | '))
    process.exit(1)
  }

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${SOURCE_LABEL}`)
  console.log(`  parsed ${series.length} outturn years: ${series[0].year} → ${maxYear} (index ${series[0].index} → 100)`)
  const spot = (y: number) => series.find((s) => s.year === y)?.index
  console.log(`  spot checks: 1999=${spot(1999)}, 2016=${spot(2016)}, 2019=${spot(2019)}, 2020=${spot(2020)}, 2024=${spot(2024)}`)

  if (APPLY) {
    await prisma.$transaction([
      prisma.deflatorSeries.deleteMany({}),
      prisma.deflatorSeries.createMany({ data: series }),
    ])
    const n = await prisma.deflatorSeries.count()
    console.log(`  DeflatorSeries replaced: ${n} rows (placeholder series gone).`)
  }
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(2) })
