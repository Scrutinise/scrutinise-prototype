/** §1.4 — the 13 rows that got no title. A miss counted is a miss understood. */
import { namesPool, endNamesPool } from './names-pool'
import { r2Get, r2GetRange } from '../shared/r2-client'
;(async () => {
  const p = namesPool()
  const rows = (await p.query(
    `SELECT id, "r2Key", "r2RawKey", "sourceUrl", status, "wordCount" FROM corpus_sections
      WHERE corpus='tna-caselaw' AND NULLIF(btrim(COALESCE("sectionTitle",'')),'') IS NULL ORDER BY id`)).rows
  console.log(`${rows.length} tna-caselaw rows still untitled\n`)
  for (const r of rows) {
    const head = r.r2RawKey ? await r2GetRange(r.r2RawKey, 3000) : null
    const m = head ? /<FRBRname\s+value="([^"]*)"/.exec(head) : null
    console.log(`── ${r.id}`)
    console.log(`   status=${r.status} words=${r.wordCount} rawKey=${r.r2RawKey}`)
    console.log(`   raw present: ${head ? 'yes' : 'NO'}   FRBRname: ${m ? JSON.stringify(m[1]) : '(absent)'}`)
    if (!m && head) console.log(`   head: ${head.slice(0, 220).replace(/\s+/g, ' ')}`)
  }
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
