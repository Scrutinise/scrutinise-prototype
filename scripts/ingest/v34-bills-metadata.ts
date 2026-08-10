/**
 * v34-bills-metadata.ts — give the 6,574 `bills-api` rows a NAME and a STATUS.
 * BRIEF_SEARCH_S2C3 §1.
 *
 * THE DEFECT THIS FIXES, and why it is an ingest fix rather than a display one. The brief asked
 * for `bills-api` to be wired into the search path, and required that a user must never mistake a
 * Bill for an Act, with the stage surfaced where the data carries one. The data as STORED carries
 * none of it:
 *
 *     sectionTitle   "Bill 2518 — publication 17"    ← an internal numeric id and an ordinal
 *     itemDate       null on all 6,574 rows          ← so a 2019 bill and a live one look alike
 *     stage          absent entirely (0 rows)
 *
 * All of it was on the wire and none of it was kept: `listBillsPage` read `shortTitle` and dropped
 * it, `listBillPdfs` returned `title`/`publicationType` which the enqueue step discarded, and
 * `processBills` wrote the ordinal title above. Nothing is wrong with the CORPUS — the bodies are
 * the real bill PDFs, correctly extracted — only with its identifying metadata. So this backfills
 * from the same public API the ingest already uses (4,035 bills, 41 paged requests at the
 * seed-rate-limits interval), joined on `parentDocId`, which already holds the billId.
 *
 * ⚠ WHY corpus_sections AND NOT A DISPLAY-LAYER LOOKUP. The annotation-title fix (S2C2 §2) was a
 * display-layer join because `corpus_acts` already held the titles. Here nothing holds them, and
 * the honest home for "what is this document called" is the row itself — which also means the
 * DENSE path gets it for free (vector-search.ts reads sectionTitle from the DB) rather than only
 * the BM25 path.
 *
 * ⚠ THE BM25 TITLE IS BAKED INTO LANCE AND THIS DOES NOT CHANGE IT. `corpus_fts` carries the OLD
 * sectionTitle until the next index build, and `fts-search.ts` reads the title off the FTS hit.
 * That is why the adapter change shipped alongside this prefers the DB value for bills. Ranking is
 * unaffected either way: this writes no new words the index scores on.
 *
 * PREDICT, MEASURE, COMMIT. `--dry-run` (the default) writes nothing and reports exactly what it
 * would change, so the prediction can be recorded in CHANGE_LOG before the write happens.
 *
 * Usage, from scripts/ingest:
 *   npx tsx v34-bills-metadata.ts             dry run — predicts, writes nothing
 *   npx tsx v34-bills-metadata.ts --commit    applies it
 */
import path from 'path'
import { Pool } from 'pg'
import { listAllBillStatuses, billDisplayTitle, type BillStatus } from './sources/bills-parliament'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const COMMIT = process.argv.includes('--commit')
const CORPUS = 'bills-api'

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }, max: 3, statement_timeout: 600_000,
})

async function main() {
  console.log(`[bills-meta] ${COMMIT ? 'COMMIT' : 'DRY RUN'} — target ${/@([^/:]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1]}`)

  // ── 1. the rows as they stand ─────────────────────────────────────────────
  const { rows: before } = await pool.query<{ total: string; no_date: string; ordinal_title: string; distinct_bills: string }>(
    `SELECT COUNT(*)::text total,
            COUNT(*) FILTER (WHERE "itemDate" IS NULL)::text no_date,
            COUNT(*) FILTER (WHERE "sectionTitle" ~ '^Bill [0-9]+ — publication')::text ordinal_title,
            COUNT(DISTINCT "parentDocId")::text distinct_bills
       FROM corpus_sections WHERE corpus = $1`, [CORPUS])
  console.log(`[bills-meta] BEFORE: ${before[0].total} rows · ${before[0].distinct_bills} distinct bills · ` +
    `${before[0].ordinal_title} with an ordinal title · ${before[0].no_date} with no date`)

  // ── 2. the API sweep ──────────────────────────────────────────────────────
  const statuses = await listAllBillStatuses((n, total) => {
    if (n % 500 === 0 || n === total) console.log(`[bills-meta]   fetched ${n}/${total} bills`)
  })
  // Null, not a short list: a partial sweep would silently mislabel the bills it missed, and
  // "no metadata" is a visible state while "wrong metadata" is not.
  if (!statuses) { console.error('[bills-meta] bill list fetch FAILED — refusing to write a partial backfill'); process.exit(1) }
  const byId = new Map<string, BillStatus>(statuses.map((s) => [String(s.billId), s]))
  console.log(`[bills-meta] API: ${statuses.length} bills · ${statuses.filter((s) => s.isAct).length} became Acts · ` +
    `${statuses.filter((s) => s.withdrawn).length} withdrawn · ${statuses.filter((s) => s.defeated).length} defeated · ` +
    `${statuses.filter((s) => !s.stage).length} with no stage`)

  // ── 3. what we can and cannot match ───────────────────────────────────────
  const { rows: parents } = await pool.query<{ parent: string | null; n: string }>(
    `SELECT "parentDocId" parent, COUNT(*)::text n FROM corpus_sections WHERE corpus = $1 GROUP BY 1`, [CORPUS])
  let matchedRows = 0, unmatchedRows = 0
  const unmatchedBills: string[] = []
  for (const p of parents) {
    if (p.parent && byId.has(p.parent)) matchedRows += +p.n
    else { unmatchedRows += +p.n; if (p.parent) unmatchedBills.push(p.parent) }
  }
  console.log(`[bills-meta] MATCH: ${matchedRows} rows resolve to a bill; ${unmatchedRows} do not` +
    (unmatchedBills.length ? ` (${unmatchedBills.length} unmatched billIds, e.g. ${unmatchedBills.slice(0, 5).join(', ')})` : ''))

  // ── 4. sample the titles this would produce, BEFORE writing any ───────────
  console.log('[bills-meta] sample of the titles this produces:')
  for (const s of statuses.slice(0, 3)) console.log(`    ${billDisplayTitle(s)}`)
  for (const s of statuses.filter((x) => x.isAct).slice(0, 2)) console.log(`    ${billDisplayTitle(s)}`)
  for (const s of statuses.filter((x) => x.withdrawn).slice(0, 2)) console.log(`    ${billDisplayTitle(s)}`)

  if (!COMMIT) {
    console.log(`\n[bills-meta] DRY RUN — nothing written. Would set sectionTitle + itemDate on ${matchedRows} rows.`)
    await pool.end(); return
  }

  // ── 5. the write ──────────────────────────────────────────────────────────
  // Idempotent by construction: it sets absolute values from the API, so a second run is a no-op
  // rather than a compounding edit. itemDate is the bill's lastUpdate — the ONLY date any of this
  // data carries; it is a record-update date, not a stage date, which is why the rendered title
  // says "last updated" rather than anything stronger.
  let written = 0
  const CHUNK = 200
  for (let i = 0; i < statuses.length; i += CHUNK) {
    const batch = statuses.slice(i, i + CHUNK)
    const ids = batch.map((s) => String(s.billId))
    const titles = batch.map((s) => billDisplayTitle(s))
    const dates = batch.map((s) => s.lastUpdate)
    const res = await pool.query(
      `UPDATE corpus_sections s
          SET "sectionTitle" = v.title,
              "itemDate"     = COALESCE(v.d::date, s."itemDate")
         FROM (SELECT unnest($2::text[]) AS pid, unnest($3::text[]) AS title, unnest($4::text[]) AS d) v
        WHERE s.corpus = $1 AND s."parentDocId" = v.pid`,
      [CORPUS, ids, titles, dates])
    written += res.rowCount ?? 0
    if (i % 1000 === 0) console.log(`[bills-meta]   ${written} rows updated…`)
  }

  const { rows: after } = await pool.query<{ total: string; no_date: string; ordinal_title: string; named: string }>(
    `SELECT COUNT(*)::text total,
            COUNT(*) FILTER (WHERE "itemDate" IS NULL)::text no_date,
            COUNT(*) FILTER (WHERE "sectionTitle" ~ '^Bill [0-9]+ — publication')::text ordinal_title,
            COUNT(*) FILTER (WHERE "sectionTitle" LIKE '%—%' AND "sectionTitle" !~ '^Bill [0-9]+ — publication')::text named
       FROM corpus_sections WHERE corpus = $1`, [CORPUS])
  console.log(`\n[bills-meta] AFTER: ${after[0].total} rows · ${after[0].named} named · ` +
    `${after[0].ordinal_title} still ordinal · ${after[0].no_date} still undated`)
  console.log(`[bills-meta] rows written: ${written}`)
  await pool.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
