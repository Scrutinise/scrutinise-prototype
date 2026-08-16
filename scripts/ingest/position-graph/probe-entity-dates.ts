/**
 * probe-entity-dates.ts — is graph_entity.first_seen an EVIDENCE date or an INGEST date?
 *
 * The §2 date test killed 255 otherwise-clean register matches, and every killed row showed the
 * entity living for a single day in June 2026. That is either 255 witnesses who all appeared once
 * this June, or a date column that records when we wrote the row. Those are very different things
 * and the test is worthless under the second, so it gets checked rather than assumed.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
export {}

const pool = getNeonPool()
const t = async (label: string, sql: string, args: any[] = []) => {
  const r = await pool.query(sql, args)
  console.log(`\n--- ${label}`)
  console.table(r.rows)
}

async function main() {
  await t('person entity first_seen by year (top 12)',
    `SELECT EXTRACT(YEAR FROM first_seen)::int AS yr, COUNT(*)::int AS n
       FROM graph_entity WHERE kind='person' GROUP BY 1 ORDER BY 2 DESC LIMIT 12`)
  await t('shape of those dates',
    `SELECT COUNT(*) FILTER (WHERE first_seen IS NULL)::int AS null_first,
            COUNT(*) FILTER (WHERE first_seen = last_seen)::int AS single_day,
            COUNT(*)::int AS total FROM graph_entity WHERE kind='person'`)
  await t('five entities the date test killed',
    `SELECT id, canonical_name, first_seen, last_seen, key_source, confidence
       FROM graph_entity WHERE id IN (272,1282,1214,1527,476)`)
  await t('…and the dates on the EDGES those entities hold',
    `SELECT e.id, e.canonical_name, MIN(g.first_seen) AS edge_first, MAX(g.last_seen) AS edge_last,
            COUNT(*)::int AS edges
       FROM graph_entity e JOIN graph_edge g ON g.subject_id = e.id
      WHERE e.id IN (272,1282,1214,1527,476) GROUP BY 1,2`)
  await t('…and the dates on their EVIDENCE',
    `SELECT e.id, e.canonical_name, MIN(ev.observed_on) AS ev_min, MAX(ev.observed_on) AS ev_max,
            COUNT(*)::int AS evidence
       FROM graph_entity e JOIN graph_edge g ON g.subject_id = e.id
       JOIN graph_evidence ev ON ev.edge_id = g.id
      WHERE e.id IN (272,1282,1214,1527,476) GROUP BY 1,2`)
  await t('do edge dates and entity dates agree across the whole person population?',
    `WITH x AS (
       SELECT e.id, e.first_seen AS ent_first, MIN(g.first_seen) AS edge_first
         FROM graph_entity e JOIN graph_edge g ON g.subject_id = e.id
        WHERE e.kind='person' GROUP BY 1,2)
     SELECT COUNT(*)::int AS people,
            COUNT(*) FILTER (WHERE ent_first = edge_first)::int AS same,
            COUNT(*) FILTER (WHERE ent_first <> edge_first)::int AS differ,
            COUNT(*) FILTER (WHERE edge_first IS NULL)::int AS edge_date_null
       FROM x`)
  await t('edge first_seen by year — the comparison that settles it',
    `SELECT EXTRACT(YEAR FROM g.first_seen)::int AS yr, COUNT(DISTINCT g.subject_id)::int AS people
       FROM graph_edge g JOIN graph_entity e ON e.id=g.subject_id
      WHERE e.kind='person' GROUP BY 1 ORDER BY 1 DESC LIMIT 15`)
  await endNeonPool()
}
main().catch((e) => { console.error('FATAL', e instanceof Error ? e.message : e); process.exit(1) })
