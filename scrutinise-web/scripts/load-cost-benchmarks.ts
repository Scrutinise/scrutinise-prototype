// ─────────────────────────────────────────────────────────────────────────────
// Costing engine — load the VERIFIED benchmark seed (COSTING_SCOPE §7 Phase 2a).
//
// Reads docs/cost-benchmarks-seed-v1.json (every value verified against a primary
// source, per the file's principle) and, per its loader_note:
//   - upserts `benchmarks` into CostBenchmark under stable v1-* ids;
//   - DELETES the Sprint-3 `seed-*` placeholder rows ("no unverified numbers ever
//     enter the database" — the un-replaced placeholders are all in _pending);
//   - `parameters` live in code (lib/lex/costing-params.ts), NOT here;
//   - `_pending` stays visible in the JSON in docs as the extraction backlog.
//
// Idempotent: stable ids + upsert; placeholder delete is a no-op once gone.
// NOTE (soft references): CostRange.benchmarkId is a plain string in JSON — any
// range already stamped from a placeholder keeps its values/basis; only the
// picker's offer set changes.
//
// Run against Neon (the production app DB after the V26 cutover):
//   Dry run:  npx tsx scripts/load-cost-benchmarks.ts
//   Apply:    npx tsx scripts/load-cost-benchmarks.ts --apply
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

interface SeedBenchmark {
  domain: string; category: string; metric: string; unit: string
  low: number; high: number; priceYear: number; region: string
  uprateMethod: string; confidence: string
  source: string; sourceUrl: string; year: number; method: string; notes: string
}

// Stable ids per row (v1 file order is fixed; ids never change across re-runs).
const V1_IDS = ['v1-qaly', 'v1-wellby', 'v1-vpf', 'v1-homicide', 'v1-crime-total']

async function main() {
  const jsonPath = join(__dirname, '..', '..', 'docs', 'cost-benchmarks-seed-v1.json')
  const seed = JSON.parse(readFileSync(jsonPath, 'utf8')) as { benchmarks: SeedBenchmark[] }
  if (seed.benchmarks.length !== V1_IDS.length) {
    console.error(`Expected ${V1_IDS.length} benchmarks in the v1 file, found ${seed.benchmarks.length} — update V1_IDS deliberately.`)
    process.exit(1)
  }

  const placeholders = await prisma.costBenchmark.findMany({
    where: { id: { startsWith: 'seed-' } },
    select: { id: true },
  })
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${seed.benchmarks.length} verified rows in; ${placeholders.length} placeholder rows out (${placeholders.map((p) => p.id).join(', ') || 'none'})`)

  for (let i = 0; i < seed.benchmarks.length; i++) {
    const b = seed.benchmarks[i]
    const id = V1_IDS[i]
    const data = {
      domain: b.domain, metric: b.metric, unit: b.unit,
      low: b.low, high: b.high,
      source: b.source, sourceUrl: b.sourceUrl, year: b.year,
      method: b.method, notes: b.notes,
      priceYear: b.priceYear,
      category: b.category as never,
      region: b.region,
      uprateMethod: b.uprateMethod as never,
      confidence: b.confidence as never,
    }
    console.log(`  ${id}: ${b.metric.slice(0, 70)} — £${b.low.toLocaleString()}${b.high !== b.low ? `–${b.high.toLocaleString()}` : ''} (${b.priceYear} prices, ${b.confidence})`)
    if (APPLY) {
      await prisma.costBenchmark.upsert({ where: { id }, create: { id, ...data }, update: data })
    }
  }

  if (APPLY && placeholders.length) {
    await prisma.costBenchmark.deleteMany({ where: { id: { startsWith: 'seed-' } } })
    console.log(`Deleted ${placeholders.length} placeholder rows.`)
  }

  const count = await prisma.costBenchmark.count()
  console.log(`CostBenchmark rows now: ${count}${APPLY ? '' : ' (unchanged — dry run)'}`)
}

main()
  .catch((e) => { console.error(e); process.exit(2) })
  .finally(() => prisma.$disconnect())
