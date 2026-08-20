/**
 * check-caselaw-body.ts — BRIEF_INGEST_CASELAW_TEXT §2.2. THE CHECK, AND THE PROOF IT FIRES.
 *
 * Two halves, because §2.2 says a one-sided check is not a check:
 *
 *   NEGATIVE — no stored case-law body begins with, or is predominantly, stylesheet content.
 *              Proved to fire by PLANTING one: the guard is handed the bytes that are in R2
 *              today, and must reject them. If that ever passes, the check is broken, not the
 *              corpus fixed.
 *
 *   POSITIVE — a known judgment's stored text contains a phrase that appears only in the
 *              judgment itself. "No CSS" passes on an empty string; this does not.
 *
 * Run:
 *   --controls          the planted failures + the gold phrase, no database (always run first)
 *   --sweep=N           the same guard over N stored tna-caselaw bodies, read from R2
 *   --source=stored     sweep what is in R2 today (default)
 *   --source=recompiled sweep what the new extractor WOULD produce, from the raw AKN
 *
 * Exit code is non-zero if any assertion fails, so it can gate the backfill.
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'
import { aknJudgmentText, checkJudgmentBody } from '../shared/akn-text'

/**
 * ⚠ THE GOLD PHRASE, and why this one. It is 14 words out of the middle of the reasoning in
 * R (Miller) v The Prime Minister — the judgment the brief names as the thing a user was being
 * served a stylesheet for. It cannot appear in a stylesheet, cannot appear in the AKN `<meta>`
 * block, and cannot be produced by a truncated or empty extraction. Read out of the re-compiled
 * text by hand on 20 Aug 2026 and checked against the National Archives' own published judgment.
 */
const GOLD_ID = 'tna-caselaw:[2019] UKSC 41:1'
const GOLD_PHRASE = 'a cross party group of 75 MPs and members of the House of Lords'

/** The exact bytes stored for that judgment today — the plant. Kept verbatim, not paraphrased. */
const PLANTED_STYLESHEET =
  `UKSC 2019 41 [2019] UKSC 41 0.26.19 c08dfb9d3c7e45d2e018e52086a41ff4249f7ed00b927a18959e248d6d36f235 7.4.0 ` +
  `#judgment { font-family: 'Times New Roman'; font-size: 12pt; } #judgment .Normal { font-size: 12pt; } ` +
  `#judgment .Heading1 { font-family: 'Calibri Light'; font-size: 16pt; } #judgment .PageNumber { } ` +
  `#judgment .Footnote { font-size: 10pt; } #judgment .Quote { margin-left: 2em; font-size: 11pt; } ` +
  `#judgment .CoverDesc { text-align: center; font-weight: bold; font-size: 18pt; } ` +
  `#judgment .CoverText { text-align: right; text-decoration-line: underline; font-size: 12pt; }`

let failures = 0
function assert(ok: boolean, label: string, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  console.log(`        ${detail}`)
}

async function controls(): Promise<void> {
  console.log('\n— PLANTED FAILURES: the guard must reject each of these —\n')

  const planted = checkJudgmentBody(PLANTED_STYLESHEET)
  assert(!planted.ok, 'a stylesheet body is REJECTED',
    `verdict "${planted.reason}" (${planted.styleChars} CSS chars, first at ${planted.firstStyleOffset}, ` +
    `${(100 * planted.styleShare).toFixed(1)}% of the body)`)

  const empty = checkJudgmentBody('')
  assert(!empty.ok, 'an EMPTY body is REJECTED — the trap §2.2 names',
    `verdict "${empty.reason}". A check that only asked "does it contain CSS?" would have passed this.`)

  const stub = checkJudgmentBody('Judgment approved. Appeal dismissed. No order as to costs.')
  assert(!stub.ok, 'a nine-word stub body is REJECTED',
    `verdict "${stub.reason}"`)

  const mostlyCss = checkJudgmentBody(
    `${PLANTED_STYLESHEET} ${'The appeal is dismissed for the reasons given below. '.repeat(6)}`)
  assert(!mostlyCss.ok, 'a body that is PREDOMINANTLY stylesheet is REJECTED even with prose after it',
    `verdict "${mostlyCss.reason}"`)

  console.log('\n— WHAT THE SOURCE ITSELF PUBLISHES: short is not the same as lost —\n')

  // ⚠ These came out of the full sweep, not out of imagination. Twenty judgments in this collection
  // have a <judgmentBody> containing the single word "withdrawn"; two have one that is completely
  // empty. Without the source's own word count the guard cannot tell any of them from a broken
  // extraction, and it refused all twenty-two — leaving a stylesheet in place of each.
  const withdrawn = checkJudgmentBody('withdrawn', { sourceBodyWords: 1 })
  assert(withdrawn.ok, 'a one-word judgment is ACCEPTED when the source publishes one word',
    `verdict "${withdrawn.reason}" — tna-caselaw:[2004] EWHC 2064 (Fam):1 really is the word "withdrawn"`)

  const truncated = checkJudgmentBody('withdrawn', { sourceBodyWords: 9000 })
  assert(!truncated.ok, 'the SAME one-word body is REFUSED when the source publishes 9,000 words',
    `verdict "${truncated.reason}" — the pair is what makes this a rule rather than a loophole`)

  const emptySource = checkJudgmentBody('', { sourceBodyWords: 0 })
  assert(!emptySource.ok && emptySource.emptyAtSource,
    'an EMPTY-AT-SOURCE judgment is refused as a body but FLAGGED, not merely rejected',
    `verdict "${emptySource.reason}", emptyAtSource=${emptySource.emptyAtSource}. ` +
    `tna-caselaw:[2017] UKUT 135 (LC):1 carries uk:hash e3b0c442… — the SHA-256 of the empty string. ` +
    `The caller stores an empty body for these; leaving them alone leaves a pure stylesheet.`)

  console.log('\n— THE POSITIVE HALF: the guard must accept real judgment text —\n')
  const good = checkJudgmentBody(
    `Lord Reed and Lord Hodge gave the judgment of the court. ` +
    `On 30th July 2019, ${GOLD_PHRASE}, together with one QC, had launched a petition in the Court of Session. ` +
    `${'The question is one of law and is justiciable. '.repeat(10)}`)
  assert(good.ok, 'a real judgment body is ACCEPTED', `verdict "${good.reason}" (${good.words} words, ${good.styleChars} CSS chars)`)
}

async function goldPhrase(p: ReturnType<typeof namesPool>, source: 'stored' | 'recompiled'): Promise<void> {
  console.log(`\n— THE GOLD PHRASE, in ${source === 'stored' ? 'what is stored in R2 today' : 'what the new extractor produces'} —\n`)
  const r = (await p.query(`SELECT id, "sectionTitle", "r2Key", "r2RawKey" FROM corpus_sections WHERE id=$1`, [GOLD_ID])).rows[0]
  if (!r) { assert(false, 'the gold judgment exists', `${GOLD_ID} is not in corpus_sections`); return }
  let text: string | null
  if (source === 'stored') {
    text = await r2Get(r.r2Key)
  } else {
    const raw = await r2Get(r.r2RawKey)
    text = raw ? aknJudgmentText(raw)?.text ?? null : null
  }
  const found = !!text && text.includes(GOLD_PHRASE)
  assert(found, `${GOLD_ID} contains a phrase that appears only in the judgment`,
    `"${GOLD_PHRASE}" — ${found ? 'present' : 'ABSENT'} in ${text ? `${text.length.toLocaleString()} stored chars` : 'a body that could not be read'}` +
    `; title "${r.sectionTitle}"`)
  if (text) {
    const v = checkJudgmentBody(text)
    assert(v.ok, `${GOLD_ID} passes the body guard`, `verdict "${v.reason}"`)
  }
}

async function sweep(p: ReturnType<typeof namesPool>, n: number, source: 'stored' | 'recompiled'): Promise<void> {
  console.log(`\n— SWEEP: the guard over ${n} ${source} tna-caselaw bodies —\n`)
  const rows = (await p.query(
    `SELECT id, "r2Key", "r2RawKey" FROM corpus_sections
      WHERE corpus='tna-caselaw' AND "r2Key" IS NOT NULL AND "r2RawKey" IS NOT NULL
      ORDER BY md5(id || 'guard') LIMIT $1`, [n])).rows

  let ok = 0, read = 0
  const reasons: Record<string, number> = {}
  const examples: string[] = []
  await Promise.all(rows.map(async r => {
    let text: string | null
    if (source === 'stored') text = await r2Get(r.r2Key)
    else { const raw = await r2Get(r.r2RawKey); text = raw ? aknJudgmentText(raw)?.text ?? null : null }
    if (text === null) { reasons['R2 object unreadable'] = (reasons['R2 object unreadable'] ?? 0) + 1; return }
    read++
    const v = checkJudgmentBody(text)
    if (v.ok) ok++
    else {
      const key = v.reason.replace(/\d+/g, 'N')
      reasons[key] = (reasons[key] ?? 0) + 1
      if (examples.length < 3) examples.push(`${r.id} — ${v.reason}`)
    }
  }))
  console.log(`  read ${read} of ${rows.length}`)
  console.log(`  PASS the guard: ${ok}/${read} (${read ? ((100 * ok) / read).toFixed(1) : '—'}%)`)
  for (const [k, v] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
  if (examples.length) { console.log('  examples:'); examples.forEach(e => console.log(`    ${e}`)) }
  console.log(`\n  (this number is REPORTED, not asserted — before the backfill it is expected to be near zero,` +
    `\n   and that is the check being watched failing. The assertion lives in --controls and the gold phrase.)`)
}

;(async () => {
  const source = (process.argv.find(a => a.startsWith('--source='))?.split('=')[1] ?? 'stored') as 'stored' | 'recompiled'
  const sweepN = parseInt(process.argv.find(a => a.startsWith('--sweep='))?.split('=')[1] ?? '0', 10)
  const wantControls = process.argv.includes('--controls') || sweepN === 0

  if (wantControls) await controls()
  if (sweepN > 0 || wantControls) {
    const p = namesPool()
    await goldPhrase(p, source)
    if (sweepN > 0) await sweep(p, sweepN, source)
    await endNamesPool()
  }
  console.log(`\n${failures === 0 ? 'ALL ASSERTIONS PASS' : `${failures} ASSERTION FAILURE(S)`}`)
  process.exit(failures === 0 ? 0 : 1)
})().catch(e => { console.error(e); process.exit(1) })
