/**
 * build-fts-pilot.ts — TRACK 2: does a positions FTS index built incrementally
 * (createIndex on chunk 1, then append-chunk + optimize() per chunk) keep peak
 * memory FLAT across merges, or does it CLIMB with total index size?
 *
 *   FLAT     → chunking fits the full 16.5M in the 24 GB container; report safe chunk size.
 *   CLIMBING → chunking only delays the OOM; report the slope so we can extrapolate
 *              where peak crosses 24 GB.
 *
 * Isolated in table `corpus_fts_pilot` (does NOT touch the real corpus_fts). Builds
 * ~FTS_PILOT_CHUNK rows/chunk up to FTS_PILOT_MAX, WITH positions, logging peak
 * container memory (cgroup memory.current, fallback RSS) measured DURING each
 * createIndex/optimize. Writes _search/corpus_fts_pilot.checkpoint.json for the watcher.
 *
 * Env: FTS_PILOT_CHUNK (400000), FTS_PILOT_MAX (3600000), FTS_R2_CONCURRENCY (256),
 *      R2_MAX_SOCKETS (set on the service).
 */
import { Pool } from 'pg'
import { Schema, Field, Utf8, Int32 } from 'apache-arrow'
import { connectLance, lanceDbUri, lancedb } from './lance'
import { tierFor, jurisdictionFor } from './corpus-map'
import { r2Get, r2Put } from '../shared/r2-client'
const fs = require('fs') as typeof import('fs')

const PILOT_TABLE = 'corpus_fts_pilot'
const CHECKPOINT_KEY = '_search/corpus_fts_pilot.checkpoint.json'
const CHUNK = parseInt(process.env.FTS_PILOT_CHUNK ?? '400000', 10)
const MAX = parseInt(process.env.FTS_PILOT_MAX ?? '3600000', 10)
const DB_BATCH = parseInt(process.env.FTS_BATCH ?? '5000', 10)
const R2_CONCURRENCY = parseInt(process.env.FTS_R2_CONCURRENCY ?? '256', 10)

const SCHEMA = new Schema([
  new Field('id', new Utf8(), false),
  new Field('corpus', new Utf8(), false),
  new Field('tier', new Utf8(), false),
  new Field('jurisdiction', new Utf8(), false),
  new Field('sectionTitle', new Utf8(), true),
  new Field('body', new Utf8(), false),
  new Field('itemDate', new Utf8(), true),
  new Field('speaker', new Utf8(), true),
  new Field('parentDocId', new Utf8(), true),
  new Field('availability_status', new Utf8(), true),
  new Field('wordCount', new Int32(), true),
])

type DbRow = { id: string; corpus: string; sectionTitle: string | null; itemDate: string | null
  speaker: string | null; parentDocId: string | null; availability_status: string | null
  wordCount: number | null; r2Key: string | null }

function neonPool(): Pool {
  const url = process.env.NEON_DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL not set')
  return new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 4,
    idleTimeoutMillis: 10_000, connectionTimeoutMillis: 20_000, statement_timeout: 120_000, query_timeout: 120_000, keepAlive: true })
}

async function mapPool<T, R>(items: T[], conc: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let next = 0
  async function w() { while (true) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i]) } }
  await Promise.all(Array.from({ length: Math.min(conc, items.length) }, w)); return out
}

// Peak container memory (MB) sampled during an async op. cgroup v2 memory.current is
// the true container figure (includes native Rust allocations); RSS is the fallback.
function memMb(): number {
  try { return parseInt(fs.readFileSync('/sys/fs/cgroup/memory.current', 'utf8').trim(), 10) / 1048576 } catch { /* not cgroup v2 */ }
  return process.memoryUsage().rss / 1048576
}
async function withPeakMem<T>(fn: () => Promise<T>): Promise<{ result: T; peakMb: number }> {
  let peak = memMb()
  const iv = setInterval(() => { const m = memMb(); if (m > peak) peak = m }, 500)
  try { return { result: await fn(), peakMb: peak } } finally { clearInterval(iv) }
}

async function main() {
  console.log(`[fts-pilot] table=${lanceDbUri()}/${PILOT_TABLE} chunk=${CHUNK} max=${MAX} r2conc=${R2_CONCURRENCY} memSource=${(() => { try { fs.readFileSync('/sys/fs/cgroup/memory.current'); return 'cgroup.current' } catch { return 'process.rss' } })()}`)
  let memMax = 'n/a'; try { memMax = (parseInt(fs.readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim(), 10) / 1048576).toFixed(0) + ' MB' } catch {}
  console.log(`[fts-pilot] container memory.max = ${memMax}`)

  const conn = await connectLance()
  try { await conn.dropTable(PILOT_TABLE) } catch {}
  const tbl = await conn.createEmptyTable(PILOT_TABLE, SCHEMA, { mode: 'create', existOk: true })
  const pool = neonPool(); await pool.query('SELECT 1')

  let cursor = '', total = 0, chunkIdx = 0
  const merges: Array<{ chunk: number; rows: number; peakMb: number; durS: number }> = []

  while (total < MAX) {
    // ── load one chunk (append) ──
    const target = Math.min(CHUNK, MAX - total)
    let loadedThisChunk = 0
    while (loadedThisChunk < target) {
      const lim = Math.min(DB_BATCH, target - loadedThisChunk)
      const { rows } = await pool.query<DbRow>(
        `SELECT id, corpus, "sectionTitle", "itemDate"::text AS "itemDate", speaker, "parentDocId",
                availability_status, "wordCount", "r2Key"
         FROM corpus_sections WHERE status='compiled' AND id > $1 ORDER BY id ASC LIMIT $2`, [cursor, lim])
      if (rows.length === 0) break
      const bodies = await mapPool(rows, R2_CONCURRENCY, r => r.r2Key ? r2Get(r.r2Key) : Promise.resolve(null))
      await tbl.add(rows.map((r, i) => ({
        id: r.id, corpus: r.corpus, tier: tierFor(r.corpus), jurisdiction: jurisdictionFor(r.corpus),
        sectionTitle: r.sectionTitle, body: bodies[i] ?? '', itemDate: r.itemDate, speaker: r.speaker,
        parentDocId: r.parentDocId, availability_status: r.availability_status, wordCount: r.wordCount })))
      cursor = rows[rows.length - 1].id; total += rows.length; loadedThisChunk += rows.length
    }
    if (loadedThisChunk === 0) break
    chunkIdx++

    // ── index (chunk 1) or incremental merge (optimize, chunks 2+) — measure peak mem ──
    const t0 = Date.now()
    const isFirst = chunkIdx === 1
    const { peakMb } = await withPeakMem(async () => {
      if (isFirst) {
        await tbl.createIndex('body', { config: lancedb.Index.fts({
          withPosition: true, baseTokenizer: 'simple', stem: true, language: 'English',
          removeStopWords: false, asciiFolding: true, maxTokenLength: 40, lowercase: true }) })
      } else {
        await tbl.optimize()
      }
    })
    const durS = (Date.now() - t0) / 1000
    merges.push({ chunk: chunkIdx, rows: total, peakMb, durS })
    console.log(`[fts-pilot] merge ${chunkIdx} (${isFirst ? 'createIndex' : 'optimize'}) | indexedRows=${total} | peakMem=${peakMb.toFixed(0)} MB | dur=${durS.toFixed(0)}s`)
    await r2Put(CHECKPOINT_KEY, JSON.stringify({ phase: total >= MAX ? 'done' : 'loading', rowsWritten: total,
      lastId: cursor, updatedAt: new Date().toISOString(), merges }, null, 2), 'application/json')
    if (loadedThisChunk < target) break  // ran out of source rows
  }
  await pool.end()

  // ── verdict: flat vs climbing (linear fit of peakMb vs indexedRows over merges 2+) ──
  console.log(`\n[fts-pilot] ===== per-merge peak memory =====`)
  merges.forEach(m => console.log(`  merge ${m.chunk}: ${m.rows} rows -> ${m.peakMb.toFixed(0)} MB (${m.durS.toFixed(0)}s)`))
  const pts = merges.filter(m => m.chunk >= 2)  // exclude the createIndex seed
  if (pts.length >= 2) {
    const n = pts.length, sx = pts.reduce((a, p) => a + p.rows, 0), sy = pts.reduce((a, p) => a + p.peakMb, 0)
    const sxy = pts.reduce((a, p) => a + p.rows * p.peakMb, 0), sxx = pts.reduce((a, p) => a + p.rows * p.rows, 0)
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)        // MB per row
    const intercept = (sy - slope * sx) / n
    const slopePerM = slope * 1_000_000
    const at16_5 = intercept + slope * 16_509_051
    const first = pts[0].peakMb, last = pts[pts.length - 1].peakMb
    console.log(`\n[fts-pilot] optimize-merge peak: ${first.toFixed(0)} MB -> ${last.toFixed(0)} MB across ${pts[0].rows}->${pts[pts.length-1].rows} rows`)
    console.log(`[fts-pilot] slope = ${slopePerM.toFixed(1)} MB per 1M indexed rows; extrapolated peak @16.5M = ${at16_5.toFixed(0)} MB (container 24576 MB)`)
    if (slopePerM < 200) console.log(`[fts-pilot] VERDICT: ~FLAT — incremental merge is delta-bounded; full 16.5M with positions should fit 24 GB.`)
    else console.log(`[fts-pilot] VERDICT: CLIMBING — peak grows with index size; crosses 24 GB around ${((24576 - intercept) / slope / 1_000_000).toFixed(1)}M rows. Chunking only delays the OOM.`)
  } else {
    console.log(`[fts-pilot] not enough optimize merges to fit a trend (got ${pts.length}).`)
  }
  console.log(`[fts-pilot] DONE.`)
}
main().catch(e => { console.error('[fts-pilot] FATAL', e); process.exit(1) })
