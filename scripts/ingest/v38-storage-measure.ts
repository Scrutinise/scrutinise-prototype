/**
 * v38-storage-measure.ts — BRIEF_INGEST_V38_STORAGE §2, the MEASUREMENT half. READ-ONLY.
 *
 * Nothing here drops, vacuums or rewrites anything. §2's order is measure → predict → act → score,
 * and this is the measure step. It answers, per the brief:
 *
 *   · what corpus_sections costs, split between heap, indexes and TOAST
 *   · which indexes have no reader, WITH THE EVIDENCE
 *   · whether body text is in the database at all
 *   · what LegislationSection costs
 *   · how much dead tuple space ordinary maintenance could return
 *
 * ⚠ ON "NO READER". pg_stat_user_indexes.idx_scan counts scans SINCE THE LAST STATS RESET, so a
 * zero is only meaningful next to the reset timestamp. A counter reset yesterday says nothing about
 * an index used weekly. Both are printed, and an index is only ever CALLED unused with the window
 * beside it — this is the same failure mode as reading a since-boot /stats counter as a lifetime
 * total (root CLAUDE.md §17's last trap).
 *
 * Usage (from scripts/ingest):  npx tsx v38-storage-measure.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'

export {}

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)
const q = async (sql: string, a: any[] = []) => (await pool.query(sql, a)).rows
const GB = (b: any) => (Number(b) / 1024 ** 3).toFixed(2) + ' GiB'
const MB = (b: any) => (Number(b) / 1024 ** 2).toFixed(0) + ' MB'
/** Launch plan, verified against neon.com/docs/introduction/plans on 2026-08-16. */
const RATE_PER_GB_MONTH = 0.35
const cost = (b: any) => '$' + ((Number(b) / 1e9) * RATE_PER_GB_MONTH).toFixed(2) + '/mo'

async function main() {
  const [{ b }] = await q(`SELECT pg_database_size(current_database())::text AS b`) as any[]
  console.log(`database ${GB(b)}  (${(Number(b) / 1e9).toFixed(2)} GB decimal)  →  ${cost(b)} at $${RATE_PER_GB_MONTH}/GB-month`)

  head('§2.1 — WHERE THE SPACE IS, PER TABLE')
  const tables = await q(`
    SELECT c.relname AS table,
           pg_total_relation_size(c.oid)                                   AS total,
           pg_relation_size(c.oid)                                         AS heap,
           pg_indexes_size(c.oid)                                          AS indexes,
           COALESCE(pg_total_relation_size(c.reltoastrelid), 0)            AS toast,
           c.reltuples::bigint                                             AS est_rows
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname='public' AND c.relkind='r'
     ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 15`)
  let tot = 0
  for (const t of tables) tot += Number(t.total)
  console.log(`   ${'table'.padEnd(24)} ${'total'.padStart(10)} ${'heap'.padStart(10)} ${'indexes'.padStart(10)} ${'TOAST'.padStart(10)}   ${'cost'.padStart(9)}`)
  for (const t of tables) {
    console.log(`   ${String(t.table).padEnd(24)} ${GB(t.total).padStart(10)} ${GB(t.heap).padStart(10)} ${GB(t.indexes).padStart(10)} ${GB(t.toast).padStart(10)}   ${cost(t.total).padStart(9)}`)
  }
  console.log(`   ${'── top 15'.padEnd(24)} ${GB(tot).padStart(10)}`)

  head('§2.2 — INDEXES WITH NO READER — AND THE WINDOW THAT MAKES THAT MEANINGFUL')
  const [reset] = await q(
    `SELECT stats_reset::text AS stats_reset,
            (now() - stats_reset)::text AS window
       FROM pg_stat_database WHERE datname = current_database()`) as any[]
  console.log(`   stats last reset: ${reset?.stats_reset ?? '(never recorded)'}`)
  console.log(`   observation window: ${reset?.window ?? '(unknown)'}`)
  console.log(`   ⚠ a zero scan count is only as good as this window. Read it before believing it.`)

  const idx = await q(`
    SELECT s.relname AS table, s.indexrelname AS index, s.idx_scan,
           pg_relation_size(s.indexrelid) AS bytes,
           i.indisunique AS is_unique, i.indisprimary AS is_primary,
           EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conindid = s.indexrelid) AS backs_constraint
      FROM pg_stat_user_indexes s JOIN pg_index i ON i.indexrelid = s.indexrelid
     WHERE s.schemaname='public'
     ORDER BY s.idx_scan ASC, pg_relation_size(s.indexrelid) DESC`)
  const unused = idx.filter((r: any) => Number(r.idx_scan) === 0 && !r.is_primary && !r.backs_constraint)
  const unusedBytes = unused.reduce((a: number, r: any) => a + Number(r.bytes), 0)
  console.log(`\n   ${idx.length} indexes total; ${unused.length} with ZERO scans and not backing a PK/constraint`)
  console.log(`   reclaimable if all are genuinely dead: ${GB(unusedBytes)}  (${cost(unusedBytes)})`)
  console.log(`\n   ${'index'.padEnd(44)} ${'table'.padEnd(22)} ${'size'.padStart(9)} ${'scans'.padStart(7)}`)
  for (const r of unused.slice(0, 30)) {
    console.log(`   ${String(r.index).padEnd(44)} ${String(r.table).padEnd(22)} ${MB(r.bytes).padStart(9)} ${String(r.idx_scan).padStart(7)}`)
  }
  if (unused.length > 30) console.log(`   … and ${unused.length - 30} more`)

  console.log(`\n   ⚠ UNIQUE indexes among the unused — these are CONSTRAINTS, not just accelerators.`)
  console.log(`     Dropping one changes what the database will accept, which is not a reclaim decision:`)
  const uniqUnused = unused.filter((r: any) => r.is_unique)
  for (const r of uniqUnused) console.log(`     ${r.index}  (${MB(r.bytes)})  on ${r.table}`)
  if (!uniqUnused.length) console.log(`     (none — every zero-scan index is a plain accelerator)`)

  head('§2.3 — IS THE BODY TEXT IN THE DATABASE?')
  // Find every wide text/tsvector column on the big tables, and its actual on-disk contribution.
  const wide = await q(`
    SELECT c.relname AS table, a.attname AS column, t.typname AS type,
           pg_size_pretty(SUM(pg_column_size(NULL::text))) AS ignore
      FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      JOIN pg_type t ON t.oid=a.atttypid
     WHERE n.nspname='public' AND c.relkind='r'
       AND t.typname IN ('text','tsvector','bytea','json','jsonb','xml')
       AND c.relname IN ('corpus_sections','LegislationSection','OperationalSection','corpus_chunks')
     GROUP BY 1,2,3 ORDER BY 1,2`)
  console.log(`   wide columns on the big tables:`)
  for (const w of wide) console.log(`     ${String(w.table).padEnd(22)} ${String(w.column).padEnd(24)} ${w.type}`)

  console.log(`\n   average bytes per row, measured on a 20k sample (this is where TOAST goes):`)
  for (const [tbl, cols] of [
    ['corpus_sections', ['"xmlPreview"', '"sectionTitle"', '"originalText"']],
    ['"LegislationSection"', ['"originalText"', '"sectionTitle"']],
  ] as const) {
    for (const col of cols) {
      try {
        const [r] = await q(
          `SELECT COUNT(*) FILTER (WHERE ${col} IS NOT NULL)::text AS non_null,
                  COALESCE(AVG(pg_column_size(${col})),0)::int AS avg_bytes,
                  COALESCE(SUM(pg_column_size(${col})),0)::text AS sample_bytes
             FROM (SELECT ${col} FROM ${tbl} LIMIT 20000) s`) as any[]
        console.log(`     ${tbl}.${col}  non-null ${r.non_null}/20000  avg ${r.avg_bytes} B`)
      } catch (e) {
        console.log(`     ${tbl}.${col}  — column does not exist (${(e as Error).message.split('\n')[0]})`)
      }
    }
  }

  head('§2.4 — DEAD SPACE ORDINARY MAINTENANCE COULD RETURN')
  const bloat = await q(`
    SELECT relname AS table, n_live_tup, n_dead_tup,
           CASE WHEN n_live_tup > 0 THEN ROUND(100.0*n_dead_tup/(n_live_tup+n_dead_tup),1) END AS dead_pct,
           last_vacuum::text, last_autovacuum::text, last_analyze::text
      FROM pg_stat_user_tables
     WHERE n_dead_tup > 10000 ORDER BY n_dead_tup DESC LIMIT 12`)
  if (!bloat.length) console.log('   no table carries more than 10,000 dead tuples')
  for (const r of bloat) {
    console.log(`   ${String(r.table).padEnd(24)} live ${String(r.n_live_tup).padStart(10)}  dead ${String(r.n_dead_tup).padStart(9)} (${r.dead_pct ?? '?'}%)`)
    console.log(`      last vacuum ${r.last_vacuum ?? '—'} · autovacuum ${r.last_autovacuum ?? '—'}`)
  }
  console.log(`\n   ⚠ dead tuples are space AUTOVACUUM ALREADY REUSES for new rows. A plain VACUUM does`)
  console.log(`     not return them to the operating system and will NOT shrink the billed figure;`)
  console.log(`     only VACUUM FULL / pg_repack does, and that rewrites the table and needs the room`)
  console.log(`     to do it. Predicting a reclaim from this column is how "expected 800 MB, got 40 MB"`)
  console.log(`     happens (§2's own warning).`)

  await endNeonPool()
}
main().catch((e) => { console.error('[v38-storage-measure] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
