// ─────────────────────────────────────────────────────────────────────────────
// M8 — DBT Business Population Estimates → business counts by size band: the N
// in every regulatory-friction calculation (EANDCB = per-business burden × N).
//
// Source: BPE 2025 detailed tables, Table 1 (UK private sector, start 2025).
// Size bands are computed from the granular employee-band rows and verified
// against the published "All businesses" total before anything is written.
// Counts, not £ — uprateMethod NONE; priceYear = the estimate year.
//
//   Dry run:  npx tsx scripts/costing/m8-bpe.ts
//   Apply:    npx tsx scripts/costing/m8-bpe.ts --apply
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'path'
import * as XLSX from 'xlsx'
import { neonPrisma, download, CACHE_DIR, APPLY } from './util'

const XLSX_URL = 'https://assets.publishing.service.gov.uk/media/68dbccc9c487360cc70c9f4e/BPE_2025_detailed_tables.xlsx'
const PUB_URL = 'https://www.gov.uk/government/statistics/business-population-estimates-2025'
const SOURCE = 'DBT Business Population Estimates 2025, Table 1 (UK private sector, start 2025)'

type Row = unknown[]
const val = (rows: Row[], label: RegExp): number => {
  const r = rows.find((x) => (typeof x?.[0] === 'string' && label.test((x[0] as string).trim())) || (typeof x?.[0] === 'number' && label.test(String(x[0]))))
  if (!r || typeof r[1] !== 'number') throw new Error(`row ${label} not found`)
  return r[1]
}

async function main() {
  const prisma = neonPrisma()
  const buf = await download(XLSX_URL, join(CACHE_DIR, 'bpe-2025.xlsx'))
  const wb = XLSX.read(buf, { type: 'buffer', sheets: ['Table 1'] })
  const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets['Table 1'], { header: 1, raw: true })

  const total = val(rows, /^All businesses$/i)
  const micro =
    val(rows, /^With no employees \(unregistered\)/i) + val(rows, /^With no employees \(registered\)/i) +
    val(rows, /^1$/) + val(rows, /^2 to 4$/i) + val(rows, /^5 to 9$/i)
  const small = val(rows, /^10 to 19$/i) + val(rows, /^20 to 49$/i)
  const medium = val(rows, /^50 to 99$/i) + val(rows, /^100 to 199$/i) + val(rows, /^200 to 249$/i)
  const large = val(rows, /^250 to 499$/i) + val(rows, /^500 to 999$/i) + val(rows, /^1000 or more$/i)
  if (micro + small + medium + large !== total) {
    throw new Error(`size bands (${micro + small + medium + large}) ≠ published total (${total}) — layout changed?`)
  }

  const out = [
    { id: 'm8-businesses-total', metric: 'UK private-sector businesses — total', n: total },
    { id: 'm8-businesses-micro', metric: 'UK private-sector businesses — micro (0–9 employees)', n: micro },
    { id: 'm8-businesses-small', metric: 'UK private-sector businesses — small (10–49 employees)', n: small },
    { id: 'm8-businesses-medium', metric: 'UK private-sector businesses — medium (50–249 employees)', n: medium },
    { id: 'm8-businesses-large', metric: 'UK private-sector businesses — large (250+ employees)', n: large },
  ]

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${SOURCE} (bands verified against the published total)`)
  for (const o of out) console.log(`  ${o.id.padEnd(26)} ${o.n.toLocaleString()}`)

  if (APPLY) {
    for (const o of out) {
      const data = {
        domain: 'business-population', metric: o.metric, unit: 'businesses (count)',
        low: o.n, high: o.n,
        source: SOURCE, sourceUrl: PUB_URL, year: 2025,
        method: 'The N for regulatory-friction aggregation (per-business burden × affected business count). Micro incl. unregistered/no-employee businesses.',
        notes: 'A count, not a monetary value — never uprated.',
        priceYear: 2025, category: 'EMPLOYMENT_ECONOMY' as never, region: 'UK',
        uprateMethod: 'NONE' as never, confidence: 'OFFICIAL_CURRENT' as never,
      }
      await prisma.costBenchmark.upsert({ where: { id: o.id }, create: { id: o.id, ...data }, update: data })
    }
    console.log(`  upserted ${out.length}. CostBenchmark rows now: ${await prisma.costBenchmark.count()}`)
  }
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(2) })
