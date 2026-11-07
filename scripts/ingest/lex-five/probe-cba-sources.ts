/**
 * probe-cba-sources.ts — BRIEF_INGEST_CBA_1 §5.1–§5.3. Read-only against gov.uk's content API.
 * For each candidate publication path: does it exist, its public_updated_at, its attachments
 * (title, content type) — so the gap is measured against what the publisher actually serves.
 *
 * Output: docs/ingest_traces/cba1_sources.json + printed summary.
 */
import fs from 'fs'
import path from 'path'

const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'
const PATHS = [
  'government/publications/the-green-book-appraisal-and-evaluation-in-central-government',
  'government/collections/the-green-book-and-accompanying-guidance-and-documents',
  'government/publications/green-book-supplementary-guidance-optimism-bias',
  'government/publications/green-book-supplementary-guidance-discounting',
  'government/publications/managing-public-money',
  'government/publications/the-magenta-book',
  'government/publications/better-regulation-framework',
  'government/publications/impact-assessment-calculator--3',
  'government/publications/impact-assessment-template-for-government-policies',
  'government/publications/the-aqua-book',
  'guidance/the-aqua-book',
  'government/publications/orange-book',
  'government/collections/gdp-deflators-at-market-prices-and-money-gdp',
  'government/statistics/civil-service-statistics-2025',
  'government/collections/civil-service-statistics',
  'government/collections/public-expenditure-statistical-analyses-pesa',
  'government/statistics/public-expenditure-statistical-analyses-2025',
]

async function get(p: string): Promise<any> {
  const r = await fetch(`https://www.gov.uk/api/content/${p}`, { headers: { 'User-Agent': UA } })
  if (!r.ok) return { status: r.status }
  return { status: 200, json: await r.json() }
}

async function main() {
  const out: any[] = []
  for (const p of PATHS) {
    const r = await get(p)
    if (r.status !== 200) { console.log(`\n${p}\n  HTTP ${r.status}`); out.push({ path: p, status: r.status }); continue }
    const j = r.json
    const d = j.details ?? {}
    const atts = (d.attachments ?? []).map((a: any) => ({ title: a.title, type: a.content_type, url: a.url, pages: a.number_of_pages ?? null }))
    const docs = (j.links?.documents ?? []).map((x: any) => x.base_path)
    const coll = (d.collection_groups ?? []).flatMap((g: any) => g.documents ?? [])
    const rec = { path: p, status: 200, title: j.title, documentType: j.document_type, updated: j.public_updated_at, first: j.first_published_at, withdrawn: !!j.withdrawn_notice?.explanation, attachments: atts, collectionDocs: docs.length ? docs : coll }
    out.push(rec)
    console.log(`\n${p}\n  ${j.title} | ${j.document_type} | updated ${j.public_updated_at}${rec.withdrawn ? ' | WITHDRAWN' : ''}`)
    for (const a of atts.slice(0, 25)) console.log(`   - [${a.type}] ${a.title}${a.pages ? ` (${a.pages}pp)` : ''}`)
    if (rec.collectionDocs.length) console.log(`   collection docs: ${rec.collectionDocs.length}: ${rec.collectionDocs.slice(0, 12).join(', ')}`)
    await new Promise(res => setTimeout(res, 400))
  }
  const dir = path.join(__dirname, '../../../docs/ingest_traces')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'cba1_sources.json'), JSON.stringify(out, null, 2))
  console.log('\nWROTE docs/ingest_traces/cba1_sources.json')
}
main().catch(e => { console.error(e); process.exit(1) })
