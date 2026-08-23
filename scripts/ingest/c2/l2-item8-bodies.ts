/** l2-item8-bodies.ts — READ-ONLY. What is actually IN lda-lordsdivisions, and in its claimed twin? */
import { pool } from './db'
import { r2Get } from '../shared/r2-client'
;(async () => {
  const p = pool()
  for (const c of ['lda-lordsdivisions', 'lda-commonsdivisions', 'lords-divisions-votes']) {
    const rows = (await p.query(
      `select id, "r2Key", "wordCount" from corpus_sections where corpus=$1 and "r2Key" is not null
       order by md5(id) limit 4`, [c])).rows
    console.log(`\n=== ${c} ===`)
    for (const r of rows) {
      const b = ((await r2Get(r.r2Key)) ?? '(no object)').replace(/\s+/g, ' ').trim()
      console.log(`  ${r.id} (wc=${r.wordCount})\n    "${b.slice(0, 260)}${b.length > 260 ? '…' : ''}"`)
    }
  }
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
