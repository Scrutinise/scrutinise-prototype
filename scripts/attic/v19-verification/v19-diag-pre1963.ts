import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`
    SELECT split_part(id,':',2) AS doc, count(*)::int sections,
           avg("wordCount")::int avg_words, max(format) fmt
    FROM corpus_sections
    WHERE corpus='primary-acts-pre-2000' AND status='compiled'
      AND split_part(split_part(id,':',2),'/',2) ~ '^\d+$'
      AND split_part(split_part(id,':',2),'/',2)::int < 1963
    GROUP BY 1 ORDER BY random() LIMIT 8`)
  console.table(r.rows)
  const cnt = await pool.query(`
    SELECT count(DISTINCT split_part(id,':',2))::int docs, count(*)::int sections
    FROM corpus_sections
    WHERE corpus='primary-acts-pre-2000' AND status='compiled'
      AND split_part(split_part(id,':',2),'/',2) ~ '^\d+$'
      AND split_part(split_part(id,':',2),'/',2)::int < 1963`)
  console.log('pre-1963 calendar compiled:', cnt.rows[0])
  const reg = await pool.query(`
    SELECT count(DISTINCT split_part(id,':',2))::int docs
    FROM corpus_sections
    WHERE corpus='primary-acts-pre-2000'
      AND split_part(split_part(id,':',2),'/',2) !~ '^\d+$'`)
  console.log('regnal-form docs already present:', reg.rows[0])
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
