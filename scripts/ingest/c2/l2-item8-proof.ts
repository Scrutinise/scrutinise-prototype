/**
 * l2-item8-proof.ts — LANE 2 item 8, the fourth pair, proved on the item. READ-ONLY.
 *
 * C1 recorded `lda-lordsdivisions` / `lords-divisions-votes` as "not proved by text query
 * (median 8 words); structural duplication likely, unmeasured", and a structural join failed
 * too — `itemDate` and `sectionTitle` are NULL on all 2,089 rows.
 *
 * ⚠ THE METADATA IS NOT MISSING. IT IS IN THE BODY AND WAS NEVER EXTRACTED INTO THE COLUMNS:
 *   "Human Fertilisation and Embryology Bill [HL] Date: 2008-01-21 UIN: LD:2008-1-21:3"
 * A collection whose date lives only in its prose is invisible to every date-scoped query,
 * every freshness check and every duplication test in the register — which is exactly how
 * this pair stayed unresolved. Parse the body and the join is trivial.
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'
import { r2Get } from '../shared/r2-client'

const RX = /^(.*?)\s*Date:\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*UIN:\s*(\S+)/s
async function mapPool<T>(it: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < it.length) await fn(it[i++]) }))
}
const norm = (s: string) => s.toLowerCase().replace(/\[hl\]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()

;(async () => {
  const p = pool()
  const rows = (await p.query(
    `select id, "r2Key" from corpus_sections where corpus='lda-lordsdivisions' and "r2Key" is not null`)).rows
  console.log(`lda-lordsdivisions rows with an R2 object: ${rows.length.toLocaleString()}`)

  const parsed: Array<{ id: string; title: string; date: string; uin: string }> = []
  let unparsed = 0
  await mapPool(rows, 24, async (r: any) => {
    const b = await r2Get(r.r2Key); if (!b) return
    const m = RX.exec(b.replace(/\s+/g, ' ').trim())
    if (!m) { unparsed++; return }
    parsed.push({ id: r.id, title: m[1].trim(),
      date: `${m[2]}-${m[3].padStart(2, '0')}-${m[4].padStart(2, '0')}`, uin: m[5] })
  })
  console.log(`parsed a title + date out of the body: ${parsed.length.toLocaleString()} · unparsed ${unparsed}`)
  const dates = parsed.map(x => x.date).sort()
  console.log(`date range recovered: ${dates[0]} … ${dates[dates.length - 1]}`)

  // the other side, keyed the same way
  const other = (await p.query(
    `select id, "itemDate"::text d, "sectionTitle" t from corpus_sections
     where corpus='lords-divisions-votes' and "itemDate" is not null`)).rows
  const byKey = new Map<string, string[]>()
  for (const o of other as any[]) {
    const k = `${o.d}|${norm(o.t ?? '')}`
    ;(byKey.get(k) ?? byKey.set(k, []).get(k)!).push(o.id)
  }

  const dupes: any[] = []
  let sharedDate = 0
  const otherDates = new Set((other as any[]).map(o => o.d))
  for (const a of parsed) {
    if (otherDates.has(a.date)) sharedDate++
    const hit = byKey.get(`${a.date}|${norm(a.title)}`)
    if (hit) dupes.push({ lda: a.id, votes: hit[0], date: a.date, title: a.title })
  }

  console.log(`\nrows whose DATE also appears in lords-divisions-votes : ${sharedDate.toLocaleString()} / ${parsed.length.toLocaleString()}`)
  console.log(`rows matching on DATE **and** TITLE — the item-level test: ${dupes.length.toLocaleString()}`)
  console.log('\nconcrete duplicated divisions:')
  for (const d of dupes.slice(0, 6)) console.log(`  ${d.date}  "${d.title}"\n     ${d.lda}\n     ${d.votes}`)

  const verdict = dupes.length
    ? `DUPLICATED — ${dupes.length} of ${parsed.length} lda-lordsdivisions rows match a lords-divisions-votes row on date AND title. ` +
      `lda carries title+date only (median 8 words); lords-divisions-votes carries the full division with vote lists ` +
      `(median 1,972 words). The duplicate is also the poorer copy.`
    : `NOT DUPLICATED on date+title across ${parsed.length} parsed rows.`
  console.log(`\n${verdict}`)
  fs.writeFileSync(path.join(OUT, 'C2_L2_item8_lords.json'), JSON.stringify(
    { parsed: parsed.length, unparsed, sharedDate, dupes: dupes.length, verdict, examples: dupes.slice(0, 20) }, null, 2))
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
