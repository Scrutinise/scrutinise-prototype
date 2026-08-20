/**
 * verify-caselaw-retrieval.ts — BRIEF_INGEST_CASELAW_TEXT §3, second and third bullets.
 * "Run three case-law questions through the platform's own retrieval and quote what comes back.
 *  Report the keyword and meaning-based halves separately."
 *
 * KEYWORD half: `search/fts-core.ts::rankedSearch` — the production ranking function itself, run
 * against the live `corpus_fts` table on R2. Not a re-implementation: the same code the serving
 * process calls. ⚠ It opens the table fresh, so it sees the refreshed rows immediately, where the
 * DEPLOYED `fts-serve` calls `openTable()` once at boot and holds that snapshot until redeployed.
 * That gap is named in the report as an action for Charlie, not papered over here.
 *
 * MEANING half: the deployed vector service at VECTOR_SEARCH_URL, over HTTP, exactly as the
 * platform calls it.
 *
 * The stylesheet probe is the one that decides whether the rebuild covered the index: `font-family`
 * is a term no judgment contains and every stored body used to. Run this BEFORE and AFTER.
 *
 * WRITES NOTHING. Run: --label="before the refresh"
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from '../search/lance'
import { rankedSearch } from '../search/fts-core'
import { styleChars } from '../shared/style-detect'

const LABEL = process.argv.find(a => a.startsWith('--label='))?.split('=')[1] ?? ''
const TOP = parseInt(process.argv.find(a => a.startsWith('--top='))?.split('=')[1] ?? '3', 10)
const VECTOR_URL = (process.env.VECTOR_SEARCH_URL ?? 'https://vector-serve-production.up.railway.app').replace(/\/$/, '')

/** Three real case-law questions, and one probe that only a stylesheet can answer. */
const QUESTIONS = [
  'was the prorogation of Parliament in 2019 unlawful',
  'what test applies to judicial review of a decision to prorogue',
  'when can a court order specific performance of a contract for the sale of land',
]
/**
 * ⚠ THE PROBE IS ONE TERM, AND THE FIRST VERSION OF IT WAS USELESS. It was
 * "font-family Times New Roman", which BM25 treats as four independent terms — so after the
 * refresh it still returned ten case-law hits, every one of them matching on *Roman*: "Roman
 * Abramovich v HarperCollins", "Westminster Roman Catholic Diocese", "Court of Alesd, Romania".
 * A probe that a clean index still answers is not a probe. `font-family` is a single hyphenated
 * token no judgment contains, and the check below is not the hit count anyway — it is how many
 * returned BODIES actually contain the string.
 */
const STYLESHEET_PROBE = 'font-family'

const CASELAW_CORPORA = ['tna-caselaw']

function quote(s: string | null | undefined, n = 240): string {
  if (!s) return '(no body)'
  return s.replace(/\s+/g, ' ').slice(0, n)
}

;(async () => {
  console.log(`\n${'#'.repeat(100)}\nRETRIEVAL CHECK ${LABEL ? `— ${LABEL}` : ''}\n${'#'.repeat(100)}`)

  // ── KEYWORD ────────────────────────────────────────────────────────────────────────────────
  console.log(`\n=== KEYWORD (BM25 over ${FTS_TABLE}, via the production rankedSearch) ===`)
  const db = await connectLance()
  const tbl = await db.openTable(FTS_TABLE)

  for (const q of QUESTIONS) {
    console.log(`\n  QUERY: "${q}"`)
    /**
     * ⚠ THIS TIMING IS NOT A PRODUCTION LATENCY AND MUST NOT BE QUOTED AS ONE. Run from a
     * workstation, every query pulls Lance index fragments across the public internet from R2:
     * the first cold query measured 247,570 ms here, the third 18,586 ms, on an index the
     * deployed service answers from in single-digit seconds. It is printed because the SHAPE is
     * informative (cold vs warm) and because a change of an order of magnitude after the refresh
     * would mean something. The production latency question is the un-indexed tail, and the
     * number that answers it is `numUnindexedRows`, reported by refresh-fts-caselaw.ts.
     */
    const t = Date.now()
    const hits = await rankedSearch(tbl, q, { corpora: CASELAW_CORPORA, limit: TOP })
    console.log(`    ${Date.now() - t} ms  (workstation, R2-bound — NOT a production latency)`)
    if (!hits.length) { console.log('    (no hits)'); continue }
    hits.forEach((h: any, i: number) => {
      const body = (h.body ?? h.snippet ?? '') as string
      const css = styleChars(body)
      console.log(`    ${i + 1}. ${h.sectionTitle ?? '(untitled)'}   [${h.id}]`)
      console.log(`       snippet a user is shown: "${quote(body)}"`)
      console.log(`       stylesheet characters in that body: ${css}${css > 0 ? '   <- STILL SERVING CSS' : ''}`)
    })
  }

  console.log(`\n  STYLESHEET PROBE: "${STYLESHEET_PROBE}" — a phrase no judgment contains`)
  const probe = await rankedSearch(tbl, STYLESHEET_PROBE, { corpora: CASELAW_CORPORA, limit: 10 })
  const reallyContain = probe.filter((h: any) => String(h.body ?? '').includes('font-family'))
  const withCss = probe.filter((h: any) => styleChars(String(h.body ?? '')) > 0)
  console.log(`    case-law hits returned: ${probe.length}`)
  console.log(`    ...whose stored body actually contains "font-family": ${reallyContain.length}` +
    `${reallyContain.length === 0 ? '   <- the index no longer holds the stylesheet' : '   <- STILL THERE'}`)
  console.log(`    ...whose stored body contains any CSS run at all:     ${withCss.length}`)
  probe.slice(0, 3).forEach((h: any, i: number) => console.log(`      ${i + 1}. ${h.sectionTitle ?? '(untitled)'} [${h.id}] "${quote(h.body, 110)}"`))

  // ── MEANING ────────────────────────────────────────────────────────────────────────────────
  console.log(`\n=== MEANING-BASED (deployed vector service at ${VECTOR_URL}) ===`)
  for (const q of QUESTIONS) {
    console.log(`\n  QUERY: "${q}"`)
    try {
      const res = await fetch(`${VECTOR_URL}/vector-search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: q, limit: 10, noCache: true }),
      })
      if (!res.ok) { console.log(`    service HTTP ${res.status}`); continue }
      const j = await res.json() as { results?: Array<Record<string, unknown>> }
      const all = j.results ?? []
      const caselaw = all.filter(r => String(r.id ?? '').startsWith('tna-caselaw:'))
      console.log(`    ${all.length} results, ${caselaw.length} of them case law`)
      caselaw.slice(0, TOP).forEach((r, i) => {
        const body = String(r.snippet ?? r.body ?? r.text ?? '')
        console.log(`    ${i + 1}. [${r.id}]  score ${r.score ?? '?'}  snippet ${body.length} chars`)
        if (body) {
          const css = styleChars(body)
          console.log(`       "${quote(body)}"`)
          console.log(`       stylesheet characters: ${css}${css > 0 ? '   <- STILL SERVING CSS' : ''}`)
        } else {
          // ⚠ Not always empty: the SAME id returns a 300-character snippet at limit=3 and an
          // empty one at limit=10. That is the vector service's snippet hydration, not this
          // sprint's text — named in the report rather than smoothed over.
          console.log(`       (service returned no snippet for this hit)`)
        }
      })
    } catch (e) {
      console.log(`    service unreachable: ${(e as Error).message}`)
    }
  }
  console.log('')
})().catch(e => { console.error(e); process.exit(1) })
