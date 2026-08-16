/**
 * probe-amd2c.ts — the last read before building. Two questions left open by probe-amd2b.
 *
 * 1. §1 wants "the name as it appeared" ON the mention. `corpus_sections.speaker` exists — but does
 *    it exist on the sections `graph_evidence` actually points at, and does it agree with the
 *    entity's canonical name often enough to be worth surfacing?
 * 2. §2's work list looked overwhelmingly episcopal in the first 20 rows. If it is, the "do they
 *    take different positions" test is mostly a SUCCESSION test (disjoint service, no shared
 *    divisions) rather than a disagreement test, and the signal has to say which of the two fired.
 *
 * Nothing is written. Usage (from scripts/ingest):  npx tsx position-graph/probe-amd2c.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 74 - s.length))}`)
async function q(sql: string, params: unknown[] = []) { return (await pool.query(sql, params)).rows }

async function main() {
  // ⚠ SAMPLED, not exhaustive. The full join is 179,911 evidence rows against a 22M-row
  // corpus_sections and blew the 60s client timeout on the first attempt; a 5,000-row sample
  // answers "is the speaker there at all" without pretending to be a census.
  head('1. speaker coverage on the sections graph_evidence points at (n=5,000 sample)')
  console.table(await q(
    `WITH s AS (SELECT section_id FROM graph_evidence ORDER BY id LIMIT 5000)
     SELECT c.corpus,
            COUNT(*)::int AS evidence_rows,
            COUNT(*) FILTER (WHERE c.speaker IS NOT NULL AND c.speaker <> '')::int AS with_speaker
       FROM s JOIN corpus_sections c ON c.id = s.section_id
      GROUP BY 1 ORDER BY 2 DESC LIMIT 15`))

  head('1b. where a speaker exists, does it match the entity that owns the edge? (n=5,000)')
  console.table(await q(
    `WITH s AS (SELECT id, edge_id, section_id FROM graph_evidence ORDER BY id LIMIT 5000)
     SELECT COUNT(*)::int AS rows_checked,
            COUNT(*) FILTER (WHERE c.speaker = e.canonical_name)::int AS exact_match,
            COUNT(*) FILTER (WHERE c.speaker <> e.canonical_name)::int AS differs
       FROM s
       JOIN graph_edge g ON g.id = s.edge_id
       JOIN graph_entity e ON e.id = g.subject_id
       JOIN corpus_sections c ON c.id = s.section_id
      WHERE c.speaker IS NOT NULL AND c.speaker <> ''`))

  head('2. the §2 work list, split into episcopal / peerage-title / plain-name')
  console.table(await q(
    `WITH cluster AS (
       SELECT surface_norm, ARRAY_AGG(DISTINCT mnis_id ORDER BY mnis_id) AS ids
         FROM graph_member_name GROUP BY 1 HAVING COUNT(DISTINCT mnis_id) > 1),
     voting AS (
       SELECT c.surface_norm, c.ids,
              (SELECT ARRAY_AGG(DISTINCT v.member_id) FROM division_votes v
                WHERE v.member_id = ANY (c.ids) AND v.vote IN ('aye','no')) AS voters
         FROM cluster c)
     SELECT CASE
              WHEN surface_norm ~ '(bishop|archbishop)' THEN 'episcopal see'
              WHEN surface_norm ~ '^(lord|lady|baroness|baron|earl|viscount|duke|marquess|countess)\\M' THEN 'peerage title'
              ELSE 'plain name' END AS class,
            COUNT(*)::int AS clusters,
            COUNT(*) FILTER (WHERE COALESCE(ARRAY_LENGTH(voters,1),0) >= 2)::int AS testable
       FROM voting GROUP BY 1 ORDER BY 2 DESC`))

  head('2b. the PLAIN-NAME testable clusters — the ones a user would actually confuse')
  console.table(await q(
    `WITH cluster AS (
       SELECT surface_norm, ARRAY_AGG(DISTINCT mnis_id ORDER BY mnis_id) AS ids
         FROM graph_member_name GROUP BY 1 HAVING COUNT(DISTINCT mnis_id) > 1),
     voting AS (
       SELECT c.surface_norm, c.ids,
              (SELECT ARRAY_AGG(DISTINCT v.member_id ORDER BY v.member_id) FROM division_votes v
                WHERE v.member_id = ANY (c.ids) AND v.vote IN ('aye','no')) AS voters
         FROM cluster c)
     SELECT surface_norm, voters
       FROM voting
      WHERE COALESCE(ARRAY_LENGTH(voters,1),0) >= 2
        AND surface_norm !~ '(bishop|archbishop)'
      ORDER BY surface_norm LIMIT 40`))

  head('2c. do successive holders of the same title ever share a division? (the succession test)')
  console.table(await q(
    `WITH cluster AS (
       SELECT surface_norm, ARRAY_AGG(DISTINCT mnis_id ORDER BY mnis_id) AS ids
         FROM graph_member_name GROUP BY 1 HAVING COUNT(DISTINCT mnis_id) > 1),
     pairs AS (
       SELECT c.surface_norm, a AS id_a, b AS id_b
         FROM cluster c, UNNEST(c.ids) a, UNNEST(c.ids) b WHERE a < b)
     SELECT p.surface_norm, p.id_a, p.id_b,
            (SELECT COUNT(*) FROM (
               SELECT va.house, va.division_id FROM division_votes va
                WHERE va.member_id = p.id_a AND va.vote IN ('aye','no')
               INTERSECT
               SELECT vb.house, vb.division_id FROM division_votes vb
                WHERE vb.member_id = p.id_b AND vb.vote IN ('aye','no')) s)::int AS shared_divisions
       FROM pairs p
      WHERE EXISTS (SELECT 1 FROM division_votes v WHERE v.member_id = p.id_a AND v.vote IN ('aye','no'))
        AND EXISTS (SELECT 1 FROM division_votes v WHERE v.member_id = p.id_b AND v.vote IN ('aye','no'))
      ORDER BY shared_divisions DESC LIMIT 20`))

  await endNeonPool()
}
main().catch((e) => { console.error('[probe-amd2c] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
