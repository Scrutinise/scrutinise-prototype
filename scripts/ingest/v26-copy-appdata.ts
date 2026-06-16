/**
 * v26-copy-appdata.ts — Migration B.1/B.2. Copies the web-app tables Railway→Neon
 * (the only data Neon lacks; Legislation* already synced, ingest infra is
 * Neon-authoritative and untouched). Also baselines _prisma_migrations on Neon.
 *
 * Safe to run as PREP before the cutover gate: the live app still reads Railway
 * until the DATABASE_URL flip (B.5), and prismaSearch reads only Neon's legacy
 * search tables (not these app tables) — so populating Neon's app tables is
 * invisible to the running app and fully reversible (re-run truncates+recopies).
 * Site access is closed, so Railway app data is static (no drift).
 *
 * Mechanics: Neon forbids session_replication_role, so we insert in FK-topological
 * order (parents first) and DELETE in reverse, in one transaction. Self-referencing
 * tables (User/Comment/RootCause — all tiny) are inserted in a single statement so
 * the AFTER-trigger FK check sees all sibling rows. Paginated reads (ctid order,
 * stable in the no-write window). JSON/jsonb values stringified; arrays + timestamps
 * handled by node-pg. IdeaLegislation→LegislationItem resolves against Neon's
 * already-synced LegislationItem.
 *
 *   (default)  dry-run — list copy set + row counts.
 *   --apply    perform the copy.
 */
import { Pool, Client } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

// Neon-authoritative ingest infra + already-synced legislation → never copy back.
const EXCLUDE = new Set([
  'corpus_sections', 'ingest_queue', 'ingest_progress_snapshots', 'specialist_queue',
  'scheduler_lock', 'source_rate_limits', 'corpus_targets', 'corpus_snapshots',
  'ingest_service_state', 'monitor_alerts', 'source_status',
  'LegislationItem', 'LegislationSection', 'LegislationAmendment', 'LegislationCorrection',
  'LegislationCrossRef', 'legislation_compilation_enrichment',
])
// _prisma_migrations is Railway-only → copy it to baseline Neon's migration ledger.

async function main() {
  const apply = process.argv.includes('--apply')
  const rail = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false }, max: 4,
    statement_timeout: 120_000, query_timeout: 120_000, idleTimeoutMillis: 8_000, connectionTimeoutMillis: 15_000 })

  // Build copy set: Railway public tables with rows>0, minus EXCLUDE, plus v26_% filtered out.
  const tlist = (await rail.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'
    AND tablename NOT LIKE 'v26_%' ORDER BY 1`)).rows.map((r: any) => r.tablename) as string[]
  const copySet: { table: string; rows: number }[] = []
  for (const t of tlist) {
    if (EXCLUDE.has(t)) continue
    const n = (await rail.query(`SELECT count(*)::int n FROM "${t}"`)).rows[0].n
    if (n > 0) copySet.push({ table: t, rows: n })
  }
  console.log('=== copy set (Railway → Neon) ===')
  console.table(copySet)
  const totalRows = copySet.reduce((s, c) => s + c.rows, 0)
  console.log(`total: ${copySet.length} tables, ${totalRows} rows`)

  if (!apply) { console.log('\n(dry-run — pass --apply to copy)'); await rail.end(); return }

  // FK-topological insert order (parents first); delete in reverse.
  const INSERT_ORDER = ['_prisma_migrations','Invite','OperationalDocument','User','OperationalSection',
    'CredibilityScore','Feedback','Idea','PlatformConfig','Reputation','AIUsageLog','ActivityLog','CoherentAction',
    'Comment','Diagnosis','Group','GuidingPolicy','IdeaLegislation','IdeaReview','Notification','PointsLedger',
    'Research','RootCause','StageTransition']
  const SELF_REF = new Set(['User', 'Comment', 'RootCause'])
  const inSet = new Map(copySet.map(c => [c.table, c.rows]))
  const order = INSERT_ORDER.filter(t => inSet.has(t))
  const missing = copySet.map(c => c.table).filter(t => !order.includes(t))
  if (missing.length) { console.error('copy-set tables missing from INSERT_ORDER:', missing); process.exit(1) }

  const neon = new Client({ connectionString: process.env.NEON_DATABASE_URL!, ssl: { rejectUnauthorized: false },
    statement_timeout: 300_000, query_timeout: 300_000 })
  await neon.connect()

  async function colsFor(table: string) {
    const colRes = await rail.query(`SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER' ORDER BY ordinal_position`, [table])
    const cols = colRes.rows.map((r: any) => r.column_name) as string[]
    const jsonCols = new Set(colRes.rows.filter((r: any) => r.data_type === 'json' || r.data_type === 'jsonb').map((r: any) => r.column_name))
    return { cols, jsonCols, colSql: cols.map(c => `"${c}"`).join(',') }
  }
  function insertChunk(table: string, cols: string[], jsonCols: Set<string>, colSql: string, chunk: any[]) {
    const values: string[] = []; const params: unknown[] = []
    chunk.forEach((row, ri) => {
      const ph = cols.map((c, ci) => {
        let v = row[c]; if (v !== null && jsonCols.has(c)) v = JSON.stringify(v)
        params.push(v); return `$${ri * cols.length + ci + 1}`
      })
      values.push(`(${ph.join(',')})`)
    })
    return neon.query(`INSERT INTO "${table}" (${colSql}) VALUES ${values.join(',')}`, params)
  }

  // _prisma_migrations is Railway-only — create the standard Prisma ledger table on Neon first.
  await neon.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    id varchar(36) PRIMARY KEY,
    checksum varchar(64) NOT NULL,
    finished_at timestamptz,
    migration_name varchar(255) NOT NULL,
    logs text,
    rolled_back_at timestamptz,
    started_at timestamptz NOT NULL DEFAULT now(),
    applied_steps_count integer NOT NULL DEFAULT 0
  )`)

  await neon.query('BEGIN')
  try {
    // delete in reverse FK order (children first) for idempotency
    for (const table of [...order].reverse()) await neon.query(`DELETE FROM "${table}"`)

    for (const table of order) {
      const rows = inSet.get(table)!
      const { cols, jsonCols, colSql } = await colsFor(table)
      let copied = 0
      const PAGE = 2000
      const allRows: any[] = []
      for (let off = 0; off < rows; off += PAGE) {
        const page = await rail.query(`SELECT ${colSql} FROM "${table}" ORDER BY ctid LIMIT ${PAGE} OFFSET ${off}`)
        if (page.rows.length === 0) break
        allRows.push(...page.rows)
      }
      if (SELF_REF.has(table)) {
        // single statement so the FK trigger sees all sibling rows at once
        if (allRows.length) { await insertChunk(table, cols, jsonCols, colSql, allRows); copied = allRows.length }
      } else {
        const CH = 500
        for (let i = 0; i < allRows.length; i += CH) {
          await insertChunk(table, cols, jsonCols, colSql, allRows.slice(i, i + CH))
          copied += Math.min(CH, allRows.length - i)
        }
      }
      console.log(`  ${table}: copied ${copied}/${rows}`)
    }
    await neon.query('COMMIT')
  } catch (e) {
    await neon.query('ROLLBACK')
    console.error('copy failed — rolled back:', e)
    process.exit(1)
  }

  // verify
  console.log('\n=== verify Neon counts vs Railway ===')
  const verify: { table: string; railway: number; neon: number; ok: boolean }[] = []
  for (const { table, rows } of copySet) {
    const nn = (await neon.query(`SELECT count(*)::int n FROM "${table}"`)).rows[0].n
    verify.push({ table, railway: rows, neon: nn, ok: rows === nn })
  }
  console.table(verify)
  console.log(verify.every(v => v.ok) ? '✓ all tables match' : '⚠ MISMATCH present')

  await neon.end(); await rail.end()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
