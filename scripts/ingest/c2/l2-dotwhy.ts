/** l2-dotwhy.ts — READ-ONLY. WHY did the detector miss these, corpus by corpus?
 *  Prints the offending body and the exact two-letter word that defeated the guard. */
import { pool } from './db'
import { r2Get } from '../shared/r2-client'
const DOT_RUN = /(?:\.[ \t]*){20,}/
const VISIBLE = `s.status='compiled' and s."r2Key" is not null
                 and not exists (select 1 from section_repeals r where r.section_id = s.id)`
;(async () => {
  const p = pool()
  for (const c of ['primary-acts-pre-2000','primary-acts-2000plus','regional','si-pre-2010','retained-eu']) {
    const rows = (await p.query(`select s.id, s."r2Key" from corpus_sections s
      where s.corpus=$1 and ${VISIBLE} order by md5(s.id) limit 250`, [c])).rows
    const found: string[] = []
    for (const r of rows) {
      if (found.length >= 3) break
      const b = await r2Get(r.r2Key); if (!b) continue
      const t = b.replace(/\s+/g, ' ').trim()
      if (!DOT_RUN.test(t)) continue
      const words = t.match(/[A-Za-z]{2,}/g) ?? []
      found.push(`  ${r.id}\n    body: "${t.slice(0, 95)}"\n    words of 2+ letters that defeat the guard: ${words.length ? JSON.stringify(words.slice(0, 5)) : 'NONE — guard should have caught this'}`)
    }
    console.log(`\n=== ${c} ===`)
    console.log(found.length ? found.join('\n') : '  (no dot leader in the first 250 sampled)')
  }
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
