/**
 * fts-catchup.ts — Search S1b: append-safe catch-up pass for `corpus_fts`.
 *
 * WHY THIS EXISTS: build-fts-index.ts's resumable cursor is a plain lexicographic
 * comparison on `id` (`WHERE id > lastId ORDER BY id`), which only ever moves
 * forward. Any row inserted into corpus_sections whose id sorts BEFORE the
 * cursor's current/final position — whether inserted mid-run (a concurrent ingest
 * worker) or long after the build reached phase:"done" — is silently invisible to
 * corpus_fts forever, with no error. Confirmed 2026-07-29: corpus_fts's last
 * completed build was 2026-06-20; `scottish-parliament-or` (seeded 2026-06-25,
 * 1.04M rows) has been entirely absent from keyword search ever since, plus
 * partial gaps in 20 other corpora (1,172,169 rows total — see
 * docs/handoff_summary.md for the full per-corpus breakdown).
 *
 * DESIGN: rather than rework the main build's id-cursor (higher-risk change to a
 * script that already correctly completed a 16.5M-row build), this does a full
 * per-corpus RECONCILIATION every run: count corpus_sections (status='compiled')
 * vs corpus_fts per corpus, and for any corpus with a gap, diff the exact id sets
 * and APPEND the missing rows. This is self-healing against ANY future cause of
 * drift (not just id-sort position), not just a one-off rebuild — run it on a
 * schedule (e.g. daily via ops.ts) to stop the gap from silently regrowing.
 *
 * Correctness does NOT require a createIndex() rebuild after appending: LanceDB's
 * default query behaviour (fastSearch() NOT called — confirmed rankedSearch()/
 * fts-core.ts never calls it) scans un-indexed fragments alongside the FTS index,
 * so newly-appended rows are searchable immediately. createIndex() is only a
 * PERFORMANCE step (avoids an ever-growing un-indexed brute-force tail) — run it
 * with --reindex after a large backfill, not required on routine catch-up runs.
 *
 * Usage:
 *   tsx search/fts-catchup.ts                 # reconcile + backfill all corpora
 *   tsx search/fts-catchup.ts --dry-run        # report gaps only, no writes
 *   tsx search/fts-catchup.ts --corpus=X       # limit to one corpus (debugging)
 *   tsx search/fts-catchup.ts --corpora=a,b,c  # limit to a known list of corpora — skips
 *                                                 the full-scan's per-corpus id fetch for
 *                                                 corpora already known to be gap-free
 *   tsx search/fts-catchup.ts --max-rows=N     # write at most N rows this run, then
 *                                                 exit cleanly (never mid-batch) — for
 *                                                 chunking a big backfill across
 *                                                 multiple bounded-runtime invocations.
 *                                                 Safe to just re-run: next invocation's
 *                                                 diff naturally skips already-written rows.
 *   tsx search/fts-catchup.ts --reindex        # after backfill, compact + rebuild
 *                                                 the FTS index (slow — 16.5M+ rows)
 * Env: NEON_DATABASE_URL, R2 creds (same as build-fts-index.ts). FTS_BATCH (default
 * 1000), FTS_R2_CONCURRENCY (default 32) — reused from build-fts-index.ts's env vars.
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance, FTS_TABLE, lancedb } from './lance'
import { tierFor, jurisdictionFor } from './corpus-map'
import { gidFromId, buildCitation, applyCitationToBody } from './citation'
import { r2Get } from '../shared/r2-client'

// Local cache of a corpus's pending "missing" id list, so a big backfill chunked
// across many --max-rows invocations (see below) doesn't re-pay the cost of
// re-fetching corpus_fts's (growing) id set for that corpus on every single call —
// that fetch alone can exceed a single invocation's runtime once it's grown large.
// Deleted automatically once a corpus's list empties. Not meant to be committed —
// purely a transient resume aid for a specific manual backfill run.
const CACHE_DIR = path.join(__dirname, '.fts-catchup-cache')
function cachePath(corpus: string): string { return path.join(CACHE_DIR, `${corpus.replace(/[^a-z0-9-]/gi, '_')}.json`) }
function loadCache(corpus: string): string[] | null {
  try { return JSON.parse(fs.readFileSync(cachePath(corpus), 'utf8')) } catch { return null }
}
function saveCache(corpus: string, ids: string[]): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(cachePath(corpus), JSON.stringify(ids))
}
function clearCache(corpus: string): void {
  try { fs.unlinkSync(cachePath(corpus)) } catch { /* not present */ }
}

const BATCH = parseInt(process.env.FTS_BATCH ?? '1000', 10)
const R2_CONCURRENCY = parseInt(process.env.FTS_R2_CONCURRENCY ?? '32', 10)
const DRY = process.argv.includes('--dry-run')
const REINDEX = process.argv.includes('--reindex')
const CORPUS_ARG = (() => {
  const a = process.argv.find((x) => x.startsWith('--corpus='))
  return a ? a.split('=')[1] : null
})()
// --corpora=a,b,c restricts iteration to a known list (skips the full 70-corpus scan's
// per-corpus id-set fetch for already-synced corpora — useful once a prior run/audit has
// already told you which corpora actually have gaps).
const CORPORA_ARG = (() => {
  const a = process.argv.find((x) => x.startsWith('--corpora='))
  return a ? a.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean) : null
})()
const MAX_ROWS = (() => {
  const a = process.argv.find((x) => x.startsWith('--max-rows='))
  return a ? parseInt(a.split('=')[1], 10) : Infinity
})()

type DbRow = {
  id: string; corpus: string; sectionTitle: string | null; itemDate: string | null
  speaker: string | null; parentDocId: string | null; availability_status: string | null
  wordCount: number | null; r2Key: string | null
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (true) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return out
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function esc(s: string): string { return s.replace(/'/g, "''") }

async function main() {
  console.log(`[fts-catchup] dry=${DRY} reindex=${REINDEX}${CORPUS_ARG ? ` corpus=${CORPUS_ARG}` : ''}`)

  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false },
    max: 4, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 20_000,
    statement_timeout: 300_000, query_timeout: 300_000, keepAlive: true,
  })
  await pool.query('SELECT 1')

  const titleMap = new Map<string, string>()
  {
    const { rows: items } = await pool.query<{ gid: string; title: string }>(
      `SELECT "legislationGovUkId" AS gid, title FROM "LegislationItem" WHERE "legislationGovUkId" IS NOT NULL AND title IS NOT NULL`)
    for (const it of items) titleMap.set(it.gid, it.title)
  }

  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)

  const corpusList = CORPUS_ARG
    ? [{ corpus: CORPUS_ARG }]
    : CORPORA_ARG
    ? CORPORA_ARG.map((corpus) => ({ corpus }))
    : (await pool.query<{ corpus: string }>(
        `SELECT DISTINCT corpus FROM corpus_sections WHERE status='compiled' ORDER BY corpus`)).rows

  let totalMissing = 0
  let totalWritten = 0
  let totalBodyMisses = 0
  const report: { corpus: string; missing: number; written: number }[] = []

  for (const { corpus } of corpusList) {
    let missing: string[] | null = DRY ? null : loadCache(corpus)
    let sectionsCount = -1
    let ftsCount = -1

    if (missing === null) {
      const sectionsRes = await pool.query<{ id: string }>(
        `SELECT id FROM corpus_sections WHERE status='compiled' AND corpus = $1`, [corpus])
      const sectionIds = new Set(sectionsRes.rows.map((r) => r.id))
      sectionsCount = sectionIds.size
      if (sectionIds.size === 0) continue

      const ftsRows = await tbl.query().where(`corpus = '${esc(corpus)}'`).select(['id']).toArray() as { id: string }[]
      const ftsIds = new Set(ftsRows.map((r) => r.id))
      ftsCount = ftsIds.size

      missing = [...sectionIds].filter((id) => !ftsIds.has(id))
      if (missing.length === 0) continue
      if (!DRY) saveCache(corpus, missing)
    }

    totalMissing += missing.length
    console.log(`[fts-catchup] ${corpus}: sections=${sectionsCount >= 0 ? sectionsCount : '(cached)'} fts=${ftsCount >= 0 ? ftsCount : '(cached)'} missing=${missing.length}`)
    report.push({ corpus, missing: missing.length, written: 0 })

    if (DRY) continue

    let writtenForCorpus = 0
    for (const idBatch of chunk(missing, BATCH)) {
      const { rows } = await pool.query<DbRow>(
        `SELECT id, corpus, "sectionTitle", "itemDate"::text AS "itemDate", speaker,
                "parentDocId", availability_status, "wordCount", "r2Key"
         FROM corpus_sections WHERE id = ANY($1::text[])`,
        [idBatch])

      const bodies = await mapPool(rows, R2_CONCURRENCY, async (r) => (r.r2Key ? r2Get(r.r2Key) : null))

      const records = rows.map((r, i) => {
        const rawBody = bodies[i]
        if (rawBody == null) totalBodyMisses++
        const tier = tierFor(r.corpus)
        let sectionTitle = r.sectionTitle
        let body = rawBody ?? ''
        if (tier === 'legislation') {
          const gid = gidFromId(r.id)
          const cit = buildCitation(r.id, gid ? titleMap.get(gid) ?? null : null, r.sectionTitle)
          if (cit) { sectionTitle = cit.sectionTitle; body = applyCitationToBody(cit.bodyHeader, body) }
        }
        return {
          id: r.id, corpus: r.corpus, tier, jurisdiction: jurisdictionFor(r.corpus),
          sectionTitle, body, itemDate: r.itemDate, speaker: r.speaker,
          parentDocId: r.parentDocId, availability_status: r.availability_status, wordCount: r.wordCount,
        }
      })

      await tbl.add(records)
      writtenForCorpus += records.length
      totalWritten += records.length

      if (totalWritten >= MAX_ROWS) break
    }
    report[report.length - 1].written = writtenForCorpus
    console.log(`[fts-catchup] ${corpus}: wrote ${writtenForCorpus} rows${writtenForCorpus < missing.length ? ` (of ${missing.length} — --max-rows cap hit, rest resumes next run)` : ''}`)

    if (writtenForCorpus >= missing.length) {
      clearCache(corpus)
    } else {
      saveCache(corpus, missing.slice(writtenForCorpus))
    }

    if (totalWritten >= MAX_ROWS) {
      console.log(`[fts-catchup] --max-rows=${MAX_ROWS} reached — stopping cleanly (safe to re-run to continue).`)
      break
    }
  }

  await pool.end()

  console.log('')
  console.log(`[fts-catchup] SUMMARY: ${report.length} corpora with gaps, ${totalMissing} rows missing, ${totalWritten} written, ${totalBodyMisses} body misses`)
  for (const r of report) console.log(`  ${r.corpus}: missing=${r.missing} written=${r.written}`)

  if (DRY) { console.log('[fts-catchup] --dry-run: no writes made.'); return }

  if (REINDEX && totalWritten > 0) {
    console.log('[fts-catchup] --reindex: compacting + rebuilding FTS index (this scans the WHOLE table, slow)…')
    try {
      const stats = await tbl.optimize()
      console.log('[fts-catchup] optimize:', JSON.stringify((stats as any)?.compaction ?? stats))
    } catch (e) { console.warn('[fts-catchup] optimize warning (continuing):', (e as Error).message) }
    const t0 = Date.now()
    await tbl.createIndex('body', {
      config: lancedb.Index.fts({
        withPosition: true, baseTokenizer: 'simple', stem: true, language: 'English',
        removeStopWords: false, asciiFolding: true, maxTokenLength: 40, lowercase: true,
      }),
    })
    console.log(`[fts-catchup] FTS index rebuilt in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  }

  const finalCount = await tbl.countRows()
  console.log(`[fts-catchup] DONE. corpus_fts rows now = ${finalCount}`)
}
main().catch((e) => { console.error('[fts-catchup] FATAL', e); process.exit(1) })
