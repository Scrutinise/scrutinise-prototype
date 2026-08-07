/**
 * v32-acceptance-live.ts — the §1 acceptance test, run against the LIVE fts-serve rather than
 * against a local Lance handle.
 *
 * WHY LIVE. The whole point of the sprint is that a committee's conclusions become findable by
 * the thing users actually query. `fts-serve` calls `openTable()` once at boot and holds a fixed
 * snapshot, so a merge is only real to users after a redeploy — testing a local table would
 * report success while the service still served the old index (docs/CLAUDE.md §17).
 *
 * WHAT IT ASSERTS, per phrase: that a COMMITTEE REPORT SECTION comes back in the top-N, and that
 * the phrase is literally in the body that came back. A BM25 hit on a multi-word phrase can be
 * carried entirely by its common words — GOLD_TEST_09 recorded exactly that trap ("cosy club"
 * looked present when the matches were 1983 debates on data protection).
 *
 * BASELINE TO BEAT: before this sprint, the same phrases could not be retrieved at all, because
 * each report was ONE document of up to 455,137 characters and BM25 length normalisation buried
 * it below any usable depth.
 *
 * Read-only. Usage: tsx v32-acceptance-live.ts [--limit 60]
 */
const SERVE = process.env.FTS_SERVE_URL ?? 'https://fts-serve-production.up.railway.app'
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 60 })()

/** The phrases the V32 audit proved are IN the 2020+ bodies we hold but were not retrievable. */
const PHRASES = [
  { phrase: 'most important public health failures', note: 'Coronavirus: lessons learned to date (HC 92)' },
  { phrase: 'public health failures', note: 'shorter variant' },
  { phrase: 'gradual and incremental', note: 'lessons learned — the initial covid strategy' },
  { phrase: 'measurable difference', note: 'PAC — whether Test and Trace met its objective' },
  { phrase: 'eye-watering', note: 'PAC variant, 26 documents' },
]

import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get } from './shared/r2-client'

const norm = (s: string) => s.replace(/\s+/g, ' ').toLowerCase()
let pass = 0, fail = 0

/**
 * Containment is checked against the SECTION'S STORED BODY, not against the response.
 * `fts-serve` returns a `snippet` — a fragment — so a phrase can be genuinely present in the
 * section and absent from the snippet. Checking the snippet would under-report; checking
 * nothing would over-report. The first version of this file read a `body` field that the
 * service does not return at all, and scored 0/5 against a system that was working.
 */
async function bodyContains(ids: string[], needle: string): Promise<string[]> {
  if (ids.length === 0) return []
  const p = getNeonPool()
  const { rows } = await p.query<{ id: string; r2Key: string }>(
    `SELECT id, "r2Key" FROM corpus_sections WHERE id = ANY($1::text[]) AND "r2Key" IS NOT NULL`, [ids])
  const out: string[] = []
  for (const r of rows) {
    const b = await r2Get(r.r2Key)
    if (b && norm(b).includes(needle)) out.push(r.id)
  }
  return out
}

async function search(q: string): Promise<any[]> {
  const res = await fetch(`${SERVE}/fts-search`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q, limit: LIMIT, tier: 'parliamentary', corpora: ['committees-reports', 'committees-evidence'] }),
  })
  if (!res.ok) throw new Error(`fts-serve ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = await res.json() as any
  return j.results ?? j.hits ?? j.rows ?? []
}

async function main() {
  console.log(`\n═══ §1 ACCEPTANCE — live retrieval from ${SERVE} ═══════════════════\n`)
  const health = await fetch(`${SERVE}/stats`).then(r => r.json()).catch(() => null) as any
  console.log(`  service: ${health ? `served=${health.served} rss=${health.memory?.rss_mb}MB` : 'unreachable'}\n`)

  for (const c of PHRASES) {
    let hits: any[] = []
    try { hits = await search(c.phrase) } catch (e) { console.log(`  ✗ ${c.phrase} — ${(e as Error).message}`); fail++; continue }
    const needle = norm(c.phrase)
    const reportHits = hits.filter(h => String(h.id ?? '').startsWith('committees-reports:'))
    const confirmed = await bodyContains(reportHits.map(h => String(h.id)), needle)
    const rank = confirmed.length ? reportHits.findIndex(h => confirmed.includes(String(h.id))) + 1 : -1
    const ok = confirmed.length > 0
    if (ok) pass++; else fail++
    console.log(`  ${ok ? '✅' : '❌'} "${c.phrase}"`)
    console.log(`       retrieved ${hits.length}; committee-report sections ${reportHits.length}; ` +
      `phrase CONFIRMED in the stored body of ${confirmed.length}` + (rank > 0 ? `, best at rank ${rank}` : '') + `  — ${c.note}`)
    for (const id of confirmed.slice(0, 2)) {
      const h = reportHits.find(x => String(x.id) === id)
      console.log(`         ${id}`)
      console.log(`         ${String(h?.sectionTitle ?? '').slice(0, 110)}`)
    }
  }

  console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass}/${pass + fail} phrases retrievable as committee report sections`)
  await endNeonPool()
  process.exit(fail === 0 ? 0 : 1)
}
main().catch(e => { console.error('[acceptance] FATAL', e); process.exit(1) })
