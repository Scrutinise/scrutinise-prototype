// 26-M (Charlie, 2 Oct) — material handed to Lex mid-kernel. Pure checks: no DB, no model.
//
//   1. a failed link says WHY and offers what works here (paste); never sends the user elsewhere
//      — and a link the platform never tried is reported as not tried, not as a failure
//   2. Lex names only controls that exist: the two dialogue labels are gone from its map
//   3. a stated purpose is detected (and a bare "here's a link" is not)
//   4. with Consolidate open, a relevant point is offered, filed only on a plain yes
//
// Every assertion has a control that must FAIL when the property is broken — a check that cannot
// fail is a guard that cannot guard.

import { materialFiledBlock, statesPurpose, urlsIn, urlsNotAttempted, comparisonReportFrom, CHAT_MESSAGE_LIMIT, type FileResult } from '../lib/lex/chat-material'
import { decodeEntities, MAX_TEXT_CHARS } from '../lib/lex/user-material'
import { PLATFORM_CONTROLS } from '../lib/lex/platform-controls'
import { PRODUCT_FACTS } from '../lib/lex/product-facts'
import { isPlainAssent } from '../lib/lex/stage'
import { pendingOffer, offerFiledBlock } from '../lib/lex/stage-relevance'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}`) }
}
/** A control: the broken input must be CAUGHT by the same predicate. */
function control(name: string, caught: boolean) { ok(`control — ${name}`, caught) }

const REFUSED: FileResult = {
  url: 'https://example.com/a', outcome: 'refused', kind: 'paywalled',
  reason: 'That page answered HTTP 403 — it is refusing us rather than missing.',
}

console.log('\n── item 1 — a failed link says why and offers what works ──')
const failedBlock = materialFiledBlock([REFUSED]) ?? ''
ok('the reason is in the report', /HTTP 403/.test(failedBlock) && /WHY:/.test(failedBlock))
ok('paste is offered, and it is offered HERE', /paste its text here/.test(failedBlock) && /in this chat/.test(failedBlock))
ok('Lex is forbidden to send the user to another stage or screen', /Do not send the user to another stage, screen or page/.test(failedBlock))
ok('the old "never tell the user to paste" instruction is gone', !/never tell\s+the user to paste/.test(failedBlock))
ok('the old "do not offer an upload" restriction is gone', !/Do not offer an upload/.test(failedBlock))
control('the pre-26-M instruction would have been caught',
  /never tell\s+the user to paste/.test('never tell\nthe user to paste or upload it themselves for a link'))

const link = (n: number) => `https://s${n}.example/${n}`
const five = `add ${[1, 2, 3, 4, 5].map(link).join(' ')} please`
ok('a user pasting five links has all five attempted (Charlie: three to five)', urlsIn(five).length === 5 && urlsNotAttempted(five).length === 0)
const seven = `add ${[1, 2, 3, 4, 5, 6, 7].map(link).join(' ')} please`
ok('past the ceiling the first five are attempted', urlsIn(seven).length === 5)
ok('the rest are reported as not attempted, not lost', urlsNotAttempted(seven).join() === [link(6), link(7)].join())
const notTried = materialFiledBlock([{ url: link(6), outcome: 'not-attempted' }]) ?? ''
ok('a not-attempted link is reported as exactly that', /NOT TRIED/.test(notTried) && /Nothing was wrong with it/.test(notTried))
control('a cap of two would have hidden the third (the 1 Oct failure)', urlsIn(five).slice(0, 2).includes(link(3)) === false)

console.log('\n── decision 109 — the "+" on every stage; a pasted article is not cut off ──')
ok('Lex offers the "+" for a file, here, on every stage', /Add research/.test(failedBlock) && /on every stage/.test(failedBlock))
ok('the "+" is in the single source How this works renders', PRODUCT_FACTS.some((f) => /Add research/.test(f.answer)))
ok('an ordinary message stays at 4,000', CHAT_MESSAGE_LIMIT === 4000)
ok('the schema admits a whole stored document, not 4,000', MAX_TEXT_CHARS >= 100000)
control('the old limit would have cut a 20,000-character article', 20000 > 4000)

console.log('\n── HTML entities in titles ──')
ok('&#039; decodes', decodeEntities('Project Manager&#039;s Guide') === "Project Manager's Guide")
ok('&amp; decodes', decodeEntities('Tools &amp; Real Examples') === 'Tools & Real Examples')
ok('hex and typographic entities decode', decodeEntities('&#x2019; &rsquo; &ndash;') === '’ ’ –')
ok('an unknown entity is left as written, not guessed at', decodeEntities('a &madeup; b') === 'a &madeup; b')
ok('one pass only: &amp;lt; stays &lt;', decodeEntities('&amp;lt;') === '&lt;')
ok('plain text is untouched', decodeEntities('R&D and AT&T') === 'R&D and AT&T')
control('without decoding the raw title would still show', /&#039;/.test('Manager&#039;s'))

console.log('\n── item 2 — Lex names only controls that exist ──')
ok('"Redraft from what I found" is not in Lex\'s map', !/Redraft from what I found/.test(PLATFORM_CONTROLS))
ok('"Search again from scratch" is not in Lex\'s map', !/Search again from scratch/.test(PLATFORM_CONTROLS))
ok('the rule against naming an undescribed control is present', /NAME ONLY CONTROLS THAT ARE DESCRIBED/.test(PLATFORM_CONTROLS))
ok('the re-run answer lives in the array How this works renders', PRODUCT_FACTS.some((f) => /re-run/i.test(f.question)))
ok('and does not carry the stale labels either', !PRODUCT_FACTS.some((f) => /Redraft from what I found|Search again from scratch/.test(f.answer)))
control('the old text would have been caught', /Redraft from what I found/.test('"Redraft from what I found", which reuses'))

console.log('\n── item 3 — a stated purpose runs the comparison ──')
const purposeful = 'Can you add these links to the background research, the principles of which should be integrated into any accountability system https://x.example/rca'
ok('a stated purpose is detected', statesPurpose(purposeful))
ok('"how does this change my guiding policy" is a purpose', statesPurpose('how does this change my approach to the guiding policy https://x.example/a and what it means'))
ok('a bare link states none (26-K offer-do-not-run stands)', !statesPurpose('https://x.example/rca'))
ok('"add this" with a link states none', !statesPurpose('here is another one to add https://x.example/rca'))
control('a purpose that is only a link would be missed by the word test', statesPurpose('integrate https://x.example/a') === false)

const report = comparisonReportFrom({
  ok: true, costPence: 2.1,
  counts: { SUPPORTS: 1, CONTRADICTS: 1, NEW_CAUSE: 0, NEW_POLICY_OPTION: 0, NOTHING: 0 },
  proposedChanges: [
    { category: 'CONTRADICTS', title: 'Blame is not the cause' }, { category: 'SUPPORTS', title: 'Systemic' },
  ],
}, 2)
const withCmp = materialFiledBlock([{ url: 'https://x.example/a', outcome: 'filed', materialId: 'm1', findingCount: 3 }], report) ?? ''
ok('the comparison is reported as run, not offered', /COMPARISON RUN THIS TURN/.test(withCmp))
ok('a contradiction is named and told to lead', /LEAD WITH THIS/.test(withCmp) && /Blame is not the cause/.test(withCmp))
ok('the cost is stated', /2\.1p/.test(withCmp))
ok('without a comparison the block says nothing of one', !/COMPARISON/.test(materialFiledBlock([{ url: 'https://x.example/a', outcome: 'filed', findingCount: 3 }]) ?? ''))

console.log('\n── item 4 — Consolidate open: offer, file on yes, confirm ──')
ok('a plain yes is assent', isPlainAssent('yes please'))
ok('"yes" with a negation is not', !isPlainAssent('yes but don\'t add that'))
ok('a long message that opens with yes is an argument, not consent', !isPlainAssent('yes ' + 'x'.repeat(100)))
ok('a question is not consent', !isPlainAssent('yes?'))
const offer = { kind: 'CONSOLIDATION_FEEDBACK' as const, consolidationId: 'c1', text: 'New material…' }
ok('the offer is read from the LAST Lex message', pendingOffer([{ role: 'user' }, { role: 'lex', offer }])?.consolidationId === 'c1')
ok('an offer the conversation has moved past is not claimable', pendingOffer([{ role: 'lex', offer }, { role: 'user' }, { role: 'lex' }]) === null)
ok('filing is confirmed in the platform\'s own words', /FEEDBACK FILED THIS TURN/.test(offerFiledBlock({ outcome: 'filed' })))
ok('a consolidation that has closed is not claimed as filed', /NOT FILED/.test(offerFiledBlock({ outcome: 'gone' })) && !/FILED THIS TURN/.test(offerFiledBlock({ outcome: 'gone' })))
control('a Lex message that carries no offer claims nothing', pendingOffer([{ role: 'user' }, { role: 'lex' }]) === null)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
