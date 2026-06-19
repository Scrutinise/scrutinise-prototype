/**
 * v28-discover-inquiries.ts — V28 §4 discovery. Finds concluded public-inquiry
 * FINAL-REPORT publication pages on gov.uk that are NOT already in
 * INQUIRY_REGISTRY, and verifies each resolves to PDF report volumes.
 *
 * Strategy (verify-before-asserting — no hand-guessed paths):
 *  1. gov.uk Search API, document_type=independent_report, paged, keep links
 *     whose title contains "Inquiry" and looks like a report.
 *  2. For each unique /government/publications/ link, call listInquiryPdfs.
 *  3. Print candidates with PDF counts, flag those already registered.
 * The curated, PDF-verified subset is then folded into INQUIRY_REGISTRY by hand.
 *
 * Seeds nothing.
 */
import { INQUIRY_REGISTRY, listInquiryPdfs } from './sources/inquiry-reports'

const SEARCH = 'https://www.gov.uk/api/search.json'
const known = new Set(INQUIRY_REGISTRY.map(i => '/' + i.govukPath))

async function search(q: string, docType: string, count: number): Promise<Array<{ title: string; link: string }>> {
  const url = `${SEARCH}?q=${encodeURIComponent(q)}&filter_content_store_document_type=${docType}&count=${count}&fields=title,link`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return []
  const j = await res.json() as { results?: Array<{ title?: string; link?: string }> }
  return (j.results ?? []).map(r => ({ title: r.title ?? '', link: r.link ?? '' }))
}

async function main() {
  const docTypes = ['independent_report', 'correspondence', 'policy_paper', 'guidance', 'transparency']
  const queries = [
    'Inquiry report', 'public inquiry report final', 'inquiry report volume',
    'independent inquiry report', 'inquiry into the death report',
  ]
  const cand = new Map<string, string>() // link -> title
  for (const dt of docTypes) for (const q of queries) {
    for (const r of await search(q, dt, 200)) {
      if (!r.link.startsWith('/government/publications/')) continue
      if (!/inquiry/i.test(r.title)) continue
      cand.set(r.link, r.title)
    }
  }
  console.log(`candidate inquiry publication pages (title~Inquiry): ${cand.size}`)

  const found: Array<{ link: string; title: string; pdfs: number; registered: boolean }> = []
  let i = 0
  for (const [link, title] of cand) {
    i++
    const path = link.replace(/^\//, '')
    const pdfs = await listInquiryPdfs(path)
    if (pdfs && pdfs.length > 0) {
      found.push({ link, title, pdfs: pdfs.length, registered: known.has(link) })
    }
    if (i % 25 === 0) process.stdout.write(`  checked ${i}/${cand.size}\r`)
    await new Promise(r => setTimeout(r, 120))
  }

  found.sort((a, b) => Number(a.registered) - Number(b.registered) || b.pdfs - a.pdfs)
  console.log(`\n=== ${found.length} pages with PDF report volumes ===`)
  const newOnes = found.filter(f => !f.registered)
  console.log(`\nNEW (not in registry): ${newOnes.length}`)
  for (const f of newOnes) console.log(`  [${f.pdfs} pdf] ${f.title}\n        ${f.link}`)
  console.log(`\nALREADY REGISTERED with PDFs: ${found.filter(f => f.registered).length}/${INQUIRY_REGISTRY.length}`)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
