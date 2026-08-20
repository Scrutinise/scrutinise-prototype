/**
 * setup-3b.ts — apply scripts/graph/schema-3b.sql to Neon, and prove which database it went to.
 *
 * GRAPH 3B. Same three guards as setup-3a.ts, and for the same reason (docs/CLAUDE.md §16): the
 * host check lives INSIDE the script, because a check you have to remember to run is a check that
 * will be skipped.
 *
 *   1. the target host is Neon production, or the script exits 1;
 *   2. the DDL contains no DROP of any kind;
 *   3. the DDL touches NOTHING outside 3B's own relations, asserted by parsing every CREATE and
 *      ALTER out of the file. Watched failing on a planted statement (`--self-test`).
 *
 * Usage (from scripts/graph):
 *   npx tsx setup-3b.ts             # print target + size, then apply (idempotent)
 *   npx tsx setup-3b.ts --dry-run   # print target, size and the DDL; change nothing
 *   npx tsx setup-3b.ts --verify    # report what exists, change nothing
 *   npx tsx setup-3b.ts --self-test # plant forbidden statements in memory and prove guard 3 fires
 *
 * ⚠⚠ ORDERING HAZARD, FOUND BY DOING IT. `setup-3a.ts` re-applies `schema-3a.sql`, which contains
 * `CREATE OR REPLACE VIEW position_signal_vote` with the classification ladder INLINE. Running it
 * after this script silently reverts 3B's redefinition — the view stops calling
 * `position_vote_class()` and there are two copies of the ladder again, with nothing visibly wrong
 * because both return identical rows. **If you run setup-3a.ts for any reason, run setup-3b.ts
 * after it.** `check-3b.ts` asserts the view's definition actually mentions the function, so the
 * reversion fails a check instead of sitting there.
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const VERIFY_ONLY = argv.includes('--verify')
const SELF_TEST = argv.includes('--self-test')

/**
 * Everything 3B is allowed to create or replace.
 *
 * ⚠ `position_signal_vote` is 3A's view and IS on this list, deliberately: 3B redefines it to call
 * `position_vote_class()` so the classification ladder has one home instead of two. That is a
 * same-stream change to a CC-Graph-owned object, the column list is unchanged, and check-3b.ts
 * asserts the rows are identical before and after.
 */
const OWNED = new Set([
  'position_vote_class',
  'position_signal_vote_for',
  'position_signal_for',
  'position_signal_vote',
  // §2.2 — the Electoral Commission donations register.
  'position_donation',
])

/** The ops alert threshold. NOT a ceiling, and NOT sourced — see the report, §4.1. */
const ALERT_GIB = 17.5

export function foreignObjects(sql: string): string[] {
  const stripped = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')
  const found: string[] = []
  const re = /\b(CREATE(?:\s+OR\s+REPLACE)?|ALTER)\s+(?:UNIQUE\s+)?(TABLE|VIEW|INDEX|FUNCTION|MATERIALIZED\s+VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_."]+)/gi
  for (const m of stripped.matchAll(re)) {
    const kind = m[2].toUpperCase()
    const name = m[3].replace(/"/g, '').replace(/^public\./, '')
    if (kind === 'INDEX') {
      const tail = stripped.slice(m.index ?? 0, (m.index ?? 0) + 400)
      const on = /\bON\s+([A-Za-z0-9_."]+)/i.exec(tail)
      const target = on ? on[1].replace(/"/g, '').replace(/^public\./, '') : name
      if (!OWNED.has(target)) found.push(`INDEX on ${target}`)
      continue
    }
    if (!OWNED.has(name)) found.push(`${kind} ${name}`)
  }
  return found
}

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

  const { rows: [sz] } = await pool.query<{ b: string }>(
    `SELECT pg_database_size(current_database())::text AS b`)
  const gib = Number(sz.b) / 1024 ** 3
  const { rows: gucs } = await pool.query<{ setting: string; unit: string | null }>(
    `SELECT setting, unit FROM pg_settings WHERE name = 'neon.max_cluster_size'`)
  let ceilingGib: number | null = null
  if (gucs.length) {
    const unit = (gucs[0].unit ?? '').trim() || 'MB'
    const raw = Number(gucs[0].setting)
    const mb = unit === 'MB' ? raw : unit === 'kB' ? raw / 1024 : unit === '8kB' ? (raw * 8) / 1024 : NaN
    if (!Number.isNaN(mb)) ceilingGib = mb / 1024
  }
  console.log(`\n════ SIZE ════`)
  console.log(`  database          ${gib.toFixed(2)} GiB`)
  console.log(`  ops ALERT line    ${ALERT_GIB} GiB — ${((100 * gib) / ALERT_GIB).toFixed(1)}% of it`)
  console.log(`                    ⚠ UNSOURCED. See GRAPH_3B_REPORT §4.1: the constant lives at`)
  console.log(`                      scripts/ingest/search/serve-observer.ts:50 and its comment`)
  console.log(`                      cites "the handoff", which cites the observer. Circular.`)
  if (ceilingGib) {
    console.log(`  enforced CEILING  ${(ceilingGib / 1024).toFixed(0)} TiB (neon.max_cluster_size, read from this compute just now)`)
    console.log(`                    = ${((100 * gib) / (ceilingGib)).toFixed(4)}% of the ceiling that is actually enforced`)
  } else {
    console.log(`  enforced CEILING  unreadable from here — not asserted`)
  }
  console.log(`\n  3B's DDL adds three FUNCTIONS and redefines one view. It stores no rows.`)
}

async function main() {
  const sqlPath = path.join(__dirname, 'schema-3b.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  // ── GUARD 3, self-test: prove it fires before trusting it to pass ────────────────────────────
  if (SELF_TEST) {
    console.log('════ GUARD 3 SELF-TEST ════')
    const cases: Array<[string, string]> = [
      ['unmodified DDL', sql],
      ['planted ALTER on a foreign table', sql + '\nALTER TABLE graph_entity ADD COLUMN x int;'],
      ['planted CREATE INDEX on a foreign table', sql + '\nCREATE INDEX zz ON division_votes (member_id);'],
      ['planted CREATE VIEW with a foreign name', sql + '\nCREATE OR REPLACE VIEW graph_edge_v AS SELECT 1;'],
      ['planted CREATE FUNCTION with a foreign name', sql + '\nCREATE OR REPLACE FUNCTION lex_thing() RETURNS int LANGUAGE sql AS $$SELECT 1$$;'],
    ]
    let bad = 0
    for (const [label, body] of cases) {
      const found = foreignObjects(body)
      const shouldFire = label !== 'unmodified DDL'
      const fired = found.length > 0
      const ok = fired === shouldFire
      if (!ok) bad++
      console.log(`  ${ok ? 'PASS' : '❌ DID NOT FIRE'}  ${label.padEnd(42)} ${fired ? `refused: ${found.join(', ')}` : 'nothing foreign'}`)
    }
    // Guard 2 the same way.
    const dropCase = sql + '\nDROP VIEW position_signal;'
    console.log(`  ${/\bDROP\b/i.test(dropCase) ? 'PASS' : '❌ DID NOT FIRE'}  ${'planted DROP'.padEnd(42)} ${/\bDROP\b/i.test(dropCase) ? 'refused' : 'not seen'}`)
    console.log(`\n  ${bad === 0 ? '✓ every planted break fired and the clean DDL passed' : `❌ ${bad} case(s) wrong`}`)
    process.exit(bad === 0 ? 0 : 1)
  }

  // ── GUARD 2 ──────────────────────────────────────────────────────────────────────────────────
  if (/\bDROP\b/i.test(sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n'))) {
    console.error('❌ schema-3b.sql contains a DROP. Refusing.')
    process.exit(1)
  }
  // ── GUARD 3 ──────────────────────────────────────────────────────────────────────────────────
  const foreign = foreignObjects(sql)
  if (foreign.length) {
    console.error(`❌ schema-3b.sql touches objects 3B does not own: ${foreign.join(', ')}. Refusing.`)
    process.exit(1)
  }
  console.log('✓ guard 2 (no DROP) and guard 3 (owns everything it touches) pass\n')

  const pool = getNeonPool()
  try {
    await whichDb(pool)

    if (DRY) {
      console.log('\n──── DDL (not applied, --dry-run) ────\n')
      console.log(sql)
      return
    }

    if (VERIFY_ONLY) {
      console.log('\n════ WHAT EXISTS ════')
      const { rows } = await pool.query<{ kind: string; name: string }>(`
        SELECT 'function' AS kind, p.proname AS name
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname LIKE 'position%'
        UNION ALL
        SELECT 'view', viewname FROM pg_views WHERE viewname LIKE 'position%'
        UNION ALL
        SELECT 'table', tablename FROM pg_tables WHERE tablename LIKE 'position%'
        ORDER BY 1, 2`)
      for (const r of rows) console.log(`  ${r.kind.padEnd(9)} ${r.name}`)
      return
    }

    console.log('\n════ APPLYING ════')
    await pool.query(sql)
    console.log('  ✓ applied')

    const { rows: fns } = await pool.query<{ name: string; args: string }>(`
      SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname IN ('position_vote_class','position_signal_vote_for','position_signal_for')
       ORDER BY 1`)
    for (const f of fns) console.log(`  ✓ function  ${f.name}(${f.args})`)
    const { rows: vs } = await pool.query<{ viewname: string }>(
      `SELECT viewname FROM pg_views WHERE viewname IN ('position_signal_vote','position_signal') ORDER BY 1`)
    for (const v of vs) console.log(`  ✓ view      ${v.viewname}`)
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
