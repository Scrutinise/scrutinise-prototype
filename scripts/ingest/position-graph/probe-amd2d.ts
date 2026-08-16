/**
 * probe-amd2d.ts — two things the hand-check turned up that are bigger than the row that raised them.
 *
 * 1. `graph_member_name` carries an `address` source, and MNIS's "address as" for a Commons member
 *    is frequently JUST THE SURNAME — `Mr Brown`, `Sir Geoffrey`, `Sir David`. After
 *    normalisePersonName strips the honorific those become the surfaces `brown`, `geoffrey`,
 *    `david`. **Those identify nobody.** The question this settles is whether any of 2D-2's 788
 *    register name-matches was made against one of them, because if so there are wrong identities
 *    sitting in the graph at confidence 0.9 right now.
 *
 * 2. Which pair produced the 100%-agreement `concordant` row on `archbishop of canterbury`. If it is
 *    two successive Archbishops with an overlap, it is the sprint's cleanest proof that behavioural
 *    agreement cannot support a merge — two different people, an IDENTICAL display name, and a
 *    perfect voting record together.
 *
 * Nothing is written. Usage (from scripts/ingest):  npx tsx position-graph/probe-amd2d.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 74 - s.length))}`)
async function q(sql: string, params: unknown[] = []) { return (await pool.query(sql, params)).rows }

async function main() {
  head('1. how many register surfaces are one word — i.e. identify nobody')
  console.table(await q(
    `SELECT source,
            COUNT(*)::int AS surfaces,
            COUNT(*) FILTER (WHERE surface_norm !~ ' ')::int AS single_word,
            COUNT(DISTINCT surface_norm) FILTER (WHERE surface_norm !~ ' ')::int AS distinct_single_word
       FROM graph_member_name GROUP BY 1 ORDER BY 2 DESC`))

  head('1b. the single-word surfaces held by the MOST members')
  console.table(await q(
    `SELECT surface_norm, COUNT(DISTINCT mnis_id)::int AS members,
            STRING_AGG(DISTINCT source, ',') AS sources
       FROM graph_member_name WHERE surface_norm !~ ' '
      GROUP BY 1 HAVING COUNT(DISTINCT mnis_id) > 1 ORDER BY 2 DESC LIMIT 15`))

  head('1c. ⚠ DID ANY OF THE 788 NAME MATCHES LAND ON ONE? (the live-defect question)')
  console.table(await q(
    `SELECT e.id, e.canonical_name, e.name_norm, e.parl_member_id, e.confidence,
            (SELECT COUNT(DISTINCT m.mnis_id) FROM graph_member_name m
              WHERE m.surface_norm = e.name_norm)::int AS members_sharing_surface
       FROM graph_entity e
      WHERE e.kind='person' AND e.key_source='name-match'
        AND e.name_norm !~ ' '
      ORDER BY members_sharing_surface DESC, e.canonical_name LIMIT 25`))

  head('1d. the same question as a single number')
  console.table(await q(
    `SELECT COUNT(*)::int AS name_matches,
            COUNT(*) FILTER (WHERE name_norm !~ ' ')::int AS matched_on_single_word,
            COUNT(*) FILTER (WHERE (SELECT COUNT(DISTINCT m.mnis_id) FROM graph_member_name m
                                     WHERE m.surface_norm = e.name_norm) > 1)::int AS surface_shared_by_several_members
       FROM graph_entity e WHERE e.kind='person' AND e.key_source='name-match'`))

  head('2. the archbishop concordant pair, named')
  console.table(await q(
    `WITH ids AS (SELECT DISTINCT mnis_id AS id FROM graph_member_name
                   WHERE surface_norm='archbishop of canterbury'),
     pairs AS (SELECT x.id AS a, y.id AS b FROM ids x JOIN ids y ON x.id < y.id)
     SELECT p.a, ra.name_display AS name_a, p.b, rb.name_display AS name_b,
            s.shared, s.agreed,
            CASE WHEN s.shared > 0 THEN ROUND((100.0*s.agreed/s.shared)::numeric,1)::text || '%' ELSE '—' END AS rate
       FROM pairs p
       JOIN graph_member_register ra ON ra.mnis_id = p.a
       JOIN graph_member_register rb ON rb.mnis_id = p.b
       JOIN LATERAL (
         SELECT COUNT(*)::int AS shared,
                COUNT(*) FILTER (WHERE va.vote = vb.vote)::int AS agreed
           FROM division_votes va
           JOIN division_votes vb ON vb.house=va.house AND vb.division_id=va.division_id
                                 AND vb.member_id=p.b AND vb.vote IN ('aye','no')
          WHERE va.member_id=p.a AND va.vote IN ('aye','no')) s ON TRUE
      ORDER BY s.shared DESC`))

  head('3. ⚠ MNIS 3296 — a Lords Spiritual record covering 1999-2002 with how many votes?')
  console.table(await q(
    `SELECT (SELECT COUNT(*) FROM division_votes WHERE member_id=3296)::int AS votes_3296,
            (SELECT COUNT(*) FROM division_votes
              WHERE division_date BETWEEN '1999-11-24' AND '2002-10-31')::int AS all_votes_in_that_window,
            (SELECT COUNT(*) FROM division_votes v JOIN graph_member_register r ON r.mnis_id=v.member_id
              WHERE r.latest_party='Bishops' AND v.division_date BETWEEN '1999-11-24' AND '2002-10-31')::int
              AS bishops_votes_in_that_window`))

  await endNeonPool()
}
main().catch((e) => { console.error('[probe-amd2d] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
