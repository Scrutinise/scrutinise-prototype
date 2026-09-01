// ─────────────────────────────────────────────────────────────────────────────
// 25-P §3a/§3b — ENUMERATE THE JOIN-BLIND CHECK CLASS.
//
// §3: *"The addendum found a defect that survived two sprints of green checks because the checks
// asserted source strings and the failure was in a lookup. This is a class, not an incident."*
// §3a: find every place a check asserts on a source file, a label or a filter for a feature whose
// data path is never exercised end to end. §3b: **report the list before changing anything.**
//
// ⚠⚠ WHAT MAKES A CHECK JOIN-BLIND IS NOT THAT IT GREPS. Plenty of properties really are about
// source — "this string does not appear in this file", "this component is imported by this
// route" — and a grep is the right instrument for them. A check is join-blind when the property
// it is standing in for is about a VALUE, and the only thing it reads is the code that would
// produce the value. `ReportAdditions` filters on `e.priority`: true, asserted, green, and the
// feature wrote a row and rendered nothing, because the id it looked the row up by was not the
// id the row was stored under.
//
// So this measures one thing per check file: does it ever read a value that came out of the
// system — a database row, an assembled panel, a rendered document — or does it only read code?
// A check that only reads code cannot see a join.
//
// ⚠ IT CHANGES NOTHING. §3b is explicit that the list comes first.
//
// Usage: npm run audit:join-blind
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'scripts')

/** Reading a value the system produced. Any one of these makes a check non-blind. */
const DATA_SIGNALS: Array<[string, RegExp]> = [
  ['db', /\bprisma\.\w+\.(findMany|findFirst|findUnique|count|create|update|aggregate|groupBy)/],
  ['panel', /\bbuildQuestionPanel\(/],
  ['document', /\bbuild(Proposal|Summary|EvidencePack|MeetingPack|InitialBackground)\w*\(/],
  ['state', /\breadPolicyState\(|\bapplyPolicyOp\(|\breadPassLog\(|\bfreshPassLog\(/],
  ['assembler', /\bbuild[A-Z]\w*\(|\bassemble[A-Z]\w*\(|\bcompose[A-Z]\w*\(/],
  ['http', /\bfetch\(/],
]

/** Reading the source of the thing under test rather than its output. */
const SOURCE_SIGNALS: Array<[string, RegExp]> = [
  ['readFileSync', /readFileSync\(/],
  ['code()/read()', /\b(code|read)\(['"`]/],
]

type Row = {
  file: string
  assertions: number
  sourceAssertions: number
  data: string[]
  source: string[]
  controls: number
  /** How this check asserts — see the note in `scan`. */
  style: 'ok()' | 'unrecognised' | 'none'
}

function scan(file: string): Row {
  const src = readFileSync(join(DIR, file), 'utf8')
  const lines = src.split('\n')

  const data = DATA_SIGNALS.filter(([, re]) => re.test(src)).map(([name]) => name)
  const source = SOURCE_SIGNALS.filter(([, re]) => re.test(src)).map(([name]) => name)

  // `ok(` calls are the assertions. A source assertion is one whose own line, or the line
  // before it, reads a file rather than a value.
  let assertions = 0
  let sourceAssertions = 0
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*ok\(/.test(lines[i])) continue
    assertions++
    const window = lines.slice(i, Math.min(i + 6, lines.length)).join('\n')
    if (/\b(code|read|src|source|routeSrc|file)\w*\b\s*[.)]|\.test\(|\.includes\(/.test(window)
      && !DATA_SIGNALS.some(([, re]) => re.test(window))) {
      sourceAssertions++
    }
  }
  const controls = (src.match(/^\s*control\(/gm) ?? []).length

  // ⚠⚠ THE AUDIT'S OWN BLIND SPOT, DECLARED RATHER THAN ROUNDED AWAY. This counts `ok(` calls,
  // and not every check in this repository asserts that way — `check-lex-25m.ts` walks a table
  // of check objects and prints ✓/✗ itself. Reporting those as "0 assertions" would be a
  // measurement of the wrong dimension dressed up as a result, which is the very shape §3 is
  // about. So they are counted as UNRECOGNISED and kept out of the totals, and the report says
  // how many there are.
  const printsResults = /[✓✗]/.test(src)
  const style: Row['style'] = assertions > 0 ? 'ok()' : printsResults ? 'unrecognised' : 'none'
  return { file, assertions, sourceAssertions, data, source, controls, style }
}

function main() {
  const files = readdirSync(DIR).filter((f) => /^check-.*\.ts$/.test(f)).sort()
  const rows = files.map(scan)

  console.log('\n══ 25-P §3a — the join-blind check class ══════════════════════════════════\n')
  console.log('A check that reads only code cannot see a lookup that misses. This lists what')
  console.log('each check actually reads. NOTHING IS CHANGED BY THIS SCRIPT (§3b).\n')

  const counted = rows.filter((r) => r.style === 'ok()')
  const unreadable = rows.filter((r) => r.style === 'unrecognised')
  const blind = counted.filter((r) => !r.data.length)
  const mixed = counted.filter((r) => r.data.length && r.sourceAssertions > 0)
  const clean = counted.filter((r) => r.data.length && r.sourceAssertions === 0)

  const show = (r: Row) =>
    `  ${r.file.padEnd(24)} ${String(r.assertions).padStart(3)} assertions, `
    + `${String(r.controls).padStart(2)} controls  `
    + `reads: ${r.data.length ? r.data.join('+') : 'CODE ONLY'}`

  console.log(`── ${blind.length} checks read NO system output at all ──`)
  console.log('   Every assertion in these is about the code, not about what it produces.\n')
  for (const r of blind) console.log(show(r))

  console.log(`\n── ${mixed.length} checks read output AND assert on source ──`)
  console.log('   Not wrong in itself; the source assertions inside them are the ones to look at.\n')
  for (const r of mixed) console.log(`${show(r)}  (${r.sourceAssertions} source-shaped)`)

  console.log(`\n── ${clean.length} checks assert on output only ──\n`)
  for (const r of clean) console.log(show(r))

  console.log(`\n── ${unreadable.length} checks assert in a style this audit cannot count ──`)
  console.log('   Not counted anywhere below. They are listed so the totals are not read as')
  console.log('   covering the whole suite.\n')
  for (const r of unreadable) {
    console.log(`  ${r.file.padEnd(24)} reads: ${r.data.length ? r.data.join('+') : 'CODE ONLY'}`)
  }

  const totalAssertions = counted.reduce((n, r) => n + r.assertions, 0)
  const blindAssertions = blind.reduce((n, r) => n + r.assertions, 0)
  const mixedSource = mixed.reduce((n, r) => n + r.sourceAssertions, 0)

  console.log('\n══ the size of the class ═════════════════════════════════════════════════\n')
  console.log(`  ${rows.length} check scripts; ${counted.length} of them assert in a countable`)
  console.log(`  style, with ${totalAssertions} assertions between them.`)
  console.log(`  ${blindAssertions} assertions sit in a check that reads no system output.`)
  console.log(`  ${mixedSource} more are source-shaped inside a check that reads some.`)
  console.log(`  ${blindAssertions + mixedSource} of ${totalAssertions} `
    + `(${Math.round(((blindAssertions + mixedSource) / totalAssertions) * 100)}%) `
    + 'cannot see a lookup that misses.\n')
  console.log('  ⚠ This is a shape count, not a defect count. A source assertion whose property')
  console.log('    genuinely is about source is correct. What the number says is how much of the')
  console.log('    suite would stay green through another §A1.\n')
}

main()
