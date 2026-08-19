/**
 * probe-3a-b.ts — GRAPH 3A §1, second pass: the numbers the audit has to report.
 *
 * Read-only. Everything here is a count or a sample read back, never an inference.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

async function q<T extends Record<string, unknown>>(pool: ReturnType<typeof getNeonPool>, label: string, sql: string, params: unknown[] = []) {
  const t0 = Date.now()
  const { rows } = await pool.query<T>(sql, params)
  console.log(`\n──── ${label}  (${rows.length} rows, ${Date.now() - t0}ms)`)
  for (const r of rows.slice(0, 40)) console.log('   ', JSON.stringify(r))
  if (rows.length > 40) console.log(`    … ${rows.length - 40} more`)
  return rows
}

async function main() {
  const pool = getNeonPool()
  try {
    await q(pool, 'graph_edge predicates', `
      SELECT predicate, object_kind, COUNT(*)::text AS n,
             COUNT(*) FILTER (WHERE object_entity_id IS NOT NULL)::text AS with_obj_entity
        FROM graph_edge GROUP BY 1,2 ORDER BY 3::bigint DESC`)

    await q(pool, 'graph_entity by kind and key_source', `
      SELECT kind, key_source, COUNT(*)::text AS n FROM graph_entity GROUP BY 1,2 ORDER BY 1,3::bigint DESC`)

    await q(pool, 'division_votes → entity resolution', `
      SELECT COUNT(*)::text AS vote_rows,
             COUNT(*) FILTER (WHERE e.id IS NOT NULL)::text AS resolved,
             COUNT(DISTINCT v.member_id)::text AS distinct_members,
             COUNT(DISTINCT v.member_id) FILTER (WHERE e.id IS NOT NULL)::text AS distinct_resolved
        FROM division_votes v
        LEFT JOIN graph_entity e ON e.parl_member_id = v.member_id AND e.kind = 'person'`)

    await q(pool, 'edm_sponsor → entity resolution', `
      SELECT COUNT(*)::text AS rows,
             COUNT(*) FILTER (WHERE s.mnis_id IS NULL)::text AS no_mnis,
             COUNT(*) FILTER (WHERE e.id IS NOT NULL)::text AS resolved,
             COUNT(*) FILTER (WHERE s.mnis_id IS NOT NULL AND e.id IS NULL)::text AS mnis_but_no_entity
        FROM edm_sponsor s
        LEFT JOIN graph_entity e ON e.parl_member_id = s.mnis_id AND e.kind = 'person'`)

    await q(pool, 'divisions: do we hold question/subject text', `
      SELECT house, COUNT(*)::text AS n,
             COUNT(*) FILTER (WHERE title IS NOT NULL AND title <> '')::text AS with_title,
             COUNT(*) FILTER (WHERE bill_title IS NOT NULL)::text AS with_bill,
             COUNT(*) FILTER (WHERE amendment IS NOT NULL)::text AS with_amendment,
             COUNT(*) FILTER (WHERE motion_notes IS NOT NULL)::text AS with_notes,
             MIN(division_date)::text AS first, MAX(division_date)::text AS last
        FROM divisions GROUP BY house`)

    await q(pool, 'divisions sample titles', `
      SELECT house, division_id, division_date::text, left(title, 110) AS title, bill_title, stage, amendment
        FROM divisions ORDER BY random() LIMIT 12`)

    await q(pool, 'division_votes party-at-vote coverage', `
      SELECT COUNT(*)::text AS n,
             COUNT(*) FILTER (WHERE party IS NOT NULL AND party <> '')::text AS with_party,
             COUNT(*) FILTER (WHERE party_abbrev IS NOT NULL AND party_abbrev <> '')::text AS with_abbrev,
             COUNT(DISTINCT party)::text AS distinct_parties
        FROM division_votes`)

    await q(pool, 'division_votes vote values', `
      SELECT vote, COUNT(*)::text AS n FROM division_votes GROUP BY 1 ORDER BY 2::bigint DESC`)

    await q(pool, 'does a member ever change party across divisions', `
      SELECT COUNT(*)::text AS members_with_more_than_one_party FROM (
        SELECT member_id FROM division_votes WHERE party IS NOT NULL
         GROUP BY member_id HAVING COUNT(DISTINCT party) > 1) x`)

    await q(pool, 'graph_member_post kinds', `
      SELECT kind, COUNT(*)::text AS n, COUNT(DISTINCT mnis_id)::text AS members FROM graph_member_post GROUP BY 1 ORDER BY 2::bigint DESC`)

    await q(pool, 'graph_member_post sample', `
      SELECT mnis_id, kind, left(post_name,80) AS post_name, start_date::text, end_date::text
        FROM graph_member_post ORDER BY random() LIMIT 12`)

    await q(pool, 'corpus_sections source families', `
      SELECT source, COUNT(*)::text AS n FROM corpus_sections GROUP BY 1 ORDER BY 2::bigint DESC LIMIT 60`)

    await q(pool, 'PartyMembership shape', `
      SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='PartyMembership' ORDER BY ordinal_position`)
    await q(pool, 'PartyMembership rows', `SELECT COUNT(*)::text AS n FROM "PartyMembership"`)
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[probe-3a-b] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
