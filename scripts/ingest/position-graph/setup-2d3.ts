/**
 * setup-2d3.ts — apply position-graph/schema-2d3.sql to Neon, and prove which database it went to.
 *
 * Same shape and the same reason as setup.ts and setup-2d2.ts: docs/CLAUDE.md §16. The host guard
 * is INSIDE the script because a check you have to remember to run is a check that will be skipped.
 *
 * ⚠ The size line 2D-2 printed against a "17.5 GiB line" is GONE, and deliberately. V38 read
 * `neon.max_cluster_size` off the running compute: the enforced ceiling is 16 TiB and we occupy
 * 0.10% of it. 17.5 was an alert threshold whose label degraded into a ceiling, and reprinting it
 * here would keep a retired number in circulation. The size is still printed — as a size.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/setup-2d3.ts            # print target + size, then apply (idempotent)
 *   npx tsx position-graph/setup-2d3.ts --dry-run  # print target, size and DDL. Applies nothing.
 *   npx tsx position-graph/setup-2d3.ts --verify   # report what exists, change nothing
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const VERIFY_ONLY = argv.includes('--verify')

const TABLES = ['graph_proposition_candidate', 'graph_proposition', 'graph_position',
  'graph_position_review', 'graph_org_register']
const VIEWS = ['graph_holds_position_edge', 'graph_edge_all']

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

  const { rows: [sz] } = await pool.query<{ b: string; ceiling: string | null }>(
    `SELECT pg_database_size(current_database())::text AS b,
            (SELECT setting FROM pg_settings WHERE name='neon.max_cluster_size') AS ceiling`)
  const gib = Number(sz.b) / 1024 ** 3
  console.log(`\n════ SIZE ════`)
  console.log(`  database   ${gib.toFixed(2)} GiB`)
  if (sz.ceiling) {
    const ceilGib = Number(sz.ceiling) / 1024   // the setting is in MB
    console.log(`  ceiling    ${(ceilGib / 1024).toFixed(0)} TiB  (neon.max_cluster_size, read off this compute)`)
    console.log(`  used       ${(100 * gib / ceilGib).toFixed(3)}% of the enforced ceiling`)
  } else {
    console.log(`  ceiling    unreadable from this connection — reported as unknown, not assumed`)
  }
}

async function verify(pool: ReturnType<typeof getNeonPool>) {
  console.log('\n════ WHAT EXISTS ════')
  for (const t of TABLES) {
    const { rows: [x] } = await pool.query<{ e: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=$1) AS e`, [t])
    if (!x.e) { console.log(`  table ${t.padEnd(28)} MISSING`); continue }
    const { rows: [c] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${t}`)
    const { rows: [s] } = await pool.query<{ s: string }>(
      `SELECT pg_size_pretty(pg_total_relation_size($1::regclass)) AS s`, [t])
    console.log(`  table ${t.padEnd(28)} ${String(c.n).padStart(10)} rows  ${s.s}`)
  }
  for (const v of VIEWS) {
    const { rows: [x] } = await pool.query<{ e: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname=$1) AS e`, [v])
    console.log(`  view  ${v.padEnd(28)} ${x.e ? 'present' : 'MISSING'}`)
  }
}

async function main() {
  const pool = getNeonPool()
  try {
    await whichDb(pool)
    const sql = fs.readFileSync(path.join(__dirname, 'schema-2d3.sql'), 'utf8')
    if (/\bDROP\s+(TABLE|INDEX|DATABASE|SCHEMA|VIEW)\b/i.test(sql)) {
      console.error('❌ schema-2d3.sql contains a DROP — refusing to run it'); process.exit(1)
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
    console.log('\nschema applied. Nothing is populated yet — that is derive-propositions.ts,')
    console.log('extract-positions.ts and match-registers.ts.')
  } finally {
    await endNeonPool()
  }
}
main().catch((e) => { console.error('[setup-2d3] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
