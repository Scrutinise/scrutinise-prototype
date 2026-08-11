/**
 * setup.ts — apply position-graph/schema.sql to Neon, and prove which database it went to.
 *
 * ⚠ docs/CLAUDE.md §16 is why the check is INSIDE this script rather than a thing to remember: on
 * 29–30 Jul two migrations were applied to a stale Railway URL, both reported success, and
 * production fell behind silently until dependent code threw P2021 and took /dashboard down. A
 * check you have to remember to run is a check that will be skipped at 3am.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/setup.ts            # print the target, then apply (idempotent)
 *   npx tsx position-graph/setup.ts --dry-run  # print the target and the DDL. Applies nothing.
 *   npx tsx position-graph/setup.ts --verify   # report what exists, change nothing
 *
 * Every statement is CREATE TABLE / CREATE INDEX IF NOT EXISTS, so a second run is a no-op. There
 * is no DROP anywhere in this file or in schema.sql, deliberately: a teardown belongs in a script
 * somebody has to type on purpose.
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const VERIFY_ONLY = argv.includes('--verify')

const TABLES = ['graph_entity', 'graph_alias', 'graph_edge', 'graph_evidence', 'graph_merge_log']

/** The §16 check, run before anything is written and printed whether or not it is asked for. */
async function whichDb(pool: ReturnType<typeof getNeonPool>) {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL ?? ''
  const host = /@([^/:?]+)/.exec(url)?.[1] ?? '(could not parse)'
  const { rows: [who] } = await pool.query<{ db: string; usr: string; v: string }>(
    `SELECT current_database() AS db, current_user AS usr, version() AS v`)
  console.log('════ WHICH DATABASE ════')
  console.log(`  host (from the connection string)  ${host}`)
  console.log(`  current_database()                 ${who.db}`)
  console.log(`  current_user                       ${who.usr}`)
  console.log(`  server                             ${who.v.split(' ').slice(0, 2).join(' ')}`)
  let migrations: Array<{ migration_name: string; finished_at: Date | null }> = []
  try {
    const { rows } = await pool.query<{ migration_name: string; finished_at: Date | null }>(
      `SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC NULLS LAST LIMIT 5`)
    migrations = rows
  } catch (e) { console.log(`  _prisma_migrations                 unreadable — ${(e as Error).message}`) }
  for (const m of migrations) console.log(`    ${m.finished_at ? new Date(m.finished_at).toISOString().slice(0, 19) + 'Z' : 'unfinished'}  ${m.migration_name}`)
  // The one host this may target. Anything else is the 30 Jul incident happening again.
  if (!/ep-old-dust-aboxi69a/.test(host)) {
    console.error(`\n  ❌ this is not the Neon production host recorded in docs/CLAUDE.md §16 (ep-old-dust-aboxi69a).`)
    console.error(`     Refusing to apply DDL. If the host has legitimately changed, change it here on purpose.`)
    process.exit(1)
  }
  console.log('  ✓ Neon production, as recorded in docs/CLAUDE.md §16')
}

async function verify(pool: ReturnType<typeof getNeonPool>) {
  console.log('\n════ WHAT EXISTS ════')
  for (const t of TABLES) {
    const { rows: [x] } = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=$1) AS exists`, [t])
    if (!x.exists) { console.log(`  ${t.padEnd(18)} MISSING`); continue }
    const { rows: [c] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${t}`)
    const { rows: cols } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [t])
    console.log(`  ${t.padEnd(18)} ${String(c.n).padStart(9)} rows, ${cols.length} columns`)
  }
  const { rows: idx } = await pool.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename LIKE 'graph_%' ORDER BY 1`)
  console.log(`  indexes: ${idx.map((i) => i.indexname).join(', ') || '(none)'}`)
}

async function main() {
  const pool = getNeonPool()
  try {
    await whichDb(pool)
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
    if (/\bDROP\b/i.test(sql)) { console.error('❌ schema.sql contains DROP — refusing to run it'); process.exit(1) }

    if (VERIFY_ONLY) { await verify(pool); return }
    if (DRY) {
      console.log('\n════ DDL (not applied) ════')
      console.log(sql.split('\n').filter((l) => /^(CREATE|ALTER)/i.test(l.trim())).join('\n'))
      console.log('\n--dry-run: nothing applied.')
      return
    }

    console.log('\n════ APPLYING ════')
    // One statement at a time, so a failure names the statement that failed rather than the file.
    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
      .filter((s) => s.length > 0)
    for (const st of statements) {
      const label = st.replace(/\s+/g, ' ').slice(0, 76)
      try {
        await pool.query(st)
        console.log(`  ✓ ${label}`)
      } catch (e) {
        console.error(`  ✗ ${label}\n      ${(e as Error).message}`)
        throw e
      }
    }
    await verify(pool)
    console.log('\nschema applied. Nothing is populated yet — that is sweep-committees.ts and sweep-interests.ts.')
  } finally {
    await endNeonPool()
  }
}
main().catch((e) => { console.error('[setup] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
