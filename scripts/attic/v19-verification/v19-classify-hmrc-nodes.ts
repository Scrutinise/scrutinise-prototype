import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`
    UPDATE corpus_sections
    SET availability_note = 'manual contents/index node — Content API returns child_section_groups with empty body; text lives in child leaf sections (classified V19, 100-sample + 8 live probes)'
    WHERE corpus='hmrc-manuals' AND status<>'compiled'
      AND availability_note LIKE 'no extractable body%'`)
  console.log('hmrc-manuals index nodes classified:', r.rowCount)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
