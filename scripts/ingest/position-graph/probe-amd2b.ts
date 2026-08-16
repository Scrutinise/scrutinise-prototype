/**
 * probe-amd2b.ts — the second read, aimed at the two things probe-amd2 raised rather than settled.
 *
 * 1. `singleton` is doing two jobs. The CHECK on graph_entity offers 'name-match' but the sweeps
 *    only ever wrote it for the register pass, while the UNIQUE (kind, name_norm) index means an
 *    entity carrying several distinct surfaces WAS merged on a name. If those exist, tier 3 is
 *    hiding a tier-2 claim, which is exactly the direction Amendment 2 §3 says must never happen.
 * 2. §1 wants "the name as it appeared" on the mention. `graph_edge` has no surface column, so
 *    establish whether the surface is recoverable per edge at all before designing a view that
 *    pretends it is.
 *
 * Nothing is written. Usage (from scripts/ingest):  npx tsx position-graph/probe-amd2b.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 74 - s.length))}`)
async function q(sql: string, params: unknown[] = []) { return (await pool.query(sql, params)).rows }

async function main() {
  head('1. is `singleton` hiding a name merge? surfaces per entity, by key_source')
  console.table(await q(
    `SELECT e.kind, e.key_source,
            COUNT(*)::int AS entities,
            COUNT(*) FILTER (WHERE s.n_surfaces > 1)::int AS multi_surface,
            MAX(s.n_surfaces)::int AS max_surfaces
       FROM graph_entity e
       JOIN LATERAL (SELECT COUNT(DISTINCT surface_norm)::int AS n_surfaces
                       FROM graph_alias a WHERE a.entity_id = e.id) s ON TRUE
      GROUP BY 1,2 ORDER BY 1, 3 DESC`))

  head('1b. examples — singleton entities carrying several DIFFERENT normalised surfaces')
  console.table(await q(
    `SELECT e.id, e.kind, e.canonical_name, s.n_surfaces, s.examples
       FROM graph_entity e
       JOIN LATERAL (SELECT COUNT(DISTINCT surface_norm)::int AS n_surfaces,
                            STRING_AGG(DISTINCT a.surface, ' | ' ORDER BY a.surface) AS examples
                       FROM graph_alias a WHERE a.entity_id = e.id) s ON TRUE
      WHERE e.key_source = 'singleton' AND s.n_surfaces > 1
      ORDER BY s.n_surfaces DESC LIMIT 12`))

  head('2. how thin is an unresolved person? edges per singleton person')
  console.table(await q(
    `SELECT edges, COUNT(*)::int AS people FROM (
       SELECT e.id, (SELECT COUNT(*) FROM graph_edge g WHERE g.subject_id = e.id)::int AS edges
         FROM graph_entity e WHERE e.kind='person' AND e.key_source='singleton') x
      GROUP BY 1 ORDER BY 1 LIMIT 12`))

  head('3. can a mention recover "the name as it appeared"? evidence + alias source coverage')
  console.table(await q(
    `SELECT (SELECT COUNT(*) FROM graph_edge)::bigint AS stored_edges,
            (SELECT COUNT(DISTINCT edge_id) FROM graph_evidence)::bigint AS edges_with_evidence,
            (SELECT COUNT(*) FROM graph_evidence)::bigint AS evidence_rows,
            (SELECT COUNT(*) FROM graph_evidence WHERE extract IS NOT NULL)::bigint AS with_extract,
            (SELECT COUNT(*) FROM graph_evidence WHERE source_url IS NOT NULL)::bigint AS with_url`))

  head('3b. alias sources present')
  console.table(await q(`SELECT source, COUNT(*)::int AS n FROM graph_alias GROUP BY 1 ORDER BY 2 DESC`))

  head('3c. does corpus_sections carry a speaker we could key a mention on?')
  console.table(await q(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name='corpus_sections' AND column_name IN ('speaker','corpus','title','source_url','doc_date')
      ORDER BY 1`))

  head('4. what a mention row would look like for an UNRESOLVED person with an edge')
  console.table(await q(
    `SELECT e.id, e.canonical_name, e.key_source, e.confidence,
            g.predicate, g.object_label, g.last_seen::text AS observed_on,
            (SELECT COUNT(*) FROM graph_evidence ev WHERE ev.edge_id = g.id)::int AS evidence
       FROM graph_entity e JOIN graph_edge g ON g.subject_id = e.id
      WHERE e.kind='person' AND e.key_source='singleton'
      ORDER BY e.id LIMIT 8`))

  head('5. §2 work list — the 99 clusters, sized')
  console.table(await q(
    `WITH cluster AS (
       SELECT surface_norm, ARRAY_AGG(DISTINCT mnis_id ORDER BY mnis_id) AS ids
         FROM graph_member_name GROUP BY 1 HAVING COUNT(DISTINCT mnis_id) > 1),
     voting AS (
       SELECT c.surface_norm, c.ids,
              (SELECT ARRAY_AGG(DISTINCT v.member_id ORDER BY v.member_id) FROM division_votes v
                WHERE v.member_id = ANY (c.ids) AND v.vote IN ('aye','no')) AS voters
         FROM cluster c)
     SELECT surface_norm, ids, voters, COALESCE(ARRAY_LENGTH(voters,1),0) AS n_voters
       FROM voting WHERE COALESCE(ARRAY_LENGTH(voters,1),0) >= 2
      ORDER BY n_voters DESC, surface_norm LIMIT 20`))

  await endNeonPool()
}
main().catch((e) => { console.error('[probe-amd2b] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
