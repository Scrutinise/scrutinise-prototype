/**
 * a5b-modern-acts-probe.ts — CENSUS C1 Part A5, the stratum the main pilot could not reach.
 *
 * READ-ONLY.
 *
 * The 500-instrument pilot found 0 of 41 sampled `primary-acts-pre-2000` work-list entries return
 * any text at source. That sample was representative BY ERA (63.4% pre-1830 against the list's
 * 62.8%) — but the list is 98.5% pre-1900, so a 41-draw sample expects 0.6 instruments from 1900
 * onwards and drew none. Those 87 modern Acts are precisely the ones most likely to carry text and
 * to matter to a user, so they are probed exhaustively here rather than left to a proportional
 * sample that structurally cannot see them.
 *
 * This is the difference between "the work list yields nothing" (what the pilot alone would have
 * supported) and "the work list yields nothing EXCEPT the part nobody sampled".
 *
 * Usage: tsx census/a5b-modern-acts-probe.ts
 */
process.env.TNA_THROTTLE_FLOOR_MS = process.env.TNA_THROTTLE_FLOOR_MS ?? '500'
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { enumerateSections } from '../sources/tna-legislation'

const WORKLIST = path.join(__dirname, '../v36/worklist.jsonl')
const OUT = path.join(__dirname, '../../../docs/census/A5b_modern_acts.json')
const n = (v: number) => Number(v).toLocaleString('en-GB')

interface Entry { docId: string; calendarId: string | null; year: number; corpus: string; reason: string }

async function main() {
  const all: Entry[] = fs.readFileSync(WORKLIST, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  const modern = all.filter(e => e.corpus === 'primary-acts-pre-2000' && e.year >= 1900)
  console.log(`[A5b] pre-2000 Acts on the work list dated 1900+: ${modern.length} — probing every one`)

  const results: Array<{ docId: string; year: number; reason: string; sections: number; words: number; outcome: string }> = []
  for (const e of modern) {
    let sections = 0, words = 0, outcome = 'ok'
    try {
      const secs = await enumerateSections(e.docId)
      const real = secs.filter(x => x.format !== 'unavailable')
      sections = real.length
      words = real.reduce((s, x) => {
        const body = x.xml ?? x.rawHtml ?? ''
        return s + (body ? body.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length : 0)
      }, 0)
      if (secs.length === 0) outcome = 'no-sections'
      else if (real.length === 0) outcome = 'no-provisions-at-source'
    } catch (err) { outcome = `error: ${(err as Error).message.slice(0, 60)}` }
    results.push({ docId: e.docId, year: e.year, reason: e.reason, sections, words, outcome })
  }

  const withText = results.filter(r => r.outcome === 'ok')
  const totalSections = withText.reduce((s, r) => s + r.sections, 0)
  const totalWords = withText.reduce((s, r) => s + r.words, 0)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), probed: results.length, withText: withText.length, totalSections, totalWords, results }, null, 1))

  console.log(`\n=== A5b — the 1900+ stratum, probed exhaustively ===`)
  console.log(`  probed ${results.length}, with text ${withText.length} (${(100 * withText.length / results.length).toFixed(0)}%)`)
  console.log(`  sections ${n(totalSections)}   words ${n(totalWords)}`)
  const byOutcome: Record<string, number> = {}
  for (const r of results) byOutcome[r.outcome.startsWith('error') ? 'error' : r.outcome] = (byOutcome[r.outcome.startsWith('error') ? 'error' : r.outcome] ?? 0) + 1
  console.log(`  outcomes: ${JSON.stringify(byOutcome)}`)
  console.log(`\n  the ones that DO carry text:`)
  for (const r of withText.sort((a, b) => b.sections - a.sections).slice(0, 20)) {
    console.log(`    ${r.docId.padEnd(26)} ${String(r.year)}  ${String(r.sections).padStart(4)} sections  ${n(r.words).padStart(9)} words`)
  }
  console.log(`[A5b] → ${OUT}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
