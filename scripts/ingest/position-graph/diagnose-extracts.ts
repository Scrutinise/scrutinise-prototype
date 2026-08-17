/**
 * diagnose-extracts.ts — why did 25.9% of the pilot's quotations not appear in their own documents?
 *
 * docs/CLAUDE.md §13: do NOT form a hypothesis about a matching failure before inspecting the
 * actual bytes. This script prints the miss, the document around where it should be, and a set of
 * mechanically-computed classifications, so the cause is read off the material rather than guessed.
 *
 * The classifications are deliberately ordered cheapest-explanation-first. Each is a TEST, and the
 * counts are what decide whether the 25.9% is a fabrication rate or a matcher artefact:
 *
 *   beyond-cap      the passage is in the document but past the word cap the model was shown —
 *                   OUR bug: we truncated the input and then searched the untruncated text
 *   stitched        every clause of the passage is present, but not contiguously — the model
 *                   joined separated sentences, which the prompt forbids
 *   near-miss       a long prefix of the passage matches; the tail drifts — a paraphrase at the end
 *   whitespace      matches once internal whitespace is collapsed to nothing (table-derived text)
 *   absent          no substantial fragment of it is in the document at all — a fabrication
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/diagnose-extracts.ts --self-test
 *   npx tsx position-graph/diagnose-extracts.ts --run-id pilot-2d3 [--show 12]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { getDocText, firstWords, normaliseForMatch, findExtract } from './text-2d3'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const str = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }
const num = (n: string, d: number) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? parseInt(argv[i + 1], 10) : d }

const CAP_WORDS = num('max-words', 9000)

export type MissClass = 'beyond-cap' | 'stitched' | 'near-miss' | 'whitespace' | 'absent'

/** Longest prefix of `needle` (in words) that appears in `hay`. Both already normalised. */
export function longestPrefixWords(needle: string, hay: string): number {
  const words = needle.split(' ')
  let lo = 0
  let hi = words.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (hay.includes(words.slice(0, mid).join(' '))) lo = mid; else hi = mid - 1
  }
  return lo
}

/** Are all the sentence-ish clauses present, just not contiguously? */
export function allClausesPresent(needle: string, hay: string): boolean {
  const clauses = needle.split(/(?<=[.;:!?])\s+/).map((c) => c.trim()).filter((c) => c.split(' ').length >= 4)
  if (clauses.length < 2) return false
  return clauses.every((c) => hay.includes(c))
}

export function classifyMiss(extract: string, fullDoc: string, capWords: number): { cls: MissClass; prefixWords: number; totalWords: number } {
  const n = normaliseForMatch(extract)
  const full = normaliseForMatch(fullDoc)
  const shown = normaliseForMatch(firstWords(fullDoc, capWords))
  const totalWords = n.split(' ').length

  // OUR bug first: present in the document, but only past the point the model could have seen.
  if (full.includes(n) && !shown.includes(n)) return { cls: 'beyond-cap', prefixWords: totalWords, totalWords }
  if (allClausesPresent(n, full)) return { cls: 'stitched', prefixWords: totalWords, totalWords }
  if (n.replace(/\s+/g, '') && full.replace(/\s+/g, '').includes(n.replace(/\s+/g, ''))) {
    return { cls: 'whitespace', prefixWords: totalWords, totalWords }
  }
  const prefixWords = longestPrefixWords(n, full)
  if (prefixWords >= 6 && prefixWords / totalWords >= 0.5) return { cls: 'near-miss', prefixWords, totalWords }
  return { cls: 'absent', prefixWords, totalWords }
}

async function main() {
  if (flag('self-test')) { selftest(); return }
  const runId = str('run-id', 'pilot-2d3')
  const show = num('show', 12)
  const pool = getNeonPool()
  try {
    const { rows } = await pool.query<{ id: string; extract: string; section_id: string; r2key: string; words: number }>(`
      SELECT DISTINCT ON (p.section_id, p.extract)
             p.id::text, p.extract, p.section_id, c."r2Key" r2key, c."wordCount" words
      FROM graph_position p JOIN corpus_sections c ON c.id = p.section_id
      WHERE p.run_id LIKE $1 || '%' AND p.extract_found_in_source IS FALSE
      ORDER BY p.section_id, p.extract, p.id`, [runId])
    console.log(`\n════ ${rows.length} DISTINCT MISSES in run_id ${runId}* ════`)

    const cache = new Map<string, string>()
    const counts: Record<MissClass, number> = { 'beyond-cap': 0, stitched: 0, 'near-miss': 0, whitespace: 0, absent: 0 }
    const examples: Record<string, Array<{ extract: string; section: string; prefixWords: number; totalWords: number }>> = {}
    let unreadable = 0

    for (const r of rows) {
      let doc = cache.get(r.r2key)
      if (doc === undefined) { doc = (await getDocText(r.r2key)) ?? ''; cache.set(r.r2key, doc) }
      if (!doc) { unreadable++; continue }
      const { cls, prefixWords, totalWords } = classifyMiss(r.extract, doc, CAP_WORDS)
      counts[cls]++
      ;(examples[cls] ??= []).push({ extract: r.extract, section: r.section_id, prefixWords, totalWords })
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    console.log(`\n  class          count   share   what it means`)
    const meaning: Record<MissClass, string> = {
      'beyond-cap': 'OUR bug — we capped the input and searched the uncapped text',
      stitched: 'model joined separated sentences (the prompt forbids it)',
      'near-miss': 'prefix matches, tail drifts — paraphrase at the end',
      whitespace: 'matches once internal whitespace is ignored',
      absent: 'no substantial fragment present — a fabricated quotation',
    }
    for (const cls of Object.keys(counts) as MissClass[]) {
      console.log(`  ${cls.padEnd(13)} ${String(counts[cls]).padStart(5)}  ${(100 * counts[cls] / Math.max(1, total)).toFixed(1).padStart(5)}%   ${meaning[cls]}`)
    }
    if (unreadable) console.log(`  (${unreadable} documents unreadable from R2 and excluded)`)

    for (const cls of Object.keys(counts) as MissClass[]) {
      const ex = examples[cls]
      if (!ex?.length) continue
      console.log(`\n  ──── ${cls.toUpperCase()} — first ${Math.min(show, ex.length)} of ${ex.length} ────`)
      for (const e of ex.slice(0, show)) {
        console.log(`    ${e.section}  (longest matching prefix ${e.prefixWords}/${e.totalWords} words)`)
        console.log(`      "${e.extract.slice(0, 220)}${e.extract.length > 220 ? '…' : ''}"`)
      }
    }
  } finally { await endNeonPool() }
}

// ── offline self-test — every branch, and each was watched failing first ────────────────────────
function selftest() {
  const long = 'alpha beta gamma. '.repeat(400)   // ~1,200 words of filler
  const doc = `${long}The Committee should require a minimum NHS commitment in every dental contract. `
    + 'Separately, we note that funding has fallen in real terms since 2010.'
  const cases: Array<[string, boolean]> = [
    ['a contiguous quotation is not a miss at all',
      findExtract('require a minimum NHS commitment in every dental contract', doc).found],
    ['beyond-cap is detected and named OUR bug',
      classifyMiss('require a minimum NHS commitment in every dental contract', doc, 100).cls === 'beyond-cap'],
    ['the same passage inside the cap is NOT beyond-cap',
      classifyMiss('require a minimum NHS commitment in every dental contract', doc, 9000).cls !== 'beyond-cap'],
    ['stitched: two real sentences joined',
      classifyMiss('The Committee should require a minimum NHS commitment in every dental contract. funding has fallen in real terms since 2010.', doc, 9000).cls === 'stitched'],
    ['near-miss: prefix matches, tail drifts',
      classifyMiss('require a minimum NHS commitment in every single dentistry agreement nationwide', doc, 9000).cls === 'near-miss'],
    ['absent: nothing of it is there',
      classifyMiss('we call for the immediate abolition of the private rented sector', doc, 9000).cls === 'absent'],
    ['whitespace: matches once spacing is ignored',
      classifyMiss('require a minimum NHScommitment in every dental contract', 'xx require a minimum NHS commitment in every dental contract yy', 9000).cls === 'whitespace'],
    ['longestPrefixWords counts words, not characters',
      longestPrefixWords('require a minimum nhs zzzz qqqq', normaliseForMatch(doc)) === 4],
    ['allClausesPresent needs TWO clauses, not one',
      !allClausesPresent('require a minimum nhs commitment in every dental contract.', normaliseForMatch(doc))],
  ]
  let bad = 0
  for (const [name, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

// ⚠ GUARDED. verify-2d3.ts imports classifySurface/holderOn from here; without this an
// import RAN THE SCRIPT, which ended the shared pool underneath the caller ('Called end on pool
// more than once'). A module that does work on import is a module that cannot be reused.
if (require.main === module) main().catch((e) => { console.error('[diagnose-extracts] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
