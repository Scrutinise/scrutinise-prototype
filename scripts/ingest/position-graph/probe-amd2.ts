/**
 * probe-amd2.ts — read the graph's actual shape before building AMENDMENT 2's layer.
 *
 * Nothing is written. This exists because Amendment 2's three buildable sections (§1 mention
 * display, §2 behaviour as identity evidence, §3 confidence tiers on screen) all rest on claims
 * about the data — "45,018 unresolved", "788 name matches", "24 splits" — that came out of a
 * report and should be re-read from the database before a schema is written on top of them
 * (docs/CLAUDE.md §0).
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/probe-amd2.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 74 - s.length))}`)

async function q(sql: string, params: unknown[] = []) {
  const { rows } = await pool.query(sql, params)
  return rows
}

async function main() {
  head('WHICH DATABASE')
  console.table(await q(`SELECT current_database() AS db, current_user AS usr`))

  head('§3 — key_source × kind, the raw material for the three tiers')
  console.table(await q(
    `SELECT kind, key_source, COUNT(*)::int AS n,
            ROUND(AVG(confidence)::numeric, 3)::text AS avg_conf,
            MIN(confidence)::text AS min_conf, MAX(confidence)::text AS max_conf
       FROM graph_entity GROUP BY 1,2 ORDER BY 1, 3 DESC`))

  head('§6 — the two halves, NOT averaged')
  console.table(await q(
    `SELECT kind, COUNT(*)::int AS entities,
            COUNT(*) FILTER (WHERE key_source IN ('parl-member-id','parl-cis-id','parl-idms-id'))::int AS keyed,
            ROUND(100.0 * COUNT(*) FILTER (WHERE key_source IN ('parl-member-id','parl-cis-id','parl-idms-id'))
                  / NULLIF(COUNT(*),0), 1)::text AS keyed_pct
       FROM graph_entity GROUP BY 1 ORDER BY 2 DESC`))

  head('§1 — how many entities carry at least one EDGE (a mention that could be displayed)')
  console.table(await q(
    `SELECT e.kind,
            COUNT(*)::int AS entities,
            COUNT(*) FILTER (WHERE x.n > 0)::int AS with_edges,
            COALESCE(SUM(x.n), 0)::bigint AS edges
       FROM graph_entity e
       LEFT JOIN LATERAL (SELECT COUNT(*)::int AS n FROM graph_edge g WHERE g.subject_id = e.id) x ON TRUE
      GROUP BY 1 ORDER BY 2 DESC`))

  head('§1 — the stored edges by predicate (graph_edge only; the views are counted separately)')
  console.table(await q(
    `SELECT predicate, object_kind, COUNT(*)::int AS edges, COUNT(DISTINCT subject_id)::int AS actors
       FROM graph_edge GROUP BY 1,2 ORDER BY 3 DESC`))

  head('§1 — aliases: are there surfaces that differ from the canonical name?')
  console.table(await q(
    `SELECT COUNT(*)::int AS alias_rows,
            COUNT(DISTINCT entity_id)::int AS entities_with_alias,
            COUNT(*) FILTER (WHERE a.surface <> e.canonical_name)::int AS surface_differs
       FROM graph_alias a JOIN graph_entity e ON e.id = a.entity_id`))

  head('§2 — name collisions in the REGISTER: one surface_norm, several MNIS ids')
  console.table(await q(
    `SELECT n_members, COUNT(*)::int AS name_clusters FROM (
       SELECT surface_norm, COUNT(DISTINCT mnis_id)::int AS n_members
         FROM graph_member_name GROUP BY 1 HAVING COUNT(DISTINCT mnis_id) > 1) x
      GROUP BY 1 ORDER BY 1`))

  head('§2 — do the colliding members actually have votes? (the free behavioural signal)')
  console.table(await q(
    `WITH cluster AS (
       SELECT surface_norm, ARRAY_AGG(DISTINCT mnis_id) AS ids
         FROM graph_member_name GROUP BY 1 HAVING COUNT(DISTINCT mnis_id) > 1)
     SELECT COUNT(*)::int AS clusters,
            COUNT(*) FILTER (WHERE voters >= 2)::int AS clusters_with_2plus_voters,
            SUM(voters)::int AS voting_members
       FROM (SELECT c.surface_norm,
                    (SELECT COUNT(DISTINCT v.member_id) FROM division_votes v
                      WHERE v.member_id = ANY (c.ids) AND v.vote IN ('aye','no'))::int AS voters
               FROM cluster c) y`))

  head('§2 — the splits 2D-2 logged and refused to resolve')
  console.table(await q(
    `SELECT reason, COUNT(*)::int AS n FROM graph_merge_log
      WHERE reason LIKE 'SPLIT-DETECTED%' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`))
  console.table(await q(
    `SELECT merged_surface, merged_norm, confidence, source FROM graph_merge_log
      WHERE reason LIKE 'SPLIT-DETECTED%' ORDER BY merged_surface LIMIT 25`))

  head('§2 — the 788 register name-matches (the ones a behavioural test would be aimed at)')
  console.table(await q(
    `SELECT key_source, ROUND(confidence::numeric,2)::text AS conf, COUNT(*)::int AS n
       FROM graph_entity
      WHERE kind='person' AND parl_member_id IS NOT NULL
      GROUP BY 1,2 ORDER BY 3 DESC`))

  head('sanity — division_votes shape')
  console.table(await q(
    `SELECT COUNT(*)::bigint AS vote_rows, COUNT(DISTINCT member_id)::int AS members,
            COUNT(DISTINCT (house || ':' || division_id))::int AS divisions,
            MIN(division_date)::text AS first, MAX(division_date)::text AS last
       FROM division_votes`))

  await endNeonPool()
}
main().catch((e) => { console.error('[probe-amd2] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
