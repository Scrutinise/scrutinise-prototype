/**
 * fts-refresh.ts — REPLACE ROWS ALREADY IN `corpus_fts`. SEARCH S11 §4.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE GAP THIS CLOSES, AND WHY IT IS A STANDING DEFECT RATHER THAN ONE SPRINT'S TASK.
 *
 * `fts-catchup.ts` reconciles by APPENDING ids the index does not have. It is the right tool for a
 * gap and it has no concept of a row whose CONTENT changed — the id is already there, so there is
 * nothing to append and it reports success. Consequence, stated plainly:
 *
 *   ⚠ ANY BACKFILL THAT REWRITES A FIELD THE INDEX CARRIES IS INVISIBLE TO USERS UNTIL SOMEBODY
 *     NOTICES BY ACCIDENT.
 *
 * That is not hypothetical. Case-law titles were recovered into `corpus_sections` on 19 August
 * 2026 and the index carried **0 of 74,896** of them; the dates were wrong on 74,066. **No user
 * ever saw a recovered case name.** It was found the next day in a "before" measurement taken for
 * an unrelated purpose (`INGEST_CASELAW_TEXT_REPORT.md` §3, Decision 5). `refresh-fts-caselaw.ts`
 * fixed that one collection by hand. This is that script with the collection taken out of it.
 *
 * ── TWO MODES, BECAUSE THERE ARE TWO DIFFERENT JOBS ─────────────────────────────────────────────
 *
 *   --from=db     (default)  Rebuild the record from `corpus_sections` + the body in R2. This is
 *                            the CONTENT refresh: use it after a backfill that rewrote a body, a
 *                            title, a date, a word count.
 *
 *   --from=index             Carry the indexed body and title through UNTOUCHED and recompute only
 *                            the DERIVED columns (`tier`, `jurisdiction`, from corpus-map.ts).
 *                            This is the RE-TIER: use it after a `tierFor()` edit.
 *
 * ⚠ THE SECOND MODE IS NOT AN OPTIMISATION OF THE FIRST. It reads no R2 and therefore cannot pick
 * up an unrelated body change and ship it inside a re-tier — see `retierRecord`'s note. It is also
 * ~48,900 fewer object reads for a change to one string column, which is the lesser reason.
 *
 * ── WHAT IT WILL NOT DO ─────────────────────────────────────────────────────────────────────────
 *
 * ⚠ A DELETE THAT SUCCEEDS AND AN ADD THAT FAILS LOSES ROWS. Every record in a batch is built and
 * validated in memory BEFORE a single delete is issued, and a batch with any unreadable body is
 * SKIPPED whole rather than deleted. Inherited from `refresh-fts-caselaw.ts`, which had it right.
 *
 * ⚠ IT DOES NOT REBUILD THE INDEX. LanceDB brute-force-scans un-indexed fragments alongside the
 * inverted index, so refreshed rows are searchable the moment they land — and every query pays for
 * them until the `fts-index` heavy job runs on the rented box (docs/CLAUDE.md §17). The final
 * report prints the un-indexed count before and after for exactly that reason. NEVER run the
 * rebuild on the serving host.
 *
 * ⚠ `fts-serve` HOLDS ITS TABLE FROM BOOT. It calls `openTable()` once with no
 * `readConsistencyInterval`, so nothing written here reaches a user until it is redeployed. Said
 * at the end of every run, not just in a document.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────────────────────────
 *   npx tsx search/fts-refresh.ts --corpus=cps-guidance,ofgem --from=index --dry-run
 *   npx tsx search/fts-refresh.ts --corpus=tna-caselaw --from=db --resume
 *   npx tsx search/fts-refresh.ts --ids-file=changed.txt --from=db
 *   npx tsx search/fts-refresh.ts --retier-all --dry-run     ← every corpus whose indexed tier
 *                                                              disagrees with tierFor() today
 * Flags: --batch=N (500) --limit=N --concurrency=N (32) --resume --dry-run
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'
import { tierFor } from './corpus-map'
import { r2Get } from '../shared/r2-client'
import {
  buildFtsRecord, retierRecord, loadActTitles, SECTION_COLUMNS, FTS_COLUMNS,
  type SectionRow, type FtsRecord,
} from './fts-record'

const ARGS = process.argv.slice(2)
const DRY = ARGS.includes('--dry-run')
const RESUME = ARGS.includes('--resume')
const RETIER_ALL = ARGS.includes('--retier-all')
const arg = (k: string): string | undefined => ARGS.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=')
const num = (k: string, d: number) => {
  const raw = arg(k)
  if (raw === undefined) return d
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) throw new Error(`--${k} must be a number, got ${JSON.stringify(raw)}`)
  return n
}
const FROM = (arg('from') ?? (RETIER_ALL ? 'index' : 'db')) as 'db' | 'index'
if (FROM !== 'db' && FROM !== 'index') throw new Error(`--from must be 'db' or 'index', got ${FROM}`)
const BATCH = num('batch', 500)
const LIMIT = num('limit', Infinity)
const R2_CONCURRENCY = num('concurrency', 32)
const CHECKPOINT = path.join(__dirname, `.fts-refresh.${FROM}.checkpoint.json`)

const esc = (s: string) => s.replace(/'/g, "''")
const inList = (xs: string[]) => xs.map((x) => `'${esc(x)}'`).join(',')

async function mapPool<A, R>(items: A[], c: number, fn: (a: A) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length); let i = 0
  await Promise.all(Array.from({ length: Math.min(c, items.length) }, async () => {
    for (;;) { const k = i++; if (k >= items.length) return; out[k] = await fn(items[k]) }
  }))
  return out
}

;(async () => {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false },
    max: 4, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 20_000,
    statement_timeout: 900_000, keepAlive: true,
  })
  const db = await connectLance()
  const tbl = await db.openTable(FTS_TABLE)

  const unindexed = async (): Promise<number | string> => {
    try { return ((await tbl.indexStats('body_idx')) as { numUnindexedRows?: number })?.numUnindexedRows ?? '?' }
    catch (e) { return `unreadable (${(e as Error).message})` }
  }

  // ── WHAT TO REFRESH ────────────────────────────────────────────────────────────────────────
  let corpora: string[] = (arg('corpus') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  let explicitIds: string[] | null = null
  const idsFile = arg('ids-file')
  if (idsFile) {
    explicitIds = fs.readFileSync(idsFile, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  } else if (arg('ids')) {
    explicitIds = arg('ids')!.split(',').map((s) => s.trim()).filter(Boolean)
  }

  if (RETIER_ALL) {
    // ⚠ COMPUTED FROM THE INDEX, NOT FROM A LIST SOMEBODY MAINTAINS. The whole failure mode being
    // fixed is that the tier map and the built index disagree without saying so; a hand-kept list
    // of "collections to re-tier" would be the same class of artefact, one layer up. This scans
    // (corpus, tier) and selects every collection whose INDEXED tier differs from what `tierFor()`
    // returns today. If it selects nothing, the index already agrees with the map — which is a
    // result, and it is printed as one.
    console.log('[fts-refresh] --retier-all: scanning (corpus, tier) to find disagreements with tierFor()…')
    const seen = new Map<string, Set<string>>()
    for await (const batch of tbl.query().select(['corpus', 'tier']) as any) {
      const c = batch.getChild('corpus'), t = batch.getChild('tier')
      for (let i = 0; i < batch.numRows; i++) {
        const corpus = String(c.get(i) ?? ''), tier = String(t.get(i) ?? '')
        if (!seen.has(corpus)) seen.set(corpus, new Set())
        seen.get(corpus)!.add(tier)
      }
    }
    const drifted: Array<{ corpus: string; indexed: string[]; want: string }> = []
    for (const [corpus, tiers] of seen) {
      const want = tierFor(corpus)
      if (tiers.size > 1 || !tiers.has(want)) drifted.push({ corpus, indexed: [...tiers], want })
    }
    if (!drifted.length) {
      console.log('[fts-refresh] no collection disagrees with tierFor() — the index and the tier map already match. Nothing to do.')
      await pool.end(); process.exit(0)
    }
    console.log(`[fts-refresh] ${drifted.length} collection(s) to re-tier:`)
    for (const d of drifted) console.log(`    ${d.corpus.padEnd(26)} indexed=${d.indexed.join('+').padEnd(16)} → ${d.want}`)
    corpora = drifted.map((d) => d.corpus)
  }

  if (!corpora.length && !explicitIds) {
    console.error('Nothing selected. Pass --corpus=a,b / --ids-file=… / --ids=… / --retier-all.')
    await pool.end(); process.exit(2)
  }

  // The act-title index is needed only if a selected row can be in the legislation tier. Loaded
  // when it can be, and left null when it cannot — `buildFtsRecord` THROWS rather than silently
  // writing a legislation row with no citation, so a wrong call here fails loudly.
  const mayBeLegislation = FROM === 'db' &&
    (explicitIds ? true : corpora.some((c) => tierFor(c) === 'legislation'))
  const actTitles = mayBeLegislation ? await loadActTitles(pool) : null
  if (actTitles) console.log(`[fts-refresh] act-title index: ${actTitles.size.toLocaleString()} entries (needed for the citation rewrite)`)

  console.log(`[fts-refresh] ${DRY ? 'DRY RUN' : 'LIVE'}  from=${FROM}  table=${FTS_TABLE}  batch=${BATCH}`)
  console.log(`[fts-refresh] selection: ${explicitIds ? `${explicitIds.length.toLocaleString()} explicit ids` : corpora.join(', ')}\n`)

  const unindexedBefore = await unindexed()
  const t0 = Date.now()
  let read = 0, refreshed = 0, bodyMisses = 0, skippedBatches = 0
  const tierMoves = new Map<string, number>()

  /** Delete-then-add for one already-built batch. The ONLY place either is issued. */
  async function writeBatch(records: FtsRecord[]) {
    if (DRY || !records.length) return
    await tbl.delete(`id IN (${inList(records.map((r) => r.id))})`)
    await tbl.add(records)
  }

  // ── MODE: index → index (re-tier) ───────────────────────────────────────────────────────────
  //
  // ⚠ DELETED BY `corpus =`, ONCE PER COLLECTION — NOT BY BATCHES OF IDS, AND THE DIFFERENCE IS
  // TWO ORDERS OF MAGNITUDE. The first version reused `refresh-fts-caselaw`'s shape: read 500,
  // `delete WHERE id IN (…500 ids…)`, add 500. Measured live, it managed 3,697 rows in 15 minutes
  // — 43,893 rows would have taken about three hours. The cause is not the write: **`corpus_fts`
  // has no scalar index on `id`**, so every one of the 88 delete predicates was a full scan of
  // 18.2 M rows. Batching the ids made the scans MORE numerous, not cheaper.
  //
  // One `corpus = '…'` predicate per collection is 7 scans instead of 88, and `corpus` is the
  // column the table is already queried by everywhere else.
  //
  // ⚠ AND THE SAFETY ARGUMENT IS DIFFERENT FROM `refresh-fts-caselaw`'s, SO IT IS RESTATED RATHER
  // THAN INHERITED. That script batched deliberately, so that at most BATCH rows were absent at
  // any instant (its §1.5). Deleting a whole collection at once reopens that window — for the
  // length of one add. It is acceptable HERE and would not be there, for three reasons:
  //   1. Every record is read, mapped and held in memory BEFORE the delete is issued, so there is
  //      no path where the delete succeeds and the add has nothing to write.
  //   2. The largest collection in this set is 21,525 rows; case law was 74,896.
  //   3. A crash between the two is RECOVERABLE and by an existing tool: `fts-catchup` appends
  //      ids present in `corpus_sections` and absent from the index, which is exactly the
  //      resulting state. The reconciliation at the end of this run reports it either way.
  // ⚠ It is NOT safe merely because `fts-serve` holds a boot snapshot and would not notice. That
  // is true today and is an accident of the reader, not a property of the writer.
  if (FROM === 'index') {
    for (const corpus of corpora) {
      const rows = (await tbl.query()
        .where(`corpus = '${esc(corpus)}'`)
        .select(FTS_COLUMNS as string[])
        .toArray()) as unknown as FtsRecord[]
      console.log(`[fts-refresh] ${corpus}: ${rows.length.toLocaleString()} rows in the index`)
      if (!rows.length) continue
      const records = rows.map(retierRecord)
      for (const [j, rec] of records.entries()) {
        if (rec.tier !== rows[j].tier) {
          const move = `${rows[j].tier} → ${rec.tier}`
          tierMoves.set(move, (tierMoves.get(move) ?? 0) + 1)
        }
      }
      // Nothing to do is worth saying: a re-run after a partial pass should report the collections
      // it skipped rather than silently rewriting rows that are already right.
      const changed = records.filter((r, j) => r.tier !== rows[j].tier || r.jurisdiction !== rows[j].jurisdiction).length
      if (!changed) { console.log(`[fts-refresh] ${corpus}: already correct — skipped`); read += rows.length; continue }
      if (!DRY) {
        const t1 = Date.now()
        await tbl.delete(`corpus = '${esc(corpus)}'`)
        // Added in chunks: one `add` of 21,525 rows with full bodies is a single very large
        // Arrow buffer, and the delete has already happened, so failing here is the expensive
        // case. Smaller adds fail smaller.
        for (let i = 0; i < records.length; i += BATCH) await tbl.add(records.slice(i, i + BATCH))
        console.log(`[fts-refresh] ${corpus}: rewrote ${records.length.toLocaleString()} rows (${changed.toLocaleString()} changed) in ${((Date.now() - t1) / 1000).toFixed(0)}s`)
      }
      read += rows.length; refreshed += records.length
      if (read >= LIMIT) break
    }
  } else {
    // ── MODE: db + R2 → index (content refresh) ───────────────────────────────────────────────
    const targets: Array<{ corpus: string | null; ids: string[] | null }> =
      explicitIds ? [{ corpus: null, ids: explicitIds }] : corpora.map((c) => ({ corpus: c, ids: null }))

    for (const t of targets) {
      // Keyset pagination by id, so a run killed halfway can resume from a cursor rather than an
      // offset — the same reason `refresh-fts-caselaw` did it that way. Background runs get killed.
      let cursor = RESUME && fs.existsSync(CHECKPOINT)
        ? (JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')).lastId as string)
        : ''
      if (RESUME && cursor) console.log(`[fts-refresh] resuming after id ${cursor}`)
      let idOffset = 0

      for (;;) {
        if (read >= LIMIT) break
        const take = Math.min(BATCH, LIMIT - read)
        let rows: SectionRow[]
        if (t.ids) {
          const slice = t.ids.slice(idOffset, idOffset + take)
          idOffset += slice.length
          if (!slice.length) break
          rows = (await pool.query<SectionRow>(
            `SELECT ${SECTION_COLUMNS} FROM corpus_sections WHERE id = ANY($1::text[]) ORDER BY id`, [slice])).rows
        } else {
          rows = (await pool.query<SectionRow>(
            `SELECT ${SECTION_COLUMNS} FROM corpus_sections
              WHERE corpus = $1 AND status = 'compiled' AND id > $2
              ORDER BY id LIMIT $3`, [t.corpus, cursor, take])).rows
          if (!rows.length) break
          cursor = rows[rows.length - 1].id
        }
        if (!rows.length) break
        read += rows.length

        const bodies = await mapPool(rows, R2_CONCURRENCY, async (r) => (r.r2Key ? r2Get(r.r2Key) : null))
        const misses = bodies.filter((b) => b == null).length
        if (misses) {
          // A body we could not read must not become a delete: that would turn a stale row into a
          // missing one. The batch is skipped WHOLE and the index is left exactly as it was.
          bodyMisses += misses; skippedBatches++
          console.warn(`\n[fts-refresh] ${misses} of ${rows.length} bodies unreadable — BATCH SKIPPED, index untouched (ids ${rows[0].id} .. ${rows[rows.length - 1].id})`)
          continue
        }
        const records = rows.map((r, i) => buildFtsRecord(r, bodies[i] as string, actTitles))
        await writeBatch(records)
        refreshed += records.length
        if (!DRY) fs.writeFileSync(CHECKPOINT, JSON.stringify({ lastId: cursor, refreshed, updatedAt: new Date().toISOString() }))
        const rate = read / ((Date.now() - t0) / 1000)
        process.stdout.write(`\r[fts-refresh] ${read.toLocaleString()} read  ${refreshed.toLocaleString()} ${DRY ? 'would refresh' : 'refreshed'}  ${rate.toFixed(0)}/s   `)
      }
      console.log('')
    }
  }

  // ── RECONCILE ──────────────────────────────────────────────────────────────────────────────
  // Counted per collection, because "the total is unchanged" can hide one collection losing rows
  // while another gains them.
  console.log('')
  let lost = 0
  for (const corpus of corpora) {
    const after = (await tbl.query().where(`corpus = '${esc(corpus)}'`).select(['id']).toArray()).length
    const inDb = (await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int n FROM corpus_sections WHERE corpus=$1 AND status='compiled'`, [corpus])).rows[0].n
    const tiers = new Set((await tbl.query().where(`corpus = '${esc(corpus)}'`).select(['tier']).toArray() as Array<{ tier: string }>).map((r) => r.tier))
    const flag = after === inDb ? 'ok' : `⚠ index ${after.toLocaleString()} vs db ${inDb.toLocaleString()}`
    if (after < inDb) lost++
    console.log(`  ${corpus.padEnd(26)} indexed ${after.toLocaleString().padStart(9)}  tier=${[...tiers].join('+').padEnd(16)} ${flag}`)
  }
  if (tierMoves.size) {
    console.log('\n  tier moves:')
    for (const [move, n] of tierMoves) console.log(`    ${move.padEnd(28)} ${n.toLocaleString()}`)
  }
  console.log(`\n  read ${read.toLocaleString()} · ${DRY ? 'would refresh' : 'refreshed'} ${refreshed.toLocaleString()} · bodies unreadable ${bodyMisses.toLocaleString()} (${skippedBatches} batch(es) skipped)`)
  console.log(`  elapsed ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`)
  console.log(`  un-indexed rows in ${FTS_TABLE}: ${unindexedBefore} before → ${await unindexed()} after`)
  console.log('\n  ▶ TWO THINGS ARE STILL OUTSTANDING AFTER THIS RUN, AND NEITHER IS OPTIONAL:')
  console.log('      1. `fts-index` heavy job on the rented box — until then every query brute-force')
  console.log('         scans the rows written above (docs/CLAUDE.md §17). NEVER on the serving host.')
  console.log('      2. Redeploy `fts-serve` — it holds its table from boot, so no user sees any of')
  console.log('         this until it restarts.')

  await pool.end()
  process.exit(lost === 0 && bodyMisses === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
