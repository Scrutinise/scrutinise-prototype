/**
 * setup-3a.ts — apply scripts/graph/schema-3a.sql to Neon, and prove which database it went to.
 *
 * GRAPH 3A §2. Same shape and the same reason as position-graph/setup-2d2.ts and setup-amd2.ts:
 * docs/CLAUDE.md §16. The host guard is INSIDE the script because a check you have to remember to
 * run is a check that will be skipped.
 *
 * Three guards run before a statement is executed, and each can fail:
 *   1. the target host is Neon production, or the script exits 1;
 *   2. the DDL contains no DROP of any kind;
 *   3. the DDL touches NOTHING outside 3A's own relations — asserted by parsing every CREATE and
 *      ALTER out of the file and checking the name against the allow-list below. This is the check
 *      the brief asks for ("no ALTER/DROP of anything outside these tables — asserted by a check,
 *      like 25-A's"), and it has been watched failing on a planted `ALTER TABLE graph_entity`.
 *
 * Usage (from scripts/graph):
 *   npx tsx setup-3a.ts             # print target + size, then apply (idempotent)
 *   npx tsx setup-3a.ts --dry-run   # print target, size, the generated function and the DDL
 *   npx tsx setup-3a.ts --verify    # report what exists, change nothing
 *   npx tsx setup-3a.ts --self-test # plant a forbidden statement in memory and prove guard 3 fires
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { POSITION_CONFIG, configVersion } from '../../scrutinise-web/lib/graph/position-config'

export {}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const VERIFY_ONLY = argv.includes('--verify')
const SELF_TEST = argv.includes('--self-test')

const TABLES = [
  'position_signal_stored',
  'position_division_party',
  'position_division_class',
  'position_estimate',
  'position_estimate_meta',
]
const VIEWS = ['position_signal_vote', 'position_signal']
const FUNCTIONS = ['position_raw_weight']

/** Everything 3A is allowed to create or alter. Anything else in the DDL is a bug, not a feature. */
const OWNED = new Set([...TABLES, ...VIEWS, ...FUNCTIONS])

/** The ops alert threshold. NOT a ceiling — see docs/V38_STORAGE_REPORT.md. */
const ALERT_GIB = 17.5

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// GUARD 3 — the DDL touches nothing it does not own
// ─────────────────────────────────────────────────────────────────────────────────────────────────
export function foreignObjects(sql: string): string[] {
  const stripped = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')
  const found: string[] = []
  const re = /\b(CREATE(?:\s+OR\s+REPLACE)?|ALTER)\s+(?:UNIQUE\s+)?(TABLE|VIEW|INDEX|FUNCTION|MATERIALIZED\s+VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_."]+)/gi
  for (const m of stripped.matchAll(re)) {
    const kind = m[2].toUpperCase()
    const name = m[3].replace(/"/g, '').replace(/^public\./, '')
    // An index is named for itself; what matters is the table it lands ON, which the ON clause
    // carries. Pull that instead, or the allow-list would have to know every index name.
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
  console.log(`  database         ${gib.toFixed(2)} GiB`)
  console.log(`  ops ALERT line   ${ALERT_GIB} GiB — ${((100 * gib) / ALERT_GIB).toFixed(1)}% of it, ${(ALERT_GIB - gib).toFixed(2)} GiB free`)
  if (ceilingGib) {
    console.log(`  enforced CEILING ${(ceilingGib / 1024).toFixed(0)} TiB (neon.max_cluster_size, read from this compute)`)
  } else {
    console.log(`  enforced CEILING unreadable from here — not asserted`)
  }
  console.log(`  this DDL adds five small tables, two views and one function. The vote signals are`)
  console.log(`  DERIVED, not stored: 0.48 GiB not spent — see schema-3a.sql's header.`)
}

/**
 * `position_raw_weight(signal_type, derivation)` — generated from lib/graph/position-config.ts so
 * the weights are typed once. check-3a.ts asserts the generated function and the TypeScript config
 * agree class by class; without that assertion this generation step would just be a slower way of
 * having two sources of truth.
 */
export function weightFunctionSql(): string {
  const w = POSITION_CONFIG.weights
  const voteCases = (['rebellion:v1', 'free-vote-heuristic:v1', 'unwhipped-group:v1',
    'whipped-with:v1', 'small-party-unclassified:v1'] as const)
    .map((k) => `      WHEN p_signal_type = 'vote' AND p_derivation = '${k}' THEN ${w[k]}::real`)
    .join('\n')
  // ⚠⚠ DERIVED FROM THE CONFIG, NOT LISTED HERE. This was a hard-coded array of five names, and
  // GRAPH 3B found the failure it produces: adding `political_donation` to position-config.ts did
  // NOT add a case to the SQL, so `position_raw_weight('political_donation', NULL)` returned NULL
  // while the TypeScript config happily returned 0.1. Two sources of truth wearing one name — and
  // the whole point of generating this function was to avoid exactly that.
  //
  // A weight key containing ':' is a vote CLASS (handled above); everything else is a signal type.
  // check-3b.ts asserts the SQL knows every signal type the config knows, so a future addition
  // fails a check rather than silently losing its weight.
  const typeCases = Object.keys(w)
    .filter((k) => !k.includes(':'))
    .map((k) => `      WHEN p_signal_type = '${k}' THEN ${w[k as keyof typeof w]}::real`)
    .join('\n')
  return `
CREATE OR REPLACE FUNCTION position_raw_weight(p_signal_type text, p_derivation text)
RETURNS real
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
${voteCases}
${typeCases}
    -- ⚠ No fallback weight. An unrecognised class must NOT quietly become 0.2 and look like a
    -- whipped vote; NULL propagates into raw_weight, the NOT NULL / range checks refuse it, and
    -- the failure is loud. Generated from position-config.ts, ${configVersion()}.
    ELSE NULL::real
  END
$$;`
}

async function verify(pool: ReturnType<typeof getNeonPool>) {
  console.log('\n════ WHAT EXISTS ════')
  for (const t of TABLES) {
    const { rows: [x] } = await pool.query<{ e: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=$1) AS e`, [t])
    if (!x.e) { console.log(`  table    ${t.padEnd(28)} MISSING`); continue }
    const { rows: [c] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${t}`)
    const { rows: [s] } = await pool.query<{ s: string }>(
      `SELECT pg_size_pretty(pg_total_relation_size($1::regclass)) AS s`, [t])
    console.log(`  table    ${t.padEnd(28)} ${String(c.n).padStart(9)} rows  ${s.s}`)
  }
  for (const v of VIEWS) {
    const { rows: [x] } = await pool.query<{ e: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname=$1) AS e`, [v])
    console.log(`  view     ${v.padEnd(28)} ${x.e ? 'present' : 'MISSING'}`)
  }
  for (const f of FUNCTIONS) {
    const { rows: [x] } = await pool.query<{ e: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                       WHERE n.nspname='public' AND p.proname=$1) AS e`, [f])
    console.log(`  function ${f.padEnd(28)} ${x.e ? 'present' : 'MISSING'}`)
  }
}

async function main() {
  const sqlPath = path.join(__dirname, 'schema-3a.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  const fnSql = weightFunctionSql()

  if (SELF_TEST) {
    // Guard 3 must be able to fail. Plant the statement it exists to catch.
    console.log('════ SELF-TEST — guard 3 must refuse a foreign object ════')
    const clean = foreignObjects(sql + '\n' + fnSql)
    console.log(`  unmodified DDL           → ${clean.length === 0 ? 'PASS (nothing foreign)' : 'FAIL: ' + clean.join(', ')}`)
    const planted = foreignObjects(sql + '\nALTER TABLE graph_entity ADD COLUMN oops text;\n')
    console.log(`  with a planted ALTER     → ${planted.length ? 'PASS (refused: ' + planted.join(', ') + ')' : 'FAIL — the guard did not fire'}`)
    const planted2 = foreignObjects(sql + '\nCREATE INDEX x_idx ON division_votes (party);\n')
    console.log(`  with a planted INDEX     → ${planted2.length ? 'PASS (refused: ' + planted2.join(', ') + ')' : 'FAIL — the guard did not fire'}`)
    process.exit(clean.length === 0 && planted.length > 0 && planted2.length > 0 ? 0 : 1)
  }

  const pool = getNeonPool()
  try {
    await whichDb(pool)

    if (/\bDROP\s+(TABLE|INDEX|VIEW|DATABASE|SCHEMA|COLUMN|CONSTRAINT)\b/i.test(sql)) {
      console.error('❌ schema-3a.sql contains a DROP — refusing to run it'); process.exit(1)
    }
    const foreign = foreignObjects(sql + '\n' + fnSql)
    if (foreign.length) {
      console.error(`❌ schema-3a.sql touches objects 3A does not own: ${foreign.join(', ')} — refusing`)
      process.exit(1)
    }
    console.log(`\n  ✓ additive guard: every CREATE/ALTER in the DDL names one of 3A's own relations`)

    if (VERIFY_ONLY) { await verify(pool); return }
    if (DRY) {
      console.log('\n════ GENERATED FUNCTION (not applied) ════')
      console.log(fnSql)
      console.log('\n════ DDL (not applied) ════')
      console.log(sql.split('\n').filter((l) => /^(CREATE|ALTER|COMMENT)/i.test(l.trim())).join('\n'))
      console.log('\n--dry-run: nothing applied.')
      return
    }

    console.log('\n════ APPLYING ════')
    // The weight function first: `position_signal_vote` calls it, so the view cannot be created
    // before it exists.
    await pool.query(fnSql)
    console.log(`  ✓ FUNCTION position_raw_weight (generated, ${configVersion()})`)

    const stripped = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')
    for (const st of splitStatements(stripped)) {
      const label = st.replace(/\s+/g, ' ').slice(0, 76)
      try { await pool.query(st); console.log(`  ✓ ${label}`) }
      catch (e) { console.error(`  ✗ ${label}\n      ${(e as Error).message}`); throw e }
    }
    await verify(pool)
    console.log('\nschema applied. The tables are EMPTY — that is derive-vote-classes.ts and derive-signals.ts.')
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

if (require.main === module) {
  main().catch((e) => { console.error('[setup-3a] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
}
