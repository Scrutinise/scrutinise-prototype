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
 *   1. APPEND + RESUME-DELETE (correctness) — batches are APPENDED (tbl.add),
 *      not upserted. mergeInsert was the throughput bottleneck (the S1b canary
 *      measured Railway ≈ home because the build was write-bound, not bandwidth-
 *      bound, and merge cost grows as the table grows). Idempotency instead comes
 *      from the cursor: on resume we first DELETE any rows with `id > lastId`
 *      (a crash can leave an appended-but-un-checkpointed batch), THEN append
 *      `WHERE id > lastId`. So a death after a Lance write but before the
 *      checkpoint save can never leave duplicates — the stray tail is dropped.
 *
 *   2. RESUMABLE CURSOR — progress is a single cursor: the max `id` committed so
 *      far, persisted to R2 at `_search/corpus_fts.checkpoint.json` after every
 *      batch. On restart we resume at `WHERE id > lastId` (PK btree, no re-read
 *      of the 16.3M already done). The checkpoint also carries a `phase`
 *      (loading → indexing → done) so a death during index-build resumes at the
 *      index step, not a full re-load.
 *
 * The cursor drives both: it is the optimisation (skip done work) AND, via the
 * resume-delete, the correctness guarantee (no dupes). `--reset` is kept a
 * DISCRETE step (never baked into the long-running start command) because
 * Railway's ON_FAILURE restart re-runs the start command — a `--reset` there
 * would wipe progress on every crash.
 *
 * Usage (Charlie triggers on Railway, or locally with R2+Neon creds):
 *   tsx search/build-fts-index.ts             # full / resume from checkpoint
 *   tsx search/build-fts-index.ts --limit N       # load first N only (no index)
 *   tsx search/build-fts-index.ts --canary        # isolated N-row load+index (FTS_TABLE_NAME)
 *   tsx search/build-fts-index.ts --reset-only    # drop+recreate empty table, write fresh checkpoint, exit
 *   tsx search/build-fts-index.ts --reset         # reset then full build (local only — not a Railway start cmd)
 * Env: FTS_BATCH (default 1000), FTS_R2_CONCURRENCY (default 32).
 */
import { Pool } from 'pg'
import { Schema, Field, Utf8, Int32 } from 'apache-arrow'
import { connectLance, FTS_TABLE, CHECKPOINT_KEY, lanceDbUri, lancedb } from './lance'
import { tierFor, jurisdictionFor } from './corpus-map'
import { gidFromId, buildCitation, applyCitationToBody } from './citation'
import { r2Get, r2Put } from '../shared/r2-client'

const BATCH = parseInt(process.env.FTS_BATCH ?? '1000', 10)
const R2_CONCURRENCY = parseInt(process.env.FTS_R2_CONCURRENCY ?? '32', 10)
// withPosition stores token positions for phrase queries — but it's the dominant
// memory cost of the index build (createIndex OOM'd the 24GB container at 16.5M docs
// WITH positions). FTS_WITH_POSITIONS=false builds the smaller no-position v1 index
// that fits in place (terms still match; loses exact-phrase ranking). Default true.
const WITH_POSITION = (process.env.FTS_WITH_POSITIONS ?? 'true') !== 'false'
// --canary: isolated end-to-end validation. Implies --reset, and (unlike a plain
// --limit) PROCEEDS to build the FTS index over the loaded subset so createIndex is
// exercised. Point it at a throwaway table via FTS_TABLE_NAME=corpus_fts_canary.
const CANARY = process.argv.includes('--canary')
// --reset-only: drop+recreate the empty table, write a fresh checkpoint, exit. The
// discrete reset step — run locally before a clean full build (NOT in the Railway
// start command, which ON_FAILURE re-runs on every crash → would wipe progress).
const RESET_ONLY = process.argv.includes('--reset-only')
const RESET = process.argv.includes('--reset') || CANARY || RESET_ONLY
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

  // A RESET (any form) just dropped + recreated the table — persist the FRESH
  // checkpoint immediately so R2 state is consistent (empty table ↔ lastId='').
  if (RESET) await saveCheckpoint(cp)
  if (RESET_ONLY) {
    console.log('[fts-index] --reset-only: table dropped + recreated empty; fresh checkpoint written. Exiting.')
    return
  }

  const pool = neonPool()
  await pool.query('SELECT 1') // wake cold Neon compute

  // Archetype-A retrieval fix (citation.ts): legislation section bodies lack the
  // parent act's title/citation ("Housing Act 1988") — it lives only in legacy
  // LegislationItem.title, keyed by the gid in each id. Load that map once and
  // prepend a citation header to legislation bodies at index time so the act
  // name + section ref are BM25-searchable. See docs/FTS_ARCHETYPE_A_DIAG.md.
  const titleMap = new Map<string, string>()
  {
    const { rows: items } = await pool.query<{ gid: string; title: string }>(
      `SELECT "legislationGovUkId" AS gid, title FROM "LegislationItem" WHERE "legislationGovUkId" IS NOT NULL AND title IS NOT NULL`)
    for (const it of items) titleMap.set(it.gid, it.title)
    console.log(`[fts-index] citation title map: ${titleMap.size} gid→title entries`)
  }

  // ── Phase 1: load + write (resumable cursor) ──────────────────────────────
  if (cp.phase === 'loading') {
    // Append path: clear any appended-but-un-checkpointed tail (id > lastId) from a
    // prior crash before appending, so re-runs never duplicate. No-op on a fresh
    // start (lastId='') or just-reset table.
    if (cp.lastId) {
      await tbl.delete(`id > '${cp.lastId.replace(/'/g, "''")}'`)
      console.log(`[fts-index] resume cleanup: cleared any rows id > ${cp.lastId}`)
    }
    let processedThisRun = 0
    const tLoad0 = Date.now()
    while (true) {
      const remaining = LIMIT_ARG - processedThisRun
      if (remaining <= 0) {
        if (CANARY) { console.log(`[fts-index] canary: ${LIMIT_ARG} rows loaded — proceeding to FTS index build`); break }
        console.log(`[fts-index] --limit ${LIMIT_ARG} reached; checkpoint saved (still phase=loading).`); await pool.end(); return
      }
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
        const rawBody = bodies[i]
        if (rawBody == null) cp.bodyMisses++
        const tier = tierFor(r.corpus)
        let sectionTitle = r.sectionTitle
        let body = rawBody ?? ''
        // Citation backfill for legislation rows (archetype-A retrieval fix).
        if (tier === 'legislation') {
          const gid = gidFromId(r.id)
          const cit = buildCitation(r.id, gid ? titleMap.get(gid) ?? null : null, r.sectionTitle)
          if (cit) {
            sectionTitle = cit.sectionTitle
            body = applyCitationToBody(cit.bodyHeader, body)
          }
        }
        return {
          id: r.id,
          corpus: r.corpus,
          tier,
          jurisdiction: jurisdictionFor(r.corpus),
          sectionTitle,
          body,
          itemDate: r.itemDate,
          speaker: r.speaker,
          parentDocId: r.parentDocId,
          availability_status: r.availability_status,
          wordCount: r.wordCount,
        }
      })

      // APPEND (fast). Idempotency is the cursor + resume-delete above, not upsert.
      await tbl.add(records)

      cp.lastId = rows[rows.length - 1].id
      cp.rowsWritten += rows.length
      processedThisRun += rows.length
      await saveCheckpoint(cp)
      if (cp.rowsWritten % (BATCH * 20) < BATCH) {
        const el = (Date.now() - tLoad0) / 1000
        console.log(`[fts-index] ${cp.rowsWritten} rows | ${(processedThisRun / Math.max(el, 0.001)).toFixed(0)} rows/s | lastId=${cp.lastId} | bodyMisses=${cp.bodyMisses}`)
      }
    }
    const loadSecs = (Date.now() - tLoad0) / 1000
    const rate = processedThisRun / Math.max(loadSecs, 0.001)
    console.log(`[fts-index] load complete: ${cp.rowsWritten} rows (${processedThisRun} this run in ${loadSecs.toFixed(1)}s = ${rate.toFixed(1)} rows/s; ${cp.bodyMisses} body misses). Compacting…`)
    cp.phase = 'indexing'
    await saveCheckpoint(cp)
  }

  await pool.end()

  // ── Phase 2: compact + build FTS index ────────────────────────────────────
  if (cp.phase === 'indexing') {
    // 2026-07-22 (positions rider, mirrors VECTOR_SKIP_COMPACT on the vector
    // build): optimize() has an independent v0.30 bug/memory cost on top of
    // createIndex's own OOM risk. FTS_SKIP_COMPACT=true skips fragment
    // compaction and runs createIndex() directly over the existing fragments —
    // a single-shot build already proven to work in the June positions pilot.
    // Default behaviour (compact) unchanged for normal runs.
    if (process.env.FTS_SKIP_COMPACT === 'true') {
      console.log('[fts-index] FTS_SKIP_COMPACT=true — skipping fragment compaction, indexing directly')
    } else {
      // mergeInsert produced many small fragments; compact before indexing.
      try {
        const stats = await tbl.optimize()
        console.log('[fts-index] optimize:', JSON.stringify(stats?.compaction ?? stats))
      } catch (e) { console.warn('[fts-index] optimize warning (continuing):', (e as Error).message) }
    }

    console.log(`[fts-index] building native FTS inverted index on \`body\` (withPosition=${WITH_POSITION})…`)
    const tIdx0 = Date.now()
    await tbl.createIndex('body', {
      config: lancedb.Index.fts({
        withPosition: WITH_POSITION,  // positions = phrase queries, but the memory driver
        baseTokenizer: 'simple',
        stem: true,
        language: 'English',
        removeStopWords: false,   // keep shall/may/must — legally meaningful
        asciiFolding: true,
        maxTokenLength: 40,
        lowercase: true,
      }),
    })
    console.log(`[fts-index] FTS index built in ${((Date.now() - tIdx0) / 1000).toFixed(1)}s`)
    cp.phase = 'done'
    await saveCheckpoint(cp)
  }

  const finalCount = await tbl.countRows()
  console.log(`[fts-index] DONE. Lance rows=${finalCount} (checkpoint rowsWritten=${cp.rowsWritten}, bodyMisses=${cp.bodyMisses})`)
}

main().catch((e) => { console.error('[fts-index] FATAL', e); process.exit(1) })
