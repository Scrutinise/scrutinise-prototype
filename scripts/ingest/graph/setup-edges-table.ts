/**
 * setup-edges-table.ts — create the Neon `legislation_edges` table + indexes.
 * Idempotent (CREATE IF NOT EXISTS). Run once before the extractors.
 *
 *   npx tsx graph/setup-edges-table.ts          — create
 *   npx tsx graph/setup-edges-table.ts --status — row counts + table size only
 *
 * Size discipline: the edge table is budgeted <1.5 GB; every extractor pilots
 * and extrapolates volume BEFORE a full load, and --status reports actual size.
 *
 * ⚠⚠ CORRECTED 2026-08-26. This header used to read "Neon is at ~15 GB of the
 * 17.5 GB alert line (measured 2026-07-05)". **THERE IS NO SUCH LINE AND THERE
 * NEVER WAS.** `neon.max_cluster_size` is 16 TiB; storage is a BILL, not a WALL
 * — $0.35/GB-month against a $15/month budget (`search/serve-observer.ts`,
 * which says so in as many words). The 17.5 figure was our own constant, and
 * its provenance was a closed loop: the constant's comment cited the handoff,
 * and the handoff's number was emitted by the constant. GRAPH 3B §4.1 traced
 * it; GRAPH 3C §5 retired it.
 *
 * The correction is recorded HERE, in the file, because leaving it out is how
 * it came back: sprint 25-H read this comment, took it as authority, and
 * published "Neon is past its alert line" as a finding — a month after the
 * project had proved the line did not exist.
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { EDGE_TABLE } from './graph-common'

const DDL = `
CREATE TABLE IF NOT EXISTS ${EDGE_TABLE} (
  from_id      text NOT NULL,
  to_id        text NOT NULL,
  edge_type    text NOT NULL,             -- amends | repeals | commences | modifies | cites | made-under
  sub_type     text NOT NULL DEFAULT '',  -- normalised raw effect type ('' for cites/made-under)
  source       text NOT NULL,             -- provenance, e.g. tna-bulk-amendments-2025-10-30
  granularity  text NOT NULL,             -- section-section | section-act | act-section | act-act
  detail       text,                      -- commences: inforce date|qualification|applied; made-under: powers phrase
  extracted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_id, to_id, edge_type, sub_type)
);
-- gid-level lookups both directions (ids are '{corpus}:{gid}[:{sectionRef}]')
CREATE INDEX IF NOT EXISTS legislation_edges_from_gid ON ${EDGE_TABLE} (split_part(from_id, ':', 2), edge_type);
CREATE INDEX IF NOT EXISTS legislation_edges_to_gid   ON ${EDGE_TABLE} (split_part(to_id,   ':', 2), edge_type);
`

async function main() {
  const pool = getNeonPool()
  if (!process.argv.includes('--status')) {
    await pool.query(DDL)
    console.log(`[setup-edges] ${EDGE_TABLE} + indexes ensured`)
  }
  const stats = await pool.query(`
    SELECT edge_type, source, granularity, COUNT(*)::bigint AS n
    FROM ${EDGE_TABLE} GROUP BY 1, 2, 3 ORDER BY n DESC`)
  const size = await pool.query(`SELECT pg_size_pretty(pg_total_relation_size('${EDGE_TABLE}')) AS sz,
                                        pg_size_pretty(pg_database_size(current_database())) AS db`)
  console.log(`[setup-edges] table size: ${size.rows[0].sz} (database: ${size.rows[0].db})`)
  if (stats.rows.length === 0) console.log('[setup-edges] table empty')
  for (const r of stats.rows) console.log(`  ${r.edge_type}\t${r.granularity}\t${r.source}\t${r.n}`)
  await endNeonPool()
}
main().catch(e => { console.error('[setup-edges] FATAL', e); process.exit(1) })
