/**
 * argument-label-sheet.ts — ARGUMENT 1A §1. PRINT THE DRAW AS A READING LIST.
 *
 * The labelling itself is a person reading passages and deciding. This turns the candidate JSON
 * into the thing they read: one passage per entry, with the metadata needed to judge it and
 * nothing that would prejudge it — ⚠ the PROBE that retrieved a candidate is printed LAST and the
 * tag is printed as "proposed", because a label written under a heading that already names the
 * answer is not a label.
 *
 * Usage:
 *   npm run argument:label-sheet -- --tag ENFORCEMENT [--arm dense] [--limit 40]
 *   npm run argument:label-sheet -- --controls
 */
import fs from 'node:fs'
import path from 'node:path'

const IN = path.join(__dirname, '../../docs/census/argument-1a-candidates.json')
const argv = process.argv
const val = (k: string, d: string | null = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d }
const TAG = val('tag')
const ARM = val('arm')
const LIMIT = parseInt(val('limit', '999')!, 10)
const CONTROLS = argv.includes('--controls')

const j = JSON.parse(fs.readFileSync(IN, 'utf8'))
const rows: any[] = CONTROLS ? j.controls : j.candidates
const filtered = rows
  .filter((r) => (CONTROLS ? true : (!TAG || r.tag === TAG)))
  .filter((r) => !ARM || r.arm === ARM)
  .slice(0, LIMIT)

console.log(`# ${CONTROLS ? 'RANDOM CONTROL PASSAGES' : `CANDIDATES${TAG ? ` — proposed ${TAG}` : ''}`}  (${filtered.length} of ${rows.length})`)
console.log(`# drawn ${j.takenAt}`)
console.log('')
filtered.forEach((r, i) => {
  console.log(`[${i + 1}] ${r.corpus} ${r.decade}${r.speaker ? ` · ${r.speaker}` : ''}${r.words ? ` · ${r.words}w` : ''}${r.score != null ? ` · score ${Number(r.score).toFixed(3)}` : ''}`)
  console.log(`    ${r.chunkId}`)
  console.log(`    ${r.text}`)
  console.log(`    ← ${r.arm}${CONTROLS ? '' : `, proposed ${r.tag}`}${r.confirmedBy ? `, regex ${r.confirmedBy}` : ''}`)
  console.log('')
})
