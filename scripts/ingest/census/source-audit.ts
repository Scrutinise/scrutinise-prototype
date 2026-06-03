/**
 * source-audit.ts — Live HTTP connectivity test for every source in CORPUS_MANIFEST.
 * Reports accessibility, HTTP code, content type, and sample size for each source.
 * Read-only: no queue modifications, no writes.
 *
 * Usage: tsx scripts/ingest/census/source-audit.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const UA = 'Scrutinise-Audit/1.0 (civic research; +https://scrutinise.org/about)'
const TIMEOUT_MS = 15_000

type AuditStatus = '✅' | '⚠️ ' | '⛔' | '❓'

interface AuditResult {
  label: string
  status: AuditStatus
  httpCode: number | null
  note: string
  sampleSize?: string
}

async function probe(url: string, expectContent?: string): Promise<{
  ok: boolean; code: number | null; contentType: string; bodySize: number; bodySnippet: string
}> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/json,application/xml,*/*' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    })
    const body = await res.text()
    const contentType = res.headers.get('content-type') ?? 'unknown'
    return {
      ok: res.ok,
      code: res.status,
      contentType,
      bodySize: body.length,
      bodySnippet: body.slice(0, 200).replace(/\s+/g, ' '),
    }
  } catch (err) {
    return { ok: false, code: null, contentType: '', bodySize: 0, bodySnippet: String(err).slice(0, 100) }
  }
}

async function auditOne(label: string, url: string, checks?: {
  jsOnly?: boolean        // expect JS SPA (no server content)
  jsonField?: string      // field that should exist in JSON response
  xmlTag?: string         // XML tag that should appear
  minSize?: number        // minimum body size in chars
}): Promise<AuditResult> {
  const r = await probe(url)
  const sampleSize = r.bodySize > 0 ? `~${Math.round(r.bodySize / 1024)}KB` : '0B'

  if (!r.ok || r.code === null) {
    return { label, status: '⛔', httpCode: r.code, note: `ERROR: ${r.bodySnippet.slice(0, 80)}`, sampleSize }
  }

  if (checks?.jsOnly) {
    // Check if there's meaningful server-rendered content
    const hasContent = r.bodySnippet.length > 200 &&
      !r.bodySnippet.includes('You need to enable JavaScript') &&
      r.bodySize > 5000
    if (!hasContent) {
      return { label, status: '⛔', httpCode: r.code, note: `JS SPA — no server-rendered content`, sampleSize }
    }
  }

  if (checks?.jsonField) {
    try {
      const json = JSON.parse(r.bodySnippet + '...'.repeat(10)) // try partial parse
    } catch { /* ok, may be truncated */ }
    if (!r.bodySnippet.includes(checks.jsonField)) {
      return { label, status: '⚠️ ', httpCode: r.code, note: `JSON field '${checks.jsonField}' not found`, sampleSize }
    }
  }

  if (checks?.xmlTag && !r.bodySnippet.includes(checks.xmlTag)) {
    return { label, status: '⚠️ ', httpCode: r.code, note: `XML tag '${checks.xmlTag}' not in sample`, sampleSize }
  }

  if (checks?.minSize && r.bodySize < checks.minSize) {
    return { label, status: '⚠️ ', httpCode: r.code, note: `Body too small (${r.bodySize} bytes)`, sampleSize }
  }

  const ct = r.contentType.split(';')[0].trim()
  return { label, status: '✅', httpCode: r.code, note: `${ct}`, sampleSize }
}

// ── Individual source tests ───────────────────────────────────────────────────

async function testSparql(): Promise<AuditResult> {
  const url = `https://publications.europa.eu/webapi/rdf/sparql?query=${encodeURIComponent(
    'SELECT ?id WHERE { ?id a <http://data.europa.eu/eli/ontology#LegalResource> } LIMIT 1'
  )}&format=application%2Fsparql-results%2Bjson`
  const r = await probe(url)
  if (!r.ok) return { label: 'EUR-Lex SPARQL', status: '⛔', httpCode: r.code, note: `HTTP ${r.code}` }
  return {
    label: 'EUR-Lex SPARQL',
    status: r.bodySnippet.includes('results') ? '✅' : '⚠️ ',
    httpCode: r.code,
    note: r.bodySnippet.includes('results') ? 'SPARQL results OK' : 'unexpected response',
    sampleSize: `~${Math.round(r.bodySize / 1024)}KB`,
  }
}

async function testLdaEndpoint(label: string, slug: string): Promise<AuditResult> {
  const url = `https://lda.data.parliament.uk/${slug}.json?_pageSize=1&_page=0`
  const r = await probe(url)
  if (!r.ok) return { label, status: '⛔', httpCode: r.code, note: `HTTP ${r.code}` }
  const hasItems = r.bodySnippet.includes('items') || r.bodySnippet.includes('result')
  return {
    label, status: hasItems ? '✅' : '⚠️ ',
    httpCode: r.code,
    note: hasItems ? 'JSON, items field present' : 'unexpected JSON shape',
    sampleSize: `~${Math.round(r.bodySize / 1024)}KB`,
  }
}

// ── Run all audits ────────────────────────────────────────────────────────────

async function main() {
  console.log('=== SOURCE AUDIT — ' + new Date().toISOString() + ' ===\n')

  // Run in batches to avoid hammering single servers
  const results: AuditResult[] = []

  // Batch 1 — confirmed working sources
  const b1 = await Promise.all([
    auditOne('TNA Legislation', 'https://www.legislation.gov.uk/uksi/2024/181/data.xml', { xmlTag: '<?xml', minSize: 1000 }),
    auditOne('TNA Caselaw', 'https://caselaw.nationalarchives.gov.uk/atom.xml?page=1', { xmlTag: '<feed', minSize: 500 }),
    testLdaEndpoint('LDA Parliament (oral Q)', 'commonsoralquestions'),
    testSparql(),
    auditOne('OECD (gov.uk)', 'https://www.gov.uk/api/search.json?q=OECD&count=1', { jsonField: 'results', minSize: 200 }),
  ])
  results.push(...b1)

  // Batch 2 — law commissions
  const b2 = await Promise.all([
    auditOne('Scottish Law Commission', 'https://www.scotlawcom.gov.uk/publications/', { minSize: 5000 }),
    auditOne('NI Law Commission', 'https://www.nilawcommission.gov.uk/publications/', { minSize: 2000 }),
    auditOne('Law Commission (E&W)', 'https://www.lawcom.gov.uk/publications/', { minSize: 5000 }),
    auditOne('HMRC TIINs (gov.uk)', 'https://www.gov.uk/government/collections/tax-information-and-impact-notes-tiins', { minSize: 10000 }),
    auditOne('OTS Reports (gov.uk)', 'https://www.gov.uk/government/collections/office-of-tax-simplification-reports', { minSize: 5000 }),
  ])
  results.push(...b2)

  // Batch 3 — confirmed/likely blocked
  const b3 = await Promise.all([
    auditOne('FCA Handbook', 'https://www.handbook.fca.org.uk/handbook/', { jsOnly: true }),
    auditOne('FCA Publications', 'https://www.fca.org.uk/publications', { minSize: 20000 }),
    auditOne('ECHR HUDOC (alt 1 — api.echr)', 'https://api.echr.coe.int/v1/cases?country=GBR&limit=1'),
    auditOne('ECHR HUDOC (alt 2 — query)', 'https://hudoc.echr.coe.int/app/query/results?query=contry%3AGBR&start=0&length=1'),
    auditOne('BAILII', 'https://www.bailii.org/'),
  ])
  results.push(...b3)

  // Batch 4 — never tested
  const b4 = await Promise.all([
    auditOne('TWFY parser.theyworkforyou.com', 'https://parser.theyworkforyou.com/'),
    auditOne('TWFY pwdata/scrapedxml', 'https://www.theyworkforyou.com/pwdata/scrapedxml/', { minSize: 1000 }),
    auditOne('WQS Written Answers API', 'https://questions-statements-api.parliament.uk/api/writtenquestions/questions?answeredWhenFrom=2024-01-01&answeredWhenTo=2024-01-07&take=1', { jsonField: 'results', minSize: 200 }),
    auditOne('WQS Written Statements API', 'https://questions-statements-api.parliament.uk/api/writtenstatements/statements?madeWhenFrom=2024-01-01&madeWhenTo=2024-01-07&take=1', { jsonField: 'results', minSize: 200 }),
    auditOne('LDA Hansard debates', 'https://lda.data.parliament.uk/hansarddebates.json?_pageSize=1&_page=0'),
  ])
  results.push(...b4)

  // Batch 5 — governance/parliamentary
  const b5 = await Promise.all([
    auditOne('Sentencing Council', 'https://www.sentencingcouncil.org.uk/offences/', { minSize: 10000 }),
    auditOne('College of Policing APP', 'https://www.college.police.uk/app', { minSize: 20000 }),
    auditOne('Erskine May', 'https://erskinemay.parliament.uk/', { minSize: 10000 }),
    auditOne('Bill Pages (Parliament)', 'https://bills.parliament.uk/', { minSize: 10000 }),
    auditOne('Bills API', 'https://bills-api.parliament.uk/api/v1/Bills?CurrentHouse=All&IsAct=false&take=1', { jsonField: 'items', minSize: 200 }),
  ])
  results.push(...b5)

  // Batch 6 — gov.uk content
  const b6 = await Promise.all([
    auditOne('PACE Codes (gov.uk)', 'https://www.gov.uk/government/collections/pace-codes-of-practice', { minSize: 10000 }),
    auditOne('Civil Service Code (gov.uk)', 'https://www.gov.uk/government/publications/civil-service-code', { minSize: 5000 }),
    auditOne('Treasury Green Book (gov.uk)', 'https://www.gov.uk/government/publications/the-green-book-appraisal-and-evaluation-in-central-government', { minSize: 5000 }),
    auditOne('Planning Policy NPPF', 'https://www.gov.uk/guidance/national-planning-policy-framework', { minSize: 10000 }),
    auditOne('Building Regulations (gov.uk)', 'https://www.gov.uk/government/collections/approved-documents', { minSize: 5000 }),
  ])
  results.push(...b6)

  // Batch 7 — regulators
  const b7 = await Promise.all([
    auditOne('CMA Guidelines', 'https://www.gov.uk/cma-cases', { minSize: 5000 }),
    auditOne('Ofcom (rules)', 'https://www.ofcom.org.uk/about-ofcom/policies-and-guidelines', { minSize: 10000 }),
    auditOne('Ofgem (rules)', 'https://www.ofgem.gov.uk/publications', { minSize: 5000 }),
    auditOne('Ofwat (rules)', 'https://www.ofwat.gov.uk/regulated-companies/company-obligations/', { minSize: 5000 }),
    auditOne('Ofsted (rules)', 'https://www.gov.uk/government/organisations/ofsted/about', { minSize: 5000 }),
  ])
  results.push(...b7)

  // Batch 8 — research/statistics
  const b8 = await Promise.all([
    auditOne('Public Consultations (gov.uk)', 'https://www.gov.uk/search/consultations?keywords=&limit=1', { minSize: 10000 }),
    auditOne('NAO Reports', 'https://www.nao.org.uk/reports/', { minSize: 10000 }),
    auditOne('NHS Guidance', 'https://www.england.nhs.uk/publication/', { minSize: 5000 }),
    auditOne('ONS Datasets API', 'https://api.ons.gov.uk/v1/datasets', { jsonField: 'items', minSize: 200 }),
    auditOne('SSRN UK Legal', 'https://api.ssrn.com/content/v1/bindings'),
  ])
  results.push(...b8)

  // Batch 9 — HoC Library, impact assessments, post-leg
  const b9 = await Promise.all([
    auditOne('HoC Library (research)', 'https://commonslibrary.parliament.uk/research-briefings/', { minSize: 10000 }),
    auditOne('White/Green Papers (gov.uk API)', 'https://www.gov.uk/api/search.json?filter_content_store_document_type=policy_paper&count=1', { jsonField: 'results', minSize: 200 }),
    auditOne('Impact Assessments (gov.uk)', 'https://www.gov.uk/api/search.json?filter_content_store_document_type=impact_assessment&count=1', { jsonField: 'results', minSize: 200 }),
    auditOne('Post-Leg Memoranda (gov.uk)', 'https://www.gov.uk/api/search.json?filter_content_store_document_type=post_legislative_scrutiny&count=1', { jsonField: 'results', minSize: 200 }),
    auditOne('Explanatory Notes (legislation.gov.uk)', 'https://www.legislation.gov.uk/en', { minSize: 5000 }),
  ])
  results.push(...b9)

  // Batch 10 — LDA datasets
  const b10 = await Promise.all([
    testLdaEndpoint('LDA commonswrittenquestions', 'commonswrittenquestions'),
    testLdaEndpoint('LDA lordswrittenquestions', 'lordswrittenquestions'),
    testLdaEndpoint('LDA commonsdivisions', 'commonsdivisions'),
    testLdaEndpoint('LDA lordsdivisions', 'lordsdivisions'),
    auditOne('HMRC Manuals (gov.uk API)', 'https://www.gov.uk/api/search.json?q=HMRC+manual+site%3Agov.uk%2Fhmrc-internal-manuals&count=1', { jsonField: 'results', minSize: 200 }),
  ])
  results.push(...b10)

  // Print results table
  console.log('RESULT TABLE:\n')
  for (const r of results) {
    const label = r.label.padEnd(42)
    const code = (r.httpCode !== null ? String(r.httpCode) : '---').padEnd(5)
    const size = (r.sampleSize ?? '').padEnd(8)
    console.log(`${r.status} ${label} HTTP ${code} ${size} ${r.note}`)
  }

  const accessible = results.filter(r => r.status === '✅').length
  const blocked = results.filter(r => r.status === '⛔').length
  const warning = results.filter(r => r.status === '⚠️ ').length
  console.log(`\nSummary: ${accessible} accessible / ${warning} warnings / ${blocked} blocked / ${results.length} total`)
}

main().catch(err => { console.error(err); process.exit(1) })
