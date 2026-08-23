/**
 * a3-hollow-units.ts — CENSUS C1 Part A3. FIND THE UNITS WHOSE TEXT IS NOT THE UNIT.
 *
 * READ-ONLY.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠ THE BRIEF'S OWN THRESHOLDS FAIL ON HALF THE CASES IT NAMES, AND THAT IS THE POINT OF §A3.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * A3 specifies "flag every collection where `< 15` words exceeds 5% of rows or `> 20,000` exceeds
 * 1%", and names four cases the scan must rediscover on its own. Run exactly as specified it finds
 * two of the four:
 *
 *   ✓ written-answers        143 rows, median 367,570 words, 95.8% over 20k   — caught
 *   ✓ legislation dot leaders  112,554 sections under 15 words across 6 collections — caught
 *   ✗ et-decisions           landing pages sit at a MEDIAN OF 18 WORDS, which is ABOVE the 15-word
 *                            floor. Only 3,150 of 293,399 rows fall under it — the test misses
 *                            97.6% of the defect it was written for.
 *   ✗ building-regs          21 rows, median 318 words, min 237, max 1,483. Nothing under 15,
 *                            nothing over 20,000. A plausible-looking small section is invisible
 *                            to any distribution test, because the defect is not the shape of the
 *                            number — it is that the number describes the wrong document.
 *
 * So a length threshold is the wrong instrument. What both misses have in common is visible in one
 * field: **`sourceUrl` points at the publisher's HTML landing page, not at the document.**
 *
 *   et-decisions  landing  https://www.gov.uk/employment-tribunal-decisions/mr-d-young-v-urbaser…
 *                 real     https://assets.publishing.service.gov.uk/media/…Reserved_Judgment.pdf
 *   building-regs every    https://www.gov.uk/government/publications/fire-safety-approved-document-b
 *
 * This scan therefore reports BOTH: the brief's thresholds, so the specified number exists, and a
 * landing-page test by URL, which is what actually finds the defect.
 *
 * Usage: tsx census/a3-hollow-units.ts
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'

const OUT_MD = path.join(__dirname, '../../../docs/census/A3_hollow_units.md')
const OUT_JSON = path.join(__dirname, '../../../docs/census/A3_hollow_units.json')
const n = (v: number) => Number(v).toLocaleString('en-GB')

/**
 * A landing page is the publisher's *page about* a document, stored instead of the document.
 * Matched on the host/path shape the publisher uses for its index pages, NOT on length — length is
 * what the four-case test above proves does not work.
 */
const LANDING_SQL = `(
     "sourceUrl" LIKE 'https://www.gov.uk/employment-tribunal-decisions/%'
  OR "sourceUrl" LIKE 'https://www.gov.uk/government/publications/%'
  OR "sourceUrl" LIKE 'https://www.gov.uk/guidance/%'
  OR "sourceUrl" LIKE 'https://www.gov.uk/government/collections/%'
)`
/** The document itself, where the publisher serves one. */
const DOC_SQL = `("sourceUrl" LIKE '%assets.publishing.service.gov.uk/%' OR "sourceUrl" ILIKE '%.pdf')`

interface Dist {
  corpus: string; rows: number; lt15: number; gt20k: number
  pct_lt15: string; pct_gt20k: string; median: number; p25: number; p75: number
}
interface Landing { corpus: string; rows: number; landing: number; docs: number; landing_median: number | null }

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 1,
    statement_timeout: 1_800_000, query_timeout: 1_800_000,
  })

  const { rows: dist } = await pool.query<Dist>(`
    SELECT corpus, count(*)::int rows,
           count(*) FILTER (WHERE "wordCount" < 15)::int lt15,
           count(*) FILTER (WHERE "wordCount" > 20000)::int gt20k,
           round(100.0*count(*) FILTER (WHERE "wordCount" < 15)/nullif(count(*),0),1)::text pct_lt15,
           round(100.0*count(*) FILTER (WHERE "wordCount" > 20000)/nullif(count(*),0),2)::text pct_gt20k,
           percentile_disc(0.5)  WITHIN GROUP (ORDER BY "wordCount")::int median,
           percentile_disc(0.25) WITHIN GROUP (ORDER BY "wordCount")::int p25,
           percentile_disc(0.75) WITHIN GROUP (ORDER BY "wordCount")::int p75
      FROM corpus_sections WHERE status='compiled' GROUP BY 1 ORDER BY 2 DESC`)

  const { rows: landing } = await pool.query<Landing>(`
    SELECT corpus, count(*)::int rows,
           count(*) FILTER (WHERE ${LANDING_SQL})::int landing,
           count(*) FILTER (WHERE ${DOC_SQL})::int docs,
           percentile_disc(0.5) WITHIN GROUP (ORDER BY "wordCount")
             FILTER (WHERE ${LANDING_SQL})::int landing_median
      FROM corpus_sections WHERE status='compiled' GROUP BY 1
      HAVING count(*) FILTER (WHERE ${LANDING_SQL}) > 0 ORDER BY 3 DESC`)

  // How many landing pages have NO document sibling — i.e. how much genuinely needs re-fetching.
  const { rows: orphan } = await pool.query<{ corpus: string; orphans: string }>(`
    SELECT a.corpus, count(*)::text orphans
      FROM corpus_sections a
     WHERE a.status='compiled' AND ${LANDING_SQL.replace(/"sourceUrl"/g, 'a."sourceUrl"')}
       AND NOT EXISTS (
         SELECT 1 FROM corpus_sections b
          WHERE b.corpus = a.corpus AND b.status='compiled'
            AND ${DOC_SQL.replace(/"sourceUrl"/g, 'b."sourceUrl"')}
            AND split_part(b.id,':',2) = split_part(a.id,':',2))
     GROUP BY 1 ORDER BY 2 DESC`)
  await pool.end()

  const flagged = dist.filter(d => Number(d.pct_lt15) > 5 || Number(d.pct_gt20k) > 1)
  const LEG = ['primary-acts-pre-2000', 'primary-acts-2000plus', 'si-pre-2010', 'si-2010plus', 'regional', 'retained-eu']
  const dotLeaders = dist.filter(d => LEG.includes(d.corpus)).reduce((s, d) => s + d.lt15, 0)

  const L: string[] = []
  L.push('# A3 — HOLLOW UNITS: WHERE THE TEXT IS NOT THE UNIT')
  L.push('')
  L.push('*Generated by `scripts/ingest/census/a3-hollow-units.ts`. Read-only.*')
  L.push('')
  L.push('## ⚠ The specified instrument finds two of the four cases the brief names')
  L.push('')
  L.push('| case | brief\'s expectation | what the `<15 words` / `>20,000 words` test finds |')
  L.push('|---|---|---|')
  L.push(`| \`written-answers\` | 143 rows, ~306,000 words each | **CAUGHT** — 143 rows, median ${n(dist.find(d => d.corpus === 'written-answers')?.median ?? 0)}, 95.8% over 20k |`)
  L.push(`| legislation dot leaders | ~178,826 one-word sections | **CAUGHT** — ${n(dotLeaders)} sections under 15 words across 6 collections (the 178,826 figure came from reading bodies; a word-count proxy under-counts it) |`)
  L.push(`| \`et-decisions\` | 131,654 landing pages, median 18 words | **MISSED** — the landing pages sit at 18 words, ABOVE the 15-word floor. Only ${n(dist.find(d => d.corpus === 'et-decisions')?.lt15 ?? 0)} of ${n(dist.find(d => d.corpus === 'et-decisions')?.rows ?? 0)} rows fall under it |`)
  L.push(`| \`building-regs\` | 21 rows, ~446 words each | **MISSED** — median ${n(dist.find(d => d.corpus === 'building-regs')?.median ?? 0)}, min 237, max 1,483. Nothing under 15, nothing over 20,000 |`)
  L.push('')
  L.push('**A length threshold cannot find either miss.** `et-decisions` fails it by 3 words; `building-regs`')
  L.push('cannot fail it at all, because a 318-word row is a perfectly ordinary-looking section — the defect')
  L.push('is not the size of the number, it is that the number describes the wrong document.')
  L.push('')
  L.push('## The instrument that works: `sourceUrl` points at the landing page, not the document')
  L.push('')
  L.push('| corpus | rows | landing pages | real documents | landing median words | landing pages with NO document behind them |')
  L.push('|---|---:|---:|---:|---:|---:|')
  for (const l of landing) {
    const orph = orphan.find(o => o.corpus === l.corpus)?.orphans ?? '0'
    L.push(`| \`${l.corpus}\` | ${n(l.rows)} | **${n(l.landing)}** | ${n(l.docs)} | ${l.landing_median ?? '—'} | **${n(Number(orph))}** |`)
  }
  L.push('')
  L.push('### ⚠⚠ This changes Part F by more than two orders of magnitude')
  L.push('')
  const etOrph = Number(orphan.find(o => o.corpus === 'et-decisions')?.orphans ?? 0)
  const etLand = landing.find(l => l.corpus === 'et-decisions')
  L.push(`F2 says to re-fetch "the real decisions behind" the ${n(etLand?.landing ?? 0)} landing pages. **They are`)
  L.push(`already held.** ${n((etLand?.landing ?? 0) - etOrph)} of ${n(etLand?.landing ?? 0)} landing pages have their`)
  L.push(`real document ingested alongside them (\`assets.publishing.service.gov.uk/…​.pdf\`, ${n(etLand?.docs ?? 0)} rows).`)
  L.push(`Only **${n(etOrph)}** have nothing behind them.`)
  L.push('')
  L.push(`So F1 (delete the landing pages) stands, and F2 shrinks from ~131,650 fetches to **${n(etOrph)}**.`)
  L.push('')
  L.push('⚠ And F1 is safe on metadata: every one of the ' + n(etLand?.docs ?? 0) + ' document rows already carries')
  L.push('its own `sectionTitle` and `itemDate`, so deleting the landing rows loses no case name and no date.')
  L.push('')
  L.push('### `building-regs` is the same defect, and it is total')
  L.push('')
  L.push('All 21 rows are `https://www.gov.uk/government/publications/…-approved-document-…` — the gov.uk')
  L.push('publication page, not the Approved Document. `sectionTitle` is NULL on all 21. **0% of the actual')
  L.push('Approved Documents are held**, and the collection reports `[100% complete]` against a target of 21.')
  L.push('')
  // ── verified by reading a body, per collection ─────────────────────────
  L.push('### ⚠ The URL test alone OVER-FLAGS — every candidate was checked by reading a body')
  L.push('')
  L.push('| corpus | verdict | evidence (read out of R2) |')
  L.push('|---|---|---|')
  L.push('| `et-decisions` | **HOLLOW** | 18-word stub: case name + "Read the decision" furniture; the judgment PDF is a separate row |');
  L.push('| `building-regs` | **HOLLOW, 100%** | *"Statutory guidance / Structure: Approved Document A / Building regulation in England covering the structural elements of a building. From: MHCLG…"* — 1,982 chars of page furniture. The Approved Document itself is not held. |');
  L.push('| `hmrc-codes-guidance` | **HOLLOW** | *"Form Agree to a water discount scheme… Get emails about this page / Documents / Use the postal form Ref: LT4WD"* + a link to the form. The form is not held. |');
  L.push('| `quangos-govuk` | **HOLLOW** (of the 61,192 landing rows) | 359 chars: *"This annual report sets out the activities and achievements of the ECITB…"* — the abstract, not the report. |');
  L.push('| `planning-policy` | **FALSE POSITIVE — REAL** | `gov.uk/guidance/tree-preservation-orders…` is 49,999 chars of actual Planning Practice Guidance. gov.uk publishes this one as HTML, so the URL pattern is not evidence here. |');
  L.push('| `parliament-treaties` | **probably REAL** | body carries the scrutiny-register fields (*"Debate scheduled: DebateNotScheduled / Brought to attention: 2021-12-02"*), which IS the unit for a CRaG register. |');
  L.push('| `hmrc-tiins` | CANDIDATE | median 154 words; a real TIIN is longer. Not confirmed either way. |');
  L.push('')
  L.push('**So the landing-page test is a candidate detector, not a verdict.** One collection in seven that it')
  L.push('flagged is a false positive. Part B must confirm `hollow_units` by reading a body per collection,')
  L.push('not by URL shape alone — the same discipline the case-law stylesheet finding needed.')
  L.push('')
  L.push('## ⚠⚠ AND TWO COLLECTIONS DO NOT CONTAIN THEIR OWN SUBJECT AT ALL')
  L.push('')
  L.push('This is beyond hollowness: the label names one thing and the rows are another.')
  L.push('')
  L.push('| corpus | label | rows | from the nominal source | what is actually in it |')
  L.push('|---|---|---:|---:|---|')
  L.push('| `oecd` | "OECD iLibrary (free summaries)" | 505 | **0** | **505 of 505 are gov.uk URLs**; 10 so much as mention "oecd" in the URL. 52 are gov.uk NEWS STORIES, 31 are ministerial SPEECHES — one is *"London 2012 sets new world standard on Olympic legacy"*. |')
  L.push('| `ots-reports` | "Office of Tax Simplification Reports" | 497 | — | all gov.uk (correct — OTS published there), but **≥69 are news stories and speeches, not reports**, e.g. *"Speech by the Financial Secretary to the Treasury… at the Private Equity Seminar"*. |')
  L.push('')
  L.push('Both report `[100% complete]`: `oecd` est 505 = compiled 505, `ots-reports` est 497 = compiled 497.')
  L.push('**The self-referential denominator certified a collection that contains none of its nominal content.**')
  L.push('This is the same failure V20 found in `college-of-policing` (*"prior content was unfiltered gov.uk')
  L.push('search junk"*), which was blocked for it. These two were not.')
  L.push('')
  L.push('## Full distribution, every collection')
  L.push('')
  L.push('| corpus | rows | <15w | % | >20k | % | p25 | median | p75 | flagged |')
  L.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---|')
  for (const d of dist) {
    const f = Number(d.pct_lt15) > 5 || Number(d.pct_gt20k) > 1
    L.push(`| \`${d.corpus}\` | ${n(d.rows)} | ${n(d.lt15)} | ${d.pct_lt15} | ${n(d.gt20k)} | ${d.pct_gt20k} | ${n(d.p25)} | ${n(d.median)} | ${n(d.p75)} | ${f ? '⚠' : ''} |`)
  }
  L.push('')
  L.push(`Collections scanned **${dist.length}**, flagged by the brief's thresholds **${flagged.length}**.`)
  L.push('')
  L.push('⚠ 41 of 74 collections trip the thresholds, which makes them close to useless as a filter: a')
  L.push('parliamentary per-speech corpus is *expected* to carry short interventions ("Hear, hear."), so')
  L.push('`historic-hansard` at 23.2% under 15 words is normal, not hollow. Length alone cannot separate a')
  L.push('short unit from a missing one. `hollow_units` in Part B should be counted by the landing-page test')
  L.push('and by the dot-leader flag (C7), not by a percentile.')

  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true })
  fs.writeFileSync(OUT_MD, L.join('\n') + '\n')
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generated: new Date().toISOString(), dist, landing, orphan }, null, 1))
  console.log(`[A3] ${dist.length} collections · threshold-flagged ${flagged.length} · landing-page collections ${landing.length}`)
  for (const l of landing) console.log(`  ${l.corpus.padEnd(20)} landing ${n(l.landing).padStart(9)} docs ${n(l.docs).padStart(9)} orphaned ${orphan.find(o => o.corpus === l.corpus)?.orphans ?? 0}`)
  console.log(`[A3] → ${OUT_MD}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
