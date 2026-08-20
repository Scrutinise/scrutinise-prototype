/**
 * recompile-caselaw.ts — BRIEF_INGEST_CASELAW_TEXT §2.3. THE BACKLOG.
 *
 * Re-compiles every stored `tna-caselaw` body from the Akoma Ntoso XML we already hold in R2,
 * through `shared/akn-text.ts` — the same module the live writer now uses, so the backlog and new
 * rows cannot diverge. Nothing is fetched from the National Archives: §1.2 established that all
 * 74,896 rows carry an `r2RawKey` and that 60 of 60 sampled objects are present, are Akoma Ntoso,
 * and carry a `<judgmentBody>`.
 *
 * ── THE RECONCILIATION IS THE POINT, AND IT IS BUILT FIRST ───────────────────────────────────
 * A previous sprint shipped a stats layer that compiled clean, ran, and reported SUCCESS on three
 * write paths that were silently writing nothing. The lesson recorded from it was: build the
 * attempted-vs-stored reconciliation before the write, not after. So every document lands in
 * exactly one bucket, the buckets must sum to the number attempted, and the run REFUSES to report
 * success if they do not. After the write, a sample is read BACK out of R2 and re-checked, because
 * a PUT that returns 200 is not evidence that the object holds what we think.
 *
 * ⚠ WHAT THIS OVERWRITES AND WHAT IT CANNOT DESTROY. It replaces the compiled body at `r2Key`.
 * The raw AKN at `r2RawKey` is never touched, so any run is repeatable and reversible from source.
 * A document the guard refuses is LEFT AS IT WAS — a bad body stays visible to the next run rather
 * than being replaced by an empty one.
 *
 * Usage:
 *   --dry-run              read, extract, check, report — no PUT and no UPDATE
 *   --limit=N              first N rows by id (the pilot; predict, then measure)
 *   --concurrency=N        R2 + extract fan-out (default 24)
 *   --resume               continue from the checkpoint file rather than from the start
 *   --verify=N             after the run, re-read N written bodies out of R2 and re-check them
 *   --only-missing         only rows whose `notes` carry no text-route — i.e. rows a previous run
 *                          did not write. Used to re-run the 26 the guard refused before the
 *                          source-aware rules existed, without re-reading 74,870 finished ones.
 */
import fs from 'fs'
import path from 'path'
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get, r2Put } from '../shared/r2-client'
import { aknJudgmentText, aknBodyWordCount, checkJudgmentBody } from '../shared/akn-text'
// The SAME word count the live writer uses. `rawToText` trims and collapses whitespace, so a plain
// split gives the identical number here — but "identical today" is not a reason to keep a second
// implementation of a field both paths write.
import { countWords } from '../shared/db-metadata'

const CORPUS = 'tna-caselaw'
const DRY = process.argv.includes('--dry-run')
const RESUME = process.argv.includes('--resume')
const ONLY_MISSING = process.argv.includes('--only-missing')
// ⚠ `parseInt(String(Infinity))` is NaN, and a NaN LIMIT reaches Postgres as the string 'NaN'
// on a bigint parameter. Caught by the full --apply run failing instantly; the pilot runs all
// passed an explicit --limit and never touched the default.
const num = (k: string, d: number) => {
  const raw = process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1]
  if (raw === undefined) return d
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) throw new Error(`--${k} must be a number, got ${JSON.stringify(raw)}`)
  return n
}
const LIMIT = num('limit', Infinity)
const CONCURRENCY = num('concurrency', 24)
const VERIFY_N = num('verify', 30)
const BATCH = num('batch', 500)

const CHECKPOINT = path.join(__dirname, '.recompile-caselaw.checkpoint.json')

interface Tally {
  attempted: number
  stored: number
  unchanged: number
  emptyAtSource: number
  refusedByGuard: number
  unrecognisedShape: number
  rawUnreadable: number
  putFailed: number
}
const T: Tally = { attempted: 0, stored: 0, unchanged: 0, emptyAtSource: 0, refusedByGuard: 0, unrecognisedShape: 0, rawUnreadable: 0, putFailed: 0 }
const refusalReasons: Record<string, number> = {}
const refusalExamples: string[] = []

let charsBefore = 0, charsAfter = 0

async function mapPool<T_, R>(items: T_[], n: number, fn: (t: T_) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) {
      const k = i++
      if (k >= items.length) return
      out[k] = await fn(items[k])
    }
  }))
  return out
}

interface Row { id: string; r2Key: string; r2RawKey: string; notes: string | null }

;(async () => {
  const p = namesPool()
  const started = Date.now()
  /**
   * ⚠ THE CURSOR STARTS INSIDE THE COLLECTION. `AND id > ''` makes the planner walk
   * `corpus_sections_pkey` from the first id in an 18-million-row table and filter by corpus —
   * 6,139,777 rows removed by the filter, 1.5 M block reads, 35.9 s cold on the first batch.
   * The id range is bounded instead; `probe-id-prefix.ts` verified 74,896 of 74,896 ids sit inside
   * it before it was used, because a bound that is wrong skips rows in silence.
   */
  const LOW = `${CORPUS}:`
  const HIGH = `${CORPUS};`
  let cursor = RESUME && fs.existsSync(CHECKPOINT)
    ? (JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')).lastId as string)
    : LOW
  if (RESUME) console.log(`[recompile] resuming after id ${cursor || '(start)'}`)
  console.log(`[recompile] ${DRY ? 'DRY RUN — nothing will be written' : 'LIVE'}  limit=${LIMIT}  concurrency=${CONCURRENCY}`)

  for (;;) {
    if (T.attempted >= LIMIT) break
    const take = Math.min(BATCH, LIMIT - T.attempted)
    const { rows } = await p.query<Row>(
      `SELECT id, "r2Key", "r2RawKey", notes FROM corpus_sections
        WHERE corpus=$1 AND "r2Key" IS NOT NULL AND "r2RawKey" IS NOT NULL AND id > $2 AND id < $4
          AND ($5::bool = false OR notes IS NULL OR notes NOT LIKE '%text-route:%')
        ORDER BY id LIMIT $3`, [CORPUS, cursor, take, HIGH, ONLY_MISSING])
    if (!rows.length) break

    const results = await mapPool(rows, CONCURRENCY, async (r) => {
      const raw = await r2Get(r.r2RawKey)
      if (!raw) return { r, bucket: 'rawUnreadable' as const }
      const fresh = aknJudgmentText(raw)
      if (!fresh) return { r, bucket: 'unrecognisedShape' as const }
      // The source's own body word count, so "the judgment is the word `withdrawn`" is not read as
      // "the extraction lost the judgment". See shared/akn-text.ts.
      const v = checkJudgmentBody(fresh.text, { sourceBodyWords: aknBodyWordCount(raw) })
      if (!v.ok && !v.emptyAtSource) return { r, bucket: 'refusedByGuard' as const, reason: v.reason }
      const old = await r2Get(r.r2Key)
      // ⚠ An empty-at-source judgment is stored as an EMPTY body on purpose. Leaving it alone
      // leaves what is there now, which for these two rows is a stylesheet and literally nothing
      // else — the worst possible thing to hand a user or a model as a judgment.
      const text = v.emptyAtSource ? '' : fresh.text
      const route = v.emptyAtSource ? 'akn:empty-at-source' : fresh.route
      return { r, bucket: 'ok' as const, text, route, emptyAtSource: v.emptyAtSource, oldLen: old?.length ?? 0, old }
    })

    const toWrite: Array<{ id: string; text: string; notes: string }> = []
    for (const res of results) {
      T.attempted++
      if (res.bucket === 'rawUnreadable') { T.rawUnreadable++; continue }
      if (res.bucket === 'unrecognisedShape') { T.unrecognisedShape++; continue }
      if (res.bucket === 'refusedByGuard') {
        T.refusedByGuard++
        const key = res.reason!.replace(/\d+/g, 'N')
        refusalReasons[key] = (refusalReasons[key] ?? 0) + 1
        if (refusalExamples.length < 5) refusalExamples.push(`${res.r.id} — ${res.reason}`)
        continue
      }
      if (res.emptyAtSource) T.emptyAtSource++
      charsBefore += res.oldLen
      charsAfter += res.text.length
      if (res.old === res.text) { T.unchanged++; continue }
      // `title-route:` must stay first — check-names*.ts test `notes LIKE 'title-route:%'`.
      const existingTitleRoute = /^(title-route:\S+)/.exec(res.r.notes ?? '')?.[1] ?? null
      toWrite.push({
        id: res.r.id,
        text: res.text,
        notes: [existingTitleRoute, `text-route:${res.route}`].filter(Boolean).join(' '),
      })
    }

    if (!DRY && toWrite.length) {
      const puts = await mapPool(toWrite, CONCURRENCY, async (w) => {
        const key = results.find(x => x.r.id === w.id)!.r.r2Key
        try { await r2Put(key, w.text); return true } catch (e) { console.warn(`[recompile] PUT failed ${w.id}: ${e}`); return false }
      })
      const written = toWrite.filter((_, i) => puts[i])
      T.putFailed += puts.filter(x => !x).length
      T.stored += written.length
      if (written.length) {
        await p.query(
          `UPDATE corpus_sections AS s SET "wordCount" = v.wc::int, notes = v.notes
             FROM (SELECT UNNEST($1::text[]) AS id, UNNEST($2::int[]) AS wc, UNNEST($3::text[]) AS notes) AS v
            WHERE s.id = v.id`,
          [written.map(w => w.id), written.map(w => countWords(w.text)), written.map(w => w.notes)])
      }
    } else if (DRY) {
      T.stored += toWrite.length   // "would store"
    }

    cursor = rows[rows.length - 1].id
    if (!DRY) fs.writeFileSync(CHECKPOINT, JSON.stringify({ lastId: cursor, attempted: T.attempted, updatedAt: new Date().toISOString() }))
    const rate = T.attempted / ((Date.now() - started) / 1000)
    process.stdout.write(`\r[recompile] ${T.attempted.toLocaleString()} attempted  ${T.stored.toLocaleString()} ${DRY ? 'would store' : 'stored'}  ${rate.toFixed(1)}/s   `)
  }

  const elapsed = (Date.now() - started) / 1000
  console.log('\n')

  // ── THE RECONCILIATION ──────────────────────────────────────────────────────────────────────
  const accounted = T.stored + T.unchanged + T.refusedByGuard + T.unrecognisedShape + T.rawUnreadable + T.putFailed
  console.log('  ATTEMPTED vs STORED — every document in exactly one bucket')
  console.log(`    attempted                  ${T.attempted.toLocaleString()}`)
  console.log(`    ${DRY ? 'would be stored' : 'stored'}            ${String(T.stored.toLocaleString()).padStart(8)}`)
  console.log(`    already identical          ${String(T.unchanged.toLocaleString()).padStart(8)}`)
  console.log(`      of the stored, empty at source ${String(T.emptyAtSource.toLocaleString()).padStart(4)}  (the source publishes no text; an empty body is stored deliberately)`)
  console.log(`    refused by the body guard  ${String(T.refusedByGuard.toLocaleString()).padStart(8)}`)
  console.log(`    unrecognised AKN shape     ${String(T.unrecognisedShape.toLocaleString()).padStart(8)}`)
  console.log(`    raw object unreadable      ${String(T.rawUnreadable.toLocaleString()).padStart(8)}`)
  console.log(`    R2 PUT failed              ${String(T.putFailed.toLocaleString()).padStart(8)}`)
  console.log(`    ------------------------------------`)
  console.log(`    accounted for              ${accounted.toLocaleString()}  ${accounted === T.attempted ? 'RECONCILES' : 'DOES NOT RECONCILE'}`)
  if (Object.keys(refusalReasons).length) {
    console.log('\n  refusals by reason:')
    for (const [k, v] of Object.entries(refusalReasons).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(6)}  ${k}`)
    refusalExamples.forEach(e => console.log(`    e.g. ${e}`))
  }
  console.log(`\n  text: ${charsBefore.toLocaleString()} chars before -> ${charsAfter.toLocaleString()} after ` +
    `(${charsBefore ? ((100 * (charsBefore - charsAfter)) / charsBefore).toFixed(2) : '—'}% removed)`)
  console.log(`  elapsed ${elapsed.toFixed(1)}s at ${(T.attempted / elapsed).toFixed(1)} docs/s`)
  if (T.attempted && !DRY) {
    const remaining = 74896 - T.attempted
    console.log(`  at this rate the remaining ${remaining.toLocaleString()} would take ${(remaining / (T.attempted / elapsed) / 60).toFixed(1)} min`)
  }

  // ── READ IT BACK. A 200 from R2 is not evidence. ────────────────────────────────────────────
  if (!DRY && VERIFY_N > 0 && T.stored > 0) {
    console.log(`\n  READ-BACK: ${VERIFY_N} written bodies fetched from R2 again and re-checked`)
    const sample = (await p.query<Row>(
      `SELECT id, "r2Key", "r2RawKey", notes FROM corpus_sections
        WHERE corpus=$1 AND notes LIKE '%text-route:akn:judgment-minus-meta%'
        ORDER BY md5(id || 'readback') LIMIT $2`, [CORPUS, VERIFY_N])).rows
    let good = 0
    for (const r of sample) {
      const t = await r2Get(r.r2Key)
      const v = checkJudgmentBody(t)
      if (v.ok) good++
      else console.log(`    FAIL ${r.id} — ${v.reason}`)
    }
    console.log(`    ${good}/${sample.length} pass the body guard when read back out of R2`)
  }

  await endNamesPool()
  process.exit(accounted === T.attempted ? 0 : 1)
})().catch(e => { console.error(e); process.exit(1) })
