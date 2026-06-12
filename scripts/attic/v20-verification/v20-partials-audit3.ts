import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`
    WITH docs AS (SELECT corpus, split_part(id,':',2) d FROM corpus_sections WHERE corpus IN ('building-regs','planning-policy','hmrc-tiins'))
    SELECT
      (SELECT count(DISTINCT d) FROM docs WHERE corpus='hmrc-tiins') tiins,
      (SELECT count(*) FROM (SELECT d FROM docs WHERE corpus='building-regs' INTERSECT SELECT d FROM docs WHERE corpus='hmrc-tiins') x) br_overlap,
      (SELECT count(*) FROM (SELECT d FROM docs WHERE corpus='planning-policy' INTERSECT SELECT d FROM docs WHERE corpus='hmrc-tiins') x) pp_overlap`)
  console.table(r.rows)
  const cop = await pool.query(`
    SELECT id, "sourceUrl", "wordCount" FROM corpus_sections WHERE corpus='college-of-policing' ORDER BY random() LIMIT 5`)
  console.table(cop.rows.map(x => ({ id: x.id.slice(0, 90), url: (x.sourceUrl ?? '').slice(0, 80), words: x.wordCount })))
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
