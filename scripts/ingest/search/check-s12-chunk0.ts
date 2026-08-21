/**
 * check-s12-chunk0.ts — IS CHUNK 0 THE JUDGMENT, OR IS IT STILL THE STYLESHEET? SEARCH S12 §2.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS REPLACES. `INGEST_CASELAW_TEXT_REPORT.md` §3 measured, over 300 documents:
 * **12.7% of everything ever embedded for case law was stylesheet**, and **chunk 0 was more than
 * half stylesheet in 231 of 300 (77%)**. Those numbers are what justified the ~$31 re-embed. This
 * is the same measurement taken again afterwards.
 *
 * ⚠⚠ §2 ASKS FOR 30 DOCUMENTS READ BY HAND, AND THIS DOES THAT — BUT NOT ONLY THAT (§6). A
 * 30-document sample is exactly the shape of check that has failed this project three sprints
 * running: it looks at a slice and cannot see what sits outside it. So the CSS detection runs over
 * **every chunk-0 row in the collection**, and the 30 hand-read extracts are printed *in addition*,
 * for the thing a detector cannot do — confirm the text reads like a judgment rather than merely
 * lacking braces.
 *
 * The printed summary states the population both numbers came from, so a reader cannot mistake the
 * sample for the result or vice versa.
 *
 * ── WHAT COUNTS AS STYLESHEET ───────────────────────────────────────────────────────────────────
 * ⚠ The ingest sprint's first probe was `"font-family Times New Roman"`, which BM25 treats as four
 * terms and which matched judgments mentioning *Roman*. The detection here is over the raw chunk
 * text, not a search, and looks for the constructs a CSS block cannot avoid — a declaration block,
 * a property/value pair, an @-rule — rather than for words that happen to appear in CSS.
 *
 * Usage:  npx tsx search/check-s12-chunk0.ts [--corpus=tna-caselaw] [--sample 30]
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance } from './lance'
import { CHUNKS_TABLE } from './vector-common'

const ARGS = process.argv.slice(2)
const arg = (k: string) => ARGS.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=')
const CORPUS = arg('corpus') ?? 'tna-caselaw'
const SAMPLE = (() => { const i = ARGS.indexOf('--sample'); return i >= 0 ? parseInt(ARGS[i + 1], 10) : 30 })()

const n = (v: number) => v.toLocaleString('en-GB')
const esc = (s: string) => s.replace(/'/g, "''")

/** A CSS declaration block, a property:value pair, or an @-rule. Structure, not vocabulary. */
const CSS_BLOCK = /\{[^{}]*:[^{}]*;[^{}]*\}/
const CSS_PROP = /(?:font-family|font-size|margin-(?:top|bottom|left|right)|text-align|line-height|padding-(?:top|bottom|left|right))\s*:/gi
const CSS_AT = /@(?:page|media|font-face)\b/i

/** How much of this text is inside CSS declaration blocks? */
function cssShare(text: string): number {
  if (!text) return 0
  let inBlocks = 0
  const re = /\{[^{}]*\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) inBlocks += m[0].length
  return inBlocks / text.length
}

function looksStylesheet(text: string): boolean {
  const props = (text.match(CSS_PROP) ?? []).length
  return CSS_BLOCK.test(text) && (props >= 2 || CSS_AT.test(text))
}

async function main() {
  const db = await connectLance()
  const tbl = await db.openTable(CHUNKS_TABLE)

  console.log('═'.repeat(104))
  console.log(`S12 §2 — chunk 0 of '${CORPUS}': judgment text, or stylesheet?`)
  console.log('═'.repeat(104))

  // ── whole population: every chunk-0 row in the collection ───────────────────────────────────
  const zeros: Array<{ sectionId: string; body: string }> = []
  for await (const b of tbl.query().where(`corpus = '${esc(CORPUS)}'`).select(['chunkId', 'sectionId', 'body']) as any) {
    const id = b.getChild('chunkId'), sid = b.getChild('sectionId'), body = b.getChild('body')
    for (let i = 0; i < b.numRows; i++) {
      const cid = String(id.get(i))
      if (!cid.endsWith('#0')) continue
      zeros.push({ sectionId: String(sid.get(i)), body: String(body.get(i) ?? '') })
    }
  }

  let stylesheet = 0, majorityCss = 0
  let cssCharsTotal = 0, charsTotal = 0
  for (const z of zeros) {
    const share = cssShare(z.body)
    cssCharsTotal += share * z.body.length
    charsTotal += z.body.length
    if (looksStylesheet(z.body)) stylesheet++
    if (share > 0.5) majorityCss++
  }

  console.log(`\n── WHOLE POPULATION (every chunk 0 in the collection — no sampling) ──`)
  console.log(`  documents with a chunk 0:            ${n(zeros.length)}`)
  console.log(`  chunk 0 that IS a stylesheet:        ${n(stylesheet)}  (${(stylesheet / zeros.length * 100).toFixed(2)}%)   ← was 77% before the re-embed`)
  console.log(`  chunk 0 more than half CSS by chars: ${n(majorityCss)}  (${(majorityCss / zeros.length * 100).toFixed(2)}%)`)
  console.log(`  CSS share of all chunk-0 characters: ${(cssCharsTotal / charsTotal * 100).toFixed(2)}%`)

  // ── the 30 §2 asks to be read by hand ───────────────────────────────────────────────────────
  // Deterministic pick so the same 30 can be re-read later, and spread across the collection
  // rather than taken from one end of the id space.
  const step = Math.max(1, Math.floor(zeros.length / SAMPLE))
  const picked = Array.from({ length: Math.min(SAMPLE, zeros.length) }, (_, i) => zeros[i * step])
  console.log(`\n── ${picked.length} DOCUMENTS TO READ BY HAND (every ${n(step)}th, deterministic) ──`)
  let handClean = 0
  for (const [i, z] of picked.entries()) {
    const flat = z.body.replace(/\s+/g, ' ').trim()
    const bad = looksStylesheet(z.body)
    if (!bad) handClean++
    console.log(`\n  ${String(i + 1).padStart(2)}. ${bad ? '❌ STYLESHEET' : '✅'} ${z.sectionId}`)
    console.log(`      “${flat.slice(0, 200)}…”`)
  }

  console.log('\n' + '─'.repeat(104))
  console.log(`  hand-read sample: ${handClean}/${picked.length} clean   ·   whole population: ${n(zeros.length - stylesheet)}/${n(zeros.length)} clean`)
  console.log(`  ⚠ the sample is ${picked.length} documents; the population figure is the result. Both are printed so neither can be mistaken for the other.`)
  console.log('─'.repeat(104))
  process.exit(stylesheet === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
