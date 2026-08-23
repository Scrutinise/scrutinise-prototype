/**
 * verify-retired-gone.ts — INGEST-LABELS §3's acceptance test, and it does NOT count rows.
 *
 * ⚠ "A count of rows deleted proves nothing about what a user can reach" — the brief's own words,
 * and the reason this queries the LIVE serving endpoint rather than the tables. Two things can make
 * a deleted row still reachable: `fts-serve` and `vector-serve` hold their Lance tables OPEN at
 * boot, so until they are redeployed they serve the pre-delete snapshot; and `fts-catchup` will
 * re-add any id it finds in `corpus_sections`, so a delete that skipped the database resurrects
 * itself on the next run.
 *
 * ⚠ IT IS TWO-SIDED. Each retired collection has a known string; the same probe is run against the
 * SUPERSEDING collection, which must still return it. A run where both sides return nothing is a
 * broken probe, not a successful removal — that is the shape that would otherwise read as success.
 *
 * Usage: FTS_SEARCH_URL=… tsx labels/verify-retired-gone.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })

const FTS = (process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production.up.railway.app').replace(/\/$/, '')

interface Case { retired: string; superseding: string; query: string; what: string }
const CASES: Case[] = [
  { retired: 'lda-lordswrittenquestions', superseding: 'pwdata-lordswrans',
    query: 'Andy Li eleven other young detainees citizens of Hong Kong', what: 'Lord Hylton on Hong Kong detainees' },
  { retired: 'lda-commonswrittenquestions', superseding: 'pwdata-wrans',
    query: 'to ask the Secretary of State for Justice what assessment has been made', what: 'a Commons written question' },
  { retired: 'written-statements', superseding: 'pwdata-wms',
    query: 'COVID-status certification reopen our economy reduce restrictions on social contact', what: 'the April 2021 COVID-status WMS' },
]

async function hits(query: string, corpus: string): Promise<number> {
  const res = await fetch(`${FTS}/fts-search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit: 10, corpora: [corpus] }),
  })
  if (!res.ok) throw new Error(`FTS ${res.status}`)
  const j = await res.json() as { results?: unknown[] }
  return (j.results ?? []).length
}

async function main() {
  console.log(`=== §3 VERIFICATION — through ${FTS}, not through a row count ===\n`)
  let pass = 0
  for (const c of CASES) {
    const gone = await hits(c.query, c.retired)
    const kept = await hits(c.query, c.superseding)
    const ok = gone === 0 && kept > 0
    if (ok) pass++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.what}`)
    console.log(`      retired    ${c.retired.padEnd(30)} → ${gone} hits   (must be 0)`)
    console.log(`      superseding ${c.superseding.padEnd(29)} → ${kept} hits   (must be > 0 — else the probe is broken, not the removal successful)`)
  }
  console.log(`\n${pass}/${CASES.length} pass.`)
  if (pass !== CASES.length) {
    console.log('\nIf the retired side still returns hits, the most likely cause is that fts-serve has not been')
    console.log('redeployed since the delete — it holds the Lance table open from boot. Redeploy, then re-run.')
    process.exitCode = 1
  }
}

main().catch(e => { console.error(e); process.exitCode = 1 })
