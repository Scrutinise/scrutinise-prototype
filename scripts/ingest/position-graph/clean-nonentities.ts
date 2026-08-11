/**
 * clean-nonentities.ts — remove entity rows that are not actors at all.
 *
 * ⚠ WHY THIS EXISTS. The first full committees sweep created a PERSON entity for
 * `A Member of the Public`, carrying six spellings — i.e. an unknown number of unrelated individuals
 * merged into one actor, which is the invisible, contaminating direction BRIEF_GRAPH_2D1 §3 rules out.
 * The junk-name filter listed `member of the public`, but `normaliseName` strips a leading "the" and
 * not a leading "a", so `a member of the public` walked straight through an exact-match test.
 *
 * `isUselessName` is now tightened and self-tested, so no future run creates these. This script
 * removes the ones the run before the fix already wrote.
 *
 * WHAT IT DELETES, AND WHAT IT DELIBERATELY DOES NOT
 *   · It deletes the ENTITY, its aliases, its edges and those edges' evidence rows — because an edge
 *     whose subject is not a real actor asserts something about nobody.
 *   · It does NOT touch `corpus_sections`. The submissions are real and stay exactly where they are;
 *     only our claim about who made them goes.
 *   · It records every deletion in `graph_merge_log` FIRST, with the surfaces and the counts, so the
 *     removal is auditable and the affected sections can be re-swept later.
 *
 * Dry-run by default. `--apply` is required to delete anything.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/clean-nonentities.ts            # report only
 *   npx tsx position-graph/clean-nonentities.ts --apply
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { isUselessName } from './graph-common'

export {}

const APPLY = process.argv.includes('--apply')
const n = (v: number | string) => Number(v).toLocaleString('en-GB')

async function main() {
  const pool = getNeonPool()
  try {
    // ⚠ CHEAP SQL PREFILTER, then the authoritative JS filter over the handful that survive.
    // The first version ran `isUselessName` over every unkeyed entity joined to every alias with a
    // string_agg and a correlated edge count — 85,000 correlated subqueries, and it timed out at the
    // 60s client limit. The prefilter below is deliberately WIDER than `isUselessName` (it must not
    // decide anything, only narrow), and `isUselessName` remains the single source of truth.
    const PREFILTER = `(
         e.name_norm ~ '(^|\\s)(anon|anonymous|withheld|redacted|undisclosed|unnamed|confidential)'
      OR e.name_norm ~ 'member(s)? of the (public|general public)'
      OR e.name_norm ~ '^(a|an|the)? ?(private|concerned|individual) (citizen|individual|member)'
      OR e.name_norm ~ '(name|identity) (withheld|redacted|removed|anonymised)'
      OR e.name_norm IN ('n a','na','none','nil','unknown','individual','test','self','myself','personal','private','citizen','resident','no name')
    )`
    const { rows: cand } = await pool.query<{ id: string; kind: string; canonical_name: string }>(
      `SELECT e.id::text, e.kind, e.canonical_name FROM graph_entity e
        WHERE e.key_source NOT IN ('parl-member-id','parl-cis-id','parl-idms-id') AND ${PREFILTER}`)
    console.log(`[clean] SQL prefilter returned ${n(cand.length)} candidates from 85k+ unkeyed entities`)

    // Surfaces and edge counts only for the candidates — a few queries, not 85,000.
    const rows: Array<{ id: string; kind: string; canonical_name: string; surfaces: string; edges: string }> = []
    for (const c of cand) {
      const { rows: al } = await pool.query<{ surfaces: string | null }>(
        `SELECT string_agg(DISTINCT surface, ' | ') AS surfaces FROM graph_alias WHERE entity_id = $1`, [c.id])
      const { rows: [ec] } = await pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM graph_edge WHERE subject_id = $1 OR object_entity_id = $1`, [c.id])
      rows.push({ ...c, surfaces: al[0]?.surfaces ?? '', edges: ec.c })
    }

    const doomed = rows.filter((r) =>
      isUselessName(r.canonical_name) || r.surfaces.split(' | ').some((s) => s && isUselessName(s)))

    console.log(`[clean] ${n(rows.length)} candidates examined with the real filter; ${n(doomed.length)} are not actors`)
    if (!doomed.length) { console.log('[clean] nothing to remove — the tightened filter finds no survivors from before the fix'); return }

    let edgeTotal = 0
    for (const d of doomed) {
      edgeTotal += Number(d.edges)
      console.log(`  ${d.kind.padEnd(13)} #${d.id.padEnd(7)} ${Number(d.edges).toString().padStart(5)} edges  "${d.canonical_name}"`)
      console.log(`      surfaces: ${d.surfaces.slice(0, 200)}`)
    }
    console.log(`\n[clean] ${n(doomed.length)} entities, ${n(edgeTotal)} edges and their evidence rows`)
    console.log('[clean] ⚠ corpus_sections is NOT touched — the submissions are real; only our claim about who made them goes.')

    if (!APPLY) { console.log('\n[clean] DRY RUN. Re-run with --apply to delete.'); return }

    const ids = doomed.map((d) => Number(d.id))
    // Log BEFORE deleting: an audit row written after a successful delete is an audit row that does
    // not exist if the delete half-succeeds.
    await pool.query(
      `INSERT INTO graph_merge_log (kind, kept_entity_id, merged_surface, merged_norm, reason, confidence, source)
       SELECT e.kind, NULL, left(e.canonical_name || ' [DELETED: not an actor; ' ||
              (SELECT COUNT(*) FROM graph_edge g WHERE g.subject_id = e.id OR g.object_entity_id = e.id)::text || ' edges removed]', 500),
              e.name_norm, 'deleted-non-entity', 1.0, 'clean-nonentities'
         FROM graph_entity e WHERE e.id = ANY($1::bigint[])`, [ids])
    // graph_alias, graph_edge and graph_evidence all cascade from graph_entity / graph_edge.
    const { rowCount: gone } = await pool.query(`DELETE FROM graph_entity WHERE id = ANY($1::bigint[])`, [ids])
    console.log(`[clean] deleted ${n(gone ?? 0)} entities (aliases, edges and evidence cascade)`)

    const { rows: [after] } = await pool.query<{ e: string; g: string; v: string }>(
      `SELECT (SELECT COUNT(*) FROM graph_entity)::text AS e, (SELECT COUNT(*) FROM graph_edge)::text AS g,
              (SELECT COUNT(*) FROM graph_evidence)::text AS v`)
    console.log(`[clean] now: ${n(after.e)} entities · ${n(after.g)} edges · ${n(after.v)} evidence rows`)
    const { rows: [orphan] } = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM graph_edge e WHERE NOT EXISTS (SELECT 1 FROM graph_evidence v WHERE v.edge_id = e.id)`)
    console.log(`[clean] edges left without evidence: ${n(orphan.c)} ${+orphan.c === 0 ? '✓' : '✗ — the cascade left a claim with no working'}`)
  } finally {
    await endNeonPool()
  }
}
main().catch((e) => { console.error('[clean] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
