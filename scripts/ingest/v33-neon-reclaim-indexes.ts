/**
 * v33-neon-reclaim-indexes.ts — V33 §3a: drop the `corpus_sections` indexes that no reader uses,
 * and make the `notes` index partial. **Index drops only. No column is dropped here.**
 *
 * WHY INDEXES FIRST, and why this order is not arbitrary (`CORPUS_SECTIONS_STORAGE_AUDIT.md`,
 * "How the space actually comes back"):
 *   - `DROP INDEX` unlinks the file, so `pg_database_size` — exactly what `serve-observer.ts`
 *     alerts on — falls straight away.
 *   - `ALTER TABLE … DROP COLUMN` does NOT. It only marks the attribute dropped; the heap and
 *     TOAST bytes stay until the rows are rewritten, and `VACUUM FULL` on a 13.4 GB table wants
 *     room for a second copy of it. **At 95.8% full that could hit the ceiling while trying to
 *     relieve it.** So the `ftsVector` (1,168 MB) and `r2RawKey` (97 MB) column drops are
 *     deliberately NOT in this script; they buy nothing measurable until there is headroom to
 *     repack, and they are irreversible.
 *
 * ⚠ THE AUDIT'S LIST WAS RE-VERIFIED TODAY RATHER THAN TRUSTED, AND ONE ENTRY HAD FLIPPED.
 * `idx_corpus_sections_parent` was recorded at **6 scans** on 7 Aug and is at **26,957** now —
 * the committees work made `parentDocId` a hot path. The audit's "review / medium risk" verdict
 * would have read as droppable. It is not, and it stays. This is what CLAUDE.md §0 is for.
 *
 * Every change here is REVERSIBLE: each dropped index's exact `CREATE INDEX` statement is printed
 * before it goes, and written into the report, so it can be rebuilt verbatim.
 *
 * Usage:
 *   tsx v33-neon-reclaim-indexes.ts            # report the plan and the evidence, change nothing
 *   tsx v33-neon-reclaim-indexes.ts --apply
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { Pool } from 'pg'

export {}

const APPLY = process.argv.includes('--apply')
const CEILING = 17.5 * 1024 ** 3
const gb = (b: number) => (b / 1024 ** 3).toFixed(3)
const n = (v: number) => Number(v).toLocaleString('en-GB')

/** The plan, with the evidence for each decision recorded beside it. */
const PLAN: Array<{ index: string; action: 'drop' | 'partial' | 'keep'; why: string }> = [
  { index: 'corpus_sections_fts', action: 'drop',
    why: 'GIN on the dead `ftsVector`. 0 scans; a repo-wide grep finds NO code reading corpus_sections."ftsVector" (only LegislationSection/OperationalSection); the maintaining trigger function was replaced with a no-op by drop-compiled-text-col.ts, and only 3.8% of rows carry a vector anyway.' },
  { index: 'corpus_sections_format_idx', action: 'drop',
    why: '5 distinct values over 18.3M rows — cannot be selective for any query. 1 recorded scan in a long window, which read ~20M tuples, i.e. a full scan that happened to go through an index.' },
  { index: 'corpus_sections_status_idx', action: 'drop',
    why: '3 distinct values over 18.3M rows. Same argument, 2 recorded scans.' },
  { index: 'corpus_sections_notes_idx', action: 'partial',
    why: '268 distinct values on 48,664 non-null rows — indexing 18.3M rows to find 48k. It does get used (11 scans), so it is REPLACED by a partial index on the same column rather than dropped.' },
  { index: 'idx_corpus_sections_parent', action: 'keep',
    why: '⚠ 26,957 scans (the audit recorded 6). The committees work made parentDocId hot. KEEP.' },
  { index: 'corpus_sections_corpus_idx', action: 'keep', why: '27,965 scans — build and audit passes. KEEP.' },
  { index: 'corpus_sections_pkey', action: 'keep', why: '4.16M scans; the join key to Lance. KEEP.' },
  { index: 'idx_corpus_sections_availability', action: 'keep', why: 'already 3 MB. KEEP.' },
]

const PARTIAL_NAME = 'corpus_sections_notes_partial_idx'

async function measure(p: Pool) {
  const { rows: [d] } = await p.query<{ b: string }>(`SELECT pg_database_size(current_database())::bigint AS b`)
  const { rows: idx } = await p.query<{ indexrelname: string; sz: string; idx_scan: string; def: string }>(
    `SELECT i.indexrelname, pg_relation_size(i.indexrelid)::bigint AS sz, i.idx_scan::bigint,
            pg_get_indexdef(i.indexrelid) AS def
       FROM pg_stat_user_indexes i WHERE i.relname='corpus_sections'
      ORDER BY 2 DESC`)
  const { rows: [t] } = await p.query<{ b: string }>(
    `SELECT pg_total_relation_size('corpus_sections')::bigint AS b`)
  return { db: Number(d.b), table: Number(t.b), idx }
}

async function main() {
  const p = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 3_600_000 })

  // docs/CLAUDE.md §16 — name the database BEFORE any schema-altering SQL, every time.
  const { rows: [who] } = await p.query<{ db: string }>(`SELECT current_database() AS db`)
  const host = (process.env.NEON_DATABASE_URL ?? '').replace(/^.*@/, '').replace(/\/.*$/, '')
  const { rows: mig } = await p.query<{ migration_name: string }>(
    `SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC NULLS LAST LIMIT 5`)
  console.log('── whichdb (CLAUDE.md §16) ──────────────────────────────────────────────────')
  console.log(`  host      ${host}`)
  console.log(`  database  ${who.db}`)
  console.log(`  last 5 migrations: ${mig.map((m) => m.migration_name).join(', ')}`)
  if (!host.includes('neon.tech')) throw new Error('refusing to run: the host is not Neon')

  const before = await measure(p)
  console.log(`\n  Neon ${gb(before.db)} GB = ${((100 * before.db) / CEILING).toFixed(1)}% of the 17.5 GB ceiling`)
  console.log(`  corpus_sections total ${gb(before.table)} GB\n`)

  console.log('── the plan, with today\'s evidence ──────────────────────────────────────────')
  const byName = new Map(before.idx.map((i) => [i.indexrelname, i]))
  let reclaim = 0
  for (const step of PLAN) {
    const live = byName.get(step.index)
    if (!live) { console.log(`  ${step.index.padEnd(36)} ABSENT — nothing to do`); continue }
    const sz = Number(live.sz)
    if (step.action !== 'keep') reclaim += sz
    console.log(`  ${step.action.toUpperCase().padEnd(8)} ${step.index.padEnd(36)} ${gb(sz)} GB  ${n(Number(live.idx_scan))} scans`)
    console.log(`           ${step.why}`)
    if (step.action !== 'keep') console.log(`           rebuild with: ${live.def};`)
  }
  console.log(`\n  reclaim if applied: ~${gb(reclaim)} GB  →  Neon ~${gb(before.db - reclaim)} GB (${((100 * (before.db - reclaim)) / CEILING).toFixed(1)}%)`)

  if (!APPLY) {
    console.log('\n  DRY RUN — nothing changed. Pass --apply to execute.')
    await p.end(); return
  }

  console.log('\n── applying ─────────────────────────────────────────────────────────────────')
  for (const step of PLAN) {
    if (step.action === 'keep' || !byName.has(step.index)) continue
    if (step.action === 'partial') {
      // Build the replacement FIRST so the column is never unindexed, then drop the wide one.
      // CONCURRENTLY cannot run inside a transaction; node-pg autocommits each statement.
      console.log(`  CREATE INDEX CONCURRENTLY ${PARTIAL_NAME} …`)
      await p.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${PARTIAL_NAME} ON corpus_sections (notes) WHERE notes IS NOT NULL`)
      const { rows: [s] } = await p.query<{ b: string }>(`SELECT pg_relation_size('${PARTIAL_NAME}')::bigint AS b`)
      console.log(`    → ${gb(Number(s.b))} GB (was ${gb(Number(byName.get(step.index)!.sz))} GB)`)
    }
    console.log(`  DROP INDEX ${step.index}`)
    await p.query(`DROP INDEX IF EXISTS ${step.index}`)
  }

  const after = await measure(p)
  console.log('\n═══ RESULT ══════════════════════════════════════════════════════════════════')
  console.log(`  Neon before  ${gb(before.db)} GB  (${((100 * before.db) / CEILING).toFixed(1)}%)`)
  console.log(`  Neon after   ${gb(after.db)} GB  (${((100 * after.db) / CEILING).toFixed(1)}%)`)
  console.log(`  reclaimed    ${gb(before.db - after.db)} GB   (predicted ${gb(reclaim)} GB)`)
  console.log(`  corpus_sections ${gb(before.table)} → ${gb(after.table)} GB`)
  console.log('\n  corpus_sections indexes now:')
  for (const i of after.idx) console.log(`    ${i.indexrelname.padEnd(38)} ${gb(Number(i.sz)).padStart(7)} GB  ${n(Number(i.idx_scan)).padStart(10)} scans`)
  await p.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
