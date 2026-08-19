/**
 * probe-3a-c.ts — GRAPH 3A §1, third pass.
 *
 * The load-bearing question here is §1.3: is `division_votes.party` the party AS AT THE DIVISION,
 * or the party as at ingest? The 2D-2 view comment asserts the former. An assertion in a comment is
 * not a measurement, so this tests it the only way that can fail: take members who show more than
 * one party across their votes and check whether the party changes at a clean DATE boundary
 * (as-at-vote) or is scattered through time (as-at-ingest / mixed).
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
    await q(pool, 'corpus_sections columns', `
      SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='corpus_sections' ORDER BY ordinal_position`)

    await q(pool, 'corpus_targets: what collections exist', `
      SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='corpus_targets' ORDER BY ordinal_position`)

    // ─── §1.3 party-at-time-of-vote ────────────────────────────────────────────────────────────
    await q(pool, 'members with >1 party: is the change DATED (as-at-vote) or scattered?', `
      WITH multi AS (
        SELECT member_id FROM division_votes WHERE party IS NOT NULL
         GROUP BY member_id HAVING COUNT(DISTINCT party) > 1 LIMIT 400),
      spans AS (
        SELECT v.member_id, v.party, MIN(v.division_date) AS first_seen, MAX(v.division_date) AS last_seen,
               COUNT(*)::int AS n
          FROM division_votes v JOIN multi m ON m.member_id = v.member_id
         GROUP BY 1,2),
      ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY first_seen) AS rn,
               LAG(last_seen) OVER (PARTITION BY member_id ORDER BY first_seen) AS prev_last
          FROM spans)
      SELECT COUNT(*) FILTER (WHERE rn > 1 AND first_seen > prev_last)::text AS clean_transitions,
             COUNT(*) FILTER (WHERE rn > 1 AND first_seen <= prev_last)::text AS overlapping_transitions
        FROM ranked`)

    await q(pool, 'a named defector, spans in order (hand-checkable)', `
      SELECT v.member_id, MAX(v.member_name) AS name, v.party,
             MIN(v.division_date)::text AS first, MAX(v.division_date)::text AS last, COUNT(*)::text AS n
        FROM division_votes v
       WHERE v.member_id IN (
         SELECT member_id FROM division_votes WHERE party IS NOT NULL
          GROUP BY member_id HAVING COUNT(DISTINCT party) > 1
          ORDER BY COUNT(*) DESC LIMIT 6)
       GROUP BY v.member_id, v.party ORDER BY v.member_id, first`, [], 60)

    await q(pool, 'party distribution (top 20)', `
      SELECT party, party_abbrev, COUNT(*)::text AS n, COUNT(DISTINCT member_id)::text AS members
        FROM division_votes GROUP BY 1,2 ORDER BY 3::bigint DESC LIMIT 20`)

    // ─── committee membership / witness appearances ────────────────────────────────────────────
    await q(pool, 'gave-evidence-to: subject kinds', `
      SELECT e.kind, COUNT(*)::text AS n, COUNT(DISTINCT ge.subject_id)::text AS actors
        FROM graph_edge ge JOIN graph_entity e ON e.id = ge.subject_id
       WHERE ge.predicate = 'gave-evidence-to' GROUP BY 1 ORDER BY 2::bigint DESC`)

    await q(pool, 'declared-interest: subject/object kinds', `
      SELECT s.kind AS subject_kind, o.kind AS object_kind, COUNT(*)::text AS n
        FROM graph_edge ge
        JOIN graph_entity s ON s.id = ge.subject_id
        LEFT JOIN graph_entity o ON o.id = ge.object_entity_id
       WHERE ge.predicate = 'declared-interest' GROUP BY 1,2`)

    await q(pool, 'declared-interest sample rows', `
      SELECT ge.id, s.canonical_name AS person, s.parl_member_id, o.canonical_name AS org,
             ge.first_seen::text, ge.last_seen::text, ge.n_evidence
        FROM graph_edge ge
        JOIN graph_entity s ON s.id = ge.subject_id
        LEFT JOIN graph_entity o ON o.id = ge.object_entity_id
       WHERE ge.predicate = 'declared-interest' ORDER BY random() LIMIT 8`)

    await q(pool, 'graph_evidence observed_on coverage by predicate', `
      SELECT ge.predicate, COUNT(*)::text AS evidence_rows,
             COUNT(*) FILTER (WHERE ev.observed_on IS NOT NULL)::text AS dated
        FROM graph_evidence ev JOIN graph_edge ge ON ge.id = ev.edge_id GROUP BY 1`)
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[probe-3a-c] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
