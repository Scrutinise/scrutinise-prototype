/**
 * argument-measure.ts — ARGUMENT 1A §4. THE TWO ACCURACY NUMBERS, REPORTED APART.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ WHY TWO NUMBERS AND NEVER ONE. The brief, and the position work before it:
 *
 *   1. **Is the tag right** — does the passage make the move the tag names?
 *   2. **Should this passage have been tagged at all** — or does it make no argument?
 *
 * *"The second is where models and prototypes fail, not the first. The position work established
 * exactly this: direction was wrong on only 2 of 50, but the system claimed a position far too
 * often. Report them apart. An average of the two hides the failure mode."*
 *
 * So this prints them separately, prints the DENOMINATOR of each, and prints the conditional
 * number too — of the passages that should have been tagged, how many got the right tag — because
 * that is a third, different thing and reporting it unlabelled would be the same mistake again.
 *
 * ⚠ POLARITY IS COUNTED AND NOT CHASED. *"Nobody will enforce this"* and *"the enforcement regime
 * is working well"* are near neighbours in meaning-space. The brief is explicit: report the rate,
 * do not try to fix it here. A passage marked `opposite` is a tag that fired on the right SUBJECT
 * and the wrong CLAIM, which for a retrieval filter is a cost of a few tokens downstream.
 *
 * Usage:  npm run argument:measure
 */
import fs from 'node:fs'
import path from 'node:path'
import { TAGS } from './argument/taxonomy'
import { VERDICTS } from './argument/verdicts'

const OUT = path.join(__dirname, '../../docs/census/argument-1a-measure.json')
const MIN = 50

function pct(n: number, d: number) { return d ? `${((100 * n) / d).toFixed(1)}%` : 'n/a' }

async function main() {
  console.log('── ARGUMENT 1A §4 · HAND-READ ACCURACY ──')
  if (VERDICTS.length < MIN) {
    console.error(`⛔ REFUSING: ${VERDICTS.length} verdicts recorded, ${MIN} required by the brief.`)
    console.error('   A number taken over a smaller sample than the one that was asked for is not the')
    console.error('   number that was asked for, and rounding it up in prose is how a measurement lies.')
    process.exit(2)
  }
  const missingNote = VERDICTS.filter((v) => !v.note || !v.note.trim())
  if (missingNote.length) {
    console.error(`⛔ REFUSING: ${missingNote.length} verdicts carry no note. A verdict without a reason`)
    console.error('   cannot be audited, and an unauditable label is what this whole instrument exists to')
    console.error(`   prevent. First: ${missingNote[0].chunkId}`)
    process.exit(2)
  }

  const n = VERDICTS.length
  const shouldTag = VERDICTS.filter((v) => v.shouldBeTagged)
  const tagRight = VERDICTS.filter((v) => v.tagRight)
  const tagRightGivenShould = shouldTag.filter((v) => v.tagRight)
  const polarity = VERDICTS.filter((v) => v.polarity === 'opposite')
  const neutral = VERDICTS.filter((v) => v.polarity === 'neutral')

  console.log(`  ${n} passages read, drawn across ${new Set(VERDICTS.map((v) => v.tag)).size} tags and ${new Set(VERDICTS.map((v) => v.method)).size} methods\n`)
  console.log('  ── THE TWO NUMBERS, APART ──')
  console.log(`    1. IS THE TAG RIGHT                    ${tagRight.length} of ${n}   ${pct(tagRight.length, n)}`)
  console.log(`    2. SHOULD IT HAVE BEEN TAGGED AT ALL   ${shouldTag.length} of ${n}   ${pct(shouldTag.length, n)}`)
  console.log(`  ── and the conditional, which is a THIRD number and is labelled as one ──`)
  console.log(`    of those that should have been tagged, the tag was right on ${tagRightGivenShould.length} of ${shouldTag.length}   ${pct(tagRightGivenShould.length, shouldTag.length)}`)
  console.log(`\n  ── polarity, counted and not chased ──`)
  console.log(`    right subject, OPPOSITE claim          ${polarity.length} of ${n}   ${pct(polarity.length, n)}`)
  console.log(`    right subject, no claim either way     ${neutral.length} of ${n}   ${pct(neutral.length, n)}`)

  console.log('\n  ── per tag, with n stated every time ──')
  console.log('    tag                  n   tag right   should be tagged   opposite polarity')
  const perTag: Record<string, any> = {}
  for (const t of TAGS) {
    const mine = VERDICTS.filter((v) => v.tag === t)
    if (!mine.length) { console.log(`    ${t.padEnd(18)}   0   —           —                  —`); perTag[t] = { n: 0 }; continue }
    const r = mine.filter((v) => v.tagRight).length
    const s = mine.filter((v) => v.shouldBeTagged).length
    const o = mine.filter((v) => v.polarity === 'opposite').length
    perTag[t] = { n: mine.length, tagRight: r, shouldBeTagged: s, opposite: o }
    console.log(`    ${t.padEnd(18)} ${String(mine.length).padStart(3)}   ${`${r}/${mine.length}`.padEnd(11)} ${`${s}/${mine.length}`.padEnd(18)} ${o}/${mine.length}`)
  }

  console.log('\n  ── per method ──')
  const perMethod: Record<string, any> = {}
  for (const m of Array.from(new Set(VERDICTS.map((v) => v.method)))) {
    const mine = VERDICTS.filter((v) => v.method === m)
    const r = mine.filter((v) => v.tagRight).length
    const s = mine.filter((v) => v.shouldBeTagged).length
    perMethod[m] = { n: mine.length, tagRight: r, shouldBeTagged: s }
    console.log(`    ${m.padEnd(16)} n=${String(mine.length).padStart(3)}   tag right ${r}/${mine.length} (${pct(r, mine.length)})   should be tagged ${s}/${mine.length} (${pct(s, mine.length)})`)
  }

  fs.writeFileSync(OUT, JSON.stringify({
    takenAt: new Date().toISOString(), n,
    tagRight: tagRight.length, shouldBeTagged: shouldTag.length,
    tagRightGivenShouldBeTagged: { hit: tagRightGivenShould.length, of: shouldTag.length },
    oppositePolarity: polarity.length, neutral: neutral.length, perTag, perMethod,
  }, null, 2))
  console.log(`\n  wrote ${OUT}`)
}
main().catch((e) => { console.error('FAILED', e); process.exit(1) })
