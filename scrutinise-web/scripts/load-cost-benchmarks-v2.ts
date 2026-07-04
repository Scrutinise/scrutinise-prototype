// ─────────────────────────────────────────────────────────────────────────────
// Costing engine — load the v2 ADDITIONS seed (COSTING Phase 2a session 2).
//
// Reads docs/cost-benchmarks-seed-v2-additions.json per its loader_note:
//   - APPENDS `benchmarks` (Home Office costs-of-crime 2019/20 edition, 2019/20
//     prices, OGL v3.0) — `benchmarks_common_fields` merged into every row;
//   - REPLACES v1's homicide row and v1's 2015/16 context anchor (deletes
//     v1-homicide + v1-crime-total; the v2 rows carry the newer edition);
//   - the `cc_extraction_manifest` stays in the JSON as the scripted-ingest
//     backlog (worked by scripts/costing/*).
//
// Idempotent: stable v2-* ids + upsert; deletes are no-ops once gone.
//
// Run against Neon:
//   Dry run:  npx tsx scripts/load-cost-benchmarks-v2.ts
//   Apply:    npx tsx scripts/load-cost-benchmarks-v2.ts --apply
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL
if (!connectionString) {
  console.error('No NEON_DATABASE_URL or DATABASE_URL set.')
  process.exit(1)
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const APPLY = process.argv.includes('--apply')

interface V2Row { metric: string; unit: string; low: number; high: number; method: string; notes: string }
interface V2Common {
  domain: string; category: string; region: string; priceYear: number
  uprateMethod: string; confidence: string; year: number; source: string; sourceUrl: string
  usage_rule: string
}

// Stable ids, one per row in file order (fail loudly if the file changes shape).
const V2_IDS = [
  'v2-homicide', 'v2-violence-injury', 'v2-violence-no-injury', 'v2-rape',
  'v2-other-sexual', 'v2-robbery-personal', 'v2-burglary-domestic', 'v2-vehicle-theft',
  'v2-theft-from-vehicle', 'v2-theft-person', 'v2-criminal-damage', 'v2-fraud-individual',
  'v2-cybercrime-individual', 'v2-robbery-commercial', 'v2-burglary-commercial',
  'v2-theft-commercial', 'v2-commercial-vehicle-theft', 'v2-theft-from-commercial-vehicle',
  'v2-criminal-damage-commercial', 'v2-crime-total',
]

// Rows the v2 file REPLACES (per _meta.relationship_to_v1 + the rows' own notes).
const V1_REPLACED = ['v1-homicide', 'v1-crime-total']

// Short form of the common usage_rule, carried on every unit-cost row so each row
// is self-contained when surfaced to a user.
const USAGE_SHORT =
  'Usage: per ALL crimes (incl. unreported) — multiply police-recorded volumes by the multiplier first; ' +
  'consider excluding the anticipation component for marginal changes.'

async function main() {
  const jsonPath = join(__dirname, '..', '..', 'docs', 'cost-benchmarks-seed-v2-additions.json')
  const seed = JSON.parse(readFileSync(jsonPath, 'utf8')) as {
    benchmarks: V2Row[]
    benchmarks_common_fields: V2Common
  }
  if (seed.benchmarks.length !== V2_IDS.length) {
    console.error(`Expected ${V2_IDS.length} v2 benchmarks, found ${seed.benchmarks.length} — update V2_IDS deliberately.`)
    process.exit(1)
  }
  const c = seed.benchmarks_common_fields

  const replaced = await prisma.costBenchmark.findMany({ where: { id: { in: V1_REPLACED } }, select: { id: true } })
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${seed.benchmarks.length} v2 rows in; replacing (${replaced.map((r) => r.id).join(', ') || 'already gone'})`)

  for (let i = 0; i < seed.benchmarks.length; i++) {
    const b = seed.benchmarks[i]
    const id = V2_IDS[i]
    const isUnitCost = b.metric.startsWith('Unit cost:')
    const data = {
      domain: c.domain, metric: b.metric, unit: b.unit,
      low: b.low, high: b.high,
      source: c.source, sourceUrl: c.sourceUrl, year: c.year,
      method: b.method,
      notes: isUnitCost ? `${b.notes} | ${USAGE_SHORT}` : b.notes,
      priceYear: c.priceYear,
      category: c.category as never,
      region: c.region,
      uprateMethod: c.uprateMethod as never,
      confidence: c.confidence as never,
    }
    console.log(`  ${id}: ${b.metric.slice(0, 58).padEnd(58)} £${b.low.toLocaleString()}`)
    if (APPLY) await prisma.costBenchmark.upsert({ where: { id }, create: { id, ...data }, update: data })
  }

  if (APPLY && replaced.length) {
    await prisma.costBenchmark.deleteMany({ where: { id: { in: V1_REPLACED } } })
    console.log(`Deleted replaced v1 rows: ${replaced.map((r) => r.id).join(', ')}`)
  }

  const count = await prisma.costBenchmark.count()
  console.log(`CostBenchmark rows now: ${count}${APPLY ? '' : ' (unchanged — dry run)'}`)
}

main()
  .catch((e) => { console.error(e); process.exit(2) })
  .finally(() => prisma.$disconnect())
