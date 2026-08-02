/**
 * _fts-latency-diag-tmp.ts — TEMPORARY diagnostic (pre-promotion blocker, Aug 2026).
 *
 * Reproduces rankedSearch() against the SAME corpus_fts dataset on R2, with a
 * component-level timing split, to locate the ~25-32s warm latency observed on
 * fts-serve-production.
 *
 * Deliberately lives OUTSIDE scripts/ingest/search/ so it can never trip the
 * fts-serve watchPattern ('scripts/ingest/search/**'). Do not commit.
 *
 * Run:  cd scripts/ingest && ./node_modules/.bin/tsx _fts-latency-diag-tmp.ts
 */
import { lancedb, connectLance, FTS_TABLE } from './search/lance'
import { parseCitation, resolveCitation, idPatternsFor, loadActIndex, ActIndex } from './search/citation-resolver'
import { OVERSCAN } from './search/fts-core'

const ms = (t: bigint) => Number(process.hrtime.bigint() - t) / 1e6
const rss = () => `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`

type Split = { total: number; ftsLookup: number; rerank: number; resolve: number; rows: number; out: number }

async function timedRankedSearch(
  table: lancedb.Table,
  query: string,
  opts: { tier?: string; limit?: number; actIndex?: ActIndex } = {},
): Promise<Split> {
  const tAll = process.hrtime.bigint()
  const limit = opts.limit ?? 20
  const k = Math.max(limit * OVERSCAN, 100)

  // ── 1. the LanceDB FTS lookup ──────────────────────────────────────────────
  const t1 = process.hrtime.bigint()
  let q = table.search(query, 'fts', 'body').limit(k)
  if (opts.tier) q = (q as any).where(`tier = '${opts.tier.replace(/'/g, "''")}'`)
  const rows = await q.toArray()
  const ftsLookup = ms(t1)

  // ── 2. pure-CPU re-rank (map + sort) ───────────────────────────────────────
  const t2 = process.hrtime.bigint()
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3)
  const isCitation = !!opts.actIndex && !!parseCitation(query)
  const bm25 = rows.map((r: any) => {
    const bodyScore = typeof r._score === 'number' ? r._score : 0
    const title = (r.sectionTitle ?? null) as string | null
    const titleBoosted = !!title && terms.some((t) => title.toLowerCase().includes(t))
    const tierBoost = r.tier === 'legislation' ? (isCitation ? 1.6 : 1.8) : 1
    const body = (r.body ?? '') as string
    return { id: r.id, score: bodyScore * (titleBoosted ? 2.5 : 1) * tierBoost, body }
  })
  bm25.sort((a, b) => b.score - a.score)
  const rerank = ms(t2)

  // ── 3. citation resolver injections ────────────────────────────────────────
  const t3 = process.hrtime.bigint()
  let injected = 0
  if (opts.actIndex) {
    const parsed = parseCitation(query)
    if (parsed) {
      const r = resolveCitation(parsed, opts.actIndex)
      if (r) {
        const pats = idPatternsFor(r)
        const like = pats.exact ?? pats.actLevel
        const max = pats.exact ? 4 : 12
        const got = (await table.query().where(`id LIKE '${like}'`).limit(max).toArray()) as any[]
        injected = got.length
      }
    }
  }
  const resolve = ms(t3)

  return { total: ms(tAll), ftsLookup, rerank, resolve, rows: rows.length, out: Math.min(bm25.length + injected, limit) }
}

function row(label: string, s: Split) {
  console.log(
    `${label.padEnd(38)} total=${s.total.toFixed(0).padStart(6)}ms  ` +
    `fts=${s.ftsLookup.toFixed(0).padStart(6)}ms  rerank=${s.rerank.toFixed(1).padStart(6)}ms  ` +
    `resolve=${s.resolve.toFixed(0).padStart(5)}ms  rows=${String(s.rows).padStart(4)}  rss=${rss()}`,
  )
}

async function main() {
  console.log(`node ${process.version}  heapLimit≈${Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024)}MB\n`)

  const tC = process.hrtime.bigint()
  const conn = await connectLance()
  const table = await conn.openTable(FTS_TABLE)
  console.log(`connect+openTable            ${ms(tC).toFixed(0)}ms   rss=${rss()}`)

  const tR = process.hrtime.bigint()
  const rows = await table.countRows()
  console.log(`countRows (${rows})     ${ms(tR).toFixed(0)}ms   rss=${rss()}\n`)

  // ActIndex from Neon, exactly as the service does at boot.
  let actIndex: ActIndex | undefined
  if (process.env.NEON_DATABASE_URL) {
    const { Pool } = require('pg')
    const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })
    const tA = process.hrtime.bigint()
    try { actIndex = await loadActIndex(pool); console.log(`actIndex ${actIndex.byTitle.size} titles  ${ms(tA).toFixed(0)}ms  rss=${rss()}\n`) }
    finally { await pool.end() }
  }

  console.log('── boot self-warm (what the service runs at startup) ──')
  row('warmup: "legislation" limit=1', await timedRankedSearch(table, 'legislation', { limit: 1, actIndex }))

  console.log('\n── repeated IDENTICAL query (is anything cached after first touch?) ──')
  for (let i = 1; i <= 4; i++) {
    row(`run ${i}: "traffic" limit=10`, await timedRankedSearch(table, 'traffic', { limit: 10, actIndex }))
  }

  console.log('\n── query-shape discriminators ──')
  row('zero-match rare term "quokka"', await timedRankedSearch(table, 'quokka', { limit: 10, actIndex }))
  row('k=100 (limit=1)', await timedRankedSearch(table, 'traffic', { limit: 1, actIndex }))
  row('k=500 (limit=100)', await timedRankedSearch(table, 'traffic', { limit: 100, actIndex }))
  row('tier-filtered legislation', await timedRankedSearch(table, 'traffic', { limit: 10, tier: 'legislation', actIndex }))
  row('tier-filtered parliamentary', await timedRankedSearch(table, 'traffic', { limit: 10, tier: 'parliamentary', actIndex }))
  row('citation-shaped', await timedRankedSearch(table, 'Data Protection Act 2018 section 45', { limit: 10, actIndex }))
  row('no actIndex (resolver off)', await timedRankedSearch(table, 'traffic', { limit: 10 }))

  console.log(`\nfinal rss=${rss()}`)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
