/**
 * check-25h-parser.ts — the provision parser must FIRE on running prose and
 * REFUSE on commencement tables. Both halves are asserted, because a parser
 * that never fires passes a positives-only test and a parser that always fires
 * passes a negatives-only one.
 *
 * Every NEGATIVE here is a real string from the corpus that the FIRST version
 * of `parseProvisionRef` got wrong — they are regression cases, not inventions.
 *
 *   npx tsx graph/check-25h-parser.ts
 */
import { parseProvisionRef, sourceTypeFor, ACT_NAME_RX, resolveActName, normTitle } from './extract-citation-edges'

type Case = { before: string; expect: string | null; why: string }

const CASES: Case[] = [
  // ── POSITIVE: running prose, the shape the corpus is full of ──────────────
  { before: '1 In section 40 of the Local Government Finance Act ', expect: 'section-40', why: 'the plain "section N of the X Act" form' },
  { before: '“local government worker” has the meaning given by section 37 of the Public Service Pensions Act ', expect: 'section-37', why: 'definition clause' },
  { before: 'a combined authority established under section 103 of the Local Democracy, Economic Development and Construction Act ', expect: 'section-103', why: 'long act name between connector and citation' },
  { before: 'a person authorised under an intervention order under section 53 of the Adults with Incapacity (Scotland) Act ', expect: 'section-53', why: 'parenthesised jurisdiction in the act name' },
  { before: 'by virtue of section 149(3) of, and paragraph 10 of Schedule 5 to, the Social Security Administration (Northern Ireland) Act ', expect: 'schedule-5-paragraph-10', why: 'the LAST connector wins, and schedule+paragraph compose' },
  { before: 'for the purposes of Part 1 of the Constitutional Reform and Governance Act ', expect: 'part-1', why: 'Part references — the pilot depends on this one' },
  { before: 'nothing in paragraph 4 of Schedule 1 to the Equality Act ', expect: 'schedule-1-paragraph-4', why: 'schedule paragraph composes to the corpus ref scheme' },
  { before: 'subject to regulation 42 of the Quarries Regulations 1999 (', expect: 'regulation-42', why: 'SI name ending in a year and an open bracket' },
  { before: 'as applied by section 9(1) of the Levelling-up and Regeneration Act ', expect: 'section-9-1', why: 'subsection normalises to the corpus ref form' },
  { before: 'an electronic communications network to which Part 10 of Schedule 3A to the Communications Act ', expect: 'schedule-3a-part-10', why: 'a Schedule qualifies whatever is named inside it, not only paragraphs' },
  // ⚠ the text detector feeds the REAL act name, so the anchor must land on the
  // SECOND clause's Act — this case parsed as section-4-2 until it did.
  { before: 'if no order was made under section 4(2) of this Act or under section 41(2) of the Criminal Appeal (Northern Ireland) Act 1980', expect: 'section-41-2', why: 'two provisions in one sentence — the one adjacent to THIS Act wins' },
  // ⚠ a SCHEDULE contains paragraphs, Parts and Chapters — never sections. The
  // parser emitted schedule-12-section-310, a provision that exists nowhere,
  // until the inner kind was restricted.
  { before: 'sections 296 to 299 and Schedule 12 to the Energy Act ', expect: 'schedule-12', why: 'a schedule with a section named earlier is the SCHEDULE, not a fabricated composite' },
  { before: 'Schedule 12 to that Act and section 310 of the Energy Act ', expect: 'section-310', why: 'schedule first, section adjacent — the adjacent one wins and does not compose' },
  { before: 'The coming into force of paragraph 10 of Schedule 8 to the Elections Act ', expect: 'schedule-8-paragraph-10', why: 'paragraph DOES compose with its schedule' },
  // A LIST of provisions yields its first member. The reference is genuinely to
  // three paragraphs and the column holds one, so the full phrase stays in
  // citation_text and a reader can see what was narrowed.
  { before: 'the amendments made by paragraphs 7, 8 and 10 of Schedule 8 to the Elections Act ', expect: 'schedule-8-paragraph-7', why: 'a list narrows to its first member — citation_text keeps the rest' },

  // ── NEGATIVE: every one of these was a WRONG row in the first pilot ───────
  { before: 'No. 267 (C. 13)Arts. 4 to 121st August 1990 or 1990 ', expect: null, why: 'SI commencement table cell — no act-name token before the citation' },
  { before: 'No. 63 (C. 4)Arts. 28 to 3229th March 1993 1993 ', expect: null, why: 'commencement table, a date immediately before the citation' },
  { before: 'Article 2(1) the definition of “the Housing Benefit Regulations”, Articles 19 and 20 and Schedules 6 to 9The Social Security (Young Persons) (Amendment) Regulations ', expect: null, why: 'a revocation SCHEDULE listing instruments — no connector runs to this name' },
  { before: '5 are integrated in TARIC by subheadings with a footnote reference in the following terms ', expect: null, why: 'no provision reference at all' },
  { before: 'the Secretary of State may by order made by statutory instrument ', expect: null, why: 'an act-name-ish word with no provision before it' },
  { before: 'Section 14 (in so far as it relates to paragraph 3 of Schedule 2)27th January 2003 2003 ', expect: null, why: 'table row: the provision belongs to the PREVIOUS cell\'s instrument' },
]

const TYPE_CASES: Array<[string, string]> = [
  ['ukpga/2010/25', 'primary'], ['asp/2000/4', 'primary'], ['aep/Hen3/20/1', 'primary'],
  ['uksi/2016/765', 'SI'], ['nisr/1994/47', 'SI'], ['ssi/2015/446', 'SI'],
  ['eur/2016/679', 'other'], ['eudn/1999/468', 'other'],
]

/**
 * Act NAMES the text detector must capture WHOLE. Every one of these was
 * truncated at a lowercase connective by the first version, and every one
 * resolved to nothing as a result — including the sprint's own pilot target.
 */
const NAME_CASES: Array<{ text: string; want: string; why: string }> = [
  { text: 'for the purposes of Chapter 1 of Part 1 of the Constitutional Reform and Governance Act 2010 (c. 25)', want: 'Constitutional Reform and Governance Act 2010', why: 'the pilot target — "and" broke the run' },
  { text: 'within the meaning of the Police and Criminal Evidence Act 1984', want: 'Police and Criminal Evidence Act 1984', why: '"and" mid-title' },
  { text: 'under the Town and Country Planning Act 1990', want: 'Town and Country Planning Act 1990', why: 'reported as unresolved "country planning act 1990"' },
  { text: 'as defined in the Financial Services and Markets Act 2000', want: 'Financial Services and Markets Act 2000', why: 'reported as unresolved "markets act 2000"' },
  { text: 'imposed by the Health and Safety at Work etc. Act 1974', want: 'Health and Safety at Work etc. Act 1974', why: 'two connectives and an "etc."' },
  { text: 'made under the Children (Scotland) Act 1995', want: 'Children (Scotland) Act 1995', why: 'the parenthesised-jurisdiction truncation' },
  { text: 'the Equality Act 2010 applies', want: 'Equality Act 2010', why: 'a plain two-word title still works' },
]

let pass = 0, fail = 0

console.log('── act-name capture (the text detector) ──')
for (const c of NAME_CASES) {
  ACT_NAME_RX.lastIndex = 0
  const spans = [...c.text.matchAll(ACT_NAME_RX)].map(m => m[0].trim())
  // the captured span may carry extra leading words; what matters is that the
  // wanted title is a SUFFIX of something captured, because that is exactly
  // what resolveActName walks.
  const ok = spans.some(s => s.endsWith(c.want))
  if (ok) pass++; else fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  "${c.want}"  — ${c.why}`)
  if (!ok) console.log(`        captured instead: ${JSON.stringify(spans)}`)
}
// and the resolver must trim the extras back to the real title
{
  const titles = new Map([[normTitle('Constitutional Reform and Governance Act 2010'), 'ukpga/2010/25']])
  ACT_NAME_RX.lastIndex = 0
  const span = [...'of Part 1 of the Constitutional Reform and Governance Act 2010'.matchAll(ACT_NAME_RX)][0]?.[0] ?? ''
  const hit = resolveActName(span, titles)
  const ok = hit?.gid === 'ukpga/2010/25'
  if (ok) pass++; else fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  resolveActName trims leading words back to the title — got ${JSON.stringify(hit)}`)
}

console.log('\n── provision parser ──')
for (const c of CASES) {
  const got = parseProvisionRef(c.before)
  const ok = got === c.expect
  if (ok) pass++; else fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  expect=${String(c.expect).padEnd(26)} got=${String(got).padEnd(26)} — ${c.why}`)
  if (!ok) console.log(`        input: …${c.before.slice(-110)}`)
}
console.log('── source_type ──')
for (const [gid, want] of TYPE_CASES) {
  const got = sourceTypeFor(gid)
  const ok = got === want
  if (ok) pass++; else fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${gid} → ${got} (want ${want})`)
}
const positives = CASES.filter(c => c.expect !== null).length
const fired = CASES.filter(c => c.expect !== null && parseProvisionRef(c.before) !== null).length
console.log(`\n${pass} passed, ${fail} failed  ·  the parser FIRED on ${fired}/${positives} positives and REFUSED ${CASES.filter(c => c.expect === null && parseProvisionRef(c.before) === null).length}/${CASES.length - positives} negatives`)
if (fired === 0) { console.error('⚠ the parser fired on NOTHING — a test suite of negatives alone would still have passed'); process.exit(1) }
process.exit(fail === 0 ? 0 : 1)
