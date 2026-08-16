/**
 * v38-index-usage-snapshot.ts — BRIEF_INGEST_V38_STORAGE §2, the instrument that makes step 1
 * answerable. It does NOT drop anything.
 *
 * ⚠ WHY THIS EXISTS INSTEAD OF THE INDEX DROPS THE BRIEF ASKS FOR.
 *
 * §2 says "drop the indexes with no reader, WITH THE EVIDENCE". The evidence does not exist yet:
 *
 *   · `pg_stat_database.stats_reset` is NULL — no recorded window at all
 *   · the compute had been up **2 minutes 22 seconds** when measured; Neon autosuspends, so the
 *     counters may or may not survive a restart and nothing on this side can tell which
 *   · a POSITIVE CONTROL over eight indexes this machine is known to have driven came back 6/8 —
 *     two known-used indexes read zero
 *
 * So "203 indexes with zero scans" is a statement about a window of unknown length that certainly
 * contains this session's own read-only probes and possibly nothing else. **Dropping an index on
 * that is the exact error this whole brief was written about**: acting on a number whose provenance
 * nobody established. The prize is 0.64 GiB — **$0.24/month** — which does not buy a guess.
 *
 * What is needed is elapsed time with the counters observed. This records a snapshot each run, so
 * the DELTA between two runs is a real measurement of use over a known interval, regardless of what
 * the absolute counter means or whether it reset. Two snapshots a week apart answer the question
 * the brief asks; one snapshot answers nothing, and the script says so.
 *
 * ▶ FOLLOW-UP, NOT DONE HERE: wire this into `ops.ts`'s hourly pass so the series accumulates
 * without anyone remembering. Left out on purpose — `ops.ts` is a shared file and another thread is
 * editing this tree tonight.
 *
 * Usage (from scripts/ingest):
 *   npx tsx v38-index-usage-snapshot.ts            # take a snapshot, report the delta if one exists
 *   npx tsx v38-index-usage-snapshot.ts --report   # report only, record nothing
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'

export {}

const REPORT_ONLY = process.argv.includes('--report')
const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)
const q = async (sql: string, a: any[] = []) => (await pool.query(sql, a)).rows
const MB = (b: any) => (Number(b) / 1024 ** 2).toFixed(0) + ' MB'

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS index_usage_snapshots (
      taken_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      index_name      TEXT        NOT NULL,
      table_name      TEXT        NOT NULL,
      idx_scan        BIGINT      NOT NULL,
      idx_tup_read    BIGINT      NOT NULL,
      size_bytes      BIGINT      NOT NULL,
      -- ⚠ recorded so a snapshot taken after a restart can be told apart from one taken before.
      -- Without it a counter that reset looks identical to an index nobody used.
      postmaster_start TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (taken_at, index_name)
    )`)

  const [t] = await q(`SELECT pg_postmaster_start_time() AS started, (now() - pg_postmaster_start_time())::text AS uptime`) as any[]
  console.log(`compute up ${t.uptime}  (started ${new Date(t.started).toISOString()})`)

  if (!REPORT_ONLY) {
    const n = await pool.query(`
      INSERT INTO index_usage_snapshots (index_name, table_name, idx_scan, idx_tup_read, size_bytes, postmaster_start)
      SELECT s.indexrelname, s.relname, s.idx_scan, s.idx_tup_read,
             pg_relation_size(s.indexrelid), pg_postmaster_start_time()
        FROM pg_stat_user_indexes s WHERE s.schemaname='public'
      ON CONFLICT DO NOTHING`)
    console.log(`snapshot recorded: ${n.rowCount} indexes`)
  }

  head('THE SERIES SO FAR')
  const snaps = await q(
    `SELECT taken_at::text, postmaster_start::text, COUNT(*)::int AS indexes
       FROM index_usage_snapshots GROUP BY 1,2 ORDER BY 1`)
  for (const s of snaps) console.log(`   ${s.taken_at}   ${s.indexes} indexes   (compute up since ${s.postmaster_start})`)

  if (snaps.length < 2) {
    head('VERDICT')
    console.log(`   ⚠ ONE SNAPSHOT. This proves nothing yet, and that is the honest state.`)
    console.log(`   Run this again after a representative period of real traffic — a week that`)
    console.log(`   includes whatever runs weekly — and the delta becomes the evidence §2 asks for.`)
    console.log(`   Until then NO INDEX SHOULD BE DROPPED, including the 0.64 GiB / $0.24-a-month`)
    console.log(`   currently reading zero.`)
    await endNeonPool(); return
  }

  // Two or more: report the delta between the first and last snapshot that share a postmaster
  // start, because a restart between them may have zeroed the counters.
  head('DELTA — USE OVER A KNOWN INTERVAL')
  const rows = await q(`
    WITH bounds AS (
      SELECT MIN(taken_at) AS lo, MAX(taken_at) AS hi FROM index_usage_snapshots)
    SELECT a.index_name, a.table_name, a.size_bytes,
           a.idx_scan AS scans_start, b.idx_scan AS scans_end,
           (b.idx_scan - a.idx_scan) AS delta,
           (b.postmaster_start <> a.postmaster_start) AS restarted,
           (b.taken_at - a.taken_at)::text AS interval
      FROM index_usage_snapshots a
      JOIN index_usage_snapshots b ON b.index_name = a.index_name
      JOIN bounds ON a.taken_at = bounds.lo AND b.taken_at = bounds.hi
     ORDER BY (b.idx_scan - a.idx_scan) ASC, a.size_bytes DESC`)
  if (!rows.length) { console.log('   no index appears in both snapshots'); await endNeonPool(); return }
  const restarted = rows.some((r: any) => r.restarted)
  console.log(`   interval ${rows[0].interval}${restarted ? '   ⚠ THE COMPUTE RESTARTED IN BETWEEN — deltas may be negative and are not trustworthy' : ''}`)
  const dead = rows.filter((r: any) => Number(r.delta) === 0)
  const deadBytes = dead.reduce((a: number, r: any) => a + Number(r.size_bytes), 0)
  console.log(`   ${dead.length} indexes saw ZERO scans across the interval — ${MB(deadBytes)}`)
  for (const r of dead.slice(0, 25)) console.log(`     ${String(r.index_name).padEnd(46)} ${String(r.table_name).padEnd(22)} ${MB(r.size_bytes).padStart(9)}`)
  console.log(`\n   ⚠ Still not a licence to drop: an index used monthly reads zero over a week.`)
  console.log(`     The interval above is the claim's whole warranty — quote it wherever the`)
  console.log(`     number is quoted.`)
  await endNeonPool()
}
main().catch((e) => { console.error('[v38-index-usage-snapshot] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
