/**
 * handcheck-amd2.ts — read the rows the signal flagged, by hand, before they are believed.
 *
 * The house rule (docs/CLAUDE.md §0, and every graph sprint so far): a surprising result gets read
 * at the row level before it is written into a report. Two rows earned that here —
 *
 *   · `archbishop of canterbury` — TWO register members with the IDENTICAL display name, an
 *     overlapping voting period and 100% agreement over 21 divisions. Every other concordant pair
 *     is two obviously different MPs. This one is the only row where identity is genuinely open,
 *     and it is exactly the shape a duplicate register record would take.
 *   · `sharma` — 868 shared divisions at 5.4% agreement, the largest divergent pair. If that is
 *     real it is the single strongest argument in the sprint against name matching.
 *
 * Nothing is written. Usage (from scripts/ingest):  npx tsx position-graph/handcheck-amd2.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 74 - s.length))}`)
async function q(sql: string, params: unknown[] = []) { return (await pool.query(sql, params)).rows }

async function main() {
  head('A. the two "Lord Archbishop of Canterbury" register rows')
  const { rows: canterbury } = await pool.query<{ mnis_id: number }>(
    `SELECT DISTINCT mnis_id FROM graph_member_name WHERE surface_norm = 'archbishop of canterbury' ORDER BY 1`)
  const ids = canterbury.map((r) => r.mnis_id)
  console.log(`  members carrying that surface: ${ids.join(', ')}`)
  console.table(await q(
    `SELECT mnis_id, name_display, name_full_title, latest_house, latest_party,
            membership_from, membership_start::text AS start, membership_end::text AS "end", is_current
       FROM graph_member_register WHERE mnis_id = ANY($1::int[]) ORDER BY mnis_id`, [ids]))

  head('A2. every name surface each of them carries, with its dates')
  console.table(await q(
    `SELECT mnis_id, surface, source, start_date::text AS start, end_date::text AS "end"
       FROM graph_member_name WHERE mnis_id = ANY($1::int[]) ORDER BY mnis_id, source, surface`, [ids]))

  head('A3. voting range per member')
  console.table(await q(
    `SELECT member_id, COUNT(*)::int AS votes, MIN(division_date)::text AS first,
            MAX(division_date)::text AS last, MIN(party) AS party
       FROM division_votes WHERE member_id = ANY($1::int[]) AND vote IN ('aye','no')
      GROUP BY 1 ORDER BY 1`, [ids]))

  head('A4. the 21 divisions the flagged pair BOTH voted in — same lobby every time?')
  console.table(await q(
    `WITH pair AS (SELECT $1::int AS a, $2::int AS b)
     SELECT va.house, va.division_id, va.division_date::text AS date, d.title,
            va.vote AS vote_a, vb.vote AS vote_b
       FROM pair p
       JOIN division_votes va ON va.member_id = p.a AND va.vote IN ('aye','no')
       JOIN division_votes vb ON vb.member_id = p.b AND vb.house = va.house
                             AND vb.division_id = va.division_id AND vb.vote IN ('aye','no')
       LEFT JOIN divisions d ON d.house = va.house AND d.division_id = va.division_id
      ORDER BY va.division_date LIMIT 25`,
    // the flagged pair is the one with an OVERLAP; pick the two with the most shared divisions
    await (async () => {
      const best = await q(
        `WITH ids AS (SELECT UNNEST($1::int[]) AS id)
         SELECT x.id AS a, y.id AS b,
                (SELECT COUNT(*) FROM (
                   SELECT house, division_id FROM division_votes WHERE member_id=x.id AND vote IN ('aye','no')
                   INTERSECT
                   SELECT house, division_id FROM division_votes WHERE member_id=y.id AND vote IN ('aye','no')) s)::int AS shared
           FROM ids x JOIN ids y ON x.id < y.id ORDER BY shared DESC LIMIT 1`, [ids])
      console.log(`  most-shared pair: ${best[0]?.a} × ${best[0]?.b}, ${best[0]?.shared} shared divisions`)
      return [best[0]?.a, best[0]?.b]
    })()))

  head('B. the `sharma` pair — 868 shared divisions at 5.4%')
  console.table(await q(
    `SELECT mnis_id, name_display, name_full_title, latest_house, latest_party, membership_from
       FROM graph_member_register
      WHERE mnis_id IN (SELECT DISTINCT mnis_id FROM graph_member_name WHERE surface_norm='sharma')
      ORDER BY mnis_id`))
  console.table(await q(
    `SELECT surface, source, mnis_id FROM graph_member_name WHERE surface_norm='sharma' ORDER BY mnis_id, source`))

  head('C. where does a bare-forename surface like `geoffrey` come from?')
  console.table(await q(
    `SELECT mnis_id, surface, source FROM graph_member_name
      WHERE surface_norm IN ('geoffrey','david','brown','jones') ORDER BY surface_norm, mnis_id LIMIT 25`))

  await endNeonPool()
}
main().catch((e) => { console.error('[handcheck-amd2] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
