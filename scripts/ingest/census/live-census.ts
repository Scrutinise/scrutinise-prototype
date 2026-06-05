/**
 * live-census.ts — real-time corpus coverage snapshot
 *
 * Queries:
 *   1. Neon corpus_sections counts by corpus + status
 *   2. Neon LegislationSection count (legacy pipeline)
 *   3. Railway ingest_queue state by corpus + status
 *
 * Outputs: JSON to R2 as ingest-csv/census-{date}.json
 * Also returns CensusResult for use by the scheduler.
 *
 * Usage (standalone):
 *   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
 *     --tsconfig scripts/tsconfig.json scripts/ingest/census/live-census.ts
 */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { r2Put } from '../shared/r2-client'

export interface CorpusSectionCount {
  corpus: string
  compiled: number
  failed: number
  pending: number
  total: number
  latest: Date | null
}

export interface QueueStateRow {
  corpus: string
  status: string
  rows: number
  lastActivity: Date | null
}

export interface CensusResult {
  timestamp: Date
  corpusSections: CorpusSectionCount[]
  legacyLegislationSections: number
  queueState: QueueStateRow[]
  grandTotalSections: number
}

let _neonPool: Pool | null = null
function getNeonPool(): Pool {
  if (!_neonPool) {
    const url = process.env.NEON_DATABASE_URL
    if (!url) throw new Error('NEON_DATABASE_URL not set')
    _neonPool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 60_000 })
  }
  return _neonPool
}

let _railwayPool: Pool | null = null
function getRailwayPool(): Pool {
  if (!_railwayPool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL not set')
    _railwayPool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 60_000 })
  }
  return _railwayPool
}

export async function runCensus(): Promise<CensusResult> {
  const timestamp = new Date()

  // 1. Neon corpus_sections: counts by corpus and status
  const sectionsRes = await getNeonPool().query<{
    corpus: string; status: string; cnt: string; latest: Date | null
  }>(`
    SELECT corpus, status, COUNT(*)::text AS cnt, MAX("createdAt") AS latest
    FROM corpus_sections
    GROUP BY corpus, status
    ORDER BY corpus, status
  `)

  const corpusMap = new Map<string, CorpusSectionCount>()
  for (const row of sectionsRes.rows) {
    const n = parseInt(row.cnt, 10)
    if (!corpusMap.has(row.corpus)) {
      corpusMap.set(row.corpus, { corpus: row.corpus, compiled: 0, failed: 0, pending: 0, total: 0, latest: null })
    }
    const entry = corpusMap.get(row.corpus)!
    if (row.status === 'compiled') entry.compiled += n
    else if (row.status === 'failed') entry.failed += n
    else entry.pending += n
    entry.total += n
    if (row.latest && (!entry.latest || row.latest > entry.latest)) entry.latest = row.latest
  }
  const corpusSections = Array.from(corpusMap.values())
    .sort((a, b) => b.total - a.total)

  // 2. Neon legacy LegislationSection count
  let legacyLegislationSections = 0
  try {
    const legRes = await getNeonPool().query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM "LegislationSection"'
    )
    legacyLegislationSections = parseInt(legRes.rows[0]?.n ?? '0', 10)
  } catch (err) {
    console.warn('[census] LegislationSection count failed:', err)
  }

  // 3. Railway ingest_queue state
  const queueRes = await getRailwayPool().query<{
    corpus: string; status: string; rows: string; last_activity: Date | null
  }>(`
    SELECT corpus, status, COUNT(*)::text AS rows,
           MAX("updatedAt") AS last_activity
    FROM ingest_queue
    GROUP BY corpus, status
    ORDER BY corpus, status
  `)
  const queueState: QueueStateRow[] = queueRes.rows.map(r => ({
    corpus: r.corpus,
    status: r.status,
    rows: parseInt(r.rows, 10),
    lastActivity: r.last_activity,
  }))

  const newPipelineTotal = corpusSections.reduce((s, c) => s + c.compiled, 0)
  const grandTotalSections = legacyLegislationSections + newPipelineTotal

  return { timestamp, corpusSections, legacyLegislationSections, queueState, grandTotalSections }
}

export async function saveToR2(result: CensusResult): Promise<void> {
  const dateStr = result.timestamp.toISOString().slice(0, 10)
  const key = `ingest-csv/census-${dateStr}.json`
  await r2Put(key, JSON.stringify(result, null, 2), 'application/json')
  console.log(`[census] written to R2: ${key}`)
}

function printSummary(result: CensusResult): void {
  console.log(`\n=== CORPUS CENSUS — ${result.timestamp.toISOString()} ===`)
  console.log(`\nLEGACY (LegislationSection): ${result.legacyLegislationSections.toLocaleString()}`)
  console.log(`\nNEW PIPELINE (corpus_sections):`)
  for (const c of result.corpusSections) {
    const line = `  ${c.corpus.padEnd(32)} compiled=${c.compiled.toLocaleString().padStart(9)}  failed=${c.failed.toLocaleString().padStart(7)}  total=${c.total.toLocaleString().padStart(9)}`
    console.log(line)
  }
  console.log(`\nGRAND TOTAL: ${result.grandTotalSections.toLocaleString()} sections`)
  console.log(`\nQUEUE STATE (by corpus):`)
  const queueByCorpus = new Map<string, Record<string, number>>()
  for (const r of result.queueState) {
    if (!queueByCorpus.has(r.corpus)) queueByCorpus.set(r.corpus, {})
    queueByCorpus.get(r.corpus)![r.status] = r.rows
  }
  for (const [corpus, statuses] of Array.from(queueByCorpus).sort()) {
    const parts = Object.entries(statuses).map(([s, n]) => `${s}=${n.toLocaleString()}`).join('  ')
    console.log(`  ${corpus.padEnd(32)} ${parts}`)
  }
}

// Standalone run
async function main() {
  const result = await runCensus()
  printSummary(result)
  await saveToR2(result)
  await getNeonPool().end()
  await getRailwayPool().end()
}

if (require.main === module) {
  main().catch((e: any) => { console.error('[census] fatal:', e.message); process.exit(1) })
}
