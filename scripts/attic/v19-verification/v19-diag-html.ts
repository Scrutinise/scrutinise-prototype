import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`
    SELECT split_part(id,':',2) AS doc, "wordCount", "r2Key"
    FROM corpus_sections
    WHERE corpus='primary-acts-pre-2000' AND status='compiled' AND format='html'
    ORDER BY random() LIMIT 6`)
  console.table(r.rows)
  const stats = await pool.query(`
    SELECT min("wordCount")::int min_w, percentile_cont(0.5) WITHIN GROUP (ORDER BY "wordCount")::int med_w,
           avg("wordCount")::int avg_w, count(*) FILTER (WHERE "wordCount" < 50)::int under50
    FROM corpus_sections
    WHERE corpus='primary-acts-pre-2000' AND status='compiled' AND format='html'`)
  console.table(stats.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
