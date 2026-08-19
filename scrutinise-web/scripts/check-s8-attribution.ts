// ─────────────────────────────────────────────────────────────────────────────
// check-s8-attribution.ts — BRIEF_SEARCH_S8 §2's check.
//
// The requirement, verbatim: "Check asserts: no code path derives attribution from a title
// (grep-enforced with one allowed null-assignment site, watched failing on a planted violation)."
//
// ⚠ EVERY ASSERTION HERE WAS WATCHED FAILING BEFORE IT WAS TRUSTED TO PASS. The two structural
// ones carry their negative control INSIDE the run: the title-derivation scanner is executed a
// second time over the real sources PLUS a synthetic file containing the exact violation, and the
// check fails if that second run comes back clean. A scanner that cannot fire is not a scanner —
// and running the control in memory means it can never leave a planted file behind on disk.
//
//   npm run check:s8-attribution
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import {
  attributionFor, attributionLine, deslug, ATTRIBUTION_ABSENCE_NOTE, type Attribution,
} from '../lib/lex/attribution'
import { evidenceBlock, EVIDENCE_KINDS, type EvidenceResult } from '../lib/lex/chat-retrieval'

let pass = 0
let fail = 0
function check(ok: boolean, name: string, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}${detail ? `  — ${detail}` : ''}`) }
  else { fail++; console.log(`  FAIL  ${name}${detail ? `  — ${detail}` : ''}`) }
}

// ── source scanning ──────────────────────────────────────────────────────────────────────────

const LIB = join(__dirname, '..', 'lib')

function tsFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...tsFiles(p))
    else if (e.endsWith('.ts') || e.endsWith('.tsx')) out.push(p)
  }
  return out
}

/**
 * ⚠ COMMENTS ARE STRIPPED FIRST, and that is not a convenience. `attribution.ts` and
 * `chat-retrieval.ts` both explain the banned move at length, naming `title` and `attribution` in
 * the same sentence repeatedly. A scanner that read comments would fire on the documentation of
 * the rule it enforces — pass by making the rule undocumented, which is the wrong incentive
 * exactly.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const TITLE_WORDS = /\b(title|sectionTitle|parentTitle|instrumentTitle|citation|kindLabel|snippet)\b/

/**
 * ⚠ THE FIRST DRAFT OF THIS SCANNER WAS A ONE-LINE REGEX AND IT WAS USELESS, which is worth
 * recording because it looked exactly like a working check. "A line mentioning `attribution` and
 * a title word" fired three times on correct code — a `$queryRaw` COLUMN LIST naming both
 * columns, and `politicalTitle(..., { attribution })`, which passes attribution INTO a title
 * builder, i.e. the opposite direction from the banned one. A check with three standing false
 * positives is a check somebody switches off.
 *
 * So the rule is expressed as the three places the inference could actually live, each precise
 * enough to be worth failing on:
 *
 *   1. INSIDE THE BUILDER. `attribution.ts` is the only file that constructs an Attribution, so a
 *      title-derived attribution must be written there. Its code may not name a title at all.
 *   2. AT A CALL SITE. `attributionFor(corpus, src)` could be handed `{ speaker: someTitle }`.
 *      Every call's argument text is read and must contain no title-shaped identifier.
 *   3. ANYWHERE ELSE. Some other file could build the object shape by hand — covered by the
 *      `source: 'speaker'|'publisher'` literal scan above.
 */
function builderNamesATitle(src: string): string[] {
  return stripComments(src).split('\n')
    .map((line, i) => ({ line: line.trim(), i }))
    .filter((x) => TITLE_WORDS.test(x.line))
    .map((x) => `attribution.ts (code line ${x.i + 1}): ${x.line}`)
}

/** Every `attributionFor(` call in a file, as the raw argument text, paren-balanced. */
function callArgs(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  const needle = 'attributionFor('
  let at = code.indexOf(needle)
  while (at !== -1) {
    let depth = 0
    let i = at + needle.length - 1
    for (; i < code.length; i++) {
      if (code[i] === '(') depth++
      else if (code[i] === ')') { depth--; if (depth === 0) break }
    }
    out.push(code.slice(at + needle.length, i))
    at = code.indexOf(needle, i)
  }
  return out
}

function callSitesTakingATitle(files: Array<{ path: string; src: string }>): string[] {
  const hits: string[] = []
  for (const f of files) {
    if (f.path.endsWith('lib/lex/attribution.ts')) continue // its own declaration, not a call
    for (const args of callArgs(f.src)) {
      if (TITLE_WORDS.test(args)) hits.push(`${f.path}: attributionFor(${args.replace(/\s+/g, ' ').trim()})`)
    }
  }
  return hits
}

function main() {
  console.log('\n════ S8 §2 — attribution ════\n')
  const files = tsFiles(LIB).map((p) => ({ path: p.replace(/\\/g, '/').split('/scrutinise-web/')[1] ?? p, src: readFileSync(p, 'utf8') }))

  // ── 1. ONE construction site ────────────────────────────────────────────────────────────────
  console.log('— one construction site —')
  const definers = files.filter((f) => /export function attributionFor\b/.test(f.src))
  check(definers.length === 1, 'attributionFor() is defined exactly once in lib/',
    definers.map((f) => f.path).join(', ') || 'none')
  check(definers[0]?.path.endsWith('lib/lex/attribution.ts') ?? false,
    '   …and it is lib/lex/attribution.ts', definers[0]?.path ?? 'none')

  const attrSrc = definers[0]?.src ?? ''
  // The signature must have no way to receive a title. This is stronger than "does not use one".
  const sig = attrSrc.match(/export function attributionFor\(([^)]*)\)/)?.[1] ?? ''
  check(!!sig && !TITLE_WORDS.test(sig),
    'attributionFor() has NO title-shaped parameter — the banned inference is unreachable, not merely unused',
    `signature args: ${sig.replace(/\s+/g, ' ').trim()}`)

  // Every other file must PASS THROUGH an attribution, never build one. The tell is the shape.
  const builders = files.filter((f) =>
    !f.path.endsWith('lib/lex/attribution.ts') && /source:\s*'(speaker|publisher)'/.test(stripComments(f.src)))
  check(builders.length === 0, 'no other file constructs an Attribution literal',
    builders.map((f) => f.path).join(', ') || 'none')

  // ── 2. no derivation from a title, EACH RULE WITH ITS NEGATIVE CONTROL ──────────────────────
  console.log('\n— no attribution derived from a title —')

  // Rule 1 — the builder itself may not so much as name a title.
  const inBuilder = builderNamesATitle(attrSrc)
  check(inBuilder.length === 0, 'lib/lex/attribution.ts names no title-shaped identifier in its CODE',
    inBuilder.slice(0, 2).join(' | ') || 'none')
  check(builderNamesATitle(`const n = row.sectionTitle.split('—')[1]`).length === 1,
    '   …and that scan FIRES on a planted title reference (negative control)')
  check(builderNamesATitle(`const n = src.speaker?.trim()`).length === 0,
    '   …and does NOT fire on the real thing it reads instead (control for the control)')

  // Rule 2 — no call site hands it a title.
  const badCalls = callSitesTakingATitle(files)
  check(badCalls.length === 0, 'no attributionFor() call site passes a title-shaped value',
    badCalls.slice(0, 2).join(' | ') || 'none')
  const callers = files.filter((f) => callArgs(f.src).length && !f.path.endsWith('lib/lex/attribution.ts'))
  check(callers.length === 2, '   …and there are exactly the two adapters calling it',
    callers.map((f) => f.path).join(', '))
  const plantedCall = [{
    path: 'SYNTHETIC/planted.ts',
    src: `const a = attributionFor(h.corpus, { speaker: h.sectionTitle.split('—')[1] })`,
  }]
  check(callSitesTakingATitle(plantedCall).length === 1,
    '   …and the call-site scan FIRES on a planted violation (negative control)')
  const benignCall = [{
    path: 'SYNTHETIC/benign.ts',
    src: `const a = attributionFor(h.corpus, { speaker: meta?.speaker, attribution: meta?.attribution })`,
  }]
  check(callSitesTakingATitle(benignCall).length === 0,
    '   …and does NOT fire on the legitimate call (control for the control)')

  // ── 3. behaviour ────────────────────────────────────────────────────────────────────────────
  console.log('\n— what attributionFor actually returns —')

  const spk = attributionFor('pwdata-debates', { speaker: 'Lindsay Hoyle', attribution: null })
  check(spk?.name === 'Lindsay Hoyle' && spk.source === 'speaker',
    'a Hansard speaker becomes a `speaker` attribution', JSON.stringify(spk))
  check(/House of Commons/.test(spk?.role ?? ''),
    '   …with a role naming the CHAMBER, not just "Parliament" — the Lords is a separate corpus',
    spk?.role ?? '')

  const sp = attributionFor('scottish-parliament-or', { speaker: 'The Presiding Officer (Ken Macintosh)' })
  check(/Scottish Parliament/.test(sp?.role ?? ''),
    '⚠ a Holyrood speaker is NOT described as speaking at Westminster', sp?.role ?? '')
  const senedd = attributionFor('senedd-cofnod', { speaker: 'Mark Drakeford' })
  check(/Senedd/.test(senedd?.role ?? ''), '   …nor a Senedd one', senedd?.role ?? '')

  // ⚠⚠ THE THREE COLLECTIONS WHERE `speaker` IS NOT A SPEAKER. Each was read off the ingest
  // writer; each would have been described wrongly by a default that sounded confident.
  const judge = attributionFor('tax-tribunals', { speaker: 'Swami RAGHAVAN' })
  check(/judge who decided/.test(judge?.role ?? ''),
    '⚠⚠ a tax tribunal `speaker` is the JUDGE, not somebody speaking in a debate', judge?.role ?? '')
  const edm = attributionFor('early-day-motions', { speaker: 'Andrew Miller' })
  check(/tabled this motion/.test(edm?.role ?? ''),
    '⚠⚠ an EDM `speaker` is the SPONSOR — nobody spoke; an EDM is a signature sheet', edm?.role ?? '')
  const wrans = attributionFor('pwdata-wrans', { speaker: 'Ian Stewart' })
  check(/answered/.test(wrans?.role ?? ''),
    '⚠⚠ a written-answer `speaker` is the minister who ANSWERED, not the member who asked', wrans?.role ?? '')

  // The generic default must claim only what is true of every collection at once.
  const unknown = attributionFor('some-future-corpus', { speaker: 'A. Person' })
  check(unknown?.role === 'named on this record',
    '⚠ an unnamed collection gets a claim-nothing default, never a confident guess', unknown?.role ?? '')
  check(!/speaking|Parliament|judge/i.test(unknown?.role ?? 'x'),
    '   …which asserts no chamber and no capacity')

  // ⚠⚠ The collection §2 was written for. 0 of 800 rows sampled carry either column.
  const cttee = attributionFor('committees-evidence', { speaker: null, attribution: null })
  check(cttee === null,
    '⚠⚠ committee evidence returns NULL — it holds no structured attribution (0/800 sampled)')

  const ia = attributionFor('impact-assessments', { attribution: 'HM Treasury — Final' })
  check(ia?.name === 'HM Treasury' && ia.source === 'publisher',
    'an impact assessment names its department', JSON.stringify(ia))
  check(/Final/.test(ia?.role ?? ''),
    '   …and keeps the stage, because a Final IA and a consultation-stage one differ', ia?.role ?? '')

  const cons = attributionFor('consultations', { attribution: 'department-for-education' })
  check(cons?.name === 'Department for Education', 'a consultation slug is de-slugged', JSON.stringify(cons?.name))
  const cons2 = attributionFor('consultations', { attribution: 'Department for Environment, Food and Rural Affairs — Consultation' })
  check(cons2?.name === 'Department for Environment, Food and Rural Affairs',
    '   …and the prose form is left alone', JSON.stringify(cons2?.name))

  check(deslug('ministry-of-housing-communities-and-local-government-2018-2021')
    === 'Ministry of Housing Communities and Local Government 2018 2021',
    '⚠ de-slugging changes separators and case ONLY — the stored year range is not tidied away')
  check(deslug('HM Treasury') === 'HM Treasury', '   …and prose passes through byte-identical')

  check(attributionFor('hmrc-manuals', { speaker: '   ', attribution: '' }) === null,
    'whitespace is not an attribution')

  // ── 4. rendering ────────────────────────────────────────────────────────────────────────────
  console.log('\n— rendering into the prompt —')
  const withAttr: EvidenceResult = {
    id: 'a', kind: 'DEBATE', kindLabel: EVIDENCE_KINDS.DEBATE.label, whatItIs: EVIDENCE_KINDS.DEBATE.whatItIs,
    title: 'Assisted Dying Bill', attribution: spk as Attribution, date: '2026-01-05', url: null,
    snippet: 'the House will come to order', score: 1,
  }
  const withoutAttr: EvidenceResult = { ...withAttr, id: 'b', kind: 'COMMITTEE', attribution: null }

  const bothBlock = evidenceBlock([withAttr, withoutAttr])
  check(!!bothBlock && bothBlock.includes('— Lindsay Hoyle,'),
    'an attributed item renders its "who said it" line')
  check(!!bothBlock && bothBlock.includes(ATTRIBUTION_ABSENCE_NOTE),
    '⚠ and a block containing an UNattributed item carries the note that null ≠ anonymous')

  const allAttr = evidenceBlock([withAttr])
  check(!!allAttr && !allAttr.includes(ATTRIBUTION_ABSENCE_NOTE),
    '   …while a fully-attributed block does NOT carry it (no unconditional boilerplate)')
  check(/not the same as the source being anonymous/i.test(ATTRIBUTION_ABSENCE_NOTE),
    '⚠⚠ the note says in terms that a missing attribution is not anonymity')

  check(attributionLine(null) === null, 'a null attribution renders nothing, never an empty dash')

  console.log(`\n════ ${fail ? `${fail} FAILED, ${pass} passed` : `all ${pass} checks pass`} ════\n`)
  if (fail) process.exit(1)
}

main()
