/**
 * audit-4a-tables.ts — GRAPH 4A §6: what IS the relationship between
 * `citation_edge` and the older July `legislation_edges`?
 *
 * ▶ The brief calls this the question that blocks the layers: unanswered, the
 * layers get added twice. Duplicate, complementary, or one superseding?
 *
 * Measured here rather than argued, on four axes:
 *   1. EDGE TYPES. `legislation_edges` holds six; `citation_edge` holds exactly
 *      one relationship (a textual reference) with a detector column.
 *   2. OVERLAP on the one type they share. Compared at (source gid → target
 *      gid) grain, because the two tables have different row semantics —
 *      `legislation_edges` is one row per (from, to, type, sub_type) and
 *      `citation_edge` is one row per citation INSTANCE.
 *   3. ⚠⚠ IDENTITY. They do not agree on what a pre-1963 Act is called.
 *      `legislation_edges` stores the URI's own calendar form (`ukpga/1925/86`);
 *      `citation_edge` normalises to the regnal form legislation.gov.uk treats
 *      as canonical (`ukpga/Geo5/15-16/86`). **Any naive join or union on gid
 *      silently loses every pre-1963 Act** — and it will look like a coverage
 *      result, not a bug.
 *   4. EVIDENCE. `citation_edge` can quote its source; `legislation_edges`
 *      cannot, by construction — it has no text column at all.
 *
 * Reads only.
 *
 *   npx tsx graph/audit-4a-tables.ts [--json out.json]
 */
import fs from 'fs'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { EDGE_TABLE } from './graph-common'

async function main() {
  const pool = getNeonPool()
  const out: Record<string, unknown> = { at: new Date().toISOString() }

  console.log('── 1. WHAT EACH TABLE HOLDS ──')
  const { rows: le } = await pool.query(
    `SELECT edge_type, source, COUNT(*)::bigint n FROM ${EDGE_TABLE} GROUP BY 1,2 ORDER BY n DESC`)
  console.log(`  ${EDGE_TABLE}:`)
  for (const r of le) console.log(`    ${String(r.edge_type).padEnd(12)} ${String(r.source).padEnd(24)} ${String(r.n).padStart(9)}`)
  const { rows: ce } = await pool.query(
    `SELECT detection, source_type, COUNT(*)::bigint n FROM ${CITATION_TABLE} GROUP BY 1,2 ORDER BY n DESC`)
  console.log(`  ${CITATION_TABLE}: one relationship (textual reference), split by detector`)
  for (const r of ce) console.log(`    ${String(r.detection).padEnd(12)} ${String(r.source_type).padEnd(24)} ${String(r.n).padStart(9)}`)
  out.legislationEdges = le
  out.citationEdge = ce

  console.log('\n── 2. OVERLAP ON THE SHARED TYPE (cites), AT (source gid → target gid) GRAIN ──')
  const { rows: ov } = await pool.query(`
    WITH e AS (
      SELECT DISTINCT split_part(from_id, ':', 2) AS src, split_part(to_id, ':', 2) AS tgt
      FROM ${EDGE_TABLE} WHERE edge_type = 'cites'),
    c AS (
      SELECT DISTINCT source_gid AS src, target_act_id AS tgt
      FROM ${CITATION_TABLE} WHERE target_act_id IS NOT NULL)
    SELECT (SELECT COUNT(*)::bigint FROM e) AS edges_pairs,
           (SELECT COUNT(*)::bigint FROM c) AS citation_pairs,
           (SELECT COUNT(*)::bigint FROM e JOIN c USING (src, tgt)) AS both,
           (SELECT COUNT(*)::bigint FROM e WHERE NOT EXISTS (SELECT 1 FROM c WHERE c.src=e.src AND c.tgt=e.tgt)) AS only_edges,
           (SELECT COUNT(*)::bigint FROM c WHERE NOT EXISTS (SELECT 1 FROM e WHERE e.src=c.src AND e.tgt=c.tgt)) AS only_citation`)
  const o = ov[0]
  const bothN = Number(o.both), ep = Number(o.edges_pairs), cp = Number(o.citation_pairs)
  console.log(`  distinct pairs in ${EDGE_TABLE} (cites) : ${ep.toLocaleString()}`)
  console.log(`  distinct pairs in ${CITATION_TABLE}      : ${cp.toLocaleString()}`)
  console.log(`  in BOTH                                  : ${bothN.toLocaleString()}`)
  console.log(`  only in ${EDGE_TABLE}                    : ${Number(o.only_edges).toLocaleString()}  (${(100 * Number(o.only_edges) / ep).toFixed(1)}% of it)`)
  console.log(`  only in ${CITATION_TABLE}                : ${Number(o.only_citation).toLocaleString()}`)
  out.overlap = o

  console.log('\n── 3. ⚠⚠ THE IDENTITY MISMATCH ──')
  const { rows: id } = await pool.query(`
    SELECT
      (SELECT COUNT(DISTINCT split_part(to_id,':',2))::bigint FROM ${EDGE_TABLE}
        WHERE edge_type='cites' AND split_part(to_id,':',2) ~ '^[a-z]+/[A-Za-z]') AS edges_regnal_targets,
      (SELECT COUNT(DISTINCT target_act_id)::bigint FROM ${CITATION_TABLE}
        WHERE target_act_id ~ '^[a-z]+/[A-Za-z]') AS citation_regnal_targets,
      (SELECT COUNT(*)::bigint FROM ${CITATION_TABLE}
        WHERE target_act_id ~ '^[a-z]+/[A-Za-z]') AS citation_regnal_rows`)
  console.log(`  distinct REGNAL-form targets in ${EDGE_TABLE} cites : ${id[0].edges_regnal_targets}`)
  console.log(`  distinct REGNAL-form targets in ${CITATION_TABLE}    : ${id[0].citation_regnal_targets}  (${Number(id[0].citation_regnal_rows).toLocaleString()} rows)`)
  console.log(`  → the two tables name the same pre-1963 Act differently. A join on gid drops them.`)

  // the same Act, both ways round — proof by example, not by argument
  const { rows: ex } = await pool.query(`
    SELECT c.target_act_id AS citation_form, c.target_uri,
           (SELECT COUNT(*)::int FROM ${EDGE_TABLE} e
             WHERE e.edge_type='cites' AND split_part(e.to_id,':',2) = replace(replace(c.target_uri,'http://www.legislation.gov.uk/id/',''),'https://www.legislation.gov.uk/id/','')) AS edges_rows_under_uri_form,
           (SELECT COUNT(*)::int FROM ${EDGE_TABLE} e
             WHERE e.edge_type='cites' AND split_part(e.to_id,':',2) = c.target_act_id) AS edges_rows_under_citation_form
    FROM ${CITATION_TABLE} c
    WHERE c.detection='markup' AND c.target_act_id ~ '^[a-z]+/[A-Za-z]'
    GROUP BY 1,2 ORDER BY 3 DESC LIMIT 6`)
  console.log(`\n  worked examples — the SAME Act, looked up both ways in ${EDGE_TABLE}:`)
  console.log(`    citation_edge form        source URI form           rows under URI form / under citation form`)
  for (const r of ex) {
    const uriForm = String(r.target_uri).replace(/https?:\/\/www\.legislation\.gov\.uk\/id\//, '')
    console.log(`    ${String(r.citation_form).padEnd(24)}  ${uriForm.padEnd(22)}  ${String(r.edges_rows_under_uri_form).padStart(5)} / ${r.edges_rows_under_citation_form}`)
  }
  out.identity = { counts: id[0], examples: ex }

  console.log('\n── 4. EVIDENCE ──')
  const { rows: evi } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [EDGE_TABLE])
  const cols = evi.map((r: { column_name: string }) => r.column_name)
  console.log(`  ${EDGE_TABLE} columns: ${cols.join(', ')}`)
  console.log(`  → carries the quoted source text: ${cols.includes('citation_text') || cols.includes('raw_fragment') ? 'YES' : 'NO — an edge here cannot be quoted, only asserted'}`)
  console.log(`  ${CITATION_TABLE} carries citation_text + raw_fragment, both NOT NULL.`)
  out.evidenceColumns = cols

  console.log('\n── 5. WHAT WOULD RETIRING THE cites ROWS TAKE? ──')
  const { rows: dep } = await pool.query(`
    SELECT COUNT(*)::bigint cites_rows,
           pg_size_pretty(pg_total_relation_size($1)) AS table_size
    FROM ${EDGE_TABLE} WHERE edge_type='cites'`, [EDGE_TABLE])
  console.log(`  cites rows: ${Number(dep[0].cites_rows).toLocaleString()} of a ${dep[0].table_size} table`)
  console.log(`  three code paths read them (traverse-edges.impactSet, edges-query-service, score-gold-d)`)
  console.log(`  plus v37-citation-gaps' census. Retiring them means repointing impactSet's citedBy`)
  console.log(`  group at ${CITATION_TABLE} — which needs the identity bridge from §3 above first,`)
  console.log(`  or the traversal loses every pre-1963 Act it can currently reach.`)
  out.retirement = dep[0]

  const jsonIx = process.argv.indexOf('--json')
  if (jsonIx >= 0 && process.argv[jsonIx + 1]) {
    fs.writeFileSync(process.argv[jsonIx + 1], JSON.stringify(out, null, 1))
    console.log(`\n[4a-§6] → ${process.argv[jsonIx + 1]}`)
  }
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[4a-§6] FATAL', e); process.exit(1) })
}
