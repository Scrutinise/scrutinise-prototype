/**
 * build-corpus-chunks.ts — STEP 1 of the full-corpus vector layer (INERT until
 * triggered on the Hetzner build box). Streams every compiled corpus_sections row
 * from Neon → reads its body from R2 → chunks it with the VALIDATED pilot chunker
 * (chunk.ts) → batch-writes the chunk manifest to the `corpus_chunks` Lance table on
 * R2. STEP 2 (build-vector-index.ts) reads this table and embeds it.
 *
 * WHY a separate manifest table (not chunk-on-the-fly inside the embed step):
 *   - decouples the expensive part (17.6 M R2 body reads, bandwidth-bound → Hetzner)
 *     from the embed, so a re-embed (model/dims re-tune) never re-pays the R2 read;
 *   - mirrors the pilot (pilot-chunk.ts → pilot_chunks), so the full-corpus chunk set
 *     is produced by identical code to the one the model was chosen on;
 *   - the chunk bodies also feed later hybrid/rerank work without another corpus pass.
 *
 * Reuses build-fts-index.ts wholesale: same Neon cursor stream, same R2 body fetch,
 * same archetype-A citation backfill on legislation rows (so a chunk's text is
 * identical to what BM25 indexes — required for a fair hybrid later).
 *
 * ── RESUMABLE + IDEMPOTENT (same guarantees as build-fts-index.ts) ────────────
 * Cursor = the max section id committed so far (`_search/corpus_chunks.checkpoint.json`).
 * On resume we DELETE any chunks with sectionId > cursor (a crash can leave an
 * appended-but-un-checkpointed section's chunks), THEN append sections id > cursor.
 * So a death between the Lance write and the checkpoint save can never duplicate.
 *
 * Usage (Hetzner, or locally with Neon+R2 creds):
 *   npx tsx search/build-corpus-chunks.ts            # full / resume from checkpoint
 *   npx tsx search/build-corpus-chunks.ts --limit N  # first N sections only (canary)
 *   npx tsx search/build-corpus-chunks.ts --reset    # drop+recreate, fresh checkpoint, then build
 * Env: VECTOR_CHUNKS_BATCH (1000), FTS_R2_CONCURRENCY (32).
 */
import { Pool } from 'pg'
import { Schema, Field, Utf8 } from 'apache-arrow'
import { connectLance, lanceDbUri, lancedb } from './lance'
import { tierFor } from './corpus-map'
import { gidFromId, buildCitation, applyCitationToBody } from './citation'
import { chunkBody } from './chunk'
import { CHUNKS_TABLE, CHUNKS_CHECKPOINT_KEY, chunkId } from './vector-common'
import { r2Get, r2Put } from '../shared/r2-client'

const BATCH = parseInt(process.env.VECTOR_CHUNKS_BATCH ?? '1000', 10)
const R2_CONCURRENCY = parseInt(process.env.FTS_R2_CONCURRENCY ?? '32', 10)
const RESET = process.argv.includes('--reset')
const LIMIT_ARG = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : Infinity })()

const SCHEMA = new Schema([
  new Field('chunkId', new Utf8(), false),
  new Field('sectionId', new Utf8(), false),
  new Field('corpus', new Utf8(), false),
  new Field('tier', new Utf8(), false),
  new Field('sectionTitle', new Utf8(), true),
  new Field('body', new Utf8(), false),
])

type Checkpoint = { phase: 'chunking' | 'done'; lastId: string; sectionsWritten: number; chunksWritten: number; bodyMisses: number; updatedAt: string }
const FRESH: Checkpoint = { phase: 'chunking', lastId: '', sectionsWritten: 0, chunksWritten: 0, bodyMisses: 0, updatedAt: '' }

function neonPool(): Pool {
  const url = process.env.NEON_DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL not set (do NOT fall back to DATABASE_URL — it points at Railway)')
  return new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 4, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 20_000, statement_timeout: 120_000, query_timeout: 120_000, keepAlive: true })
}

async function loadCp(): Promise<Checkpoint> {
  if (RESET) return { ...FRESH }
  const raw = await r2Get(CHUNKS_CHECKPOINT_KEY)
  if (!raw) return { ...FRESH }
  try { return { ...FRESH, ...JSON.parse(raw) } } catch { return { ...FRESH } }
}
async function saveCp(cp: Checkpoint) { cp.updatedAt = new Date().toISOString(); await r2Put(CHUNKS_CHECKPOINT_KEY, JSON.stringify(cp, null, 2), 'application/json') }

async function mapPool<T, R>(items: T[], concurrency: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() { while (true) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i]) } }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return out
}

type DbRow = { id: string; corpus: string; sectionTitle: string | null; r2Key: string | null }

async function main() {
  console.log(`[corpus-chunks] dataset=${lanceDbUri()}/${CHUNKS_TABLE} batch=${BATCH} r2conc=${R2_CONCURRENCY}` + (Number.isFinite(LIMIT_ARG) ? ` limit=${LIMIT_ARG}` : '') + (RESET ? ' RESET' : ''))
  const cp = await loadCp()
  console.log(`[corpus-chunks] checkpoint: phase=${cp.phase} lastId=${cp.lastId || '(start)'} sections=${cp.sectionsWritten} chunks=${cp.chunksWritten} misses=${cp.bodyMisses}`)
  if (cp.phase === 'done') { console.log('[corpus-chunks] already done — nothing to do.'); return }

  const conn = await connectLance()
  if (RESET) { try { await conn.dropTable(CHUNKS_TABLE) } catch { /* absent */ } }
  const tbl = await conn.createEmptyTable(CHUNKS_TABLE, SCHEMA, { mode: 'create', existOk: true })
  if (RESET) await saveCp(cp)

  const pool = neonPool()
  await pool.query('SELECT 1')

  // archetype-A citation title map (gid → act title), same as build-fts-index.ts
  const titleMap = new Map<string, string>()
  {
    const { rows } = await pool.query<{ gid: string; title: string }>(`SELECT "legislationGovUkId" AS gid, title FROM "LegislationItem" WHERE "legislationGovUkId" IS NOT NULL AND title IS NOT NULL`)
    for (const r of rows) titleMap.set(r.gid, r.title)
    console.log(`[corpus-chunks] citation title map: ${titleMap.size} gid→title`)
  }

  // resume: clear any un-checkpointed tail before appending
  if (cp.lastId) {
    await tbl.delete(`sectionId > '${cp.lastId.replace(/'/g, "''")}'`)
    console.log(`[corpus-chunks] resume cleanup: cleared chunks sectionId > ${cp.lastId}`)
  }

  let processedThisRun = 0
  const t0 = Date.now()
  while (true) {
    const remaining = LIMIT_ARG - processedThisRun
    if (remaining <= 0) { console.log(`[corpus-chunks] --limit ${LIMIT_ARG} reached (phase still chunking).`); await pool.end(); return }
    const lim = Math.min(BATCH, remaining)

    const { rows } = await pool.query<DbRow>(
      `SELECT id, corpus, "sectionTitle", "r2Key" FROM corpus_sections
       WHERE status='compiled' AND id > $1 ORDER BY id ASC LIMIT $2`, [cp.lastId, lim])
    if (rows.length === 0) break

    const bodies = await mapPool(rows, R2_CONCURRENCY, async (r) => (r.r2Key ? r2Get(r.r2Key) : null))

    const records: any[] = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const rawBody = bodies[i]
      if (rawBody == null || !rawBody.trim()) { cp.bodyMisses++; continue }
      const tier = tierFor(r.corpus)
      let sectionTitle = r.sectionTitle
      let body = rawBody
      if (tier === 'legislation') {
        const gid = gidFromId(r.id)
        const cit = buildCitation(r.id, gid ? titleMap.get(gid) ?? null : null, r.sectionTitle)
        if (cit) { sectionTitle = cit.sectionTitle; body = applyCitationToBody(cit.bodyHeader, body) }
      }
      const chunks = chunkBody(body)
      chunks.forEach((c, k) => records.push({ chunkId: chunkId(r.id, k), sectionId: r.id, corpus: r.corpus, tier, sectionTitle, body: c }))
      cp.chunksWritten += chunks.length
    }
    if (records.length) await tbl.add(records)

    cp.lastId = rows[rows.length - 1].id
    cp.sectionsWritten += rows.length
    processedThisRun += rows.length
    await saveCp(cp)
    if (cp.sectionsWritten % (BATCH * 20) < BATCH) {
      const el = (Date.now() - t0) / 1000
      console.log(`[corpus-chunks] ${cp.sectionsWritten} sections | ${cp.chunksWritten} chunks | ${(processedThisRun / Math.max(el, 0.001)).toFixed(0)} sec/s | lastId=${cp.lastId} | misses=${cp.bodyMisses}`)
    }
  }
  await pool.end()

  const el = (Date.now() - t0) / 1000
  console.log(`[corpus-chunks] chunking complete: ${cp.sectionsWritten} sections → ${cp.chunksWritten} chunks (${(cp.chunksWritten / Math.max(cp.sectionsWritten, 1)).toFixed(2)}/section, ${cp.bodyMisses} body misses) in ${el.toFixed(0)}s. Compacting…`)
  try { const stats = await tbl.optimize(); console.log('[corpus-chunks] optimize:', JSON.stringify(stats?.compaction ?? stats)) } catch (e) { console.warn('[corpus-chunks] optimize warning:', (e as Error).message) }
  cp.phase = 'done'
  await saveCp(cp)
  console.log(`[corpus-chunks] DONE. Lance rows=${await tbl.countRows()}`)
}

main().catch((e) => { console.error('[corpus-chunks] FATAL', e); process.exit(1) })
