/**
 * probe-vector-response.ts — what the deployed vector service actually returns, printed verbatim.
 * §3 asks what a user is SHOWN, and the field names decide whether a snippet is even in the
 * response. WRITES NOTHING.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })

const URL_BASE = (process.env.VECTOR_SEARCH_URL ?? 'https://vector-serve-production.up.railway.app').replace(/\/$/, '')

;(async () => {
  const res = await fetch(`${URL_BASE}/vector-search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'was the prorogation of Parliament in 2019 unlawful', limit: 3, noCache: true }),
  })
  console.log(`${URL_BASE}/vector-search -> HTTP ${res.status}`)
  const j = await res.json() as Record<string, unknown>
  console.log('top-level keys:', Object.keys(j).join(', '))
  const results = (j.results ?? []) as Array<Record<string, unknown>>
  if (results[0]) console.log('result keys:', Object.keys(results[0]).join(', '))
  results.forEach((r, i) => console.log(`${i + 1}. ${r.id}  snippet ${String(r.snippet ?? '').length} chars
   "${String(r.snippet ?? '').slice(0, 220)}"`))
})().catch(e => { console.error(e); process.exit(1) })
