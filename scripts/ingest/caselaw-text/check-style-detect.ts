/**
 * check-style-detect.ts — the measuring instrument, watched getting it wrong.
 *
 * §6: "a check that cannot fail is not a check". The same applies to the thing the checks measure
 * WITH. Every case below states what it expects and why, and the file is only useful because the
 * NEGATIVE cases (prose that contains braces, a judgment quoting a formula) are here alongside the
 * positive ones. A CSS detector that answers "yes" to everything would pass a positive-only file.
 */
import { styleSpans, styleChars, firstStyleOffset } from '../shared/style-detect'

interface Case { name: string; text: string; expectCss: boolean; note: string }

const REAL_TNA_HEAD =
  `EWHC-QBD-Admin 2013 803 [2013] EWHC 803 (Admin) 0.26.0 1e14932c6af436682aeca23173680e2901ad9904 6.0.2 ` +
  `#judgment { font-family: 'Times New Roman'; font-size: 12pt; } #judgment .Normal { font-size: 12pt; } ` +
  `#judgment .Heading1 { font-weight: bold; font-family: Arial; font-size: 16pt; } ` +
  `#judgment .PageNumber { } #judgment .CoverDesc { text-align: center; font-weight: bold; } ` +
  `Judgment Approved by the court for handing down. Haney Jarvis v SSJ Neutral Citation Number: [2013] EWHC 803 (Admin)`

const CASES: Case[] = [
  {
    name: 'the real thing — verbatim head of tna-caselaw:[2013] EWHC 803 (Admin):1',
    text: REAL_TNA_HEAD,
    expectCss: true,
    note: 'read out of R2 during the §1 audit; if this is not detected nothing else matters',
  },
  {
    name: 'empty rule bodies AMONG real ones — the generator emits these by the dozen',
    text: 'x #judgment .A { font-size: 12pt; } #judgment .B { } #judgment .C { } #judgment .D { } end',
    expectCss: true,
    note: 'INGEST-NAMES lost 8 of 30 samples to a version that stopped at the first empty body',
  },
  {
    name: 'NEGATIVE — empty rule bodies ONLY, with no real declaration anywhere in the run',
    text: 'x #judgment .A { } #judgment .B { } #judgment .C { } #judgment .D { } end',
    expectCss: false,
    note: 'THIS CASE USED TO EXPECT CSS AND WAS WRONG. Nothing here says what any style IS; the '
        + 'redaction case below is the real text that proved it, and it cost four judgments.',
  },
  {
    name: 'NEGATIVE — a REDACTED family judgment, verbatim from tna-caselaw:[2025] EWFC 266 (B):1',
    text: '1. This case is about { } ( “W” ), who was born on { } 2025. W is 6 months old. '
        + '2. On 17 February 2025 Nottingham City Council ( “the Local Authority” ) applied for a Care '
        + 'Order and an Interim Care Order. 3. The First Respondent to the applications is { } ( “the '
        + 'Mother” ), who was born on { }. She is { } years old. 4. The Second Respondent is { } ( “the '
        + 'Father” ), who was born on { }. He is { } years old.',
    expectCss: false,
    note: 'anonymisation replaces every name with an empty brace pair. The FIRST version of this '
        + 'detector called this a stylesheet and the guard refused to store four real judgments.',
  },
  {
    name: 'NEGATIVE — a judgment that uses braces in prose',
    text: 'The witness said the document read "{sic}" at that point, and the schedule marked {A} and {B} ' +
          'and {C} as reserved. The court rejected that reading. Nothing here is a declaration.',
    expectCss: false,
    note: 'three braces in a row, none with a prop:value body — must NOT be called a stylesheet',
  },
  {
    name: 'NEGATIVE — prose containing a colon inside braces, but far apart',
    text: 'Paragraph 1 { see below: the annex }.' + ' '.repeat(400) +
          'Paragraph 2 { see above: the annex }.' + ' '.repeat(400) +
          'Paragraph 3 { see also: the annex }.',
    expectCss: false,
    note: 'bodies look like declarations, but 400 chars apart is prose, not a stylesheet run',
  },
  {
    name: 'NEGATIVE — two rules only',
    text: 'a { color: red; } b { color: blue; } and then ordinary judgment text follows here.',
    expectCss: false,
    note: 'MIN_RUN_RULES is 3 — two braces in a contract schedule should not trip the alarm',
  },
  {
    name: 'NEGATIVE — a clean judgment with no braces at all',
    text: 'IN THE HIGH COURT OF JUSTICE. Between Smith and Jones. The appeal is dismissed. '.repeat(40),
    expectCss: false,
    note: 'the shape every re-compiled document should have',
  },
  {
    name: 'CSS in the MIDDLE of a document, not at the head',
    text: 'The judgment begins here and runs for a while. '.repeat(20) +
          '.a { color: red; } .b { color: blue; } .c { font-size: 2pt; } ' +
          'and then the judgment continues.',
    expectCss: true,
    note: 'firstStyleOffset must be well past 0 — the audit distinguishes head from middle',
  },
]

let failures = 0
for (const c of CASES) {
  const spans = styleSpans(c.text)
  const got = spans.length > 0
  const ok = got === c.expectCss
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  expect ${c.expectCss ? 'CSS' : 'no CSS'}, got ${got ? 'CSS' : 'no CSS'}` +
    `  (${spans.length} span(s), ${styleChars(c.text)} chars, first at ${firstStyleOffset(c.text)})`)
  console.log(`      ${c.name}`)
  console.log(`      why: ${c.note}`)
}

// A property the audit's "opens with a stylesheet" column depends on.
const headOffset = firstStyleOffset(REAL_TNA_HEAD)
const midOffset = firstStyleOffset(CASES[CASES.length - 1].text)
const offsetOk = headOffset >= 0 && headOffset < 200 && midOffset > 500
console.log(`\n${offsetOk ? 'PASS' : 'FAIL'}  head-vs-middle discrimination: TNA head at ${headOffset}, mid-document at ${midOffset}`)
if (!offsetOk) failures++

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`)
process.exit(failures === 0 ? 0 : 1)
