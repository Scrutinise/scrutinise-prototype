/** E3 — the coverage line, before and after, on all six walked collections. */
import { instrumentLine, SOURCE_WALK, SOURCE_WALK_DATE } from '../shared/progress-reporter'
console.log(`walk date: ${SOURCE_WALK_DATE}\n`)
for (const k of Object.keys(SOURCE_WALK)) {
  const w = SOURCE_WALK[k]
  const old = `${w.present.toLocaleString()} of ${w.published.toLocaleString()} published = ${((100*w.present)/w.published).toFixed(1)}%` +
    (w.noProvisions > 0 ? ` (${((100*w.present)/(w.published-w.noProvisions)).toFixed(1)}% excl. ${w.noProvisions.toLocaleString()} the source declares have no provisions)` : '')
  console.log(`── ${k}`)
  console.log(`   BEFORE  ${old}`)
  console.log(`   AFTER   ${instrumentLine(k)}\n`)
}
