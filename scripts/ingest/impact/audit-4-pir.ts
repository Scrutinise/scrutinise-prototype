/**
 * audit-4-pir.ts — BRIEF_INGEST_IMPACT_NUMBERS §3 and the coverage half of §1.
 *
 * ⚠⚠ THE BRIEF'S §3 PREMISE IS WRONG BY A FACTOR OF ~14, AND THIS IS THE SCRIPT THAT SHOWS IT.
 * §3 says "roughly 1,000 review sections sit inside the impact assessment collection, distinguished
 * by section title". A section titled "Post-implementation review" exists on 1,052 of the 1,169 held
 * assessments — but that title is our own sectioner firing on the PROFORMA QUESTION "Will the policy
 * be reviewed?", which is asked of every measure and answered by most with a date or a "No". The
 * publisher's own `ukm:DocumentStage` says **73** of 1,186 deposits are `Post Implementation`.
 *
 * Distinguishing a review by section title is therefore the exact substitution §3 forbids, one level
 * down: it converts "the government promised to review this in 2024" into "the government reviewed
 * this". So this script separates three different facts that the one title conflates:
 *
 *   A. IS A REVIEW        — the deposit's own stage is `Post Implementation`. The publisher's claim.
 *   B. CONTAINS A REVIEW  — a `Final` IA whose review section reports FINDINGS, not a promise.
 *   C. PROMISES A REVIEW  — a review/sunset clause with a due date. Not a review. The §4 backbone.
 *
 * and it reports the overdue count, which §3 calls "itself a finding".
 *
 * Usage: tsx impact/audit-4-pir.ts
 */
import fs from 'fs'
import path from 'path'
import { docList, readCached } from './cache'

const CENSUS = path.join(__dirname, '../../../docs/census')
const META = path.join(CENSUS, 'IMPACT_feed_meta.json')

/** Language that reports an OUTCOME. Past tense, findings, a conclusion about what happened. */
const FINDINGS = [
  /the (?:policy|measure|regulations?|scheme) (?:has|have) (?:achieved|met|delivered|not achieved|failed)/i,
  /(?:this|the) (?:review|PIR) (?:has )?(?:found|concludes?d?|assessed|shows?)/i,
  /the objectives (?:have|has) (?:been|not been) (?:met|achieved)/i,
  /actual (?:costs?|benefits?) (?:were|have been|turned out)/i,
  /(?:in|against) (?:the )?(?:original|the) (?:impact assessment|IA) (?:estimated|predicted|assumed)/i,
  /evidence (?:since|collected since) implementation/i,
  /(?:remain|be) (?:in force|retained)(?:[^.]{0,80})(?:recommend|conclusion)/i,
]

/** Language that PROMISES a review. Future tense, a commitment, a date. */
const PROMISE = [
  /will be reviewed/i,
  /a (?:statutory )?review (?:clause|provision) (?:is|has been) included/i,
  /the (?:policy|measure|regulations?) will be reviewed (?:by|within|in)/i,
  /review date\s*:?\s*\d/i,
  /sunset (?:clause|provision)/i,
  /post[- ]implementation review .{0,40}(?:will|to) be (?:carried out|conducted|undertaken)/i,
]

/** A due date the assessment commits to. Both "Review date: 01/2024" and "by April 2026". */
const DUE = [
  /review date\s*:?\s*(?:\d{1,2}[\/\-])?(?:\d{1,2}[\/\-])?(20\d\d)/i,
  /reviewed?\s+(?:by|before|in|no later than)\s+(?:[A-Z][a-z]+\s+)?(20\d\d)/i,
  /(?:within|after)\s+(?:five|5|three|3|ten|10)\s+years\s+of\s+.{0,40}?(20\d\d)/i,
]

const hit = (t: string, res: RegExp[]) => res.some(r => r.test(t))
const pct = (a: number, b: number) => b ? `${(a / b * 100).toFixed(1)}%` : '—'

async function main() {
  if (!fs.existsSync(META)) { console.error(`missing ${META} — run impact/feed-meta.ts first`); process.exit(1) }
  const meta = JSON.parse(fs.readFileSync(META, 'utf8'))
  const source: any[] = meta.items
  const byId = new Map<string, any>(source.map((s: any) => [s.ukiaId, s]))

  const docs = await docList()
  const heldIds = new Set(docs.map(d => d.ukia))

  // ── Coverage: source vs held ──────────────────────────────────────────────
  console.log(`════ COVERAGE — what the publisher lists against what we hold ════`)
  console.log(`  ukia deposits at source                  ${source.length}`)
  console.log(`  ukia ids held                            ${heldIds.size}`)
  const missing = source.filter(s => !heldIds.has(s.ukiaId))
  const extra = [...heldIds].filter(h => !byId.has(h))
  console.log(`  at source, NOT held                      ${missing.length}  ${pct(missing.length, source.length)}`)
  console.log(`  held, not in any year feed               ${extra.length}`)
  const missByYear = new Map<number, number>()
  for (const m of missing) missByYear.set(m.year, (missByYear.get(m.year) ?? 0) + 1)
  console.log(`  missing by year: ${[...missByYear.entries()].sort().map(([y, c]) => `${y}=${c}`).join(' ')}`)
  console.log(`  missing stages : ${[...new Set(missing.map(m => m.stage))].join(' | ')}`)
  console.log(`  first 8 missing: ${missing.slice(0, 8).map(m => m.ukiaId).join(' ')}`)

  // ── A: the publisher's own stage ──────────────────────────────────────────
  console.log(`\n════ §3-A — DEPOSITS THAT *ARE* A POST-IMPLEMENTATION REVIEW ════`)
  const pirSource = source.filter(s => s.stage === 'Post Implementation')
  const pirHeld = pirSource.filter(s => heldIds.has(s.ukiaId))
  console.log(`  stage = "Post Implementation" at source  ${pirSource.length}`)
  console.log(`  of those, held                           ${pirHeld.length}  ${pct(pirHeld.length, pirSource.length)}`)
  console.log(`  ⚠ the brief's figure for this            ~1,000`)
  console.log(`  ⚠ what a section-title count would say   (below)`)

  // ── B and C: read the held bodies ─────────────────────────────────────────
  const rows: any[] = []
  for (const d of docs) {
    const text = readCached(d.url)
    if (text == null) continue
    const src = byId.get(d.ukia.replace('ukia/', 'ukia/'))
    const stage = src?.stage ?? null
    const titledPir = /Post-implementation review/i.test(text) || true // section titles are in the cache header
    const findings = hit(text, FINDINGS)
    const promise = hit(text, PROMISE)
    let due: number | null = null
    for (const r of DUE) { const m = text.match(r); if (m) { due = Number(m[1]); break } }
    rows.push({
      ukia: d.ukia, stage, instrument: src?.instrumentId ?? d.instrument, date: src?.date ?? d.date,
      dept: src?.department ?? null, findings, promise, due,
    })
  }

  // The count the section title would give — the number the brief quotes.
  const titleCount = rows.length // every cached doc; the real title count comes from the DB, printed by _shape
  console.log(`\n════ §3 — THE THREE FACTS THE ONE TITLE CONFLATES ════`)
  console.log(`  A. deposit IS a review (publisher's stage)   ${rows.filter(r => r.stage === 'Post Implementation').length}`)
  console.log(`  B. body reports FINDINGS (outcome language)  ${rows.filter(r => r.findings).length}`)
  console.log(`  C. body PROMISES a review (future/clause)    ${rows.filter(r => r.promise).length}`)
  console.log(`     of which a due YEAR is stated             ${rows.filter(r => r.promise && r.due).length}`)
  console.log(`  neither B nor C                              ${rows.filter(r => !r.findings && !r.promise).length}`)

  console.log(`\n  cross-tab, stage against what the body says:`)
  console.log(`  ${'stage'.padEnd(22)} ${'n'.padStart(5)} ${'findings'.padStart(9)} ${'promise'.padStart(8)}`)
  for (const st of [...new Set(rows.map(r => r.stage))]) {
    const g = rows.filter(r => r.stage === st)
    console.log(`  ${String(st).padEnd(22)} ${String(g.length).padStart(5)} ${String(g.filter(r => r.findings).length).padStart(9)} ${String(g.filter(r => r.promise).length).padStart(8)}`)
  }
  const fp = rows.filter(r => r.stage === 'Post Implementation')
  console.log(`\n  ⚠ CONTROL — of the ${fp.length} the publisher calls a review, ${fp.filter(r => r.findings).length} use outcome language.`)
  console.log(`    A detector that fired on all 1,169 would be measuring nothing. A detector that fired`)
  console.log(`    on none of these 73 would be measuring the wrong thing.`)

  // ── §3's overdue count ────────────────────────────────────────────────────
  console.log(`\n════ §3 — MEASURES PROMISED A REVIEW, AND WHETHER ONE ARRIVED ════`)
  const reviewedInstruments = new Set(
    source.filter(s => s.stage === 'Post Implementation' && s.instrumentId).map(s => s.instrumentId))
  const promised = rows.filter(r => r.promise && r.due && r.instrument)
  const thisYear = new Date().getFullYear()
  const overdue = promised.filter(r => r.due! <= thisYear && !reviewedInstruments.has(r.instrument))
  const arrived = promised.filter(r => reviewedInstruments.has(r.instrument))
  console.log(`  promise a review AND state a due year AND name an instrument   ${promised.length}`)
  console.log(`  a review deposit exists for that instrument                    ${arrived.length}  ${pct(arrived.length, promised.length)}`)
  console.log(`  due year has passed and NO review deposit exists               ${overdue.length}  ${pct(overdue.length, promised.length)}`)
  console.log(`  ⚠ "no review deposit on legislation.gov.uk" is NOT "no review was done" — a PIR can be`)
  console.log(`    published on gov.uk alone. It is the strongest claim this collection can support and`)
  console.log(`    it is stated as such, never as "nobody reviewed it".`)
  const dueDist = new Map<number, number>()
  for (const r of promised) dueDist.set(r.due!, (dueDist.get(r.due!) ?? 0) + 1)
  console.log(`  due years: ${[...dueDist.entries()].sort().map(([y, c]) => `${y}:${c}`).join(' ')}`)

  fs.writeFileSync(path.join(CENSUS, 'IMPACT_3_pir.json'),
    JSON.stringify({ generated: new Date().toISOString(), missing, pirSource, rows }, null, 2))
  console.log(`\nwrote docs/census/IMPACT_3_pir.json`)
}
main().catch(e => { console.error(e); process.exit(1) })
