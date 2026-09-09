/**
 * setup-edm-signatures.ts — apply position-graph/schema-edm-signatures.sql to Neon, and prove which
 * database it went to.
 *
 * Same shape and the same reason as setup-2d2.ts: docs/CLAUDE.md §16. The host guard is INSIDE the
 * script because a check you have to remember to run is a check that will be skipped at 3am.
 *
 * ⚠ THE "17.5 GiB ops ALERT line" THAT setup-2d2.ts PRINTS IS NOT PRINTED HERE, and that is
 * deliberate rather than an omission. GRAPH 3C §5 retired it: it was never a plan limit (the
 * enforced ceiling is `neon.max_cluster_size`, read from the compute below), its only citation was
 * itself, and the database passed it during 3B — so a script printing "headroom −3.59 GiB" against
 * it would be raising a CRITICAL alert against a fiction. Storage on the Launch plan is
 * usage-priced, so the honest number is a COST, and that is what prints.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/setup-edm-signatures.ts            # print target + size, then apply
 *   npx tsx position-graph/setup-edm-signatures.ts --dry-run  # print target, size and DDL only
 *   npx tsx position-graph/setup-edm-signatures.ts --verify   # report what exists, change nothing
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const VERIFY_ONLY = argv.includes('--verify')

const TABLES = ['edm_signatory_fetch', 'edm_signatory']
const VIEWS = ['graph_edm_signature_edge', 'graph_edm_signature_edge_all', 'edm_signature_reconciliation']
/** GRAPH 3C §5, setup-3c.ts. $/GB-month, and the date it was checked, quoted not guessed. */
const USD_PER_GB_MONTH = 0.35
const PRICE_CHECKED = '2026-08-21 (BRIEF_GRAPH_3C.md §5, Neon console, Launch plan)'

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
  console.log(`\n════ SIZE, AS A COST ════`)
  console.log(`  database          ${gib.toFixed(2)} GiB  =  $${((Number(sz.b) / 1e9) * USD_PER_GB_MONTH).toFixed(2)}/month`)
  console.log(`  price checked     ${PRICE_CHECKED}`)
  try {
    // ⚠ `SHOW x` names its own column after the setting, so `rows[0].s` is undefined and prints
    // "undefined" as though the ceiling were unreadable. pg_settings gives a column we can name.
    const { rows: [c] } = await pool.query<{ setting: string; unit: string | null }>(
      `SELECT setting, unit FROM pg_settings WHERE name = 'neon.max_cluster_size'`)
    console.log(c
      ? `  enforced CEILING  ${c.setting}${c.unit ? ' ' + c.unit : ''} (neon.max_cluster_size, read from this compute)`
      : `  enforced CEILING  not exposed by this compute — not asserted`)
  } catch {
    console.log(`  enforced CEILING  unreadable from here — not asserted`)
  }
}

async function verify(pool: ReturnType<typeof getNeonPool>) {
  console.log('\n════ WHAT EXISTS ════')
  for (const t of TABLES) {
    const { rows: [x] } = await pool.query<{ e: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=$1) AS e`, [t])
    if (!x.e) { console.log(`  table ${t.padEnd(30)} MISSING`); continue }
    const { rows: [c] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${t}`)
    const { rows: [s] } = await pool.query<{ s: string }>(
      `SELECT pg_size_pretty(pg_total_relation_size($1::regclass)) AS s`, [t])
    console.log(`  table ${t.padEnd(30)} ${Number(c.n).toLocaleString().padStart(11)} rows  ${s.s}`)
  }
  for (const v of VIEWS) {
    const { rows: [x] } = await pool.query<{ e: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname=$1) AS e`, [v])
    console.log(`  view  ${v.padEnd(30)} ${x.e ? 'present' : 'MISSING'}`)
  }
  // The 2D-2 view this sprint deliberately does NOT touch, proved untouched rather than assumed so.
  const { rows: [old] } = await pool.query<{ e: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='graph_signed_motion_edge') AS e`)
  console.log(`  view  ${'graph_signed_motion_edge'.padEnd(30)} ${old.e ? 'present (2D-2, unchanged by this DDL)' : '❌ MISSING'}`)
}

async function main() {
  const pool = getNeonPool()
  try {
    await whichDb(pool)
    const sql = fs.readFileSync(path.join(__dirname, 'schema-edm-signatures.sql'), 'utf8')
    if (/\bDROP\s+(TABLE|INDEX|VIEW|DATABASE|SCHEMA)\b/i.test(sql)) {
      console.error('❌ schema-edm-signatures.sql contains a DROP — refusing to run it'); process.exit(1)
    }
    // ⚠ Guard against this DDL reaching outside the tables this sprint owns. The graph's own
    // objects (position_signal*, graph_signed_motion_edge, graph_edge_all, graph_mention) are
    // CC-Graph's, and redefining one from an ingest script is how a later setup-3b/3c run silently
    // reverts it — the drift setup-3c.ts's own guard exists to catch, from the other side.
    const OWNED = new Set([...TABLES, ...VIEWS])
    const created = [...sql.matchAll(/^\s*CREATE(?:\s+OR\s+REPLACE)?\s+(?:TABLE(?:\s+IF\s+NOT\s+EXISTS)?|VIEW|INDEX(?:\s+IF\s+NOT\s+EXISTS)?)\s+([a-z_0-9]+)/gim)]
      .map((m) => m[1])
    const foreign = created.filter((o) => !OWNED.has(o) && !o.startsWith('edm_signatory'))
    if (foreign.length) {
      console.error(`❌ this DDL creates or replaces objects this sprint does not own: ${[...new Set(foreign)].join(', ')}`)
      process.exit(1)
    }
    console.log(`\n  ✓ every object created or replaced is one of this sprint's own (${created.length} statements checked)`)

    if (VERIFY_ONLY) { await verify(pool); return }
    if (DRY) {
      console.log('\n════ DDL (not applied) ════')
      console.log(sql.split('\n').filter((l) => /^(CREATE|ALTER|COMMENT)/i.test(l.trim())).join('\n'))
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
    console.log('\nschema applied. Nothing is populated yet — that is sweep-edm-signatures.ts.')
  } finally {
    await endNeonPool()
  }
}
main().catch((e) => { console.error('[setup-edm-signatures] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
