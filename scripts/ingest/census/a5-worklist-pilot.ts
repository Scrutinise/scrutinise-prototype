/**
 * a5-worklist-pilot.ts — CENSUS C1 Part A5(c). SIZE PART D BY FETCHING 500, WRITING NOTHING.
 *
 * ⚠ NO DATABASE WRITES AND NO R2 WRITES. Part A is read-only. Output goes to the scratch dir.
 *
 * Calls the PRODUCTION enumerator, `tna-legislation.ts::enumerateSections` — not a copy of it.
 * A pilot that re-implements the fetch measures the pilot's throughput, not the job's, and would
 * miss exactly the behaviour that matters here: V36 found `enumerateSections` had been writing a
 * transient 429/timeout down as the permanent claim "No CLML/HTML/PDF found on TNA" on 8,583
 * instruments, and a random n=40 re-fetch recovered 27.5% of them. `RetryableSourceError` is that
 * fix, and this pilot must exercise it, because 7,924 of the 41,913 worklist entries carry exactly
 * that marker (`reason: classb`) and the whole question is how many are real.
 *
 * SAMPLING: proportional to the worklist's own composition, so instruments/hour generalises. The
 * worklist is 63.7% si-pre-2010, 16.9% retained-eu, 13.8% primary-acts-pre-2000, 3.9% regional,
 * 1.7% si-2010plus, 0.01% primary-acts-2000plus.
 *
 * ⚠⚠ THE FIRST RUN OF THIS PILOT REPORTED 96/96 AND 405/405 RECOVERED, AND BOTH WERE FALSE. It
 * counted "recovered" as `sections.length > 0`, but `enumerateSections` returns a MARKER section
 * for an instrument the source declares has no provisions (`format: 'unavailable'`, with
 * `classifiedAs` set). A marker is the source telling us there is no text — the opposite of a
 * recovery — and counting it made the rate 100% by construction, which is exactly the shape a
 * clean sweep should always be re-checked for. Recovery now requires a section carrying actual
 * content (`clml` / `clml-unparsed` / `html` / `pdf`).
 * ⚠ It also reported `mean words: 0`, because `TnaSection` has no `.text` field. Words are now
 * counted off the CLML with tags stripped.
 *
 * Politeness: TNA 429'd a 200ms sweep in V19; the playbook says halve, so the floor is 500ms.
 *
 * Usage: tsx census/a5-worklist-pilot.ts [--n 500]
 */
process.env.TNA_THROTTLE_FLOOR_MS = process.env.TNA_THROTTLE_FLOOR_MS ?? '500'
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { enumerateSections, RetryableSourceError } from '../sources/tna-legislation'

const N = (() => { const i = process.argv.indexOf('--n'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 500 })()
const WORKLIST = path.join(__dirname, '../v36/worklist.jsonl')
const OUT = path.join(__dirname, '../../../docs/census/A5_worklist_pilot.json')

interface Entry { docId: string; calendarId: string | null; type: string; year: number; corpus: string; reason: string }
const num = (v: number) => Number(v).toLocaleString('en-GB')

async function main() {
  const all: Entry[] = fs.readFileSync(WORKLIST, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  console.log(`[A5] worklist ${num(all.length)} entries`)

  // Proportional stratified sample: take every k-th entry within each corpus so the mix is the
  // worklist's own, not whatever the file happens to start with.
  const byCorpus = new Map<string, Entry[]>()
  for (const e of all) { const a = byCorpus.get(e.corpus) ?? []; a.push(e); byCorpus.set(e.corpus, a) }
  const sample: Entry[] = []
  for (const [corpus, entries] of byCorpus) {
    const want = Math.max(1, Math.round(N * entries.length / all.length))
    const step = Math.max(1, Math.floor(entries.length / want))
    for (let i = 0; i < entries.length && sample.filter(s => s.corpus === corpus).length < want; i += step) sample.push(entries[i])
  }
  console.log(`[A5] sample ${sample.length}:`)
  for (const [c, e] of byCorpus) console.log(`      ${c.padEnd(24)} worklist ${num(e.length).padStart(6)}  sample ${sample.filter(s => s.corpus === c).length}`)

  const t0 = Date.now()
  const results: Array<{ docId: string; corpus: string; reason: string; sections: number; words: number; ms: number; outcome: string }> = []
  let done = 0
  for (const e of sample) {
    const t = Date.now()
    let sections = 0, words = 0, outcome = 'ok'
    try {
      const secs = await enumerateSections(e.docId)
      // A section with real content, as against the marker the source returns for an instrument it
      // declares has no provisions.
      const real = secs.filter(x => x.format !== 'unavailable')
      sections = real.length
      words = real.reduce((s, x) => {
        const body = x.xml ?? x.rawHtml ?? ''
        return s + (body ? body.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length : 0)
      }, 0)
      if (secs.length === 0) outcome = 'no-sections'
      else if (real.length === 0) outcome = 'no-provisions-at-source'
    } catch (err) {
      outcome = err instanceof RetryableSourceError ? 'RETRYABLE' : `error: ${(err as Error).message.slice(0, 60)}`
    }
    results.push({ docId: e.docId, corpus: e.corpus, reason: e.reason, sections, words, ms: Date.now() - t, outcome })
    done++
    if (done % 50 === 0) {
      const rate = done / ((Date.now() - t0) / 60000)
      console.log(`  … ${done}/${sample.length}  ${rate.toFixed(1)} instruments/min`)
    }
  }
  const elapsedMin = (Date.now() - t0) / 60000

  const ok = results.filter(r => r.outcome === 'ok')
  const byOutcome: Record<string, number> = {}
  for (const r of results) byOutcome[r.outcome.startsWith('error:') ? 'error' : r.outcome] = (byOutcome[r.outcome.startsWith('error:') ? 'error' : r.outcome] ?? 0) + 1

  const byCorpusStats: Record<string, { n: number; ok: number; sections: number; words: number }> = {}
  for (const r of results) {
    const b = (byCorpusStats[r.corpus] ??= { n: 0, ok: 0, sections: 0, words: 0 })
    b.n++; if (r.outcome === 'ok') { b.ok++; b.sections += r.sections; b.words += r.words }
  }

  // ⚠ THE NUMBER THIS PILOT EXISTS FOR: how many `classb` markers are real.
  const classb = results.filter(r => r.reason === 'classb')
  const classbRecovered = classb.filter(r => r.outcome === 'ok' && r.sections > 0)   // real content only
  const unseen = results.filter(r => r.reason === 'unseen')
  const unseenRecovered = unseen.filter(r => r.outcome === 'ok' && r.sections > 0)

  const rate = results.length / elapsedMin
  const meanSections = ok.length ? ok.reduce((s, r) => s + r.sections, 0) / ok.length : 0
  const meanWords = ok.length ? ok.reduce((s, r) => s + r.words, 0) / ok.length : 0

  const out = {
    generated: new Date().toISOString(), sampled: results.length, elapsed_min: Number(elapsedMin.toFixed(1)),
    instruments_per_min: Number(rate.toFixed(1)), byOutcome, byCorpusStats,
    classb: { n: classb.length, recovered: classbRecovered.length, rate: classb.length ? Number((classbRecovered.length / classb.length).toFixed(3)) : null },
    unseen: { n: unseen.length, recovered: unseenRecovered.length, rate: unseen.length ? Number((unseenRecovered.length / unseen.length).toFixed(3)) : null },
    mean_sections_per_instrument: Number(meanSections.toFixed(1)),
    mean_words_per_instrument: Number(meanWords.toFixed(0)),
    projection_full_worklist: {
      instruments: 41913,
      hours: Number((41913 / rate / 60).toFixed(1)),
      sections: Math.round(41913 * meanSections * (ok.length / results.length)),
      words: Math.round(41913 * meanWords * (ok.length / results.length)),
    },
    results,
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1))

  console.log('\n=== A5(c) — PILOT ===')
  console.log(`  ${results.length} instruments in ${elapsedMin.toFixed(1)} min = ${rate.toFixed(1)}/min`)
  console.log(`  outcomes: ${JSON.stringify(byOutcome)}`)
  console.log(`  mean sections/instrument (ok only): ${meanSections.toFixed(1)}   mean words: ${num(Math.round(meanWords))}`)
  console.log(`\n  ⚠ THE RECOVERY RATE, which is what decides Part D's real size:`)
  console.log(`     reason=classb  ("No CLML/HTML/PDF found on TNA"): ${classbRecovered.length}/${classb.length} return sections on a plain re-fetch`)
  console.log(`     reason=unseen  (never attempted):                 ${unseenRecovered.length}/${unseen.length}`)
  console.log(`\n  projection for all 41,913: ${out.projection_full_worklist.hours} h · ` +
    `${num(out.projection_full_worklist.sections)} sections · ${num(out.projection_full_worklist.words)} words`)
  console.log(`[A5] → ${OUT}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
