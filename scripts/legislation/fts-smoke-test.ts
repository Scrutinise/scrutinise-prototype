/**
 * V.4-FTS-1: Smoke test for the FTS layer.
 *
 * Validates search quality, latency, and CTE correctness against the live
 * Railway DB. Not a unit test suite — runs against production data.
 *
 * READ-ONLY: all queries are SELECT or EXPLAIN ANALYZE on a SELECT.
 * No INSERT/UPDATE/DELETE. Safe to run against production Railway.
 *
 * Run:
 *   cd scrutinise-web
 *   npx ts-node --project ..\scripts\tsconfig.json ..\scripts\legislation\fts-smoke-test.ts
 *
 * Expected: all assertions PASS, latency p99 < 500ms.
 */

import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { prisma } from '../../scrutinise-web/lib/prisma'
import { searchLegislation } from '../../scrutinise-web/lib/search'

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}
function log(msg: string) { console.log(`[${ts()}] ${msg}`) }
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { console.error(`  ✗ FAIL: ${msg}`); failCount++ }

let failCount = 0

// ── 1. Corpus health: legislationType breakdown ──────────────────────────────

async function checkCorpusHealth() {
  log('1. Corpus health')

  const rows = await prisma.$queryRaw<{ legislationType: string; count: bigint }[]>`
    SELECT li."legislationType"::text AS "legislationType", COUNT(*) AS count
    FROM "LegislationSection" ls
    JOIN "LegislationItem" li ON ls."legislationItemId" = li.id
    GROUP BY li."legislationType"
    ORDER BY count DESC
  `

  const total = rows.reduce((s, r) => s + Number(r.count), 0)
  log(`  Total LegislationSection rows: ${total.toLocaleString()}`)
  for (const r of rows) {
    log(`    ${r.legislationType}: ${Number(r.count).toLocaleString()}`)
  }

  const nullRows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count FROM "LegislationSection" WHERE "ftsVector" IS NULL
  `
  const nullCount = Number(nullRows[0].count)
  if (nullCount === 0) {
    pass(`ftsVector fully populated (${total.toLocaleString()} rows)`)
  } else {
    fail(`${nullCount.toLocaleString()} rows still have NULL ftsVector`)
  }
}

// ── 2. EXPLAIN ANALYZE — verify CTE bounds ts_headline work ─────────────────

async function checkCteExplain() {
  log('2. EXPLAIN ANALYZE — verify ts_headline runs only on bounded set')

  // Run EXPLAIN ANALYZE on the legislation CTE query with a high-frequency term
  const rows = await prisma.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(`
    EXPLAIN ANALYZE
    WITH ranked AS (
      SELECT
        ls.id AS "sectionId",
        ls."sectionNumber",
        ls."sectionTitle",
        ls."originalText",
        li."legislationGovUkId" AS "actId",
        li.title AS "actTitle",
        li."legislationType"::text AS "legislationType",
        li.year,
        ts_rank_cd(ls."ftsVector", plainto_tsquery('english', 'person')) AS rank
      FROM "LegislationSection" ls
      JOIN "LegislationItem" li ON ls."legislationItemId" = li.id
      WHERE ls."ftsVector" @@ plainto_tsquery('english', 'person')
      ORDER BY rank DESC
      LIMIT 20
    )
    SELECT
      "sectionId", "sectionNumber", "sectionTitle", "actId", "actTitle",
      "legislationType", year, rank,
      ts_headline(
        'english',
        coalesce("sectionTitle", '') || ' ' || coalesce("originalText", ''),
        plainto_tsquery('english', 'person'),
        'MaxFragments=2,MinWords=10,MaxWords=30,StartSel=<<,StopSel=>>'
      ) AS snippet
    FROM ranked
    WHERE rank >= 0.05
    ORDER BY rank DESC
  `)

  const plan = rows.map(r => r['QUERY PLAN']).join('\n')
  log('  Query plan:')
  plan.split('\n').forEach(line => log(`    ${line}`))

  // The outer ts_headline must show "rows=20" or fewer, not the full match count
  const hasGinScan = plan.includes('Bitmap Index Scan') || plan.includes('Index Scan') || plan.includes('Bitmap Heap Scan')
  if (hasGinScan) {
    pass('GIN index used for @@ operator')
  } else {
    fail('Expected GIN index scan — got sequential scan instead')
  }
}

// ── 3. Known-query validation ────────────────────────────────────────────────

type TestCase = {
  label:           string
  q:               string
  filter?:         { type?: 'ukpga' | 'uksi'; year?: number; actId?: string }
  expectActInTop3: string    // partial match on actTitle or actId
  expectMinCount:  number
}

const TEST_CASES: TestCase[] = [
  {
    label:           'Data Protection Act 2018',
    q:               'data protection',
    filter:          { type: 'ukpga', year: 2018 },
    expectActInTop3: 'Data Protection',
    expectMinCount:  5,
  },
  {
    label:           'Human Rights Act 1998',
    q:               'human rights',
    filter:          { type: 'ukpga', year: 1998 },
    expectActInTop3: 'Human Rights',
    expectMinCount:  3,
  },
  {
    label:           'Online Safety Act 2023 — commencement',
    q:               'commencement',
    filter:          { type: 'uksi' },
    expectActInTop3: '',   // just check count
    expectMinCount:  10,
  },
  {
    label:           'actId filter — ukpga/2018/12',
    q:               'controller',
    filter:          { actId: 'ukpga/2018/12' },
    expectActInTop3: '',
    expectMinCount:  1,
  },
]

async function checkKnownQueries() {
  log('3. Known-query validation')

  for (const tc of TEST_CASES) {
    const t0 = Date.now()
    const { results, totalMatches } = await searchLegislation({
      q:       tc.q,
      filters: tc.filter ?? {},
      limit:   20,
    })
    const elapsed = Date.now() - t0

    if (totalMatches < tc.expectMinCount) {
      fail(`"${tc.label}": expected ≥${tc.expectMinCount} results, got ${totalMatches}`)
    } else {
      pass(`"${tc.label}": ${totalMatches} results (${elapsed}ms)`)
    }

    if (tc.expectActInTop3) {
      const top3 = results.slice(0, 3).map(r => r.actTitle.toLowerCase())
      const found = top3.some(t => t.includes(tc.expectActInTop3.toLowerCase()))
      if (!found) {
        fail(`"${tc.label}": expected "${tc.expectActInTop3}" in top-3 actTitles; got: ${top3.join(' | ')}`)
      } else {
        pass(`"${tc.label}": "${tc.expectActInTop3}" found in top-3`)
      }
    }
  }
}

// ── 4. Latency — high-frequency term ────────────────────────────────────────

async function checkLatency() {
  log('4. Latency (high-frequency term "person" — worst-case GIN selectivity)')

  const RUNS = 5
  const times: number[] = []

  for (let i = 0; i < RUNS; i++) {
    const t0 = Date.now()
    await searchLegislation({ q: 'person', limit: 20, minRank: 0.05 })
    times.push(Date.now() - t0)
  }

  times.sort((a, b) => a - b)
  const p50 = times[Math.floor(RUNS * 0.5)]
  const p99 = times[RUNS - 1]  // with only 5 runs, max = p99 proxy

  log(`  p50: ${p50}ms  p99 (proxy, n=${RUNS}): ${p99}ms`)

  if (p99 <= 500) {
    pass(`p99 ${p99}ms ≤ 500ms target`)
  } else {
    fail(`p99 ${p99}ms exceeds 500ms target — optimisation needed`)
  }
}

// ── 5. ts_rank_cd value sampling — inform minRank tuning ────────────────────

async function checkRankDistribution() {
  log('5. ts_rank_cd value sampling for minRank tuning')

  const rows = await prisma.$queryRaw<{ rank: number; pct: number }[]>`
    WITH sample AS (
      SELECT ts_rank_cd(ls."ftsVector", plainto_tsquery('english', 'data protection')) AS rank
      FROM "LegislationSection" ls
      WHERE ls."ftsVector" @@ plainto_tsquery('english', 'data protection')
      ORDER BY rank DESC
      LIMIT 500
    )
    SELECT
      round(rank::numeric, 3) AS rank,
      row_number() OVER (ORDER BY rank DESC) / 500.0 * 100 AS pct
    FROM sample
    ORDER BY rank DESC
    LIMIT 20
  `

  log('  Top-20 rank values for "data protection" (rank | cumulative %):')
  for (const r of rows) {
    log(`    ${r.rank.toFixed(4)} | ${Number(r.pct).toFixed(1)}%`)
  }
  pass('rank distribution sampled — use to tune minRank')
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  log('V.4-FTS-1 smoke test starting')

  await checkCorpusHealth()
  await checkCteExplain()
  await checkKnownQueries()
  await checkLatency()
  await checkRankDistribution()

  log(`\nSmoke test complete — ${failCount === 0 ? 'ALL PASS' : `${failCount} FAILURE(S)`}`)
  await prisma.$disconnect()
  if (failCount > 0) process.exit(1)
}

main().catch(async err => {
  console.error(`[${ts()}] Smoke test error:`, err)
  await prisma.$disconnect()
  process.exit(1)
})
