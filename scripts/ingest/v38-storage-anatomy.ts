/**
 * v38-storage-anatomy.ts — BRIEF_INGEST_V38_STORAGE §2, second pass. READ-ONLY.
 *
 * The first pass raised two things that stop §2's action list dead until they are settled:
 *
 *   1. `pg_stat_database.stats_reset` is NULL, so the observation window behind "203 indexes with
 *      zero scans" is UNKNOWN. A zero over an unknown window is not evidence of disuse. This
 *      establishes the window by two independent routes and then applies a POSITIVE CONTROL:
 *      indexes this machine is known to have hammered hours ago must show scans. If they read
 *      zero too, the counters are the broken instrument and no index may be dropped on them.
 *
 *   2. `corpus_sections` is 12.54 GiB — 76% of the database — and it has NO body-text column, so
 *      the brief's "a database copy may be redundant" is already true there. The real question is
 *      where those 12.54 GiB actually are. This measures it per column rather than inferring.
 *
 * Usage (from scripts/ingest):  npx tsx v38-storage-anatomy.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'

export {}

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)
const q = async (sql: string, a: any[] = []) => (await pool.query(sql, a)).rows
const GiB = (b: any) => (Number(b) / 1024 ** 3).toFixed(2) + ' GiB'
const cost = (b: any) => '$' + ((Number(b) / 1e9) * 0.35).toFixed(2) + '/mo'

async function main() {
  head('§2.2b — HOW LONG HAVE THE INDEX COUNTERS BEEN RUNNING?')
  const [t] = await q(`
    SELECT pg_postmaster_start_time()::text AS started,
           (now() - pg_postmaster_start_time())::text AS uptime,
           (SELECT stats_reset::text FROM pg_stat_database WHERE datname=current_database()) AS stats_reset`) as any[]
  console.log(`   compute started      ${t.started}`)
  console.log(`   uptime               ${t.uptime}`)
  console.log(`   pg_stat_database.stats_reset  ${t.stats_reset ?? 'NULL'}`)
  console.log(`   ⚠ Neon computes autosuspend and restart. If the counters reset with the compute,`)
  console.log(`     the window is the uptime above — which may be minutes, not weeks.`)

  // POSITIVE CONTROL. 2D-2 ran millions of lookups through these indexes a few hours ago. If they
  // read zero, the counters are not recording and NOTHING may be concluded from a zero elsewhere.
  head('§2.2c — POSITIVE CONTROL: indexes this machine is KNOWN to have used')
  const known = await q(`
    SELECT s.indexrelname AS index, s.relname AS table, s.idx_scan, s.idx_tup_read
      FROM pg_stat_user_indexes s
     WHERE s.indexrelname IN (
       'idx_dv_member','graph_entity_member_id_uq','graph_entity_name_uq','division_votes_pkey',
       'corpus_sections_pkey','graph_member_name_norm_idx','edm_sponsor_pkey','graph_edge_subject_idx')
     ORDER BY s.idx_scan DESC`)
  for (const r of known) console.log(`   ${String(r.index).padEnd(34)} ${String(r.table).padEnd(22)} scans ${String(r.idx_scan).padStart(10)}  tuples ${r.idx_tup_read}`)
  const live = known.filter((r: any) => Number(r.idx_scan) > 0).length
  console.log(`\n   ${live} of ${known.length} known-used indexes register a non-zero scan count.`)
  if (live === 0) {
    console.log(`   ❌ THE COUNTERS ARE NOT RECORDING. Every "zero scan" reading in §2.2 is worthless`)
    console.log(`      and NO index may be dropped on that evidence. This is the check doing its job.`)
  } else if (live < known.length) {
    console.log(`   ⚠ PARTIAL. Some known-used indexes read zero — the counters are unreliable here,`)
    console.log(`     so a zero elsewhere still cannot be trusted.`)
  } else {
    console.log(`   ✓ The counters record. A zero is now meaningful FOR THIS WINDOW — which is still`)
    console.log(`     only the uptime above, so it says nothing about a weekly or monthly reader.`)
  }

  head('§2.3b — WHERE corpus_sections ACTUALLY SPENDS 12.54 GiB')
  const [sz] = await q(`
    SELECT pg_total_relation_size('corpus_sections') AS total,
           pg_relation_size('corpus_sections')       AS heap,
           pg_indexes_size('corpus_sections')        AS indexes,
           COALESCE(pg_total_relation_size((SELECT reltoastrelid FROM pg_class WHERE relname='corpus_sections')),0) AS toast,
           (SELECT COUNT(*) FROM corpus_sections)    AS rows`) as any[]
  const rows = Number(sz.rows)
  console.log(`   rows ${rows.toLocaleString()}   total ${GiB(sz.total)}   heap ${GiB(sz.heap)}   indexes ${GiB(sz.indexes)}   TOAST ${GiB(sz.toast)}`)
  console.log(`   heap bytes per row: ${(Number(sz.heap) / rows).toFixed(0)} B`)

  console.log(`\n   average bytes per column on a 50k sample — where the per-row cost goes:`)
  const cols = ['id', 'corpus', '"sourceUrl"', '"r2Key"', '"r2RawKey"', 'status', 'format',
    '"sectionTitle"', 'speaker', '"parentDocId"', 'licence', 'attribution', 'jurisdiction',
    'notes', '"errorMsg"', '"xmlPreview"', 'availability_status', 'availability_note', '"ftsVector"']
  const parts = cols.map((c) => `COALESCE(AVG(pg_column_size(${c})),0)::numeric(8,1) AS ${c.replace(/"/g, '').toLowerCase()}, COUNT(${c}) AS n_${c.replace(/"/g, '').toLowerCase()}`)
  const [avg] = await q(`SELECT ${parts.join(', ')} FROM (SELECT * FROM corpus_sections LIMIT 50000) s`) as any[]
  // ⚠ AVG IGNORES NULLS, SO THE AVERAGE IS OVER THE NON-NULL ROWS ONLY. Multiplying it by every
  // row projects a column that is 99.5% empty as though it were full — the first version of this
  // put `ftsVector` at 42 GiB inside a 16 GiB database, and `notes` at 5 GiB on two non-null rows.
  // Both are obviously wrong, which is the only reason they were caught; scale by the fill rate.
  let accounted = 0
  const ranked: Array<{ c: string; bytes: number; avg: number; n: number }> = []
  for (const c of cols) {
    const k = c.replace(/"/g, '').toLowerCase()
    const a = Number(avg[k]); const n = Number(avg['n_' + k])
    const fill = n / 50000
    const bytes = a * fill * rows
    accounted += bytes
    ranked.push({ c: c.replace(/"/g, ''), bytes, avg: a, n })
  }
  ranked.sort((x, y) => y.bytes - x.bytes)
  for (const r of ranked) {
    console.log(`     ${r.c.padEnd(22)} avg ${String(r.avg).padStart(7)} B   non-null ${String(r.n).padStart(6)}/50000 (${((100 * r.n) / 50000).toFixed(1).padStart(5)}%)   ≈ ${GiB(r.bytes).padStart(10)}   ${cost(r.bytes)}`)
  }
  console.log(`     ${'── sum of columns'.padEnd(22)} ${' '.repeat(38)} ≈ ${GiB(accounted).padStart(10)}   ${cost(accounted)}`)
  console.log(`   ⚠ heap+TOAST is ${GiB(Number(sz.heap) + Number(sz.toast))} against ${GiB(accounted)} of column data. The difference is the`)
  console.log(`     23-byte row header, alignment padding and free space — roughly ${((Number(sz.heap) + Number(sz.toast) - accounted) / rows).toFixed(0)} B/row that is`)
  console.log(`     NOT reclaimable by dropping any column.`)

  head('§2.3c — THE ftsVector QUESTION')
  const [fv] = await q(`
    SELECT COUNT(*)::text AS rows, COUNT("ftsVector")::text AS non_null
      FROM (SELECT "ftsVector" FROM corpus_sections LIMIT 200000) s`) as any[]
  console.log(`   corpus_sections."ftsVector": ${fv.non_null} non-null of ${fv.rows} sampled`)
  const fvIdx = await q(`
    SELECT indexrelname AS index, pg_relation_size(indexrelid) AS bytes, idx_scan
      FROM pg_stat_user_indexes WHERE relname='corpus_sections' ORDER BY 2 DESC`)
  console.log(`   every index on corpus_sections:`)
  for (const i of fvIdx) console.log(`     ${String(i.index).padEnd(42)} ${GiB(i.bytes).padStart(10)}  scans ${i.idx_scan}`)

  head('§2.4b — WHAT IS ACTUALLY RECLAIMABLE, RANKED, WITH THE PREDICTION')
  console.log(`   Stated as predictions to be scored after, per §2's own instruction.`)
  console.log(`   ⚠ None of these is worth doing for the money alone: the whole database is $6.23/mo.`)

  await endNeonPool()
}
main().catch((e) => { console.error('[v38-storage-anatomy] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
