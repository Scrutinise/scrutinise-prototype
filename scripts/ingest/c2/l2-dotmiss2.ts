/**
 * l2-dotmiss2.ts — READ-ONLY. Dot-leader detection, second attempt.
 *
 * ⚠ ATTEMPT 1 HAD A FALSE-NEGATIVE AND ITS OWN CONTROL CAUGHT IT. The test stripped
 * [.…\s\d] and asked whether <5 characters survived. `retained-eu` renders a removed
 * provision as "Article 31 . . . ." — the word "Article" survives the strip, 7 chars, so
 * every one of them read as CARRIES-TEXT. The wc=34 control returned 0% hollow while two of
 * its three printed examples were plainly dot leaders.
 *
 * The robust instrument is the DOT RUN itself, which no prefix can defeat: a run of 20+
 * periods separated only by spaces. Prefix-independent, length-independent.
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'
import { r2Get } from '../shared/r2-client'

const LEG = ['primary-acts-pre-2000','primary-acts-2000plus','si-pre-2010','si-2010plus','regional','retained-eu']
/** A run of 20+ periods separated only by spaces — the source's rendering of a removed provision. */
const DOT_RUN = /(?:\.[ \t]*){20,}/
const isDotLeader = (t: string) => DOT_RUN.test(t)

async function sample(p: any, where: string, args: any[], n: number, label: string) {
  const rows = (await p.query(`
    select s.id, s.corpus, s."wordCount", s."r2Key" from corpus_sections s
    where ${where} and s."r2Key" is not null order by md5(s.id) limit ${n}`, args)).rows
  let hollow = 0; const ex: string[] = []
  for (const r of rows) {
    const txt = ((await r2Get(r.r2Key)) ?? '').replace(/\s+/g, ' ').trim()
    const hit = isDotLeader(txt)
    if (hit) hollow++
    if (ex.length < 3) ex.push(`[${hit ? 'DOT' : 'TEXT'}] ${r.id} → "${txt.slice(0, 80)}"`)
  }
  const r = { label, sampled: rows.length, dot_leaders: hollow, pct: rows.length ? +(100*hollow/rows.length).toFixed(1) : 0, examples: ex }
  console.log(JSON.stringify(r, null, 1)); return r
}

;(async () => {
  const p = pool()
  const out: any = { instrument: 'dot run of 20+ periods', results: [] }
  const unflagged = `s.corpus = any($1) and s."wordCount" = $2 and not exists (select 1 from section_repeals r where r.section_id = s.id)`

  console.log('POSITIVE CONTROL — rows the census DID flag. Must be ~100%.')
  out.results.push(await sample(p,
    `s.id in (select section_id from section_repeals)`, [], 30, 'census-flagged'))

  console.log('\nNEGATIVE CONTROL — ordinary prose at wc=120. Must be ~0%.')
  out.results.push(await sample(p, unflagged, [LEG, 120], 25, 'wc=120 unflagged'))

  for (const wc of [32, 33, 34]) {
    console.log(`\nTEST — unflagged legislation at wordCount=${wc}`)
    out.results.push(await sample(p, unflagged, [LEG, wc], 30, `wc=${wc} unflagged`))
  }

  console.log('\nTEST — unflagged retained-eu, any word count')
  out.results.push(await sample(p,
    `s.corpus='retained-eu' and not exists (select 1 from section_repeals r where r.section_id = s.id)`,
    [], 30, 'retained-eu unflagged (any wc)'))

  fs.writeFileSync(path.join(OUT, 'C2_L2_dotmiss.json'), JSON.stringify(out, null, 2))
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
