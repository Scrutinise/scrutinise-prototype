/**
 * v29-hmrc-audit.ts — §8 HMRC soft-law coverage audit. For each interpretation
 * soft-law family (Extra-Statutory Concessions, Statements of Practice, Revenue
 * & Customs Briefs, VAT Notices), enumerate the gov.uk universe and compare to
 * what corpus_sections already holds (by sourceUrl). Reports have/missing.
 *
 *   default   audit + report (seeds nothing)
 *   --seed    ⚠️ POST-PUSH only. Seed the genuinely-missing leaves as
 *             govuk-content rows under corpus 'hmrc-ancillary'.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'

const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'
const SEARCH = 'https://www.gov.uk/api/search.json'

// titleRx tightens the loose keyword search to the actual soft-law family
// (otherwise "VAT Notice" matches ~2,900 docs that merely cite one).
const FAMILIES: Array<{ key: string; q: string; titleRx: RegExp }> = [
  { key: 'Extra-Statutory Concessions', q: 'extra-statutory concession', titleRx: /extra-?statutory concession|^ESC\b/i },
  { key: 'Statements of Practice', q: 'statement of practice', titleRx: /statement of practice|^SP\s?\d/i },
  { key: 'Revenue & Customs Briefs', q: 'revenue and customs brief', titleRx: /revenue and customs brief|^RCB\b/i },
  { key: 'VAT Notices', q: 'VAT Notice', titleRx: /vat notice/i },
]

async function enumerate(q: string): Promise<Array<{ link: string; title: string }>> {
  const out: Array<{ link: string; title: string }> = []
  for (let start = 0; start < 3000; start += 200) {
    const url = `${SEARCH}?q=${encodeURIComponent(q)}&filter_organisations=hm-revenue-customs&fields=link,title&count=200&start=${start}`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) break
    const j = await res.json() as { results?: Array<{ link?: string; title?: string }> }
    const rs = j.results ?? []
    if (rs.length === 0) break
    for (const r of rs) if (r.link) out.push({ link: r.link, title: r.title ?? '' })
    if (rs.length < 200) break
    await new Promise(r => setTimeout(r, 250))
  }
  return out
}

async function main() {
  const seed = process.argv.includes('--seed')
  const pool = getNeonPool()

  console.log('=== existing HMRC corpora ===')
  const cor = await pool.query<{ corpus: string; n: string }>(
    `SELECT corpus, COUNT(*)::text n FROM corpus_sections WHERE corpus LIKE 'hmrc%' OR corpus IN ('tax-treaties-dta') GROUP BY corpus ORDER BY corpus`)
  console.table(cor.rows)

  const held = new Set((await pool.query<{ url: string }>(
    `SELECT DISTINCT "sourceUrl" url FROM corpus_sections WHERE "sourceUrl" LIKE 'https://www.gov.uk/%'`)).rows.map(r => r.url))
  console.log(`held gov.uk URLs: ${held.size.toLocaleString()}\n`)

  const toSeed: Array<{ docPath: string }> = []
  for (const fam of FAMILIES) {
    const universe = await enumerate(fam.q)
    // keep only gov.uk content paths whose TITLE matches the family marker.
    const docs = universe.filter(u => u.link.startsWith('/') && !/^\/government\/collections\//.test(u.link) && fam.titleRx.test(u.title))
    let have = 0, missing = 0
    for (const d of docs) {
      const url = `https://www.gov.uk${d.link}`
      if (held.has(url)) have++
      else { missing++; toSeed.push({ docPath: d.link.replace(/^\//, '') }) }
    }
    console.log(`${fam.key.padEnd(30)} universe ${String(docs.length).padStart(5)} | have ${String(have).padStart(5)} | MISSING ${String(missing).padStart(5)}`)
  }

  const uniqueMissing = [...new Map(toSeed.map(t => [t.docPath, t])).values()]
  console.log(`\nTOTAL unique missing leaves: ${uniqueMissing.length}`)

  if (!seed) { console.log('\n[audit] seeds nothing — pass --seed POST-PUSH.'); await endNeonPool(); return }

  const rows = uniqueMissing.map(t => ({ id: `hmrc-ancillary:${t.docPath}`, corpus: 'hmrc-ancillary', docId: t.docPath, sourceType: 'govuk-content', priority: 3 }))
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`[seed] hmrc-ancillary: ${affected} new govuk-content rows`)
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
