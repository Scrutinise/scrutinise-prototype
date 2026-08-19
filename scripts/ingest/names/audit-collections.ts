/** §1.1 coverage: what the OTHER case-law collections already hold as a title. */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
const COLS = ['tna-caselaw','ni-judgments','scottish-courts','et-decisions','tax-tribunals','echr-hudoc','cma-cases']
;(async () => {
  const p = getNeonPool()
  for (const c of COLS) {
    const r = (await p.query(
      `SELECT COUNT(*)::int n,
              COUNT(NULLIF(btrim(COALESCE("sectionTitle",'')),''))::int titled,
              COUNT("speaker")::int spk, COUNT(attribution)::int attr
         FROM corpus_sections WHERE corpus=$1`, [c])).rows[0]
    console.log(`\n=== ${c}: ${r.n} rows, sectionTitle ${r.titled} (${(100*r.titled/r.n).toFixed(1)}%), speaker ${r.spk}, attribution ${r.attr}`)
    const s = (await p.query(
      `SELECT id, "sectionTitle" FROM corpus_sections WHERE corpus=$1 ORDER BY md5(id) LIMIT 5`, [c])).rows
    for (const x of s) console.log(`   id=${x.id}\n     title=${JSON.stringify(x.sectionTitle)}`)
  }
  await endNeonPool()
})().catch(e => { console.error(e); process.exit(1) })
