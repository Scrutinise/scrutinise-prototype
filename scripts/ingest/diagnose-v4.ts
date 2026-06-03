/**
 * V4 diagnostic script — runs all Part 1 + Part 2 diagnostics in one pass.
 * Run:
 *   NODE_PATH=scrutinise-web/node_modules \
 *   scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json \
 *   scripts/ingest/diagnose-v4.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 30_000,
})

async function runSql() {
  // Part 1 SQL
  console.log('\n=== CASELAW — recent queue rows + lastError ===')
  const q1 = await pool.query(`
    SELECT "docId", status, "lastError", "createdAt"
    FROM ingest_queue WHERE corpus = 'tna-caselaw'
    ORDER BY "createdAt" DESC LIMIT 10
  `)
  console.table(q1.rows)

  console.log('\n=== CASELAW — lastError patterns ===')
  const q2 = await pool.query(`
    SELECT "lastError", COUNT(*) FROM ingest_queue
    WHERE corpus = 'tna-caselaw' AND "lastError" IS NOT NULL
    GROUP BY "lastError" ORDER BY COUNT(*) DESC LIMIT 10
  `)
  console.table(q2.rows)

  console.log('\n=== CASELAW — docId range + count ===')
  const q3 = await pool.query(`
    SELECT MIN("docId"), MAX("docId"), COUNT(*) FROM ingest_queue
    WHERE corpus = 'tna-caselaw'
  `)
  console.table(q3.rows)
}

async function testCaselawFeed() {
  console.log('\n=== CASELAW FEED — page 1 entry count ===')
  try {
    const r1 = await fetch('https://caselaw.nationalarchives.gov.uk/atom.xml?page=1&per_page=50',
      { signal: AbortSignal.timeout(15_000) })
    const text = await r1.text()
    const entries = text.match(/<entry>/g)?.length ?? 0
    const lastPage = text.match(/href="[^"]+\?page=([0-9]+)"[^>]*rel="last"/)?.[1] ?? 'not found'
    console.log(`Page 1: status=${r1.status}, entries=${entries}, last-page=${lastPage}`)

    // Test page 1500 — if this is where they stop
    const r2 = await fetch('https://caselaw.nationalarchives.gov.uk/atom.xml?page=1500',
      { signal: AbortSignal.timeout(15_000) })
    const text2 = await r2.text()
    const entries2 = text2.match(/<entry>/g)?.length ?? 0
    console.log(`Page 1500: status=${r2.status}, entries=${entries2}`)

    // Test page 1501
    const r3 = await fetch('https://caselaw.nationalarchives.gov.uk/atom.xml?page=1501',
      { signal: AbortSignal.timeout(15_000) })
    const text3 = await r3.text()
    const entries3 = text3.match(/<entry>/g)?.length ?? 0
    console.log(`Page 1501: status=${r3.status}, entries=${entries3}`)

    // Test a high page
    const r4 = await fetch('https://caselaw.nationalarchives.gov.uk/atom.xml?page=7489',
      { signal: AbortSignal.timeout(15_000) })
    const text4 = await r4.text()
    const entries4 = text4.match(/<entry>/g)?.length ?? 0
    console.log(`Page 7489: status=${r4.status}, entries=${entries4}, first 300: ${text4.slice(0, 300)}`)
  } catch (err) {
    console.log(`Caselaw feed error: ${err}`)
  }
}

async function testFca() {
  console.log('\n=== FCA HANDBOOK ===')
  try {
    // The worker uses HTML scraping — test if the page has inline links or is JS-only
    const r = await fetch('https://www.handbook.fca.org.uk/handbook/COBS',
      { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'Scrutinise/1.0' } })
    const text = await r.text()
    const allHrefs = text.match(/href="[^"]*"/g) ?? []
    const cobsLinks = text.match(/href="\/handbook\/COBS\/[^"]*"/g) ?? []
    const hasScripts = text.includes('<script')
    console.log(`COBS TOC: status=${r.status}, total hrefs=${allHrefs.length}, COBS section links=${cobsLinks.length}, has <script>=${hasScripts}`)
    console.log(`  First 500 chars of body: ${text.slice(0, 500).replace(/\s+/g, ' ')}`)

    // Also try the JSON API if it exists
    const rj = await fetch('https://www.handbook.fca.org.uk/api/handbook/COBS',
      { signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json', 'User-Agent': 'Scrutinise/1.0' } })
    console.log(`  JSON API attempt: status=${rj.status}, content-type=${rj.headers.get('content-type')}`)
  } catch (err) {
    console.log(`FCA error: ${err}`)
  }
}

async function testEchr() {
  console.log('\n=== ECHR HUDOC ===')
  // Try multiple URL patterns — API may have changed
  const urls = [
    'https://hudoc.echr.coe.int/app/query/results?select=itemid,docname,kpdate&query=country%3AGBR+AND+%28doctype%3AJUDGMENTS+OR+doctype%3ADECISIONS%29&start=0&length=5',
    'https://hudoc.echr.coe.int/app/query/results?select=itemid&query=contry%3AGBR&start=0&length=5',
    'https://hudoc.echr.coe.int/eng?i=001-57834',  // test if HUDOC itself responds
  ]
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'Scrutinise/1.0' } })
      const body = await r.text()
      console.log(`  ${url.slice(0, 70)}: status=${r.status}, body[0:100]=${body.slice(0, 100)}`)
    } catch (err) {
      console.log(`  ${url.slice(0, 70)}: error=${err}`)
    }
  }
}

async function testWrittenAnswers() {
  console.log('\n=== PARLIAMENT — Written Answers ===')
  try {
    const r = await fetch(
      'https://questions-statements-api.parliament.uk/api/writtenquestions/questions' +
      '?answeredWhenFrom=2024-01-01&answeredWhenTo=2024-01-31&take=3',
      { signal: AbortSignal.timeout(20_000) }
    )
    console.log(`Written Answers: status=${r.status}`)
    if (r.ok) {
      const data = await r.json() as { totalResults?: number; results?: Array<Record<string, unknown>> }
      console.log(`  totalResults=${data?.totalResults}, returned=${data?.results?.length}`)
      if (data?.results?.[0]) console.log(`  first result keys: ${Object.keys(data.results[0]).join(', ')}`)
    }
  } catch (err) {
    console.log(`Written Answers error: ${err}`)
  }
}

async function testWrittenStatements() {
  console.log('\n=== PARLIAMENT — Written Statements ===')
  try {
    const r = await fetch(
      'https://questions-statements-api.parliament.uk/api/writtenstatements/statements' +
      '?madeWhenFrom=2024-01-01&madeWhenTo=2024-01-31&take=3',
      { signal: AbortSignal.timeout(20_000) }
    )
    console.log(`Written Statements: status=${r.status}`)
    if (r.ok) {
      const data = await r.json() as { totalResults?: number; results?: Array<Record<string, unknown>> }
      console.log(`  totalResults=${data?.totalResults}, returned=${data?.results?.length}`)
      if (data?.results?.[0]) console.log(`  first result keys: ${Object.keys(data.results[0]).join(', ')}`)
    }
  } catch (err) {
    console.log(`Written Statements error: ${err}`)
  }
}

async function main() {
  await Promise.all([
    runSql(),
    testCaselawFeed(),
    testFca(),
    testEchr(),
    testWrittenAnswers(),
    testWrittenStatements(),
  ])
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
