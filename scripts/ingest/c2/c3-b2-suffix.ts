/** Is `isRepealedPlaceholder` defeated by a section number carrying a two-letter suffix? */
import fs from 'fs'; import path from 'path'; import { OUT } from './db'
import { isRepealedPlaceholder } from '../shared/compile'
const d = JSON.parse(fs.readFileSync(path.join(OUT,'C3_b3_partial_census.json'),'utf8'))
// A body is WHOLE-BODY hollow if, after removing one leading token of digits+letters, nothing but dots remains.
const LEADING_REF = /^(?:(?:article|regulation|section|paragraph|schedule|rule|part|chapter|annex|title)\s+)?[0-9]+[A-Za-z]{0,4}\b/i
function trulyHollow(t: string): boolean {
  const b = t.trim().replace(LEADING_REF, '')
  return b.length > 0 && /[.·]/.test(b) && !/[A-Za-z]{2}/.test(b)
}
let missed = 0
console.log('rows the PARTIAL detector claimed, which are actually WHOLE-BODY dot leaders:\n')
for (const e of d.examples) {
  if (trulyHollow(e.body) && !isRepealedPlaceholder(e.body)) {
    missed++
    console.log(`  ${e.id}`)
    console.log(`     "${String(e.body).replace(/\s+/g,' ').slice(0,90)}"`)
  }
}
console.log(`\n${missed} of ${d.examples.length} stored examples (${(100*missed/d.examples.length).toFixed(1)}%)`)
// prove the mechanism on synthetic minimal pairs
console.log('\n── the mechanism, on minimal pairs')
for (const b of ['12 . . . .', '12A . . . .', '12ZA . . . .', '5AB . . . .', 'Article 31 . . . .', 'section 4A . . . .']) {
  console.log(`   isRepealedPlaceholder("${b}") = ${isRepealedPlaceholder(b)}`)
}
export {}
