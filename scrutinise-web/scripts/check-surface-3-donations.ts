/**
 * check-surface-3-donations.ts — SURFACE 3 §4.
 *
 * ⚠⚠ THE SECTION'S OWN INSTRUCTION, VERBATIM: *"Assert it: a donation-derived signal cannot
 * contribute direction to a position on a specific target. Construct the case and watch the check
 * fail without the guard."*
 *
 * So the central assertion here is not that the wording is careful. It is that the SHAPE makes the
 * wrong sentence unconstructible: a `PartyAlignment` has no direction field and no target field,
 * and `directionForTarget()` returns a refusal for every input. The paired control constructs the
 * banned case — an alignment being asked for a direction on a specific division — and watches it
 * come back refused.
 *
 *   npm run check:surface-3-donations
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import {
  tierFor, inferenceFor, statementFor, directionForTarget, alignmentForDonor, pickDonorToReview,
  type PartyAlignment, type DonationFact,
} from '../lib/graph/donation-alignment'

const ROOT = join(__dirname, '..')
let pass = 0, fail = 0, notChecked = 0
function ok(label: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
function unchecked(label: string, why: string) {
  notChecked++; console.log(`  ? ${label} — NOT CHECKED: ${why}`)
}
const breaks: Array<{ label: string; fired: boolean }> = []
function expectBreak(label: string, propertyHolds: () => boolean) {
  let held: boolean
  try { held = propertyHolds() } catch { held = false }
  breaks.push({ label, fired: !held })
}
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

function fact(recipient: string, date: string, pence = 500000): DonationFact {
  return {
    ecRef: `X${date}${recipient}`, donorName: 'A Donor Ltd', recipient,
    recipientType: 'Political Party', valuePence: pence, acceptedDate: date,
    sourceUrl: 'https://search.electoralcommission.org.uk/',
  }
}

async function main() {
  // ══ §4a — THE THREE TIERS, ON CONSTRUCTED CASES ════════════════════════════════════════════
  console.log('\n── §4a — the tiers ──')
  const sustained = tierFor(['Labour Party', 'Labour Party', 'Labour Party'],
    ['2019-01-01', '2021-06-01', '2023-03-01'])
  ok('sole-party, repeated over years → sustained, moderate',
    sustained.tier === 'sustained-single-party' && sustained.confidence === 'moderate',
    `${sustained.tier}/${sustained.confidence}`)

  const oneOff = tierFor(['Labour Party'], ['2019-01-01'])
  ok('a single one-off donation → one-off, low',
    oneOff.tier === 'one-off-single-party' && oneOff.confidence === 'low',
    `${oneOff.tier}/${oneOff.confidence}`)

  const multi = tierFor(['Labour Party', 'Conservative and Unionist Party'],
    ['2019-01-01', '2021-06-01'])
  ok('donations to more than one party → multi-party, NO confidence',
    multi.tier === 'multi-party' && multi.confidence === 'none',
    `${multi.tier}/${multi.confidence}`)

  // ⚠⚠ MULTI-PARTY MUST BE ABSORBING. A donor who gave to two parties across ten years must not
  // be graded as a sustained single-party donor with a footnote; testing volume before party
  // count is exactly how that would happen.
  const longMulti = tierFor(
    ['Labour Party', 'Labour Party', 'Labour Party', 'Conservative and Unionist Party'],
    ['2014-01-01', '2016-01-01', '2018-01-01', '2024-01-01'])
  ok('a decade of giving to one party plus one gift to another is STILL multi-party',
    longMulti.tier === 'multi-party' && longMulti.confidence === 'none',
    `${longMulti.tier}/${longMulti.confidence}`)
  expectBreak('§4a break: volume tested before party count would promote a multi-party donor',
    () => {
      // The wrong implementation, written out, so the property is tested rather than the code.
      const wrong = (parties: string[], dates: string[]) =>
        dates.length > 1 ? 'sustained-single-party' : new Set(parties).size > 1 ? 'multi-party' : 'one-off'
      return wrong(['Labour Party', 'Conservative and Unionist Party'],
        ['2014-01-01', '2024-01-01']) === 'multi-party'
    })

  // ══ §4b — ⚠⚠ THE HARD LINE, ENFORCED IN CODE ══════════════════════════════════════════════
  console.log('\n── §4b — a donation can never give a direction on a specific proposal ──')
  const alignment: PartyAlignment = {
    donorEntityId: '1', donorName: 'A Donor Ltd',
    facts: [fact('Labour Party', '2019-01-01'), fact('Labour Party', '2023-01-01')],
    parties: ['Labour Party'], firstDonation: '2019-01-01', lastDonation: '2023-01-01',
    yearsSpanned: 5, tier: 'sustained-single-party', confidence: 'moderate',
    inference: inferenceFor('sustained-single-party', 'Labour Party', 5),
    statement: statementFor([fact('Labour Party', '2019-01-01')], ['Labour Party']),
    configVersion: '3c.test',
  }

  // ⚠ THE CONSTRUCTED CASE THE BRIEF ASKS FOR: ask this alignment for a direction on a division.
  const asked = directionForTarget(alignment, 'division:commons:2051')
  ok('asking a donation alignment for a direction on a division returns ZERO',
    asked.direction === 0)
  ok('…and it returns a REFUSAL, not a silence — the reason travels with the zero',
    asked.refused === true && asked.reason.length > 80)
  expectBreak('§4b break: a direction function that answered would fail this',
    () => {
      // The banned implementation: map the tier onto a direction. This is the code that would
      // produce "supports your bill", and the property below is what forbids it.
      const banned = (a: PartyAlignment) => (a.tier === 'sustained-single-party' ? 1 : 0)
      return banned(alignment) === 0
    })

  // ⚠⚠ AND THE TYPE ITSELF CARRIES NO DIRECTION AND NO TARGET. This is the guard; the function
  // above is only how it is made visible. A source assertion is correct here because the property
  // genuinely IS about the source: does this interface declare these fields.
  const src = read('lib/graph/donation-alignment.ts')
  const iface = src.slice(src.indexOf('export interface PartyAlignment'),
    src.indexOf('export function directionForTarget'))
  for (const banned of ['direction', 'stanceScore', 'targetId', 'targetType', 'targetKey']) {
    ok(`PartyAlignment declares no \`${banned}\` field`,
      !new RegExp(`^\\s*${banned}\\??:`, 'm').test(iface))
  }
  expectBreak('§4b break: the field test would catch a direction field if one were added',
    () => !/^\s*direction\??:/m.test(`${iface}\n  direction: number\n`))

  // ⚠ AND NO WORDING ANYWHERE MAY POINT AT A PROPOSAL. "your bill", "this proposal", "this
  // measure" are the sentences that would be quoted back at Charlie.
  const wordings = [
    inferenceFor('sustained-single-party', 'Labour Party', 5),
    inferenceFor('one-off-single-party', 'Labour Party', 1),
    inferenceFor('multi-party', 'Labour Party', 5),
  ]
  ok('no tier wording refers to a bill, a proposal or a measure',
    wordings.every((w) => !/\byour (bill|proposal)\b|\bthis (bill|proposal|measure|amendment)\b/i.test(w)))
  expectBreak('§4b break: a wording that names the reader’s proposal',
    () => !/\byour (bill|proposal)\b/i.test('This donor supports your bill.'))

  // ⚠ AND THE MULTI-PARTY SENTENCE MUST SAY SO EXPLICITLY, not hedge.
  ok('the multi-party wording states NO DIRECTION explicitly rather than hedging',
    /no direction/i.test(wordings[2]) && /access/i.test(wordings[2]),
    wordings[2].slice(0, 80))

  // ══ §4c — NO NAME MATCHING ANYWHERE ON THE RESOLUTION PATH ════════════════════════════════
  console.log('\n── §4c — the donor is resolved by number, never by name ──')
  const chSrc = readFileSync(
    join(ROOT, '../scripts/graph/resolve-3d-companies-house.ts'), 'utf8').replace(/\r\n/g, '\n')
  // ⚠ Comments stripped, because the file's own header quotes the banned words while explaining
  // why they are banned — an absence grep that reads its own explanation is the fault this
  // project has already logged.
  const chCode = chSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  ok('the Companies House resolver contains no name-similarity call',
    !/similarity|levenshtein|soundex|ILIKE\s*'%'\s*\|\|\s*\$?\d*name|trigram|pg_trgm/i.test(chCode))
  ok('it matches donor_name against nothing',
    !/donor_name\s*(=|ILIKE|~)/i.test(chCode))
  expectBreak('§4c break: a name fallback would be caught',
    () => !/similarity|ILIKE/i.test("WHERE similarity(donor_name, e.canonical_name) > 0.8"))

  // ══ §4d — THE VERDICT IS STORED, AND NOTHING WRITES BACK ══════════════════════════════════
  console.log('\n── §4d — a verdict is a signal, not a truth ──')
  const routeSrc = read('app/api/graph/donations/route.ts')
  ok('the route never writes to position_signal or position_estimate',
    !/position_signal|position_estimate/.test(routeSrc))
  ok('the GET does not return the tier, the confidence or the inference',
    (() => {
      const get = routeSrc.slice(routeSrc.indexOf('export async function GET'),
        routeSrc.indexOf('const PostSchema'))
      // The response object of the GET must not carry our reading.
      const body = get.slice(get.lastIndexOf('return NextResponse.json'))
      return !/\btier\b|\bconfidence\b|\binference\b/.test(body)
    })(),
    'the reveal is the POST, and only the POST')
  expectBreak('§4d break: a GET that spread the alignment wholesale',
    () => !/\btier\b/.test('return NextResponse.json({ alignment: { ...a } , tier: a.tier })'))

  // ⚠ `$queryRawUnsafe` returns the ROW ARRAY itself, not `{ rows }`. Destructuring `{ rows }`
  // off it yields undefined and the check dies before its own assertion — which is a check that
  // cannot report, not a check that failed.
  const rows = await prisma.$queryRawUnsafe<Array<{ conname: string }>>(
    `SELECT conname FROM pg_constraint
      WHERE conrelid = '"GraphDonationJudgement"'::regclass AND contype='c' ORDER BY conname`)
  ok('the database enforces the order too, not only the route',
    rows.some((r) => r.conname.includes('reveal_after_judgement'))
    && rows.some((r) => r.conname.includes('answer_after_reveal')),
    rows.map((r) => r.conname.replace('GraphDonationJudgement_', '')).join(', '))
  ok('"not-sure" is a permitted answer in the database, not only in the UI',
    (await prisma.$queryRawUnsafe<Array<{ def: string }>>(
      `SELECT pg_get_constraintdef(oid) def FROM pg_constraint
        WHERE conrelid = '"GraphDonationJudgement"'::regclass AND conname LIKE '%_agreed'`))
      .some((r) => r.def.includes('not-sure')))

  // ══ §4e — ON REAL DATA ════════════════════════════════════════════════════════════════════
  console.log('\n── §4e — the same, over a real donor from the register ──')
  const donor = await pickDonorToReview()
  if (!donor) {
    unchecked('a real alignment grades and refuses', 'no donor has both ends resolved')
  } else {
    const live = await alignmentForDonor(donor)
    ok('a real donor yields an alignment carrying its published facts',
      !!live && live.facts.length > 0,
      live ? `${live.donorName}: ${live.facts.length} donations, tier ${live.tier}` : 'null')
    if (live) {
      ok('every fact carries an Electoral Commission reference',
        live.facts.every((f) => f.ecRef.length > 0))
      ok('the statement leads with the fact and names no proposal',
        /Donated/.test(live.statement)
        && !/\byour (bill|proposal)\b|\bthis (bill|proposal)\b/i.test(live.statement),
        live.statement.slice(0, 90))
      ok('the live alignment refuses a direction too',
        directionForTarget(live, 'division:commons:2051').direction === 0)
    }
  }

  console.log('\n── negative controls (each must FIRE on broken input) ──')
  let dead = 0
  for (const b of breaks) {
    console.log(`  ${b.fired ? '✓ fired' : '✗ DEAD  '}  ${b.label}`)
    if (!b.fired) dead++
  }
  console.log(`\n${pass} passed, ${fail} failed, ${notChecked} not checked, `
    + `${breaks.length} controls, ${dead} dead`)
  if (fail || dead) process.exitCode = 1
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
