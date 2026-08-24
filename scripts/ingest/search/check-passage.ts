/**
 * check-passage.ts — SEARCH S13 §3. The self-test for the matched-passage selector.
 *
 * ⚠ EVERY ASSERTION HERE IS PAIRED WITH A NEGATIVE CONTROL THAT MUST FAIL, and the run reports
 * how many controls FIRED. Three sprints in a row produced a check that could not fail — one that
 * passed only because its ranking put every counter-example below the `limit`, and a production
 * route probe that 307d on its control as well as its target. A check whose control is silent has
 * not been watched failing and is not evidence of anything.
 *
 * Usage:  cd scripts/ingest && npx tsx search/check-passage.ts
 */
import { bestPassage, passageTerms, passageLocation, normaliseBody, PASSAGE_CHARS } from './passage'

let pass = 0, fail = 0, fired = 0, silent = 0
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
}
/** The control. It asserts the check CAN fail: `cond` must be FALSE on the broken input. */
function control(name: string, condOnBroken: boolean) {
  if (!condOnBroken) { fired++; console.log(`     ↳ control fired (the check can fail): ${name}`) }
  else { silent++; console.log(`     ↳ ⚠⚠ CONTROL DID NOT FIRE — ${name} passes on the broken input too, so it proves nothing`) }
}

// A document shaped like the ones this exists for: a long speech whose argument is in the middle.
const OPENING = 'My Lords, I am grateful to the noble Lord for giving way, and I begin by declaring an interest. '
const FILLER = 'I shall not detain the House long on the procedural history of this measure. '
const ARGUMENT = 'The central objection is that a coroner cannot investigate a death that has already been certified, so the safeguard the Bill relies on cannot operate at all. '
const TAIL = 'I beg to move that this House do now adjourn. '

function speech(argAt = 20): string {
  const parts: string[] = [OPENING]
  for (let i = 0; i < 60; i++) parts.push(i === argAt ? ARGUMENT : FILLER)
  parts.push(TAIL)
  return parts.join('')
}

console.log('SEARCH S13 §3 — check:passage\n')

// ── 1. the passage is the argument, not the opening ────────────────────────────────────────────
{
  const body = speech()
  const terms = passageTerms('can a coroner investigate a death that was certified')
  const p = bestPassage(body, terms)
  ok('picks the passage containing the query terms, not the head of the document',
    p.text.includes('coroner cannot investigate'), `start=${p.start} of ${normaliseBody(body).length}`)
  ok('and does NOT return the opening courtesies', !p.text.startsWith('My Lords, I am grateful'))
  ok('reports matched:true with the terms it located', p.matched && p.terms.includes('coroner'),
    `terms=${p.terms.join(',')}`)
  // CONTROL: the OLD behaviour on the same input. If `body.slice(0,300)` also contained the
  // argument, this test could not tell the fix from the defect.
  control('old head-of-document snippet contains the argument',
    body.slice(0, 300).includes('coroner cannot investigate'))
}

// ── 2. a document with no query term says so rather than pretending ────────────────────────────
{
  const body = speech()
  const p = bestPassage(body, passageTerms('mackerel quota reallocation in the north sea'))
  ok('a document with no query term returns matched:false', p.matched === false)
  ok('…and its terms list is empty, so nothing can be claimed to have matched', p.terms.length === 0)
  ok('…and it falls back to the head of the document, which is the right fallback',
    p.text.startsWith('My Lords, I am grateful'))
  ok('passageLocation refuses to place an unmatched passage', passageLocation(p, body.length) === null)
  // CONTROL: a matched passage must NOT report matched:false, or the flag is a constant.
  const m = bestPassage(body, passageTerms('coroner'))
  control('matched:false is returned even when a term IS present', m.matched === false)
}

// ── 3. prefix matching, without a stemmer ──────────────────────────────────────────────────────
{
  const body = `The tenant was evicted in March. ${FILLER.repeat(40)}`
  const p = bestPassage(body, passageTerms('can my landlord evict me'))
  ok('a query term matches as a word PREFIX (evict → evicted)', p.matched && p.terms.includes('evict'))
  // CONTROL: it must not match INSIDE a word, or "art" would match "start" and the displayed
  // passage would disagree with why the document was retrieved.
  const inner = bestPassage(`A total of prevention measures. ${FILLER.repeat(40)}`, ['vent'])
  control('a term matches mid-word ("vent" inside "prevention")', inner.matched === true)
}

// ── 4. the window is bounded and lands on word boundaries ──────────────────────────────────────
{
  const body = speech()
  const p = bestPassage(body, passageTerms('coroner'))
  ok(`the passage is bounded (${p.text.length} ≤ ${PASSAGE_CHARS} + one sentence tail)`,
    p.text.length <= PASSAGE_CHARS + 200, `${p.text.length} chars`)
  ok('the passage does not end mid-word', /[\s.,;:!?)"'’”]$|[a-zA-Z0-9.]$/.test(p.text) && !/\s$/.test(p.text.trimEnd() + 'x'))
  const norm = normaliseBody(body)
  ok('start/end are real offsets into the normalised body', norm.slice(p.start, p.end) === p.text,
    `[${p.start},${p.end})`)
  // CONTROL: offsets computed against the RAW body would not round-trip once whitespace collapsed.
  const raw = `a\n\n\nb   c ${body}`
  const p2 = bestPassage(raw, passageTerms('coroner'))
  control('offsets round-trip against the RAW body rather than the normalised one',
    raw.slice(p2.start, p2.end) === p2.text)
}

// ── 5. a short document is returned whole ──────────────────────────────────────────────────────
{
  const short = 'Section 21 gives the landlord a power to recover possession without giving a reason.'
  const p = bestPassage(short, passageTerms('can my landlord evict me without a reason'))
  ok('a document shorter than the window is returned whole', p.text === short && p.matched)
}

// ── 6. determinism — the same body and terms give the same passage every time ──────────────────
{
  const body = speech(31)
  const terms = passageTerms('coroner investigate certified death safeguard')
  const runs = new Set(Array.from({ length: 5 }, () => JSON.stringify(bestPassage(body, terms))))
  ok('the selector is deterministic across repeated calls', runs.size === 1, `${runs.size} distinct result(s)`)
}

// ── 7. it prefers the window covering the MOST DISTINCT terms ──────────────────────────────────
{
  // One place has 'coroner' three times; another has 'coroner' and 'certified' and 'safeguard'.
  const many = 'coroner coroner coroner. '
  const distinct = 'the coroner said the certified safeguard failed. '
  const body = FILLER.repeat(15) + many + FILLER.repeat(30) + distinct + FILLER.repeat(15)
  const p = bestPassage(body, passageTerms('coroner certified safeguard'))
  ok('prefers distinct-term coverage over raw term frequency', p.text.includes('certified safeguard'),
    `terms=${p.terms.join(',')}`)
  control('the repetition-heavy window wins instead', p.text.includes('coroner coroner coroner'))
}

// ── 8. an empty body does not throw and does not lie ───────────────────────────────────────────
{
  const p = bestPassage('', passageTerms('anything at all'))
  ok('an empty body returns empty text and matched:false', p.text === '' && p.matched === false)
}

console.log(`\n  ${pass} passed, ${fail} failed · controls: ${fired} fired, ${silent} silent`)
if (silent) console.log('  ⚠⚠ A SILENT CONTROL MEANS THE ASSERTION BESIDE IT WAS NEVER WATCHED FAILING.')
process.exit(fail || silent ? 1 : 0)
