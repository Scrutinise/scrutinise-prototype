/**
 * probe-3b.ts — GRAPH 3B §1. Read-only exploration before anything is built.
 *
 * Answers, in order: which database am I on, which divisions are the assisted-dying pair Charlie
 * selected, and what does the estimate layer actually look like.
 *
 * Usage (from scripts/graph):  npx tsx probe-3b.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

async function main() {
  const pool = getNeonPool()
  try {
    // ── §16 whichdb: never touch a database without saying which one it is ──────────────
    const { rows: who } = await pool.query(`
      SELECT current_database() AS db, inet_server_addr()::text AS addr, version() AS v`)
    console.log('WHICHDB:', JSON.stringify(who[0]))
    const host = (process.env.DATABASE_URL ?? '').replace(/:[^:@/]*@/, ':***@')
    console.log('DATABASE_URL host:', host.slice(0, 120))

    const { rows: mig } = await pool.query(`
      SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC NULLS LAST LIMIT 5`)
    for (const m of mig) console.log('   migration:', m.migration_name, m.finished_at)

    // ── the divisions ──────────────────────────────────────────────────────────────────
    console.log('\n──── assisted dying divisions we hold')
    const { rows: divs } = await pool.query(`
      SELECT house, division_id, division_date::text AS d, title
        FROM divisions
       WHERE title ILIKE '%Terminally Ill Adults%' OR bill_title ILIKE '%Terminally Ill Adults%'
       ORDER BY division_date, division_id`)
    for (const r of divs) console.log(`   ${r.house}:${r.division_id}  ${r.d}  ${r.title}`)

    // ── the relations 3A built ─────────────────────────────────────────────────────────
    console.log('\n──── relation sizes')
    const { rows: sizes } = await pool.query(`
      SELECT c.relname, s.n_live_tup::text AS live,
             pg_size_pretty(pg_total_relation_size(c.oid)) AS total
        FROM pg_class c JOIN pg_stat_user_tables s ON s.relid = c.oid
       WHERE c.relname LIKE 'position_%' ORDER BY pg_total_relation_size(c.oid) DESC`)
    for (const r of sizes) console.log(`   ${r.relname.padEnd(28)} ${r.live.padStart(12)}  ${r.total}`)

    console.log('\n──── position_estimate_meta')
    const { rows: meta } = await pool.query(`SELECT * FROM position_estimate_meta`)
    for (const m of meta) console.log('   ', JSON.stringify(m))

    // ── indexes on the read path ───────────────────────────────────────────────────────
    console.log('\n──── indexes on the objects the read query touches')
    const { rows: idx } = await pool.query(`
      SELECT tablename, indexname, indexdef
        FROM pg_indexes
       WHERE tablename IN ('position_signal_stored','position_estimate','division_votes','divisions',
                           'position_division_party','position_division_class','graph_entity','corpus_sections')
       ORDER BY tablename, indexname`)
    for (const r of idx) console.log(`   ${r.tablename.padEnd(26)} ${r.indexdef}`)

    // ── views ─────────────────────────────────────────────────────────────────────────
    console.log('\n──── view definitions')
    const { rows: views } = await pool.query(`
      SELECT viewname FROM pg_views WHERE viewname LIKE 'position_%' OR viewname='graph_entity_identity'`)
    for (const v of views) console.log('   ', v.viewname)
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
