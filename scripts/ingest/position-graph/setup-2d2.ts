/**
 * setup-2d2.ts — apply position-graph/schema-2d2.sql to Neon, and prove which database it went to.
 *
 * Same shape and the same reason as setup.ts: docs/CLAUDE.md §16. The host guard is INSIDE the
 * script because a check you have to remember to run is a check that will be skipped at 3am.
 *
 * It also prints the database's SIZE and the headroom to the 17.5 GiB line before applying, because
 * this sprint's central finding is a storage one and the number should be on the record of every
 * run rather than in a report nobody re-reads.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/setup-2d2.ts            # print target + size, then apply (idempotent)
 *   npx tsx position-graph/setup-2d2.ts --dry-run  # print target, size and DDL. Applies nothing.
 *   npx tsx position-graph/setup-2d2.ts --verify   # report what exists, change nothing
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const VERIFY_ONLY = argv.includes('--verify')

const TABLES = ['graph_member_register', 'graph_member_name', 'edm_sponsor']
const VIEWS = ['graph_voted_edge', 'graph_signed_motion_edge', 'graph_edge_all']
/** The documented Neon ceiling. GiB, matching the convention of the 15.93/17.5 alert already on record. */
const LINE_GIB = 17.5

async function whichDb(pool: ReturnType<typeof getNeonPool>) {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL ?? ''
  const host = /@([^/:?]+)/.exec(url)?.[1] ?? '(could not parse)'
  const { rows: [who] } = await pool.query<{ db: string; usr: string }>(
    `SELECT current_database() AS db, current_user AS usr`)
  console.log('════ WHICH DATABASE ════')
  console.log(`  host              ${host}`)
  console.log(`  current_database  ${who.db}`)
  console.log(`  current_user      ${who.usr}`)
  if (!/ep-old-dust-aboxi69a/.test(host)) {
    console.error(`\n  ❌ not the Neon production host recorded in docs/CLAUDE.md §16 (ep-old-dust-aboxi69a). Refusing.`)
    process.exit(1)
  }
  console.log('  ✓ Neon production, as recorded in docs/CLAUDE.md §16')

  const { rows: [sz] } = await pool.query<{ b: string }>(`SELECT pg_database_size(current_database())::text AS b`)
  const gib = Number(sz.b) / 1024 ** 3
  const pct = (100 * gib / LINE_GIB)
  console.log(`\n════ SIZE ════`)
  console.log(`  database   ${gib.toFixed(2)} GiB of the ${LINE_GIB} GiB line = ${pct.toFixed(1)}%`)
  console.log(`  headroom   ${(LINE_GIB - gib).toFixed(2)} GiB`)
  if (pct >= 90) console.log(`  ⚠ ABOVE THE 90% CRITICAL THRESHOLD. This DDL adds three small tables and three views;`)
  if (pct >= 90) console.log(`    the 2.21 GiB that §1's edges would have cost is exactly why they are a view.`)
}

async function verify(pool: ReturnType<typeof getNeonPool>) {
  console.log('\n════ WHAT EXISTS ════')
  for (const t of TABLES) {
    const { rows: [x] } = await pool.query<{ e: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=$1) AS e`, [t])
    if (!x.e) { console.log(`  table ${t.padEnd(24)} MISSING`); continue }
    const { rows: [c] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${t}`)
    const { rows: [s] } = await pool.query<{ s: string }>(
      `SELECT pg_size_pretty(pg_total_relation_size($1::regclass)) AS s`, [t])
    console.log(`  table ${t.padEnd(24)} ${String(c.n).padStart(10)} rows  ${s.s}`)
  }
  for (const v of VIEWS) {
    const { rows: [x] } = await pool.query<{ e: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname=$1) AS e`, [v])
    console.log(`  view  ${v.padEnd(24)} ${x.e ? 'present' : 'MISSING'}`)
  }
}

async function main() {
  const pool = getNeonPool()
  try {
    await whichDb(pool)
    const sql = fs.readFileSync(path.join(__dirname, 'schema-2d2.sql'), 'utf8')
    if (/\bDROP\s+(TABLE|INDEX|DATABASE|SCHEMA)\b/i.test(sql)) {
      console.error('❌ schema-2d2.sql contains a DROP — refusing to run it'); process.exit(1)
    }

    if (VERIFY_ONLY) { await verify(pool); return }
    if (DRY) {
      console.log('\n════ DDL (not applied) ════')
      console.log(sql.split('\n').filter((l) => /^(CREATE|ALTER)/i.test(l.trim())).join('\n'))
      console.log('\n--dry-run: nothing applied.')
      return
    }

    console.log('\n════ APPLYING ════')
    // Strip comment-only lines first: a `;` inside a `--` comment would split a statement in half.
    const stripped = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')
    const statements = stripped.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean)
    for (const st of statements) {
      const label = st.replace(/\s+/g, ' ').slice(0, 76)
      try { await pool.query(st); console.log(`  ✓ ${label}`) }
      catch (e) { console.error(`  ✗ ${label}\n      ${(e as Error).message}`); throw e }
    }
    await verify(pool)
    console.log('\nschema applied. Nothing is populated yet — that is sweep-members.ts and sweep-edm-sponsors.ts.')
  } finally {
    await endNeonPool()
  }
}
main().catch((e) => { console.error('[setup-2d2] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
