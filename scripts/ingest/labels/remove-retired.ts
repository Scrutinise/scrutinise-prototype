/**
 * remove-retired.ts — INGEST-LABELS §3. TAKE THE RETIRED COLLECTIONS OUT OF WHAT A USER CAN REACH.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A CORRECTNESS FIX AND NOT HOUSEKEEPING
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Three collections were retired as SUPERSEDED. Retiring the `corpus_targets` row removed them from
 * the daily email and from the denominator — and from nothing else. All 28,629 sections are still
 * in `corpus_sections`, still in the keyword index, still in the vector index, and all three map to
 * display type DEBATE in the `parliamentary` tier, which is inside the `debates` stream's scope.
 * So material we decided not to carry is returnable to a user today. Verified before writing this:
 * a scoped query returns 5 of 5 for each.
 *
 * ⚠ ALL THREE WERE RETIRED AS SUPERSEDED. NONE WAS RETIRED FOR A LICENCE REASON — checked against
 * `corpus_targets.blocked_reason` and the change log, and stated explicitly because a licence
 * retirement would be a compliance exposure needing a different response, not a tidy-up.
 *
 * ⚠ AND THE SUPERSESSION WAS RE-VERIFIED, NOT ASSUMED, because a retirement decision made in V16
 * is a claim about a corpus that has changed since. For each, a distinctive string from a retired
 * row was queried against the SUPERSEDING collection through the live index:
 *   lda-lordswrittenquestions   → pwdata-lordswrans  rank 0, and richer (the retired row is the
 *                                 QUESTION ONLY; pwdata carries the answer)
 *   lda-commonswrittenquestions → pwdata-wrans       (same shape, 1.23M per-Q&A rows, 2001–)
 *   written-statements          → pwdata-wms         rank 0, and richer (the retired row is a
 *                                 MONTH BLOB of ~26k chars; pwdata is per-statement)
 * In every case the superseding collection holds the same content in a better retrieval unit.
 *
 * ORDER: DATABASE FIRST, THEN THE INDEXES. `fts-catchup` appends ids the index lacks by reading
 * `corpus_sections`; deleting the index rows first would leave the DB rows to resurrect them on the
 * next catchup. Deleting the DB rows first can only leave orphan index rows, which `vec-hygiene`
 * already detects and which read harmlessly in the meantime.
 *
 * Usage:
 *   tsx labels/remove-retired.ts            # DRY RUN — counts what would go, changes nothing
 *   tsx labels/remove-retired.ts --apply
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from '../search/lance'
import { CHUNKS_TABLE, VEC_TABLE } from '../search/vector-common'

const APPLY = process.argv.includes('--apply')
// ⚠ --self-test POINTS THE PRECONDITIONS AT A LIVE, NOT-RETIRED COLLECTION AND REQUIRES THEM TO
// REFUSE. A guard that has only ever been seen to pass is not a guard, and this one stands in
// front of an irreversible delete on a production index. It exits 0 ONLY when the refusal fires.
const SELF_TEST = process.argv.includes('--self-test')
const RETIRED = SELF_TEST
  ? ['pwdata-wrans', 'pwdata-wms', 'written-statements']
  : ['lda-lordswrittenquestions', 'lda-commonswrittenquestions', 'written-statements']
const n = (v: number) => Number(v).toLocaleString('en-GB')
const esc = (s: string) => s.replace(/'/g, "''")

async function lanceCounts(): Promise<Record<string, Record<string, number>>> {
  const db = await connectLance()
  const out: Record<string, Record<string, number>> = {}
  for (const t of [FTS_TABLE, VEC_TABLE, CHUNKS_TABLE]) {
    out[t] = {}
    const tbl = await db.openTable(t)
    for (const c of RETIRED) {
      // countRows with a filter is a metadata/scan op, not a full materialisation.
      out[t][c] = await tbl.countRows(`corpus = '${esc(c)}'`)
    }
  }
  return out
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 2,
    statement_timeout: 1_800_000, query_timeout: 1_800_000,
  })

  const { rows: dbBefore } = await pool.query<{ corpus: string; n: string }>(
    `SELECT corpus, count(*)::text n FROM corpus_sections WHERE corpus = ANY($1::text[]) GROUP BY 1 ORDER BY 1`, [RETIRED])
  const { rows: guard } = await pool.query<{ corpus_key: string; retired: boolean; blocked_reason: string | null }>(
    `SELECT corpus_key, COALESCE(retired,false) retired, blocked_reason FROM corpus_targets WHERE corpus_key = ANY($1::text[])`, [RETIRED])

  console.log('=== §3 — RETIRED COLLECTIONS STILL IN THE INDEXES ===\n')
  console.log('PRECONDITION: every one must still be marked retired, and none may cite a LICENCE reason.')
  let licenceRisk = false
  for (const g of guard) {
    const licence = /licen[cs]e|copyright|rights|permission/i.test(g.blocked_reason ?? '')
    if (licence) licenceRisk = true
    console.log(`  ${g.corpus_key.padEnd(30)} retired=${g.retired}  ${licence ? '⚠⚠ LICENCE-SHAPED REASON' : 'superseded'}  — ${g.blocked_reason ?? '(none)'}`)
  }
  if (guard.length !== RETIRED.length) {
    console.error(`\nREFUSING: expected ${RETIRED.length} corpus_targets rows, found ${guard.length}.`)
    await pool.end(); process.exitCode = 1; return
  }
  if (guard.some(g => !g.retired)) {
    console.error('\nREFUSING: a collection named here is NOT marked retired. The decision must stand before removal.')
    await pool.end(); process.exitCode = 1; return
  }
  if (licenceRisk) {
    console.error('\n⚠⚠ REFUSING: a retirement reason mentions licensing. That is a compliance question, ' +
      'not a tidy-up, and must be reported to Charlie before anything is deleted.')
    await pool.end(); process.exitCode = 1; return
  }

  const before = await lanceCounts()
  console.log('\nHELD NOW:')
  console.log(`  ${'collection'.padEnd(30)} ${'corpus_sections'.padStart(16)} ${'corpus_fts'.padStart(12)} ${'corpus_vec'.padStart(12)} ${'corpus_chunks'.padStart(14)}`)
  let total = 0
  for (const c of RETIRED) {
    const db = Number(dbBefore.find(r => r.corpus === c)?.n ?? 0)
    total += db
    console.log(`  ${c.padEnd(30)} ${n(db).padStart(16)} ${n(before[FTS_TABLE][c]).padStart(12)} ` +
      `${n(before[VEC_TABLE][c]).padStart(12)} ${n(before[CHUNKS_TABLE][c]).padStart(14)}`)
  }
  console.log(`  ${'TOTAL'.padEnd(30)} ${n(total).padStart(16)}`)

  if (!APPLY) {
    console.log('\nDRY RUN — nothing changed. Re-run with --apply.')
    await pool.end(); return
  }

  // ── database first (see header) ─────────────────────────────────────────
  const del = await pool.query(`DELETE FROM corpus_sections WHERE corpus = ANY($1::text[])`, [RETIRED])
  console.log(`\n[apply] corpus_sections: ${n(del.rowCount ?? 0)} rows deleted`)

  // ── then the indexes ────────────────────────────────────────────────────
  const db = await connectLance()
  for (const t of [FTS_TABLE, VEC_TABLE, CHUNKS_TABLE]) {
    const tbl = await db.openTable(t)
    for (const c of RETIRED) {
      if (before[t][c] === 0) { console.log(`[apply] ${t} / ${c}: already 0 — skipped`); continue }
      await tbl.delete(`corpus = '${esc(c)}'`)
      const after = await tbl.countRows(`corpus = '${esc(c)}'`)
      console.log(`[apply] ${t} / ${c}: ${n(before[t][c])} → ${n(after)}${after === 0 ? ' ✓' : ' ⚠ NOT EMPTY'}`)
    }
  }

  const { rows: dbAfter } = await pool.query<{ n: string }>(
    `SELECT count(*)::text n FROM corpus_sections WHERE corpus = ANY($1::text[])`, [RETIRED])
  await pool.end()
  console.log(`\n[apply] corpus_sections now holds ${dbAfter[0].n} rows for these collections.`)
  console.log('[apply] ⚠ VERIFY THROUGH RETRIEVAL, not from these counts — `labels/verify-retired-gone.ts`.')
  console.log('[apply] ⚠ fts-serve and vector-serve hold their tables OPEN; they must be redeployed before')
  console.log('        a user stops seeing these rows. A count of rows deleted proves nothing about that.')
}

main().catch(e => { console.error(e); process.exitCode = 1 })
