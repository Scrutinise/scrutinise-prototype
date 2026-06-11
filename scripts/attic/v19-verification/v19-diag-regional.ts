import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const q = async (label: string, sql: string) => {
    const r = await pool.query(sql)
    console.log(`\n=== ${label} ===`)
    console.table(r.rows)
  }
  await q('regional: sections by type + status', `
    SELECT split_part(split_part(id,':',2),'/',1) AS type, status, count(*)::int n
    FROM corpus_sections WHERE corpus='regional' GROUP BY 1,2 ORDER BY 1,2`)
  await q('regional: suspicious uniform-html check', `
    SELECT format, count(*)::int n, avg("wordCount")::int avg_w, stddev("wordCount")::int sd_w
    FROM corpus_sections WHERE corpus='regional' AND status='compiled' GROUP BY 1`)
  await q('si-pre-2010: status breakdown', `
    SELECT status, count(*)::int n FROM corpus_sections WHERE corpus='si-pre-2010' GROUP BY 1`)
  await q('si-pre-2010 failed sample', `
    SELECT id, "errorMsg" FROM corpus_sections WHERE corpus='si-pre-2010' AND status NOT IN ('compiled','unavailable') LIMIT 12`)
  await q('lda-commonsoralquestions: queue + sections', `
    SELECT (SELECT count(*) FROM ingest_queue WHERE corpus='lda-commonsoralquestions' AND status='failed')::int q_failed,
           (SELECT count(*) FROM ingest_queue WHERE corpus='lda-commonsoralquestions' AND status='pending')::int q_pending,
           (SELECT count(*) FROM corpus_sections WHERE corpus='lda-commonsoralquestions')::int sections`)
  await q('regional queue', `
    SELECT status, count(*)::int n FROM ingest_queue WHERE corpus='regional' GROUP BY 1`)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
