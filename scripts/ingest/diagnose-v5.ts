/**
 * V5 diagnostic — tests all Part 1–4 APIs and SQL checks in one pass.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 30_000,
})

async function testTwfy() {
  console.log('\n=== PART 1 — TheyWorkForYou API ===')
  const url = 'https://www.theyworkforyou.com/api/getDebates?type=commons&date=2024-01-15&output=json'
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    console.log(`  status=${r.status}, content-type=${r.headers.get('content-type')}`)
    const text = await r.text()
    console.log(`  first 300: ${text.slice(0, 300)}`)
    if (r.status === 200) {
      try {
        const d = JSON.parse(text) as { rows?: unknown[] }
        console.log(`  rows count: ${d.rows?.length ?? 'no rows key'}`)
      } catch { console.log('  (not valid JSON)') }
    }
  } catch (err) { console.log(`  error: ${err}`) }
}

async function testFcaAlternatives() {
  console.log('\n=== PART 2 — FCA alternatives ===')
  const urls = [
    'https://www.fca.org.uk/news/speeches.rss',
    'https://www.fca.org.uk/publication/data/handbook-changelog.xml',
    'https://www.fca.org.uk/publications?type=policy-statement&start=0',
    'https://www.fca.org.uk/publications.rss',
  ]
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(12_000), headers: { 'User-Agent': 'Scrutinise/1.0' } })
      const text = await r.text()
      const ct = r.headers.get('content-type') ?? ''
      console.log(`  ${url.replace('https://www.fca.org.uk', '')}: status=${r.status}, ct=${ct.slice(0, 40)}, len=${text.length}`)
      if (r.ok && text.length > 100) console.log(`    preview: ${text.slice(0, 150).replace(/\s+/g, ' ')}`)
    } catch (err) { console.log(`  ${url.slice(30)}: error=${err}`) }
  }
}

async function testEchrAlternatives() {
  console.log('\n=== PART 3 — ECHR alternative endpoints ===')
  const base = 'https://hudoc.echr.coe.int'
  const endpoints = [
    `${base}/app/query/results?query=contry%3AGBR&select=docname&start=0&length=10`,
    `${base}/eng?query=contry%3AGBR`,
    `https://echr.coe.int/api/v1/cases?country=GBR&limit=10`,
    // Try the new HUDOC search API path
    `${base}/webservices/search?query=country%3AGBR&rows=5&start=0`,
    `${base}/app/query/results?query=country%3AGBR+AND+doctype%3AJUDGMENTS&select=itemid&start=0&length=5`,
    // Try without the contry typo
    `${base}/app/query/results?query=country%3AGBR&select=itemid&start=0&length=5`,
  ]
  for (const url of endpoints) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json', 'User-Agent': 'Scrutinise/1.0' } })
      const text = await r.text()
      const ct = r.headers.get('content-type') ?? ''
      const isJson = ct.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[')
      console.log(`  ${url.replace(base, '').replace('https://echr.coe.int', '')}: status=${r.status}, json=${isJson}, len=${text.length}`)
      if (r.ok && isJson) console.log(`    preview: ${text.slice(0, 200)}`)
    } catch (err) { console.log(`  ${url.slice(0, 60)}: error=${err}`) }
  }
}

async function testEurLex() {
  console.log('\n=== PART 4 — EUR-Lex diagnosis ===')
  // SQL: check if corpus_sections has any eur-lex rows
  const q1 = await pool.query(`SELECT corpus, status, COUNT(*) FROM ingest_queue WHERE corpus='eur-lex' GROUP BY corpus, status`)
  console.log('  EUR-Lex queue state:'); console.table(q1.rows)
  const q2 = await pool.query(`SELECT COUNT(*) as sections FROM corpus_sections WHERE corpus='eur-lex'`)
  console.log('  EUR-Lex corpus_sections:', q2.rows[0].sections)

  // Test EUR-Lex API
  const url = `https://eur-lex.europa.eu/search.html?scope=EURLEX&type=quick&lang=en&andText0=united+kingdom&celex=3*&page=1&pageSize=5&format=json`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { Accept: 'application/json', 'User-Agent': 'Scrutinise/1.0', 'Accept-Language': 'en' } })
    const text = await r.text()
    const ct = r.headers.get('content-type') ?? ''
    console.log(`  EUR-Lex API: status=${r.status}, ct=${ct.slice(0, 40)}, len=${text.length}`)
    console.log(`  preview: ${text.slice(0, 300).replace(/\s+/g, ' ')}`)
  } catch (err) { console.log(`  EUR-Lex API error: ${err}`) }
}

async function checkCommittees() {
  console.log('\n=== PART 5 — Committee Reports / api.parliament.uk test ===')
  try {
    const r = await fetch('https://api.parliament.uk/v1/committees?take=1', {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Scrutinise/1.0' },
    })
    console.log(`  api.parliament.uk/v1/committees: status=${r.status}`)
  } catch (err) { console.log(`  committees API: error=${err}`) }

  // Also check current queue state for committees
  const q = await pool.query(`SELECT corpus, status, COUNT(*) FROM ingest_queue WHERE corpus LIKE 'commit%' GROUP BY corpus, status`)
  console.table(q.rows)
}

async function main() {
  await Promise.all([testTwfy(), testFcaAlternatives(), testEchrAlternatives(), testEurLex(), checkCommittees()])
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
