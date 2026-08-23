/**
 * check-dot-guard.ts — the test that must fail before the fix (playbook §21.4).
 *
 * Fixtures are REAL bodies read out of R2 during the C2 Lane 2 measurement, not invented ones.
 * Run it against the guard as shipped: cases 5–7 FAIL. Run it after the fix: all pass.
 */
import { isRepealedPlaceholder } from '../shared/compile'

const CASES: Array<{ body: string; hollow: boolean; why: string }> = [
  // ── says nothing: the census already catches these
  { body: '2A . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .', hollow: true,
    why: 'bare number + dots (primary-acts-2000plus:ukpga/2008/4:schedule-19-paragraph-2A)' },
  { body: '15 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .', hollow: true,
    why: 'bare number + dots (primary-acts-pre-2000:ukpga/Eliz2/8-9/55)' },
  // ── says something: must never be called hollow
  { body: '88 Where in consequence of the proposed construction of any of the authorised development,', hollow: false,
    why: 'ordinary prose (si-2010plus:uksi/2024/943)' },
  { body: '4 1 . . . a traffic regulation order shall not be made with respect to any road', hollow: false,
    why: 'PARTIALLY repealed — a dot run AND live law (primary-acts-pre-2000:ukpga/1984/27:section-3)' },
  // ── says nothing, but a leading structural label defeats the shipped guard
  { body: 'Article 31 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .', hollow: true,
    why: '⚠ retained-eu:eur/2006/952:article-31 — "Article" is a word of 2+ letters' },
  { body: 'Article 32 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .', hollow: true,
    why: '⚠ retained-eu:eudn/2007/643:annex-article-32' },
  { body: 'Article 1 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .', hollow: true,
    why: '⚠ retained-eu:eudn/2009/582:article-1' },
]

let pass = 0, fail = 0
for (const [i, c] of CASES.entries()) {
  const got = isRepealedPlaceholder(c.body)
  const ok = got === c.hollow
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  case ${i + 1}  expected hollow=${c.hollow}, got ${got}`)
  console.log(`      ${c.why}`)
  if (!ok) console.log(`      body: "${c.body.slice(0, 78)}"`)
}
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
