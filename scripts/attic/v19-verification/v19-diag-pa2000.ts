import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const q = async (label: string, sql: string) => {
    const r = await pool.query(sql)
    console.log(`\n=== ${label} ===`)
    console.table(r.rows)
  }
  await q('queue rows by status (primary-acts-pre-2000)', `
    SELECT status, count(*)::int n, count(DISTINCT "docId")::int docs
    FROM ingest_queue WHERE corpus='primary-acts-pre-2000' GROUP BY status`)
  await q('corpus_sections (primary-acts-pre-2000)', `
    SELECT count(*)::int sections,
           count(*) FILTER (WHERE availability_status='full')::int full_sections,
           count(*) FILTER (WHERE availability_status<>'full')::int markers,
           count(DISTINCT split_part(id,':',2))::int docs
    FROM corpus_sections WHERE corpus='primary-acts-pre-2000'`)
  await q('done queue docs with ZERO corpus_sections rows', `
    SELECT count(*)::int n FROM (
      SELECT DISTINCT q."docId" FROM ingest_queue q
      WHERE q.corpus='primary-acts-pre-2000' AND q.status='done'
      AND NOT EXISTS (
        SELECT 1 FROM corpus_sections s
        WHERE s.corpus='primary-acts-pre-2000' AND split_part(s.id,':',2)=q."docId"
      )
    ) t`)
  await q('sections by decade', `
    SELECT substring(split_part(id,':',2) FROM 'ukpga/(\d{2,4})')::int/10*10 AS decade,
           count(*)::int sections, count(DISTINCT split_part(id,':',2))::int docs
    FROM corpus_sections WHERE corpus='primary-acts-pre-2000'
    GROUP BY 1 ORDER BY 1 DESC LIMIT 15`)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
