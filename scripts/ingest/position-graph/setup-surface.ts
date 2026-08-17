/**
 * setup-surface.ts — apply position-graph/schema-surface.sql to Neon, and prove which database it
 * went to (docs/CLAUDE.md §16). Same shape as setup-amd2.ts, and the host guard is INSIDE the
 * script for the same reason: a check you have to remember to run is a check that will be skipped.
 *
 * What this DDL does: adds `subject_surface` to graph_edge and graph_evidence (plus a
 * `subject_surface_varies` flag on the edge), and recreates four views so the surface reaches
 * `graph_mention`. It adds no table, rewrites no row, and drops nothing.
 *
 * ⚠ IT IS NOT A NO-OP FOR DISPLAY. `graph_mention.display_name` currently always shows the entity's
 * canonical name; after this it shows the recorded surface WHERE ONE EXISTS. That is the intended
 * change (BRIEF_INGEST_CORPUS_FRESHNESS §2) and `verify-surface.ts` is what proves it did not become
 * a licence to show a surface we do not hold.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/setup-surface.ts            # print target + size, then apply (idempotent)
 *   npx tsx position-graph/setup-surface.ts --dry-run  # print target, size and DDL. Applies nothing.
 *   npx tsx position-graph/setup-surface.ts --verify   # report what exists, change nothing
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const VERIFY_ONLY = argv.includes('--verify')

const COLUMNS: Array<[string, string]> = [
  ['graph_edge', 'subject_surface'],
  ['graph_edge', 'subject_surface_varies'],
  ['graph_evidence', 'subject_surface'],
]
const VIEWS = ['graph_voted_edge', 'graph_signed_motion_edge', 'graph_edge_all', 'graph_mention']

/** The ops alert threshold. NOT a ceiling — see setup-amd2.ts and docs/V38_STORAGE_REPORT.md. */
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
  console.log(`\n════ SIZE ════`)
  console.log(`  database        ${gib.toFixed(2)} GiB`)
  console.log(`  ops ALERT line  ${ALERT_GIB} GiB — ${((100 * gib) / ALERT_GIB).toFixed(1)}% of it`)
  console.log(`  this DDL adds three nullable/defaulted columns and recreates four views.`)
  console.log(`  ⚠ ADD COLUMN with a non-volatile DEFAULT does not rewrite the table on PG 11+,`)
  console.log(`    so the 164,131-row graph_edge is not rewritten by the boolean's DEFAULT FALSE.`)
}

async function verify(pool: ReturnType<typeof getNeonPool>) {
  console.log('\n════ WHAT EXISTS ════')
  for (const [table, col] of COLUMNS) {
    const { rows: [x] } = await pool.query<{ t: string | null }>(
      `SELECT data_type AS t FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2`, [table, col])
    console.log(`  column  ${`${table}.${col}`.padEnd(38)} ${x?.t ?? 'MISSING'}`)
  }
  for (const v of VIEWS) {
    const { rows: [x] } = await pool.query<{ e: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname=$1) AS e`, [v])
    if (!x.e) { console.log(`  view    ${v.padEnd(38)} MISSING`); continue }
    const { rows: [c] } = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM information_schema.columns WHERE table_name = $1 AND column_name = 'subject_surface'`, [v])
    console.log(`  view    ${v.padEnd(38)} present${Number(c.n) ? ' · carries subject_surface' : ''}`)
  }
  // How much of the graph can now say "the name as it appeared" — the number this DDL exists to move.
  const { rows: [cov] } = await pool.query<{ total: string; withSurface: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(subject_surface)::text AS "withSurface"
       FROM graph_edge_all`)
  const pct = (100 * Number(cov.withSurface)) / Math.max(1, Number(cov.total))
  console.log(`\n  mentions carrying a recorded surface: ${Number(cov.withSurface).toLocaleString()} / ${Number(cov.total).toLocaleString()} (${pct.toFixed(1)}%)`)
}

async function main() {
  const pool = getNeonPool()
  try {
    await whichDb(pool)
    const sql = fs.readFileSync(path.join(__dirname, 'schema-surface.sql'), 'utf8')
    if (/\bDROP\s+(TABLE|INDEX|DATABASE|SCHEMA|COLUMN)\b/i.test(sql)) {
      console.error('❌ schema-surface.sql contains a DROP — refusing to run it'); process.exit(1)
    }

    if (VERIFY_ONLY) { await verify(pool); return }
    if (DRY) {
      console.log('\n════ DDL (not applied) ════')
      console.log(sql.split('\n').filter((l) => /^(CREATE|ALTER|COMMENT)/i.test(l.trim())).join('\n'))
      console.log('\n--dry-run: nothing applied.')
      return
    }

    console.log('\n════ APPLYING ════')
    const stripped = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')
    for (const st of splitStatements(stripped)) {
      const label = st.replace(/\s+/g, ' ').slice(0, 76)
      try { await pool.query(st); console.log(`  ✓ ${label}`) }
      catch (e) { console.error(`  ✗ ${label}\n      ${(e as Error).message}`); throw e }
    }
    await verify(pool)
    console.log('\nschema applied. graph_edge.subject_surface is NULL on every existing row until')
    console.log('the sweeps are re-run — which is a fact about coverage, not a defect. It is what')
    console.log('`surface_is_per_entity` reports, per mention, rather than being papered over.')
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
    const toggles = (line.match(/\$\$/g) ?? []).length
    buf += line + '\n'
    if (toggles % 2 === 1) inDollar = !inDollar
    if (!inDollar && /;\s*$/.test(line)) { const s = buf.trim(); if (s) out.push(s); buf = '' }
  }
  const tail = buf.trim()
  if (tail) out.push(tail)
  return out
}

main().catch((e) => { console.error('[setup-surface] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
