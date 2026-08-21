/**
 * setup-3c.ts — apply scripts/graph/schema-3c.sql to Neon, and regenerate `position_raw_weight()`
 * from the config, and prove which database both went to.
 *
 * GRAPH 3C. Same three guards as setup-3a.ts / setup-3b.ts, and for the same reason
 * (docs/CLAUDE.md §16): the host check lives INSIDE the script, because a check you have to
 * remember to run is a check that will be skipped.
 *
 *   1. the target host is Neon production, or the script exits 1;
 *   2. the DDL contains no DROP of any kind;
 *   3. the DDL touches NOTHING outside the relations 3C owns, asserted by parsing every CREATE and
 *      ALTER out of the file. Watched failing on planted statements (`--self-test`).
 *
 * Usage (from scripts/graph):
 *   npx tsx setup-3c.ts             # print target + size, then apply (idempotent)
 *   npx tsx setup-3c.ts --dry-run   # print target, size and the DDL; change nothing
 *   npx tsx setup-3c.ts --verify    # report what exists, change nothing
 *   npx tsx setup-3c.ts --self-test # plant forbidden statements in memory and prove guard 3 fires
 *
 * ⚠⚠ ORDERING HAZARD, INHERITED AND NOW TWO DEEP. `setup-3a.ts` re-applies a view definition with
 * the classification ladder inline; `setup-3b.ts` re-applies one that calls the FIVE-argument
 * `position_vote_class()`. Either, run after this script, silently reverts 3C — and reverts it to
 * something that still returns plausible rows, which is the dangerous kind of revert. The run
 * order is **3a → 3b → 3c**, and `check-3c.ts` asserts the live view actually mentions
 * `position_vote_class_v2`, so a reversion fails a check instead of sitting there.
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { weightFunctionSql } from './setup-3a'
import { POSITION_CONFIG, configVersion } from '../../scrutinise-web/lib/graph/position-config'

export {}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const VERIFY_ONLY = argv.includes('--verify')
const SELF_TEST = argv.includes('--self-test')

/** Everything 3C is allowed to create, replace or alter. All CC-Graph-owned. */
const OWNED = new Set([
  'position_vote_class_v2',
  'position_signal_vote_for',
  'position_signal_vote',
  'position_division_party',
  'position_division_class',
  'position_estimate',
  // regenerated from position-config.ts, not from the .sql file
  'position_raw_weight',
])

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

/**
 * GRAPH 3C §5 — the storage line, priced rather than asserted.
 *
 * 3B found the 17.5 GiB "ceiling" at `scripts/ingest/search/serve-observer.ts:50` with circular
 * provenance: the comment cites the handoff, the handoff's number is emitted by the observer. The
 * enforced ceiling read from this compute is 16 TiB. Neon's Launch plan has NO fixed storage
 * allowance — storage is usage-priced — so the only honest threshold is a COST one.
 *
 * Source: Neon console, Launch plan, read by Charlie and recorded in BRIEF_GRAPH_3C.md §5,
 * 21 August 2026. $0.35 per GB-month. Re-check when the plan changes.
 */
export const NEON_STORAGE_USD_PER_GB_MONTH = 0.35
export const NEON_STORAGE_PRICE_CHECKED = '2026-08-21 (BRIEF_GRAPH_3C.md §5, Neon console, Launch plan)'

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
  const gb = Number(sz.b) / 1e9
  const gib = Number(sz.b) / 1024 ** 3
  console.log(`\n════ SIZE, PRICED ════`)
  console.log(`  database          ${gib.toFixed(2)} GiB (${gb.toFixed(2)} GB)`)
  console.log(`  storage cost      $${(gb * NEON_STORAGE_USD_PER_GB_MONTH).toFixed(2)} / month at $${NEON_STORAGE_USD_PER_GB_MONTH}/GB-month`)
  console.log(`  price checked     ${NEON_STORAGE_PRICE_CHECKED}`)
  console.log(`  ⚠ THE 17.5 GiB "CEILING" IS RETIRED. It was never a plan limit — the enforced one`)
  console.log(`    is neon.max_cluster_size (16 TiB, readable from this compute). Storage on the`)
  console.log(`    Launch plan is usage-priced, so the only meaningful threshold is a cost one.`)
}

async function main() {
  const sqlPath = path.join(__dirname, 'schema-3c.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  const fnSql = weightFunctionSql()

  // ── GUARD 3, self-test: prove it fires before trusting it to pass ────────────────────────────
  if (SELF_TEST) {
    console.log('════ GUARD 3 SELF-TEST ════')
    const cases: Array<[string, string]> = [
      ['unmodified DDL (schema + generated fn)', sql + '\n' + fnSql],
      ['planted ALTER on a foreign table', sql + '\nALTER TABLE graph_entity ADD COLUMN x int;'],
      ['planted CREATE INDEX on a foreign table', sql + '\nCREATE INDEX zz ON division_votes (member_id);'],
      ['planted CREATE VIEW with a foreign name', sql + '\nCREATE OR REPLACE VIEW graph_edge_v AS SELECT 1;'],
      ['planted CREATE FUNCTION with a foreign name', sql + '\nCREATE OR REPLACE FUNCTION lex_thing() RETURNS int LANGUAGE sql AS $$SELECT 1$$;'],
      ['planted ALTER on a SEARCH-owned table', sql + '\nALTER TABLE corpus_sections ADD COLUMN x int;'],
    ]
    let bad = 0
    for (const [label, body] of cases) {
      const found = foreignObjects(body)
      const shouldFire = label !== 'unmodified DDL (schema + generated fn)'
      const fired = found.length > 0
      const okCase = fired === shouldFire
      if (!okCase) bad++
      console.log(`  ${okCase ? 'PASS' : '❌ DID NOT FIRE'}  ${label.padEnd(44)} ${fired ? `refused: ${found.join(', ')}` : 'nothing foreign'}`)
    }
    const dropCase = sql + '\nDROP VIEW position_signal;'
    const dropFires = /\bDROP\b/i.test(dropCase.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n'))
    console.log(`  ${dropFires ? 'PASS' : '❌ DID NOT FIRE'}  ${'planted DROP'.padEnd(44)} ${dropFires ? 'refused' : 'not seen'}`)
    if (!dropFires) bad++
    console.log(`\n  ${bad === 0 ? '✓ every planted break fired and the clean DDL passed' : `❌ ${bad} case(s) wrong`}`)
    process.exit(bad === 0 ? 0 : 1)
  }

  // ── GUARD 2 ──────────────────────────────────────────────────────────────────────────────────
  const noComments = (s: string) => s.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')
  if (/\bDROP\b/i.test(noComments(sql)) || /\bDROP\b/i.test(noComments(fnSql))) {
    console.error('❌ the DDL contains a DROP. Refusing.')
    process.exit(1)
  }
  // ── GUARD 3 ──────────────────────────────────────────────────────────────────────────────────
  const foreign = foreignObjects(sql + '\n' + fnSql)
  if (foreign.length) {
    console.error(`❌ the DDL touches objects 3C does not own: ${foreign.join(', ')}. Refusing.`)
    process.exit(1)
  }
  console.log('✓ guard 2 (no DROP) and guard 3 (owns everything it touches) pass\n')

  const pool = getNeonPool()
  try {
    await whichDb(pool)

    if (DRY) {
      console.log('\n──── schema-3c.sql (not applied, --dry-run) ────\n')
      console.log(sql)
      console.log('\n──── position_raw_weight, generated from position-config.ts ────\n')
      console.log(fnSql)
      return
    }

    if (VERIFY_ONLY) {
      console.log('\n════ WHAT EXISTS ════')
      const { rows } = await pool.query<{ kind: string; name: string }>(`
        SELECT 'function' AS kind, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS name
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname LIKE 'position%'
        UNION ALL
        SELECT 'view', viewname FROM pg_views WHERE viewname LIKE 'position%'
        UNION ALL
        SELECT 'column', table_name || '.' || column_name FROM information_schema.columns
         WHERE table_name IN ('position_division_party','position_division_class','position_estimate')
           AND column_name IN ('is_cohesive_party','free_vote_source','consistency')
        ORDER BY 1, 2`)
      for (const r of rows) console.log(`  ${r.kind.padEnd(9)} ${r.name}`)
      return
    }

    console.log('\n════ APPLYING ════')
    await pool.query(sql)
    console.log('  ✓ schema-3c.sql applied')
    await pool.query(fnSql)
    console.log(`  ✓ position_raw_weight regenerated from position-config.ts (${configVersion()})`)

    // Read the weights BACK out of the database, class by class. An applied DDL says what the
    // driver sent; this says what the planner will fold. `party-split:v1` returning NULL here is
    // exactly the 3B defect this sprint found still half-present in the generator.
    console.log(`\n════ READ BACK — every weight key the config knows, asked of the SQL ════`)
    let nulls = 0
    for (const k of Object.keys(POSITION_CONFIG.weights)) {
      const isClass = k.includes(':')
      const { rows: [r] } = await pool.query<{ w: string | null }>(
        `SELECT position_raw_weight($1, $2)::text AS w`,
        isClass ? ['vote', k] : [k, null])
      if (r.w === null) nulls++
      console.log(`  ${(isClass ? `vote / ${k}` : k).padEnd(38)} ${r.w === null ? '❌ NULL — the SQL does not know this key' : r.w}`)
    }
    console.log(nulls === 0 ? '  ✓ every key the config knows, the SQL knows' : `  ❌ ${nulls} key(s) missing`)

    const { rows: fns } = await pool.query<{ name: string; args: string }>(`
      SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname LIKE 'position_vote_class%'
       ORDER BY 1`)
    console.log()
    for (const f of fns) console.log(`  ✓ function  ${f.name}(${f.args})`)
    const { rows: cols } = await pool.query<{ t: string; c: string }>(`
      SELECT table_name AS t, column_name AS c FROM information_schema.columns
       WHERE column_name IN ('is_cohesive_party','free_vote_source','consistency')
         AND table_name LIKE 'position%' ORDER BY 1, 2`)
    for (const c of cols) console.log(`  ✓ column    ${c.t}.${c.c}`)

    if (nulls > 0) process.exit(1)
  } finally {
    await endNeonPool()
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
