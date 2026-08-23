/**
 * l2-dotfinal.ts — READ-ONLY. The dot-leader miss, measured with the sample and the
 * population under the SAME filter.
 *
 * ⚠ TWO CORRECTIONS TO MY OWN EARLIER PASSES, both caught by checking rather than by reasoning:
 *  · "the census never finished" is REFUTED. 0 rows sit beyond its checkpoint cursor. It read
 *    1,563,090 against 1,592,948 censusable today; the 29,858 is drift since 12 Aug, not a stall.
 *  · my first projection quoted a population of 319,319 retained-eu rows while sampling only
 *    those with an r2Key. 120,122 retained-eu rows have no r2Key or are not `compiled`, so the
 *    census could never see them and they must not sit in the denominator of a rate measured
 *    on rows it could. Same filter both sides, below.
 *
 * ONE cause stands: shared/compile.ts::isRepealedPlaceholder returns
 * `!/[A-Za-z]{2}/.test(t)` — no word of two or more letters anywhere. retained-eu renders a
 * removed provision "Article 31 . . . ." and the word "Article" defeats it.
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'
import { r2Get } from '../shared/r2-client'

const DOT_RUN = /(?:\.[ \t]*){20,}/
const LEG = ['primary-acts-pre-2000','primary-acts-2000plus','si-pre-2010','si-2010plus','regional','retained-eu']
/** The census's own visibility filter. The sample and the population both use it. */
const VISIBLE = `s.status='compiled' and s."r2Key" is not null
                 and not exists (select 1 from section_repeals r where r.section_id = s.id)`

async function mapPool<T>(it: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < it.length) await fn(it[i++]) }))
}

;(async () => {
  const p = pool()
  const out: any = { instrument: '20+ period run', per_corpus: [] }
  let grandPop = 0, grandMissed = 0

  for (const corpus of LEG) {
    const pop = (await p.query(
      `select count(*)::int n from corpus_sections s where s.corpus=$1 and ${VISIBLE}`, [corpus])).rows[0].n
    const N = Math.min(400, pop)
    if (!N) { out.per_corpus.push({ corpus, population: pop, note: 'nothing unflagged' }); continue }
    const rows = (await p.query(
      `select s.id, s."r2Key" from corpus_sections s where s.corpus=$1 and ${VISIBLE}
       order by md5(s.id) limit ${N}`, [corpus])).rows
    let dot = 0, miss = 0
    await mapPool(rows, 24, async (r: any) => {
      const b = await r2Get(r.r2Key); if (b === null) { miss++; return }
      if (DOT_RUN.test(b.replace(/\s+/g, ' '))) dot++
    })
    const read = rows.length - miss
    const pHat = read ? dot / read : 0
    const ci = read ? 1.96 * Math.sqrt(pHat * (1 - pHat) / read) : 0
    const missed = Math.round(pop * pHat)
    const rec = { corpus, population: pop, sampled: read, dot_leaders: dot,
      pct: +(100 * pHat).toFixed(2), ci95: +(100 * ci).toFixed(2),
      projected_missed: missed,
      range: [Math.round(pop * Math.max(0, pHat - ci)), Math.round(pop * Math.min(1, pHat + ci))] }
    out.per_corpus.push(rec)
    grandPop += pop; grandMissed += missed
    console.log(`${corpus.padEnd(23)} pop ${String(pop).padStart(7)}  ${rec.pct}% ±${rec.ci95}  → ~${missed.toLocaleString()}`)
  }

  const held = (await p.query(`select count(*)::int n from section_repeals`)).rows[0].n
  out.summary = {
    already_flagged: held, projected_missed: grandMissed,
    corrected_total: held + grandMissed,
    undercount_pct: +(100 * grandMissed / (held + grandMissed)).toFixed(1),
  }
  console.log('\n=== DOT LEADERS, CORRECTED ===')
  console.log(`already in section_repeals : ${held.toLocaleString()}`)
  console.log(`projected missed           : ~${grandMissed.toLocaleString()}`)
  console.log(`corrected total            : ~${out.summary.corrected_total.toLocaleString()}`)
  console.log(`the census undercounts by  : ${out.summary.undercount_pct}%`)
  fs.writeFileSync(path.join(OUT, 'C2_L2_dotleaders.json'), JSON.stringify(out, null, 2))
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
