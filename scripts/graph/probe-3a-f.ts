/**
 * probe-3a-f.ts — GRAPH 3A: the indexes the derived-vote route depends on, and the cohesion shape.
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
    await q(pool, 'indexes on division_votes / divisions / edm_sponsor / graph_edge / graph_entity', `
      SELECT tablename, indexname, indexdef FROM pg_indexes
       WHERE schemaname='public' AND tablename IN
             ('division_votes','divisions','edm_sponsor','graph_edge','graph_entity','graph_evidence')
       ORDER BY tablename, indexname`)

    // The cohesion computation, run once as a dry read to see the shape and the cost.
    await q(pool, 'cohesion: per division × party, majority side and share (top rows)', `
      WITH pv AS (
        SELECT house, division_id, party,
               COUNT(*) FILTER (WHERE vote='aye')::int AS ayes,
               COUNT(*) FILTER (WHERE vote='no')::int  AS noes
          FROM division_votes WHERE vote IN ('aye','no') AND party IS NOT NULL
         GROUP BY 1,2,3)
      SELECT COUNT(*)::text AS party_division_rows,
             COUNT(DISTINCT (house, division_id))::text AS divisions,
             COUNT(*) FILTER (WHERE ayes+noes >= 20)::text AS rows_20plus
        FROM pv`)

    await q(pool, 'how many divisions have a MAJOR party present at n>=20', `
      WITH pv AS (
        SELECT house, division_id, party,
               COUNT(*) FILTER (WHERE vote='aye')::int AS ayes,
               COUNT(*) FILTER (WHERE vote='no')::int  AS noes
          FROM division_votes WHERE vote IN ('aye','no') AND party IS NOT NULL
         GROUP BY 1,2,3)
      SELECT COUNT(DISTINCT (house, division_id))::text AS divisions_with_major_party
        FROM pv WHERE party IN ('Conservative','Labour','Liberal Democrat')
          AND ayes+noes >= 20`)

    await q(pool, 'Terminally Ill Adults 2R (2024-11-29): party cohesion — the hand-checkable case', `
      SELECT party,
             COUNT(*) FILTER (WHERE vote='aye')::text AS ayes,
             COUNT(*) FILTER (WHERE vote='no')::text AS noes
        FROM division_votes WHERE house='commons' AND division_id=1877 AND vote IN ('aye','no')
       GROUP BY 1 ORDER BY (COUNT(*)) DESC LIMIT 8`)

    await q(pool, 'a whipped control — a recent government Bill 2R', `
      SELECT d.title, v.party,
             COUNT(*) FILTER (WHERE v.vote='aye')::text AS ayes,
             COUNT(*) FILTER (WHERE v.vote='no')::text AS noes
        FROM division_votes v JOIN divisions d ON d.house=v.house AND d.division_id=v.division_id
       WHERE v.house='commons' AND v.division_id=2074 AND v.vote IN ('aye','no')
       GROUP BY 1,2 ORDER BY (COUNT(*)) DESC LIMIT 8`)
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[probe-3a-f] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
