/**
 * diag-has-no-provisions.ts — sample 100 pending SI rows, check hasNoProvisions rate.
 *
 * Fetches TNA CLML XML for each row and checks if NumberOfProvisions="0" is present.
 * Used in V11 to decide whether to add the hasNoProvisions skip in enumerateSections.
 *
 * Run:
 *   NODE_PATH=scrutinise-web/node_modules \
 *   scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json \
 *   scripts/ingest/diag-has-no-provisions.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}

import { Pool } from 'pg'

function rootAttrs(xml: string): string {
  const afterDecl = xml.trimStart().startsWith('<?') ? xml.indexOf('?>') + 2 : 0
  const end = xml.indexOf('>', afterDecl)
  return end === -1 ? '' : xml.slice(afterDecl, end + 1)
}

function checkHasNoProvisions(xml: string): boolean {
  return /\bNumberOfProvisions="0"/.test(rootAttrs(xml))
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
    statement_timeout: 30_000,
  })

  const { rows } = await pool.query<{ corpus: string; docId: string }>(`
    SELECT corpus, "docId"
    FROM ingest_queue
    WHERE corpus IN ('si-pre-2010', 'si-2010plus')
      AND status = 'pending'
    ORDER BY RANDOM()
    LIMIT 100
  `)
  await pool.end()

  console.log(`[diag-hnp] sampling ${rows.length} pending SI rows`)

  let noProvisions = 0
  let hasProvisions = 0
  let fetchErrors = 0
  const examples: string[] = []

  for (const row of rows) {
    const url = `https://www.legislation.gov.uk/${row.docId}/data.xml`
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (research)' },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) { fetchErrors++; continue }
      const xml = await res.text()
      if (checkHasNoProvisions(xml)) {
        noProvisions++
        if (examples.length < 3) examples.push(row.docId)
      } else {
        hasProvisions++
      }
    } catch {
      fetchErrors++
    }
    await new Promise(r => setTimeout(r, 300))
  }

  const total = noProvisions + hasProvisions
  const rate = total > 0 ? ((noProvisions / total) * 100).toFixed(1) : 'N/A'

  console.log(`\n[diag-hnp] Results from ${rows.length} sampled rows:`)
  console.log(`  hasNoProvisions=true:  ${noProvisions} / ${total}  (${rate}%)`)
  console.log(`  hasNoProvisions=false: ${hasProvisions}`)
  console.log(`  fetchErrors:           ${fetchErrors}`)
  if (examples.length > 0) console.log(`  Examples: ${examples.join(', ')}`)
  console.log(`\n  Threshold >40%: ${parseFloat(rate) > 40 ? '⚠️  EXCEEDED — skip added to enumerateSections (V11)' : '✅ Below — HTML/PDF fallback is still worthwhile'}`)
}

main().catch(e => { console.error(e); process.exit(1) })
