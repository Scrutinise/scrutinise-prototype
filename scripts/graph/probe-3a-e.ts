/**
 * probe-3a-e.ts — GRAPH 3A §1, fifth pass: the two stores that look absent, checked properly
 * before they are reported absent (docs/CLAUDE.md §0 — verify before asserting).
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

async function q<T extends Record<string, unknown>>(pool: ReturnType<typeof getNeonPool>, label: string, sql: string, params: unknown[] = [], limit = 40) {
  const t0 = Date.now()
  const { rows } = await pool.query<T>(sql, params)
  console.log(`\n──── ${label}  (${rows.length} rows, ${Date.now() - t0}ms)`)
  for (const r of rows.slice(0, limit)) console.log('   ', JSON.stringify(r))
  if (rows.length > limit) console.log(`    … ${rows.length - limit} more`)
  return rows
}

async function main() {
  const pool = getNeonPool()
  try {
    await q(pool, 'graph_member_post: any COMMITTEE memberships hiding in there?', `
      SELECT kind, COUNT(*)::text AS n, COUNT(DISTINCT mnis_id)::text AS members
        FROM graph_member_post WHERE post_norm LIKE '%committee%' GROUP BY 1`)
    await q(pool, 'graph_member_post committee-ish sample', `
      SELECT mnis_id, kind, left(post_name,90) AS post_name, start_date::text, end_date::text
        FROM graph_member_post WHERE post_norm LIKE '%committee%' ORDER BY random() LIMIT 12`)

    await q(pool, 'graph_office_post committee classifications', `
      SELECT classification, COUNT(*)::text AS n FROM graph_office_post
       WHERE post_norm LIKE '%committee%' GROUP BY 1 ORDER BY 2::bigint DESC`)

    await q(pool, 'do we hold ANY bill sponsor rows (search every table name)', `
      SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema='public' AND (column_name ILIKE '%sponsor%' OR column_name ILIKE '%bill_id%'
             OR column_name ILIKE '%billId%') ORDER BY 1,2`)

    await q(pool, 'lords motion_notes sample (division question text)', `
      SELECT house, division_id, division_date::text, left(title,70) AS title, left(motion_notes,160) AS notes
        FROM divisions WHERE motion_notes IS NOT NULL ORDER BY random() LIMIT 6`)

    // Free-vote sanity: do the classic free votes EXIST in `divisions` at all? If they are absent
    // from the corpus, §3.1's sanity list cannot contain them and that is a fact about coverage,
    // not about the heuristic.
    await q(pool, 'classic free votes present in `divisions`?', `
      SELECT house, division_id, division_date::text, left(title,110) AS title
        FROM divisions
       WHERE title ILIKE '%assisted dying%' OR title ILIKE '%assisted suicide%'
          OR title ILIKE '%terminally ill adults%'
          OR title ILIKE '%hunting%' OR title ILIKE '%abortion%'
          OR bill_title ILIKE '%terminally ill adults%'
       ORDER BY division_date`, [], 60)

    await q(pool, 'entity coverage of the 120 unresolved voting members', `
      SELECT v.member_id, MAX(v.member_name) AS name, COUNT(*)::text AS votes,
             MIN(v.division_date)::text AS first, MAX(v.division_date)::text AS last,
             EXISTS (SELECT 1 FROM graph_member_register r WHERE r.mnis_id=v.member_id) AS in_register
        FROM division_votes v
       WHERE NOT EXISTS (SELECT 1 FROM graph_entity e WHERE e.parl_member_id=v.member_id AND e.kind='person')
       GROUP BY v.member_id ORDER BY 3::bigint DESC LIMIT 25`)

    await q(pool, 'unresolved EDM sponsors', `
      SELECT s.mnis_id, MAX(s.sponsor_name) AS name, COUNT(*)::text AS motions,
             EXISTS (SELECT 1 FROM graph_member_register r WHERE r.mnis_id=s.mnis_id) AS in_register
        FROM edm_sponsor s
       WHERE NOT EXISTS (SELECT 1 FROM graph_entity e WHERE e.parl_member_id=s.mnis_id AND e.kind='person')
       GROUP BY s.mnis_id ORDER BY 3::bigint DESC LIMIT 15`)
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[probe-3a-e] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
