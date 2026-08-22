/**
 * check-goldv2.ts — DOES THE TRANSCRIPTION STILL AGREE WITH THE DOCUMENT CHARLIE SIGNED OFF?
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * `docs/GOLD_CANDIDATES_V2.md` is the source of record — it is what Charlie read and marked up.
 * `scripts/gold/gold-v2-set.ts` is a transcription of it so a harness can score without parsing
 * prose. Two copies of one thing drift; this is what makes them unable to.
 *
 * The S10 precedent is `check-s10-gold.ts`, and it exists because a transcription that quietly
 * disagrees with the validated document produces numbers attributed to questions nobody approved.
 *
 * ── WHAT IT ASSERTS, AND ALL OF IT OVER THE WHOLE SET (§6) ──────────────────────────────────────
 *  1. Every question id in the markdown appears in the TS, and vice versa — no additions, no drops.
 *  2. Every question's TEXT matches the markdown heading, character for character after
 *     normalisation. ⚠ This is the assertion that catches an amendment applied in one file only.
 *  3. Every VERDICT in the markdown is ACCEPT or AMEND (a REJECT must never reach a scoreable set),
 *     and the TS records the same verdict for that question.
 *  4. Every key in the TS was VERIFIED — i.e. it appears in `verify-goldv2-keys.ts`, where it was
 *     read back out of R2 — and every verified key appears in the TS. ⚠ The markdown abbreviates
 *     shared prefixes with an ellipsis, so the prose is NOT a usable key source and is deliberately
 *     not used as one here.
 *  5. The negative controls carry no keys, and are excluded from SCOREABLE_V2.
 *
 * ⚠ NOT A SAMPLE. Every question, every key, both directions. The counts it covered are printed.
 *
 * Usage:  npx tsx scripts/check-goldv2.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { GOLD_V2, SCOREABLE_V2, NEGATIVE_CONTROLS_V2 } from './gold/gold-v2-set'

export {}

const MD = path.join(__dirname, '../../docs/GOLD_CANDIDATES_V2.md')
const VERIFIER = path.join(__dirname, 'verify-goldv2-keys.ts')

/** Markdown headings carry typographic quotes and non-breaking punctuation; the TS carries plain
 *  ASCII where it can. Normalise both sides identically rather than editing either to match. */
const norm = (s: string) => s
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[–—]/g, '—').replace(/\s+/g, ' ').trim().toLowerCase()

let failures = 0
const fail = (m: string) => { failures++; console.log(`  ❌ ${m}`) }
const pass = (m: string) => console.log(`  ✅ ${m}`)

function main() {
  const md = fs.readFileSync(MD, 'utf8')
  const verifier = fs.readFileSync(VERIFIER, 'utf8')

  console.log('═'.repeat(100))
  console.log('GOLD v2 — transcription vs the document Charlie validated')
  console.log('═'.repeat(100))

  // ── parse the markdown ──────────────────────────────────────────────────────────────────────
  const blocks = md.split(/\n### /).slice(1)
  const mdQ = new Map<string, { text: string; verdict: string }>()
  for (const b of blocks) {
    const head = b.split('\n')[0]
    const m = head.match(/^(Q\d+|N\d+)\s*·\s*(.+)$/)
    if (!m) continue
    const v = b.match(/\*\*VERDICT →\*?\*?\s*\**\s*(ACCEPT|AMEND|REJECT)/i)
      ?? b.match(/\*\*VERDICT →\s*(Accept|Amend|Reject)/i)
    mdQ.set(m[1], { text: m[2].trim(), verdict: (v?.[1] ?? 'MISSING').toUpperCase() })
  }

  // 1. same ids both ways
  const tsIds = new Set(GOLD_V2.map((q) => q.id))
  const mdIds = new Set(mdQ.keys())
  for (const id of mdIds) if (!tsIds.has(id)) fail(`${id} is in the markdown and NOT in the transcription`)
  for (const id of tsIds) if (!mdIds.has(id)) fail(`${id} is in the transcription and NOT in the markdown`)
  if (!failures) pass(`same ${mdIds.size} question ids in both`)

  // 2. text matches — the assertion that catches a one-sided amendment
  let textOk = 0
  for (const q of GOLD_V2) {
    const m = mdQ.get(q.id)
    if (!m) continue
    if (norm(m.text) !== norm(q.query)) {
      fail(`${q.id} TEXT DIFFERS\n       markdown: ${m.text}\n       ts      : ${q.query}`)
    } else textOk++
  }
  if (textOk === GOLD_V2.length) pass(`all ${textOk} question texts match the markdown character for character`)

  // 3. verdicts
  let verdictOk = 0
  for (const q of GOLD_V2) {
    const m = mdQ.get(q.id)
    if (!m) continue
    if (m.verdict === 'REJECT') { fail(`${q.id} is REJECTED in the markdown and must not be in a scoreable set`); continue }
    if (m.verdict === 'MISSING') { fail(`${q.id} has no readable VERDICT in the markdown`); continue }
    if (m.verdict !== q.verdict) fail(`${q.id} verdict differs — markdown ${m.verdict}, ts ${q.verdict}`)
    else verdictOk++
  }
  if (verdictOk === GOLD_V2.length) {
    const amends = GOLD_V2.filter((q) => q.verdict === 'AMEND').map((q) => q.id)
    pass(`all ${verdictOk} verdicts agree (${GOLD_V2.length - amends.length} ACCEPT, ${amends.length} AMEND: ${amends.join(', ')}, 0 REJECT)`)
  }

  // 4. every key was verified against R2, both directions
  const verifiedKeys = new Set(
    [...verifier.matchAll(/\{ q: '(Q\d+)', id: '([^']+)'/g)].map((m) => m[2]))
  const tsKeys = new Set(GOLD_V2.flatMap((q) => q.keys))
  let keyOk = 0
  for (const k of tsKeys) {
    if (!verifiedKeys.has(k)) fail(`key NOT in verify-goldv2-keys.ts (so never read back from R2): ${k}`)
    else keyOk++
  }
  for (const k of verifiedKeys) if (!tsKeys.has(k)) fail(`verified key missing from the transcription: ${k}`)
  if (keyOk === tsKeys.size && tsKeys.size === verifiedKeys.size) {
    pass(`all ${keyOk} keys are present in both, and every one was read back out of R2`)
  }

  // 5. negative controls
  const badNc = NEGATIVE_CONTROLS_V2.filter((q) => q.keys.length)
  if (badNc.length) fail(`negative control(s) carry keys: ${badNc.map((q) => q.id).join(', ')}`)
  else pass(`${NEGATIVE_CONTROLS_V2.length} negative controls carry no keys and are excluded from SCOREABLE_V2`)
  if (SCOREABLE_V2.some((q) => q.scoring === 'negative-control')) fail('a negative control leaked into SCOREABLE_V2')

  console.log('\n' + '─'.repeat(100))
  console.log(`  covered: ${GOLD_V2.length} questions · ${tsKeys.size} keys · both directions · no sampling`)
  console.log(`  scoreable: ${SCOREABLE_V2.length}   negative controls: ${NEGATIVE_CONTROLS_V2.length}`)
  console.log(failures === 0 ? '  ✅ ALL CHECKS PASS' : `  ❌ ${failures} FAILURE(S)`)
  console.log('─'.repeat(100))
  process.exit(failures ? 1 : 0)
}

main()
