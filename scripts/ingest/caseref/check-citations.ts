/**
 * check-citations.ts — the parser's own check, and it is written to FAIL on the thing that matters.
 *
 * §1.1: "The pre-2001 authorities have no neutral citation. A parser written only for the modern
 * form will find nothing and report success — the exact failure shape this project has hit
 * repeatedly. Build for law report citations first and test on the ten cases in
 * docs/pre2001_probe.json before running anything at scale."
 *
 * So the FIRST assertion block is the ten authorities from that file, by their law-report
 * citations. If a change ever makes the parser modern-only, this check goes red on all ten rather
 * than quietly reporting a smaller number.
 *
 * ⚠ NEGATIVE CONTROLS ARE HALF THE FILE. A citation parser that matches too much is worse than one
 * that matches too little: it invents cases. `[1969] 2 p 147`, `[2019] 22`, `(2020) 15 minutes` and
 * a section reference must all be REJECTED, and each is asserted individually.
 *
 * Usage: tsx caseref/check-citations.ts
 */
import fs from 'fs'
import path from 'path'
import { extractCitations as realExtract, nameBefore, normaliseCitation } from './citations'

/**
 * ⚠⚠ `--self-test` RUNS THIS CHECK AGAINST A DELIBERATELY BROKEN PARSER AND REQUIRES IT TO GO RED.
 *
 * The defect it simulates is the one §1.1 names by hand: a parser written only for the modern
 * neutral form. Against real text it finds plenty — every modern judgment is full of `[2019] UKSC
 * 22` — so it LOOKS like it works, reports a large number, and silently returns nothing for every
 * pre-2001 authority, which is the entire population this sprint exists to serve.
 *
 * A check written green and never seen failing is the shape this project has been caught by
 * repeatedly. Running `--self-test` is how this one earns its 46 passes.
 */
const MODERN_ONLY_RX = /\[(1[89]\d{2}|20\d{2})\]\s*(UKSC|UKPC|UKHL|EWCA|EWHC|UKUT|UKFTT|EAT)\s*([A-Z][a-z]{2,6}\s+)?(\d{1,5})(\s*\(([A-Za-z&\s]{2,20})\))?/g
const SELF_TEST = process.argv.includes('--self-test')

function modernOnlyExtract(text: string): ReturnType<typeof realExtract> {
  const out: ReturnType<typeof realExtract> = []
  MODERN_ONLY_RX.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MODERN_ONLY_RX.exec(text)) !== null) {
    out.push({ raw: m[0], normalised: normaliseCitation(m[0]), kind: 'neutral', year: parseInt(m[1], 10), series: m[2], index: m.index })
  }
  return out
}

const extractCitations = SELF_TEST ? modernOnlyExtract : realExtract

let pass = 0, fail = 0
const ok = (cond: boolean, label: string, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`) }
}

/** The ten authorities the brief names, with the citation form they ACTUALLY have. */
const PRE2001 = [
  ['Anisminic Ltd v Foreign Compensation Commission', '[1969] 2 AC 147'],
  ['Pepper (Inspector of Taxes) v Hart', '[1993] AC 593'],
  ['Associated Provincial Picture Houses Ltd v Wednesbury Corporation', '[1948] 1 KB 223'],
  ['Council of Civil Service Unions v Minister for the Civil Service', '[1985] AC 374'],
  ['Caparo Industries plc v Dickman', '[1990] 2 AC 605'],
  ['Donoghue v Stevenson', '[1932] AC 562'],
  ['R v Secretary of State for Transport, ex p Factortame', '[1991] 1 AC 603'],
  ['M v Home Office', '[1994] 1 AC 377'],
  ['R v North and East Devon Health Authority, ex p Coughlan', '[2001] QB 213'],
  ['Ridge v Baldwin', '[1964] AC 40'],
]

function main() {
  console.log('══ 1. THE TEN PRE-2001 AUTHORITIES — none has a neutral citation ══\n')
  for (const [name, cite] of PRE2001) {
    const sentence = `The principle was settled in ${name} ${cite}, and has been applied since.`
    const found = extractCitations(sentence)
    const hit = found.find((c) => c.normalised === normaliseCitation(cite))
    ok(!!hit, `${cite.padEnd(18)} ${name.slice(0, 52)}`,
      hit ? '' : `parsed instead: ${found.map((f) => f.raw).join(' | ') || '(nothing)'}`)
    if (hit) {
      ok(hit.kind === 'law-report', `   …classified law-report, not neutral`, `got ${hit.kind}`)
    }
  }

  console.log('\n══ 2. THE MODERN FORM, which must keep working ══\n')
  for (const cite of ['[2019] UKSC 22', '[2001] EWCA Civ 540', '[2023] EWHC 852 (Ch)', '[2024] UKUT 65 (IAC)', '[2020] UKPC 5', '[2009] UKHL 39']) {
    const found = extractCitations(`Considered in ${cite} at paragraph 14.`)
    const hit = found.find((c) => c.normalised === normaliseCitation(cite))
    ok(!!hit && hit.kind === 'neutral', `${cite.padEnd(22)} → neutral`, hit ? `kind=${hit.kind}` : `parsed: ${found.map((f) => f.raw).join(' | ') || '(nothing)'}`)
  }

  console.log('\n══ 3. THE FORMS THAT ARE EASY TO DROP ══\n')
  const awkward: Array<[string, string]> = [
    ['(1932) SC (HL) 31', 'Scottish, ROUND brackets and a parenthesised court'],
    ['[1990] 2 AC 605', 'volume number between year and series'],
    ['(1979) 68 Cr App R 128', 'round brackets, two-word series, volume'],
    ['[1976] 3 All ER 665', 'multi-word series'],
    ['(1990) 60 P & CR 392', 'series containing an ampersand and spaces'],
    ['[1985] 1 WLR 1242', 'the commonest modern law report'],
    ['[1999] IRLR 234', 'no volume number'],
  ]
  for (const [cite, why] of awkward) {
    const found = extractCitations(`See ${cite} for the point.`)
    const hit = found.find((c) => c.normalised === normaliseCitation(cite))
    ok(!!hit, `${cite.padEnd(24)} ${why}`, hit ? '' : `parsed: ${found.map((f) => f.raw).join(' | ') || '(nothing)'}`)
  }

  console.log('\n══ 4. NEGATIVE CONTROLS — a parser that matches too much INVENTS cases ══\n')
  const rejects: Array<[string, string]> = [
    ['the meeting ran [1969] 2 p 147 minutes', 'lower-case series must not match'],
    ['paragraph [2019] 22 of the report', 'a year and a number is not a citation'],
    ['section 605 of the 1990 Act', 'a section reference is not a citation'],
    ['(2020) 15 minutes later', 'a bare number after a year is not a series'],
    ['[1932] and [1948] were both important years', 'a year alone is not a citation'],
    ['ISBN 978-1-234 [2001] 12345678', 'an over-long page number is not a citation'],
  ]
  for (const [text, why] of rejects) {
    const found = extractCitations(text)
    ok(found.length === 0, `rejects: "${text.slice(0, 44)}"  — ${why}`, found.length ? `WRONGLY parsed: ${found.map((f) => f.raw).join(' | ')}` : '')
  }

  console.log('\n══ 5. NAMES ARE VARIANTS, AND AN UNREADABLE ONE IS NULL ══\n')
  const nameCases: Array<[string, string | null]> = [
    ['as held in Donoghue v Stevenson [1932] AC 562', 'Donoghue v Stevenson'],
    ['in Caparo Industries plc v Dickman [1990] 2 AC 605', 'Caparo Industries plc v Dickman'],
    ['see [1932] AC 562', null],
    ['the tribunal awarded costs [1999] IRLR 234', null],
  ]
  for (const [text, expect] of nameCases) {
    const cites = extractCitations(text)
    const got = cites.length ? nameBefore(text, cites[0].index) : null
    ok(expect === null ? got === null : (got ?? '').includes(expect.split(' v ')[0]),
      `name before "${cites[0]?.raw ?? '?'}" → ${expect === null ? 'null (nothing readable)' : expect}`,
      `got ${JSON.stringify(got)}`)
  }

  console.log('\n══ 5b. `Re X` — A CASE NAME WITH NO "v" IN IT ══\n')
  // Found by reading the extraction output: nine of the ten most-cited citations with NO recorded
  // name were family cases reported as `In re <initial>`. A `X v Y` pattern can never match one.
  const reCases: Array<[string, string]> = [
    ['the Supreme Court decision in the case of Re B [2013] UKSC 33', 'Re B'],
    ['As Lord Nicholls said in Re H [1996] AC 563', 'Re H'],
    ['in In re E (Children) (abduction: custody appeal) [2011] UKSC 27', 'In re E'],
    ['and naturally Re S (FC) [2005] 1 AC 593', 'Re S'],
  ]
  for (const [text, expect] of reCases) {
    const c = extractCitations(text)[0]
    const got = c ? nameBefore(text, c.index) : null
    ok((got ?? '').startsWith(expect), `${expect.padEnd(8)} recognised in "${text.slice(0, 44)}…"`, `got ${JSON.stringify(got)}`)
  }

  console.log('\n══ 6. TWO CASES THAT SHARE A NAME MUST NOT SHARE AN IDENTITY ══\n')
  // The exact confusion the platform already makes: "Caparo" the 1990 authority, and a modern
  // employment case involving a company called Caparo.
  const a = extractCitations('Caparo Industries plc v Dickman [1990] 2 AC 605')
  const b = extractCitations('Mr A v Caparo Precision Tubes Ltd [2017] UKET 1234567')
  // ⚠ Optional-chained on purpose: under --self-test the broken parser returns NOTHING here, and a
  //   check that CRASHES instead of failing has told you nothing about which assertion was wrong.
  ok(!!a[0] && a[0].normalised !== (b[0]?.normalised ?? ''), 'the 1990 authority and a modern Caparo case get different identities',
    `${a[0]?.normalised ?? '(nothing parsed)'} vs ${b[0]?.normalised ?? '(nothing parsed)'}`)
  ok(a[0]?.normalised === '[1990] 2 AC 605', 'identity is the citation, not the name', a[0]?.normalised ?? '(nothing parsed)')

  console.log('\n══ 7. REAL BYTES — the ten probes, read from docs/pre2001_probe.json ══\n')
  const probePath = path.join(__dirname, '../../../docs/pre2001_probe.json')
  const probes = JSON.parse(fs.readFileSync(probePath, 'utf8')).results.map((r: any) => r.probe)
  let parsed = 0
  for (const p of probes) {
    const found = extractCitations(`${p.authority} ${p.citation}`)
    if (found.some((c) => c.normalised === normaliseCitation(p.citation))) parsed++
  }
  ok(parsed === probes.length, `${parsed}/${probes.length} of the file's own citations parse`, `${probes.length - parsed} did not`)

  console.log(`\n${pass} passed · ${fail} failed`)

  if (SELF_TEST) {
    // The broken parser must be CAUGHT. If it is not, the check cannot see the defect it exists for.
    console.log('\n══ --self-test: the check was just run against a MODERN-ONLY parser ══')
    if (fail === 0) {
      console.log('  ⛔⛔ THE CHECK PASSED A PARSER THAT FINDS NO PRE-2001 CITATION AT ALL.')
      console.log('     It cannot see the defect it exists for. Do not trust its green run.')
      process.exit(1)
    }
    console.log(`  ✓ ${fail} assertions failed, as they must — including all ten pre-2001 authorities.`)
    console.log('  ✓ The check can fail. Its green run against the real parser means something.')
    process.exit(0)
  }

  if (fail) { console.log('\n⛔ Do not run the extractor at scale until this is green.'); process.exit(1) }
}
main()
