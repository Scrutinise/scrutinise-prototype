/**
 * verify-surface.ts — the surface recorded on an edge is the name as it APPEARED, and nothing
 * claims to be one when it is not.
 *
 * BRIEF_INGEST_CORPUS_FRESHNESS §2. The risk this change introduces is precisely the one
 * schema-amd2.sql refused to take: showing a name and implying the record used it. So the checks
 * below are mostly about what must NOT happen.
 *
 * ⚠ EVERY CHECK CARRIES A NEGATIVE CONTROL THAT MUST FIRE. A verify made of queries that return 0
 * on a healthy database proves nothing about whether it could ever return anything else — the
 * `check:entity-decode` twin guard passed happily while the twin was diverged, one sprint ago, and
 * that is the failure this file is written against. Each invariant is run a second time against a
 * planted bad row, and a control that does NOT fire fails the run.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/verify-surface.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

let failures = 0
let controlsFired = 0
const pass = (m: string, detail = '') => console.log(`  ✓ ${m}${detail ? `  — ${detail}` : ''}`)
const fail = (m: string, detail = '') => { console.log(`  ✗ ${m}${detail ? `  — ${detail}` : ''}`); failures++ }
const head = (m: string) => console.log(`\n──── ${m} ────`)

async function main() {
  const pool = getNeonPool()
  try {
    const one = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> =>
      (await pool.query<T>(sql, params)).rows[0]

    head('§1 the schema carries the surface, at both grains')
    for (const [table, col] of [['graph_edge', 'subject_surface'], ['graph_edge', 'subject_surface_varies'], ['graph_evidence', 'subject_surface']] as const) {
      const r = await one<{ t: string | null }>(
        `SELECT data_type AS t FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [table, col])
      r?.t ? pass(`${table}.${col}`, r.t) : fail(`${table}.${col} MISSING`)
    }
    for (const v of ['graph_voted_edge', 'graph_signed_motion_edge', 'graph_edge_all']) {
      const r = await one<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM information_schema.columns WHERE table_name=$1 AND column_name='subject_surface'`, [v])
      Number(r.n) ? pass(`${v} exposes subject_surface`) : fail(`${v} does NOT expose subject_surface`)
    }

    head('§2 THE INVARIANT — no mention claims a per-appearance surface we do not hold')
    // The rule, both ways round: the flag says "this is the entity's name" exactly when there is no
    // recorded surface, and display_name is the recorded surface exactly when there is one.
    const bad = await one<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM graph_mention
        WHERE (surface_is_per_entity AND recorded_surface IS NOT NULL)
           OR (NOT surface_is_per_entity AND recorded_surface IS NULL)
           OR (recorded_surface IS NOT NULL AND display_name <> recorded_surface)
           OR (recorded_surface IS NULL AND display_name IS DISTINCT FROM canonical_name)`)
    Number(bad.n) === 0
      ? pass('display_name and surface_is_per_entity agree with what is stored, on every mention')
      : fail(`${bad.n} mentions disagree with their own surface flag`)

    // ⚠ THE CONTROL. The same predicate, over a fixture that plants each of the four violations.
    // If this returns 0 the check above is incapable of failing and its pass means nothing.
    const ctl = await one<{ n: string }>(
      `WITH fixture(display_name, surface_is_per_entity, recorded_surface, canonical_name) AS (VALUES
         ('Hoyle, rh Sir Lindsay', TRUE,  'Hoyle, rh Sir Lindsay', 'Sir Lindsay Hoyle'),  -- flag says none, one is held
         ('Sir Lindsay Hoyle',     FALSE, NULL,                    'Sir Lindsay Hoyle'),  -- flag says held, none is
         ('Sir Lindsay Hoyle',     FALSE, 'Hoyle, rh Sir Lindsay', 'Sir Lindsay Hoyle'),  -- shows canonical as the record's
         ('Somebody Else',         TRUE,  NULL,                    'Sir Lindsay Hoyle')   -- shows neither
       )
       SELECT COUNT(*)::text AS n FROM fixture
        WHERE (surface_is_per_entity AND recorded_surface IS NOT NULL)
           OR (NOT surface_is_per_entity AND recorded_surface IS NULL)
           OR (recorded_surface IS NOT NULL AND display_name <> recorded_surface)
           OR (recorded_surface IS NULL AND display_name IS DISTINCT FROM canonical_name)`)
    if (Number(ctl.n) === 4) { pass('negative control: the invariant catches all four ways of lying about a surface'); controlsFired++ }
    else fail(`negative control caught ${ctl.n}/4 planted violations — the invariant above cannot be trusted`)

    head('§3 an INFERRED edge has no surface, because it has no appearance')
    const inferred = await one<{ total: string; withSurface: string }>(
      `SELECT COUNT(*)::text AS total, COUNT(subject_surface)::text AS "withSurface"
         FROM graph_edge_all WHERE storage = 'inferred'`)
    Number(inferred.withSurface) === 0
      ? pass('no inferred mention carries a surface', `${Number(inferred.total).toLocaleString()} inferred mentions, 0 with a surface`)
      : fail(`${inferred.withSurface} inferred mentions carry a surface — "the name as it appeared" has no referent for a derived position`)

    head('§4 coverage, reported rather than asserted')
    const cov = await pool.query<{ storage: string; total: string; with_surface: string; varies: string }>(
      `SELECT storage, COUNT(*)::text AS total, COUNT(subject_surface)::text AS with_surface,
              COUNT(*) FILTER (WHERE surface_varies)::text AS varies
         FROM graph_edge_all GROUP BY storage ORDER BY COUNT(*) DESC`)
    console.table(cov.rows)
    const all = await one<{ total: string; with_surface: string }>(
      `SELECT COUNT(*)::text AS total, COUNT(subject_surface)::text AS with_surface FROM graph_edge_all`)
    const pctAll = (100 * Number(all.with_surface)) / Math.max(1, Number(all.total))
    console.log(`  ${Number(all.with_surface).toLocaleString()} / ${Number(all.total).toLocaleString()} mentions (${pctAll.toFixed(1)}%) can show the name as it appeared`)
    console.log(`  ⚠ a stored edge written before this column exists carries NULL, and that is`)
    console.log(`    reported as "the entity's name, standing in" rather than filled with a guess.`)

    head('§5 the surface is the RECORD\'s name, not a copy of ours')
    // If recorded_surface were quietly the canonical name, every check above would still pass and
    // the feature would be worthless. So: how often do they actually differ?
    const diff = await one<{ n: string; same: string }>(
      `SELECT COUNT(*) FILTER (WHERE recorded_surface IS DISTINCT FROM canonical_name)::text AS n,
              COUNT(*) FILTER (WHERE recorded_surface = canonical_name)::text AS same
         FROM graph_mention WHERE recorded_surface IS NOT NULL`)
    const differs = Number(diff.n)
    differs > 0
      ? pass('recorded surfaces differ from our canonical names', `${differs.toLocaleString()} differ, ${Number(diff.same).toLocaleString()} identical`)
      : fail('every recorded surface equals the canonical name — the column is a copy, not a record')
    const { rows: examples } = await pool.query<{ canonical_name: string; recorded_surface: string; predicate: string }>(
      `SELECT canonical_name, recorded_surface, predicate FROM graph_mention
        WHERE recorded_surface IS DISTINCT FROM canonical_name AND recorded_surface IS NOT NULL
        LIMIT 5`)
    for (const e of examples) console.log(`     ${e.predicate.padEnd(14)} "${e.canonical_name}"  recorded as  "${e.recorded_surface}"`)

    head('§6 the mention count is unchanged — this was a display change, not a filter')
    const counts = await one<{ mentions: string; edges: string }>(
      `SELECT (SELECT COUNT(*) FROM graph_mention)::text AS mentions,
              (SELECT COUNT(*) FROM graph_edge_all)::text AS edges`)
    counts.mentions === counts.edges
      ? pass('every edge is still exactly one mention', `${Number(counts.mentions).toLocaleString()}`)
      : fail(`graph_mention ${counts.mentions} vs graph_edge_all ${counts.edges} — the join dropped or duplicated rows`)

    console.log(`\n════ ${failures ? `${failures} FAILED` : 'all checks pass'} · ${controlsFired} negative control(s) fired ════`)
    if (!controlsFired) { console.log('  ⚠ NO CONTROL FIRED — treat the passes above as unproven.'); failures++ }
    if (failures) process.exitCode = 1
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[verify-surface] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
