/**
 * l2-dotcorrect.ts — READ-ONLY. The dot-leader miss, third and correct instrument.
 *
 * ⚠ MY 20+-DOT-RUN INSTRUMENT OVER-FLAGGED AND READING THE BODIES CAUGHT IT. A dot RUN is
 * present in two very different things:
 *   · a whole-body dot leader — "Article 31 . . . ." — the section says nothing. HOLLOW.
 *   · a PARTIALLY repealed section — "4 1 . . . a traffic regulation order shall not be made
 *     with respect to any road…" — some subsections removed, the rest is live law. NOT hollow.
 * Counting the second as hollow would have deleted real law from the usable-text count. The
 * census's own guard is RIGHT to demand a whole-body match; its only defect is that the match
 * is defeated by a leading structural label.
 *
 * Correct rule = the census's rule, plus the label: strip dots, whitespace, digits AND one
 * leading structural word; if nothing remains, the section says nothing.
 *
 * Both arms are reported: whole-body leaders (the census's target, undercounted) and partial
 * repeals (a category nobody has counted, where retrieval can quote a removed subsection).
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'
import { r2Get } from '../shared/r2-client'

const LEG = ['primary-acts-pre-2000','primary-acts-2000plus','si-pre-2010','si-2010plus','regional','retained-eu']
const VISIBLE = `s.status='compiled' and s."r2Key" is not null
                 and not exists (select 1 from section_repeals r where r.section_id = s.id)`
const DOT_RUN = /(?:\.[ \t]*){20,}/
const LABEL = /^(?:article|regulation|section|paragraph|schedule|rule|part|chapter|annex|title)\b/i

/** The census guard, generalised over a leading structural label. */
function wholeBodyDotLeader(t: string): boolean {
  if (!/[.·…]/.test(t)) return false
  const noLabel = t.trim().replace(LABEL, '')
  return !/[A-Za-z]{2}/.test(noLabel)
}

async function mapPool<T>(it: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < it.length) await fn(it[i++]) }))
}

;(async () => {
  const p = pool()
  const out: any = { per_corpus: [] }
  let popSum = 0, hollowSum = 0, partialSum = 0

  for (const corpus of LEG) {
    const pop = (await p.query(
      `select count(*)::int n from corpus_sections s where s.corpus=$1 and ${VISIBLE}`, [corpus])).rows[0].n
    const rows = (await p.query(`select s.id, s."r2Key" from corpus_sections s
      where s.corpus=$1 and ${VISIBLE} order by md5(s.id) limit 500`, [corpus])).rows
    let hollow = 0, partial = 0, miss = 0
    await mapPool(rows, 24, async (r: any) => {
      const b = await r2Get(r.r2Key); if (b === null) { miss++; return }
      const t = b.replace(/\s+/g, ' ').trim()
      if (wholeBodyDotLeader(t)) hollow++
      else if (DOT_RUN.test(t)) partial++
    })
    const read = rows.length - miss
    const pH = read ? hollow / read : 0, pP = read ? partial / read : 0
    const ciH = read ? 1.96 * Math.sqrt(pH * (1 - pH) / read) : 0
    const rec = { corpus, population: pop, sampled: read,
      hollow_pct: +(100 * pH).toFixed(2), hollow_ci95: +(100 * ciH).toFixed(2),
      projected_hollow: Math.round(pop * pH),
      partial_repeal_pct: +(100 * pP).toFixed(2), projected_partial: Math.round(pop * pP) }
    out.per_corpus.push(rec); popSum += pop; hollowSum += rec.projected_hollow; partialSum += rec.projected_partial
    console.log(`${corpus.padEnd(23)} pop ${String(pop).padStart(7)} · HOLLOW ${String(rec.hollow_pct).padStart(5)}% ±${rec.hollow_ci95} → ~${rec.projected_hollow.toLocaleString().padStart(7)} · partial-repeal ${String(rec.partial_repeal_pct).padStart(5)}% → ~${rec.projected_partial.toLocaleString()}`)
  }

  const held = (await p.query(`select count(*)::int n from section_repeals`)).rows[0].n
  out.summary = { already_flagged: held, projected_missed_hollow: hollowSum,
    corrected_total: held + hollowSum,
    undercount_pct: +(100 * hollowSum / (held + hollowSum)).toFixed(1),
    partially_repealed_uncounted: partialSum }
  console.log('\n=== DOT LEADERS (whole-body, the census\'s own target) ===')
  console.log(`already in section_repeals : ${held.toLocaleString()}`)
  console.log(`missed by the guard        : ~${hollowSum.toLocaleString()}`)
  console.log(`corrected total            : ~${out.summary.corrected_total.toLocaleString()}  (undercount ${out.summary.undercount_pct}%)`)
  console.log(`\n=== PARTIALLY REPEALED — real text, a category nobody has counted ===`)
  console.log(`~${partialSum.toLocaleString()} sections carry a dot run AND live law`)
  fs.writeFileSync(path.join(OUT, 'C2_L2_dotleaders.json'), JSON.stringify(out, null, 2))
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
