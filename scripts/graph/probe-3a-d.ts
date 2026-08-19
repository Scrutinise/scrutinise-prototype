/**
 * probe-3a-d.ts — GRAPH 3A §1, fourth pass: the corpora, and the two stores the brief expects
 * that may not exist (committee membership, bill/amendment sponsorship).
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

async function q<T extends Record<string, unknown>>(pool: ReturnType<typeof getNeonPool>, label: string, sql: string, params: unknown[] = [], limit = 80) {
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
    await q(pool, 'corpus_sections by corpus', `
      SELECT corpus, COUNT(*)::text AS n, MIN("itemDate")::text AS first, MAX("itemDate")::text AS last
        FROM corpus_sections GROUP BY 1 ORDER BY 2::bigint DESC`)

    await q(pool, 'bills corpus sample (is there sponsorship data anywhere?)', `
      SELECT id, left("sectionTitle", 90) AS title, "itemDate"::text, "parentDocId", speaker
        FROM corpus_sections WHERE corpus LIKE 'bill%' ORDER BY random() LIMIT 10`)

    await q(pool, 'members-interests corpus sample', `
      SELECT id, left("sectionTitle", 90) AS title, "itemDate"::text, speaker
        FROM corpus_sections WHERE corpus LIKE '%interest%' ORDER BY random() LIMIT 6`)

    await q(pool, 'gave-evidence-to evidence rows: are they dated + do they carry inquiry refs', `
      SELECT ge.object_ref, ge.object_label, COUNT(*)::text AS n
        FROM graph_edge ge WHERE ge.predicate='gave-evidence-to'
       GROUP BY 1,2 ORDER BY 3::bigint DESC LIMIT 10`)

    await q(pool, 'gave-evidence-to date span', `
      SELECT MIN(ev.observed_on)::text AS first, MAX(ev.observed_on)::text AS last,
             COUNT(*)::text AS n
        FROM graph_evidence ev JOIN graph_edge ge ON ge.id=ev.edge_id
       WHERE ge.predicate='gave-evidence-to'`)

    await q(pool, 'declared-interest date span + org resolution', `
      SELECT MIN(ge.first_seen)::text AS first, MAX(ge.last_seen)::text AS last,
             COUNT(*)::text AS edges,
             COUNT(*) FILTER (WHERE o.key_source IN ('parl-cis-id'))::text AS org_keyed,
             COUNT(*) FILTER (WHERE o.companies_house_no IS NOT NULL OR o.charity_no IS NOT NULL)::text AS org_register
        FROM graph_edge ge LEFT JOIN graph_entity o ON o.id=ge.object_entity_id
       WHERE ge.predicate='declared-interest'`)

    await q(pool, 'graph_org_register: what registers we matched', `
      SELECT register, status, unambiguous, promoted, COUNT(*)::text AS n
        FROM graph_org_register GROUP BY 1,2,3,4 ORDER BY 5::bigint DESC LIMIT 20`)

    await q(pool, 'divisions with no votes / votes with no division', `
      SELECT (SELECT COUNT(*)::text FROM divisions d WHERE NOT EXISTS
                (SELECT 1 FROM division_votes v WHERE v.house=d.house AND v.division_id=d.division_id)) AS divisions_no_votes,
             (SELECT COUNT(*)::text FROM division_votes v WHERE NOT EXISTS
                (SELECT 1 FROM divisions d WHERE d.house=v.house AND d.division_id=v.division_id)) AS votes_no_division`)

    await q(pool, 'graph_edge_all storage breakdown (2D-2 edges, for reconciliation)', `
      SELECT storage, predicate, COUNT(*)::text AS n FROM graph_edge_all GROUP BY 1,2 ORDER BY 3::bigint DESC`)
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[probe-3a-d] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
