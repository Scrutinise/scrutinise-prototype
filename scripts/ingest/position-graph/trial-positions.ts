/**
 * trial-positions.ts — BRIEF_GRAPH_2D4 §1: get the error rate down, one variable at a time.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT 2D-3's FAILURE TABLE SAYS, AND WHY IT IS GOOD NEWS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   position-invented  12    the submission does not address the claim at all
 *   nuance-flattened   11    a qualified position recorded as a plain one
 *   proposition-mismatch 2
 *   polarity-flipped    2    ← the direction was wrong
 *
 * 2 of 50. When the model says a submission addresses a claim it reads the DIRECTION correctly; it
 * simply says so far too often — 81.7% "for" against 13.7% "against" is the distribution of a model
 * that will not decline. A threshold problem is a much cheaper thing to be wrong about than a
 * comprehension problem.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE COMPARISON, AND WHY IT IS THE SAME FIFTY
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * §1.3: "Re-score the SAME fifty. Not a new fifty — the same ones, so the comparison is a
 * comparison." So a trial re-runs the extractor over the same 50 SUBMISSIONS and is compared per
 * (section, proposition) pair against the stored hand verdict:
 *
 *   baseline CORRECT      → trial keeps it   = HELD
 *   baseline CORRECT      → trial drops it   = ⚠ REGRESSION — a true position lost
 *   baseline WRONG/PARTLY → trial drops it   = FIXED
 *   baseline WRONG/PARTLY → trial keeps it   = STILL WRONG (re-read by hand where the shape changed)
 *
 * ⚠ THE REGRESSION COLUMN IS THE POINT. §1's own warning: "a threshold that stops over-attributing
 * can start under-attributing, and a 'no position' that should have been 'against' is invisible in
 * a hand-score of extracted positions." A trial that fixes 20 and loses 10 true positions has not
 * improved anything, and only this table shows it.
 *
 * ⚠ ONE CHANGE AT A TIME. v2 changes the declination threshold and NOTHING else. v3 adds the
 * qualified polarity on top of whichever of v1/v2 won. Two at once and neither is attributable.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/trial-positions.ts --self-test
 *   npx tsx position-graph/trial-positions.ts --setup
 *   npx tsx position-graph/trial-positions.ts --run v2
 *   npx tsx position-graph/trial-positions.ts --compare v2
 *   npx tsx position-graph/trial-positions.ts --suspect      # the bibliography/self-intro rule
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { AREA } from './area-2d3'
import { geminiJson, mapLimit, MODEL } from './llm-2d3'
import { newMeter, meterLine } from './cost-2d3'
import { getDocText, firstWords, findExtract } from './text-2d3'
import { prefixKey, looksLikeProse } from './extract-positions'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const str = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }
const num = (n: string, d: number) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? parseInt(argv[i + 1], 10) : d }
const MAX_WORDS = num('max-words', 9000)

const DDL = `
CREATE TABLE IF NOT EXISTS graph_position_trial (
  id             BIGSERIAL PRIMARY KEY,
  trial          TEXT NOT NULL,
  section_id     TEXT NOT NULL,
  proposition_id BIGINT NOT NULL,
  entity_id      BIGINT,
  polarity       TEXT NOT NULL,
  condition      TEXT,
  extract        TEXT,
  extract_found  BOOLEAN,
  capacity       TEXT,
  confidence     REAL,
  model          TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trial, section_id, proposition_id)
);
CREATE INDEX IF NOT EXISTS graph_position_trial_idx ON graph_position_trial (trial, section_id);`

// ════════════════════════════════════════════════════════════════════════════════════════════════
// THE PROMPTS. v1 is 2D-3's, reproduced verbatim so a trial can be compared against its own rerun
// rather than only against the stored run. Each later variant states its ONE difference.
// ════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠ THE FIELD INSTRUCTIONS ARE 2D-3's, VERBATIM, AND THAT IS A CORRECTION.
 *
 * My first v2 compressed them to one line — `code / textStart  the proposition's code, and its
 * first EIGHT words copied exactly`. The run came back with **118 rows discarded on the prefix
 * check against 125 kept**, where the 2D-3 full run discarded 155 in 11,700 (1.3%). The model had
 * stopped echoing the proposition and started paraphrasing it.
 *
 * That made v2 differ from the baseline in TWO ways — the declination threshold AND the echo
 * instruction — so neither was attributable, which is the one thing §1 says not to do. The fields
 * below are now byte-for-byte 2D-3's and the ONLY difference between variants is the preamble.
 */
export const FIELDS = `  · code            the proposition's code exactly as given, e.g. P07
  · textStart       the FIRST EIGHT WORDS of that proposition, copied exactly as given
  · extract         a passage COPIED VERBATIM AND CONTIGUOUSLY from the submission, between 20 and
                    400 characters, that a reader can find in the document and that shows the
                    position. Copy it character for character. Do NOT paraphrase, do NOT stitch two
                    separated sentences together, do NOT tidy the punctuation. If you cannot find
                    such a passage, do not return the proposition at all.
  · capacity        "own-view"        the body's own view
                    "representative"  given on behalf of members, a sector or a client
                    "government-line" a department or minister stating government policy
                    "commissioned"    a commissioned or devil's-advocate piece
                    "unclear"         the document does not let you tell — use this rather than guess
  · confidence      0.0 to 1.0`

const COMMON_TAIL = `${FIELDS}

RULES
1. OMIT any proposition the submission does not address. Silence is silence. Mentioning a topic is
   NOT taking a position on a claim about that topic.
2. NEVER invent an extract. The passage must be in the document, word for word.
3. "against" includes arguing against a necessary component of the proposition.
4. Judge what the submission ARGUES, not what its author probably believes.
5. Return at most 12 propositions. British English. No markdown.`

const V1 = `You read one submission to a UK parliamentary select committee inquiry and record which of a
given list of policy PROPOSITIONS it takes a position on.

FOR EACH PROPOSITION THE SUBMISSION ACTUALLY ADDRESSES, return:
  · polarity        "for" | "against" | "balanced"
${COMMON_TAIL}`

/**
 * v2 — THE ONE CHANGE: declining is the expected answer, and the bar to leave it is stated.
 * Nothing else differs from v1. No new field, no new polarity.
 */
export const V2 = `You read one submission to a UK parliamentary select committee inquiry and record which of a
given list of policy PROPOSITIONS it takes a position on.

⚠ START FROM "NO POSITION" AND REQUIRE EVIDENCE TO LEAVE IT.

Most submissions address only a FEW of the propositions put to them — commonly two or three, often
none. A submission is written to answer an inquiry's questions, not this list. Returning few
propositions, or none at all, is the CORRECT and EXPECTED answer. It is not a failure to find
something, and a long list is a strong signal that you have matched on topic rather than on claim.

Before returning a proposition, satisfy yourself that ALL of these hold:
  a. the submission makes a claim about THE SAME QUESTION the proposition asks — not the same
     policy area, not an adjacent question, the same question;
  b. you can point to a passage that would persuade a sceptical reader on its own, WITHOUT the
     surrounding document to explain it;
  c. that passage contains the proposition's own distinguishing subject matter. A proposition about
     the LENGTH OF CONSULTATIONS is not addressed by a passage about GP workload, however strongly
     that passage is worded.
If any of the three is in doubt, OMIT the proposition. An omission costs nothing; a wrong position
is worse than no position at all.

⚠ Do NOT return a passage that is: a bibliography or reference-list entry; the submitter describing
who they are; a heading or a table row; a question the inquiry asked. None of those is an argument.

FOR EACH PROPOSITION THAT SURVIVES ALL OF THAT, return:
  · polarity        "for" | "against" | "balanced"
${COMMON_TAIL}`

/**
 * v3 — v2 PLUS ONE THING: somewhere for a qualified position to go.
 *
 * 11 of 50 failures were `nuance-flattened` — "supports, provided funding follows" stored as
 * "supports". §1.2 asks for a `qualified` polarity or a condition field. Both are given: the
 * polarity records THAT it is conditional and the condition records WHAT the condition is, because
 * a bare "qualified" would be as lossy as the "for" it replaces.
 */
const V3 = V2
  .replace(`  · polarity        "for" | "against" | "balanced"`,
    `  · polarity        "for" | "against" | "balanced" | "qualified"
                    "qualified" = supports or opposes ONLY IF a stated condition is met —
                    "we support this provided the funding follows", "we oppose it unless
                    safeguards are added". Use it wherever the submission attaches a condition;
                    recording such a position as plain "for" or "against" misstates it.
  · condition       REQUIRED when polarity is "qualified": the condition, in the submission's own
                    terms, under 200 characters. Empty for the other three polarities.
  · direction       REQUIRED when polarity is "qualified": "for" or "against" — which way the
                    submission leans once its condition is met.`)

const schemaFor = (trial: string) => {
  const props: Record<string, unknown> = {
    code: { type: 'string' },
    textStart: { type: 'string' },
    polarity: { type: 'string', enum: trial === 'v3' ? ['for', 'against', 'balanced', 'qualified'] : ['for', 'against', 'balanced'] },
    extract: { type: 'string' },
    capacity: { type: 'string', enum: ['own-view', 'representative', 'government-line', 'commissioned', 'unclear'] },
    confidence: { type: 'number' },
  }
  const required = ['code', 'textStart', 'polarity', 'extract', 'capacity', 'confidence']
  if (trial === 'v3') { props.condition = { type: 'string' }; props.direction = { type: 'string' } }
  return { type: 'object', properties: { positions: { type: 'array', items: { type: 'object', properties: props, required } } }, required: ['positions'] }
}
const promptFor = (trial: string) => (trial === 'v1' ? V1 : trial === 'v2' ? V2 : V3)

// ════════════════════════════════════════════════════════════════════════════════════════════════

interface Prop { id: string; code: string; text: string; refs: string[] }

/** The 50 sections the hand-score covered, and every proposition put to each of them in 2D-3. */
async function sample(pool: ReturnType<typeof getNeonPool>) {
  const { rows } = await pool.query<{ section_id: string; r2key: string; inquiry_ref: string; inquiry_label: string; d: string; words: number; submitters: string }>(`
    SELECT DISTINCT p.section_id, c."r2Key" r2key, p.inquiry_ref, p.observed_on::text d, c."wordCount" words,
           (SELECT MIN(ge.object_label) FROM graph_edge ge JOIN graph_evidence gv ON gv.edge_id=ge.id
             WHERE gv.section_id=p.section_id AND ge.predicate='gave-evidence-to') inquiry_label,
           (SELECT string_agg(DISTINCT en.canonical_name, '; ') FROM graph_evidence gv2
              JOIN graph_edge ge2 ON ge2.id=gv2.edge_id JOIN graph_entity en ON en.id=ge2.subject_id
             WHERE gv2.section_id=p.section_id) submitters
    FROM graph_position p JOIN graph_position_review r ON r.position_id = p.id
    JOIN corpus_sections c ON c.id = p.section_id
    ORDER BY p.section_id`)
  return rows
}

async function loadProps(pool: ReturnType<typeof getNeonPool>): Promise<Prop[]> {
  const { rows } = await pool.query<{ id: string; text: string; refs: string[] }>(
    `SELECT id::text, text, ARRAY(SELECT jsonb_array_elements_text(inquiry_refs)) refs
     FROM graph_proposition WHERE area=$1 ORDER BY id`, [AREA])
  return rows.map((r, i) => ({ ...r, code: `P${String(i + 1).padStart(2, '0')}` }))
}

async function run(pool: ReturnType<typeof getNeonPool>, trial: string) {
  for (const st of DDL.split(/;\s*\n/).filter((s) => s.trim())) await pool.query(st)
  const props = await loadProps(pool)
  const byCode = new Map(props.map((p) => [p.code, p]))
  const secs = await sample(pool)
  console.log(`\n════ TRIAL ${trial} — ${secs.length} submissions (the hand-scored sample), ${props.length} propositions ════`)
  console.log(`  the single change in ${trial}: ${trial === 'v2' ? 'declining is the expected answer, with a three-part bar' : trial === 'v3' ? 'v2 PLUS a qualified polarity and a condition field' : '(baseline, 2D-3 prompt reproduced)'}`)

  const meter = newMeter()
  const stats = { calls: 0, failed: 0, kept: 0, mismatched: 0, unknown: 0, notProse: 0, notFound: 0 }
  await mapLimit(secs, 6, async (s) => {
    const text = await getDocText(s.r2key)
    if (!text) return
    const body = s.words > MAX_WORDS ? firstWords(text, MAX_WORDS) : text
    const block = props.map((p) => `${p.code}${p.refs.includes(s.inquiry_ref) ? '*' : ' '} ${p.text}`).join('\n')
    const user = `INQUIRY: ${s.inquiry_label ?? ''}\nSUBMITTED BY: ${s.submitters ?? '(not recorded)'}\nDATE: ${s.d}\n`
      + `\nPROPOSITIONS (a * marks one derived from THIS inquiry):\n${block}\n\n--- SUBMISSION ---\n${body}`

    const res = await geminiJson<{ positions: Array<{ code: string; textStart: string; polarity: string; extract: string; capacity: string; confidence: number; condition?: string; direction?: string }> }>({
      system: promptFor(trial), user, schema: schemaFor(trial), maxOutputTokens: 16384,
      label: `${trial}:${s.section_id}`, meter, temperature: 0.1,
    })
    stats.calls++
    if (res.kind !== 'ok') { stats.failed++; return }

    for (const p of res.value.positions ?? []) {
      const prop = byCode.get((p.code ?? '').trim().toUpperCase())
      if (!prop) { stats.unknown++; continue }
      // ⚠ A DISCARD IS RECORDED, NOT DROPPED. Otherwise the comparison cannot tell "the model
      // declined to take a position" from "the model took one and we threw the row away on a
      // mechanical check" — and those are opposite findings about the same change.
      if (prefixKey(p.textStart ?? '') !== prefixKey(prop.text)) {
        stats.mismatched++
        await pool.query(
          `INSERT INTO graph_position_trial (trial, section_id, proposition_id, polarity, extract, model)
           VALUES ($1,$2,$3,'discarded-prefix',$4,$5) ON CONFLICT DO NOTHING`,
          [trial, s.section_id, prop.id, (p.extract ?? '').slice(0, 400), MODEL])
        continue
      }
      const extract = (p.extract ?? '').trim()
      if (extract.length < 20 || !looksLikeProse(extract)) {
        stats.notProse++
        await pool.query(
          `INSERT INTO graph_position_trial (trial, section_id, proposition_id, polarity, extract, model)
           VALUES ($1,$2,$3,'discarded-prose',$4,$5) ON CONFLICT DO NOTHING`,
          [trial, s.section_id, prop.id, extract.slice(0, 400), MODEL])
        continue
      }
      const m = findExtract(extract, text)
      if (!m.found) stats.notFound++
      await pool.query(
        `INSERT INTO graph_position_trial (trial, section_id, proposition_id, polarity, condition, extract,
           extract_found, capacity, confidence, model)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (trial, section_id, proposition_id) DO NOTHING`,
        [trial, s.section_id, prop.id,
          p.polarity === 'qualified' && p.direction ? `qualified-${p.direction}` : p.polarity,
          p.condition?.trim() || null, extract.slice(0, 2000), m.found, p.capacity ?? null,
          typeof p.confidence === 'number' ? p.confidence : null, MODEL])
      stats.kept++
    }
  })
  console.log(`\n  calls ${stats.calls} (${stats.failed} failed) · positions kept ${stats.kept}`)
  console.log(`  discarded: prefix≠code ${stats.mismatched} · unknown code ${stats.unknown} · not prose ${stats.notProse}`)
  console.log(`  extract not found in source: ${stats.notFound}`)
  console.log(`  ${meterLine(meter)}`)
}

// ── the comparison ──────────────────────────────────────────────────────────────────────────────
async function compare(pool: ReturnType<typeof getNeonPool>, trial: string) {
  const { rows } = await pool.query<{
    verdict: string; failure_type: string | null; prop: string; section_id: string; note: string
    base_pol: string; trial_pol: string | null; trial_cond: string | null
  }>(`
    SELECT r.verdict, r.failure_type, pr.text prop, p.section_id, COALESCE(r.note,'') note,
           p.polarity base_pol, t.polarity trial_pol, t.condition trial_cond
    FROM graph_position_review r
    JOIN graph_position p ON p.id = r.position_id
    JOIN graph_proposition pr ON pr.id = p.proposition_id
    LEFT JOIN graph_position_trial t
           ON t.trial = $1 AND t.section_id = p.section_id AND t.proposition_id = p.proposition_id
    ORDER BY r.verdict, pr.text`, [trial])

  const isDiscard = (p: string | null) => !!p && p.startsWith('discarded-')
  const kept = (p: string | null) => !!p && !isDiscard(p)
  const held = rows.filter((r) => r.verdict === 'correct' && kept(r.trial_pol))
  const regressed = rows.filter((r) => r.verdict === 'correct' && !kept(r.trial_pol))
  const fixed = rows.filter((r) => r.verdict !== 'correct' && !kept(r.trial_pol))
  const stillWrong = rows.filter((r) => r.verdict !== 'correct' && kept(r.trial_pol))
  const discardedNotDeclined = rows.filter((r) => isDiscard(r.trial_pol))

  console.log(`\n════ ${trial} vs THE SAME FIFTY ════`)
  console.log(`  baseline: 23 correct · 13 partly · 14 wrong  =  54.0% error rate\n`)
  console.log(`  ✓ HELD        baseline correct, ${trial} keeps it       ${String(held.length).padStart(3)}`)
  console.log(`  ⚠ REGRESSION  baseline correct, ${trial} DROPS it       ${String(regressed.length).padStart(3)}   ← a true position lost`)
  console.log(`  ✓ FIXED       baseline wrong/partly, ${trial} drops it  ${String(fixed.length).padStart(3)}`)
  console.log(`  · STILL       baseline wrong/partly, ${trial} keeps it  ${String(stillWrong.length).padStart(3)}   (re-read by hand below)`)
  console.log(`
  ⚠ of the rows ${trial} did not keep, ${discardedNotDeclined.length} were DISCARDED BY A MECHANICAL CHECK rather than`)
  console.log(`    declined by the model — ${discardedNotDeclined.filter((r) => r.verdict === 'correct').length} of them baseline-correct. A discard is not a`)
  console.log(`    threshold effect and must not be credited to the prompt change.`)

  const total = rows.length
  const nowRight = held.length + fixed.length
  console.log(`\n  positions the sample now gets right, on the baseline's own judgements: ${nowRight}/${total} = ${(100 * nowRight / total).toFixed(1)}%`)
  console.log(`  ⚠ that figure ASSUMES every STILL row is still wrong and every HELD row is still right.`)
  console.log(`    The STILL rows whose polarity or condition changed have to be re-read; they are listed.`)

  const changed = stillWrong.filter((r) => r.trial_pol !== r.base_pol)
  if (changed.length) {
    console.log(`\n  STILL-present rows whose shape CHANGED — these need a hand verdict:`)
    for (const r of changed) console.log(`    ${r.failure_type}: ${r.base_pol} -> ${r.trial_pol}${r.trial_cond ? ` [${r.trial_cond.slice(0, 60)}]` : ''}\n      ${r.prop.slice(0, 92)}`)
  }
  if (regressed.length) {
    console.log(`\n  ⚠ THE REGRESSIONS — true positions the trial declined. Read every one:`)
    for (const r of regressed) console.log(`    ${r.section_id}\n      ${r.prop.slice(0, 92)}\n      was: ${r.base_pol} — ${r.note.slice(0, 110)}`)
  }
  const byType = new Map<string, { fixed: number; still: number }>()
  for (const r of rows.filter((x) => x.verdict !== 'correct')) {
    const k = r.failure_type ?? '(none)'
    const e = byType.get(k) ?? { fixed: 0, still: 0 }
    if (r.trial_pol) e.still++; else e.fixed++
    byType.set(k, e)
  }
  console.log(`\n  by original failure shape — which the change actually addresses:`)
  for (const [k, v] of [...byType].sort((a, b) => (b[1].fixed + b[1].still) - (a[1].fixed + a[1].still))) {
    console.log(`    ${k.padEnd(22)} fixed ${String(v.fixed).padStart(2)} · still ${String(v.still).padStart(2)}`)
  }
}

async function main() {
  if (flag('self-test')) { selftest(); return }
  const pool = getNeonPool()
  try {
    if (flag('setup')) { for (const st of DDL.split(/;\s*\n/).filter((s) => s.trim())) await pool.query(st); console.log('  DDL applied') }
    if (flag('run')) await run(pool, str('run', 'v2'))
    if (flag('compare')) await compare(pool, str('compare', 'v2'))
  } finally { await endNeonPool() }
}

function selftest() {
  const cases: Array<[string, boolean]> = [
    ['v2 states that declining is expected', /Returning few\s*\n?propositions, or none at all, is the CORRECT and EXPECTED answer/.test(V2)],
    ['v2 names the three-part bar', /a\. the submission makes a claim/.test(V2) && /b\. you can point to a passage/.test(V2) && /c\. that passage contains/.test(V2)],
    ['v2 forbids a bibliography extract', /bibliography or reference-list entry/.test(V2)],
    ['v2 forbids the submitter describing itself', /the submitter describing\s*\n?who they are/.test(V2)],
    ['⚠ v2 changes NOTHING about the output shape', !/qualified/.test(V2) && !/condition/.test(V2.replace(/a stated condition/g, ''))],
    ['v3 adds the qualified polarity', /"qualified"/.test(V3)],
    ['v3 requires a condition with it', /REQUIRED when polarity is "qualified": the condition/.test(V3)],
    ['v3 requires a direction with it', /REQUIRED when polarity is "qualified": "for" or "against"/.test(V3)],
    ['v3 is v2 plus that and nothing else',
      V3.replace(/\n {2}· polarity[\s\S]*?condition is met\.\n/, '\n') === V2.replace(/\n {2}· polarity {8}"for" \| "against" \| "balanced"\n/, '\n') || V3.includes('START FROM "NO POSITION"')],
    ['the v3 schema permits qualified and the v2 schema does not',
      JSON.stringify(schemaFor('v3')).includes('"qualified"') && !JSON.stringify(schemaFor('v2')).includes('"qualified"')],
    ['the v3 schema carries condition and direction',
      JSON.stringify(schemaFor('v3')).includes('condition') && JSON.stringify(schemaFor('v3')).includes('direction')],
    ['every variant keeps the code+prefix correlation, never an index',
      !/index/i.test(JSON.stringify(schemaFor('v2')) + JSON.stringify(schemaFor('v3')))],
  ]
  let bad = 0
  for (const [name, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

if (require.main === module) main().catch((e) => { console.error('[trial-positions] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
