/**
 * qualify-pass.ts — BRIEF_GRAPH_2D5 §2: a SECOND PASS, not another field.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY A SECOND CALL AND NOT A SECOND COLUMN — THIS IS 2D-4's FINDING BEING HONOURED
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * 11 of the 50 hand-scored failures were a qualified position recorded as a plain one. 2D-4's v3
 * added a `qualified` polarity plus a `condition` field to the SAME call and it fixed **none of the
 * 11** — it also pushed mechanical discards from 22 to 62, because loading more onto one prompt
 * degraded the extraction that was already working.
 *
 * §2 draws the right conclusion: "a conditional position needs a SECOND PASS, not another field …
 * One thing asked at a time."
 *
 * So this call is given ONE job. It sees the submission, the claim, and the position already
 * recorded, and answers only: **is this position conditional, and on what?**
 *
 * ⚠⚠ IT CANNOT CHANGE THE POLARITY, AND THAT IS ENFORCED RATHER THAN REQUESTED.
 * The response schema has no polarity field, so there is no channel through which this pass could
 * overturn a direction. That keeps the change attributable — any movement on the fifty is caused by
 * qualification detection and by nothing else — and it means a bad second pass can only add noise
 * to a new column, never corrupt the column that already works.
 *
 * ⚠ THE CONDITION MUST BE QUOTED, NOT SUMMARISED. `conditionQuote` is checked against the document
 * with the same matcher the extractor uses. A condition we cannot find in the submission is recorded
 * as unverified rather than shown — "supports, provided funding follows" is only worth holding if
 * the submission actually said the funding part.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * HOW IT IS SCORED, DECIDED BEFORE IT RAN
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   baseline nuance-flattened (11) → pass says QUALIFIED   = FIXED
 *   baseline nuance-flattened (11) → pass says plain       = MISSED
 *   baseline CORRECT (23)          → pass says QUALIFIED   = ⚠ FALSE QUALIFICATION — a regression
 *   baseline CORRECT (23)          → pass says plain       = HELD
 *   baseline invented/flipped (16) → either                = UNTOUCHED (not what this pass is for)
 *
 * ⚠ THE FALSE-QUALIFICATION COLUMN IS THE POINT. A pass that marks everything conditional "fixes"
 * all 11 and is worthless. Without the 23 correct rows as a control the fix rate is unreadable.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/qualify-pass.ts --self-test
 *   npx tsx position-graph/qualify-pass.ts --run
 *   npx tsx position-graph/qualify-pass.ts --score
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { geminiJson, mapLimit, MODEL } from './llm-2d3'
import { newMeter, meterLine } from './cost-2d3'
import { getDocText, firstWords, findExtract } from './text-2d3'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const num = (n: string, d: number) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? parseInt(argv[i + 1], 10) : d }
const MAX_WORDS = num('max-words', 9000)
const PASS = 'q1'

const DDL = `
CREATE TABLE IF NOT EXISTS graph_position_qualifier (
  pass         TEXT NOT NULL,
  position_id  BIGINT NOT NULL,
  qualified    BOOLEAN NOT NULL,
  kind         TEXT,
  condition    TEXT,
  quote        TEXT,
  quote_found  BOOLEAN,
  confidence   REAL,
  model        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pass, position_id)
);`

/**
 * ⚠ THE KINDS ARE NAMED BECAUSE "QUALIFIED" ALONE IS AS LOSSY AS THE "FOR" IT REPLACES.
 *
 * Charlie's example — "four points for one side and five for the other" — is not the same thing as
 * "we support this provided the funding follows", and collapsing them would repeat the mistake this
 * pass exists to fix. `conditional` carries an if; `scoped` limits the claim to a subset; `weighed`
 * is the genuinely two-sided case; `reserved` supports the direction while doubting delivery.
 */
const PROMPT = `You are checking ONE recorded position on ONE claim, and you have exactly one question
to answer: IS THAT POSITION QUALIFIED, AND IF SO BY WHAT?

You are NOT being asked whether the position is right, and you cannot change it. Take the polarity as
given. Your only job is to say whether the submission attaches something to it.

A position is QUALIFIED when the submission supports or opposes the claim only in a limited way:
  · "conditional"  it holds only if something else happens — "we support this provided the funding
                   follows", "we oppose it unless safeguards are added"
  · "scoped"       it holds only for a subset — a group of patients, a region, a size of practice,
                   a period of time
  · "weighed"      the submission argues BOTH ways and lands on one side on balance, rather than
                   simply agreeing or disagreeing
  · "reserved"     it backs the aim but doubts the delivery, the evidence, or the mechanism

A position is NOT qualified when the submission simply states it. Vehemence is not qualification.
Mentioning a difficulty elsewhere in the document is not qualification. The qualification must attach
to THIS claim.

⚠ MOST POSITIONS ARE NOT QUALIFIED. If you are unsure, answer false. A wrongly-added condition
misstates the submission exactly as badly as a wrongly-dropped one.

Return:
  · qualified        true or false
  · kind             one of conditional | scoped | weighed | reserved — or "none" when qualified is
                     false.
  · condition        what the qualification IS, in under 200 characters, in the submission's own
                     terms. Empty when qualified is false.
  · conditionQuote   a passage COPIED VERBATIM AND CONTIGUOUSLY from the submission, 20 to 300
                     characters, that STATES the qualification. Not the passage that states the
                     position — the one that limits it. Copy it character for character. If no such
                     passage exists, qualified is false.
  · confidence       0.0 to 1.0

British English. No markdown.`

const SCHEMA = {
  type: 'object',
  properties: {
    qualified: { type: 'boolean' },
    // ⚠ "none" rather than "". Gemini REJECTS an empty string in an enum with HTTP 400
    // "response_schema.properties[kind].enum[4]: cannot be empty" — all 50 calls failed on it.
    kind: { type: 'string', enum: ['conditional', 'scoped', 'weighed', 'reserved', 'none'] },
    condition: { type: 'string' },
    conditionQuote: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['qualified', 'kind', 'condition', 'conditionQuote', 'confidence'],
}

/**
 * ⚠ A "CONDITION" THAT IS JUST THE POSITION RESTATED.
 *
 * Position 16034's condition quote came back BYTE-IDENTICAL to the passage the position was recorded
 * from. That is circular — nothing limits anything — and it is one of the eight spurious
 * qualifications found by hand, which means one of the eight is catchable without a reader.
 * Whitespace-insensitive because the source text is full of broken spacing.
 *
 * ⚠⚠ AND THE FIRST VERSION OF THIS CHECK WAS USELESS, WHICH IS WORTH KEEPING ON THE PAGE.
 * It tested `a.includes(b) || b.includes(a)` and fired on **21 of the 24** qualifications, including
 * six I had just certified as genuine by hand. That is not a strict check, it is a broken one: a
 * condition SHOULD often sit inside the same passage the position was read from — the sentence
 * "we support X, provided Y" contains both. Containment is the normal case, not the pathology.
 * The pathology is the quote being *the whole extract over again*, so the rule is equality after
 * whitespace normalisation, and nothing looser.
 */
export function conditionIsCircular(extract: string, quote: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const a = norm(extract); const b = norm(quote)
  if (!a || !b) return false
  return a === b
}

interface Target {
  position_id: string; proposition: string; polarity: string; extract: string
  r2key: string; words: number; submitter: string | null; inquiry_label: string | null
}

/**
 * §2 says "on the positions the extractor is most confident about". For SCORING that has to be the
 * hand-read fifty, because they are the only rows with an answer key — a confidence filter applied
 * to the whole corpus would produce a number nobody can check. The confidence rule is reported
 * against the fifty instead: every one of them carries confidence ≥ 0.7.
 */
async function targets(pool: ReturnType<typeof getNeonPool>): Promise<Target[]> {
  const { rows } = await pool.query<Target>(`
    SELECT p.id::text position_id, pr.text proposition, p.polarity, p.extract,
           c."r2Key" r2key, c."wordCount" words,
           (SELECT MIN(ge.object_label) FROM graph_edge ge JOIN graph_evidence gv ON gv.edge_id=ge.id
             WHERE gv.section_id=p.section_id AND ge.predicate='gave-evidence-to') inquiry_label,
           (SELECT string_agg(DISTINCT en.canonical_name, '; ') FROM graph_evidence gv2
              JOIN graph_edge ge2 ON ge2.id=gv2.edge_id JOIN graph_entity en ON en.id=ge2.subject_id
             WHERE gv2.section_id=p.section_id) submitter
    FROM graph_position_review r
    JOIN graph_position p ON p.id = r.position_id
    JOIN graph_proposition pr ON pr.id = p.proposition_id
    JOIN corpus_sections c ON c.id = p.section_id
    ORDER BY p.id`)
  return rows
}

async function run() {
  const pool = getNeonPool()
  for (const st of DDL.split(/;\s*\n/).filter((s) => s.trim())) await pool.query(st)
  const rows = await targets(pool)
  console.log(`\n════ QUALIFICATION SECOND PASS (${PASS}) — ${rows.length} positions ════`)
  console.log('  one question per call · the schema has NO polarity field, so this pass cannot change a direction\n')

  const meter = newMeter()
  const stats = { calls: 0, failed: 0, qualified: 0, quoteFound: 0, quoteMissing: 0, noText: 0 }
  // ⚠ WHY THIS COUNTER EXISTS. The first run of this pass reported "50 calls (50 failed)" and
  // nothing else, and the cause — Gemini rejecting an empty string in the `kind` enum with a
  // 400 — was invisible until a single call was reproduced by hand. A failure that does not name
  // itself is docs/CLAUDE.md §18's whole subject; the reasons are tallied and printed.
  const reasons = new Map<string, number>()

  await mapLimit(rows, 6, async (t) => {
    const text = await getDocText(t.r2key)
    if (!text) { stats.noText++; return }
    const body = t.words > MAX_WORDS ? firstWords(text, MAX_WORDS) : text
    const user = `CLAIM: ${t.proposition}\n`
      + `POSITION ALREADY RECORDED: ${t.polarity}\n`
      + `THE PASSAGE IT WAS RECORDED FROM: "${t.extract}"\n`
      + `SUBMITTED BY: ${t.submitter ?? '(not recorded)'}\n`
      + `INQUIRY: ${t.inquiry_label ?? ''}\n\n--- SUBMISSION ---\n${body}`

    const res = await geminiJson<{ qualified: boolean; kind: string; condition: string; conditionQuote: string; confidence: number }>({
      system: PROMPT, user, schema: SCHEMA, maxOutputTokens: 4096,
      label: `${PASS}:${t.position_id}`, meter, temperature: 0.1,
    })
    stats.calls++
    if (res.kind !== 'ok') {
      stats.failed++
      const key = `${res.kind}: ${String((res as { detail?: string }).detail ?? '').slice(0, 120)}`
      reasons.set(key, (reasons.get(key) ?? 0) + 1)
      return
    }
    const v = res.value
    const quote = (v.conditionQuote ?? '').trim()
    // ⚠ A CONDITION WE CANNOT FIND IS NOT A CONDITION WE HOLD. Recorded, flagged, not counted as a fix.
    const found = v.qualified && quote.length >= 20 ? findExtract(quote, text).found : false
    if (v.qualified) { stats.qualified++; found ? stats.quoteFound++ : stats.quoteMissing++ }

    await pool.query(
      `INSERT INTO graph_position_qualifier (pass, position_id, qualified, kind, condition, quote, quote_found, confidence, model)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (pass, position_id) DO UPDATE SET qualified=EXCLUDED.qualified, kind=EXCLUDED.kind,
         condition=EXCLUDED.condition, quote=EXCLUDED.quote, quote_found=EXCLUDED.quote_found,
         confidence=EXCLUDED.confidence, created_at=now()`,
      [PASS, t.position_id, !!v.qualified, v.kind && v.kind !== 'none' ? v.kind : null, v.condition?.trim() || null,
        quote.slice(0, 600) || null, found, typeof v.confidence === 'number' ? v.confidence : null, MODEL])
  })

  console.log(`  calls ${stats.calls} (${stats.failed} failed, ${stats.noText} no text)`)
  for (const [why, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ⚠ ${String(n).padStart(3)} × ${why}`)
  console.log(`  qualified ${stats.qualified} · quote located in the document ${stats.quoteFound} · ⚠ NOT located ${stats.quoteMissing}`)
  console.log(`  ${meterLine(meter)}`)
  await endNeonPool()
}

async function score() {
  const pool = getNeonPool()
  const { rows } = await pool.query<{
    position_id: string; verdict: string; failure_type: string | null; note: string
    proposition: string; qualified: boolean | null; kind: string | null; condition: string | null
    quote_found: boolean | null; quote: string | null; extract: string
  }>(`
    SELECT r.position_id::text, r.verdict, r.failure_type, COALESCE(r.note,'') note, pr.text proposition,
           p.extract, q.qualified, q.kind, q.condition, q.quote_found, q.quote
    FROM graph_position_review r
    JOIN graph_position p ON p.id = r.position_id
    JOIN graph_proposition pr ON pr.id = p.proposition_id
    LEFT JOIN graph_position_qualifier q ON q.position_id = r.position_id AND q.pass = $1
    ORDER BY r.verdict, r.failure_type NULLS FIRST`, [PASS])

  // ⚠ A qualification whose quote is not in the document is NOT counted as detected.
  const isQ = (r: { qualified: boolean | null; quote_found: boolean | null }) => !!r.qualified && !!r.quote_found
  const nuance = rows.filter((r) => r.failure_type === 'nuance-flattened')
  const correct = rows.filter((r) => r.verdict === 'correct')
  const other = rows.filter((r) => r.verdict !== 'correct' && r.failure_type !== 'nuance-flattened')

  const fixed = nuance.filter(isQ)
  const missed = nuance.filter((r) => !isQ(r))
  const falseQ = correct.filter(isQ)
  const held = correct.filter((r) => !isQ(r))

  console.log(`\n════ SCORING THE SECOND PASS ON THE SAME FIFTY ════`)
  console.log(`  the target: 11 positions the hand-read marked nuance-flattened\n`)
  console.log(`  ✓ FIXED               nuance-flattened, now carries a located condition   ${String(fixed.length).padStart(3)} / ${nuance.length}`)
  console.log(`  · MISSED              nuance-flattened, still recorded plain              ${String(missed.length).padStart(3)} / ${nuance.length}`)
  console.log(`  ⚠ FALSE QUALIFICATION baseline CORRECT, the pass adds a condition anyway  ${String(falseQ.length).padStart(3)} / ${correct.length}   ← the control`)
  console.log(`  ✓ HELD                baseline correct, left alone                        ${String(held.length).padStart(3)} / ${correct.length}`)
  console.log(`  · UNTOUCHED           invented / flipped / mismatch — not this pass's job ${String(other.length).padStart(3)}`)

  const unverified = rows.filter((r) => r.qualified && !r.quote_found)
  console.log(`\n  ⚠ ${unverified.length} rows claimed a qualification whose quote is NOT in the document. Not counted as fixes.`)

  console.log(`\n── the ${nuance.length} nuance-flattened cases, one line each`)
  for (const r of nuance) {
    console.log(`  ${isQ(r) ? '✓' : '·'} ${r.position_id.padStart(6)} ${(r.kind ?? '—').padEnd(12)} ${r.qualified && !r.quote_found ? '⚠unlocated ' : ''}${(r.condition ?? '(none)').slice(0, 88)}`)
  }
  if (falseQ.length) {
    console.log(`\n── ⚠ the ${falseQ.length} FALSE qualifications, which are the cost of the fixes`)
    for (const r of falseQ) console.log(`    ${r.position_id.padStart(6)} ${(r.kind ?? '—').padEnd(12)} ${(r.condition ?? '').slice(0, 88)}`)
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // ⚠⚠ THE CORRECTION, AND IT CHANGES THE ANSWER
  //
  // The 23 rows above were scored 'correct' on POLARITY AND EXTRACT. The hand-read never asked
  // whether they were QUALIFIED. Calling every qualification found on them a false positive
  // therefore assumes something the answer key does not contain — an uncontrolled comparison of
  // exactly the kind this workstream has been caught making before.
  //
  // So all 14 were read by hand against the claim, the position passage and the located quote.
  // `qualify-verdicts.json` holds one verdict and one reason each, and the honest precision is
  // computed from those rather than from the 2D-3 verdict, which was answering a different question.
  // ════════════════════════════════════════════════════════════════════════════════════════════
  const hand: { verdicts: Record<string, { real: boolean; note: string }> } =
    require('./qualify-verdicts.json')
  const adjudicated = falseQ.map((r) => ({ ...r, hand: hand.verdicts[r.position_id] }))
  const unjudged = adjudicated.filter((r) => !r.hand)
  const genuine = adjudicated.filter((r) => r.hand?.real)
  const spurious = adjudicated.filter((r) => r.hand && !r.hand.real)

  console.log(`\n════ ⚠ THE 14 RE-READ BY HAND, BECAUSE THE ANSWER KEY DID NOT COVER THEM ════`)
  if (unjudged.length) console.log(`  ⚠⚠ ${unjudged.length} have NO hand verdict — the score below is incomplete: ${unjudged.map((r) => r.position_id).join(', ')}`)
  console.log(`\n  ✓ GENUINE   a real qualification the 2D-3 hand-read simply never assessed  ${String(genuine.length).padStart(3)}`)
  for (const r of genuine) console.log(`      ${r.position_id.padStart(6)} ${(r.kind ?? '').padEnd(12)} ${r.hand!.note.slice(0, 96)}`)
  console.log(`\n  ✗ SPURIOUS  not a qualification                                            ${String(spurious.length).padStart(3)}`)
  for (const r of spurious) console.log(`      ${r.position_id.padStart(6)} ${(r.kind ?? '').padEnd(12)} ${r.hand!.note.slice(0, 96)}`)

  const circular = rows.filter((r) => r.qualified && r.quote && (r as { extract?: string }).extract
    && conditionIsCircular(String((r as { extract?: string }).extract), String(r.quote)))
  // ⚠ A DIAGNOSTIC, NOT A VERDICT. It fires on rows I judged genuine as well as spurious, so it does
  // not measure validity. What it measures is whether the pass brought any NEW EVIDENCE: when the
  // condition quote is the position passage over again, the pass re-described one sentence rather
  // than finding a limiting one. On the genuine rows that usually means the CLAIM is broader than
  // the position — a claim-writing problem. Reading it as a spuriousness test would discard real
  // findings, which is what the first, looser version of the rule would have done.
  console.log(`\n  ⚠ ${circular.length} of the ${rows.filter((r) => r.qualified).length} located conditions RE-QUOTE THE POSITION PASSAGE rather than a limiting one`)
  console.log(`    — the pass found no new evidence on those, genuine and spurious alike: ${circular.map((r) => r.position_id).join(', ') || '(none)'}`)

  const located = fixed.length + falseQ.length
  const real = fixed.length + genuine.length
  console.log(`\n════ THE SCORE, BOTH WAYS ════`)
  console.log(`  as first computed, against the 2D-3 key alone:`)
  console.log(`      ${fixed.length} of ${located} located qualifications on a flagged row = ${(100 * fixed.length / Math.max(1, located)).toFixed(0)}% precision`)
  console.log(`  ⚠ after hand-reading the 14 the key could not judge:`)
  console.log(`      ${real} of ${located} located qualifications are REAL = ${(100 * real / Math.max(1, located)).toFixed(0)}% precision`)
  console.log(`      recall on the 11 known nuance failures: ${fixed.length}/11 = ${(100 * fixed.length / Math.max(1, nuance.length)).toFixed(0)}%`)
  console.log(`\n  ⚠⚠ AND THE BASELINE ITSELF IS UNDERSTATED: ${genuine.length} of the 23 rows scored 'correct' carry a`)
  console.log(`     qualification nobody recorded. The nuance problem is bigger than 11 in 50, not smaller.`)
  console.log(`\n  ⚠ n=50, and the second hand-read is by the same reader as the first. These are proportions of a`)
  console.log(`    small sample scored by one person, not corpus rates.`)
  await endNeonPool()
}

// ── offline self-test ───────────────────────────────────────────────────────────────────────────
function selftest() {
  const isQ = (q: boolean | null, f: boolean | null) => !!q && !!f
  const cases: Array<[string, boolean]> = [
    ['the schema offers no way to change a polarity',
      !JSON.stringify(SCHEMA).includes('polarity') && !JSON.stringify(SCHEMA).includes('for')],
    ['the schema requires a verbatim quote', JSON.stringify(SCHEMA).includes('conditionQuote')],
    ['all four kinds are offered', ['conditional', 'scoped', 'weighed', 'reserved'].every((k) => (SCHEMA.properties.kind.enum as string[]).includes(k))],
    ['⚠ the not-qualified kind is "none", never "" — Gemini 400s on an empty enum value',
      (SCHEMA.properties.kind.enum as string[]).includes('none')
      && !(SCHEMA.properties.kind.enum as string[]).some((k) => k === '')],
    ['the prompt tells the model it cannot change the position', /cannot change it/i.test(PROMPT)],
    ['the prompt biases towards NOT qualified', /if you are unsure, answer false/i.test(PROMPT)],
    ['⚠ the prompt refuses vehemence as qualification', /vehemence is not qualification/i.test(PROMPT)],
    // the scoring rule
    ['a qualification with a located quote counts', isQ(true, true)],
    ['⚠ a qualification whose quote is NOT located does NOT count', !isQ(true, false)],
    ['a plain answer does not count', !isQ(false, false)],
    ['a missing row (never scored) does not count', !isQ(null, null)],
    // ⚠ the circular-condition check, watched both ways
    ['⚠ a condition identical to the position passage is circular',
      conditionIsCircular('Investment in workforce capacity is critical.', 'Investment in workforce capacity is critical.')],
    ['⚠ and it is whitespace-insensitive, because the source spacing is broken',
      conditionIsCircular('Investment  in\nworkforce capacity', 'investment in workforce capacity')],
    ['a genuinely different condition is NOT circular',
      !conditionIsCircular('We support integration of AHPs.', 'provided greater funding follows')],
    ['⚠⚠ a condition CONTAINED IN the position passage is NOT circular — containment is the normal case',
      !conditionIsCircular('We support integration of AHPs, provided greater funding follows.', 'provided greater funding follows')],
    ['an empty side is not circular', !conditionIsCircular('', 'anything')],
  ]
  let bad = 0
  for (const [n, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

async function main() {
  if (flag('self-test')) return selftest()
  if (flag('score')) return score()
  await run()
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1) })
