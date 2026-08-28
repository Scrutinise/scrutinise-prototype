/** probe-report-shapes.ts — what raw_fragment / citation_text actually look like,
 *  and whether the source documents' text is reachable for T2 sentence extraction. */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'

async function main() {
  const pool = getNeonPool()
  for (const det of ['markup', 'text', 'enabling']) {
    const { rows } = await pool.query(
      `SELECT source_gid, source_doc_uri, source_provision_ref, source_type, target_provision_ref,
              citation_text, raw_fragment, length(citation_text) ctl, length(raw_fragment) rfl
       FROM ${CITATION_TABLE} WHERE target_act_id = 'ukpga/2010/25' AND detection = $1 LIMIT 2`, [det])
    console.log(`\n===== ${det} =====`)
    for (const r of rows) {
      console.log(`  src=${r.source_gid} prov=${r.source_provision_ref} type=${r.source_type} tgtprov=${r.target_provision_ref}`)
      console.log(`  citation_text (${r.ctl}): ${JSON.stringify(r.citation_text).slice(0, 500)}`)
      console.log(`  raw_fragment  (${r.rfl}): ${JSON.stringify(r.raw_fragment).slice(0, 700)}`)
    }
  }
  // length distribution
  const { rows: dist } = await pool.query(
    `SELECT detection, ROUND(AVG(length(citation_text)))::int avg_ct, MAX(length(citation_text))::int max_ct,
            ROUND(AVG(length(raw_fragment)))::int avg_rf, MAX(length(raw_fragment))::int max_rf
     FROM ${CITATION_TABLE} WHERE target_act_id IN ('ukpga/2010/25','ukpga/1998/42','ukpga/2010/15')
     GROUP BY 1`)
  console.log('\n-- length distribution --'); console.table(dist)

  // are the source documents' full texts in corpus_sections?
  const { rows: reach } = await pool.query(`
    WITH s AS (SELECT DISTINCT source_gid FROM ${CITATION_TABLE}
               WHERE target_act_id IN ('ukpga/2010/25','ukpga/1998/42','ukpga/2010/15'))
    SELECT COUNT(*)::int total,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM corpus_sections cs WHERE split_part(cs.id, ':', 2) = s.source_gid))::int in_corpus
    FROM s`)
  console.log('source docs reachable in corpus_sections:', reach[0])

  // what columns does corpus_sections have
  const { rows: cols } = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='corpus_sections' ORDER BY ordinal_position`)
  console.log('corpus_sections columns:', cols.map((c:any)=>c.column_name).join(', '))

  // target acts' own provisions present?
  for (const gid of ['ukpga/2010/25','ukpga/1998/42','ukpga/2010/15','ukpga/2005/4','ukpga/1998/46','ukpga/1998/47','ukpga/2006/32']) {
    const { rows } = await pool.query(
      `SELECT corpus, COUNT(*)::int n FROM corpus_sections WHERE split_part(id,':',2) = $1 GROUP BY 1`, [gid])
    console.log(`  ${gid}: ${rows.map((r:any)=>`${r.corpus} ${r.n} sections`).join(', ') || 'NOT IN corpus_sections'}`)
  }
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
