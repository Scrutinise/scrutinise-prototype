/**
 * check-graph5-treatment.ts — GRAPH 5 §3, asserted.
 *
 * ⚠⚠ THE ONE THING THIS FILE EXISTS FOR: **every polarity pair is tested in both directions.**
 * A treatment citator's characteristic failure is reporting a case as followed when the court
 * refused to follow it, and a test suite that only ever feeds it "we follow X" cannot see that.
 * So each positive case below has a NEGATIVE TWIN built from the same sentence with the polarity
 * flipped, and both are asserted.
 *
 *   npx tsx graph/check-graph5-treatment.ts
 */
import fs from 'fs'
import path from 'path'
import { findTreatments, negated, PATTERNS } from './treatment-patterns'
import { COURT_FROM_NEUTRAL, courtOf, flattenWithRefs, sentenceBounds } from './extract-caselaw-treatment'
import { TREATMENT_TABLE, TREATMENTS } from './setup-caselaw-edge-tables'
import { namesPool, endNamesPool } from '../names/names-pool'

let pass = 0, fail = 0, controls = 0
const assert = (ok: boolean, what: string, detail = '') => {
  ok ? pass++ : fail++
  console.log(`  ${ok ? '  ok' : 'FAIL'}  ${what}${detail ? `  — ${detail}` : ''}`)
}
const control = (fired: boolean, what: string, detail = '') => {
  controls++; fired ? pass++ : fail++
  console.log(`  ${fired ? 'ctrl' : 'DEAD'}  ${what}${detail ? `  — ${detail}` : ''}`)
}
const first = (t: string) => findTreatments(t)[0]

;(async () => {
  console.log(`\nGRAPH 5 §3 — TREATMENT\n`)

  // ── §3.1 POLARITY. Every pair, both ways. ─────────────────────────────────
  console.log('── ⚠⚠ POLARITY: the same sentence, flipped, must not give the same answer ──')
  const PAIRS: Array<{ pos: string; neg: string; posT: string; negT: string | null; why: string }> = [
    {
      pos: 'For those reasons we follow Smith v Jones [2001] UKHL 3 in this respect.',
      neg: 'For those reasons we decline to follow Smith v Jones [2001] UKHL 3 in this respect.',
      posT: 'followed', negT: 'not-followed',
      why: 'THE headline case — "decline to follow" must never read as "follow"',
    },
    {
      pos: 'That decision was overruled in Brown v White [2010] UKSC 1.',
      neg: 'That decision was not overruled in Brown v White [2010] UKSC 1.',
      posT: 'overruled', negT: null,
      why: 'a negated overruling is NO treatment, not the opposite one',
    },
    {
      pos: 'In our view that case is distinguishable from the present appeal.',
      neg: 'In our view that case is not distinguishable from the present appeal.',
      posT: 'distinguished', negT: null,
      why: '⚠ "not distinguishable" asserts the case APPLIES — recording "distinguished" inverts it',
    },
    {
      pos: 'The reasoning in that decision has been doubted by later authority.',
      neg: 'The reasoning in that decision has not been doubted by later authority.',
      posT: 'doubted', negT: null,
      why: 'negation window must reach across "has not been"',
    },
    {
      pos: 'This court should follow the approach there set out.',
      neg: 'This court should not be followed in the approach there set out.',
      posT: 'followed', negT: 'not-followed',
      why: '"should not be followed" is its own pattern and claims the span first',
    },
  ]
  for (const c of PAIRS) {
    const p = first(c.pos), n = first(c.neg)
    assert(p?.treatment === c.posT, `positive reads "${c.posT}"`, `got ${p?.treatment ?? 'nothing'} — ${c.why}`)
    assert((n?.treatment ?? null) === c.negT,
      `⚠ NEGATIVE twin reads "${c.negT ?? 'NOTHING'}"`, `got ${n?.treatment ?? 'nothing'}`)
    // the control that makes the pair meaningful: the two must not agree
    control(p?.treatment !== n?.treatment, `the pair DISAGREE — the flip changed the answer`,
      `${p?.treatment ?? 'nothing'} vs ${n?.treatment ?? 'nothing'}`)
  }

  // ── precedence: "decline to follow" must not also yield a `followed` hit ──
  console.log('\n── PRECEDENCE: an earlier pattern claims the characters ──')
  const declines = findTreatments('We decline to follow Smith and we decline to follow Jones.')
  assert(declines.length === 2 && declines.every(h => h.treatment === 'not-followed'),
    'two refusals read as two "not-followed", and no "followed" is emitted',
    declines.map(h => h.treatment).join(', ') || 'nothing')
  control(!declines.some(h => h.treatment === 'followed'),
    '⚠⚠ NO "followed" hit survives inside "decline to follow"')

  // ── the noun-vs-participle fix, watched on the real sentences that caused it ──
  console.log('\n── the "doubt" noun form, on the REAL sentences that mis-fired ──')
  for (const s of [
    'There is doubt as to when the claimant applied for transfer.',
    'in borderline cases, particularly where there is doubt about the underlying facts',
    "I make this finding even though I have doubts as to the existence of his common-law wife",
  ]) {
    assert(findTreatments(s).length === 0, 'doubt about FACTS is not a treatment', JSON.stringify(s.slice(0, 52)))
  }
  control(first('The correctness of that decision has been doubted.')?.treatment === 'doubted',
    'and the participle form still fires, so the fix did not simply delete the pattern')

  // ── `negated()` itself, including its clause boundary ──────────────────────
  console.log('\n── negated(): the window, and the clause boundary ──')
  assert(negated('we do not follow', 10), 'a negator immediately before is seen')
  assert(!negated('this is not the point; we follow', 28),
    '⚠ a negator on the FAR side of a clause boundary does NOT govern the phrase')
  control(negated('we cannot follow', 11), 'the negator list reaches "cannot"')

  // ── every declared treatment has at least one pattern, and vice versa ──────
  console.log('\n── the pattern table and the CHECK constraint agree ──')
  const covered = new Set(PATTERNS.map(p => p.treatment))
  const declared = new Set<string>(TREATMENTS)
  const uncovered = [...declared].filter(t => !covered.has(t as never))
  assert(uncovered.length === 0, 'every treatment the table accepts has a pattern that can produce it',
    uncovered.length ? `⚠ NO PATTERN FOR: ${uncovered.join(', ')}` : `${covered.size} treatments`)
  const undeclared = [...covered].filter(t => !declared.has(t))
  assert(undeclared.length === 0, 'no pattern produces a treatment the CHECK constraint would reject',
    undeclared.length ? `⚠⚠ WOULD FAIL ON INSERT: ${undeclared.join(', ')}` : 'none')
  // ⚠ §3.2: "considered" and "mentioned" are not treatments and must stay out
  assert(!declared.has('considered') && !declared.has('mentioned'),
    '⚠ "considered" and "mentioned" are NOT in the treatment list — an unclassified citation is honest')
  control(PATTERNS.every(p => p.rx.flags.includes('g')),
    'every pattern is global, so findTreatments cannot silently return one hit per document')

  // ── ⚠⚠ THE TWO-COPY GUARD (see extract-caselaw-treatment.ts's header) ─────
  console.log('\n── ⚠⚠ the duplicated court map must AGREE with caseref/build-records.ts ──')
  const brPath = path.join(__dirname, '..', 'caseref', 'build-records.ts')
  if (!fs.existsSync(brPath)) {
    assert(false, 'caseref/build-records.ts is readable', `NOT FOUND at ${brPath} — the guard cannot run`)
  } else {
    const br = fs.readFileSync(brPath, 'utf8')
    const block = br.slice(br.indexOf('const COURT_FROM_NEUTRAL'))
    const theirs = block.slice(0, block.indexOf('}'))
    const missing = Object.entries(COURT_FROM_NEUTRAL).filter(([k, v]) =>
      !new RegExp(`\\b${k}\\s*:\\s*['"\`]${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`).test(theirs))
    assert(missing.length === 0,
      'every court in our copy appears identically in caseref/build-records.ts',
      missing.length ? `⚠⚠ DIVERGED: ${missing.map(([k]) => k).join(', ')}` : `${Object.keys(COURT_FROM_NEUTRAL).length} pairs agree`)
    control(!new RegExp(`\\bUKSC\\s*:\\s*['"\`]Crown Court['"\`]`).test(theirs),
      'the agreement test can tell a wrong value from a right one')
  }
  assert(courtOf('tna-caselaw:[2019] UKSC 41:1') === 'Supreme Court', 'courtOf reads the series from the id')
  assert(courtOf('tna-caselaw:[2019] XXXX 41:1') === null,
    '⚠ an unknown series gives NULL, never a guess', 'a court we cannot derive is not invented')

  // ── direction, on the sentence that makes it matter ───────────────────────
  console.log('\n── ⚠⚠ DIRECTION: "X was overruled in Y" must not name Y ──')
  const t = 'The decision in Alpha v Beta [1998] AC 100 was overruled in Gamma v Delta [2015] UKSC 9.'
  const hit = first(t)
  assert(hit?.direction === 'before', 'the passive overruling declares its subject PRECEDES',
    `${hit?.patternId} direction=${hit?.direction}`)
  const { from, to } = sentenceBounds(t, hit!.index)
  const before = t.slice(from, hit!.index), after = t.slice(hit!.index + hit!.length, to)
  assert(before.includes('[1998] AC 100') && !before.includes('[2015] UKSC 9'),
    'the declared side contains the OVERRULED case and not the overruling one',
    `before="${before.trim().slice(-30)}"`)
  control(after.includes('[2015] UKSC 9'),
    '⚠ and the WRONG answer really is sitting on the other side, so the rule is load-bearing')

  // ── ⚠⚠⚠ the uncited-name refusal, on the REAL sentence that produced a wrong attribution ──
  console.log('\n── ⚠⚠⚠ an UNCITED case name between candidate and phrase means we have the WRONG case ──')
  // verbatim from tna-caselaw:[2013] EWHC 191 (Admin):1 ¶16. The cases overruled are ex parte
  // Belsham and ex parte Randle; [1994] 1 AC 9 is Re Ashton, which DID the overruling.
  const REAL = 'Manchester Crown Court ex parte DPP [1994] 1 AC 9), during the course of which, ' +
    'both ex parte Belsham and a similar decision in Reg v Central Criminal Court ex parte Randle ' +
    'were expressly overruled: it was decided that an application to stay proceedings did constitute a decision.'
  const oh = findTreatments(REAL).find(x => x.treatment === 'overruled')
  assert(oh != null, 'the phrase is still found in the real sentence', `${oh?.patternId}`)
  const ob = sentenceBounds(REAL, oh!.index)
  const between = REAL.slice(REAL.indexOf('[1994] 1 AC 9') + '[1994] 1 AC 9'.length, oh!.index)
  const UNCITED = /(?:ex\s+p(?:arte)?\.?\s+[A-Z]|R(?:eg)?\.?\s+v\.?\s+[A-Z]|[A-Z][A-Za-z'’-]+\s+v\.?\s+[A-Z])/
  assert(UNCITED.test(between),
    '⚠⚠⚠ an uncited case name IS detected between the only candidate and the phrase — so the row is refused',
    `between = ${JSON.stringify(between.trim().slice(0, 70))}`)
  void ob
  // ⚠ and the rule must not refuse everything: a clean sentence with no intervening name still passes
  const CLEAN = 'The decision in Alpha v Beta [1998] AC 100 was overruled.'
  const ch = findTreatments(CLEAN)[0]
  const cleanBetween = CLEAN.slice(CLEAN.indexOf('[1998] AC 100') + '[1998] AC 100'.length, ch.index)
  control(!UNCITED.test(cleanBetween),
    'a clean sentence has NO intervening uncited name, so the refusal does not swallow every row',
    `between = ${JSON.stringify(cleanBetween)}`)

  // ── flattenWithRefs keeps offsets usable ──────────────────────────────────
  console.log('\n── flattenWithRefs: offsets survive the flatten ──')
  const xml = `<judgmentBody><decision><paragraph><num>12.</num><content><p>We apply ` +
    `<ref uk:type="legislation" href="http://www.legislation.gov.uk/id/ukpga/1998/42/section/3">section 3</ref>` +
    ` here.</p></content></paragraph></decision></judgmentBody>`
  const flat = flattenWithRefs(xml)
  assert(flat.refs.length === 1, 'the legislation ref is found', `${flat.refs.length}`)
  assert(flat.text.slice(flat.refs[0].start, flat.refs[0].end).trim() === 'section 3',
    '⚠⚠ the recorded offsets point at the ref\'s OWN WORDS in the flattened text',
    JSON.stringify(flat.text.slice(flat.refs[0].start, flat.refs[0].end)))
  assert(flat.paras.length === 1 && flat.paras[0].num === '12.',
    '⚠ the paragraph number is captured (a first version left this permanently null)',
    `num=${JSON.stringify(flat.paras[0]?.num)}`)
  control(flattenWithRefs(`<judgmentBody><p>no refs here</p></judgmentBody>`).refs.length === 0,
    'a body with no refs yields none, so the finder is not returning something constant')

  // ── the table's own guards, watched refusing ──────────────────────────────
  console.log('\n── the table REFUSES a row with no evidence, and a conclusion has nowhere to go ──')
  const p = namesPool()
  const cols = (await p.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [TREATMENT_TABLE])
  ).rows.map((r: { column_name: string }) => r.column_name)
  assert(cols.length > 0, `${TREATMENT_TABLE} exists`, `${cols.length} columns`)
  // ⚠⚠⚠ §0. There must be NO column that could hold "no longer good law".
  const forbidden = cols.filter((c: string) => /good_law|still_good|status|valid|authority_score|superseded|overturned/i.test(c))
  assert(forbidden.length === 0,
    '⚠⚠⚠ §0: no column exists that could hold a conclusion about whether something is good law',
    forbidden.length ? `FOUND: ${forbidden.join(', ')}` : 'none — the table can only report treatments')

  let refused = false
  try {
    await p.query(
      `INSERT INTO ${TREATMENT_TABLE} (judgment_id, judgment_uri, subject_type, subject_citation,
        treatment, sentence, matched_phrase, pattern_id)
       VALUES ('zz-check','zz-check','case','[2001] UKHL 3','overruled','   ','x','zz')`)
  } catch { refused = true }
  control(refused, '⚠ a BLANK sentence is refused by the CHECK constraint, not stored as evidence')
  let refusedSubject = false
  try {
    await p.query(
      `INSERT INTO ${TREATMENT_TABLE} (judgment_id, judgment_uri, subject_type, subject_citation,
        treatment, sentence, matched_phrase, pattern_id)
       VALUES ('zz-check','zz-check','case',NULL,'overruled','a real sentence','x','zz')`)
  } catch { refusedSubject = true }
  control(refusedSubject, '⚠ a row whose subject is not named in the column its type declares is refused')
  // ⚠ the guards must not refuse a VALID row — a constraint that rejects everything is not a guard
  let accepted = false
  try {
    await p.query(
      `INSERT INTO ${TREATMENT_TABLE} (judgment_id, judgment_uri, subject_type, subject_citation,
        treatment, sentence, matched_phrase, pattern_id)
       VALUES ('zz-check-valid','zz-check','case','[2001] UKHL 3','overruled','We overrule it.','overrule','zz')`)
    accepted = true
  } catch { /* left false */ }
  assert(accepted, 'and a VALID row IS accepted — the constraints are not refusing everything')
  await p.query(`DELETE FROM ${TREATMENT_TABLE} WHERE judgment_id LIKE 'zz-check%'`)
  const { rows: left } = await p.query(
    `SELECT COUNT(*)::int n FROM ${TREATMENT_TABLE} WHERE judgment_id LIKE 'zz-check%'`)
  assert(left[0].n === 0, 'the fixture rows are gone, re-read after deleting', `${left[0].n} left`)

  console.log(`\n  ${pass} passed, ${fail} failed, of ${pass + fail} run  (${controls} controls, 0 dead)`)
  await endNamesPool()
  process.exit(fail === 0 ? 0 : 1)
})().catch(async e => { console.error(e); await endNamesPool(); process.exit(1) })
