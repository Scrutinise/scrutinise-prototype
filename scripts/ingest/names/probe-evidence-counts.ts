import { getNeonPool, endNeonPool } from '../shared/neon-pool'
;(async () => {
  const p = getNeonPool()
  const r = await p.query(`
    SELECT split_part("parentDocId", ':', 1) AS kind,
           COUNT(*)::int sections,
           COUNT(DISTINCT "parentDocId")::int items,
           COUNT("sectionTitle")::int titled,
           SUM("wordCount")::bigint words
      FROM corpus_sections WHERE corpus='committees-evidence' GROUP BY 1 ORDER BY 2 DESC`)
  console.table(r.rows)
  const s = await p.query(`
    SELECT status, availability_status, COUNT(*)::int n
      FROM corpus_sections WHERE corpus='committees-evidence' GROUP BY 1,2 ORDER BY 3 DESC LIMIT 10`)
  console.table(s.rows)
  const rep = await p.query(`
    SELECT (notes::json->>'publicationType') AS pubtype, COUNT(*)::int n, COUNT(DISTINCT "parentDocId")::int items
      FROM corpus_sections WHERE corpus='committees-reports' AND notes IS NOT NULL
      GROUP BY 1 ORDER BY 2 DESC LIMIT 15`)
  console.table(rep.rows)
  const repNo = await p.query(`
    SELECT COUNT(*)::int n, COUNT(DISTINCT "parentDocId")::int items
      FROM corpus_sections WHERE corpus='committees-reports' AND notes IS NULL`)
  console.log('committees-reports rows with NO notes:', JSON.stringify(repNo.rows[0]))
  await endNeonPool()
})().catch(e => { console.error(e); process.exit(1) })
