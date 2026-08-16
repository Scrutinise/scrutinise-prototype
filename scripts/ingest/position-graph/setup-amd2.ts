/**
 * setup-amd2.ts — apply position-graph/schema-amd2.sql to Neon, and prove which database it went to.
 *
 * Same shape and the same reason as setup.ts and setup-2d2.ts: docs/CLAUDE.md §16. The host guard is
 * INSIDE the script because a check you have to remember to run is a check that will be skipped.
 *
 * ⚠ The size line here differs from setup-2d2.ts's on purpose. That script printed usage against a
 * "17.5 GiB line". INGEST V38 (16 Aug 2026, docs/V38_STORAGE_REPORT.md) established that 17.5 was an
 * ALERT THRESHOLD that had drifted into being quoted as a ceiling; the enforced ceiling read off the
 * running compute is `neon.max_cluster_size` = 16 TiB. Both numbers are printed here, each labelled
 * as what it is, because the drift happened by one of them losing its label.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/setup-amd2.ts            # print target + size, then apply (idempotent)
 *   npx tsx position-graph/setup-amd2.ts --dry-run  # print target, size and DDL. Applies nothing.
 *   npx tsx position-graph/setup-amd2.ts --verify   # report what exists, change nothing
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const VERIFY_ONLY = argv.includes('--verify')

const TABLES = ['graph_identity_signal', 'graph_identity_signal_evidence', 'graph_identity_baseline']
const VIEWS = ['graph_entity_identity', 'graph_mention']
const FUNCTIONS = ['graph_identity_tier', 'graph_identity_statement', 'graph_identity_caveat']

/** The ops alert threshold. NOT a ceiling — see the header and docs/V38_STORAGE_REPORT.md. */
const ALERT_GIB = 17.5

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
  // Read from pg_settings, which is the route v38-storage-limit.ts proved works and which also
  // returns the UNIT rather than making us assume MB.
  let ceilingGib: number | null = null
  const { rows: gucs } = await pool.query<{ setting: string; unit: string | null }>(
    `SELECT setting, unit FROM pg_settings WHERE name = 'neon.max_cluster_size'`)
  if (gucs.length) {
    const unit = (gucs[0].unit ?? '').trim() || 'MB'
    const raw = Number(gucs[0].setting)
    const mb = unit === 'MB' ? raw : unit === 'kB' ? raw / 1024 : unit === '8kB' ? (raw * 8) / 1024 : NaN
    if (!Number.isNaN(mb)) ceilingGib = mb / 1024
  }

  console.log(`\n════ SIZE ════`)
  console.log(`  database        ${gib.toFixed(2)} GiB`)
  console.log(`  ops ALERT line  ${ALERT_GIB} GiB — ${((100 * gib) / ALERT_GIB).toFixed(1)}% of it`)
  if (ceilingGib) {
    console.log(`  enforced CEILING ${(ceilingGib / 1024).toFixed(0)} TiB (neon.max_cluster_size, read from this compute)`)
    console.log(`                  — ${((100 * gib) / ceilingGib).toFixed(3)}% of it`)
  } else {
    console.log(`  enforced CEILING unreadable from here — not asserted`)
  }
  console.log(`  this DDL adds two small tables, one baseline table, two views and three functions.`)
}

async function verify(pool: ReturnType<typeof getNeonPool>) {
  console.log('\n════ WHAT EXISTS ════')
  for (const t of TABLES) {
    const { rows: [x] } = await pool.query<{ e: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=$1) AS e`, [t])
    if (!x.e) { console.log(`  table    ${t.padEnd(32)} MISSING`); continue }
    const { rows: [c] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${t}`)
    const { rows: [s] } = await pool.query<{ s: string }>(
      `SELECT pg_size_pretty(pg_total_relation_size($1::regclass)) AS s`, [t])
    console.log(`  table    ${t.padEnd(32)} ${String(c.n).padStart(8)} rows  ${s.s}`)
  }
  for (const v of VIEWS) {
    const { rows: [x] } = await pool.query<{ e: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname=$1) AS e`, [v])
    console.log(`  view     ${v.padEnd(32)} ${x.e ? 'present' : 'MISSING'}`)
  }
  for (const f of FUNCTIONS) {
    const { rows: [x] } = await pool.query<{ e: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                       WHERE n.nspname='public' AND p.proname=$1) AS e`, [f])
    console.log(`  function ${f.padEnd(32)} ${x.e ? 'present' : 'MISSING'}`)
  }
}

async function main() {
  const pool = getNeonPool()
  try {
    await whichDb(pool)
    const sql = fs.readFileSync(path.join(__dirname, 'schema-amd2.sql'), 'utf8')
    if (/\bDROP\s+(TABLE|INDEX|DATABASE|SCHEMA)\b/i.test(sql)) {
      console.error('❌ schema-amd2.sql contains a DROP — refusing to run it'); process.exit(1)
    }

    if (VERIFY_ONLY) { await verify(pool); return }
    if (DRY) {
      console.log('\n════ DDL (not applied) ════')
      console.log(sql.split('\n').filter((l) => /^(CREATE|ALTER|COMMENT)/i.test(l.trim())).join('\n'))
      console.log('\n--dry-run: nothing applied.')
      return
    }

    console.log('\n════ APPLYING ════')
    // Strip comment-only lines first: a `;` inside a `--` comment would split a statement in half.
    // ⚠ The `$$`-quoted function bodies contain semicolons only inside the dollar quotes; the split
    // below is on `;` at end-of-line, and every function body here ends `$$;` on its own line, so
    // the naive split is safe for THIS file. A body with a mid-line `;\n` would break it — which is
    // why the statement labels are printed, so a half-statement is visible rather than silent.
    const stripped = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')
    const statements = splitStatements(stripped)
    for (const st of statements) {
      const label = st.replace(/\s+/g, ' ').slice(0, 76)
      try { await pool.query(st); console.log(`  ✓ ${label}`) }
      catch (e) { console.error(`  ✗ ${label}\n      ${(e as Error).message}`); throw e }
    }
    await verify(pool)
    console.log('\nschema applied. graph_identity_signal is EMPTY — that is signal-behaviour.ts.')
  } finally {
    await endNeonPool()
  }
}

/** Split on `;` at end of statement, respecting `$$ … $$` dollar quoting. */
function splitStatements(sql: string): string[] {
  const out: string[] = []
  let buf = ''
  let inDollar = false
  for (const line of sql.split('\n')) {
    // count `$$` occurrences on the line; an odd number toggles the state
    const toggles = (line.match(/\$\$/g) ?? []).length
    buf += line + '\n'
    if (toggles % 2 === 1) inDollar = !inDollar
    if (!inDollar && /;\s*$/.test(line)) { const s = buf.trim(); if (s) out.push(s); buf = '' }
  }
  const tail = buf.trim()
  if (tail) out.push(tail)
  return out
}

main().catch((e) => { console.error('[setup-amd2] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
