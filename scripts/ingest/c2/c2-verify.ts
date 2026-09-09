/** c2-verify.ts — READ-ONLY. Final state after Lane 2. Every claim in the report, re-queried. */
import { pool } from './db'
;(async () => {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows
  const r = await q(`select
      (select count(*)::int from section_repeals) repeals_total,
      (select count(*)::int from section_repeals where corpus='retained-eu') repeals_eu,
      (select count(*)::int from corpus_sections where status='compiled') compiled,
      (select count(*)::int from corpus_sections where corpus='et-decisions' and format='html') et_landing,
      (select count(*)::int from corpus_sections where corpus in
        ('lda-lordswrittenquestions','lda-commonswrittenquestions','written-statements')) retired3`)
  const x = r[0]
  console.log('section_repeals total      :', x.repeals_total.toLocaleString(), x.repeals_total === 249256 ? '✓ 249,256' : '⚠')
  console.log('  of which retained-eu     :', x.repeals_eu.toLocaleString(), x.repeals_eu === 70457 ? '✓ 70,457' : '⚠')
  console.log('compiled sections          :', x.compiled.toLocaleString(), x.compiled === 18272452 ? '✓ unchanged — nothing deleted' : '⚠ MOVED')
  console.log('et-decisions landing pages :', x.et_landing.toLocaleString(), x.et_landing === 131650 ? '✓ still present (purge not executed)' : '⚠')
  console.log('the three retired colls    :', x.retired3.toLocaleString(), x.retired3 === 28629 ? '✓ still present (purge not executed)' : '⚠')
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
