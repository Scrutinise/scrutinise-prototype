/**
 * l2-dotmiss.ts — READ-ONLY. Did the V36 repeal census miss dot leaders?
 *
 * The census scanned 1,563,090 of 1,780,445 legislation sections. 12,642 unflagged rows sit at
 * the exact dot-leader signature (wordCount=33). Read their bodies rather than infer.
 * Controls included: wordCount=34 (one off the signature) must NOT be dot leaders.
 */
import { pool } from './db'
import { r2Get } from '../shared/r2-client'

const LEG = ['primary-acts-pre-2000','primary-acts-2000plus','si-pre-2010','si-2010plus','regional','retained-eu']
const saysNothing = (t: string) => t.replace(/[.…\s\d]/g, '').length < 5

async function sample(p: any, wc: number, n: number) {
  const rows = (await p.query(`
    select s.id, s.corpus, s."wordCount", s."r2Key"
    from corpus_sections s
    where s.corpus = any($1) and s."wordCount" = $2 and s."r2Key" is not null
      and not exists (select 1 from section_repeals r where r.section_id = s.id)
    order by md5(s.id) limit $3`, [LEG, wc, n])).rows
  let hollow = 0
  const examples: string[] = []
  for (const r of rows) {
    const txt = ((await r2Get(r.r2Key)) ?? '').replace(/\s+/g, ' ').trim()
    if (saysNothing(txt)) hollow++
    if (examples.length < 3) examples.push(`${r.id} → "${txt.slice(0, 90)}"`)
  }
  return { wc, sampled: rows.length, hollow, pct: rows.length ? +(100 * hollow / rows.length).toFixed(1) : 0, examples }
}

;(async () => {
  const p = pool()
  console.log('TEST  wordCount=33, unflagged — expect dot leaders the census missed')
  console.log(JSON.stringify(await sample(p, 33, 30), null, 1))
  console.log('\nTEST  wordCount=32, unflagged')
  console.log(JSON.stringify(await sample(p, 32, 30), null, 1))
  console.log('\nCONTROL  wordCount=34, unflagged — one off the signature, must NOT be hollow')
  console.log(JSON.stringify(await sample(p, 34, 30), null, 1))
  console.log('\nCONTROL  wordCount=120, unflagged — ordinary prose, must NOT be hollow')
  console.log(JSON.stringify(await sample(p, 120, 20), null, 1))
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
