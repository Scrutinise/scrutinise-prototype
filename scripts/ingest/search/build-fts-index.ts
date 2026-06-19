/**
 * build-fts-index.ts — Search S1b indexer (INERT until Charlie triggers it).
 *
 * Streams compiled corpus_sections rows from Neon → reads each body from R2 →
 * batch-writes to the Lance dataset on R2 → builds the native FTS (inverted)
 * index on `body`. Title-boost is a query-time concern (see fts-query-service).
 *
 * Reads NEON_DATABASE_URL explicitly (NOT DATABASE_URL, which still points at
 * Railway locally — FTS_BUILD_S1b §0.3) so it is cutover-independent.
 *
 * ── RESUMABLE + IDEMPOTENT (brief addition #3) ─────────────────────────────
 * Two independent guarantees, so a multi-hour Railway→R2 run survives an
 * interruption (the compute-cap pause class behind the 48h outage):
 *
 *   1. IDEMPOTENT WRITES — every batch is applied with mergeInsert keyed on the
 *      text PK `id` (whenMatchedUpdateAll + whenNotMatchedInsertAll). Re-running
 *      a batch that was already (partially) committed updates rows in place
 *      instead of appending — so re-runs NEVER duplicate Lance rows, even if the
 *      process died after a Lance write but before the checkpoint was saved.
 *
 *   2. RESUMABLE CURSOR — progress is a single cursor: the max `id` committed so
 *      far, persisted to R2 at `_search/corpus_fts.checkpoint.json` after every
 *      batch. On restart we resume at `WHERE id > lastId` (PK btree, no re-read
 *      of the 16.3M already done). The checkpoint also carries a `phase`
 *      (loading → indexing → done) so a death during index-build resumes at the
 *      index step, not a full re-load.
 *
 * The cursor is the optimisation (skip work); mergeInsert is the correctness
 * guarantee (no dupes). Either alone is insufficient; together a run that dies
 * at hour 5 resumes, and a run re-triggered from scratch is still safe.
 *
 * Usage (Charlie triggers on Railway, or locally with R2+Neon creds):
 *   tsx search/build-fts-index.ts            # full / resume from checkpoint
 *   tsx search/build-fts-index.ts --limit 5000   # smoke canary (first 5k ids)
 *   tsx search/build-fts-index.ts --reset    # discard checkpoint + overwrite table
 * Env: FTS_BATCH (default 1000), FTS_R2_CONCURRENCY (default 32).
 */
import { Pool } from 'pg'
import { Schema, Field, Utf8, Int32 } from 'apache-arrow'
import { connectLance, FTS_TABLE, CHECKPOINT_KEY, lanceDbUri, lancedb } from './lance'
import { tierFor, jurisdictionFor } from './corpus-map'
import { r2Get, r2Put } from '../shared/r2-client'

const BATCH = parseInt(process.env.FTS_BATCH ?? '1000', 10)
const R2_CONCURRENCY = parseInt(process.env.FTS_R2_CONCURRENCY ?? '32', 10)
const RESET = process.argv.includes('--reset')
const LIMIT_ARG = (() => {
  const i = process.argv.indexOf('--limit')
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : Infinity
})()

type Checkpoint = {
  phase: 'loading' | 'indexing' | 'done'
  lastId: string          // '' means start from the beginning
  rowsWritten: number
  bodyMisses: number
  updatedAt: string
}

const FRESH: Checkpoint = { phase: 'loading', lastId: '', rowsWritten: 0, bodyMisses: 0, updatedAt: '' }

// Explicit Arrow schema — never infer from data (a first batch of all-NULL
// titles would otherwise infer a Null-typed column and reject later strings).
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

function neonPool(): Pool {
  const url = process.env.NEON_DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL not set (do NOT fall back to DATABASE_URL — it points at Railway)')
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 20_000,
    statement_timeout: 120_000,
    query_timeout: 120_000,
    keepAlive: true,
  })
}

async function loadCheckpoint(): Promise<Checkpoint> {
  if (RESET) return { ...FRESH }
  const raw = await r2Get(CHECKPOINT_KEY)
  if (!raw) return { ...FRESH }
  try { return { ...FRESH, ...JSON.parse(raw) } } catch { return { ...FRESH } }
}

async function saveCheckpoint(cp: Checkpoint): Promise<void> {
  cp.updatedAt = new Date().toISOString()
  await r2Put(CHECKPOINT_KEY, JSON.stringify(cp, null, 2), 'application/json')
}

// Bounded-concurrency map (no external dep).
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

type DbRow = {
  id: string; corpus: string; sectionTitle: string | null; itemDate: string | null
  speaker: string | null; parentDocId: string | null; availability_status: string | null
  wordCount: number | null; r2Key: string | null
}

async function ensureTable(conn: lancedb.Connection): Promise<lancedb.Table> {
  if (RESET) {
    try { await conn.dropTable(FTS_TABLE) } catch { /* not present */ }
  }
  // mode:'create' + existOk preserves an existing table's data (data ignored).
  return conn.createEmptyTable(FTS_TABLE, SCHEMA, { mode: 'create', existOk: true })
}

async function main() {
  console.log(`[fts-index] dataset=${lanceDbUri()}/${FTS_TABLE} batch=${BATCH} r2conc=${R2_CONCURRENCY}` +
    (Number.isFinite(LIMIT_ARG) ? ` limit=${LIMIT_ARG}` : '') + (RESET ? ' RESET' : ''))

  const cp = await loadCheckpoint()
  console.log(`[fts-index] checkpoint: phase=${cp.phase} lastId=${cp.lastId || '(start)'} rows=${cp.rowsWritten} misses=${cp.bodyMisses}`)
  if (cp.phase === 'done') { console.log('[fts-index] already done — nothing to do.'); return }

  const conn = await connectLance()
  const tbl = await ensureTable(conn)
  const pool = neonPool()
  await pool.query('SELECT 1') // wake cold Neon compute

  // ── Phase 1: load + write (resumable cursor) ──────────────────────────────
  if (cp.phase === 'loading') {
    let processedThisRun = 0
    while (true) {
      const remaining = LIMIT_ARG - processedThisRun
      if (remaining <= 0) { console.log(`[fts-index] --limit ${LIMIT_ARG} reached; checkpoint saved (still phase=loading).`); await pool.end(); return }
      const lim = Math.min(BATCH, remaining)

      const { rows } = await pool.query<DbRow>(
        `SELECT id, corpus, "sectionTitle", "itemDate"::text AS "itemDate", speaker,
                "parentDocId", availability_status, "wordCount", "r2Key"
         FROM corpus_sections
         WHERE status='compiled' AND id > $1
         ORDER BY id ASC
         LIMIT $2`,
        [cp.lastId, lim]
      )
      if (rows.length === 0) break

      // Fetch bodies from R2 with bounded concurrency.
      const bodies = await mapPool(rows, R2_CONCURRENCY, async (r) => {
        if (!r.r2Key) return null
        return r2Get(r.r2Key)
      })

      const records = rows.map((r, i) => {
        const body = bodies[i]
        if (body == null) cp.bodyMisses++
        return {
          id: r.id,
          corpus: r.corpus,
          tier: tierFor(r.corpus),
          jurisdiction: jurisdictionFor(r.corpus),
          sectionTitle: r.sectionTitle,
          body: body ?? '',
          itemDate: r.itemDate,
          speaker: r.speaker,
          parentDocId: r.parentDocId,
          availability_status: r.availability_status,
          wordCount: r.wordCount,
        }
      })

      // IDEMPOTENT: upsert on id — re-applying a committed batch is a no-op-ish update.
      await tbl.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute(records)

      cp.lastId = rows[rows.length - 1].id
      cp.rowsWritten += rows.length
      processedThisRun += rows.length
      await saveCheckpoint(cp)
      if (cp.rowsWritten % (BATCH * 20) < BATCH) {
        console.log(`[fts-index] ${cp.rowsWritten} rows | lastId=${cp.lastId} | bodyMisses=${cp.bodyMisses}`)
      }
    }
    console.log(`[fts-index] load complete: ${cp.rowsWritten} rows (${cp.bodyMisses} body misses). Compacting…`)
    cp.phase = 'indexing'
    await saveCheckpoint(cp)
  }

  await pool.end()

  // ── Phase 2: compact + build FTS index ────────────────────────────────────
  if (cp.phase === 'indexing') {
    // mergeInsert produced many small fragments; compact before indexing.
    try {
      const stats = await tbl.optimize()
      console.log('[fts-index] optimize:', JSON.stringify(stats?.compaction ?? stats))
    } catch (e) { console.warn('[fts-index] optimize warning (continuing):', (e as Error).message) }

    console.log('[fts-index] building native FTS inverted index on `body`…')
    await tbl.createIndex('body', {
      config: lancedb.Index.fts({
        withPosition: true,       // phrase queries e.g. "income tax relief"
        baseTokenizer: 'simple',
        stem: true,
        language: 'English',
        removeStopWords: false,   // keep shall/may/must — legally meaningful
        asciiFolding: true,
        maxTokenLength: 40,
        lowercase: true,
      }),
    })
    cp.phase = 'done'
    await saveCheckpoint(cp)
  }

  const finalCount = await tbl.countRows()
  console.log(`[fts-index] DONE. Lance rows=${finalCount} (checkpoint rowsWritten=${cp.rowsWritten}, bodyMisses=${cp.bodyMisses})`)
}

main().catch((e) => { console.error('[fts-index] FATAL', e); process.exit(1) })
