/**
 * sweep-caselaw-dates.ts — BRIEF_INGEST_CASELAW_TEXT §4 / INGEST_NAMES_REPORT D-3.
 * Charlie has authorised this. It moves `itemDate` on `tna-caselaw` from the CITATION YEAR to the
 * date the judgment was actually handed down.
 *
 * WHAT IS WRONG TODAY. `v28-title-extract.ts` had no date to work from and derived one from the
 * citation: `[2019] UKSC 41` became **2019-01-01**. R (Miller) v The Prime Minister was handed
 * down on **2019-09-24**. Rows written since 19 August carry the true `<FRBRdate name="judgment">`
 * from the AKN, so the collection currently holds dates on TWO BASES — which is worse than either
 * one, and is why D-3 was raised as a decision rather than done quietly.
 *
 * ⚠ A DATE IS ONLY MOVED WHEN THE SOURCE STATES ONE. Where the AKN carries no `FRBRdate` the
 * existing value is left alone and the row is counted as residual — reported as a percentage of
 * the collection, with what a user sees for those rows. A manufactured date is the same mistake
 * as a manufactured title.
 *
 * ⚠ READ THE RANGE, THEN CHECK THE RANGE. `FRBRdate` sits in the `<meta>` block, so a 32 KB range
 * read is enough — but if the window did not contain one, the object is re-read IN FULL before
 * concluding the source has no date. An absence manufactured by our own optimisation is the §18
 * failure shape and `backfill-caselaw-titles.ts` carries the same guard for the same reason.
 *
 *   --measure     read, compare, report — write nothing  (default)
 *   --apply       write itemDate
 *   --limit=N     cap rows (pilot)
 *   --controls    the checks, watched failing, before anything is written
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get, r2GetRange } from '../shared/r2-client'
import { judgmentDateFromAkn } from '../shared/caselaw-name'

const CORPUS = 'tna-caselaw'
const META_BYTES = 32_768
const APPLY = process.argv.includes('--apply')
const CONTROLS = process.argv.includes('--controls')
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
const BATCH = num('batch', 2000)

/** The judgment the brief names, and the date the National Archives publishes for it. */
const GOLD_ID = 'tna-caselaw:[2019] UKSC 41:1'
const GOLD_DATE = '2019-09-24'

let failures = 0
function assert(ok: boolean, label: string, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}\n        ${detail}`)
}

async function mapPool<A, R>(items: A[], n: number, fn: (a: A) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) { const k = i++; if (k >= items.length) return; out[k] = await fn(items[k]) }
  }))
  return out
}

/** The source's date for one row, or null. Range read first, full read before concluding "none". */
async function sourceDate(rawKey: string): Promise<string | null> {
  const head = await r2GetRange(rawKey, META_BYTES)
  const fromHead = head ? judgmentDateFromAkn(head) : null
  if (fromHead) return fromHead
  const full = await r2Get(rawKey)
  return full ? judgmentDateFromAkn(full) : null
}

async function controls(): Promise<void> {
  console.log('\n— THE CHECKS, WATCHED FAILING —\n')

  // The extractor itself, on planted XML. Each of these would silently produce a wrong date if
  // the regex were loosened, so they are here rather than assumed.
  const withJudgmentName = `<FRBRWork><FRBRdate date="2019-09-24" name="judgment"/></FRBRWork>`
  assert(judgmentDateFromAkn(withJudgmentName) === '2019-09-24',
    'a judgment-named FRBRdate is read', `got ${judgmentDateFromAkn(withJudgmentName)}`)

  const noDate = `<FRBRWork><FRBRname value="Smith v Jones"/></FRBRWork>`
  assert(judgmentDateFromAkn(noDate) === null,
    'XML with no FRBRdate yields NULL, not a guess', `got ${JSON.stringify(judgmentDateFromAkn(noDate))}`)

  const yearOnly = `<FRBRWork><FRBRdate date="2019" name="judgment"/></FRBRWork>`
  assert(judgmentDateFromAkn(yearOnly) === null,
    'a year-only date is REFUSED — that is the very value being replaced',
    `got ${JSON.stringify(judgmentDateFromAkn(yearOnly))}`)

  const p = namesPool()
  const r = (await p.query(
    `SELECT id, "itemDate"::text AS "itemDate", "r2RawKey" FROM corpus_sections WHERE id=$1`, [GOLD_ID])).rows[0]
  if (!r) { assert(false, 'the gold judgment exists', `${GOLD_ID} not found`); await endNamesPool(); return }
  const src = await sourceDate(r.r2RawKey)
  assert(src === GOLD_DATE, `the source states ${GOLD_DATE} for ${GOLD_ID}`, `AKN FRBRdate = ${src}`)
  console.log(`\n  stored itemDate for ${GOLD_ID} right now: ${r.itemDate}` +
    `${r.itemDate?.startsWith(GOLD_DATE) ? '  (already correct)' : `  <- WRONG by ${r.itemDate ? Math.round((Date.parse(GOLD_DATE) - Date.parse(r.itemDate)) / 86400000) : '?'} days`}`)
  await endNamesPool()
}

async function run(): Promise<void> {
  const p = namesPool()
  const t0 = Date.now()
  const total = (await p.query(`SELECT COUNT(*)::int n FROM corpus_sections WHERE corpus=$1`, [CORPUS])).rows[0].n

  /**
   * ⚠ THE CURSOR STARTS INSIDE THE COLLECTION, AND THAT IS WORTH 35 SECONDS A BATCH.
   * `WHERE corpus='tna-caselaw' AND id > ''` makes the planner walk `corpus_sections_pkey` from
   * the first id in an 18-million-row table and filter — EXPLAIN ANALYZE showed 6,139,777 rows
   * removed by the filter and 1.5 M block reads before the first judgment was reached, 35.9 s cold.
   * Bounding the id range turns it into a range scan over the collection's own slice. Verified
   * before using it (`probe-id-prefix.ts`): 74,896 of 74,896 ids start `tna-caselaw:` and 0 rows
   * fall outside ['tna-caselaw:', 'tna-caselaw;') — a bound that is wrong skips rows silently.
   */
  const LOW = `${CORPUS}:`
  const HIGH = `${CORPUS};`
  let cursor = LOW
  let processed = 0, moved = 0, alreadyRight = 0, noSourceDate = 0, noRawKey = 0
  let movedDays = 0, maxMoveDays = 0
  const janFirstBefore = { yes: 0, no: 0 }
  const examples: string[] = []

  for (;;) {
    if (processed >= LIMIT) break
    const take = Math.min(BATCH, LIMIT - processed)
    const { rows } = await p.query<{ id: string; itemDate: string | null; r2RawKey: string | null }>(
      `SELECT id, "itemDate"::text AS "itemDate", "r2RawKey" FROM corpus_sections
        WHERE corpus=$1 AND id > $2 AND id < $4 ORDER BY id LIMIT $3`, [CORPUS, cursor, take, HIGH])
    if (!rows.length) break

    const dates = await mapPool(rows, CONCURRENCY, async r => (r.r2RawKey ? sourceDate(r.r2RawKey) : null))

    const updates: Array<{ id: string; date: string }> = []
    rows.forEach((r, i) => {
      processed++
      if (r.itemDate?.slice(5) === '01-01') janFirstBefore.yes++; else janFirstBefore.no++
      if (!r.r2RawKey) { noRawKey++; return }
      const src = dates[i]
      if (!src) { noSourceDate++; return }
      const cur = r.itemDate?.slice(0, 10) ?? null
      if (cur === src) { alreadyRight++; return }
      moved++
      if (cur) {
        const d = Math.abs(Math.round((Date.parse(src) - Date.parse(cur)) / 86400000))
        movedDays += d
        if (d > maxMoveDays) maxMoveDays = d
      }
      if (examples.length < 5) examples.push(`${r.id}: ${cur ?? 'NULL'} -> ${src}`)
      updates.push({ id: r.id, date: src })
    })

    if (APPLY && updates.length) {
      await p.query(
        `UPDATE corpus_sections AS c SET "itemDate" = v.d::date
           FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS d) AS v
          WHERE c.id = v.id AND c.corpus = $3`,
        [updates.map(u => u.id), updates.map(u => u.date), CORPUS])
    }

    cursor = rows[rows.length - 1].id
    const rate = processed / ((Date.now() - t0) / 1000)
    process.stdout.write(`\r  ${processed.toLocaleString()} read  ${moved.toLocaleString()} ${APPLY ? 'moved' : 'would move'}  ${rate.toFixed(0)}/s   `)
  }

  const elapsed = (Date.now() - t0) / 1000
  console.log('\n')
  const pct = (a: number) => `${((100 * a) / processed).toFixed(2)}%`
  console.log(`  ${APPLY ? 'APPLIED' : 'MEASURED'} over ${processed.toLocaleString()} of ${total.toLocaleString()} ${CORPUS} rows in ${(elapsed / 60).toFixed(1)} min\n`)
  console.log(`    dates ${APPLY ? 'moved' : 'that would move'}     ${String(moved.toLocaleString()).padStart(8)}  ${pct(moved)} of rows processed`)
  console.log(`    already correct           ${String(alreadyRight.toLocaleString()).padStart(8)}  ${pct(alreadyRight)}`)
  console.log(`    RESIDUAL — source states no date  ${String(noSourceDate.toLocaleString()).padStart(6)}  ${pct(noSourceDate)}`)
  console.log(`    RESIDUAL — no raw object          ${String(noRawKey.toLocaleString()).padStart(6)}  ${pct(noRawKey)}`)
  const accounted = moved + alreadyRight + noSourceDate + noRawKey
  console.log(`    ----------------------------------------`)
  console.log(`    accounted for             ${String(accounted.toLocaleString()).padStart(8)}  ${accounted === processed ? 'RECONCILES' : 'DOES NOT RECONCILE'}`)
  console.log(`\n    before the sweep, rows dated 1 January: ${janFirstBefore.yes.toLocaleString()} of ${processed.toLocaleString()} (${pct(janFirstBefore.yes)})`)
  if (moved) console.log(`    mean move ${(movedDays / moved).toFixed(0)} days, largest ${maxMoveDays} days`)
  if (examples.length) { console.log('\n    examples:'); examples.forEach(e => console.log(`      ${e}`)) }

  if (APPLY) {
    const after = (await p.query(
      `SELECT COUNT(*)::int n,
              COUNT(*) FILTER (WHERE to_char("itemDate",'MM-DD')='01-01')::int jan1,
              COUNT(*) FILTER (WHERE "itemDate" IS NULL)::int undated
         FROM corpus_sections WHERE corpus=$1`, [CORPUS])).rows[0]
    console.log(`\n    AFTER: ${after.jan1.toLocaleString()} of ${after.n.toLocaleString()} rows still dated 1 January ` +
      `(${((100 * after.jan1) / after.n).toFixed(2)}% of the collection), ${after.undated.toLocaleString()} undated`)
    const gold = (await p.query(`SELECT "itemDate"::text AS d FROM corpus_sections WHERE id=$1`, [GOLD_ID])).rows[0]
    assert(gold?.d?.startsWith(GOLD_DATE), `${GOLD_ID} now carries the handed-down date`, `itemDate = ${gold?.d}`)
  }
  await endNamesPool()
}

;(async () => {
  if (CONTROLS) await controls()
  if (!CONTROLS || APPLY || process.argv.includes('--measure')) await run()
  console.log(`\n${failures === 0 ? 'ALL ASSERTIONS PASS' : `${failures} ASSERTION FAILURE(S)`}`)
  process.exit(failures === 0 ? 0 : 1)
})().catch(e => { console.error(e); process.exit(1) })
