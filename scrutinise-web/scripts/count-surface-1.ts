/**
 * count-surface-1.ts — BRIEF_SURFACE_1 §4's counts: how many results in a NORMAL search carry a
 * repeal record, and how many carry the instrument.
 *
 * Run through the real gateway on realistic user questions, because the corpus-wide rate (11.44%)
 * is not the rate a searcher meets — search is relevance-ordered, and relevance is not independent
 * of age.
 */
import { searchLegislationViaGateway } from '../lib/lex/gateway-legacy'
export {}
const QUERIES = [
  'sewage discharge water company penalties',
  'no-fault eviction section 21',
  'data protection subject access request',
  'employment tribunal unfair dismissal compensation',
  'planning permission change of use',
  'business rates relief small business',
  'HMO licensing standards',
  'freedom of information exemption commercial interests',
]
async function main() {
  let total = 0; let recorded = 0; let withInst = 0; let missing = 0
  console.log('\n════ §4 COUNTS — a repeal record in a NORMAL search ════')
  console.log('  query                                              results  repealed  of those, instrument named')
  for (const q of QUERIES) {
    const gw = await searchLegislationViaGateway({ q, limit: 12, intent: 'LEGISLATION_SEARCH' })
    const rec = gw.results.filter((r) => r.repeal && r.repeal.state !== 'no-record')
    const inst = rec.filter((r) => r.repeal!.state === 'repealed-known')
    const noStatus = gw.results.filter((r) => !r.repeal).length
    total += gw.results.length; recorded += rec.length; withInst += inst.length; missing += noStatus
    console.log(`  ${q.slice(0, 48).padEnd(48)} ${String(gw.results.length).padStart(7)} ${String(rec.length).padStart(9)} ${String(inst.length).padStart(27)}`)
  }
  const pct = (a: number, b: number) => `${(100 * a / Math.max(1, b)).toFixed(1)}%`
  console.log(`\n  TOTAL                                            ${String(total).padStart(7)} ${String(recorded).padStart(9)} ${String(withInst).padStart(27)}`)
  console.log(`\n  results carrying a repeal record : ${recorded}/${total} = ${pct(recorded, total)}`)
  console.log(`  of those, the instrument is named: ${withInst}/${recorded || 1} = ${pct(withInst, recorded)}`)
  console.log(`  ⚠ results carrying NO status at all: ${missing} (a lookup failure would show here)`)
  console.log(`\n  Corpus-wide the rate is 11.44% (V36 census). A searcher's rate differs because search`)
  console.log(`  is relevance-ordered and relevance is not independent of age.`)
}
main().catch((e) => { console.error(e); process.exit(1) })
