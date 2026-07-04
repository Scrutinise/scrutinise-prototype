// ─────────────────────────────────────────────────────────────────────────────
// M6 — ONS ASHE median gross hourly earnings → ADMIN_BURDEN wage inputs for the
// Standard Cost Model (admin burden = time × wage × frequency × population).
//
// Source: ASHE 2025 provisional. Table 1 (all employees, UK) + Table 2
// (occupation SOC20 2-digit; includes the 1-digit major-group aggregate rows).
// Zips of xlsx — read via util.unzipEntry (no new dependency).
// On the next ASHE release: update the two zip URLs and re-run.
//
//   Dry run:  npx tsx scripts/costing/m6-ashe.ts
//   Apply:    npx tsx scripts/costing/m6-ashe.ts --apply
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'path'
import * as XLSX from 'xlsx'
import { neonPrisma, download, unzipEntry, CACHE_DIR, APPLY } from './util'

const T1_ZIP = 'https://www.ons.gov.uk/file?uri=/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/allemployeesashetable1/2025provisional/ashetable12025provisional.zip'
const T2_ZIP = 'https://www.ons.gov.uk/file?uri=/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/occupation2digitsocashetable2/2025provisional/ashetable22025provisional.zip'
const PUB_URL = 'https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/allemployeesashetable1'
const SOURCE = 'ONS Annual Survey of Hours and Earnings (ASHE) 2025 provisional, hourly pay – gross'

type Row = unknown[]

function medianMean(rows: Row[], label: RegExp): { median: number; mean: number } {
  const r = rows.find((x) => typeof x?.[0] === 'string' && label.test((x[0] as string).trim()))
  if (!r || typeof r[3] !== 'number' || typeof r[5] !== 'number') throw new Error(`row ${label} not found/parseable`)
  return { median: r[3], mean: r[5] }
}

async function main() {
  const prisma = neonPrisma()
  const z1 = await download(T1_ZIP, join(CACHE_DIR, 'ashe-t1-2025p.zip'))
  const z2 = await download(T2_ZIP, join(CACHE_DIR, 'ashe-t2-2025p.zip'))
  const f1 = unzipEntry(z1, /Table 1\.5a\s+Hourly pay - Gross.*\.xlsx$/)
  const f2 = unzipEntry(z2, /Table 2\.5a\s+Hourly pay - Gross.*\.xlsx$/)

  const all1 = XLSX.utils.sheet_to_json<Row>(XLSX.read(f1.data, { type: 'buffer' }).Sheets['All'], { header: 1, raw: true })
  const all2 = XLSX.utils.sheet_to_json<Row>(XLSX.read(f2.data, { type: 'buffer' }).Sheets['All'], { header: 1, raw: true })

  const rows = [
    { id: 'm6-hourly-all', metric: 'Median gross hourly earnings — all employees (UK)', ...medianMean(all1, /^All Employees$/i) },
    { id: 'm6-hourly-professional', metric: 'Median gross hourly earnings — professional occupations (SOC major group 2)', ...medianMean(all2, /^Professional occupations$/i) },
    { id: 'm6-hourly-admin', metric: 'Median gross hourly earnings — administrative and secretarial occupations (SOC major group 4)', ...medianMean(all2, /^Administrative and secretarial occupations$/i) },
  ]

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${SOURCE}`)
  for (const r of rows) console.log(`  ${r.id.padEnd(26)} median £${r.median}/hr (mean £${r.mean})`)
  // Sanity: professional > all > admin.
  if (!(rows[1].median > rows[0].median && rows[0].median > rows[2].median)) throw new Error('ordering sanity failed — check extraction')

  if (APPLY) {
    for (const r of rows) {
      const data = {
        domain: 'admin-burden', metric: r.metric, unit: 'GBP per hour',
        low: r.median, high: r.mean, // [median, mean] — an honest range for SCM wage input
        source: SOURCE, sourceUrl: PUB_URL, year: 2025,
        method: `Range = [median £${r.median}, mean £${r.mean}]. Standard Cost Model wage input: admin burden = time × wage × frequency × population. Add non-wage overheads (~25-30%) per SCM practice.`,
        notes: 'ASHE 2025 provisional; employees on adult rates, pay unaffected by absence.',
        priceYear: 2025, category: 'ADMIN_BURDEN' as never, region: 'UK',
        uprateMethod: 'GDP_DEFLATOR' as never, confidence: 'OFFICIAL_CURRENT' as never,
      }
      await prisma.costBenchmark.upsert({ where: { id: r.id }, create: { id: r.id, ...data }, update: data })
    }
    console.log(`  upserted ${rows.length}. CostBenchmark rows now: ${await prisma.costBenchmark.count()}`)
  }
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(2) })
