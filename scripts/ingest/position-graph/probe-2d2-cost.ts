/**
 * probe-2d2-cost.ts — predict before writing (docs/CLAUDE.md storage rules + the
 * predict-measure-commit discipline). §1 wants up to 2.53M edges and 2.53M evidence rows in a
 * database the handoff last recorded at ~16 GB against a 17.5 GB line. That has to be sized from
 * measured per-row cost, not from a guess, BEFORE anything is written.
 *
 * Also settles the evidence question: graph_evidence has an FK to corpus_sections, so a `voted`
 * edge can only reach 100% coverage if every division has a section. Does it?
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/probe-2d2-cost.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}
const pool = getNeonPool()
const q = async <T = any>(sql: string, p: any[] = []): Promise<T[]> => (await pool.query(sql, p)).rows as T[]
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 76 - s.length))}`)

async function main() {
  head('DATABASE SIZE')
  console.table(await q(`SELECT pg_size_pretty(pg_database_size(current_database())) AS total`))
  console.log('  largest tables:')
  console.table(await q(`SELECT relname AS table, pg_size_pretty(pg_total_relation_size(c.oid)) AS total,
      pg_size_pretty(pg_relation_size(c.oid)) AS heap,
      pg_size_pretty(pg_indexes_size(c.oid)) AS indexes
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r'
    ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 12`))

  head('MEASURED PER-ROW COST OF THE GRAPH TABLES')
  console.table(await q(`SELECT relname AS table, c.reltuples::bigint AS rows,
      pg_total_relation_size(c.oid) AS bytes,
      CASE WHEN c.reltuples > 0 THEN ROUND((pg_total_relation_size(c.oid)/c.reltuples)::numeric,1) END AS bytes_per_row
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND relname LIKE 'graph_%'
    ORDER BY 3 DESC`))
  console.log('  and division_votes, whose row count §1 would mirror:')
  console.table(await q(`SELECT relname AS table, c.reltuples::bigint AS rows,
      pg_size_pretty(pg_total_relation_size(c.oid)) AS total,
      CASE WHEN c.reltuples > 0 THEN ROUND((pg_total_relation_size(c.oid)/c.reltuples)::numeric,1) END AS bytes_per_row
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND relname IN ('division_votes','divisions')`))

  head('EVIDENCE: does every division have a corpus_sections row?')
  const cands = await q<{ corpus: string; n: string }>(
    `SELECT corpus, COUNT(*)::text AS n FROM corpus_sections
     WHERE corpus ILIKE '%division%' OR corpus ILIKE '%vote%' GROUP BY 1 ORDER BY 2 DESC`)
  console.table(cands)
  for (const c of cands) {
    console.table(await q(`SELECT id, LEFT("sectionTitle",70) AS title, "itemDate", "parentDocId", LEFT("sourceUrl",80) AS url
      FROM corpus_sections WHERE corpus=$1 LIMIT 4`, [c.corpus]))
  }
  // The join that matters: division (house, division_id) → a section id.
  for (const c of cands) {
    console.log(`  ${c.corpus}: coverage against the divisions table —`)
    console.table(await q(`SELECT
        (SELECT COUNT(*)::int FROM divisions) AS divisions,
        COUNT(*)::int AS sections,
        COUNT(DISTINCT "parentDocId")::int AS distinct_parents
      FROM corpus_sections WHERE corpus=$1`, [c.corpus]))
  }

  head('EDM EVIDENCE: is every motion a section we hold?')
  console.table(await q(`SELECT COUNT(*)::int AS edm_sections,
      COUNT(DISTINCT "parentDocId")::int AS distinct_motions,
      COUNT(*) FILTER (WHERE "r2Key" IS NOT NULL)::int AS with_r2
    FROM corpus_sections WHERE corpus='early-day-motions'`))

  head('WHERE THE GRAPH PEOPLE CAME FROM (which of them could an MNIS key even reach?)')
  console.table(await q(`SELECT a.source, COUNT(DISTINCT e.id)::int AS people
    FROM graph_entity e JOIN graph_alias a ON a.entity_id=e.id
    WHERE e.kind='person' GROUP BY 1 ORDER BY 2 DESC`))
  console.log('  people entities by whether they hold any edge, and which:')
  console.table(await q(`SELECT g.predicate, COUNT(DISTINCT g.subject_id)::int AS people, COUNT(*)::int AS edges
    FROM graph_edge g JOIN graph_entity e ON e.id=g.subject_id WHERE e.kind='person' GROUP BY 1 ORDER BY 3 DESC`))

  await endNeonPool()
}
main().catch((e) => { console.error('[probe-2d2-cost] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
