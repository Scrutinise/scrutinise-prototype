/**
 * report-3a.ts — GRAPH 3A §7. Every number the report quotes, read from the database in one pass.
 *
 * The report is written by hand; this script produces the figures it cites, so a figure in
 * `docs/GRAPH_3A_REPORT.md` can be re-derived rather than trusted. Read-only.
 *
 * Usage (from scripts/graph):  npx tsx report-3a.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

async function section(pool: ReturnType<typeof getNeonPool>, title: string, sql: string) {
  console.log(`\n──── ${title}`)
  const { rows } = await pool.query(sql)
  for (const r of rows) console.log('   ', JSON.stringify(r))
}

async function main() {
  const pool = getNeonPool()
  try {
    await section(pool, 'A-1 entity layer', `
      SELECT kind, key_source, COUNT(*)::text AS n FROM graph_entity GROUP BY 1,2 ORDER BY 1,3::bigint DESC`)

    await section(pool, 'A-1 exclusion rates', `
      SELECT
        (SELECT COUNT(*)::text FROM division_votes) AS vote_rows,
        (SELECT COUNT(*)::text FROM division_votes v
           JOIN graph_entity e ON e.parl_member_id=v.member_id AND e.kind='person') AS vote_rows_resolved,
        (SELECT COUNT(DISTINCT member_id)::text FROM division_votes) AS members,
        (SELECT COUNT(DISTINCT v.member_id)::text FROM division_votes v
           WHERE NOT EXISTS (SELECT 1 FROM graph_entity e WHERE e.parl_member_id=v.member_id AND e.kind='person')) AS members_unresolved,
        (SELECT COUNT(DISTINCT v.member_id)::text FROM division_votes v
           WHERE NOT EXISTS (SELECT 1 FROM graph_entity e WHERE e.parl_member_id=v.member_id AND e.kind='person')
             AND EXISTS (SELECT 1 FROM graph_member_register r WHERE r.mnis_id=v.member_id)) AS members_unresolved_but_in_register,
        (SELECT COUNT(*)::text FROM edm_sponsor) AS edm_rows,
        (SELECT COUNT(*)::text FROM graph_signed_motion_edge) AS edm_rows_resolved,
        (SELECT COUNT(*)::text FROM graph_edge WHERE predicate='declared-interest') AS interest_edges,
        (SELECT COUNT(*)::text FROM graph_edge WHERE predicate='declared-interest' AND object_entity_id IS NULL) AS interest_org_unresolved`)

    await section(pool, 'A-2 stores', `
      SELECT
        (SELECT COUNT(*)::text FROM division_votes) AS division_votes,
        (SELECT COUNT(*)::text FROM divisions) AS divisions,
        (SELECT COUNT(*)::text FROM divisions WHERE title IS NOT NULL AND title <> '') AS divisions_with_title,
        (SELECT COUNT(*)::text FROM divisions WHERE motion_notes IS NOT NULL) AS divisions_with_motion_text,
        (SELECT COUNT(*)::text FROM edm_sponsor) AS edm_sponsor,
        (SELECT COUNT(*)::text FROM graph_edge WHERE predicate='gave-evidence-to') AS witness_edges,
        (SELECT COUNT(*)::text FROM graph_evidence ev JOIN graph_edge ge ON ge.id=ev.edge_id
          WHERE ge.predicate='gave-evidence-to') AS witness_evidence_rows,
        (SELECT COUNT(*)::text FROM graph_member_post) AS member_posts,
        (SELECT COUNT(*)::text FROM graph_member_post WHERE post_norm LIKE '%committee%') AS member_posts_committee_ish,
        (SELECT COUNT(*)::text FROM corpus_sections WHERE corpus='bills-api') AS bills_api_sections`)

    await section(pool, 'A-3 party at time of vote', `
      SELECT COUNT(*)::text AS rows,
             COUNT(*) FILTER (WHERE party IS NOT NULL AND party <> '')::text AS with_party,
             COUNT(DISTINCT party)::text AS distinct_parties
        FROM division_votes`)

    await section(pool, 'B classification', `
      SELECT free_vote_like, COUNT(*)::text AS n FROM position_division_class GROUP BY 1 ORDER BY 1`)
    await section(pool, 'B free-vote-like with NO whipped party present at all', `
      SELECT COUNT(*)::text AS n FROM position_division_class WHERE free_vote_like AND n_whipped_parties = 0`)
    await section(pool, 'B signal classes', `
      SELECT derivation, COUNT(*)::text AS n,
             ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER (), 2)::text AS pct
        FROM position_signal_vote GROUP BY 1 ORDER BY 2::bigint DESC`)

    await section(pool, 'C the signal layer', `
      SELECT storage, signal_type, direction::text, COUNT(*)::text AS n
        FROM position_signal GROUP BY 1,2,3 ORDER BY 4::bigint DESC`)

    await section(pool, 'D estimates', `
      SELECT target_type, COUNT(*)::text AS n,
             ROUND(AVG(confidence)::numeric,3)::text AS mean_conf,
             ROUND(MAX(confidence)::numeric,3)::text AS max_conf,
             COUNT(*) FILTER (WHERE confidence >= 0.65)::text AS strong,
             COUNT(*) FILTER (WHERE confidence >= 0.35 AND confidence < 0.65)::text AS some
        FROM position_estimate GROUP BY 1 ORDER BY 2::bigint DESC`)

    await section(pool, 'D estimate meta', `
      SELECT config_version, as_of::text, n_estimates::text, n_signals::text,
             ROUND(elapsed_ms/1000.0)::text AS seconds, built_at::text FROM position_estimate_meta ORDER BY id`)

    await section(pool, 'E storage', `
      SELECT pg_size_pretty(pg_relation_size('position_estimate')) AS estimate_heap,
             pg_size_pretty(pg_indexes_size('position_estimate')) AS estimate_indexes,
             pg_size_pretty(pg_total_relation_size('position_estimate')) AS estimate_total,
             pg_size_pretty(pg_total_relation_size('position_signal_stored')) AS signals_total,
             pg_size_pretty(pg_total_relation_size('position_division_party')) AS division_party,
             pg_size_pretty(pg_total_relation_size('position_division_class')) AS division_class,
             ROUND((pg_database_size(current_database())/1024.0^3)::numeric, 2)::text AS db_gib,
             ROUND((100*pg_database_size(current_database())/(17.5*1024^3))::numeric, 1)::text AS pct_of_alert_line`)

    await section(pool, 'E how many estimates actually aggregate more than one signal', `
      SELECT 'inquiry' AS target_type,
             ((SELECT COUNT(*) FROM position_signal_stored WHERE signal_type='witness_appearance')
              - (SELECT COUNT(*) FROM position_estimate WHERE target_type='inquiry'))::text AS extra_signals
      UNION ALL
      SELECT 'organisation',
             ((SELECT COUNT(*) FROM position_signal_stored WHERE signal_type='declared_interest')
              - (SELECT COUNT(*) FROM position_estimate WHERE target_type='organisation'))::text`)

    await section(pool, 'F the strongest recorded records in the graph (sanity, eyeballable)', `
      SELECT e.canonical_name, pe.target_type, pe.target_id,
             ROUND(pe.stance_score::numeric,2)::text AS stance,
             ROUND(pe.confidence::numeric,3)::text AS conf,
             pe.signal_counts::text
        FROM position_estimate pe JOIN graph_entity e ON e.id = pe.actor_id
       ORDER BY pe.confidence DESC LIMIT 10`)
  } finally {
    await endNeonPool()
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('[report-3a] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
}
