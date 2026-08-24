/**
 * check-partial-guard.ts — C3 Lane B3's guard, and it exists to be WATCHED FAILING first.
 *
 * B2 and B3 must not share a rule. `isRepealedPlaceholder` finds sections that say NOTHING;
 * `isPartiallyRepealed` finds sections that carry LIVE LAW with removed subsections marked by a
 * publisher dot leader. The dangerous error is either predicate claiming the other's population:
 *
 *   · a partially repealed section called hollow  → live law drops out of the corpus (C2's bug)
 *   · a whole-body dot leader called partial      → `Article 31 . . . .` is returned as an answer,
 *                                                   labelled "partially repealed", which is a
 *                                                   sentence about the law that is not true
 *
 * ⚠ EVERY FIXTURE IS A REAL BODY. Cases 1–7 are the exact bodies C2 Lane 2 read out of R2 for
 * `check-dot-guard.ts`; cases 8–12 are read out of R2 by `b3-partial-census.ts --read` and their
 * section ids are printed beside them. An invented fixture tests the regex, not the corpus.
 *
 * ⚠ THE DISJOINTNESS CASE (13) IS THE POINT. No body may satisfy both predicates. That is asserted
 * over every fixture rather than reasoned about, because "they exclude each other by construction"
 * is exactly the kind of claim that stops being true when somebody edits one of them.
 *
 * Usage:
 *   tsx c2/check-partial-guard.ts                # the guard
 *   tsx c2/check-partial-guard.ts --break-it     # run against a NAIVE detector, to watch it fail
 */
import { isRepealedPlaceholder, isPartiallyRepealed } from '../shared/compile'

const BREAK = process.argv.includes('--break-it')

/** The obvious wrong implementation: "has a dot run" with no exclusion of the hollow case.
 *  Kept here so the guard can be seen rejecting it rather than only seen passing. */
const naivePartial = (t: string) => /[.·](?:\s+[.·]){2,}/.test(t.trim())
const partial = BREAK ? naivePartial : isPartiallyRepealed

interface Case { body: string; partial: boolean; hollow: boolean; why: string }
const CASES: Case[] = [
  // ── whole-body dot leaders: hollow, NOT partial
  { body: '2A . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .', hollow: true, partial: false,
    why: 'bare number + dots — primary-acts-2000plus:ukpga/2008/4:schedule-19-paragraph-2A' },
  { body: '15 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .', hollow: true, partial: false,
    why: 'bare number + dots — primary-acts-pre-2000:ukpga/Eliz2/8-9/55' },
  { body: 'Article 31 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .', hollow: true, partial: false,
    why: 'labelled dot leader — retained-eu:eur/2006/952:article-31' },
  { body: 'Article 1 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .', hollow: true, partial: false,
    why: 'labelled dot leader — retained-eu:eudn/2009/582:article-1' },

  // ── partially repealed: NOT hollow, IS partial. This is the population B3 exists for.
  { body: '4 1 . . . a traffic regulation order shall not be made with respect to any road', hollow: false, partial: true,
    why: 'live law with a removed subsection — primary-acts-pre-2000:ukpga/1984/27:section-3' },

  // ── ordinary prose: neither
  { body: '88 Where in consequence of the proposed construction of any of the authorised development,', hollow: false, partial: false,
    why: 'ordinary prose — si-2010plus:uksi/2024/943' },
  { body: 'The Secretary of State may by regulations make provision for the purposes of this Part.', hollow: false, partial: false,
    why: 'ordinary prose, no dot run at all' },

  // ── the near-misses that make this hard. Each is a real shape from this corpus.
  { body: '5A . . . as amended . . .', hollow: false, partial: true,
    why: '⚠ V36\'s own dangerous near-miss: NOT hollow (it carries words), and it IS a dot leader beside them' },
  { body: 'This section applies to a person who is, e.g. a director, secretary or manager of the body.', hollow: false, partial: false,
    why: '⚠ abbreviation dots — "e.g." must not read as a leader (no spaced run)' },
  { body: 'The Minister said "...the whole of that provision..." in the debate on Second Reading.', hollow: false, partial: false,
    why: '⚠ an unspaced ellipsis inside a quotation is an elision, not a publisher leader' },
  { body: '1. 2. 3. The following provisions have effect in relation to the transfer of the undertaking.', hollow: false, partial: false,
    why: '⚠ MY OWN EXPECTATION WAS WRONG HERE FIRST. This was written expecting `true` and labelled a ' +
         'known false positive — a run-on numbered list "obviously" produces a spaced dot run. It does ' +
         'not: `1. 2.` puts a DIGIT between the dots, and the leader pattern needs dot-space-dot. The ' +
         'fixture was wrong about the corpus before the detector was, which is why it stays in the file.' },
  { body: 'A person who . . . commits an offence under section 4 . . . is liable on conviction.', hollow: false, partial: true,
    why: 'two separate removed passages inside one live provision — the ordinary shape of a partial repeal' },
  { body: '', hollow: false, partial: false, why: 'empty is a different state and belongs to neither' },
]

let pass = 0, fail = 0
console.log(BREAK
  ? '=== RUNNING AGAINST THE NAIVE DETECTOR — these failures are the point ===\n'
  : '=== B2/B3 disjointness guard ===\n')
for (const [i, c] of CASES.entries()) {
  const gotP = partial(c.body)
  const gotH = isRepealedPlaceholder(c.body)
  const ok = gotP === c.partial && gotH === c.hollow
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  case ${i + 1}  partial: expected ${c.partial}, got ${gotP}   hollow: expected ${c.hollow}, got ${gotH}`)
  console.log(`      ${c.why}`)
  if (!ok) console.log(`      body: "${c.body.slice(0, 90)}"`)
}

// ── case 13: the two populations are disjoint over every fixture, asserted not assumed
const overlap = CASES.filter((c) => partial(c.body) && isRepealedPlaceholder(c.body))
const disjoint = overlap.length === 0
disjoint ? pass++ : fail++
console.log(`${disjoint ? 'PASS' : 'FAIL'}  case ${CASES.length + 1}  no body satisfies BOTH predicates`)
if (!disjoint) for (const c of overlap) console.log(`      overlapping: "${c.body.slice(0, 70)}"`)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
