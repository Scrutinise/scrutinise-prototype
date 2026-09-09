/**
 * l2-dotscale.ts — READ-ONLY. How many dot leaders did the V36 census miss?
 *
 * TWO INDEPENDENT CAUSES, both confirmed:
 *  1. THE DETECTOR. shared/compile.ts::isRepealedPlaceholder ends `!/[A-Za-z]{2}/.test(t)` —
 *     "no word of two or more letters anywhere". retained-eu renders a removed provision as
 *     "Article 31 . . . ." and the word "Article" defeats it. The census's own output printed
 *     retained-eu at 27/194,537 = 0.01% beside regional at 16.84%, and that anomaly was never read.
 *  2. THE CENSUS NEVER FINISHED. Checkpoint cursor si-pre-2010:uksi/2009/994:article-2,
 *     1,563,090 of 1,780,445 read — 217,355 legislation sections never looked at.
 *
 * Instrument: a run of 20+ periods separated only by spaces. Prefix-independent.
 * Both controls pass (census-flagged 30/30, wc=120 prose 0/25).
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'
import { r2Get } from '../shared/r2-client'

const DOT_RUN = /(?:\.[ \t]*){20,}/
const LEG = ['primary-acts-pre-2000','primary-acts-2000plus','si-pre-2010','si-2010plus','regional','retained-eu']
const CONC = 24

async function mapPool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]) }))
}

async function measure(p: any, label: string, where: string, args: any[], n: number) {
  const rows = (await p.query(`
    select s.id, s.corpus, s."wordCount", s."r2Key" from corpus_sections s
    where ${where} and s."r2Key" is not null order by md5(s.id) limit ${n}`, args)).rows
  let dot = 0, missing = 0
  const wcOfDot: Record<number, number> = {}
  await mapPool(rows, CONC, async (r: any) => {
    const b = await r2Get(r.r2Key)
    if (b === null) { missing++; return }
    if (DOT_RUN.test(b.replace(/\s+/g, ' '))) { dot++; wcOfDot[r.wordCount] = (wcOfDot[r.wordCount] ?? 0) + 1 }
  })
  const read = rows.length - missing
  // Wald 95% interval — n is large enough here and the point of it is to stop a
  // 30-row sample being quoted as a number.
  const pHat = read ? dot / read : 0
  const ci = read ? 1.96 * Math.sqrt(pHat * (1 - pHat) / read) : 0
  const res = { label, sampled: rows.length, r2_missing: missing, read, dot_leaders: dot,
    pct: +(100 * pHat).toFixed(2), ci95: `±${(100 * ci).toFixed(2)}`,
    wordCounts_of_dot_leaders: Object.entries(wcOfDot).sort((a, b) => b[1] - a[1]).slice(0, 6) }
  console.log(JSON.stringify(res)); return res
}

;(async () => {
  const p = pool()
  const out: any = { instrument: '20+ period run', samples: [] }
  const unflagged = `not exists (select 1 from section_repeals r where r.section_id = s.id)`

  const pop = async (w: string, a: any[]) =>
    (await p.query(`select count(*)::int n from corpus_sections s where ${w}`, a)).rows[0].n

  // A. retained-eu, unflagged — the collection the detector is blind to
  const popEu = await pop(`s.corpus='retained-eu' and ${unflagged}`, [])
  out.samples.push({ population: popEu, ...await measure(p, 'retained-eu unflagged', `s.corpus='retained-eu' and ${unflagged}`, [], 600) })

  // B. all legislation, unflagged — the honest whole-population estimate
  const popAll = await pop(`s.corpus = any($1) and ${unflagged}`, [LEG])
  out.samples.push({ population: popAll, ...await measure(p, 'ALL legislation unflagged', `s.corpus = any($1) and ${unflagged}`, [LEG], 800) })

  // C. the never-scanned tail (id > the census cursor), unflagged
  const CUR = 'si-pre-2010:uksi/2009/994:article-2'
  const popTail = await pop(`s.corpus = any($1) and s.id > $2 and ${unflagged}`, [LEG, CUR])
  out.samples.push({ population: popTail, ...await measure(p, 'never-scanned tail (id > cursor)', `s.corpus = any($1) and s.id > $2 and ${unflagged}`, [LEG, CUR], 500) })

  fs.writeFileSync(path.join(OUT, 'C2_L2_dotscale.json'), JSON.stringify(out, null, 2))
  console.log('\n=== PROJECTION ===')
  for (const s of out.samples)
    console.log(`${s.label}: population ${s.population.toLocaleString()} × ${s.pct}% ${s.ci95} → ~${Math.round(s.population * s.pct / 100).toLocaleString()} missed dot leaders`)
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
