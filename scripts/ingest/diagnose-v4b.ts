/**
 * V4b — targeted fix investigation for FCA and ECHR
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

async function testFcaSections() {
  console.log('\n=== FCA — direct section URL test ===')
  const base = 'https://www.handbook.fca.org.uk'
  // Try fetching individual COBS chapters directly
  const testUrls = [
    `${base}/handbook/COBS/1`,
    `${base}/handbook/COBS/2`,
    `${base}/handbook/COBS/2/1`,
  ]
  for (const url of testUrls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'Scrutinise/1.0' } })
      const text = await r.text()
      const hasContent = text.length > 5000
      const scriptOnly = text.includes('<script') && !text.includes('<p ')
      // Look for actual text content patterns
      const paragraphs = (text.match(/<p[ >]/g) ?? []).length
      console.log(`  ${url}: status=${r.status}, len=${text.length}, paragraphs=${paragraphs}, script-only=${scriptOnly}`)
    } catch (err) {
      console.log(`  ${url}: ${err}`)
    }
  }

  // Check if FCA has an XML/JSON export
  const xmlUrls = [
    `${base}/handbook/COBS.xml`,
    `${base}/api/v1/handbook/COBS`,
    `${base}/handbook/COBS?format=json`,
    `${base}/sitemap.xml`,
  ]
  for (const url of xmlUrls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'Scrutinise/1.0' } })
      const ct = r.headers.get('content-type') ?? ''
      const text = await r.text()
      console.log(`  ${url}: status=${r.status}, ct=${ct}, len=${text.length}, preview=${text.slice(0, 100).replace(/\s+/g, ' ')}`)
    } catch (err) {
      console.log(`  ${url}: ${err}`)
    }
  }
}

async function testEchrNewEndpoints() {
  console.log('\n=== ECHR — finding new API endpoint ===')
  const base = 'https://hudoc.echr.coe.int'
  const testUrls = [
    // Try different HUDOC API paths
    `${base}/app/query/results?query=doctype%3AJUDGMENTS&start=0&length=1`,
    `${base}/webservices/search?query=doctype:JUDGMENTS&rows=1`,
    `${base}/app/search?query=doctype:JUDGMENTS&rows=1`,
    `${base}/search?q=UK&rows=1`,
    // Try the OData endpoint
    `${base}/odata/Judgments?$top=1&$filter=country eq 'GBR'`,
    // Try RSS feed
    `${base}/app/rss/judgments/country/GBR`,
  ]
  for (const url of testUrls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'Scrutinise/1.0', Accept: 'application/json, text/html' } })
      const ct = r.headers.get('content-type') ?? ''
      const text = await r.text()
      console.log(`  ${url.slice(base.length)}: status=${r.status}, ct=${ct.slice(0, 30)}, len=${text.length}, preview=${text.slice(0, 80).replace(/\s+/g, ' ')}`)
    } catch (err) {
      console.log(`  ${url.slice(base.length)}: ${err}`)
    }
  }
}

async function main() {
  await Promise.all([testFcaSections(), testEchrNewEndpoints()])
}

main().catch(e => { console.error(e); process.exit(1) })
