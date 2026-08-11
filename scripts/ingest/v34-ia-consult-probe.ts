/**
 * v34-ia-consult-probe.ts — BRIEF_INGEST_POLITICAL_SOURCES §B and §C, step 1.
 *
 * Source access priority: BULK → HTML → API. So the order of probing is the
 * order of the rule, and an API client is only justified once the two above it
 * are shown not to exist.
 *
 * §B impact assessments
 *   B1. legislation.gov.uk publishes IAs as their own legislation type (`ukia`).
 *       If so this reuses the TNA pipeline wholesale — the cheapest route by far.
 *       Is there a bulk feed? A year index? An Atom feed?
 *   B2. Are IAs also reachable as `resources` hanging off an SI/Act page?
 *   B3. gov.uk search: what document types exist for impact assessments, and
 *       how many?
 *   B4. Regulatory Policy Committee opinions — count and shape.
 *
 * §C consultations
 *   C1. Is there a bulk route at all, or only the search API?
 *   C2. gov.uk search document types for consultations, and counts.
 *   C3. What does the Content API give for one consultation — is the government
 *       response and the responses themselves attached, and can we tell an
 *       individually-published response from a summarised one?
 */
import fs from 'fs'
import path from 'path'

const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const SEARCH = 'https://www.gov.uk/api/search.json'
const CONTENT = 'https://www.gov.uk/api/content'
const LEG = 'https://www.legislation.gov.uk'
const OUT = path.join(__dirname, '../../docs/v34_probe')
fs.mkdirSync(OUT, { recursive: true })

async function raw(url: string, accept = 'application/json'): Promise<{ status: number | string; ct: string; text: string }> {
  try {
    const res = await fetch(url, { headers: { Accept: accept, 'User-Agent': UA }, signal: AbortSignal.timeout(45_000) })
    return { status: res.status, ct: res.headers.get('content-type') ?? '', text: await res.text() }
  } catch (e: any) { return { status: 'ERR', ct: '', text: String(e?.message) } }
}
async function json(url: string, label?: string): Promise<any> {
  const r = await raw(url)
  let b: any
  try { b = JSON.parse(r.text) } catch { b = { __status: r.status, __ct: r.ct, __raw: r.text.slice(0, 400) } }
  if (label) fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify(b, null, 2))
  return b
}
// gov.uk search total for a document type, without pulling the results
async function govukCount(field: string, value: string): Promise<number | string> {
  const b = await json(`${SEARCH}?filter_${field}=${encodeURIComponent(value)}&count=0`)
  return b?.total ?? `?? ${JSON.stringify(b).slice(0, 160)}`
}

async function main() {
  console.log('════════ §B  IMPACT ASSESSMENTS ════════')

  console.log('\n--- B1. legislation.gov.uk `ukia` type (BULK route — cheapest if it exists)')
  for (const url of [`${LEG}/ukia`, `${LEG}/ukia/2023`, `${LEG}/ukia/data.feed`, `${LEG}/ukia/2023/data.feed?page=1`]) {
    const r = await raw(url, 'application/atom+xml,text/html')
    const isAtom = /<feed|<entry/i.test(r.text)
    const entries = (r.text.match(/<entry[\s>]/gi) ?? []).length
    const totalMatch = r.text.match(/<openSearch:totalResults>(\d+)</i)
    console.log(`  ${url}`)
    console.log(`    ${r.status} ${r.ct.split(';')[0]} atom=${isAtom} entries=${entries} totalResults=${totalMatch?.[1] ?? '—'}`)
    if (r.status === 200 && entries) {
      const first = r.text.match(/<entry[\s\S]*?<\/entry>/i)?.[0] ?? ''
      const title = first.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      const link = first.match(/<link[^>]*href="([^"]+)"/i)?.[1]
      console.log(`    first entry: "${String(title).trim().slice(0, 90)}"  →  ${link}`)
      fs.writeFileSync(path.join(OUT, 'ukia-feed.xml'), r.text.slice(0, 20000))
    }
    await new Promise(r2 => setTimeout(r2, 400))
  }

  console.log('\n--- B2. IAs as `resources` off an SI page')
  for (const url of [`${LEG}/uksi/2023/1/resources`, `${LEG}/uksi/2023/1/impacts`]) {
    const r = await raw(url, 'text/html')
    const hasIA = /impact assessment/i.test(r.text)
    console.log(`  ${url}\n    ${r.status} ${r.ct.split(';')[0]} mentions "impact assessment"=${hasIA} len=${r.text.length}`)
    await new Promise(r2 => setTimeout(r2, 400))
  }

  console.log('\n--- B3. gov.uk search document types for impact assessments')
  for (const [f, v] of [
    ['content_store_document_type', 'impact_assessment'],
    ['format', 'impact_assessment'],
    ['content_store_document_type', 'independent_report'],
  ] as Array<[string, string]>) {
    console.log(`  filter_${f}=${v}  →  total ${await govukCount(f, v)}`)
    await new Promise(r2 => setTimeout(r2, 400))
  }
  const iaSample = await json(`${SEARCH}?filter_content_store_document_type=impact_assessment&count=3&fields=link,title,public_timestamp,organisations&order=-public_timestamp`, 'govuk-ia-sample')
  console.log(`  sample results: ${iaSample?.results?.length ?? 0}`)
  for (const r of iaSample?.results ?? []) console.log(`    ${String(r.public_timestamp).slice(0, 10)}  ${r.link}\n       "${String(r.title).slice(0, 90)}"`)

  console.log('\n--- B4. Regulatory Policy Committee')
  console.log(`  filter_organisations=regulatory-policy-committee  →  total ${await govukCount('organisations', 'regulatory-policy-committee')}`)
  const rpc = await json(`${SEARCH}?filter_organisations=regulatory-policy-committee&count=3&fields=link,title,content_store_document_type,public_timestamp&order=-public_timestamp`, 'govuk-rpc-sample')
  for (const r of rpc?.results ?? []) console.log(`    [${r.content_store_document_type}] ${r.link}\n       "${String(r.title).slice(0, 90)}"`)

  console.log('\n--- B5. One IA through the Content API — is the text there, or only a PDF?')
  const iaPath = iaSample?.results?.[0]?.link
  if (iaPath) {
    const c = await json(`${CONTENT}${iaPath}`, 'govuk-ia-content')
    const att = c?.details?.attachments ?? []
    console.log(`  ${iaPath}`)
    console.log(`    document_type=${c?.document_type} schema=${c?.schema_name}`)
    console.log(`    details keys: ${Object.keys(c?.details ?? {}).join(', ')}`)
    console.log(`    body chars: ${String(c?.details?.body ?? '').length}`)
    console.log(`    attachments: ${att.length}`)
    for (const a of att.slice(0, 5)) console.log(`      [${a.content_type}] ${a.title?.slice(0, 70)}\n        ${a.url}`)
  }

  console.log('\n\n════════ §C  CONSULTATIONS ════════')

  console.log('\n--- C2. gov.uk document types for consultations')
  for (const v of ['consultation', 'open_consultation', 'closed_consultation', 'consultation_outcome']) {
    console.log(`  content_store_document_type=${v.padEnd(20)} →  total ${await govukCount('content_store_document_type', v)}`)
    await new Promise(r2 => setTimeout(r2, 400))
  }

  console.log('\n--- C3. One consultation outcome through the Content API')
  const cs = await json(`${SEARCH}?filter_content_store_document_type=consultation_outcome&count=3&fields=link,title,public_timestamp,organisations&order=-public_timestamp`, 'govuk-consult-sample')
  for (const r of cs?.results ?? []) console.log(`    ${String(r.public_timestamp).slice(0, 10)}  ${r.link}\n       "${String(r.title).slice(0, 90)}"`)
  const cPath = cs?.results?.[0]?.link
  if (cPath) {
    const c = await json(`${CONTENT}${cPath}`, 'govuk-consult-content')
    console.log(`\n  ${cPath}`)
    console.log(`    document_type=${c?.document_type} schema=${c?.schema_name}`)
    console.log(`    details keys: ${Object.keys(c?.details ?? {}).join(', ')}`)
    console.log(`    body chars: ${String(c?.details?.body ?? '').length}`)
    const att = c?.details?.attachments ?? []
    console.log(`    attachments: ${att.length}`)
    for (const a of att.slice(0, 8)) console.log(`      [${a.content_type ?? a.attachment_type}] ${String(a.title).slice(0, 70)}\n        ${a.url}`)
    console.log(`    body head: ${String(c?.details?.body ?? '').replace(/\s+/g, ' ').slice(0, 500)}`)
  }

  console.log('\n--- C1. Bulk route? (govuk publishes a search index, not a dump — verify)')
  for (const url of [
    'https://www.gov.uk/api/search.json?count=0',
    'https://docs.publishing.service.gov.uk/repos/search-api.html',
  ]) {
    const r = await raw(url, 'text/html,application/json')
    console.log(`  ${url}\n    ${r.status} ${r.ct.split(';')[0]} len=${r.text.length}`)
  }
  const deep = await json(`${SEARCH}?filter_content_store_document_type=consultation_outcome&count=10&start=9000&fields=link&order=public_timestamp`)
  console.log(`  deep page start=9000 → ${Array.isArray(deep?.results) ? deep.results.length : JSON.stringify(deep).slice(0, 200)}`)

  console.log(`\nRaw payloads in ${OUT}`)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
