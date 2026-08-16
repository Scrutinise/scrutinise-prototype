/**
 * report-2d2.ts — the numbers BRIEF_GRAPH_2D2 §5 asks for, in one place, read from the database
 * rather than transcribed from a run log.
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/report-2d2.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
export {}

const pool = getNeonPool()
const q = async (sql: string, a: any[] = []) => (await pool.query(sql, a)).rows
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)

async function main() {
  head('§1 `voted`')
  console.table(await q(
    `SELECT COUNT(*)::text AS edges, COUNT(DISTINCT subject_id)::text AS people,
            COUNT(DISTINCT object_ref)::text AS divisions,
            MIN(observed_on)::text AS from_date, MAX(observed_on)::text AS to_date
       FROM graph_voted_edge`))
  console.table(await q(
    `SELECT house, qualifier, COUNT(*)::text AS edges, COUNT(*) FILTER (WHERE teller)::text AS tellers
       FROM graph_voted_edge GROUP BY 1,2 ORDER BY 1,2`))
  console.log('  members resolved against members unresolved — the number §1 asks for:')
  console.table(await q(
    `SELECT (SELECT COUNT(DISTINCT member_id) FROM division_votes)::text AS voters_in_the_record,
            (SELECT COUNT(DISTINCT v.member_id) FROM division_votes v
               JOIN graph_entity e ON e.parl_member_id=v.member_id AND e.kind='person')::text AS resolved,
            (SELECT COUNT(DISTINCT v.member_id) FROM division_votes v
              WHERE NOT EXISTS (SELECT 1 FROM graph_entity e WHERE e.parl_member_id=v.member_id AND e.kind='person'))::text AS unresolved,
            (SELECT COUNT(*) FROM division_votes)::text AS vote_rows,
            (SELECT COUNT(*) FROM graph_voted_edge)::text AS edges_reachable`))
  console.log('  the unresolved members, by how much of the record they hold:')
  console.table(await q(
    `SELECT v.member_id, MIN(v.member_name) AS name, COUNT(*)::int AS votes
       FROM division_votes v
      WHERE NOT EXISTS (SELECT 1 FROM graph_entity e WHERE e.parl_member_id=v.member_id AND e.kind='person')
      GROUP BY 1 ORDER BY 3 DESC LIMIT 12`))

  head('§2 identity')
  console.table(await q(
    `SELECT kind, key_source, COUNT(*)::text AS n, ROUND(AVG(confidence)::numeric,2)::text AS avg_confidence
       FROM graph_entity GROUP BY 1,2 ORDER BY 1,3 DESC`))
  console.log('  the resolution outcome, per §2\'s own list:')
  console.table(await q(
    `SELECT CASE WHEN reason LIKE 'SPLIT-DETECTED%' THEN 'split-detected-not-resolved'
                 WHEN reason LIKE 'register-name-match%' THEN 'resolved-by-register-name-match'
                 ELSE reason END AS outcome,
            COUNT(DISTINCT kept_entity_id)::text AS entities
       FROM graph_merge_log WHERE source='members-api' GROUP BY 1 ORDER BY 2 DESC`))
  console.log('  ⚠ splits — logged, counted, and deliberately left unresolved:')
  console.table(await q(
    `SELECT DISTINCT kept_entity_id, merged_surface AS entity, reason FROM graph_merge_log
      WHERE reason LIKE 'SPLIT-DETECTED%' ORDER BY 1 LIMIT 30`))

  head('§3 `signed-motion`')
  console.table(await q(
    `SELECT (SELECT COUNT(*) FROM edm_sponsor)::text AS motions_swept,
            (SELECT COUNT(*) FROM edm_sponsor WHERE mnis_id IS NOT NULL)::text AS with_member_id,
            (SELECT COUNT(*) FROM graph_signed_motion_edge)::text AS edges,
            (SELECT COUNT(DISTINCT subject_id) FROM graph_signed_motion_edge)::text AS sponsors,
            (SELECT MIN(observed_on) FROM graph_signed_motion_edge)::text AS from_date,
            (SELECT MAX(observed_on) FROM graph_signed_motion_edge)::text AS to_date`))
  console.log('  ⚠ what is NOT here: the other signatories.')
  console.table(await q(
    `SELECT SUM(sponsors_count)::text AS signatures_in_the_record,
            COUNT(*)::text AS primary_sponsors_we_hold,
            (SUM(sponsors_count) - COUNT(*))::text AS signatures_not_in_this_graph
       FROM edm_sponsor`))
  console.log('  busiest sponsors:')
  console.table(await q(
    `SELECT subject_name, COUNT(*)::int AS motions, MIN(observed_on)::text AS first, MAX(observed_on)::text AS last
       FROM graph_signed_motion_edge GROUP BY 1 ORDER BY 2 DESC LIMIT 10`))

  head('THE GRAPH')
  console.table(await q(
    `SELECT predicate, storage, COUNT(*)::text AS edges, COUNT(DISTINCT subject_id)::text AS actors
       FROM graph_edge_all GROUP BY 1,2 ORDER BY 3 DESC`))
  const [{ b }] = await q(`SELECT pg_database_size(current_database())::text AS b`) as any[]
  const gib = Number(b) / 1024 ** 3
  console.log(`  Neon ${gib.toFixed(2)} GiB of the 17.5 GiB line = ${((100 * gib) / 17.5).toFixed(1)}%`)
  console.table(await q(
    `SELECT relname AS table, pg_size_pretty(pg_total_relation_size(c.oid)) AS size
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r'
        AND relname IN ('graph_entity','graph_edge','graph_evidence','graph_alias','graph_merge_log',
                        'graph_member_register','graph_member_name','edm_sponsor','division_votes')
      ORDER BY pg_total_relation_size(c.oid) DESC`))
  await endNeonPool()
}
main().catch((e) => { console.error('[report-2d2] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
