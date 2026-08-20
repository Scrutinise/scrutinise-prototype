/**
 * refresh-fts-caselaw.ts — BRIEF_INGEST_CASELAW_TEXT §2.3, the index half.
 *
 * `fts-catchup.ts` reconciles by APPENDING ids that `corpus_fts` does not have. That is the right
 * tool for a gap and the wrong tool here: all 74,896 `tna-caselaw` ids are already in the index,
 * carrying the OLD body. Nothing in the existing toolchain replaces a body that changed, so this
 * does — id by id, delete then re-add, using exactly the record shape `fts-catchup` writes so the
 * two cannot drift.
 *
 * ── §1.5: WHAT BREAKS WHILE IT RUNS ──────────────────────────────────────────────────────────
 * Deleting `corpus='tna-caselaw'` in one statement and re-adding afterwards would take case-law
 * keyword search dark for the length of the rebuild. It is done in batches instead: each batch
 * reads its bodies FIRST, then deletes and re-adds only those ids, so at most BATCH rows of ~18 M
 * are absent from the index at any instant, for well under a second, and no other tier is touched
 * at all. There is no moment at which case law as a whole is missing.
 *
 * ⚠ A DELETE THAT SUCCEEDS AND AN ADD THAT FAILS LOSES ROWS. So the add is attempted first in the
 * sense that matters: the records are fully built in memory — R2 read, mapped, validated — before
 * a single delete is issued, and a batch whose bodies could not be read is SKIPPED entirely rather
 * than deleted. The final count is reconciled against `corpus_sections` and reported.
 *
 * ⚠ `createIndex` is NOT run here. LanceDB scans un-indexed fragments alongside the FTS index
 * (fts-catchup's header documents this), so the refreshed rows are searchable immediately; the
 * index rebuild is a PERFORMANCE step and belongs on the rented large-memory box with the next
 * `fts-index` heavy job, never on the serving host.
 *
 *   --dry-run     read and report, write nothing
 *   --limit=N     stop after N ids this invocation (the run is chunked to fit a tool timeout)
 *   --resume      continue from the checkpoint rather than from the start of the collection
 *   --batch=N     rows per delete+add cycle (default 500)
 */
import fs from 'fs'
import { Pool } from 'pg'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from '../search/lance'
import { tierFor, jurisdictionFor } from '../search/corpus-map'
import { r2Get } from '../shared/r2-client'

const CORPUS = 'tna-caselaw'
const DRY = process.argv.includes('--dry-run')
const RESUME = process.argv.includes('--resume')
/** Same shape as the re-compile's checkpoint, and for the same reason: background runs get killed. */
const CHECKPOINT = path.join(__dirname, '.refresh-fts-caselaw.checkpoint.json')
const num = (k: string, d: number) => {
  const raw = process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1]
  if (raw === undefined) return d
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) throw new Error(`--${k} must be a number, got ${JSON.stringify(raw)}`)
  return n
}
const LIMIT = num('limit', Infinity)
const BATCH = num('batch', 500)
const R2_CONCURRENCY = num('concurrency', 32)

type DbRow = {
  id: string; corpus: string; sectionTitle: string | null; itemDate: string | null
  speaker: string | null; parentDocId: string | null; availability_status: string | null
  wordCount: number | null; r2Key: string | null
}

async function mapPool<A, R>(items: A[], c: number, fn: (a: A) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length); let i = 0
  await Promise.all(Array.from({ length: Math.min(c, items.length) }, async () => {
    for (;;) { const k = i++; if (k >= items.length) return; out[k] = await fn(items[k]) }
  }))
  return out
}

const esc = (s: string) => s.replace(/'/g, "''")

;(async () => {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false },
    max: 4, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 20_000,
    statement_timeout: 900_000, keepAlive: true,
  })
  const db = await connectLance()
  const tbl = await db.openTable(FTS_TABLE)

  /**
   * ⚠ THE UN-INDEXED TAIL IS THE COST OF DOING THIS WITHOUT A REBUILD, AND IT IS REPORTED RATHER
   * THAN LEFT TO BE DISCOVERED. LanceDB brute-force-scans un-indexed fragments alongside the FTS
   * index on every query. On 2 Aug 2026, 1,191,345 un-indexed rows of 17.7 M took warm p50 from
   * 4.5 s to 25-32 s. 74,896 rows is a sixteenth of that, but the number belongs in the report
   * with the `fts-index` heavy job named as the follow-up — on the rented box, never here.
   */
  const unindexed = async (): Promise<number | string> => {
    try { return ((await tbl.indexStats('body_idx')) as { numUnindexedRows?: number })?.numUnindexedRows ?? '?' }
    catch (e) { return `unreadable (${(e as Error).message})` }
  }
  const unindexedBefore = await unindexed()
  const before = (await tbl.query().where(`corpus = '${esc(CORPUS)}'`).select(['id']).toArray()).length
  const inDb = (await pool.query(`SELECT COUNT(*)::int n FROM corpus_sections WHERE corpus=$1 AND status='compiled'`, [CORPUS])).rows[0].n
  console.log(`[refresh-fts] ${DRY ? 'DRY RUN' : 'LIVE'}  ${FTS_TABLE}: ${before.toLocaleString()} ${CORPUS} rows indexed, ${inDb.toLocaleString()} compiled in the database\n`)

  const LOW = `${CORPUS}:`, HIGH = `${CORPUS};`
  let cursor = RESUME && fs.existsSync(CHECKPOINT)
    ? (JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')).lastId as string)
    : LOW
  if (RESUME) console.log(`[refresh-fts] resuming after id ${cursor}`)
  let read = 0, refreshed = 0, bodyMisses = 0, skippedBatches = 0
  const t0 = Date.now()

  for (;;) {
    if (read >= LIMIT) break
    const take = Math.min(BATCH, LIMIT - read)
    const { rows } = await pool.query<DbRow>(
      `SELECT id, corpus, "sectionTitle", "itemDate"::text AS "itemDate", speaker,
              "parentDocId", availability_status, "wordCount", "r2Key"
         FROM corpus_sections
        WHERE corpus=$1 AND status='compiled' AND id > $2 AND id < $4
        ORDER BY id LIMIT $3`, [CORPUS, cursor, take, HIGH])
    if (!rows.length) break
    cursor = rows[rows.length - 1].id
    read += rows.length

    // Build EVERY record before touching the index. A body we could not read must not become a
    // delete: that would turn a stale row into a missing one.
    const bodies = await mapPool(rows, R2_CONCURRENCY, async r => (r.r2Key ? r2Get(r.r2Key) : null))
    const misses = bodies.filter(b => b == null).length
    if (misses) {
      bodyMisses += misses
      skippedBatches++
      console.warn(`\n[refresh-fts] ${misses} of ${rows.length} bodies unreadable — BATCH SKIPPED, index left as it was (ids ${rows[0].id} .. ${cursor})`)
      continue
    }
    const records = rows.map((r, i) => ({
      id: r.id, corpus: r.corpus, tier: tierFor(r.corpus), jurisdiction: jurisdictionFor(r.corpus),
      sectionTitle: r.sectionTitle, body: bodies[i] as string, itemDate: r.itemDate, speaker: r.speaker,
      parentDocId: r.parentDocId, availability_status: r.availability_status, wordCount: r.wordCount,
    }))

    if (!DRY) {
      const idList = records.map(r => `'${esc(r.id)}'`).join(',')
      await tbl.delete(`id IN (${idList})`)
      await tbl.add(records)
    }
    refreshed += records.length
    if (!DRY) fs.writeFileSync(CHECKPOINT, JSON.stringify({ lastId: cursor, refreshed, updatedAt: new Date().toISOString() }))
    const rate = read / ((Date.now() - t0) / 1000)
    process.stdout.write(`\r[refresh-fts] ${read.toLocaleString()} read  ${refreshed.toLocaleString()} ${DRY ? 'would refresh' : 'refreshed'}  ${rate.toFixed(0)}/s   `)
  }

  console.log('\n')
  const after = (await tbl.query().where(`corpus = '${esc(CORPUS)}'`).select(['id']).toArray()).length
  console.log(`  read from the database     ${read.toLocaleString()}`)
  console.log(`  ${DRY ? 'would refresh' : 'refreshed'}                  ${refreshed.toLocaleString()}`)
  console.log(`  bodies unreadable          ${bodyMisses.toLocaleString()} (in ${skippedBatches} skipped batch(es))`)
  console.log(`  ${CORPUS} rows in ${FTS_TABLE}: ${before.toLocaleString()} before -> ${after.toLocaleString()} after` +
    `  ${after === before ? 'UNCHANGED — no row lost or duplicated' : 'CHANGED — investigate before trusting this run'}`)
  console.log(`  elapsed ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`)
  console.log(`  un-indexed rows in ${FTS_TABLE}: ${unindexedBefore} before -> ${await unindexed()} after` +
    `\n    (these are searchable immediately but brute-force scanned. The fix is the \`fts-index\` heavy job` +
    `\n     on the rented large-memory box — docs/HEAVY_JOBS.md — not a rebuild on the serving host.)`)

  await pool.end()
  process.exit(after === before && bodyMisses === 0 ? 0 : 1)
})().catch(e => { console.error(e); process.exit(1) })
